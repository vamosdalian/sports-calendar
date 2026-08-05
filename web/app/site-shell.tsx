import type { ReactNode } from "react";

import type { Metadata } from "next";

import { TimeZoneProvider } from "../components/time-zone-provider";
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
      </body>
    </html>
  );
}
