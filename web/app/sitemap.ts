import type { MetadataRoute } from "next";

import { getLeagues, getSitemapRoutes } from "../lib/catalog";
import { getTutorialSlugs } from "../lib/tutorials";
import { locales, siteUrl, toPath, toTeamPath, toTutorialPath } from "../lib/site";

// Built once, at build time, alongside the pages it lists. It used to be held
// for an hour and rebuilt on demand, but serving it from the Worker is what a
// static site is trying to avoid — and a sitemap that lists prerendered URLs
// has nothing to say that the build did not already know.
export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const directory = await getLeagues("en");
  const routes = await getSitemapRoutes();
  const tutorialSlugs = getTutorialSlugs();
  const homeLastModified = toLastModified(directory.updatedAt) ?? new Date("2026-03-10T00:00:00Z");
  const tutorialLastModified = new Date("2026-03-10T00:00:00Z");
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: homeLastModified,
    },
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

  for (const route of routes) {
    const lastModified = toLastModified(route.updatedAt) ?? homeLastModified;

    for (const locale of locales) {
      entries.push({
        url: `${siteUrl}${toPath(locale, route.sport, route.league, route.season)}`,
        lastModified,
      });
    }

    // Team pages are generated on demand rather than prerendered, so the
    // sitemap is the only way crawlers find them.
    for (const team of route.teams) {
      for (const locale of locales) {
        entries.push({
          url: `${siteUrl}${toTeamPath(locale, route.sport, route.league, route.season, team)}`,
          lastModified,
        });
      }
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
