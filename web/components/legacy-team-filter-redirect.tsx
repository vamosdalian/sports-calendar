"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { toTeamPath, type Locale } from "../lib/site";

type LegacyTeamFilterRedirectProps = {
  locale: Locale;
  sport: string;
  league: string;
  season: string;
};

/**
 * Sends the old `?team=` filter URLs to the team's own page.
 *
 * Team fixtures used to be a client-side filter on the season page behind a
 * query string, and those links are already shared and bookmarked.
 *
 * This used to be a 301 issued from middleware. The static export has no
 * middleware — and no server to issue a redirect from — so it happens on the
 * client, matching how `?league=` is already handled on the home page. Search
 * engines are kept off the duplicate by the season page's canonical link
 * rather than by the redirect: a query string variant resolves to the same
 * static file, and the canonical points at the clean URL.
 */
export function LegacyTeamFilterRedirect({
  locale,
  sport,
  league,
  season,
}: LegacyTeamFilterRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const teamSlug = searchParams.get("team");
    if (!teamSlug) {
      return;
    }

    // Keep any other parameters (time zone, campaign tags) but drop the one the
    // path now expresses.
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("team");

    const target = toTeamPath(locale, sport, league, season, teamSlug);
    const query = nextSearchParams.toString();
    router.replace(query ? `${target}?${query}` : target);
  }, [locale, sport, league, season, router]);

  return null;
}
