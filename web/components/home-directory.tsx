import Link from "next/link";

import { getDictionary } from "../lib/dictionaries";
import { getHomeEntries, pickLocalized } from "../lib/catalog";
import { type Locale, toPath } from "../lib/site";

type HomeDirectoryProps = {
  locale: Locale;
};

export async function HomeDirectory({ locale }: HomeDirectoryProps) {
  const dictionary = getDictionary(locale);
  const catalog = await getHomeEntries();

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-panel bg-white px-6 py-8 shadow-panel sm:px-10">
        <p className="mb-3 text-sm uppercase tracking-[0.35em] text-header/60">{dictionary.siteName}</p>
        <h1 className="max-w-3xl font-serif text-4xl text-ink sm:text-5xl">{dictionary.homeTitle}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">{dictionary.homeLead}</p>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        {catalog.sports.map((sport) => (
          <article key={sport.slug} className="rounded-panel bg-white px-6 py-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.3em] text-header/50">{pickLocalized(sport.names, locale)}</p>
            <h2 className="mt-2 font-serif text-3xl text-ink">{pickLocalized(sport.names, locale)}</h2>
            <div className="mt-6 space-y-4">
              {sport.leagues.map((league) => (
                <div key={league.slug} className="rounded-3xl border border-line bg-shell/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-ink">{pickLocalized(league.names, locale)}</h3>
                      <p className="text-sm text-ink/60">{pickLocalized(league.countryNames, locale)}</p>
                    </div>
                    <span className="rounded-full bg-header px-3 py-1 text-xs uppercase tracking-[0.25em] text-white">
                      {league.slug}
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {league.seasons.map((season) => (
                      <li key={season.slug} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                        <span className="text-sm font-medium text-ink">{season.label}</span>
                        <Link
                          className="rounded-full bg-header px-4 py-2 text-sm font-semibold text-white transition hover:bg-header/90"
                          href={toPath(locale, sport.slug, league.slug, season.slug)}
                        >
                          {dictionary.viewSeason}
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