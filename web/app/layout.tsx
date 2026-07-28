import type { ReactNode } from "react";

import type { Metadata } from "next";
import Script from "next/script";
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
          // Self-hosted, cookie-free analytics: no consent banner needed, and
          // afterInteractive keeps it off the critical rendering path so it
          // cannot affect the Core Web Vitals that the SEO strategy depends on.
          <Script
            src={ANALYTICS_SCRIPT_URL}
            data-website-id={ANALYTICS_WEBSITE_ID}
            strategy="afterInteractive"
            defer
          />
        ) : null}
      </body>
    </html>
  );
}
