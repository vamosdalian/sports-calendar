import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getAvailableYears, getLeaguesByYear, getSeasonPageData, matchLabel, type Match, type YearDirectory } from "../lib/catalog";
import { localizedDateLocale, locales, type Locale, toPath } from "../lib/site";
import { LanguageSwitcher } from "./language-switcher";
import { LocalizedMatchTime } from "./localized-match-time";
import { LocalizedMonthCalendars } from "./localized-month-calendars";
import { YearLeagueNav } from "./year-league-nav";

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

  const t = await getTranslations();
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toPath(entry, sportSlug, leagueSlug, seasonSlug)]),
  ) as Record<Locale, string>;
  const availableYears = await getAvailableYears();
  const primaryYear = Number(extractPrimaryYear(data.season.slug, data.season.label));
  const selectedYear = Number.isFinite(primaryYear) ? primaryYear : new Date().getFullYear();
  const yearNumbers = availableYears.length > 0 ? availableYears : [selectedYear];
  const yearOptions = yearNumbers.map((year) => String(year));
  const directories = await Promise.all(yearNumbers.map((year) => getLeaguesByYear(year, locale)));
  const directoriesByYear = Object.fromEntries(
    directories.map((directory) => [String(directory.year), directory]),
  ) as Record<string, YearDirectory>;
  const yearLabel = t("yearLabel");
  const competitionLabel = t("competitionLabel");
  const yearDestinations = buildYearDestinations(directoriesByYear, locale, data.sport.slug, data.league.slug);
  const competitions = buildCompetitionsForYear(directoriesByYear[String(selectedYear)], locale, sportSlug, leagueSlug);
  const leagueName = data.league.name;
  const year = extractPrimaryYear(data.season.slug, data.season.label);
  const pageTitle = t("seasonTitle", { leagueName, year });
  const weekLabels = t.raw("weekDays") as string[];

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
          <YearLeagueNav
            yearLabel={yearLabel}
            competitionLabel={competitionLabel}
            yearOptions={yearOptions}
            selectedYear={String(selectedYear)}
            yearDestinations={yearDestinations}
            competitions={competitions}
          />
        </aside>

        <section className="bg-panel px-5 py-6 text-ink sm:px-6 lg:rounded-r-panel lg:py-8">
          <section>
            <LocalizedMonthCalendars
              locale={locale}
              matches={data.season.matches}
              seasonSlug={data.season.slug}
              weekLabels={weekLabels}
            />
          </section>

          <InfoSection title={t("calendarDescriptionLabel")}>
            <p className="text-base leading-7 text-ink/75">{data.season.calendarDescription}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink/75">
              {data.season.matches.map((match) => (
                <li key={`summary-${match.id}`} className="rounded-2xl bg-white/35 px-4 py-3">
                  <LocalizedMatchTime className="font-medium text-ink" startsAt={match.startsAt} locale={locale} />
                  <span className="mx-2 text-ink/45">/</span>
                  <span>{matchLabel(match)}</span>
                </li>
              ))}
            </ul>
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

function buildCompetitionsForYear(
  directory: YearDirectory | undefined,
  locale: Locale,
  currentSportSlug: string,
  currentLeagueSlug: string,
) {
  const result: Array<{ key: string; name: string; href: string; active: boolean }> = [];

  if (!directory) {
    return result;
  }

  for (const sport of directory.items) {
    for (const league of sport.leagues) {
      const season = league.seasons[0];
      if (!season) {
        continue;
      }
      result.push({
        key: `${sport.sportSlug}-${league.leagueSlug}`,
        name: league.leagueName,
        href: toPath(locale, sport.sportSlug, league.leagueSlug, season.slug),
        active: sport.sportSlug === currentSportSlug && league.leagueSlug === currentLeagueSlug,
      });
    }
  }

  return result;
}

function buildYearDestinations(
  directoriesByYear: Record<string, YearDirectory>,
  locale: Locale,
  currentSportSlug: string,
  currentLeagueSlug: string,
) {
  const destinations: Record<string, string> = {};
  const yearOptions = Object.keys(directoriesByYear).sort((left, right) => right.localeCompare(left));

  for (const year of yearOptions) {
    const directory = directoriesByYear[year];
    const currentLeague = directory.items
      .flatMap((sport) => sport.leagues.map((league) => ({ sportSlug: sport.sportSlug, league })))
      .find((item) => item.sportSlug === currentSportSlug && item.league.leagueSlug === currentLeagueSlug);
    const currentSeason = currentLeague?.league.seasons[0];
    if (currentSeason && currentLeague) {
      destinations[year] = toPath(locale, currentLeague.sportSlug, currentLeague.league.leagueSlug, currentSeason.slug);
      continue;
    }

    const firstAvailable = directory.items
      .flatMap((sport) =>
        sport.leagues.map((league) => {
          const season = league.seasons[0];
          if (!season) {
            return null;
          }
          return { sportSlug: sport.sportSlug, leagueSlug: league.leagueSlug, seasonSlug: season.slug };
        }),
      )
      .find((entry) => entry !== null);

    if (firstAvailable) {
      destinations[year] = toPath(locale, firstAvailable.sportSlug, firstAvailable.leagueSlug, firstAvailable.seasonSlug);
    }
  }

  return destinations;
}