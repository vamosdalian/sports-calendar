"use client";

import { useEffect, useRef, useState } from "react";

type TeamSubscribeBarProps = {
  copySubscriptionLinkLabel: string;
  subscribeLabel: string;
  subscriptionCopyUrl: string;
  subscriptionLinkCopiedLabel: string;
  subscriptionUrl: string;
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
  subscribeLabel,
  subscriptionCopyUrl,
  subscriptionLinkCopiedLabel,
  subscriptionUrl,
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

  async function handleCopy() {
    const didCopy = await copyText(subscriptionCopyUrl);
    if (!didCopy) {
      return;
    }

    setCopyState("copied");
    resetTimer.current = setTimeout(() => setCopyState("idle"), 2500);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={subscriptionUrl}
        className="inline-flex h-10 items-center rounded-full bg-header px-5 text-sm font-medium text-white transition hover:bg-header/90"
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
