import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getLeagueSeasons, getLeagues, getSeasonFeedUrl, getSeasonPageData, getSeasonSubscriptionUrl, type Match } from "../lib/catalog";
import { locales, type Locale, toPath } from "../lib/site";
import { LanguageSwitcher } from "./language-switcher";
import { LeagueSeasonNav } from "./league-season-nav";
import { SeasonCalendarContent } from "./season-calendar-content";

type SeasonPageProps = {
  locale: Locale;
  sportSlug: string;
  leagueSlug: string;
  seasonSlug: string;
};

export async function SeasonPage({ locale, sportSlug, leagueSlug, seasonSlug }: SeasonPageProps) {
  const data = await getSeasonPageData(sportSlug, leagueSlug, seasonSlug, locale);
  if (!data) {
    notFound();
  }

  const t = await getTranslations({ locale });
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toPath(entry, sportSlug, leagueSlug, seasonSlug)]),
  ) as Record<Locale, string>;
  const [directory, seasonsData] = await Promise.all([
    getLeagues(locale),
    getLeagueSeasons(sportSlug, leagueSlug, locale),
  ]);
  if (!seasonsData) {
    notFound();
  }

  const competitionLabel = t("competitionLabel");
  const seasonLabel = t("seasonLabel");
  const competitions = directory.items.flatMap((sport) =>
    sport.leagues.map((league) => ({
      key: `${sport.sportSlug}-${league.leagueSlug}`,
      name: league.leagueName,
      href: toPath(
        locale,
        sport.sportSlug,
        league.leagueSlug,
        league.defaultSeason?.slug ?? seasonSlug,
      ),
      active: sport.sportSlug === sportSlug && league.leagueSlug === leagueSlug,
    })),
  );
  const seasons = seasonsData.seasons.map((season) => ({
    key: season.slug,
    name: season.label,
    href: toPath(locale, sportSlug, leagueSlug, season.slug),
    active: season.slug === seasonSlug,
  }));
  const leagueName = data.league.name;
  const year = extractPrimaryYear(data.season.slug, data.season.label);
  const pageTitle = t("seasonTitle", { leagueName, year });
  const weekLabels = t.raw("weekDays") as string[];
  const subscriptionUrl = getSeasonSubscriptionUrl(sportSlug, leagueSlug, seasonSlug, { locale });
  const subscriptionCopyUrl = getSeasonFeedUrl(sportSlug, leagueSlug, seasonSlug, { locale });
  const teamOptions = buildTeamOptions(data.season.matches, locale);

  return (
    <div>
      <header className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link className="block" href={toPath(locale)}>
            <span className="block text-sm text-white/58">{t("siteName")}</span>
            <span className="mt-1 block text-lg font-medium text-white">{pageTitle}</span>
          </Link>
          <LanguageSwitcher localePaths={localePaths} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="bg-aside px-5 py-6 text-ink sm:px-6 lg:rounded-l-panel lg:py-8">
          <LeagueSeasonNav
            competitionLabel={competitionLabel}
            competitions={competitions}
            seasonLabel={seasonLabel}
            seasons={seasons}
          />
        </aside>

        <section className="bg-panel px-5 py-6 text-ink sm:px-6 lg:rounded-r-panel lg:py-8">
          <SeasonCalendarContent
            allTeamsLabel={t("allTeamsLabel")}
            leagueCalendarLabel={t("leagueCalendarLabel")}
            locale={locale}
            matches={data.season.matches}
            noMatchesLabel={t("noMatches")}
            copySubscriptionLinkLabel={t("copySubscriptionLinkLabel")}
            seasonSlug={data.season.slug}
            subscribeLabel={t("subscribeLabel")}
            subscriptionBaseUrl={subscriptionUrl}
            subscriptionCopyBaseUrl={subscriptionCopyUrl}
            subscriptionLinkCopiedLabel={t("subscriptionLinkCopiedLabel")}
            teamFilterLabel={t("teamFilterLabel")}
            teamOptions={teamOptions}
            weekLabels={weekLabels}
          />

          <InfoSection title={t("leagueDescriptionLabel")}>
            <p className="text-base leading-7 text-ink/75">{data.season.calendarDescription}</p>
          </InfoSection>

          <InfoSection title={t("dataSourceLabel")}>
            <p className="text-base leading-7 text-ink/75">{data.season.dataSourceNote}</p>
          </InfoSection>

          <InfoSection title={t("notesLabel")}>
            <p className="text-base leading-7 text-ink/75">{data.season.notes}</p>
          </InfoSection>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex flex-col gap-2 px-4 py-6 text-sm text-white/80 sm:px-6 lg:px-8">
          <span>{t("siteName")}</span>
          <span>{data.league.name} · {data.season.label}</span>
        </div>
      </footer>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 bg-transparent p-0">
      <h2 className="bg-aside px-5 py-3 text-sm font-medium text-ink/80">{title}</h2>
      <div className="px-5 pt-4">{children}</div>
    </section>
  );
}

function extractPrimaryYear(seasonSlug: string, seasonLabel: string): string {
  const slugMatch = seasonSlug.match(/\d{4}/);
  if (slugMatch) {
    return slugMatch[0];
  }

  const labelMatch = seasonLabel.match(/\d{4}/);
  if (labelMatch) {
    return labelMatch[0];
  }

  return seasonLabel;
}

function buildTeamOptions(matches: Match[], locale: Locale) {
  const teamsBySlug = new Map<string, string>();

  for (const match of matches) {
    if (match.homeTeam?.slug && match.homeTeam.name) {
      teamsBySlug.set(match.homeTeam.slug, match.homeTeam.name);
    }
    if (match.awayTeam?.slug && match.awayTeam.name) {
      teamsBySlug.set(match.awayTeam.slug, match.awayTeam.name);
    }
  }

  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return Array.from(teamsBySlug.entries(), ([slug, name]) => ({ slug, name })).sort((left, right) =>
    collator.compare(left.name, right.name),
  );
}