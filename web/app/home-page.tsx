import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HomeDirectory } from "../components/home-directory";
import { getLeagues } from "../lib/catalog";
import { toAlternates, type Locale, toPath } from "../lib/site";

export async function generateHomeMetadata(locale: Locale, canonicalPath: string): Promise<Metadata> {
  const t = await getTranslations({ locale });
  const directory = await getLeagues(locale);
  const title = t("metaTitleHome");
  const description = t("metaDescriptionHome");

  return {
    title,
    description,
    alternates: {
      // The home page is the one place a locale-less URL answers without a
      // redirect, so it keeps `/` as x-default instead of the `en` default.
      ...toAlternates(locale, (entry) => toPath(entry), "/"),
      canonical: canonicalPath,
    },
    other: {
      "baidu-site-verification": "codeva-aN3iytXMhj",
      "last-modified": directory.updatedAt,
      "article:modified_time": directory.updatedAt,
    },
  };
}

export async function renderHomePage(locale: Locale, currentPath: string) {
  const directory = await getLeagues(locale);

  return (
    <HomeDirectory
      directory={directory}
      legacyLeagueRoutes={buildLegacyLeagueRoutes(directory, locale)}
      locale={locale}
      currentPath={currentPath}
    />
  );
}

function buildLegacyLeagueRoutes(
  directory: Awaited<ReturnType<typeof getLeagues>>,
  locale: Locale,
): Record<string, string> {
  const routes: Record<string, string> = {};

  for (const sport of directory.items) {
    for (const league of sport.leagues) {
      if (!league.defaultSeason) {
        continue;
      }

      routes[league.leagueSlug] = toPath(locale, sport.sportSlug, league.leagueSlug, league.defaultSeason.slug);
    }
  }

  return routes;
}
