import type { ReactNode } from "react";

import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { TimeZoneProvider } from "../components/time-zone-provider";
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
      </body>
    </html>
  );
}
