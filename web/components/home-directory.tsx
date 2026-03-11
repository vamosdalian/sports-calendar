import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getAvailableYears, getLeaguesByYear } from "../lib/catalog";
import { locales, type Locale, toPath } from "../lib/site";
import { HomeYearSelector } from "./home-year-selector";
import { LanguageSwitcher } from "./language-switcher";

type HomeDirectoryProps = {
  locale: Locale;
  selectedYear?: number;
};

export async function HomeDirectory({ locale, selectedYear }: HomeDirectoryProps) {
  const t = await getTranslations({ locale });
  const years = await getAvailableYears();
  const currentYear = new Date().getFullYear();
  const fallbackYear = years.find((year) => year === currentYear) ?? years[0] ?? currentYear;
  const activeYear = selectedYear && years.includes(selectedYear) ? selectedYear : fallbackYear;
  const directory = await getLeaguesByYear(activeYear, locale);
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, `${toPath(entry)}?year=${activeYear}`]),
  ) as Record<Locale, string>;

  return (
    <div>
      <header className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link className="block" href={toPath(locale)}>
            <span className="block text-sm text-white/58">{t("siteName")}</span>
            <span className="mt-1 block text-lg font-medium text-white">{t("homeTitle")}</span>
          </Link>
          <LanguageSwitcher localePaths={localePaths} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] bg-panel px-5 py-6 text-ink sm:px-6 lg:py-8">
        <section className="mb-6 flex justify-end px-1 py-1">
          <HomeYearSelector years={years} selectedYear={activeYear} />
        </section>

        <section className="space-y-6">
          {directory.items.map((sport) => (
            <section key={sport.sportSlug} className="mt-6 bg-transparent p-0">
              <h2 className="bg-aside px-5 py-3 text-sm font-medium text-ink/80">{sport.sportName}</h2>
              <div className="px-5 pt-4 space-y-3">
                {sport.leagues.map((league) => (
                  <div key={league.leagueSlug}>
                    {league.seasons[0] ? (
                      <Link
                        className="text-sm text-blue-700 underline underline-offset-2 transition hover:text-blue-800"
                        href={toPath(locale, sport.sportSlug, league.leagueSlug, league.seasons[0].slug)}
                      >
                        {league.leagueName}
                      </Link>
                    ) : (
                      <span className="text-sm text-ink">{league.leagueName}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </section>

        {directory.items.length === 0 ? <p className="text-sm text-ink/70">{t("noCompetitionsInYear")}</p> : null}
      </main>

      <footer className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex flex-col gap-2 px-4 py-6 text-sm text-white/80 sm:px-6 lg:px-8">
          <span>{t("siteName")}</span>
          <span>{t("homeFooter", { year: activeYear })}</span>
        </div>
      </footer>
    </div>
  );
}