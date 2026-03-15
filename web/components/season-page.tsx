import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getLeagueSeasons, getLeagues, getSeasonPageData, getSeasonSubscriptionUrl, matchLabel } from "../lib/catalog";
import { locales, type Locale, toPath } from "../lib/site";
import { LanguageSwitcher } from "./language-switcher";
import { LeagueSeasonNav } from "./league-season-nav";
import { LocalizedMatchTime } from "./localized-match-time";
import { LocalizedMonthCalendars } from "./localized-month-calendars";

type SeasonPageProps = {
  locale: Locale;
  sportSlug: string;
  leagueSlug: string;
  seasonSlug: string;
};

export async function SeasonPage({ locale, sportSlug, leagueSlug, seasonSlug }: SeasonPageProps) {
  const data = await getSeasonPageData(sportSlug, leagueSlug, seasonSlug, locale);
  if (!data) {
    notFound();
  }

  const t = await getTranslations({ locale });
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toPath(entry, sportSlug, leagueSlug, seasonSlug)]),
  ) as Record<Locale, string>;
  const [directory, seasonsData] = await Promise.all([
    getLeagues(locale),
    getLeagueSeasons(sportSlug, leagueSlug, locale),
  ]);
  if (!seasonsData) {
    notFound();
  }

  const competitionLabel = t("competitionLabel");
  const seasonLabel = t("seasonLabel");
  const competitions = directory.items.flatMap((sport) =>
    sport.leagues.map((league) => ({
      key: `${sport.sportSlug}-${league.leagueSlug}`,
      name: league.leagueName,
      href: toPath(
        locale,
        sport.sportSlug,
        league.leagueSlug,
        league.defaultSeason?.slug ?? seasonSlug,
      ),
      active: sport.sportSlug === sportSlug && league.leagueSlug === leagueSlug,
    })),
  );
  const seasons = seasonsData.seasons.map((season) => ({
    key: season.slug,
    name: season.label,
    href: toPath(locale, sportSlug, leagueSlug, season.slug),
    active: season.slug === seasonSlug,
  }));
  const leagueName = data.league.name;
  const year = extractPrimaryYear(data.season.slug, data.season.label);
  const pageTitle = t("seasonTitle", { leagueName, year });
  const weekLabels = t.raw("weekDays") as string[];
  const subscriptionUrl = getSeasonSubscriptionUrl(sportSlug, leagueSlug, seasonSlug);

  return (
    <div>
      <header className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link className="block" href={toPath(locale)}>
            <span className="block text-sm text-white/58">{t("siteName")}</span>
            <span className="mt-1 block text-lg font-medium text-white">{pageTitle}</span>
          </Link>
          <LanguageSwitcher localePaths={localePaths} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="bg-aside px-5 py-6 text-ink sm:px-6 lg:rounded-l-panel lg:py-8">
          <LeagueSeasonNav
            competitionLabel={competitionLabel}
            competitions={competitions}
            seasonLabel={seasonLabel}
            seasons={seasons}
          />
        </aside>

        <section className="bg-panel px-5 py-6 text-ink sm:px-6 lg:rounded-r-panel lg:py-8">
          <section>
            <div className="mb-4 flex justify-end">
              <a
                href={subscriptionUrl}
                className="inline-flex items-center rounded-full bg-header px-4 py-2 text-sm font-medium text-white transition hover:bg-header/90"
              >
                {t("subscribeLabel")}
              </a>
            </div>
            <LocalizedMonthCalendars
              locale={locale}
              matches={data.season.matches}
              seasonSlug={data.season.slug}
              weekLabels={weekLabels}
            />
          </section>

          <InfoSection title={t("leagueCalendarLabel")}>
            <div className="space-y-4 text-sm text-ink/75">
              {data.season.groups.map((group, index) => (
                <details
                  key={group.key}
                  className="group w-full rounded-3xl bg-white/25 px-4 py-4"
                  open={index === 0}
                >
                  <summary className="flex w-full cursor-pointer list-none items-center text-sm font-medium text-ink">
                    <span className="flex items-center gap-3">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        className="h-4 w-4 shrink-0 text-ink/60 transition group-open:rotate-90"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 3.5L10.5 8L6 12.5" />
                      </svg>
                      <span>{group.label}</span>
                    </span>
                  </summary>
                  <ul className="mt-3 w-full space-y-2">
                    {group.matches.map((match) => (
                      <li key={`summary-${match.id}`} className="rounded-2xl bg-white/35 px-4 py-3">
                        <LocalizedMatchTime className="font-medium text-ink" startsAt={match.startsAt} locale={locale} />
                        <span className="mx-2 text-ink/45">/</span>
                        <span>{matchLabel(match)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </InfoSection>

          <InfoSection title={t("leagueDescriptionLabel")}>
            <p className="text-base leading-7 text-ink/75">{data.season.calendarDescription}</p>
          </InfoSection>

          <InfoSection title={t("dataSourceLabel")}>
            <p className="text-base leading-7 text-ink/75">{data.season.dataSourceNote}</p>
          </InfoSection>

          <InfoSection title={t("notesLabel")}>
            <p className="text-base leading-7 text-ink/75">{data.season.notes}</p>
          </InfoSection>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex flex-col gap-2 px-4 py-6 text-sm text-white/80 sm:px-6 lg:px-8">
          <span>{t("siteName")}</span>
          <span>{data.league.name} · {data.season.label}</span>
        </div>
      </footer>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 bg-transparent p-0">
      <h2 className="bg-aside px-5 py-3 text-sm font-medium text-ink/80">{title}</h2>
      <div className="px-5 pt-4">{children}</div>
    </section>
  );
}

function extractPrimaryYear(seasonSlug: string, seasonLabel: string): string {
  const slugMatch = seasonSlug.match(/\d{4}/);
  if (slugMatch) {
    return slugMatch[0];
  }

  const labelMatch = seasonLabel.match(/\d{4}/);
  if (labelMatch) {
    return labelMatch[0];
  }

  return seasonLabel;
}