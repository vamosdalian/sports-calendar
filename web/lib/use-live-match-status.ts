"use client";

import { useEffect, useState } from "react";

import type { Match } from "./catalog";
import type { Locale } from "./site";

type LiveMatchStatusOptions = {
  apiBaseUrl: string;
  leagueSlug: string;
  locale: Locale;
  seasonSlug: string;
  sportSlug: string;
};

type SeasonDetailPayload = {
  groups?: Array<{ matches?: Array<Pick<Match, "id" | "status" | "result">> }>;
};

/**
 * Refreshes the volatile half of a fixture list in the browser.
 *
 * Pages are prerendered at build time, so the fixtures baked into the HTML are
 * as fresh as the last build. Kickoff times, venues and opponents are settled
 * well in advance and change rarely enough that a rebuild covers them — but
 * `status` and `result` change every time a match is played. Those two fields,
 * and only those two, are re-fetched here.
 *
 * Deliberately narrow. Rewriting `startsAt` would move a match between the
 * month groups computed at build time, leaving the page inconsistent with its
 * own layout; a fixture that actually moved is a rebuild, not a patch.
 *
 * Failures are silent on purpose: the prerendered fixtures are already correct
 * enough to be useful, so a backend outage should leave the page as it was
 * rather than surface an error. This is why the site now survives an API
 * outage that used to take it down entirely.
 */
export function useLiveMatchStatus(initialMatches: Match[], options: LiveMatchStatusOptions): Match[] {
  const { apiBaseUrl, leagueSlug, locale, seasonSlug, sportSlug } = options;
  const [matches, setMatches] = useState(initialMatches);

  // A new prerendered list (client-side navigation to another season) replaces
  // whatever the previous page had refreshed.
  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches]);

  useEffect(() => {
    const controller = new AbortController();
    const requestUrl =
      `${apiBaseUrl}/api/${encodeURIComponent(sportSlug)}/${encodeURIComponent(leagueSlug)}` +
      `/${encodeURIComponent(seasonSlug)}?lang=${encodeURIComponent(locale)}`;

    async function refresh() {
      try {
        const response = await fetch(requestUrl, { signal: controller.signal });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as SeasonDetailPayload;
        const latest = new Map<string, Pick<Match, "id" | "status" | "result">>();
        for (const group of payload.groups ?? []) {
          for (const match of group.matches ?? []) {
            latest.set(match.id, match);
          }
        }

        if (latest.size === 0) {
          return;
        }

        setMatches((current) => {
          let changed = false;
          const next = current.map((match) => {
            const fresh = latest.get(match.id);
            if (!fresh || (fresh.status === match.status && sameResult(fresh.result, match.result))) {
              return match;
            }

            changed = true;
            return { ...match, status: fresh.status, result: fresh.result };
          });

          // Returning `current` unchanged keeps React from re-rendering the
          // whole calendar when nothing actually moved, which is the common
          // case between matches.
          return changed ? next : current;
        });
      } catch {
        // Aborted, offline, or the API is down. The prerendered list stands.
      }
    }

    void refresh();

    return () => controller.abort();
  }, [apiBaseUrl, leagueSlug, locale, seasonSlug, sportSlug]);

  return matches;
}

function sameResult(left: string[] | undefined, right: string[] | undefined) {
  if (left === right) {
    return true;
  }

  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
