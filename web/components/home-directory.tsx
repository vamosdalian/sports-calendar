import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getLeagues } from "../lib/catalog";
import { locales, type Locale, toPath } from "../lib/site";
import { LanguageSwitcher } from "./language-switcher";
import { TimeZoneSelector } from "./time-zone-selector";

type HomeDirectoryProps = {
  locale: Locale;
};

export async function HomeDirectory({ locale }: HomeDirectoryProps) {
  const t = await getTranslations({ locale });
  const directory = await getLeagues(locale);
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toPath(entry)]),
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
        <section className="space-y-6">
          {directory.items.map((sport) => (
            <section key={sport.sportSlug} className="mt-6 bg-transparent p-0">
              <h2 className="bg-aside px-5 py-3 text-sm font-medium text-ink/80">{sport.sportName}</h2>
              <div className="space-y-3 px-5 pt-4">
                {sport.leagues.map((league) => (
                  <div key={league.leagueSlug}>
                    {league.defaultSeason ? (
                      <Link
                        className="text-sm text-blue-700 underline underline-offset-2 transition hover:text-blue-800"
                        href={toPath(locale, sport.sportSlug, league.leagueSlug, league.defaultSeason.slug)}
                      >
                        {league.leagueName}
                      </Link>
                    ) : (
                      <span className="text-sm text-ink/70">{league.leagueName}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </section>

        {directory.items.length === 0 ? <p className="text-sm text-ink/70">{t("noCompetitions")}</p> : null}
      </main>

      <footer className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex flex-col gap-4 px-4 py-6 text-sm text-white/80 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex flex-col gap-2">
            <span>{t("siteName")}</span>
            <span>{t("homeFooter")}</span>
          </div>
          <div className="flex flex-col gap-3 text-left md:ml-auto md:items-end md:text-right">
            <TimeZoneSelector
              browserDefaultLabel={t("browserDefaultLabel")}
            />
            <div>
              <span>{t("contactUsLabel")}: </span>
              <Link
                aria-label={t("contactEmailAriaLabel")}
                className="font-medium text-white underline underline-offset-2 transition hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                href="mailto:support@sports-calendar.com"
              >
                support@sports-calendar.com
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
