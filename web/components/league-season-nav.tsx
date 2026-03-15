import Link from "next/link";

type NavItem = {
  key: string;
  name: string;
  href: string;
  active: boolean;
};

type LeagueSeasonNavProps = {
  competitionLabel: string;
  competitions: NavItem[];
  seasonLabel: string;
  seasons: NavItem[];
};

export function LeagueSeasonNav({
  competitionLabel,
  competitions,
  seasonLabel,
  seasons,
}: LeagueSeasonNavProps) {
  return (
    <div>
      <section className="mt-2">
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

      <section className="mt-6">
        <p className="mb-2 text-sm font-medium text-ink/70">{seasonLabel}</p>
        <div className="space-y-2">
          {seasons.map((season) => (
            <Link
              key={season.key}
              href={season.href}
              className={`block border px-3 py-2 text-sm transition ${
                season.active
                  ? "border-header bg-header text-white"
                  : "border-white/40 bg-white/25 text-ink hover:bg-white/35"
              }`}
            >
              {season.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
