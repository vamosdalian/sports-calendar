# web 目录部署到 Cloudflare

本文只覆盖 `web/` 目录的部署。后端 API 仍部署在自有服务器上，经
`api.sports-calendar.com` 对外。

## 当前架构：静态导出 + assets-only Worker

`web/` 是 Next 的 `output: "export"` 静态导出：每个路由在构建时写成真实的 HTML
文件，由 Cloudflare 直接从资产存储返回，**请求不进 Worker**。
`web/wrangler.jsonc` 里没有 `main` 字段，就是这个意思——没有脚本可启动。

这不是风格选择，是修一个线上故障的结果。此前用 OpenNext 时，预渲染页面存在 R2 里
再经 Worker 回放，于是连完全缓存的页面也要付启动 Next 运行时的代价，超过免费版
每请求 10ms CPU 限制，约 8% 的请求返回 `exceededCpu` 503。改成静态托管后实测
Worker 调用从 4791/天降到 0，TTFB 从 0.75–1.44s 降到 0.33s。

这套结构锁定了几个取舍，都是有意为之（细节见 `web/next.config.ts` 里的注释）：

1. **没有 middleware。** 语言前缀跳转、`index.html` 的 301 都搬到了
   `web/public/_redirects`。只要 middleware 的 matcher 命中页面路径就会唤醒
   Worker，静态化就白做了。
2. **没有 `headers()` / `redirects()`。** 它们需要服务端，规则改在
   `web/public/_headers` 和 `web/public/_redirects`。
3. **没有 ISR。** 赛程、队名、场地在构建时固化；只有 `status` 和 `result` 由
   `web/lib/use-live-match-status.ts` 在客户端刷新（失败静默，所以 API 挂掉时页面
   仍然完整可用）。**故意不刷新 `startsAt`**——改期会让比赛跨越构建时算好的月份
   分组，页面会自相矛盾；真改期就重新构建。
4. **没有图片优化。** `images.unoptimized: true`，没有服务端就没有优化器。

## 线上部署走 GitHub Actions（唯一路径）

生产部署由 [`.github/workflows/web-rebuild.yml`](../.github/workflows/web-rebuild.yml)
（名为 `Deploy Web`）负责，三个触发点：

1. `push` 到 `master`——代码改动合并即上线；
2. 每天 `23 2 * * *`（UTC）——站点是静态导出，**只动数据库、不产生 commit** 的
   变更（补译名、改期）靠这趟车上线；
3. `workflow_dispatch`——等不及每天那趟车时手动打一炮：
   `gh workflow run web-rebuild.yml`。

定时点不能随便挪：后端各联赛 `sync_interval` 是 `@daily`、容器时区为 UTC（即
00:00 UTC 同步），公开 API 又压着 30 分钟边缘缓存（`s-maxage=1800`），早于 02:23
构建会把前一天的数据烤进 HTML。

**Cloudflare 自带的 Git 集成（Workers Builds）已刻意关闭，不要重新打开。**
它的 build / deploy 命令存在 Dashboard 里、仓库看不见也改不了，`web/package.json`
改个 script 名就会让部署静默失败——而失败的构建不产生 deployment，所以「没上线」
和「没触发」长得一模一样，只能靠人翻控制台日志发现。这个坑踩过两次。

注意 `sports-calendar-admin` 不在此列，**admin 仍然走 CF Git 自动构建**。

Actions 需要仓库 secrets `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

## 环境变量（全部在构建时生效）

静态导出没有运行时，所以这里**每一个变量都是构建时读取的**。在 Cloudflare 控制台
配置 Worker 环境变量对本站完全无效。

### 取数地址

```env
SPORTS_CALENDAR_API_BASE_URL=https://api.sports-calendar.com
SPORTS_CALENDAR_PUBLIC_API_BASE_URL=https://api.sports-calendar.com
```

1. `SPORTS_CALENDAR_API_BASE_URL`：构建时预渲染取数用。
2. `SPORTS_CALENDAR_PUBLIC_API_BASE_URL`：生成用户订阅用的 ICS 地址。
3. 两个都不配时，生产构建会回退到 `https://api.sports-calendar.com`，开发下回退到
   `http://localhost:8080`（见 `web/lib/catalog.ts`）。所以 CI 上不配也能出正确产物。

本地开发想指到别处，在 `web/.env.local` 里覆盖，格式参考 `web/.env.example`。

### Umami 埋点

```env
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://analytics.sports-calendar.com/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=<website-uuid>
```

两个都留空时不渲染埋点脚本，站点行为与接入前一致。

生产值放在 **`web/.env.production`，这个文件是随仓库提交的**（`.gitignore` 里有例外
放行）。原因是 `NEXT_PUBLIC_*` 由 Next 在构建时内联进产物，而构建由 CI 执行，值必须
在仓库里 CI 才看得到。两个值本来就会出现在每个页面的 HTML 里，属公开信息——但也
因此，**永远不要往这个文件里放密钥**。

验证方式：部署后看线上页面源码，应能看到
`<script src=".../script.js" data-website-id="...">`。

## 静态托管相关的三个文件

1. **`web/wrangler.jsonc`**——assets-only 配置。`assets.directory` 指向 `out`，
   `not_found_handling: "404-page"`。里面那条 v2 migration
   `deleted_classes: ["DOQueueHandler"]` **不是清理垃圾、删不得**：Cloudflare 拒绝
   「悄悄抛弃一个 Durable Object 类」的部署，必须显式声明。
2. **`web/public/_headers`**——规则**后匹配的覆盖前面的**，所以通配 `/*` 必须写在
   `/_next/static/*` 前面，否则长缓存头会被覆盖掉。
3. **`web/public/_redirects`**——语言前缀、`index.html` 的 301。注意它**只作用于
   静态资产请求**（本站全部请求都是，所以没问题）。里面按 URL 深度逐条写规则而不用
   一条通配，原因写在文件注释里：路径中段的 splat 会静默漏掉更深的 URL。

## 构建时取数：一个必须保留的加固

预渲染四百多个页面意味着几百个请求同时打向后端——而后端限流 8 req/s、还要经
Cloudflare Tunnel 回北京。更要命的是**单个 fetch 失败会中止整个 export**。

所以 `web/lib/catalog.ts` 里有并发闸门 + 指数退避重试。CI 环境每次都是干净的、没有
fetch 缓存，所以这条是必需的，不是优化。**不要因为「本地跑得挺快」把它摘掉。**

同理，**不要给 Actions 那个 job 加 Next 构建缓存**：CI 上没有 `.next/cache`，Next
就无法把旧的 API 响应重放进产物。本地重建则相反——只改了数据库的话，必须先
`rm -rf .next/cache` 再构建，否则构建照常成功、419 页全绿，HTML 里却还是旧数据。

## 应急：本地构建并部署

正常情况下不需要这么做，走 Actions 即可。CI 挂了要救火时：

```bash
cd web && rm -rf .next/cache out && npm ci && npm run build && npx wrangler deploy
```

首次需要 `npx wrangler login`，或让 `CLOUDFLARE_API_TOKEN` 出现在环境里。

本地预览产物用 `npm run preview`（`next build && wrangler dev`）。

## 发布后验证什么

1. `/` 能正常跳到语言前缀页，`/en/`、`/zh/` 都正常。
2. 任意赛季页能看到完整赛程（静态 HTML 里就该有，禁用 JS 也不影响）。
3. 球队页正常——**注意 slug 带重音字母的那些**（`atlético-de-madrid`、
   `1-fc-köln`、`málaga-cf`）。这类页面曾整体渲染成 12KB 空壳而 HTTP 仍是 200、
   构建零报错，按体积扫最快：

   ```bash
   python3 -c "import glob,os;[print(f,os.path.getsize(f)) for f in glob.glob('out/zh/soccer/*/*/teams/*/index.html') if os.path.getsize(f)<30000]"
   ```

4. `/sitemap.xml` 包含赛季**和球队**路径（球队页曾静默从 sitemap 里掉出去三天，
   27 条 vs 应有的 415 条）。
5. 订阅按钮生成的 `webcal://` 指向正式 API 域名。
6. `/_next/static/*` 返回 `Cache-Control: public,max-age=31536000,immutable`。
7. 想确认「请求真的没进 Worker」，用 GraphQL Analytics 查
   `workersInvocationsAdaptive`：**返回空数组**才算数。Worker 有调用就说明某个
   改动（多半是新加的 middleware）把静态化破坏了。

## 常用命令

```bash
cd web
npm run build       # 静态导出到 out/
npm run preview     # 构建后用 wrangler dev 本地预览
npm run deploy      # 构建并部署（应急用，日常走 Actions）
npm run cf-typegen
```
