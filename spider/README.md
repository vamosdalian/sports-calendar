# Transfermarkt Spider

> **集成说明**:本目录是爬虫**后端**(FastAPI + 抓取 worker),已并入 sports-calendar 仓库。
> 前端已移植进 **admin 控制台的「Crawler」菜单**(`admin/src/pages/crawler-page.tsx`),
> 本目录不再自带 `web/` 前端。部署见 [`docs/DEPLOY.md`](docs/DEPLOY.md)——线上只跑
> `postgres + rustfs + app`,`app` 暴露在宿主 `127.0.0.1:8001`,由 cloudflared 反代到
> `spider-api.sports-calendar.com`,admin 跨域调用(CORS 限定 admin 源)。
> 下文中涉及独立 `web/` 前端与旧 `:4399` 拓扑的段落为历史说明,以本横幅与 `docs/DEPLOY.md` 为准。

爬取 [transfermarkt.com](https://www.transfermarkt.com/) 的俱乐部、赛程、球员数据到本地的系统。

- **后端**:FastAPI + 进程内 asyncio worker + 全局令牌桶限流(**QPS < 1**,避免被封)
- **抓取(混合模式)**:平时用 **httpx 携带 `aws-waf-token` cookie 静默抓取**(快、无窗口);只有 cookie 失效被 **AWS WAF** 拦时,才弹出 patchright 真实 Chromium 让人解一次验证,解完同步新 cookie 再静默继续
- **数据库**:PostgreSQL(SQLAlchemy async + asyncpg)
- **对象存储**:rustfs(S3 兼容,保存每个页面的原始 HTML 快照)
- **前端**:React + Vite + TypeScript + Tailwind(shadcn 风格组件),无需登录,可列举/过滤联赛杯赛、选赛季触发抓取、看任务进度、浏览已抓数据
- **赛事目录**:不再写死,**从 Transfermarkt 爬取发现**——大洲→国家页爬全部联赛/杯赛,大洲页 "International cups" 框爬国际/国家队赛事(世界杯、欧洲杯、美洲杯、欧国联、各预选赛…),可随时一键重新同步

## ⚠️ 关于反爬(必读)

Transfermarkt 的每个请求都经过 AWS WAF,会下发 `x-amzn-waf-action: captcha` 的"Human Verification"页。实测 httpx、curl_cffi(TLS 指纹伪装)、Playwright/patchright 的 headless 与 headful 模式**都无法自动通过**。

本系统采用 **手动解一次 + httpx 静默复用 token** 的混合策略:

1. **平时抓取走 httpx**,携带 `aws-waf-token` cookie,后台静默完成,**不弹窗、不翻页**。token 同时缓存到 `.browser_profile/waf_cookies.json`,重启后直接加载,通常根本不开浏览器。
2. 当某个 httpx 请求被 WAF 拦(cookie 失效/超时),才**临时弹出 headful Chromium** 导航到该页触发验证。前端顶部出现**琥珀色"需要人工验证"横幅**。
3. 你在弹窗里**解一次验证**,系统把新的 `aws-waf-token` 同步回 httpx 与缓存文件,**关闭浏览器**,继续静默抓取。
4. 等待人工解验证最多 `SCRAPER_VERIFICATION_TIMEOUT`(默认 600s)。

> QPS < 1 解决的是"频率封禁",但躲不开 WAF 的人机验证,两者是不同层面的防护。
> 若想要**完全无人值守**,需接入打码服务(CapSolver/2Captcha 的 AntiAwsWaf 任务)—— fetcher 已设计为可插拔,后续可替换。

## 目录结构

```
app/                      后端
  main.py                 FastAPI 入口(启动建表/种子/起 worker)
  config.py               配置(pydantic-settings,读 .env)
  db.py / models.py       异步引擎 / ORM 模型
  repository.py           upsert 入库(ON CONFLICT)
  schemas.py              API 出入参
  rate_limiter.py         全局令牌桶(保证 QPS<1)
  storage.py              rustfs/S3 原始 HTML 快照
  worker.py               进程内后台 worker(轮询 jobs 表)
  jobrunner.py            单个任务的执行编排
  discovery_service.py    赛事目录发现的后台同步服务(带进度/状态)
  routers/                competitions / jobs / data 三组 API
  scraper/
    client.py             混合 fetcher(httpx 静默 + 限流 + WAF 拦截时才唤起浏览器解验证)
    transfermarkt.py      各页面抓取+解析(俱乐部/赛程/阵容)
    discovery.py          赛事目录发现(大洲→国家→联赛/杯赛 + 大洲国际/国家队赛事)
    parse_utils.py        解析工具(身价/身高/日期/ID/slug)
web/                      前端(React + Vite + Tailwind)
docker-compose.yml        postgres + rustfs
requirements.txt
.env.example
```

## 快速开始

### 1. 基础设施(postgres + rustfs)

```bash
docker compose up -d
```

### 2. 后端

```bash
python -m venv venv                 # 已用 Python 3.11
./venv/bin/pip install -r requirements.txt
./venv/bin/patchright install chromium   # 首次需下载 Chromium
cp .env.example .env
./venv/bin/uvicorn app.main:app --reload --port 8000
```

启动时会自动建表、写入种子赛事、确保 rustfs bucket 存在。

### 3. 前端

```bash
cd web
pnpm install
pnpm dev        # http://localhost:5173 (已配置 /api 代理到 :8000)
```

打开 http://localhost:5173:

1. **首次先点"同步赛事"** —— 从 Transfermarkt 发现全部联赛/杯赛目录(约 700+ 项 / 79 国,
   后台运行约 3 分钟,顶部有实时进度)。之后目录存在 DB 里,无需每次同步;想刷新时再点即可。
2. **点击某个赛事** → 进入详情:此处的赛季下拉是**从 Transfermarkt 实时读取的真实赛季**
   (不是写死的年份范围)。各赛事的 `saison_id` 语义不同(例如阿根廷联赛最新季的
   `saison_id=2023` 但显示 "2024";中国按自然年 `2025` 显示 "2026"),用真实值才能保证
   深层 URL(阵容/赛程)准确。
3. 选真实赛季 + 抓取范围 → 点"抓取"。
   首个任务会弹出 Chromium,**手动完成一次人机验证**后即自动抓取。同一详情页也能浏览已抓数据。

**浏览已抓数据**:点击列表里的赛事**名称**(不是抓取按钮)进入数据视图,
可看该赛季的俱乐部(再点俱乐部看阵容)和赛程比分。

## 配置项(.env)

| 变量 | 说明 | 默认 |
|------|------|------|
| `SCRAPER_QPS` | 全局每秒请求数,**保持 < 1** | `0.5` |
| `SCRAPER_HEADLESS` | 抓取浏览器是否无头(需手动解 captcha 时设 false) | `false` |
| `SCRAPER_BROWSER_PROFILE` | 持久化浏览器 profile 目录(缓存 WAF token) | `.browser_profile` |
| `SCRAPER_VERIFICATION_TIMEOUT` | 等待人工解 captcha 的秒数 | `600` |
| `STORE_RAW_HTML` | 是否把每个页面原始 HTML 存进 rustfs | `true` |
| `DATABASE_URL` / `S3_*` | 数据库与对象存储连接 | 见文件 |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/competitions?q=&type=&country=` | 列举/过滤联赛杯赛 |
| GET | `/api/competitions/countries` | 国家/地区列表 |
| POST | `/api/competitions/sync` | 从 Transfermarkt 发现并同步赛事目录(后台) |
| GET | `/api/competitions/sync` | 同步进度/状态 |
| GET | `/api/competitions/{id}/seasons` | 该赛事的**真实**赛季列表(saison_id+标签),首次按需抓取并缓存,`?refresh=true` 强制刷新 |
| POST | `/api/jobs` | 创建抓取任务 `{competition_id, season_id, scope}` |
| GET | `/api/jobs` | 任务列表(含进度) |
| GET | `/api/jobs/{id}` | 单个任务 |
| GET | `/api/data/clubs?competition_id=&season_id=` | 已抓取的俱乐部 |
| GET | `/api/data/players?club_id=&season_id=` | 俱乐部某赛季阵容 |
| GET | `/api/data/fixtures?competition_id=&season_id=` | 赛程 |
| GET | `/api/browser/status` | 当前是否在等待人工验证 |

`scope` 取值:`full`(俱乐部+赛程+球员) / `clubs` / `fixtures` / `players`。

## 说明 / 待办

- 解析选择器已用真实页面(Argentina Liga Profesional)校准:俱乐部(名称/阵容数/身价)、
  球员(姓名/位置/国籍/生日/身价/球衣号)、赛程(主客队/比分/日期+开球时间)均验证通过。
  `kickoff` 存为**无时区的本地日期时间**(date + 开球时间);TM 未公布时间时为当天 00:00,前端会隐藏。
  站点改版时在 `app/scraper/transfermarkt.py` 调整。
- **联赛 vs 杯赛**:联赛用 `/wettbewerb/CODE`、杯赛用 `/pokalwettbewerb/CODE`(jobrunner 按
  赛事 type 自动选择)。杯赛没有球队名单表,参赛球队从其赛程里推导。任务结果消息会明确
  报出"N 球队 / M 球员 / K 赛程",0 数据时给出提示,不会静默成功。
- **已知限制**:个别"区域赛/分组阶段"子赛事(如 Chinese Champions League Regional Stage)
  页面无标准表格,可能解析为 0 —— 此时任务消息会标注"未解析到数据"。
- 重新校准:确保浏览器 profile 里有有效 token 后,`PYTHONPATH=. ./venv/bin/python scripts/fetch_samples.py`
  会抓三类样本页到 `scripts/samples/`,可离线对照修选择器。
- 生产环境建议用 Alembic 做迁移(已装,当前为开发期 `create_all` 自动建表)。
- 抓取仅供学习研究,请遵守目标站点条款并保持低频(QPS < 1)。
