import { promises as fs } from "fs";
import path from "path";

import { defaultLocale, type Locale } from "./site";

export type LocalizedText = Record<string, string>;

export type Team = {
  slug: string;
  names: LocalizedText;
};

export type Ticket = {
  openAt?: string;
  url?: string;
  channelNames?: LocalizedText;
};

export type Match = {
  id: string;
  round: string;
  title?: LocalizedText;
  startsAt: string;
  status: string;
  venue: string;
  city: string;
  homeTeam?: Team;
  awayTeam?: Team;
  ticket?: Ticket;
};

export type Season = {
  slug: string;
  label: string;
  timezone: string;
  defaultMatchDurationMinutes: number;
  calendarDescription: LocalizedText;
  dataSourceNote: LocalizedText;
  notes: LocalizedText;
  matches: Match[];
};

export type League = {
  slug: string;
  names: LocalizedText;
  countryNames: LocalizedText;
  seasons: Season[];
};

export type Sport = {
  slug: string;
  names: LocalizedText;
  leagues: League[];
};

export type Catalog = {
  updatedAt: string;
  sports: Sport[];
};

export type SeasonPageData = {
  updatedAt: string;
  sport: Sport;
  league: League;
  season: Season;
};

const catalogPath = path.join(process.cwd(), "..", "shared", "mock", "catalog.json");

export async function readCatalog(): Promise<Catalog> {
  const content = await fs.readFile(catalogPath, "utf8");
  return JSON.parse(content) as Catalog;
}

export async function getHomeEntries() {
  const catalog = await readCatalog();
  return catalog;
}

export async function getSeasonPageData(
  sportSlug: string,
  leagueSlug: string,
  seasonSlug: string,
): Promise<SeasonPageData | null> {
  const catalog = await readCatalog();
  const sport = catalog.sports.find((entry) => entry.slug === sportSlug);
  if (!sport) {
    return null;
  }

  const league = sport.leagues.find((entry) => entry.slug === leagueSlug);
  if (!league) {
    return null;
  }

  const season = league.seasons.find((entry) => entry.slug === seasonSlug);
  if (!season) {
    return null;
  }

  return {
    updatedAt: catalog.updatedAt,
    sport,
    league,
    season: {
      ...season,
      matches: [...season.matches].sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    },
  };
}

export async function getAllSeasonRoutes() {
  const catalog = await readCatalog();
  return catalog.sports.flatMap((sport) =>
    sport.leagues.flatMap((league) =>
      league.seasons.map((season) => ({
        sport: sport.slug,
        league: league.slug,
        season: season.slug,
      })),
    ),
  );
}

export function pickLocalized(value: LocalizedText | undefined, locale: Locale): string {
  if (!value) {
    return "";
  }
  return value[locale] ?? value[defaultLocale] ?? Object.values(value)[0] ?? "";
}

export function matchLabel(match: Match, locale: Locale) {
  if (match.title) {
    return pickLocalized(match.title, locale);
  }
  if (match.homeTeam && match.awayTeam) {
    return `${pickLocalized(match.homeTeam.names, locale)} vs ${pickLocalized(match.awayTeam.names, locale)}`;
  }
  return match.id;
}

export function statusLabel(status: string, locale: Locale) {
  if (status === "finished") {
    return locale === "zh" ? "已结束" : "Finished";
  }
  if (status === "scheduled") {
    return locale === "zh" ? "已排期" : "Scheduled";
  }
  return status;
}