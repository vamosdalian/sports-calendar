"use client";

import { useState } from "react";

import { Menu, X } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);

  const activeCompetition = competitions.find((c) => c.active);
  const activeSeason = seasons.find((s) => s.active);

  return (
    <div>
      {/* 手机端：收起时显示两个当前项按钮 + 展开按钮 */}
      {!expanded && (
        <div className="flex items-center gap-2 lg:hidden">
          {activeCompetition && (
            <Link
              href={activeCompetition.href}
              className="min-w-0 flex-1 truncate border border-header bg-header px-3 py-2 text-sm text-white"
            >
              {activeCompetition.name}
            </Link>
          )}
          {activeSeason && (
            <Link
              href={activeSeason.href}
              className="min-w-0 flex-1 truncate border border-header bg-header px-3 py-2 text-sm text-white"
            >
              {activeSeason.name}
            </Link>
          )}
          <button
            onClick={() => setExpanded(true)}
            className="flex-shrink-0 rounded-md p-1.5 text-ink/70 transition hover:bg-white/30 hover:text-ink"
            aria-label="展开导航"
          >
            <Menu size={20} />
          </button>
        </div>
      )}

      {/* 手机端展开的完整列表 */}
      {expanded && (
        <div className="lg:hidden">
          <div className="flex justify-end">
            <button
              onClick={() => setExpanded(false)}
              className="rounded-md p-1.5 text-ink/70 transition hover:bg-white/30 hover:text-ink"
              aria-label="收起导航"
            >
              <X size={20} />
            </button>
          </div>
          <NavSections
            competitionLabel={competitionLabel}
            competitions={competitions}
            seasonLabel={seasonLabel}
            seasons={seasons}
          />
        </div>
      )}

      {/* 桌面端始终显示完整列表 */}
      <div className="hidden lg:block">
        <NavSections
          competitionLabel={competitionLabel}
          competitions={competitions}
          seasonLabel={seasonLabel}
          seasons={seasons}
        />
      </div>
    </div>
  );
}

function NavSections({
  competitionLabel,
  competitions,
  seasonLabel,
  seasons,
}: LeagueSeasonNavProps) {
  return (
    <>
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
    </>
  );
}
