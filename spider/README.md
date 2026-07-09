# Transfermarkt Spider

> **集成说明**:本目录是爬虫**后端**(FastAPI + 抓取 worker),已并入 sports-calendar 仓库。
> 前端已移植进 **admin 控制台的「Crawler」菜单**(`admin/src/pages/crawler-page.tsx`),
> 本目录不再自带 `web/` 前端。部署见 [`docs/DEPLOY.md`](docs/DEPLOY.md)——线上只跑
> `postgres + rustfs + app`,`app` 暴露在宿主 `127.0.0.1:8001`,由 cloudflared 反代到
> `spider-api.sports-calendar.com`,admin 跨域调用(CORS 限定 admin 源)。
> 下文中涉及独立 `web/` 前端与旧 `:4399` 拓扑的段落为历史说明,以本横幅与 `docs/DEPLOY.md` 为准。

爬取 [transfermarkt.com](https://www.transfermarkt.com/) 的俱乐部、赛程、球员数据到本地的系统。

- **后端**:FastAPI + 进程内 asyncio worker + 全局令牌桶限流(**QPS < 1**,避免被封)
- **抓取**:纯 **httpx 静默抓取**(快、无窗口、无浏览器)。经**住宅代理**(信誉良好的 EU 出口 IP)出网,AWS WAF 不再下发验证码,直接放行;`aws-waf-token` cookie 与 2captcha 仅作休眠兜底
- **数据库**:PostgreSQL(SQLAlchemy async + asyncpg)
- **对象存储**:rustfs(S3 兼容,保存每个页面的原始 HTML 快照)
- **前端**:React + Vite + TypeScript + Tailwind(shadcn 风格组件),无需登录,可列举/过滤联赛杯赛、选赛季触发抓取、看任务进度、浏览已抓数据
- **赛事目录**:不再写死,**从 Transfermarkt 爬取发现**——大洲→国家页爬全部联赛/杯赛,大洲页 "International cups" 框爬国际/国家队赛事(世界杯、欧洲杯、美洲杯、欧国联、各预选赛…),可随时一键重新同步

## ⚠️ 关于反爬(必读)

Transfermarkt 的每个请求都经过 AWS WAF,会对**低信誉来源 IP**(如机房 / 中国云 IP)下发 `x-amzn-waf-action: captcha` 的"Human Verification"页。实测:从机房 IP 直连,即使用 2captcha 解出 token 也**无效**——WAF 把 token 绑定到解题时的来源 IP,换 IP 回放即被重新挑战(httpx、curl_cffi 伪装 TLS 指纹均无效)。

**根治办法 = 走信誉良好的住宅代理(`SCRAPER_PROXY`)。** 经德国住宅 IP 出网后,WAF **完全不再下发验证码**,httpx 直接 200,无需任何打码:

1. **所有 Transfermarkt 流量经 `SCRAPER_PROXY` 出网**(见配置项)。好 IP 下 WAF 不挑战,后台静默抓取,不弹窗、不翻页、不开浏览器。
2. **2captcha 为休眠兜底**:仅当某个请求仍被 WAF 拦时,才把挑战交给 2captcha 无人值守解一次,token 缓存到 `.browser_profile/waf_cookies.json` 复用。挂了好代理后此路径通常永不触发。
3. 若 2captcha 也解不出,请求以 `424 waf_unsolved` 干净失败,不会 500 崩溃。**没有浏览器/人工过码路径。**

> QPS < 1 解决的是"频率封禁";WAF 的人机验证靠**代理 IP 信誉**解决,两者是不同层面的防护。
> 代理建议用**住宅**、**EU 出口**;数据中心代理常仍被挑战。

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
    client.py             httpx 静默 fetcher(经 SCRAPER_PROXY 出网 + 限流 + WAF 拦时 2captcha 兜底)
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
cp .env.example .env
# 生产/机房环境:在 .env 里设 SCRAPER_PROXY=http://user:pass@host:port(住宅 EU 代理)
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
3. 选真实赛季 + 抓取范围 → 点"抓取"。挂好 `SCRAPER_PROXY` 后全程无人值守、自动抓取。同一详情页也能浏览已抓数据。

**浏览已抓数据**:点击列表里的赛事**名称**(不是抓取按钮)进入数据视图,
可看该赛季的俱乐部(再点俱乐部看阵容)和赛程比分。

## 配置项(.env)

| 变量 | 说明 | 默认 |
|------|------|------|
| `SCRAPER_QPS` | 全局每秒请求数,**保持 < 1** | `0.5` |
| `SCRAPER_PROXY` | **过 WAF 的关键**:所有 TM 流量的上游代理(住宅 EU IP);空=直连 | 空 |
| `SCRAPER_BROWSER_PROFILE` | 缓存 `aws-waf-token` 的目录(waf_cookies.json) | `.browser_profile` |
| `CAPTCHA_PROVIDER` | WAF 兜底打码方式(仅 `2captcha`,无浏览器) | `2captcha` |
| `TWOCAPTCHA_API_KEY` | 2captcha 密钥(挂好代理后通常用不到) | 空 |
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
