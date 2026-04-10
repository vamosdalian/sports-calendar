import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SeasonPage } from "../../../../../components/season-page";
import { getAllSeasonRoutes, getSeasonPageData } from "../../../../../lib/catalog";
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

  const data = await getSeasonPageData(sport, league, season, lang);
  if (!data) {
    return {};
  }

  const t = await getTranslations({ locale: lang });
  const year = extractPrimaryYear(data.season.slug, data.season.label);
  const leagueName = data.league.name;

  return {
    title: t("metaTitleSeason", { leagueName, year }),
    description: data.season.calendarDescription,
  };
}

function extractPrimaryYear(seasonSlug: string, seasonLabel: string): string {
  const slugMatch = seasonSlug.match(/\d{4}/);
  if (slugMatch) {
    return slugMatch[0];
  }

  const labelMatch = seasonLabel.match(/\d{4}/);
  if (labelMatch) {
    return labelMatch[0];
  }

  return seasonLabel;
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