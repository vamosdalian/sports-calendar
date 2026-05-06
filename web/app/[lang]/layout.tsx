import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { isLocale } from "../../lib/site";
import type { ReactNode } from "react";

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
    <NextIntlClientProvider locale={lang} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
