import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TeamPage } from "../../../../../../../components/team-page";
import { getTeamPageData } from "../../../../../../../lib/catalog";
import { formatSeasonDisplay } from "../../../../../../../lib/season";
import { isLocale, locales, type Locale, toTeamPath } from "../../../../../../../lib/site";

export const revalidate = 3600;

// No generateStaticParams here, deliberately, which keeps this route rendered
// per request like the season page it sits under.
//
// Two reasons. Prerendering would mean building a few hundred pages (every
// team, in every locale) and refetching each season payload to do it, risking
// the Cloudflare build budget. And an empty generateStaticParams is not a
// substitute: it marks the route as static, which then collides with the
// cookie-based locale lookup in the root layout and fails the render outright
// with DYNAMIC_SERVER_USAGE.
//
// Cost is bounded because the season payload is served from the fetch cache
// (revalidate above) and a single team's page is a few dozen matches rather
// than the several hundred a league season renders. The sitemap is what gets
// these URLs discovered by crawlers.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; sport: string; league: string; season: string; team: string }>;
}): Promise<Metadata> {
  const { lang, sport, league, season, team } = await params;
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
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toTeamPath(entry, sport, league, season, team)]),
  ) as Record<Locale, string>;

  return {
    title,
    description,
    alternates: {
      canonical: localePaths[lang],
      languages: localePaths,
    },
    openGraph: {
      title,
      description,
      url: localePaths[lang],
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

export default async function TeamRoutePage({
  params,
}: {
  params: Promise<{ lang: string; sport: string; league: string; season: string; team: string }>;
}) {
  const { lang, sport, league, season, team } = await params;
  if (!isLocale(lang)) {
    notFound();
  }

  setRequestLocale(lang);
  return (
    <TeamPage locale={lang} sportSlug={sport} leagueSlug={league} seasonSlug={season} teamSlug={team} />
  );
}
