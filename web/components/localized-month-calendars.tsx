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
  const dots = new Map<string, number>();
  for (const match of matches) {
    const parts = getDateParts(match.startsAt, timeZone);
    if (parts.year === month.year && parts.monthIndex === month.monthIndex) {
      const key = `${parts.year}-${parts.monthIndex}-${parts.day}`;
      dots.set(key, (dots.get(key) ?? 0) + 1);
    }
  }

  return (
    <article className="rounded-3xl border border-ink/10 bg-white/35 px-4 py-3 backdrop-blur-sm">
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