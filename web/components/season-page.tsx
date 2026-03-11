import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getAvailableYears, getLeaguesByYear, getSeasonPageData, matchLabel, type Match, type YearDirectory } from "../lib/catalog";
import { localizedDateLocale, locales, type Locale, toPath } from "../lib/site";
import { LanguageSwitcher } from "./language-switcher";
import { YearLeagueNav } from "./year-league-nav";

type SeasonPageProps = {
  locale: Locale;
  sportSlug: string;
  leagueSlug: string;
  seasonSlug: string;
};

type MonthSpec = {
  year: number;
  monthIndex: number;
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
  const monthSpecs = buildMonthSpecs(data.season.slug, data.season.matches);
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
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {monthSpecs.map((month) => (
                <MonthCalendar
                  key={`${month.year}-${month.monthIndex}`}
                  locale={locale}
                  matches={data.season.matches}
                  month={month}
                  timezone={data.season.timezone}
                  weekLabels={weekLabels}
                />
              ))}
            </div>
          </section>

          <InfoSection title={t("calendarDescriptionLabel")}>
            <p className="text-base leading-7 text-ink/75">{data.season.calendarDescription}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink/75">
              {data.season.matches.map((match) => (
                <li key={`summary-${match.id}`} className="rounded-2xl bg-white/35 px-4 py-3">
                  <span className="font-medium text-ink">{formatKickoff(match, locale, data.season.timezone)}</span>
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

function MonthCalendar({
  locale,
  matches,
  month,
  timezone,
  weekLabels,
}: {
  locale: Locale;
  matches: Match[];
  month: MonthSpec;
  timezone: string;
  weekLabels: string[];
}) {
  const monthLabel = new Intl.DateTimeFormat(localizedDateLocale(locale), {
    timeZone: "UTC",
    month: "long",
  }).format(new Date(Date.UTC(month.year, month.monthIndex, 1)));

  const days = buildCalendarCells(month.year, month.monthIndex);
  const dots = new Map<string, number>();
  for (const match of matches) {
    const parts = getDateParts(match.startsAt, timezone);
    if (parts.year === month.year && parts.monthIndex === month.monthIndex) {
      const key = `${parts.year}-${parts.monthIndex}-${parts.day}`;
      dots.set(key, (dots.get(key) ?? 0) + 1);
    }
  }

  return (
    <article className="rounded-3xl border border-ink/10 bg-white/35 px-4 py-3 backdrop-blur-sm">
      <h3 className="text-center text-sm text-ink">{monthLabel}</h3>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-[0.18em] text-ink/50">
        {weekLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-sm text-ink">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square rounded-2xl bg-white/15" />;
          }

          const key = `${month.year}-${month.monthIndex}-${day}`;
          const count = dots.get(key) ?? 0;

          return (
            <div
              key={key}
              className={`flex aspect-square flex-col items-center justify-center rounded-2xl ${count > 0 ? "bg-header text-white" : "bg-white/50"}`}
            >
              <span>{day}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function buildMonthSpecs(seasonSlug: string, matches: Match[]): MonthSpec[] {
  const range = seasonSlug.split("-");
  if (range.length === 1) {
    const year = Number(range[0]);
    return Array.from({ length: 12 }, (_, index) => ({ year, monthIndex: index }));
  }

  const firstMatch = matches[0] ? new Date(matches[0].startsAt) : new Date(Date.UTC(Number(range[0]), 7, 1));
  const startYear = firstMatch.getUTCFullYear();
  const startMonth = firstMatch.getUTCMonth();
  return Array.from({ length: 12 }, (_, index) => {
    const current = new Date(Date.UTC(startYear, startMonth + index, 1));
    return { year: current.getUTCFullYear(), monthIndex: current.getUTCMonth() };
  });
}

function buildCalendarCells(year: number, monthIndex: number) {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const cells: Array<number | null> = Array.from({ length: firstDay }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length < 42) {
    cells.push(null);
  }
  return cells;
}

function getDateParts(iso: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(new Date(iso));
  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const monthIndex = Number(parts.find((part) => part.type === "month")?.value ?? 1) - 1;
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 1);
  return { year, monthIndex, day };
}

function formatKickoff(match: Match, locale: Locale, timezone: string) {
  return new Intl.DateTimeFormat(localizedDateLocale(locale), {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(match.startsAt));
}

function formatDateOnly(iso: string, locale: Locale, timezone: string) {
  return new Intl.DateTimeFormat(localizedDateLocale(locale), {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
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