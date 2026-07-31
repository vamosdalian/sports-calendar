# web 目录部署到 Cloudflare Workers

本文只覆盖 `web/` 目录的部署。

目标：

1. 用 Cloudflare Workers 托管当前 Next.js 应用。
2. 用 OpenNext 适配 App Router、middleware 和 ISR。
3. 保持后端 API 继续部署在你自己的服务器上。

## 为什么用 Workers 而不是 Pages

当前 `web/` 不是纯静态 Next 站点，原因包括：

1. 使用了 `next-intl` 的请求前路由处理，入口在 `web/middleware.ts`。
2. 页面在运行时会请求后端 API，入口在 `web/lib/catalog.ts`。
3. 页面使用 `revalidate = 3600`，属于 ISR/再验证模式，不是一次导出后完全不变的静态站点。

因此，推荐部署方式是：

1. `web/` -> Cloudflare Workers
2. `api.sports-calendar.com` -> 你自己的后端服务器

## 仓库内新增的配置

当前已为 `web/` 加入：

1. `@opennextjs/cloudflare`
2. `wrangler`
3. `web/open-next.config.ts`
4. `web/wrangler.jsonc`
5. `web/.dev.vars.example`
6. `web/public/_headers`

同时：

1. `web/proxy.ts` 已切换为 `web/middleware.ts`
2. `package.json` 新增了 `preview`、`deploy` 和 `cf-typegen` 脚本
3. OpenNext 已配置为 `R2 incremental cache + DO queue`

这样做的原因是：当前 OpenNext/Cloudflare 不支持 Next 16 的 Node runtime proxy，但支持 Edge middleware。

## 当前缓存方案

当前 `web/` 已不再使用 OpenNext 默认的 dummy incremental cache，而是切换为：

1. `R2` 持久化 Next 的 ISR / fetch cache
2. `Durable Object queue` 协调 time-based revalidation
3. `regional cache` 减少热点区域重复回源到 R2
4. `enableCacheInterception` 让已缓存的 ISR/SSG 页面尽量绕过完整 Next 启动链路

此外：

1. `/_next/static/*` 通过 `web/public/_headers` 显式设置为 `Cache-Control: public,max-age=31536000,immutable`
2. 页面和数据本身仍由应用代码中的 `revalidate = 3600` 与 `fetch(..., { next: { revalidate: 3600 } })` 控制再验证周期

## 环境变量

至少配置以下两个变量：

```env
SPORTS_CALENDAR_API_BASE_URL=https://api.sports-calendar.com
SPORTS_CALENDAR_PUBLIC_API_BASE_URL=https://api.sports-calendar.com
```

说明：

1. `SPORTS_CALENDAR_API_BASE_URL` 用于服务端取数。
2. `SPORTS_CALENDAR_PUBLIC_API_BASE_URL` 用于生成用户订阅用的 ICS 地址。
3. 当前代码在生产环境下即使没有显式配置这两个变量，也会默认回退到 `https://api.sports-calendar.com`，避免 Worker 误打到 `localhost:8080`。

本地预览时，可在 `web/` 下创建 `.dev.vars`，内容可参考 `web/.dev.vars.example`。

如果你想自定义 R2 中的缓存前缀，也可以加：

```env
NEXT_INC_CACHE_R2_PREFIX=incremental-cache
```

### Umami 埋点变量（构建时生效）

```env
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://<umami-host>/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=<website-uuid>
```

两个都留空时不会渲染埋点脚本，站点行为与接入前完全一致。

⚠️ 与上面几个变量不同，`NEXT_PUBLIC_*` 由 Next.js 在**构建时内联进产物**，不是运行时读取。
只在 Cloudflare 控制台配置 Worker 环境变量**不会生效**——必须让它们出现在执行
`npm run deploy` 的那个环境里（`web/.env.local`、CI secrets 或 shell 变量均可），
否则部署出去的站点会静默地没有埋点。

验证方式：部署后打开线上页面查看源码，应能看到 `<script src=".../script.js" data-website-id="...">`。

## 首次准备 Cloudflare 资源

在首次部署前，先创建 OpenNext 使用的 R2 bucket：

```bash
cd /Users/lmc10232/project/sports-calendar/web
npx wrangler r2 bucket create sports-calendar-web-cache
```

当前 `wrangler.jsonc` 已配置以下绑定：

1. `NEXT_INC_CACHE_R2_BUCKET`
2. `NEXT_CACHE_DO_QUEUE`
3. `WORKER_SELF_REFERENCE`

其中 `DOQueueHandler` 会在首次部署时按 `migrations` 自动创建。

## 本地验证

进入 `web/` 目录：

```bash
cd /Users/lmc10232/project/sports-calendar/web
```

安装依赖：

```bash
npm ci
```

先验证 Next 本身构建：

```bash
npm run build
```

再验证 Cloudflare/OpenNext 构建：

```bash
npx opennextjs-cloudflare build
```

如果要本地预览 Worker 行为：

```bash
npm run preview
```

## 首次登录 Cloudflare

```bash
cd /Users/lmc10232/project/sports-calendar/web
npx wrangler login
```

登录成功后，Wrangler 会在本机保存凭据。

## 直接从本地部署

```bash
cd /Users/lmc10232/project/sports-calendar/web
npm run deploy
```

该命令会执行：

1. `opennextjs-cloudflare build`
2. `opennextjs-cloudflare deploy`

部署成功后，你会拿到一个 `*.workers.dev` 域名。

## 绑定正式域名

部署成功后，在 Cloudflare 控制台把下面域名绑定到这个 Worker：

1. `sports-calendar.com`
2. `www.sports-calendar.com`

如果只保留一个主域名，建议把另一个做 301 跳转。

## 线上部署走 GitHub Actions（唯一路径）

生产部署由 [`.github/workflows/web-rebuild.yml`](../.github/workflows/web-rebuild.yml)
负责，三个触发点：

1. `push` 到 `master`——代码改动合并即上线；
2. 每天 `23 2 * * *`（UTC）——站点是静态导出，赛程和队名在构建时固化，
   补译名、改期这类**只动数据库、不产生 commit** 的变更靠这趟车上线；
3. `workflow_dispatch`——等不及每天那趟车时手动打一炮：
   `gh workflow run web-rebuild.yml`。

时间点不能随便挪：后端各联赛 `sync_interval` 是 `@daily`、容器时区为 UTC
（即 00:00 UTC 同步），公开 API 又压着 30 分钟边缘缓存，早于 02:23 构建会把
前一天的数据烤进 HTML。

**Cloudflare 自带的 Git 集成（Workers Builds）已刻意关闭，不要重新打开。**
它的 build / deploy 命令存在 Dashboard 里、仓库看不见也改不了，`web/package.json`
改个 script 名就会让部署静默失败——而失败的构建不产生 deployment，所以
「没上线」和「没触发」长得一模一样，只能靠人翻控制台日志发现。这个坑踩过两次。

Actions 需要仓库 secrets `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。
注意本文开头提到的 `NEXT_PUBLIC_*` 变量走的是 `web/.env.production`（随仓库提交，
构建时内联），**不是** Dashboard 里的 Worker 环境变量。

## 部署时的一个关键点

当前 `generateStaticParams()` 会在构建时请求后端 API 来生成已知联赛/赛季列表。

这意味着：

1. 构建时 `api.sports-calendar.com` 最好已经可用。
2. 如果构建时 API 不可用，当前代码会回退为空路由列表，构建仍可能成功。
3. 空路由列表不会阻止运行时按需生成页面，但会影响预生成范围和 sitemap 首次内容。

## 发布后你可以验证什么

至少检查以下内容：

1. 访问 `/` 是否会正常跳到语言前缀页面。
2. 访问 `/en/` 和 `/zh/` 是否正常。
3. 打开任意赛季页是否能正常取到 API 数据。
4. `/sitemap.xml` 是否包含赛季路径。
5. 订阅按钮生成的 `webcal://` 链接是否指向你的正式 API 域名。
6. 同一路径连续访问两次时，TTFB 是否明显下降。
7. 关键响应头里是否能看到 Cloudflare 缓存命中迹象，例如 `cf-cache-status`。

## 如何确认缓存真的生效

上线后可以直接用 `curl -I` 验证：

```bash
curl -I https://sports-calendar.com/en/
curl -I https://sports-calendar.com/en/soccer/fifa-world-cup/2026/
curl -I https://sports-calendar.com/_next/static/<build-id>/_buildManifest.js
```

重点看这几项：

1. HTML/ISR 页面：
   第一次通常是 `MISS` 或 `DYNAMIC`，再次请求应更接近 `HIT` / 更低 TTFB
2. `/_next/static/*`：
   应返回长缓存头 `Cache-Control: public,max-age=31536000,immutable`
3. 如果你在 Worker 日志里仍看到每次请求都重新拉后端 API，说明 ISR/data cache 仍未命中，需要继续排查 R2 绑定或 revalidate 行为

## 常用命令

```bash
cd /Users/lmc10232/project/sports-calendar/web
npm run build
npm run build:worker
npm run preview
npm run deploy
npm run cf-typegen
```

## 当前结论

当前 `web/` 已改为适合 Cloudflare Workers 的结构。

如果后端 API 已经对外可访问，你现在可以按下面顺序上线：

1. 在 `web/` 下准备 `.dev.vars` 或在 Cloudflare 里配置环境变量
2. 执行 `npm run preview` 做本地检查
3. 执行 `npm run deploy`
4. 绑定 `sports-calendar.com`
