import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Keep in sync with localeOptions in lib/site.ts
const localePattern = "en|zh";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async redirects() {
    return [
      {
        source: `/:lang(${localePattern})`,
        destination: "/:lang/index.html",
        permanent: true,
      },
      {
        source: `/:lang(${localePattern})/:sport/:league/:season`,
        destination: "/:lang/:sport/:league/:season/index.html",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/index.html",
        destination: "/",
      },
      {
        source: `/:lang(${localePattern})/index.html`,
        destination: "/:lang",
      },
      {
        source: `/:lang(${localePattern})/:sport/:league/:season/index.html`,
        destination: "/:lang/:sport/:league/:season",
      },
    ];
  },
};

export default withNextIntl(nextConfig);