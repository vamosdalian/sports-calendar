"use client";

import { localizedDateLocale, type Locale } from "../lib/site";
import { useTimeZone } from "./time-zone-provider";

type LocalizedMatchTimeProps = {
  startsAt: string;
  locale: Locale;
  className?: string;
};

export function LocalizedMatchTime({ startsAt, locale, className }: LocalizedMatchTimeProps) {
  const { timeZone } = useTimeZone();

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
