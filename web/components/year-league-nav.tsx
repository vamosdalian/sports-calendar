"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type CompetitionItem = {
  key: string;
  name: string;
  href: string;
  active: boolean;
};

type YearLeagueNavProps = {
  yearLabel: string;
  competitionLabel: string;
  yearOptions: string[];
  selectedYear: string;
  yearDestinations: Record<string, string>;
  competitions: CompetitionItem[];
};

export function YearLeagueNav({
  yearLabel,
  competitionLabel,
  yearOptions,
  selectedYear,
  yearDestinations,
  competitions,
}: YearLeagueNavProps) {
  const router = useRouter();

  return (
    <div>
      <section className="mt-2">
        <label className="mb-2 block text-sm font-medium text-ink/70">{yearLabel}</label>
        <select
          aria-label={yearLabel}
          className="w-full border border-white/40 bg-white/25 px-3 py-2 text-sm text-ink"
          defaultValue={selectedYear}
          onChange={(event) => {
            const target = yearDestinations[event.target.value];
            if (target) {
              router.push(target);
            }
          }}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </section>

      <section className="mt-6">
        <p className="mb-2 text-sm font-medium text-ink/70">{competitionLabel}</p>
        <div className="space-y-2">
          {competitions.map((competition) => (
            <Link
              key={competition.key}
              href={competition.href}
              className={`block border px-3 py-2 text-sm transition ${
                competition.active
                  ? "border-header bg-header text-white"
                  : "border-white/40 bg-white/25 text-ink hover:bg-white/35"
              }`}
            >
              {competition.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}