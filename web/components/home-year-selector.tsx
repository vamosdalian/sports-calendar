"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type HomeYearSelectorProps = {
  years: number[];
  selectedYear: number;
};

export function HomeYearSelector({ years, selectedYear }: HomeYearSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      id="year-select"
      name="year"
      aria-label="Year selector"
      defaultValue={String(selectedYear)}
      className="border border-white/40 bg-white/25 px-3 py-2 text-sm text-ink"
      onChange={(event) => {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set("year", event.target.value);
        router.replace(`${pathname}?${nextParams.toString()}`);
      }}
    >
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
}