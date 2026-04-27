"use client";

import { useMemo } from "react";

import { tzStrings } from "../lib/timezone";
import { useTimeZone } from "./time-zone-provider";

type TimeZoneSelectorProps = {
  browserDefaultLabel: string;
};

export function TimeZoneSelector({ browserDefaultLabel }: TimeZoneSelectorProps) {
  const { timeZone, browserTimeZone, setTimeZone } = useTimeZone();
  const options = useMemo(() => {
    const baseOptions = [...tzStrings];
    if (!baseOptions.some((zone) => zone.value === browserTimeZone)) {
      baseOptions.unshift({
        label: `${browserDefaultLabel} (${browserTimeZone})`,
        value: browserTimeZone,
      });
    }
    if (!baseOptions.some((zone) => zone.value === timeZone)) {
      baseOptions.unshift({
        label: timeZone,
        value: timeZone,
      });
    }
    return baseOptions;
  }, [browserDefaultLabel, browserTimeZone, timeZone]);

  return (
    <div className="w-full max-w-[240px] md:ml-auto">
      <select
        aria-label="Time zone"
        className="h-8 w-full rounded-md border border-white/25 bg-header px-2 text-xs text-white/80 outline-none transition focus:border-white/35"
        onChange={(event) => {
          setTimeZone(event.target.value);
        }}
        value={timeZone}
      >
        {options.map((zone) => (
          <option key={zone.value} className="text-ink" value={zone.value}>
            {zone.value === browserTimeZone && !zone.label.startsWith(browserDefaultLabel)
              ? `${browserDefaultLabel} · ${zone.label}`
              : zone.label}
          </option>
        ))}
      </select>
    </div>
  );
}
