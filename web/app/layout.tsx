import type { ReactNode } from "react";

import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { TimeZoneProvider } from "../components/time-zone-provider";
import { ANALYTICS_SCRIPT_URL, ANALYTICS_WEBSITE_ID, isAnalyticsEnabled } from "../lib/analytics";
import { defaultLocale, isLocale } from "../lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sports-calendar.com"),
  title: "sports-calendar.com",
  description: "Season calendars for football and racing with SSR-ready routes and ICS support.",
  icons: {
    icon: "/calendar.png",
    shortcut: "/calendar.png",
    apple: "/calendar.png",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestedLocale = await getLocale();
  const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale;

  return (
    <html lang={locale}>
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
          // Requests landing on a cold isolate failed while ones reusing a warm
          // isolate succeeded, which is why the failures looked random and hit
          // even the small tutorial pages. A plain tag adds nothing to the
          // Worker bundle — it is just markup — and `defer` already keeps it
          // off the critical rendering path.
          <script defer src={ANALYTICS_SCRIPT_URL} data-website-id={ANALYTICS_WEBSITE_ID} />
        ) : null}
      </body>
    </html>
  );
}
