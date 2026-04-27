"use client";

import { startTransition, useEffect, useRef, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { formatMatchLocation, matchLabel, type Match } from "../lib/catalog";
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
  copySubscriptionLinkLabel: string;
  leagueCalendarLabel: string;
  locale: Locale;
  matches: Match[];
  noMatchesLabel: string;
  seasonSlug: string;
  subscribeLabel: string;
  subscriptionBaseUrl: string;
  subscriptionCopyBaseUrl: string;
  subscriptionLinkCopiedLabel: string;
  teamFilterLabel: string;
  teamOptions: TeamOption[];
  weekLabels: string[];
};

export function SeasonCalendarContent({
  allTeamsLabel,
  copySubscriptionLinkLabel,
  leagueCalendarLabel,
  locale,
  matches,
  noMatchesLabel,
  seasonSlug,
  subscribeLabel,
  subscriptionBaseUrl,
  subscriptionCopyBaseUrl,
  subscriptionLinkCopiedLabel,
  teamFilterLabel,
  teamOptions,
  weekLabels,
}: SeasonCalendarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const search = searchParams.toString();
  const rawTeamSlug = searchParams.get("team") ?? "";
  const selectedTeamSlug = teamOptions.some((option) => option.slug === rawTeamSlug) ? rawTeamSlug : "";
  const filteredMatches = selectedTeamSlug
    ? matches.filter((match) => matchIncludesTeam(match, selectedTeamSlug))
    : matches;
  const filteredGroups = buildMatchGroups(filteredMatches);
  const initiallyOpenGroupKey = findMostRecentFinishedGroupKey(filteredGroups);
  const subscriptionUrl = buildSubscriptionUrl(subscriptionBaseUrl, selectedTeamSlug);
  const subscriptionCopyUrl = buildSubscriptionUrl(subscriptionCopyBaseUrl, selectedTeamSlug);

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

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  async function handleCopySubscriptionLink() {
    const didCopy = await copyText(subscriptionCopyUrl);
    if (!didCopy) {
      return;
    }

    setCopyState("copied");
  }

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

          <div className="relative inline-flex" ref={menuRef}>
            <a
              href={subscriptionUrl}
              className="inline-flex h-10 items-center rounded-l-full bg-header px-4 py-2 text-sm font-medium text-white transition hover:bg-header/90"
            >
              {subscribeLabel}
            </a>
            <button
              type="button"
              aria-label={copySubscriptionLinkLabel}
              aria-expanded={isMenuOpen}
              className="inline-flex h-10 items-center rounded-r-full bg-header px-3 text-white transition hover:bg-header/90"
              onClick={() => {
                setIsMenuOpen((current) => {
                  const next = !current;
                  if (next) {
                    setCopyState("idle");
                  }
                  return next;
                });
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className={`h-4 w-4 transition ${isMenuOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4.5 6.5L8 10l3.5-3.5" />
              </svg>
            </button>

            {isMenuOpen ? (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[220px] overflow-hidden rounded-2xl bg-header shadow-[0_18px_40px_rgba(17,24,39,0.18)]">
                <button
                  type="button"
                  className="flex w-full items-center bg-header px-4 py-3 text-left text-sm font-medium text-white transition hover:brightness-110"
                  onClick={() => {
                    void handleCopySubscriptionLink();
                  }}
                >
                  <span>{copyState === "copied" ? subscriptionLinkCopiedLabel : copySubscriptionLinkLabel}</span>
                </button>
              </div>
            ) : null}
          </div>
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
                open={initiallyOpenGroupKey ? group.key === initiallyOpenGroupKey : index === 0}
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
      <div className="pt-4">{children}</div>
    </section>
  );
}

function MatchSummary({ match }: { match: Match }) {
  const location = formatMatchLocation(match);

  return (
    <>
      <span>
        {match.homeTeam && match.awayTeam ? (
          <strong className="font-semibold text-ink">{matchLabel(match)}</strong>
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

function findMostRecentFinishedGroupKey(groups: MatchGroup[]) {
  let mostRecent: { groupKey: string; startsAtMs: number } | null = null;
  const now = Date.now();

  for (const group of groups) {
    for (const match of group.matches) {
      if (match.status !== "finished") {
        continue;
      }

      const startsAtMs = Date.parse(match.startsAt);
      if (!Number.isFinite(startsAtMs) || startsAtMs > now) {
        continue;
      }

      if (!mostRecent || startsAtMs > mostRecent.startsAtMs) {
        mostRecent = { groupKey: group.key, startsAtMs };
      }
    }
  }

  return mostRecent?.groupKey ?? "";
}

function matchIncludesTeam(match: Match, teamSlug: string) {
  return match.homeTeam?.slug === teamSlug || match.awayTeam?.slug === teamSlug;
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

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return copyTextWithSelection(value);
    }
  }

  return copyTextWithSelection(value);
}

function copyTextWithSelection(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
