import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Static export: every route is written out as a real HTML file and served
  // straight from Cloudflare's asset storage, without invoking a Worker.
  //
  // This is the whole point of the setup. Under OpenNext the prerendered pages
  // were stored in R2 and replayed *through* the Worker, so even a fully
  // cached page paid the cost of booting the Next runtime — which exceeded the
  // 10ms CPU limit and returned `exceededCpu` 503s on roughly 8% of requests.
  // A static file read has no such limit.
  //
  // The tradeoffs this locks in, all of them deliberate:
  //   - No middleware. Redirects live in `public/_redirects` instead.
  //   - No `headers()`/`redirects()` here; they need a server. Same file.
  //   - No ISR. Fixtures are baked at build time and the volatile fields
  //     (status, result) are refreshed client-side.
  output: "export",
  trailingSlash: true,
  images: {
    // No image optimizer exists without a server; the tutorial screenshots are
    // already sized for their slots.
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
