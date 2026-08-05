import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TeamPage } from "../../../../../../../components/team-page";
import { getSitemapRoutes, getTeamPageData } from "../../../../../../../lib/catalog";
import { formatSeasonDisplay } from "../../../../../../../lib/season";
import { decodeRouteParams, isLocale, locales, toAlternates, toTeamPath } from "../../../../../../../lib/site";

// Every team page is prerendered at build time so that serving one is a static
// file read rather than a Worker invocation. Rendering these per request is
// what pushed the Worker past Cloudflare's 10ms CPU limit and returned 503s.
//
// This route used to skip prerendering on purpose, for two reasons that no
// longer hold: the build cost of refetching every season payload (now paid
// once at build time instead of on every cold request), and a collision with
// the cookie-based locale lookup in the root layout (that lookup is gone, see
// app/layout.tsx).
export async function generateStaticParams() {
  const routes = await getSitemapRoutes();

  return routes.flatMap((route) =>
    route.teams.flatMap((team) =>
      locales.map((lang) => ({
        lang,
        sport: route.sport,
        league: route.league,
        season: route.season,
        team,
      })),
    ),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; sport: string; league: string; season: string; team: string }>;
}): Promise<Metadata> {
  const { lang, sport, league, season, team } = decodeRouteParams(await params);
  if (!isLocale(lang)) {
    return {};
  }

  const result = await getTeamPageData(sport, league, season, team, lang);
  if (result.kind !== "ok") {
    // Nothing to describe: the page itself will 404 or redirect.
    return {};
  }

  const data = result.data;
  const t = await getTranslations({ locale: lang });
  const seasonLabel = formatSeasonDisplay(data.season.slug, data.season.label);
  const teamName = data.team.name;
  const leagueName = data.league.name;
  // Team-specific title and description rather than the league template: these
  // pages only earn their place in the index if they read as being about the
  // team, not as a filtered copy of the season page.
  const title = t("metaTitleTeam", { teamName, seasonLabel });
  const description = t("metaDescriptionTeam", { teamName, leagueName, seasonLabel });
  // The catalog's own spelling of the slug, not the incoming param: whatever
  // form the request arrived in, the canonical URL has to name one page.
  const alternates = toAlternates(lang, (entry) =>
    toTeamPath(entry, sport, league, season, data.team.slug),
  );

  return {
    title,
    description,
    alternates,
    other: {
      "last-modified": data.updatedAt,
      "article:modified_time": data.updatedAt,
    },
  };
}

export default async function TeamRoutePage({
  params,
}: {
  params: Promise<{ lang: string; sport: string; league: string; season: string; team: string }>;
}) {
  const { lang, sport, league, season, team } = decodeRouteParams(await params);
  if (!isLocale(lang)) {
    notFound();
  }

  setRequestLocale(lang);
  return (
    <TeamPage locale={lang} sportSlug={sport} leagueSlug={league} seasonSlug={season} teamSlug={team} />
  );
}
