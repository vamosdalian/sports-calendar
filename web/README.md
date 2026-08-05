# web

The public site, `sports-calendar.com`.

## How it is built and served

A Next.js **static export** (`output: "export"`). `next build` writes every
route as a real HTML file into `out/`, and Cloudflare serves that directory
directly — `wrangler.jsonc` declares no `main`, so it is an assets-only Worker
with no script to boot.

That is deliberate and worth not undoing. A dynamic Worker runtime exceeded
the account's 10ms per-request CPU limit on roughly 8% of requests, while a
static file read does not start a server runtime at all.

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

Production deploys run through `.github/workflows/web-rebuild.yml`. A push to
`master`, the daily schedule, or a manual workflow dispatch builds the static
export and deploys it with Wrangler. Cloudflare's Git integration is disabled
so there is only one deployment path.

To deploy by hand:

```bash
npm run deploy   # next build && wrangler deploy
```

## Verifying a build

A successful build writes **418 HTML files** (388 of them team pages). If the
count is materially lower, a season failed to load and the build should have
failed rather than shipped — check the log for a thrown season fetch.

```bash
find out -name '*.html' | wc -l
```
