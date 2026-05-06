import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HomeDirectory } from "../components/home-directory";
import { getLeagues } from "../lib/catalog";
import { locales, siteUrl, type Locale, toPath } from "../lib/site";

export async function generateHomeMetadata(locale: Locale, canonicalPath: string): Promise<Metadata> {
  const t = await getTranslations({ locale });
  const directory = await getLeagues(locale);
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toPath(entry)]),
  ) as Record<Locale, string>;
  const title = t("metaTitleHome");
  const description = t("metaDescriptionHome");

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
      languages: {
        "x-default": "/",
        ...localePaths,
      },
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}${canonicalPath}`,
      siteName: "sports-calendar.com",
      type: "website",
      locale,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    other: {
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
