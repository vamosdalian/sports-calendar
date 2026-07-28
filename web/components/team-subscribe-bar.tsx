"use client";

import { useEffect, useRef, useState } from "react";

import { AnalyticsEvent, track } from "../lib/analytics";

type TeamSubscribeBarProps = {
  copySubscriptionLinkLabel: string;
  leagueSlug: string;
  locale: string;
  seasonSlug: string;
  sportSlug: string;
  subscribeLabel: string;
  subscriptionCopyUrl: string;
  subscriptionLinkCopiedLabel: string;
  subscriptionUrl: string;
  teamSlug: string;
};

/**
 * Subscribe CTA for a team page.
 *
 * Kept as its own small client component so the team page itself stays a
 * server component: the fixture list is plain markup, and only this button
 * needs client-side behaviour.
 */
export function TeamSubscribeBar({
  copySubscriptionLinkLabel,
  leagueSlug,
  locale,
  seasonSlug,
  sportSlug,
  subscribeLabel,
  subscriptionCopyUrl,
  subscriptionLinkCopiedLabel,
  subscriptionUrl,
  teamSlug,
}: TeamSubscribeBarProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  // Team identity travels with every conversion event so the dashboard can
  // compare team-page subscribe rates against the league pages.
  function eventData() {
    return { sport: sportSlug, league: leagueSlug, season: seasonSlug, locale, team: teamSlug };
  }

  async function handleCopy() {
    const didCopy = await copyText(subscriptionCopyUrl);
    if (!didCopy) {
      return;
    }

    track(AnalyticsEvent.SubscribeCopy, eventData());
    setCopyState("copied");
    resetTimer.current = setTimeout(() => setCopyState("idle"), 2500);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={subscriptionUrl}
        className="inline-flex h-10 items-center rounded-full bg-header px-5 text-sm font-medium text-white transition hover:bg-header/90"
        onClick={() => track(AnalyticsEvent.SubscribeClick, eventData())}
      >
        {subscribeLabel}
      </a>
      <button
        type="button"
        className="inline-flex h-10 items-center rounded-full border border-ink/15 px-4 text-sm text-ink/80 transition hover:bg-white/40"
        onClick={() => void handleCopy()}
      >
        {copyState === "copied" ? subscriptionLinkCopiedLabel : copySubscriptionLinkLabel}
      </button>
    </div>
  );
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
