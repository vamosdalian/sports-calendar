# sports-calendar 线上发布手册

本文面向当前仓库的生产上线，覆盖：

1. 后端 API（Go + PostgreSQL）
2. Web 前端（Next.js）
3. Admin 管理端（Vite）
4. 域名与发布后验收
5. 回滚与常见问题

---

## 1. 推荐生产架构

建议采用以下架构：

1. `sports-calendar.com` -> Web 前端（Cloudflare Workers + OpenNext）
2. `admin.sports-calendar.com` -> Admin 前端（静态站点，Cloudflare Pages 或 Nginx）
3. `api.sports-calendar.com` -> Backend API（自有服务器）
4. PostgreSQL 与 API 同网络，数据库不对公网开放

说明：当前 `web` 为 Next.js App Router + middleware 形态，建议按 Workers 方案部署，而非纯静态导出。

---

## 2. 发布前检查

### 2.1 代码冻结

1. 在主分支创建上线 tag，并发布 GitHub Release，例如 `release-2026-04-10`。
2. 确认本次发布 commit 已通过本地测试。

推荐命令：

```bash
git tag release-2026-04-10
git push origin release-2026-04-10
gh release create release-2026-04-10 --generate-notes
```

说明：发布 Release 后，仓库中的 `.github/workflows/backend-release.yml` 会自动读取 release tag，构建 backend 镜像并推送到 GitHub Container Registry（GHCR）。

### 2.2 本地构建与测试

在仓库根目录执行：

```bash
cd backend && go test ./...
cd ../web && npx tsc --noEmit && npm run build
cd ../admin && npm run build
```

说明：`admin` 当前已修复 TS 配置兼容问题，直接执行 `npm run build` 即可。

### 2.3 发布必要信息清单

上线前准备好以下信息：

1. 域名：`sports-calendar.com`、`api.sports-calendar.com`、`admin.sports-calendar.com`
2. TheSportsDB API Key
3. 后端管理员 JWT Secret（高强度随机字符串）
4. 数据库账号密码
5. Cloudflare 项目访问权限

### 2.4 GitHub Release / GHCR 前置项

首次启用自动发布时，额外确认：

1. 仓库 Actions 允许使用 `GITHUB_TOKEN` 写入 packages。
2. GHCR 中允许创建 `ghcr.io/vamosdalian/sports-calendar-api` 包。
3. 如需匿名拉取，可在 GHCR 页面将该镜像包设为 public。

如为 fork 仓库，请把上述 owner 替换为你自己的 GitHub 用户或组织名。

---

## 3. Backend 发布（自有服务器）

## 3.1 服务器准备

建议环境：

1. Linux（Ubuntu 22.04+）
2. Docker + Docker Compose（推荐）
3. 防火墙仅开放 80/443（如走反向代理）

安装 Docker（示例）：

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

重新登录后生效。

## 3.2 目录准备

```bash
sudo mkdir -p /opt/sports-calendar/{config,database/init}
```

将仓库中的 SQL 初始化文件复制到服务器：

1. `database/init/001_postgres_init.sql`
2. `database/init/002_auth_init.sql`（如果存在并启用）

## 3.3 生产配置文件

在服务器创建 `/opt/sports-calendar/config/config.prod.yaml`：

```yaml
server:
  port: 8080

rateLimit:
  requestsPerSecond: 8
  burst: 16

database:
  host: sports-calendar-postgres
  port: 5432
  dbname: sports_calendar
  user: sports_calendar
  password: CHANGE_ME_DB_PASSWORD
  sslmode: disable

theSportsDB:
  baseURL: https://www.thesportsdb.com
  apiKey: CHANGE_ME_THESPORTSDB_KEY
  timeoutSeconds: 15

adminAuth:
  secret: CHANGE_ME_LONG_RANDOM_SECRET
  tokenTTLMinutes: 30
```

注意：

1. `adminAuth.secret` 必须替换为长度足够的随机值。
2. 不要把生产密钥提交到 Git。

## 3.4 通过 GitHub Release 自动构建后端镜像

后端镜像不再建议手工 `docker build` 后推送。标准流程如下：

1. 在目标 commit 上创建 tag。
2. 发布同名 GitHub Release。
3. GitHub Actions 自动读取 release tag 作为镜像版本号。
4. Actions 执行 `go test ./...`，然后构建并推送镜像到 GHCR。

产物示例：

```text
ghcr.io/vamosdalian/sports-calendar-api:release-2026-04-10
ghcr.io/vamosdalian/sports-calendar-api:latest
```

说明：`latest` 仅在非 prerelease 的正式 Release 上更新；如果发布的是预发布版本，则只推送 tag 对应版本。

如需查看自动发布结果，打开 GitHub `Actions` 页面，确认 `Release Backend Image` 工作流成功完成。

## 3.5 启动数据库与 API

在服务器执行：

```bash
docker network create sports-calendar-net || true

docker volume create sports-calendar-postgres-data

docker run -d \
  --name sports-calendar-postgres \
  --restart unless-stopped \
  --network sports-calendar-net \
  -e POSTGRES_DB=sports_calendar \
  -e POSTGRES_USER=sports_calendar \
  -e POSTGRES_PASSWORD=CHANGE_ME_DB_PASSWORD \
  -v sports-calendar-postgres-data:/var/lib/postgresql/data \
  -v /opt/sports-calendar/database/init:/docker-entrypoint-initdb.d:ro \
  postgres:16

docker run -d \
  --name sports-calendar-api \
  --restart unless-stopped \
  --network sports-calendar-net \
  -p 127.0.0.1:8080:8080 \
  -v /opt/sports-calendar/config/config.prod.yaml:/app/config.yaml:ro \
  ghcr.io/vamosdalian/sports-calendar-api:release-2026-04-10 \
  -config /app/config.yaml
```

## 3.6 反向代理（Nginx 示例）

如你采用传统公网源站方式，可以使用 Nginx 反向代理；如你希望不暴露源站公网端口，建议改用 3.8 的 Cloudflare Tunnel 方案。

将 `api.sports-calendar.com` 反代到本机 `127.0.0.1:8080`：

```nginx
server {
    listen 80;
    server_name api.sports-calendar.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

再配 TLS（可用 Cloudflare Full/Strict + 源站证书）。

## 3.7 后端健康检查

```bash
curl -i https://api.sports-calendar.com/healthz
curl -s https://api.sports-calendar.com/api/leagues?lang=en | jq .
curl -I https://api.sports-calendar.com/ics/football/csl/2026/matches.ics
```

## 3.8 Cloudflare Tunnel（推荐，可替代公网 Nginx 暴露）

适用场景：

1. 不希望在源站开放 80/443。
2. 希望 API 仅监听本机或内网地址。
3. 域名和流量入口已在 Cloudflare。

### 3.8.1 安装 cloudflared

Ubuntu/Debian 示例：

```bash
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
cloudflared --version
```

### 3.8.2 登录并创建 Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create sports-calendar-api
```

执行后会得到一个 Tunnel UUID，并在本机生成凭据文件（json）。

### 3.8.3 编写 cloudflared 配置

创建 `/etc/cloudflared/config.yml`：

```yaml
tunnel: REPLACE_WITH_TUNNEL_UUID
credentials-file: /etc/cloudflared/REPLACE_WITH_TUNNEL_UUID.json

ingress:
  - hostname: api.sports-calendar.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

注意：

1. `service` 指向你的 API 实际监听地址。
2. 如果 API 在 Docker 中对宿主仅映射 `127.0.0.1:8080`，这里保持不变即可。

### 3.8.4 绑定 DNS

```bash
cloudflared tunnel route dns sports-calendar-api api.sports-calendar.com
```

这会在 Cloudflare DNS 中创建对应 CNAME。

### 3.8.5 作为系统服务运行

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

### 3.8.6 验证 Tunnel 发布

```bash
curl -i https://api.sports-calendar.com/healthz
curl -s https://api.sports-calendar.com/api/leagues?lang=en | jq .
```

### 3.8.7 Tunnel 方案实践建议

1. API 源站不再对公网开放 80/443，仅保留必要内网访问。
2. `cloudflared` 进程纳入监控，避免隧道断连无告警。
3. `/ics/*` 路径不要加 Cloudflare Access 登录保护，否则订阅客户端会失败。
4. 建议在 Cloudflare 侧增加 WAF 与速率限制规则。

---

## 4. Web 前端发布（Next.js）

## 4.1 平台建议

`web` 建议部署到 Cloudflare Workers（OpenNext 方案）。

## 4.2 生产环境变量

在前端部署平台配置：

```env
SPORTS_CALENDAR_API_BASE_URL=https://api.sports-calendar.com
SPORTS_CALENDAR_PUBLIC_API_BASE_URL=https://api.sports-calendar.com
```

如果漏配这两个变量，当前 `web` 在生产环境会默认回退到 `https://api.sports-calendar.com`，但仍然建议显式配置，避免环境切换时行为不透明。

## 4.3 构建与部署

按你的部署平台流水线执行 `web` 目录的构建与发布（示例）：

```bash
cd web
npm ci
npm run build
```

完成后绑定自定义域名 `sports-calendar.com`。

## 4.4 前端验收

至少验证：

1. 首页可访问
2. 英文与中文页面可切换
3. 任一赛季页可访问并正常展示月历
4. `Subscribe` 按钮生成的链接指向 `api.sports-calendar.com` ICS

---

## 5. Admin 前端发布（可选但建议）

Admin 是 Vite 静态站点，推荐部署到 Cloudflare Pages 或任意静态托管。

## 5.1 构建

```bash
cd admin
npm ci
npm run build
```

输出目录：`admin/dist`

## 5.2 环境变量

部署时设置：

```env
VITE_API_BASE_URL=https://api.sports-calendar.com
```

## 5.3 域名

建议使用 `admin.sports-calendar.com`，并在后端 CORS/安全策略中仅允许可信域名。

---

## 6. DNS 与证书

在 Cloudflare 中配置：

1. `sports-calendar.com` -> Web 前端项目
2. `admin.sports-calendar.com` -> Admin 项目
3. `api.sports-calendar.com` -> 源站（A/AAAA）或 Tunnel

建议 TLS 模式：

1. 对 API 使用 Full (strict)
2. 源站证书有效

---

## 7. 上线验收清单（建议逐项打勾）

1. `GET /healthz` 返回 200
2. `GET /api/leagues?lang=en` 返回数据
3. 赛季详情接口返回 `groups` 与 `matches`
4. ICS 下载可用，`Content-Type` 为 `text/calendar`
5. Web 首页和赛季页访问正常
6. Web 语言切换正常
7. Admin 可登录并读取基础数据
8. 服务器日志无持续错误

---

## 8. 回滚手册

## 8.1 Backend 回滚

保留上一个可用镜像 tag，回滚时：

```bash
docker rm -f sports-calendar-api

docker run -d \
  --name sports-calendar-api \
  --restart unless-stopped \
  --network sports-calendar-net \
  -p 127.0.0.1:8080:8080 \
  -v /opt/sports-calendar/config/config.prod.yaml:/app/config.yaml:ro \
  ghcr.io/vamosdalian/sports-calendar-api:LAST_GOOD_TAG \
  -config /app/config.yaml
```

## 8.2 Web/Admin 回滚

在 Cloudflare 控制台回滚到上一个稳定部署版本。

---

## 9. 常见问题

## 9.1 Web 构建失败，提示 API 请求异常

现象：前端构建时调用后端失败。

处理：

1. 先确认 `api.sports-calendar.com` 可达
2. 检查部署环境变量是否正确
3. 确认后端已启动且数据库可连接

## 9.2 Admin 构建受 TS deprecations 影响

当前状态：已修复，不需要额外忽略参数。

验证命令：

```bash
cd admin
npm run build
```

## 9.3 Tooltip/前端样式看起来没更新

处理：

1. 清理 CDN 缓存
2. 浏览器强制刷新
3. 确认部署版本号与 commit 一致

---

## 10. 建议的发布节奏

1. 每次发布使用独立 tag，并发布对应 GitHub Release
2. 先发 Backend，再发 Web/Admin
3. 发布后 10~30 分钟内重点观察：
   - 5xx 比例
   - API 延迟
   - 首页与赛季页可访问性
4. 出现异常优先回滚，再排查
