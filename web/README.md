# web

The public site, `sports-calendar.com`.

## How it is built and served

A Next.js **static export** (`output: "export"`). `next build` writes every
route as a real HTML file into `out/`, and Cloudflare serves that directory
directly — `wrangler.jsonc` declares no `main`, so it is an assets-only Worker
with no script to boot.

That is deliberate and worth not undoing. When pages were rendered by a Worker
(OpenNext), roughly 8% of requests failed with `exceededCpu` 503s: the
account's 10ms per-request CPU limit is not enough to start the Next runtime,
and even the home page exceeded it. A static file read has no such limit.

Consequences that are easy to trip over:

- **No middleware.** Redirects live in `public/_redirects`, response headers in
  `public/_headers`. `next.config.ts` cannot use `headers()` or `redirects()` —
  both need a server.
- **No ISR.** Fixtures are baked at build time. The two fields that change
  between builds, `status` and `result`, are refreshed in the browser by
  `lib/use-live-match-status.ts`.
- **Every dynamic route needs `generateStaticParams`**, including team pages.
- **Two root layouts.** `/` and `/[lang]/*` each render their own `<html>` so
  `lang` matches the locale. Reading the locale from the request instead would
  opt the whole tree out of static rendering.

## Deploying

Cloudflare Workers Builds watches `master` and runs the build command
configured in the dashboard, currently `npm run build:worker`. That script is
an alias for `next build`, kept under its original name only because the
dashboard setting still refers to it — a rename there without a matching change
here fails the build with `Missing script`, which is exactly how it broke once.
If the dashboard is ever pointed at `npm run build`, this alias can go.

To deploy by hand:

```bash
npm run deploy   # next build && wrangler deploy
```

Do not install `@opennextjs/cloudflare` again. While present it intercepts
`wrangler deploy` and fails with `No R2 binding "NEXT_INC_CACHE_R2_BUCKET"`.

## Verifying a build

A successful build writes **418 HTML files** (388 of them team pages). If the
count is materially lower, a season failed to load and the build should have
failed rather than shipped — check the log for a thrown season fetch.

```bash
find out -name '*.html' | wc -l
```
