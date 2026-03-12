"use client";

import { useEffect, useState } from "react";

import { localizedDateLocale, type Locale } from "../lib/site";

const SERVER_TIME_ZONE = "UTC";

type LocalizedMatchTimeProps = {
  startsAt: string;
  locale: Locale;
  className?: string;
};

export function LocalizedMatchTime({ startsAt, locale, className }: LocalizedMatchTimeProps) {
  const [timeZone, setTimeZone] = useState(SERVER_TIME_ZONE);

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimeZone && browserTimeZone !== SERVER_TIME_ZONE) {
      setTimeZone(browserTimeZone);
    }
  }, []);

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