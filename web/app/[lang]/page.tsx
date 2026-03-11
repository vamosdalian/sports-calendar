import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { HomeDirectory } from "../../components/home-directory";
import { getHomeEntries } from "../../lib/catalog";
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

  return {
    title: "sports-calendar.com",
    description:
      lang === "zh" ? "覆盖足球与赛车的赛季日历入口。" : "Season calendar directory for football and racing.",
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
  const legacyLeague = (await searchParams).league;
  if (legacyLeague) {
    const route = await resolveLegacyLeagueRoute(legacyLeague, locale);
    if (route) {
      redirect(route);
    }
  }

  return <HomeDirectory locale={locale} />;
}

async function resolveLegacyLeagueRoute(leagueSlug: string, locale: Locale): Promise<string | null> {
  const catalog = await getHomeEntries();
  for (const sport of catalog.sports) {
    for (const league of sport.leagues) {
      if (league.slug === leagueSlug) {
        const season = league.seasons[0];
        if (!season) {
          return null;
        }
        return toPath(locale, sport.slug, league.slug, season.slug);
      }
    }
  }
  return null;
}