---
name: proxy-fetch
description: 通过代理访问被 WAF / 地域拦截的外部服务，并诊断「为什么抓不到」。用于 spider 抓 Transfermarkt 返回 403/405/验证码、配置或更换代理地址(SCRAPER_PROXY)、验证代理是否生效、排查出网被墙。Use when scraping fails, a proxy needs configuring or testing, Transfermarkt returns a captcha / WAF challenge, or outbound access to an upstream must be verified.
---

# 通过代理访问上游服务（spider / Transfermarkt）

spider 唯一的上游 Transfermarkt 在 AWS WAF 后面。**WAF 的判定几乎只看源 IP 的信誉**：数据中心出口（AWS / 阿里云 / GCP）每次请求都被挑战，住宅出口直接放行。所以「能不能抓」等价于「我的出口 IP 是什么、是不是住宅」——这跟「代理通不通」是**两件事**，必须分开诊断。

驱动脚本：`.claude/skills/proxy-fetch/proxy_probe.py`（路径相对 `spider/`）。它把这两层拆开测，并且第 4 步直接调用项目自己的 `app.scraper` fetcher + parser，而不是另写一套 HTTP —— 通过了就等于真实抓取链路通了。

## 前置

```bash
python3.12 -m venv venv && ./venv/bin/pip install -r requirements.txt
```

必须用 `./venv/bin/python` 跑 driver。系统 python3（3.14）没有 httpx，会 `ModuleNotFoundError`。

## 配置代理地址

代理只放 `spider/.env`（已被 gitignore），**永远不要写进任何提交的文件**：

```bash
grep -n "^SCRAPER_PROXY" .env
```

在 `.env` 里写一行（格式 `http://user:pass@host:port`，也支持 `socks5://`）：

```
SCRAPER_PROXY=http://<user>:<pass>@<host>:<port>
```

driver 取值优先级：`--proxy` > 环境变量 `$SCRAPER_PROXY` > `spider/.env`。临时试一个地址不用改文件：

```bash
./venv/bin/python .claude/skills/proxy-fetch/proxy_probe.py --proxy http://user:pass@host:port doctor
```

## 运行（agent 路径）

一条命令跑完全部四层检查：

```bash
./venv/bin/python .claude/skills/proxy-fetch/proxy_probe.py doctor
```

全绿时的真实输出：

```
1. egress identity
[PASS] residential -- 91.39.81.11 Osnabrück, DE -- AS3320 Deutsche Telekom AG
2. upstream through the proxy
[PASS] proxied: HTTP 200, 925533B, title='Premier League - All fixtures &amp; results | Transfermarkt'
3. control: same URL, no proxy
[WARN] direct: WAF challenge -- HTTP 405, 2117B, markers=[...]
[PASS] direct is blocked as expected -- the proxy is what buys access
4. the spider's own fetcher + parser
[PASS] parsed 380 fixtures via the spider's own fetcher
```

单项子命令：

```bash
# 只比对直连 vs 代理的出口 IP 与信誉
./venv/bin/python .claude/skills/proxy-fetch/proxy_probe.py ip

# 抓任意 URL（不限 Transfermarkt），判定是否被 WAF 挑战
./venv/bin/python .claude/skills/proxy-fetch/proxy_probe.py fetch "https://www.transfermarkt.de/premier-league/startseite/wettbewerb/GB1"

# 同一个 URL 绕过代理做对照
./venv/bin/python .claude/skills/proxy-fetch/proxy_probe.py fetch --direct

# 走项目自己的抓取+解析链路，换联赛/赛季
./venv/bin/python .claude/skills/proxy-fetch/proxy_probe.py spider --comp GB1 --season 2025
```

退出码：0 = 通过，1 = 有失败项。输出里的代理凭证已脱敏成 `***:***@host:port`。

## 读结果：三种失败长得很像，结论完全不同

| doctor 的表现 | 真正的问题 | 处置 |
|---|---|---|
| 第 1 步 `proxy unreachable -- ConnectTimeout` | 代理地址/端口错，或凭证里的特殊字符没 URL-encode | 改 `SCRAPER_PROXY` |
| 第 1 步 `datacenter`，第 2 步 405 + markers | 代理**是通的**，但出口是机房 IP，WAF 照拦 | 换住宅代理／换出口国家，加 key 没用 |
| 第 1 步 `residential`，第 2 步仍 405 | 该住宅 IP 信誉也坏了（轮换到脏 IP） | 重跑一次换个出口 IP；连续失败再换服务商 |

## 让真实服务用上代理

`app/config.py` 的 `settings` 是**模块 import 时构建并 lru_cache 的**，改环境变量对已经跑起来的进程无效。实测反证：

```bash
./venv/bin/python -c "
import os, sys; sys.path.insert(0, '.')
os.environ['SCRAPER_PROXY'] = ''
from app.config import settings, get_settings
os.environ['SCRAPER_PROXY'] = 'http://set-too-late:1080'
print(repr(settings.scraper_proxy), repr(get_settings().scraper_proxy))
"
# -> '' ''   改晚了，完全不生效
```

所以：**改完 `.env` 必须重启进程**。生产上 `scripts/update-sports-spider.sh` 用 `docker run --env-file` 把 `.env` 灌进容器，换代理要重建/重启 `tm_app` 容器才算数。

## Gotchas

- **WAF 拦截不是 HTTP 错误，别只看状态码。** 被拦是 `HTTP 405` + 2117 字节的挑战页，正文里有 `awsWafCookieDomainList` / `Human Verification` / `gokuProps`。driver 用这三个 marker + `{403,405,429,503}` + `x-amzn-waf-action` 头判定，跟 `app/scraper/client.py` 保持一致。
- **`CaptchaError: 2captcha is not configured` 是最会骗人的报错。** 实测用一个出口为机房 IP 的代理跑 `doctor`，第 4 步报的就是它 —— 但真因是出口 IP 被 WAF 拒，塞 `TWOCAPTCHA_API_KEY` 也解决不了（脏 IP 上连解出来的 token 都会被拒）。看到它先跑 `ip` 看出口。
- **代理可达 ≠ 能抓。** 拿一个本地回环 CONNECT 代理实测过：连接完全正常，但出口还是本机的机房 IP，Transfermarkt 照样 405。所以 `doctor` 第 1 步必须查出口身份，而不是只 ping 通代理。
- **出口 IP 每次请求都在变。** 同一个 IPRoyal 地址连续跑三次，出口是 `80.143.72.155` / `91.39.81.11` / `79.225.26.196`（都是 AS3320 德国电信）。这是轮换住宅池的正常行为，但意味着：单次失败不代表代理坏了，重跑一次；也意味着任何绑定 IP 的 WAF token 天然短命。
- **密码尾巴上的 `_country-de` 是 IPRoyal 的出口国家参数，不是密码写错了。** 想换国家改这个后缀，别把它「修」掉。
- **`backend/internal/server/spider_proxy.go` 跟出网代理毫无关系。** 那是 admin 控制台经 Go 后端反向代理到 spider 的入站转发。出网代理只有一个开关：`SCRAPER_PROXY`。
- **本地起不了 spider API 来验证代理。** `uvicorn app.main:app` 的 lifespan 会连 Postgres，本地没库直接 `ConnectionRefusedError` + `Application startup failed. Exiting.`。本地要验证代理，driver 是唯一路径。
- **本地跑抓取必须关掉快照写入。** `STORE_RAW_HTML=true` 会往 rustfs/S3 写原始 HTML，本地没有该服务。driver 的 `spider` 子命令已自动设成 `false`。

## Troubleshooting

| 症状 | 修法 |
|---|---|
| `ModuleNotFoundError: No module named 'httpx'` | 用了系统 python。改用 `./venv/bin/python` |
| `proxy unreachable -- ConnectTimeout: timed out` | host/端口不对（实测把端口改成 9999 就是这个报错）；或凭证里的 `@` `:` 没 URL-encode |
| `Settings.scraper_proxy is empty -- env was set too late` | 有代码在设置 env 之前先 import 了 `app.config`。driver 里的顺序不能调 |
| `parsed 0 fixtures` 但 HTTP 200 | 页面抓到了但解析为空：多半是赛季/联赛代码不存在（换 `--season`），而不是代理问题 |
| 第 3 步 `direct` 也 PASS | 当前网络本来就能直连，代理非必需；生产服务器上不会是这样 |
