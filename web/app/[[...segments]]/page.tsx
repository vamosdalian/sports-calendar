import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";

import { HomeDirectory } from "../../components/home-directory";
import { SeasonPage } from "../../components/season-page";
import { getAllSeasonRoutes, getHomeEntries, getSeasonPageData, pickLocalized } from "../../lib/catalog";
import { defaultLocale, isLocale, type Locale, toPath } from "../../lib/site";

export const revalidate = 3600;

type RouteShape =
  | { kind: "home"; locale: Locale }
  | { kind: "season"; locale: Locale; sport: string; league: string; season: string };

export async function generateStaticParams() {
  const routes = await getAllSeasonRoutes();

  return [
    { segments: [] },
    { segments: ["zh"] },
    { segments: ["en"] },
    ...routes.flatMap((route) => [
      { segments: [route.sport, route.league, route.season] },
      { segments: ["en", route.sport, route.league, route.season] },
      { segments: ["zh", route.sport, route.league, route.season] },
    ]),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}): Promise<Metadata> {
  const resolved = parseSegments((await params).segments);
  if (!resolved) {
    return {};
  }

  if (resolved.kind === "home") {
    return {
      title: "sports-calendar.com",
      description:
        resolved.locale === "zh"
          ? "覆盖足球与赛车的赛季日历入口。"
          : "Season calendar directory for football and racing.",
    };
  }

  const data = await getSeasonPageData(resolved.sport, resolved.league, resolved.season);
  if (!data) {
    return {};
  }

  return {
    title: `${pickLocalized(data.league.names, resolved.locale)} ${data.season.label} | sports-calendar.com`,
    description: pickLocalized(data.season.calendarDescription, resolved.locale),
  };
}

export default async function SegmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<{ league?: string }>;
}) {
  const resolved = parseSegments((await params).segments);
  if (!resolved) {
    notFound();
  }

  if (resolved.kind === "home") {
    const legacyLeague = (await searchParams).league;
    if (legacyLeague) {
      const route = await resolveLegacyLeagueRoute(legacyLeague, resolved.locale);
      if (route) {
        redirect(route);
      }
    }
    return <HomeDirectory locale={resolved.locale} />;
  }

  return (
    <SeasonPage
      locale={resolved.locale}
      sportSlug={resolved.sport}
      leagueSlug={resolved.league}
      seasonSlug={resolved.season}
    />
  );
}

async function resolveLegacyLeagueRoute(leagueSlug: string, locale: Locale): Promise<string | null> {
  const catalog = await getHomeEntries();
  for (const sport of catalog.sports) {
    for (const league of sport.leagues) {
      if (league.slug === leagueSlug) {
        const season = league.seasons[0];
        if (!season) {
          return null;
        }
        return toPath(locale, sport.slug, league.slug, season.slug);
      }
    }
  }
  return null;
}

function parseSegments(segments: string[] | undefined): RouteShape | null {
  if (!segments || segments.length === 0) {
    return { kind: "home", locale: defaultLocale };
  }

  if (segments.length === 1 && isLocale(segments[0])) {
    return { kind: "home", locale: segments[0] };
  }

  if (segments.length === 3) {
    const [sport, league, season] = segments;
    return { kind: "season", locale: defaultLocale, sport, league, season };
  }

  if (segments.length === 4 && isLocale(segments[0])) {
    const [locale, sport, league, season] = segments;
    return { kind: "season", locale, sport, league, season };
  }

  return null;
}