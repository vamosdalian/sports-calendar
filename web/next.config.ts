import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/index.html",
        permanent: true,
      },
      {
        source: "/:lang(en|zh)",
        destination: "/:lang/index.html",
        permanent: true,
      },
      {
        source: "/:lang(en|zh)/:sport/:league/:season",
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
        source: "/:lang(en|zh)/index.html",
        destination: "/:lang",
      },
      {
        source: "/:lang(en|zh)/:sport/:league/:season/index.html",
        destination: "/:lang/:sport/:league/:season",
      },
    ];
  },
};

export default nextConfig;