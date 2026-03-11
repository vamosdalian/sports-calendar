import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getAvailableYears, getLeaguesByYear } from "../lib/catalog";
import { locales, type Locale, toPath } from "../lib/site";
import { LanguageSwitcher } from "./language-switcher";

type HomeDirectoryProps = {
  locale: Locale;
  selectedYear?: number;
};

export async function HomeDirectory({ locale, selectedYear }: HomeDirectoryProps) {
  const t = await getTranslations();
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
        <section className="mb-6 px-1 py-1">
          <form className="flex items-center gap-3" method="get">
            <select
              id="year-select"
              name="year"
              aria-label="Year selector"
              defaultValue={String(activeYear)}
              className="border border-white/40 bg-white/25 px-3 py-2 text-sm text-ink"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button className="rounded-full bg-header px-4 py-2 text-sm text-white" type="submit">
              {t("applyLabel")}
            </button>
          </form>
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
                        className="text-base font-medium text-ink transition hover:text-header"
                        href={toPath(locale, sport.sportSlug, league.leagueSlug, league.seasons[0].slug)}
                      >
                        {league.leagueName}
                      </Link>
                    ) : (
                      <span className="text-base font-medium text-ink">{league.leagueName}</span>
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