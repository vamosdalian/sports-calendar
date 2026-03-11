import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeasonPage } from "../../../../../components/season-page";
import { getAllSeasonRoutes, getSeasonPageData, pickLocalized } from "../../../../../lib/catalog";
import { isLocale, locales } from "../../../../../lib/site";

export const revalidate = 3600;

export async function generateStaticParams() {
  const routes = await getAllSeasonRoutes();
  return routes.flatMap((route) => locales.map((lang) => ({ lang, ...route })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; sport: string; league: string; season: string }>;
}): Promise<Metadata> {
  const { lang, sport, league, season } = await params;
  if (!isLocale(lang)) {
    return {};
  }

  const data = await getSeasonPageData(sport, league, season);
  if (!data) {
    return {};
  }

  return {
    title: `${pickLocalized(data.league.names, lang)} ${data.season.label} | sports-calendar.com`,
    description: pickLocalized(data.season.calendarDescription, lang),
  };
}

export default async function SeasonRoutePage({
  params,
}: {
  params: Promise<{ lang: string; sport: string; league: string; season: string }>;
}) {
  const { lang, sport, league, season } = await params;
  if (!isLocale(lang)) {
    notFound();
  }

  return <SeasonPage locale={lang} sportSlug={sport} leagueSlug={league} seasonSlug={season} />;
}