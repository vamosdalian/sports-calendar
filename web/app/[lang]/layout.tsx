import type { ReactNode } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { TimeZoneProvider } from "../../components/time-zone-provider";
import { isLocale } from "../../lib/site";

import "../globals.css";

const DISPLAY_TIME_ZONE = "UTC";

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

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }

  setRequestLocale(lang);
  const messages = (await import(`../../messages/${lang}.json`)).default;

  return (
    <html lang={lang}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={lang} messages={messages} timeZone={DISPLAY_TIME_ZONE}>
          <TimeZoneProvider>{children}</TimeZoneProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
