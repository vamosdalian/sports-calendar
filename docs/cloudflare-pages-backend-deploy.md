# Cloudflare Workers 前端部署与自建后端联通说明

本文面向当前仓库，目标是说明：

1. 前端如何放到 Cloudflare Workers。
2. 后端如何放到你自己的服务器。
3. 域名已经托管在 Cloudflare 的情况下，前后端如何连接。
4. 后端是否适合接入 Cloudflare Tunnel。

## 先说结论

当前 `web/` 应按 Cloudflare Workers 的 Next.js 方案部署，不应按 Cloudflare Pages 静态站点部署。

原因有三点：

1. 它使用了 Next.js App Router 的运行时能力。
2. 它使用了 `next-intl` 中间件，文件在 `web/proxy.ts`。
3. 它在构建期和运行期都会请求后端 API，关键逻辑在 `web/lib/catalog.ts`。

Cloudflare 官方文档目前明确区分了两种路径：

1. 纯静态 Next.js 站点可以部署到 Cloudflare Pages。
2. 完整的 SSR / ISR / Middleware 型 Next.js 应用应部署到 Cloudflare Workers，并使用 OpenNext 适配器。

所以对于这个仓库：

1. 正确方案：前端部署到 Cloudflare Workers。
2. 仅在你愿意先改造前端为纯静态导出时，才使用 Cloudflare Pages。

如果你的目标只是“前端放在 Cloudflare，后端放自有服务器，域名在 Cloudflare 上统一管理”，那么推荐架构如下：

1. `sports-calendar.com` 和 `www.sports-calendar.com` 指向 Cloudflare 的前端项目。
2. `api.sports-calendar.com` 指向你自己的后端服务器。
3. 前端通过环境变量访问 `https://api.sports-calendar.com`。

## 当前仓库里和部署直接相关的地方

### 前端 API 地址

前端依赖两个环境变量：

```env
SPORTS_CALENDAR_API_BASE_URL=https://api.sports-calendar.com
SPORTS_CALENDAR_PUBLIC_API_BASE_URL=https://api.sports-calendar.com
```

说明：

1. `SPORTS_CALENDAR_API_BASE_URL` 用于服务端取数。
2. `SPORTS_CALENDAR_PUBLIC_API_BASE_URL` 用于生成用户点击订阅时的 ICS 链接。
3. 如果第二个变量不配，代码会回退到第一个变量。

### 前端构建依赖后端

当前 season 页面会在 `generateStaticParams()` 中请求后端：

1. 先请求 `/api/leagues?lang=en`。
2. 再请求每个联赛的 seasons 接口。

这意味着：

1. 前端构建时，后端 API 最好已经可以从公网访问。
2. 如果构建时后端不可用，当前代码会回退成空路由列表，构建可能成功，但 season 页面不会被预生成。

### 当前仓库为什么不能直接走 Pages 静态托管

当前前端要直接部署到 Cloudflare Pages，会遇到下面这些问题：

1. `web/proxy.ts` 使用了中间件，静态导出不支持这一类能力。
2. 当前 `web/next.config.ts` 没有配置 `output: "export"`。
3. 当前首页和路由中包含运行时 `redirect()`。
4. 当前页面依赖 ISR / revalidate 语义，纯静态 Pages 无法原样承接。

所以，当前代码不要直接按 Cloudflare Pages 的“静态站点”方式上线。

## 推荐方案：前端部署到 Cloudflare Workers，后端部署到你自己的服务器

虽然你提到的是 Cloudflare Pages，但基于这个仓库的现状，真正可落地的生产方案是：

1. 前端使用 Cloudflare 的 Next.js 运行时方案，也就是 Workers + OpenNext。
2. 后端继续部署在你自己的服务器上。
3. DNS 和证书统一由 Cloudflare 管理。

这套方案和你的目标一致，只是前端承载平台从 Pages 改为 Workers。

### 架构图

```text
Browser
  |
  | HTTPS
  v
sports-calendar.com
  |
  v
Cloudflare Workers (Next.js frontend)
  |
  | HTTPS
  v
api.sports-calendar.com
  |
  v
Your server (Go API + PostgreSQL)
```

## 后端部署步骤

下面给出一套稳妥的做法，优先保证可上线和可维护。

### 1. 准备服务器

建议服务器最少准备：

1. Linux 主机。
2. 一个公网 IPv4，或者使用 Cloudflare Tunnel。
3. Docker 和 Docker Compose，或者直接安装 Go 与 PostgreSQL。
4. Nginx 或 Caddy 作为反向代理。

如果你准备用 Cloudflare Tunnel，则公网 IP 不是必须项，Nginx 也不是必须项。

### 2. 准备 PostgreSQL

数据库至少需要初始化 `database/init/001_postgres_init.sql`。

如果你用容器方式，可以先把 PostgreSQL 起起来，再导入初始化 SQL。

示例思路：

```bash
docker run -d \
  --name sports-calendar-postgres \
  -e POSTGRES_DB=sports_calendar \
  -e POSTGRES_USER=sports_calendar \
  -e POSTGRES_PASSWORD=change-me \
  -p 5432:5432 \
  postgres:16

docker exec -i sports-calendar-postgres psql \
  -U sports_calendar \
  -d sports_calendar \
  < database/init/001_postgres_init.sql
```

### 3. 准备后端配置文件

你需要在服务器上放一个生产配置，例如：

```yaml
server:
  port: 8080

rateLimit:
  requestsPerSecond: 8
  burst: 16

database:
  host: 127.0.0.1
  port: 5432
  dbname: sports_calendar
  user: sports_calendar
  password: change-me
  sslmode: disable

theSportsDB:
  baseURL: https://www.thesportsdb.com
  apiKey: 125954
  timeoutSeconds: 15
```

建议保存到类似路径：

```text
/opt/sports-calendar/config.yaml
```

### 4. 启动后端

当前仓库现在已经可以直接构建 Docker 镜像，并且镜像不会再把配置文件打进镜像层。生产上更推荐用容器方式运行 API，再通过只读挂载把配置文件传进去。

如果你已经把镜像推到了自己的镜像仓库，可以直接运行：

```bash
docker network create sports-calendar-net

docker volume create sports-calendar-postgres-data

docker run -d \
  --name sports-calendar-postgres \
  --restart unless-stopped \
  --network sports-calendar-net \
  -e POSTGRES_DB=sports_calendar \
  -e POSTGRES_USER=sports_calendar \
  -e POSTGRES_PASSWORD=change-me \
  -v sports-calendar-postgres-data:/var/lib/postgresql/data \
  -v /opt/sports-calendar/database/init:/docker-entrypoint-initdb.d:ro \
  postgres:16

docker run -d \
  --name sports-calendar-api \
  --restart unless-stopped \
  --network sports-calendar-net \
  -p 127.0.0.1:8080:8080 \
  -v /opt/sports-calendar/config.yaml:/app/config.yaml:ro \
  docker.mengfanyu.com/sports-calendar-api:latest \
  -config /app/config.yaml
```

这里有几个关键点：

1. API 只绑定在宿主机 `127.0.0.1:8080`。
2. PostgreSQL 不暴露公网端口。
3. API 通过 Docker 网络里的 `sports-calendar-postgres:5432` 访问数据库。
4. PostgreSQL 初始化 SQL 会在空数据目录首次启动时自动执行。

所以如果你走容器方案，配置文件里的数据库地址应该写成：

```yaml
database:
  host: sports-calendar-postgres
  port: 5432
```

如果你不想用 Docker，也可以继续直接编译二进制后运行：

```bash
cd /opt
git clone <your-repo-url> sports-calendar
cd sports-calendar/backend

go mod download
go build -o /usr/local/bin/sports-calendar-api ./cmd/api

/usr/local/bin/sports-calendar-api -config /opt/sports-calendar/config.yaml
```

建议最终用 `systemd` 托管，而不是手工前台运行。

示例 `systemd` 服务文件：

```ini
[Unit]
Description=Sports Calendar API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/sports-calendar/backend
ExecStart=/usr/local/bin/sports-calendar-api -config /opt/sports-calendar/config.yaml
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
```

启用方式：

```bash
sudo systemctl daemon-reload
sudo systemctl enable sports-calendar-api
sudo systemctl start sports-calendar-api
sudo systemctl status sports-calendar-api
```

### 5. 用 Nginx 反向代理到 `api.sports-calendar.com`

如果后端程序监听在 `127.0.0.1:8080`，Nginx 可以这样配：

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

之后再给这个域名签 HTTPS 证书。

这一节适用于你走传统公网服务器暴露方式。

如果你改用 Cloudflare Tunnel，这一节可以跳过，直接看下面的 Tunnel 章节。

### 6. 验证后端

至少验证下面几个地址：

```bash
curl -i https://api.sports-calendar.com/healthz
curl -s https://api.sports-calendar.com/api/leagues?lang=en
curl -I https://api.sports-calendar.com/ics/football/csl/2026/matches.ics
```

## Cloudflare DNS 配置

假设你的域名已经托管在 Cloudflare。

### 1. 前端域名

如果前端部署到 Cloudflare 自家的项目：

1. `sports-calendar.com` 绑定到前端项目。
2. `www.sports-calendar.com` 也绑定到前端项目，或者 301 重定向到主域。

这一步在 Cloudflare 控制台里给前端项目添加 Custom Domain 即可。

### 2. 后端域名

如果你走传统公网暴露方式，给你的后端服务器添加 DNS 记录：

1. 记录类型：`A`
2. 名称：`api`
3. 内容：你的服务器公网 IP
4. Proxy status：建议先开 `Proxied`

效果就是：

```text
api.sports-calendar.com -> your server public IP
```

### 3. SSL/TLS 建议

如果你让 Cloudflare 代理 `api.sports-calendar.com`，建议：

1. Cloudflare 的 SSL/TLS 模式设为 `Full (strict)`。
2. 源站安装 Let's Encrypt 证书，或者使用 Cloudflare Origin Certificate。

不要长期使用 `Flexible`。

## 可以用 Cloudflare Tunnel 吗

可以，而且对于“后端在你自己的服务器上”这个场景，Cloudflare Tunnel 是合理方案。

但要明确：

1. Tunnel 适合后端 `api.sports-calendar.com`。
2. Tunnel 不适合替代前端 Workers。
3. Tunnel 也不是数据库对外暴露方案，PostgreSQL 不应该直接公开到公网。

### 什么时候适合用 Tunnel

下面这些情况，Tunnel 很适合：

1. 你的后端机器在家宽、内网、NAT、动态 IP 或不方便开入站端口的环境里。
2. 你不想暴露源站真实 IP。
3. 你希望源站只保留出站连接，由 `cloudflared` 主动连到 Cloudflare。

### 什么时候不一定要用 Tunnel

下面这些情况，传统反向代理通常更简单：

1. 你本来就是标准云服务器，有固定公网 IP。
2. 你已经有成熟的 Nginx / Caddy / 证书续期流程。
3. 你希望排障链路尽量短。

### Tunnel 架构

如果你给后端接 Tunnel，链路会变成：

```text
Browser
  |
  | HTTPS
  v
sports-calendar.com
  |
  v
Cloudflare Workers (Next.js frontend)
  |
  | HTTPS
  v
api.sports-calendar.com
  |
  v
Cloudflare Tunnel
  |
  v
cloudflared on your server
  |
  v
http://127.0.0.1:8080
```

也就是说：

1. 前端仍然是 Workers。
2. 后端程序仍然运行在你自己的服务器。
3. 只是 `api.sports-calendar.com` 不再直接指向服务器公网 IP，而是通过 Tunnel 进入你本机的 `127.0.0.1:8080`。

### Tunnel 的优点

1. 不需要给源站开 80/443 入站端口。
2. 不需要暴露服务器公网 IP。
3. 适合家庭网络、小型 VPS、受限网络环境。
4. Cloudflare 侧仍然可以继续挂 WAF、缓存、规则和访问控制。

### Tunnel 的注意点

1. 你的服务器需要稳定运行 `cloudflared`。
2. 服务器必须能出站访问 Cloudflare，官方文档提到要确保可以访问 `7844` 端口相关连接。
3. Tunnel 挂了以后，DNS 记录不会自动删除，外部会直接报错。
4. 公开 API 仍然建议加速率限制，你现在后端代码里已经有全局限流。
5. 如果前端构建时需要访问 API，那么 Tunnel 对应的 `api.sports-calendar.com` 在构建期间也必须已经可用。

### Tunnel 部署步骤

#### 1. 安装并登录 `cloudflared`

在后端服务器上安装 `cloudflared`，然后登录 Cloudflare 账户。

如果你用的是阿里云这类标准 Linux 服务器，最简单的生产方式通常是使用 Cloudflare Zero Trust 面板生成的 tunnel token，然后把 `cloudflared` 作为系统服务跑起来。

#### 2. 在 Cloudflare Zero Trust 里创建 Tunnel

官方当前推荐流程是：

1. 进入 Cloudflare One。
2. 打开 `Networks` -> `Connectors` -> `Cloudflare Tunnels`。
3. 创建一个 tunnel。
4. 选择 `Cloudflared` 作为 connector。
5. 按面板提供的命令把 tunnel 连接到你的服务器。

最小可用流程通常如下：

```bash
mkdir -p /etc/cloudflared

cloudflared service install <YOUR_TUNNEL_TOKEN>

systemctl enable cloudflared
systemctl start cloudflared
systemctl status cloudflared
```

这种方式的优点是：

1. 不需要自己手写复杂的 tunnel 凭据文件。
2. 服务器重启后 `cloudflared` 会自动拉起。
3. 适合只有一个公开 API hostname 的场景。

#### 3. 给 Tunnel 绑定公开 hostname

为你的 tunnel 增加一个 Published application：

1. Subdomain: `api`
2. Domain: `sports-calendar.com`
3. Service type: `HTTP`
4. URL: `http://localhost:8080`

这样，外网访问 `https://api.sports-calendar.com` 时，请求会通过 tunnel 转发到你本机的 Go 服务。

结合上面的 API 容器启动命令，`localhost:8080` 实际上对应宿主机的 `127.0.0.1:8080`，也就是：

```text
cloudflared -> host 127.0.0.1:8080 -> sports-calendar-api container
```

#### 4. 使用 Tunnel DNS 记录

Tunnel 的 DNS 不是普通 `A` 记录。

Cloudflare 会把 `api.sports-calendar.com` 指向一个类似下面的目标：

```text
<UUID>.cfargotunnel.com
```

从 DNS 视角看，它本质上是一个 `CNAME` 到 tunnel 地址，而不是你服务器的公网 IP。

#### 5. 让后端只监听本机

如果你走 Tunnel，后端服务可以只绑定在本机，例如由本地代理或服务进程监听 `127.0.0.1:8080`。这样可以避免 API 被绕过 Cloudflare 直接访问。

最常见的验证命令是：

```bash
curl -i http://127.0.0.1:8080/healthz
curl -s http://127.0.0.1:8080/api/leagues?lang=en
systemctl status cloudflared
journalctl -u cloudflared -n 100 --no-pager
```

如果上面两个本地 `curl` 能通，而外网 `https://api.sports-calendar.com` 不通，问题通常就在 tunnel 或 Cloudflare hostname 绑定，而不是 API 本身。

### Tunnel 场景下的前端配置

前端侧不需要特殊改代码，仍然配置：

```env
SPORTS_CALENDAR_API_BASE_URL=https://api.sports-calendar.com
SPORTS_CALENDAR_PUBLIC_API_BASE_URL=https://api.sports-calendar.com
```

对前端来说，它不关心后端是：

1. 直接公网 IP + Nginx。
2. 还是 Cloudflare Tunnel。

只要 `https://api.sports-calendar.com` 可用就行。

### 我的建议

如果你的后端机器不是标准公网生产机，我建议直接用 Tunnel。

如果你的后端已经是常规云服务器，并且你熟悉 Nginx、证书和防火墙，传统方式会更直接，排障也更简单。

## 前端部署到 Cloudflare 的推荐做法

这一节给的是当前仓库真正推荐的上线方案。

### 1. 在 `web/` 里补 Cloudflare Next.js 部署依赖

Cloudflare 官方当前推荐 Next.js 通过 OpenNext 部署到 Workers。

通常你需要增加：

```bash
cd web
npm install @opennextjs/cloudflare@latest
npm install -D wrangler@latest
```

然后补 `open-next.config.ts` 和 `wrangler.jsonc`，再增加 `preview` 与 `deploy` 脚本。

因为本文主要说明部署思路，不在这里直接改仓库文件。

### 2. 在 Cloudflare 项目中配置环境变量

至少配置：

```env
SPORTS_CALENDAR_API_BASE_URL=https://api.sports-calendar.com
SPORTS_CALENDAR_PUBLIC_API_BASE_URL=https://api.sports-calendar.com
```

原因：

1. 前端页面服务端取数需要后端地址。
2. 订阅按钮拼接 `webcal://` 链接时也需要公开后端地址。

### 3. 配置构建与部署

如果使用 Cloudflare 的自动识别能力，通常直接在 `web/` 目录执行 `wrangler deploy` 即可。

如果你走 CI：

1. Root directory 设为 `web`。
2. 安装依赖后执行构建。
3. 部署命令使用 OpenNext / Wrangler 对应命令。

### 4. 绑定域名

将下面两个域名绑定到前端项目：

1. `sports-calendar.com`
2. `www.sports-calendar.com`

然后把站点主域统一到一个地址，例如统一跳到 `https://sports-calendar.com`。

## 如果你坚持只用 Cloudflare Pages

只有在你先把前端改造成纯静态导出后，这条路才成立。

你至少要做下面这些改造：

1. 删除或替换 `web/proxy.ts` 中的中间件。
2. 移除依赖运行时的 `redirect()` 行为，改成静态可处理的方式。
3. 在 `web/next.config.ts` 中改成静态导出模式，例如 `output: "export"`。
4. 确保所有页面在构建阶段都能拿到完整数据。
5. 确保 season 列表和语言路由在构建时都能确定。

改造完成后，Cloudflare Pages 的典型配置会是：

1. Framework preset：`Next.js (static export)` 或 `None`。
2. Root directory：`web`
3. Build command：`npm install && npm run build`
4. Build output directory：`out`

同时仍然要配置这两个环境变量：

```env
SPORTS_CALENDAR_API_BASE_URL=https://api.sports-calendar.com
SPORTS_CALENDAR_PUBLIC_API_BASE_URL=https://api.sports-calendar.com
```

但请注意，按当前仓库代码，直接这样配并不能保证成功上线。

## 前后端联调与上线检查清单

正式切流前，至少检查下面这些项：

1. `https://api.sports-calendar.com/healthz` 返回 `200`。
2. `https://api.sports-calendar.com/api/leagues?lang=en` 返回联赛目录。
3. `https://api.sports-calendar.com/ics/football/csl/2026/matches.ics` 能返回 `text/calendar`。
4. 前端首页能正常打开，并跳转到默认语言页。
5. 至少一个 season 页面能正常打开。
6. 页面中的订阅按钮跳转到 `webcal://api.sports-calendar.com/...`。
7. Cloudflare 上前端域名和后端域名证书都已经生效。

## 常见问题

### 1. 前端部署成功，但 season 页面是 404

通常说明前端构建时没有从后端取到完整路由。

优先检查：

1. 构建时环境变量是否已经配置。
2. 构建机器能不能访问 `https://api.sports-calendar.com`。
3. 后端是否已先于前端上线。

### 2. 订阅按钮打不开

优先检查：

1. `SPORTS_CALENDAR_PUBLIC_API_BASE_URL` 是否配成了公网地址。
2. 后端 `/ics/.../matches.ics` 是否能被公网访问。
3. 返回头里的 `Content-Type` 是否还是 `text/calendar`。

### 3. 后端在 Cloudflare 代理后访问异常

优先检查：

1. Cloudflare SSL/TLS 模式是否为 `Full (strict)`。
2. 源站证书是否有效。
3. Nginx 是否正确转发了 `Host` 和 `X-Forwarded-Proto`。

## 官方文档参考

建议以上线时的 Cloudflare 文档为准，重点看这几页：

1. Cloudflare Pages 的 Next.js 页面：<https://developers.cloudflare.com/pages/framework-guides/nextjs/>
2. Cloudflare Workers 的 Next.js 页面：<https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>
3. Cloudflare Pages 自定义域名：<https://developers.cloudflare.com/pages/configuration/custom-domains/>
4. Cloudflare DNS 子域名记录：<https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-subdomain/>
5. Cloudflare Tunnel 概览：<https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/>
6. Cloudflare Tunnel 创建流程：<https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/>
7. Cloudflare Tunnel DNS 路由：<https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/routing-to-tunnel/dns/>

## 最终建议

对于当前仓库，最实用的上线方案是：

1. 前端不要直接上 Cloudflare Pages 静态托管。
2. 前端上 Cloudflare Workers。
3. 后端上你自己的服务器，域名使用 `api.sports-calendar.com`。
4. Cloudflare 只负责前端接入、证书、DNS 和边缘代理。

如果后面你确定一定要“纯 Pages”，那就先做一轮前端静态化改造，再按 Pages 静态项目的方式发布。
