import type { MetadataRoute } from "next";

import { getAllSeasonRoutes } from "../lib/catalog";
import { locales, siteUrl, toPath } from "../lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = await getAllSeasonRoutes();
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/en/`,
      lastModified: new Date("2026-03-10T00:00:00Z"),
    },
    {
      url: `${siteUrl}/zh/`,
      lastModified: new Date("2026-03-10T00:00:00Z"),
    },
  ];

  for (const route of routes) {
    for (const locale of locales) {
      entries.push({
        url: `${siteUrl}${toPath(locale, route.sport, route.league, route.season)}`,
        lastModified: new Date("2026-03-10T00:00:00Z"),
      });
    }
  }

  return entries;
}