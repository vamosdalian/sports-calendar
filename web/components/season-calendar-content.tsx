"use client";

import { startTransition, useEffect } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Match } from "../lib/catalog";
import type { Locale } from "../lib/site";
import { LocalizedMatchTime } from "./localized-match-time";
import { LocalizedMonthCalendars } from "./localized-month-calendars";

type TeamOption = {
  slug: string;
  name: string;
};

type MatchGroup = {
  key: string;
  label: string;
  matches: Match[];
};

type SeasonCalendarContentProps = {
  allTeamsLabel: string;
  leagueCalendarLabel: string;
  locale: Locale;
  matches: Match[];
  noMatchesLabel: string;
  seasonSlug: string;
  subscribeLabel: string;
  subscriptionBaseUrl: string;
  teamFilterLabel: string;
  teamOptions: TeamOption[];
  weekLabels: string[];
};

export function SeasonCalendarContent({
  allTeamsLabel,
  leagueCalendarLabel,
  locale,
  matches,
  noMatchesLabel,
  seasonSlug,
  subscribeLabel,
  subscriptionBaseUrl,
  teamFilterLabel,
  teamOptions,
  weekLabels,
}: SeasonCalendarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const rawTeamSlug = searchParams.get("team") ?? "";
  const selectedTeamSlug = teamOptions.some((option) => option.slug === rawTeamSlug) ? rawTeamSlug : "";
  const filteredMatches = selectedTeamSlug
    ? matches.filter((match) => matchIncludesTeam(match, selectedTeamSlug))
    : matches;
  const filteredGroups = buildMatchGroups(filteredMatches);
  const subscriptionUrl = buildSubscriptionUrl(subscriptionBaseUrl, selectedTeamSlug);

  useEffect(() => {
    if (!rawTeamSlug || selectedTeamSlug) {
      return;
    }

    const nextSearchParams = new URLSearchParams(search);
    nextSearchParams.delete("team");
    const nextSearch = nextSearchParams.toString();
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    router.replace(nextUrl);
  }, [pathname, rawTeamSlug, router, search, selectedTeamSlug]);

  return (
    <>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
          <div className="relative inline-block">
            <select
              aria-label={teamFilterLabel}
              className="h-10 appearance-none rounded-full bg-header px-4 pr-10 text-sm font-medium leading-5 text-white outline-none transition hover:bg-header/90"
              value={selectedTeamSlug || "all"}
              onChange={(event) => {
                const nextSearchParams = new URLSearchParams(search);
                if (event.target.value === "all") {
                  nextSearchParams.delete("team");
                } else {
                  nextSearchParams.set("team", event.target.value);
                }

                const nextSearch = nextSearchParams.toString();
                const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
                startTransition(() => {
                  router.replace(nextUrl);
                });
              }}
            >
              <option value="all" className="text-ink">
                {allTeamsLabel}
              </option>
              {teamOptions.map((option) => (
                <option key={option.slug} value={option.slug} className="text-ink">
                  {option.name}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.5 6.5L8 10l3.5-3.5" />
            </svg>
          </div>

          <a
            href={subscriptionUrl}
            className="inline-flex h-10 items-center rounded-full bg-header px-4 py-2 text-sm font-medium text-white transition hover:bg-header/90"
          >
            {subscribeLabel}
          </a>
        </div>

        <LocalizedMonthCalendars locale={locale} matches={filteredMatches} seasonSlug={seasonSlug} weekLabels={weekLabels} />
      </section>

      <InfoSection title={leagueCalendarLabel}>
        {filteredGroups.length === 0 ? (
          <p className="text-sm text-ink/75">{noMatchesLabel}</p>
        ) : (
          <div className="space-y-4 text-sm text-ink/75">
            {filteredGroups.map((group, index) => (
              <details
                key={group.key}
                className="group w-full rounded-3xl bg-white/25 px-4 py-4"
                open={index === 0}
              >
                <summary className="flex w-full cursor-pointer list-none items-center text-sm font-medium text-ink">
                  <span className="flex items-center gap-3">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      className="h-4 w-4 shrink-0 text-ink/60 transition group-open:rotate-90"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 3.5L10.5 8L6 12.5" />
                    </svg>
                    <span>{group.label}</span>
                  </span>
                </summary>
                <ul className="mt-3 w-full space-y-2">
                  {group.matches.map((match) => (
                    <li key={`summary-${match.id}`} className="rounded-2xl bg-white/35 px-4 py-3">
                      <LocalizedMatchTime className="font-medium text-ink" startsAt={match.startsAt} locale={locale} />
                      <span className="mx-2 text-ink/45">/</span>
                      <MatchSummary match={match} />
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </InfoSection>
    </>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 bg-transparent p-0">
      <h2 className="bg-aside px-5 py-3 text-sm font-medium text-ink/80">{title}</h2>
      <div className="px-5 pt-4">{children}</div>
    </section>
  );
}

function MatchSummary({ match }: { match: Match }) {
  const location = formatMatchLocation(match);

  return (
    <>
      <span>
        {match.homeTeam && match.awayTeam ? (
          <>
            <strong className="font-semibold text-ink">{match.homeTeam.name}</strong>
            <span className="text-ink/65"> vs </span>
            <strong className="font-semibold text-ink">{match.awayTeam.name}</strong>
          </>
        ) : (
          <span>{match.title || match.id}</span>
        )}
      </span>
      {location ? (
        <>
          <span className="mx-2 text-ink/45">/</span>
          <span className="text-ink/72">{location}</span>
        </>
      ) : null}
    </>
  );
}

function buildMatchGroups(matches: Match[]): MatchGroup[] {
  const groupsByKey = new Map<string, MatchGroup>();
  const orderedKeys: string[] = [];

  for (const match of matches) {
    const key = match.round || `match-${match.id}`;
    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, { key, label: match.round || match.id, matches: [] });
      orderedKeys.push(key);
    }
    groupsByKey.get(key)?.matches.push(match);
  }

  return orderedKeys.flatMap((key) => {
    const group = groupsByKey.get(key);
    return group ? [group] : [];
  });
}

function matchIncludesTeam(match: Match, teamSlug: string) {
  return match.homeTeam?.slug === teamSlug || match.awayTeam?.slug === teamSlug;
}

function formatMatchLocation(match: Match) {
  return [match.venue, match.city, match.country].filter(Boolean).join(", ");
}

function buildSubscriptionUrl(baseUrl: string, teamSlug: string) {
  const [path, existingQuery = ""] = baseUrl.split("?", 2);
  const searchParams = new URLSearchParams(existingQuery);

  if (teamSlug) {
    searchParams.set("team", teamSlug);
  } else {
    searchParams.delete("team");
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}