import type { MetadataRoute } from "next";

import { getAllSeasonRoutes, getLeagues, getSeasonPageData } from "../lib/catalog";
import { getTutorialSlugs } from "../lib/tutorials";
import { locales, siteUrl, toPath, toTutorialPath } from "../lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const directory = await getLeagues("en");
  const routes = await getAllSeasonRoutes();
  const tutorialSlugs = getTutorialSlugs();
  const homeLastModified = toLastModified(directory.updatedAt) ?? new Date("2026-03-10T00:00:00Z");
  const tutorialLastModified = new Date("2026-03-10T00:00:00Z");
  const seasonEntries = await Promise.all(
    routes.map(async (route) => {
      const data = await getSeasonPageData(route.sport, route.league, route.season, "en");
      return {
        ...route,
        lastModified: toLastModified(data?.updatedAt) ?? homeLastModified,
      };
    }),
  );
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}${toPath("en")}`,
      lastModified: homeLastModified,
    },
    {
      url: `${siteUrl}${toPath("zh")}`,
      lastModified: homeLastModified,
    },
  ];

  for (const locale of locales) {
    for (const slug of tutorialSlugs) {
      entries.push({
        url: `${siteUrl}${toTutorialPath(locale, slug)}`,
        lastModified: tutorialLastModified,
      });
    }
  }

  for (const route of seasonEntries) {
    for (const locale of locales) {
      entries.push({
        url: `${siteUrl}${toPath(locale, route.sport, route.league, route.season)}`,
        lastModified: route.lastModified,
      });
    }
  }

  return entries;
}

function toLastModified(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}
