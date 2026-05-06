import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { generateHomeMetadata, renderHomePage } from "../home-page";
import { isLocale, locales, type Locale } from "../../lib/site";

export const revalidate = 3600;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) {
    return {};
  }

  return generateHomeMetadata(lang, `/${lang}/`);
}

export default async function LanguageHomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }

  const locale = lang as Locale;
  setRequestLocale(locale);
  return renderHomePage(locale, `/${locale}/`);
}
