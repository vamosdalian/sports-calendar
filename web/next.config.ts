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
        source: "/index.html",
        destination: "/",
        permanent: true,
      },
      {
        source: `/:lang(${localePattern})/index.html`,
        destination: "/:lang/",
        permanent: true,
      },
      {
        source: `/:lang(${localePattern})/:sport/:league/:season/index.html`,
        destination: "/:lang/:sport/:league/:season/",
        permanent: true,
      },
      {
        source: `/:lang(${localePattern})/tutorials/:slug/index.html`,
        destination: "/:lang/tutorials/:slug/",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
