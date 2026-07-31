import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SeasonPage } from "../../../../../components/season-page";
import { getAllSeasonRoutes, getSeasonPageData } from "../../../../../lib/catalog";
import { formatSeasonDisplay } from "../../../../../lib/season";
import { decodeRouteParams, isLocale, locales, toAlternates, toPath } from "../../../../../lib/site";

export async function generateStaticParams() {
  const routes = await getAllSeasonRoutes();
  return routes.flatMap((route) => locales.map((lang) => ({ lang, ...route })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; sport: string; league: string; season: string }>;
}): Promise<Metadata> {
  const { lang, sport, league, season } = decodeRouteParams(await params);
  if (!isLocale(lang)) {
    return {};
  }

  const data = await getSeasonPageData(sport, league, season, lang);
  if (!data) {
    return {};
  }

  const t = await getTranslations({ locale: lang });
  const leagueName = data.league.name;
  const seasonLabel = formatSeasonDisplay(data.season.slug, data.season.label);
  const alternates = toAlternates(lang, (entry) => toPath(entry, sport, league, season));
  const title = t("metaTitleSeason", { leagueName, seasonLabel });

  return {
    title,
    description: data.season.calendarDescription,
    alternates,
    openGraph: {
      title,
      description: data.season.calendarDescription,
      url: alternates.canonical,
      siteName: "sports-calendar.com",
      type: "website",
      locale: lang,
    },
    other: {
      "last-modified": data.updatedAt,
      "article:modified_time": data.updatedAt,
    },
  };
}

export default async function SeasonRoutePage({
  params,
}: {
  params: Promise<{ lang: string; sport: string; league: string; season: string }>;
}) {
  const { lang, sport, league, season } = decodeRouteParams(await params);
  if (!isLocale(lang)) {
    notFound();
  }

  setRequestLocale(lang);
  return <SeasonPage locale={lang} sportSlug={sport} leagueSlug={league} seasonSlug={season} />;
}
