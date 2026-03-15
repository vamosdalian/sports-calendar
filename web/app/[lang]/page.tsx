import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { HomeDirectory } from "../../components/home-directory";
import { getLeagues } from "../../lib/catalog";
import { isLocale, locales, type Locale, toPath } from "../../lib/site";

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

  const t = await getTranslations({ locale: lang });
  return {
    title: "sports-calendar.com",
    description: t("metaDescriptionHome"),
  };
}

export default async function LanguageHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ league?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }

  const locale = lang as Locale;
  const { league: legacyLeague } = await searchParams;
  if (legacyLeague) {
    const route = await resolveLegacyLeagueRoute(legacyLeague, locale);
    if (route) {
      redirect(route);
    }
  }

  return <HomeDirectory locale={locale} />;
}

async function resolveLegacyLeagueRoute(leagueSlug: string, locale: Locale): Promise<string | null> {
  const directory = await getLeagues(locale);
  for (const sport of directory.items) {
    for (const league of sport.leagues) {
      if (league.leagueSlug !== leagueSlug) {
        continue;
      }
      return toPath(locale, sport.sportSlug, league.leagueSlug, league.defaultSeason.slug);
    }
  }
  return null;
}