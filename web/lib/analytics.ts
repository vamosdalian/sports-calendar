/**
 * Umami event tracking.
 *
 * Umami is self-hosted and cookie-free, so no consent banner is required —
 * which matters because a banner would sit directly on top of the subscribe
 * conversion we are trying to measure.
 *
 * Every call is a no-op when the script is absent (analytics unconfigured, ad
 * blocker, SSR), so callers never need to guard.
 */

type UmamiPayload = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: UmamiPayload) => void;
    };
  }
}

export const ANALYTICS_SCRIPT_URL = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL ?? "";
export const ANALYTICS_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "";

/** Whether analytics is configured for this deployment. */
export function isAnalyticsEnabled(): boolean {
  return ANALYTICS_SCRIPT_URL !== "" && ANALYTICS_WEBSITE_ID !== "";
}

/** Record a custom event. Silently ignored if the script has not loaded. */
export function track(event: string, data?: UmamiPayload): void {
  if (typeof window === "undefined" || !window.umami) {
    return;
  }
  try {
    window.umami.track(event, data);
  } catch {
    // Analytics must never break the page.
  }
}

/**
 * Custom events. Page views (including tutorial pages) are tracked
 * automatically by the script, so only conversions are declared here.
 */
export const AnalyticsEvent = {
  /** User clicked through to the ICS feed — the primary conversion. */
  SubscribeClick: "subscribe_click",
  /** User copied the feed URL instead, which is a subscription too. */
  SubscribeCopy: "subscribe_copy",
} as const;
