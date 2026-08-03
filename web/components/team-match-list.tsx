"use client";

import { formatMatchLocation, type Match } from "../lib/catalog";
import type { Locale } from "../lib/site";
import { useLiveMatchStatus } from "../lib/use-live-match-status";
import { LocalizedMatchTime } from "./localized-match-time";
import { MatchFixtureLabel } from "./match-fixture-label";

type TeamMatchListProps = {
  apiBaseUrl: string;
  countLabel: string;
  emptyLabel: string;
  leagueSlug: string;
  locale: Locale;
  matches: Match[];
  seasonSlug: string;
  sportSlug: string;
  teamSlug: string;
  title: string;
};

/**
 * The team's fixture list, split out of team-page.tsx so it can run on the
 * client and refresh match status and results — see useLiveMatchStatus. The
 * markup is unchanged from when this was rendered on the server.
 */
export function TeamMatchList({
  apiBaseUrl,
  countLabel,
  emptyLabel,
  leagueSlug,
  locale,
  matches: prerenderedMatches,
  seasonSlug,
  sportSlug,
  teamSlug,
  title,
}: TeamMatchListProps) {
  const matches = useLiveMatchStatus(prerenderedMatches, {
    apiBaseUrl,
    leagueSlug,
    locale,
    seasonSlug,
    sportSlug,
  });

  return (
    <section className="mt-6 bg-transparent p-0">
      <h2 className="bg-aside px-5 py-3 text-sm font-medium text-ink/80">{`${title} · ${countLabel}`}</h2>
      <div className="pt-4">
        {matches.length === 0 ? (
          <p className="text-sm text-ink/75">{emptyLabel}</p>
        ) : (
          <ul className="space-y-2 text-sm text-ink/75">
            {matches.map((match) => (
              <li
                key={match.id}
                className="flex flex-col gap-1 rounded-2xl bg-white/35 px-4 py-3 sm:flex-row sm:items-center"
              >
                {match.round ? <span className="font-medium text-ink/72">{match.round}</span> : null}
                {match.round ? <span className="hidden text-ink/45 sm:inline sm:mx-2">/</span> : null}
                <LocalizedMatchTime className="font-medium text-ink" startsAt={match.startsAt} locale={locale} />
                <span className="hidden text-ink/45 sm:inline sm:mx-2">/</span>
                <span>
                  {/* The list is chronological rather than split by venue; the
                      bolded name is this team, and its side of the fixture says
                      whether the match is at home. */}
                  <MatchFixtureLabel match={match} teamSlug={teamSlug} />
                  {formatMatchLocation(match) ? (
                    <span className="text-ink/55"> · {formatMatchLocation(match)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
