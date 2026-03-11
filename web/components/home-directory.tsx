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
        <section className="mb-6 rounded-3xl border border-ink/10 bg-white/35 px-5 py-4">
          <p className="text-sm text-ink/70">{t("homeLead")}</p>
          <form className="mt-4 flex items-center gap-3" method="get">
            <label className="text-sm font-medium text-ink/70" htmlFor="year-select">
              {t("yearLabel")}
            </label>
            <select
              id="year-select"
              name="year"
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

        <section className="grid gap-6 lg:grid-cols-2">
          {directory.items.map((sport) => (
            <article key={sport.sportSlug} className="rounded-panel border border-ink/10 bg-white/35 px-6 py-6">
              <p className="text-xs text-header/60">{sport.sportName}</p>
              <h2 className="mt-2 text-2xl font-medium text-ink">{sport.sportName}</h2>
              <div className="mt-6 space-y-4">
                {sport.leagues.map((league) => (
                  <div key={league.leagueSlug} className="rounded-3xl border border-line bg-shell/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-ink">{league.leagueName}</h3>
                      <p className="text-sm text-ink/60">{league.countryName}</p>
                    </div>
                    <span className="rounded-full bg-header px-3 py-1 text-xs uppercase tracking-[0.25em] text-white">
                      {league.leagueSlug}
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {league.seasons.map((season) => (
                      <li key={season.slug} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                        <span className="text-sm text-ink">{season.label}</span>
                        <Link
                          className="rounded-full bg-header px-4 py-2 text-sm text-white transition hover:bg-header/90"
                          href={toPath(locale, sport.sportSlug, league.leagueSlug, season.slug)}
                        >
                          {t("viewSeason")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>
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