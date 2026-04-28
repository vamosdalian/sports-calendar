import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { HomeDirectory } from "../../components/home-directory";
import { getLeagues } from "../../lib/catalog";
import { isLocale, locales, type Locale, toPath } from "../../lib/site";

export const revalidate = 3600;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) {
    return {};
  }

  const t = await getTranslations({ locale: lang });
  const directory = await getLeagues(lang);
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toPath(entry)]),
  ) as Record<Locale, string>;

  return {
    title: "sports-calendar.com",
    description: t("metaDescriptionHome"),
    alternates: {
      canonical: localePaths[lang],
      languages: localePaths,
    },
    openGraph: {
      title: "sports-calendar.com",
      description: t("metaDescriptionHome"),
      url: localePaths[lang],
      siteName: "sports-calendar.com",
      type: "website",
      locale: lang,
    },
    other: {
      "last-modified": directory.updatedAt,
      "article:modified_time": directory.updatedAt,
    },
  };
}

export default async function LanguageHomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }

  const locale = lang as Locale;
  setRequestLocale(locale);
  const directory = await getLeagues(locale);

  return (
    <HomeDirectory
      directory={directory}
      legacyLeagueRoutes={buildLegacyLeagueRoutes(directory, locale)}
      locale={locale}
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
