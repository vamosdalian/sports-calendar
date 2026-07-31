import type { MetadataRoute } from "next";

import { siteUrl } from "../lib/site";

// Written out as a file at build time; `output: export` has no server to
// generate it per request.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}