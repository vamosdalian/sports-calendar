"use client";

import { useEffect, useState } from "react";

import { type Match } from "../lib/catalog";
import { localizedDateLocale, type Locale } from "../lib/site";

const SERVER_TIME_ZONE = "UTC";

type MonthSpec = {
  year: number;
  monthIndex: number;
};

type LocalizedMonthCalendarsProps = {
  locale: Locale;
  matches: Match[];
  seasonSlug: string;
  weekLabels: string[];
};

export function LocalizedMonthCalendars({ locale, matches, seasonSlug, weekLabels }: LocalizedMonthCalendarsProps) {
  const [timeZone, setTimeZone] = useState(SERVER_TIME_ZONE);

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimeZone && browserTimeZone !== SERVER_TIME_ZONE) {
      setTimeZone(browserTimeZone);
    }
  }, []);

  const monthSpecs = buildMonthSpecs(seasonSlug, matches, timeZone);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {monthSpecs.map((month) => (
        <MonthCalendar
          key={`${month.year}-${month.monthIndex}`}
          locale={locale}
          matches={matches}
          month={month}
          timeZone={timeZone}
          weekLabels={weekLabels}
        />
      ))}
    </div>
  );
}

function MonthCalendar({
  locale,
  matches,
  month,
  timeZone,
  weekLabels,
}: {
  locale: Locale;
  matches: Match[];
  month: MonthSpec;
  timeZone: string;
  weekLabels: string[];
}) {
  const monthLabel = new Intl.DateTimeFormat(localizedDateLocale(locale), {
    timeZone,
    month: "long",
  }).format(new Date(Date.UTC(month.year, month.monthIndex, 1)));

  const days = buildCalendarCells(month.year, month.monthIndex);
  const matchesByDay = new Map<string, Match[]>();
  for (const match of matches) {
    const parts = getDateParts(match.startsAt, timeZone);
    if (parts.year === month.year && parts.monthIndex === month.monthIndex) {
      const key = `${parts.year}-${parts.monthIndex}-${parts.day}`;
      const existing = matchesByDay.get(key) ?? [];
      existing.push(match);
      matchesByDay.set(key, existing);
    }
  }

  return (
    <article className="relative z-0 rounded-3xl border border-ink/10 bg-white/35 px-4 py-3 backdrop-blur-sm hover:z-40">
      <h3 className="text-center text-sm text-ink" suppressHydrationWarning>
        {monthLabel}
      </h3>
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
          const dayMatches = matchesByDay.get(key) ?? [];
          const count = dayMatches.length;

          return (
            <div
              key={key}
              className={`group relative flex aspect-square select-none flex-col items-center justify-center rounded-2xl cursor-default ${count > 0 ? "bg-header text-white" : "bg-white/50"}`}
            >
              <span>{day}</span>
              {dayMatches.length > 0 ? (
                <div className="pointer-events-none absolute left-1/2 top-full z-[120] mt-2 hidden w-64 -translate-x-1/2 rounded-2xl bg-header px-3 py-2 text-left text-xs text-white shadow-lg group-hover:block">
                  <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-header" />
                  <ul className="space-y-1.5">
                    {dayMatches.map((match) => (
                      <li key={`tooltip-${match.id}`} className="truncate whitespace-nowrap leading-5">
                        <span className="font-medium">{formatTooltipTime(match.startsAt, locale, timeZone)}</span>
                        <span className="text-white/75"> · </span>
                        <span>{formatTooltipMatchLabel(match)}</span>
                        {match.venue ? (
                          <>
                            <span className="text-white/75"> / </span>
                            <span className="text-white/85">{match.venue}</span>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function buildMonthSpecs(seasonSlug: string, matches: Match[], timeZone: string): MonthSpec[] {
  const range = seasonSlug.split("-");
  if (range.length === 1) {
    const year = Number(range[0]);
    return Array.from({ length: 12 }, (_, index) => ({ year, monthIndex: index }));
  }

  const startYear = Number(range[0]);
  const endYear = Number(range[1]);
  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return Array.from({ length: 12 }, (_, index) => {
      const current = new Date(Date.UTC(startYear, 6 + index, 1));
      return { year: current.getUTCFullYear(), monthIndex: current.getUTCMonth() };
    });
  }

  const firstMatch = matches[0] ? getDateParts(matches[0].startsAt, timeZone) : null;
  const fallbackStartYear = firstMatch?.year ?? new Date().getUTCFullYear();
  const fallbackStartMonth = firstMatch?.monthIndex ?? 6;

  return Array.from({ length: 12 }, (_, index) => {
    const current = new Date(Date.UTC(fallbackStartYear, fallbackStartMonth + index, 1));
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

function getDateParts(iso: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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

function formatTooltipTime(startsAt: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(localizedDateLocale(locale), {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

function formatTooltipMatchLabel(match: Match) {
  if (match.homeTeam && match.awayTeam) {
    return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  }

  return match.title || match.id;
}