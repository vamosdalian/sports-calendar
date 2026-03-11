import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getHomeEntries } from "../lib/catalog";
import { type Locale, toPath } from "../lib/site";

type HomeDirectoryProps = {
  locale: Locale;
};

export async function HomeDirectory({ locale }: HomeDirectoryProps) {
  const t = await getTranslations();
  const catalog = await getHomeEntries(locale);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-panel bg-white px-6 py-8 shadow-panel sm:px-10">
        <p className="mb-2 text-sm text-header/70">{t("siteName")}</p>
        <h1 className="max-w-3xl text-3xl font-medium text-ink sm:text-4xl">{t("homeTitle")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70 sm:text-base">{t("homeLead")}</p>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        {catalog.sports.map((sport) => (
          <article key={sport.slug} className="rounded-panel bg-white px-6 py-6 shadow-panel">
            <p className="text-xs text-header/60">{sport.name}</p>
            <h2 className="mt-2 text-2xl font-medium text-ink">{sport.name}</h2>
            <div className="mt-6 space-y-4">
              {sport.leagues.map((league) => (
                <div key={league.slug} className="rounded-3xl border border-line bg-shell/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-ink">{league.name}</h3>
                      <p className="text-sm text-ink/60">{league.countryName}</p>
                    </div>
                    <span className="rounded-full bg-header px-3 py-1 text-xs uppercase tracking-[0.25em] text-white">
                      {league.slug}
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {league.seasons.map((season) => (
                      <li key={season.slug} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                        <span className="text-sm text-ink">{season.label}</span>
                        <Link
                          className="rounded-full bg-header px-4 py-2 text-sm text-white transition hover:bg-header/90"
                          href={toPath(locale, sport.slug, league.slug, season.slug)}
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
    </main>
  );
}