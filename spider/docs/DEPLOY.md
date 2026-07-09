# 部署（线上 / 容器化）

爬虫后端镜像化部署,**不用 docker-compose**:和后端一样每个容器独立 `docker run`,都挂在共享网络 `sports-calendar-net` 上,靠容器名互相解析。`app`(FastAPI + 抓取 worker)是唯一会更新的容器;`tm_rustfs`(原始 HTML 快照)与主库 `sports-calendar-postgres` 启动后不再变更。**数据库复用主库**里的 `transfermarkt` 库,本栈不自带 Postgres。前端已并入 **admin** 控制台(菜单「Crawler」),由 admin 经 Go 后端鉴权 proxy 跨栈调用。

```
admin(CF Worker) ──HTTPS──> api.sports-calendar.com/api/spider/*  (Go 后端鉴权)
                              └─ ReverseProxy ──> app:8000(宿主 127.0.0.1:8001)
                                   ├─ 抓取 worker ──SCRAPER_PROXY(德国住宅 IP)──> Transfermarkt
                                   ├─ 数据 ──> sports-calendar-postgres / transfermarkt
                                   └─ 原始 HTML ──> rustfs
```

## 前置

- 一台装了 Docker + Docker Compose 的 Linux 主机(这里复用 `ssh sports-calendar` = root@39.102.211.97)
- 已运行的 `sports-calendar-postgres`(主库,在 `sports-calendar-net` 上)
- 一个**住宅代理**(EU 出口,过 AWS WAF 的关键;见 `../README.md` 反爬一节)
- 共享 docker 网络 `sports-calendar-net`(external)

## 发布流程(打 tag → GitHub Action → 服务器脚本更新)

与后端一致,但 **spider 用带 `-sp` 后缀的独立 tag**,以只触发 spider 构建:

1. **发 Release** `vX.Y.Z-sp`(如 `v1.0.0-sp`)。`spider-release.yml` 只在 `-sp` 结尾时构建,`backend-release.yml` 则跳过 `-sp` —— 两条版本线互不干扰。
2. Action 构建并推送 `ghcr.io/vamosdalian/sports-spider:vX.Y.Z-sp`(+ `latest`)。首次推送后需把该 GHCR package 设为 **public**(服务器无 GHCR 登录,靠公开镜像拉取)。
3. 服务器更新:

   ```bash
   ssh sports-calendar '/root/script/update-sports-spider.sh v1.0.0-sp'
   ```

   脚本先拉镜像成功才动容器,把 `SPIDER_TAG` 写入 `.env`,只重建 `app`(rustfs 不动)。

## 首次 / 手动部署

1. `/opt/sports-spider/.env` 里确认(**没有 docker-compose.yml 了**):

   | 变量 | 线上取值 | 说明 |
   |------|---------|------|
   | `DATABASE_URL` | `postgresql+asyncpg://sports_calendar:<pass>@sports-calendar-postgres:5432/transfermarkt` | 复用主库,密码 URL 编码 |
   | `SCRAPER_PROXY` | `http://user:pass@host:port` | 住宅 EU 代理,过 WAF 的关键 |
   | `SCRAPER_QPS` | `0.5`(保持 < 1) | 限流,避免被封 |
   | `TWOCAPTCHA_API_KEY` | 你的 key(可选) | 挂好代理后通常用不到,留作兜底 |
   | `CORS_ORIGINS` | admin 线上源 | 经 Go 后端 proxy 调用时一般不需要,保留即可 |

   > `S3_ENDPOINT_URL=http://tm_rustfs:9000` / `CAPTCHA_PROVIDER=2captcha` 由 `docker run` 的 `-e` 覆盖,无需写进 `.env`。`DATABASE_URL` / `SCRAPER_PROXY` / 密钥只在 `.env`(不入库)。

2. 一次性起 rustfs(之后不再动):

   ```bash
   /root/script/start-rustfs.sh
   ```

3. 部署 / 更新 app(拉 GHCR 镜像并重建容器):

   ```bash
   /root/script/update-sports-spider.sh v1.0.0-sp
   ```

4. 验证:

   ```bash
   curl -fsS http://127.0.0.1:8001/api/health          # {"status":"ok",...}
   curl -fsS http://127.0.0.1:8001/api/tree/countries  # 200 + 国家列表
   docker logs tm_app | grep proxy                      # scraper routing through proxy ***
   ```

## 架构要点

- **无 compose**:三个容器(`sports-calendar-postgres`、`tm_rustfs`、`tm_app`)都独立 `docker run`,同在 `sports-calendar-net`,用容器名互相解析(app→`tm_rustfs`、admin Go 后端→`tm_app:8000`)。更新 app 不影响另两个。
- **端口 / 暴露面**:`tm_rustfs` 无宿主端口。唯一对宿主开放的是 `app` 的 `127.0.0.1:8001`(仅本机,公网扫不到),由 admin 经 Go 后端的鉴权 `/api/spider` proxy 访问。**爬虫不直接对公网开放。**
- **数据库**:复用 `sports-calendar-postgres` 里的独立库 `transfermarkt`,凭证同 `sports_calendar`。
- **无人值守过 WAF**:主要靠 `SCRAPER_PROXY`(住宅好 IP,WAF 不挑战);2captcha 仅休眠兜底,无浏览器/人工路径。
- **持久化**:`aws-waf-token` 在命名卷 `sports-spider_browser_profile`;原始 HTML 快照在 `sports-spider_rustfs_data`;结构化数据在主库(随主库备份)。

## 运维

```bash
docker logs -f tm_app                          # 看抓取 / 代理日志
docker ps                                      # 健康状态
docker restart tm_app                          # 重启后端(token 仍在卷里)
/root/script/update-sports-spider.sh <tag>     # 升级到指定镜像 tag(只重建 app)
```
