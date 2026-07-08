# 部署（线上 / 容器化）

爬虫后端用 `docker compose` 一键拉起:`postgres` + `rustfs` + `app`(FastAPI + 抓取 worker)。
前端已并入 sports-calendar 的 **admin** 控制台(菜单「Crawler」),不再由本栈托管;admin 跨域调用本栈的 `app` API。

```
admin(CF Worker) ──HTTPS──> cloudflared ──/api──> app:8000(宿主 127.0.0.1:8001) ──> postgres / rustfs
  (浏览器 fetch)              (spider-api.sports-calendar.com)   └─ 抓取 worker ──2captcha──> Transfermarkt
```

## 前置

- 一台装了 Docker + Docker Compose 的 Linux 主机(这里复用 `ssh sports-calendar` = root@39.102.211.97)
- 一个有余额的 **2captcha** 账号(无人值守解 AWS WAF 验证码的关键)
- 主机上已运行的 cloudflared 隧道(与 sports-calendar 其它服务共用)

## 步骤

1. 准备环境变量:

   ```bash
   cp .env.example .env
   ```

   线上必须确认 `.env` 里这几项:

   | 变量 | 线上取值 | 说明 |
   |------|---------|------|
   | `CAPTCHA_PROVIDER` | `2captcha` | 无人值守解码;`browser` 仅用于本地有显示器时(compose 已覆盖为 2captcha) |
   | `TWOCAPTCHA_API_KEY` | 你的 key | 没有则 WAF 拦截后会卡住 |
   | `SCRAPER_QPS` | `0.5`(保持 < 1) | 限流,避免被封 |
   | `CORS_ORIGINS` | admin 线上源(如 `https://admin.sports-calendar.com`) | 浏览器跨域调用 API 的白名单,必须填对 |

   > `DATABASE_URL`、`S3_ENDPOINT_URL`、`CAPTCHA_PROVIDER`、`SCRAPER_HEADLESS` 在 `docker-compose.yml` 的 `app.environment` 里已被覆盖为容器内服务名/无头值,**无需手改 `.env` 里的 localhost 值**。`.env` 只负责密钥、`CORS_ORIGINS` 与抓取调参。

2. 启动整栈:

   ```bash
   docker compose up -d --build
   ```

   首次会建表、确保 rustfs bucket 存在、启动抓取 worker。

3. 验证:

   ```bash
   curl -fsS http://127.0.0.1:8001/api/health          # {"status":"ok",...}
   curl -fsS http://127.0.0.1:8001/api/browser/status  # {"needs_verification":false,...}
   ```

## 架构要点

- **端口 / 暴露面**:`postgres` / `rustfs` 全在 compose 内网,无宿主端口。**唯一对宿主开放的是 `app` 的 `127.0.0.1:8001`**,由服务器上单独运行的 cloudflared 反代到公网。绑 `127.0.0.1` 意味着公网扫不到这个口,只有本机的 cloudflared 能连;`8001` 避开 Go 后端的 `5959`。
- **无人值守打码**:`app` 是 headless 容器,**不含 Chromium**。WAF 被拦时走 2captcha 直接拿回 `aws-waf-token`。`CAPTCHA_PROVIDER=browser` 的弹窗兜底在本容器内**不可用**(无显示器),所以请确保 2captcha 有余额。
- **token 持久化**:`aws-waf-token` 缓存在命名卷 `browser_profile`(挂到 `/app/.browser_profile`),重启不必重新解码。
- **数据持久化**:`pg_data`(Postgres)、`rustfs_data`(原始 HTML 快照)均为命名卷。

## 公网访问:Cloudflare Tunnel(服务器上单独运行)

后端无鉴权,所以**不直接对公网开端口**。本栈只把 API 暴露在 `127.0.0.1:8001`,公网入口由服务器上**单独运行的 cloudflared** 反代:

- Public Hostname `spider-api.sports-calendar.com` → `http://localhost:8001`
- 加对应 DNS 记录(CNAME 到隧道)
- admin 侧构建时设 `VITE_SPIDER_API_BASE_URL=https://spider-api.sports-calendar.com`
- spider 侧 `.env` 的 `CORS_ORIGINS` 填 admin 线上源

> 由于 API 无鉴权、仅靠 CORS 限源,后续可在该 hostname 上加 Cloudflare Access(注意:浏览器 fetch 场景需用支持的鉴权方式,别把 admin 的 XHR 挡在登录页外)。

## 运维

```bash
docker compose logs -f app        # 看抓取 / 2captcha 日志
docker compose ps                 # 健康状态
docker compose restart app        # 重启后端(token 仍在卷里)
docker compose down               # 停整栈(保留命名卷里的数据)
```
