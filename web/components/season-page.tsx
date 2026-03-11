import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary } from "../lib/dictionaries";
import { getSeasonPageData, matchLabel, pickLocalized, statusLabel, type Match } from "../lib/catalog";
import { localizedDateLocale, type Locale, toPath } from "../lib/site";
import { LanguageSwitcher } from "./language-switcher";

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

      <main className="mx-auto w-full max-w-[1200px] grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="bg-aside px-5 py-6 text-ink sm:px-6 lg:rounded-l-panel lg:py-8">
          <div className="rounded-3xl border border-white/40 bg-white/25 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-ink/60">{pickLocalized(data.sport.names, locale)}</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight">{pickLocalized(data.league.names, locale)}</h1>
            <p className="mt-3 text-sm text-ink/70">{pickLocalized(data.league.countryNames, locale)}</p>
          </div>

          <section className="mt-6">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
              {dictionary.seasonLabel}
            </label>
            <div className="grid gap-2">
              {data.league.seasons.map((season) => {
                const href = toPath(locale, data.sport.slug, data.league.slug, season.slug);
                const active = season.slug === data.season.slug;

                return (
                  <Link
                    key={season.slug}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-ink bg-white text-ink shadow-sm"
                        : "border-white/40 bg-white/20 text-ink/80 hover:bg-white/35"
                    }`}
                    href={href}
                  >
                    {season.label}
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">{dictionary.matchesLabel}</h2>
            <div className="mt-3 space-y-3">
              {data.season.matches.length === 0 ? (
                <p className="rounded-3xl bg-white/25 p-4 text-sm text-ink/70">{dictionary.noMatches}</p>
              ) : (
                data.season.matches.map((match) => (
                  <article key={match.id} className="rounded-3xl border border-white/40 bg-white/25 p-4 backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink/55">{match.round}</p>
                    <h3 className="mt-2 text-lg font-semibold leading-6 text-ink">{matchLabel(match, locale)}</h3>
                    <p className="mt-2 text-sm text-ink/70">{formatKickoff(match, locale, data.season.timezone)}</p>
                    <p className="mt-1 text-sm text-ink/70">{dictionary.venueLabel}: {match.venue}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-ink/55">
                      <span>{statusLabel(match.status, locale)}</span>
                      <span>{match.city}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
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

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
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
    <section className="mt-6 rounded-3xl border border-ink/10 bg-white/28 p-5 backdrop-blur-sm">
      <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/55">{title}</h2>
      <div className="mt-4">{children}</div>
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
    year: "numeric",
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
      <h3 className="font-serif text-xl text-ink">{monthLabel}</h3>
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
              <span className="mt-1 text-[10px] opacity-80">{count > 0 ? count : ""}</span>
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