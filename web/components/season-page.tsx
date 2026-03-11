import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary } from "../lib/dictionaries";
import { getHomeEntries, getSeasonPageData, matchLabel, pickLocalized, type Match } from "../lib/catalog";
import { localizedDateLocale, type Locale, toPath } from "../lib/site";
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
  const data = await getSeasonPageData(sportSlug, leagueSlug, seasonSlug);
  if (!data) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const alternateLocale: Locale = locale === "en" ? "zh" : "en";
  const alternatePath = toPath(alternateLocale, sportSlug, leagueSlug, seasonSlug);
  const monthSpecs = buildMonthSpecs(data.season.slug, data.season.matches);
  const dateLocale = localizedDateLocale(locale);
  const updatedAt = new Date(data.updatedAt).toLocaleDateString(dateLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const catalog = await getHomeEntries();
  const yearOptions = collectSeasonSlugs(catalog);
  const selectedYear = data.season.slug;
  const yearLabel = locale === "zh" ? "年份" : "Year";
  const competitionLabel = locale === "zh" ? "赛事" : "Competitions";
  const yearDestinations = buildYearDestinations(catalog, locale, data.sport.slug, data.league.slug);
  const competitions = buildCompetitionsForYear(catalog, locale, selectedYear, sportSlug, leagueSlug);

  return (
    <div>
      <header className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link className="font-serif text-2xl tracking-tight" href={toPath(locale)}>
            {dictionary.siteName}
          </Link>
          <LanguageSwitcher currentLocale={locale} alternatePath={alternatePath} label={dictionary.languageLabel} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="bg-aside px-5 py-6 text-ink sm:px-6 lg:rounded-l-panel lg:py-8">
          <YearLeagueNav
            yearLabel={yearLabel}
            competitionLabel={competitionLabel}
            yearOptions={yearOptions}
            selectedYear={selectedYear}
            yearDestinations={yearDestinations}
            competitions={competitions}
          />
        </aside>

        <section className="bg-panel px-5 py-6 text-ink sm:px-6 lg:rounded-r-panel lg:py-8">
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ink/55">{dictionary.calendarLabel}</p>
                <h2 className="mt-2 font-serif text-3xl leading-tight">{data.season.label}</h2>
              </div>
              <p className="text-sm text-ink/60">{dictionary.updatedAtLabel}: {updatedAt}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {monthSpecs.map((month) => (
                <MonthCalendar
                  key={`${month.year}-${month.monthIndex}`}
                  locale={locale}
                  matches={data.season.matches}
                  month={month}
                  timezone={data.season.timezone}
                />
              ))}
            </div>
          </section>

          <InfoSection title={dictionary.calendarDescriptionLabel}>
            <p className="text-base leading-7 text-ink/75">{pickLocalized(data.season.calendarDescription, locale)}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink/75">
              {data.season.matches.map((match) => (
                <li key={`summary-${match.id}`} className="rounded-2xl bg-white/35 px-4 py-3">
                  <span className="font-semibold text-ink">{formatKickoff(match, locale, data.season.timezone)}</span>
                  <span className="mx-2 text-ink/45">/</span>
                  <span>{matchLabel(match, locale)}</span>
                </li>
              ))}
            </ul>
          </InfoSection>

          <InfoSection title={dictionary.dataSourceLabel}>
            <p className="text-base leading-7 text-ink/75">{pickLocalized(data.season.dataSourceNote, locale)}</p>
          </InfoSection>

          <InfoSection title={dictionary.notesLabel}>
            <p className="text-base leading-7 text-ink/75">{pickLocalized(data.season.notes, locale)}</p>
          </InfoSection>

          <InfoSection title={dictionary.allMatchesLabel}>
            <div className="grid gap-3">
              {data.season.matches.map((match) => (
                <div key={`detail-${match.id}`} className="rounded-3xl border border-ink/10 bg-white/35 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-ink">{matchLabel(match, locale)}</h3>
                    <span className="rounded-full bg-header px-3 py-1 text-xs uppercase tracking-[0.24em] text-white">
                      {match.round}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink/75">{formatKickoff(match, locale, data.season.timezone)}</p>
                  <p className="mt-1 text-sm text-ink/75">{dictionary.venueLabel}: {match.venue}</p>
                  <p className="mt-1 text-sm text-ink/75">{dictionary.cityLabel}: {match.city}</p>
                  {match.ticket?.openAt ? (
                    <p className="mt-1 text-sm text-ink/75">
                      {dictionary.ticketOpenLabel}: {formatDateOnly(match.ticket.openAt, locale, data.season.timezone)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </InfoSection>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex flex-col gap-2 px-4 py-6 text-sm text-white/80 sm:px-6 lg:px-8">
          <span>{dictionary.siteName}</span>
          <span>{pickLocalized(data.league.names, locale)} · {data.season.label}</span>
        </div>
      </footer>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 bg-transparent p-0">
      <h2 className="bg-aside px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-ink/75">{title}</h2>
      <div className="px-5 pt-4">{children}</div>
    </section>
  );
}

function MonthCalendar({
  locale,
  matches,
  month,
  timezone,
}: {
  locale: Locale;
  matches: Match[];
  month: MonthSpec;
  timezone: string;
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

  const weekLabels = locale === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <article className="rounded-3xl border border-ink/10 bg-white/35 p-4 backdrop-blur-sm">
      <h3 className="text-center text-base text-ink">{monthLabel}</h3>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-[0.18em] text-ink/50">
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

function collectSeasonSlugs(catalog: Awaited<ReturnType<typeof getHomeEntries>>) {
  const values = new Set<string>();
  for (const sport of catalog.sports) {
    for (const league of sport.leagues) {
      for (const season of league.seasons) {
        values.add(season.slug);
      }
    }
  }
  return Array.from(values).sort((left, right) => right.localeCompare(left));
}

function buildCompetitionsForYear(
  catalog: Awaited<ReturnType<typeof getHomeEntries>>,
  locale: Locale,
  yearSlug: string,
  currentSportSlug: string,
  currentLeagueSlug: string,
) {
  const result: Array<{ key: string; name: string; href: string; active: boolean }> = [];

  for (const sport of catalog.sports) {
    for (const league of sport.leagues) {
      const season = league.seasons.find((entry) => entry.slug === yearSlug);
      if (!season) {
        continue;
      }

      result.push({
        key: `${sport.slug}-${league.slug}`,
        name: pickLocalized(league.names, locale),
        href: toPath(locale, sport.slug, league.slug, season.slug),
        active: sport.slug === currentSportSlug && league.slug === currentLeagueSlug,
      });
    }
  }

  return result;
}

function buildYearDestinations(
  catalog: Awaited<ReturnType<typeof getHomeEntries>>,
  locale: Locale,
  currentSportSlug: string,
  currentLeagueSlug: string,
) {
  const destinations: Record<string, string> = {};
  const yearOptions = collectSeasonSlugs(catalog);

  const currentLeague = catalog.sports
    .flatMap((sport) => sport.leagues.map((league) => ({ sportSlug: sport.slug, league })))
    .find((item) => item.sportSlug === currentSportSlug && item.league.slug === currentLeagueSlug);

  for (const year of yearOptions) {
    const currentSeason = currentLeague?.league.seasons.find((season) => season.slug === year);
    if (currentSeason) {
      destinations[year] = toPath(locale, currentSportSlug, currentLeagueSlug, currentSeason.slug);
      continue;
    }

    const firstAvailable = catalog.sports
      .flatMap((sport) =>
        sport.leagues.map((league) => {
          const season = league.seasons.find((entry) => entry.slug === year);
          if (!season) {
            return null;
          }
          return { sportSlug: sport.slug, leagueSlug: league.slug, seasonSlug: season.slug };
        }),
      )
      .find((entry) => entry !== null);

    if (firstAvailable) {
      destinations[year] = toPath(locale, firstAvailable.sportSlug, firstAvailable.leagueSlug, firstAvailable.seasonSlug);
    }
  }

  return destinations;
}