"use client";

import { useTranslations } from "next-intl";

import { localizedDateLocale, type Locale } from "../lib/site";
import { useTimeZone } from "./time-zone-provider";

type LocalizedMatchTimeProps = {
  startsAt: string;
  locale: Locale;
  kickoffTimeTBD?: boolean;
  matchDate?: string;
  className?: string;
};

export function LocalizedMatchTime({
  startsAt,
  locale,
  kickoffTimeTBD,
  matchDate,
  className,
}: LocalizedMatchTimeProps) {
  const { timeZone } = useTimeZone();
  const t = useTranslations();

  // Without a published kickoff time there is nothing to convert: `startsAt` is
  // midnight in the source's zone, and putting that through the viewer's zone
  // would both invent an hour and, east of the source, shift the match a day
  // forward. Show the published day and say the time isn't set yet.
  if (kickoffTimeTBD && matchDate) {
    return (
      <time dateTime={matchDate} className={className}>
        {`${formatMatchDay(matchDate, locale)} · ${t("kickoffTimeTBD")}`}
      </time>
    );
  }

  return (
    <time dateTime={startsAt} className={className} suppressHydrationWarning>
      {formatKickoff(startsAt, locale, timeZone)}
    </time>
  );
}

function formatKickoff(startsAt: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(localizedDateLocale(locale), {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

// Formatted in UTC on purpose: the value is a plain calendar day, so any zone
// offset would risk rendering the day before it.
function formatMatchDay(matchDate: string, locale: Locale) {
  return new Intl.DateTimeFormat(localizedDateLocale(locale), {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${matchDate}T00:00:00Z`));
}
