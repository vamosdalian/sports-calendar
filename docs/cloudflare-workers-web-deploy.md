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

同时：

1. `web/proxy.ts` 已切换为 `web/middleware.ts`
2. `package.json` 新增了 `preview`、`deploy` 和 `cf-typegen` 脚本

这样做的原因是：当前 OpenNext/Cloudflare 不支持 Next 16 的 Node runtime proxy，但支持 Edge middleware。

## 环境变量

至少配置以下两个变量：

```env
SPORTS_CALENDAR_API_BASE_URL=https://api.sports-calendar.com
SPORTS_CALENDAR_PUBLIC_API_BASE_URL=https://api.sports-calendar.com
```

说明：

1. `SPORTS_CALENDAR_API_BASE_URL` 用于服务端取数。
2. `SPORTS_CALENDAR_PUBLIC_API_BASE_URL` 用于生成用户订阅用的 ICS 地址。

本地预览时，可在 `web/` 下创建 `.dev.vars`，内容可参考 `web/.dev.vars.example`。

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

## 在 Cloudflare Dashboard / Workers Builds 上部署

如果你不想本地手工部署，也可以在 Cloudflare Dashboard 里把 GitHub 仓库接进去。

推荐配置：

1. Root directory: `web`
2. Build command: `npm run deploy`
3. Production branch: 你的主分支

更稳妥的做法是把构建和部署拆开：

1. Build command: `npm run build:worker`
2. Deploy command: `npx opennextjs-cloudflare deploy`

注意：

1. `npm run build` 只会执行 Next.js 自己的构建，不会生成 OpenNext 需要的 `.open-next/` 产物。
2. `opennextjs-cloudflare deploy` 依赖前一步已经存在 `.open-next` 编译结果，否则就会报 `Could not find compiled Open Next config, did you run the build command?`。

但如果直接使用 Workers 的 Next.js 自动识别能力，通常也可以按当前 `package.json` 脚本执行。

无论用哪种方式，Dashboard 里都必须配置上面的两个环境变量。

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