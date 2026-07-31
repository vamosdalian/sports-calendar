import type { ReactNode } from "react";

import type { Metadata } from "next";

import { TimeZoneProvider } from "../components/time-zone-provider";
import { ANALYTICS_SCRIPT_URL, ANALYTICS_WEBSITE_ID, isAnalyticsEnabled } from "../lib/analytics";
import type { Locale } from "../lib/site";

export const sharedMetadata: Metadata = {
  metadataBase: new URL("https://sports-calendar.com"),
  title: "sports-calendar.com",
  description: "Season calendars for football and racing with SSR-ready routes and ICS support.",
  icons: {
    icon: "/calendar.png",
    shortcut: "/calendar.png",
    apple: "/calendar.png",
  },
};

/**
 * The `<html>`/`<body>` wrapper, shared by both root layouts.
 *
 * There are two root layouts on purpose. `lang` has to be correct per locale —
 * a Chinese page announcing `lang="en"` misleads screen readers and search
 * engines — but only a root layout may render `<html>`, and a root layout
 * cannot read the `[lang]` route param. Reading the locale from the request
 * instead is what forced every route to render dynamically before, which is
 * the whole thing this static export exists to avoid.
 *
 * So `/` and `/:lang/*` each get their own root layout, and both delegate here.
 */
export function SiteShell({ lang, children }: { lang: Locale; children: ReactNode }) {
  return (
    <html lang={lang}>
      <body className="font-sans antialiased">
        <TimeZoneProvider>{children}</TimeZoneProvider>
        {isAnalyticsEnabled() ? (
          // Self-hosted, cookie-free analytics: no consent banner needed.
          //
          // Deliberately a plain <script defer> rather than next/script. Using
          // next/script here made every page return 503
          // "Worker exceeded resource limits" roughly half the time: it turns
          // the tag into a client component that the Worker has to set up on
          // startup, and that pushed isolate startup past Cloudflare's limit.
          // A plain tag adds nothing to the bundle — it is just markup — and
          // `defer` already keeps it off the critical rendering path.
          <script defer src={ANALYTICS_SCRIPT_URL} data-website-id={ANALYTICS_WEBSITE_ID} />
        ) : null}
      </body>
    </html>
  );
}
