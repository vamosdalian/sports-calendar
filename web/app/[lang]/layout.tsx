import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { SiteShell, sharedMetadata } from "../site-shell";
import { isLocale } from "../../lib/site";
import type { ReactNode } from "react";

import "../globals.css";

export const metadata: Metadata = sharedMetadata;

// Root layout for every locale-prefixed route. It renders `<html>` itself so
// that `lang` matches the route's locale — see app/site-shell.tsx.
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
    <SiteShell lang={lang}>
      <NextIntlClientProvider locale={lang} messages={messages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </SiteShell>
  );
}
