import type { Locale } from "./site";

export type Team = {
  slug: string;
  name: string;
};

export type Ticket = {
  openAt?: string;
  url?: string;
  channelName?: string;
};

export type Match = {
  id: string;
  round: string;
  title?: string;
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
  calendarDescription: string;
  dataSourceNote: string;
  notes: string;
  matches: Match[];
};

export type SeasonReference = {
  slug: string;
  label: string;
};

export type League = {
  slug: string;
  name: string;
  countryName: string;
  seasons: SeasonReference[];
};

export type Sport = {
  slug: string;
  name: string;
  leagues: League[];
};

export type Catalog = {
  updatedAt: string;
  sports: Sport[];
};

export type SeasonPageData = {
  updatedAt: string;
  sport: {
    slug: string;
    name: string;
  };
  league: {
    slug: string;
    name: string;
    countryName: string;
  };
  season: Season;
};

const apiBaseUrl = process.env.SPORTS_CALENDAR_API_BASE_URL ?? "http://localhost:8080";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText} (${path})`);
  }

  return (await response.json()) as T;
}

async function fetchSeasonDetail(path: string): Promise<SeasonDetailResponse | null> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText} (${path})`);
  }

  return (await response.json()) as SeasonDetailResponse;
}

type CatalogResponse = {
  updatedAt: string;
  sports: Sport[];
};

type SeasonDetailResponse = {
  sportSlug: string;
  sportName: string;
  leagueSlug: string;
  leagueName: string;
  countryName: string;
  seasonSlug: string;
  seasonLabel: string;
  timezone: string;
  defaultMatchDurationMinutes: number;
  availableSeasons: SeasonReference[];
  calendarDescription: string;
  dataSourceNote: string;
  notes: string;
  matches: Match[];
  updatedAt: string;
};

export async function getHomeEntries(locale: Locale): Promise<Catalog> {
  return fetchJson<CatalogResponse>(`/api/catalog?lang=${encodeURIComponent(locale)}`);
}

export async function getSeasonPageData(
  sportSlug: string,
  leagueSlug: string,
  seasonSlug: string,
  locale: Locale,
): Promise<SeasonPageData | null> {
  const payload = await fetchSeasonDetail(
    `/api/sports/${encodeURIComponent(leagueSlug)}/${encodeURIComponent(seasonSlug)}?lang=${encodeURIComponent(locale)}`,
  );
  if (!payload) {
    return null;
  }

  if (payload.sportSlug !== sportSlug || payload.leagueSlug !== leagueSlug || payload.seasonSlug !== seasonSlug) {
    return null;
  }

  return {
    updatedAt: payload.updatedAt,
    sport: {
      slug: payload.sportSlug,
      name: payload.sportName,
    },
    league: {
      slug: payload.leagueSlug,
      name: payload.leagueName,
      countryName: payload.countryName,
    },
    season: {
      slug: payload.seasonSlug,
      label: payload.seasonLabel,
      timezone: payload.timezone,
      defaultMatchDurationMinutes: payload.defaultMatchDurationMinutes,
      calendarDescription: payload.calendarDescription,
      dataSourceNote: payload.dataSourceNote,
      notes: payload.notes,
      matches: payload.matches,
    },
  };
}

export async function getAllSeasonRoutes() {
  const catalog = await fetchJson<CatalogResponse>("/api/catalog?lang=en");
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

export function matchLabel(match: Match) {
  if (match.title) {
    return match.title;
  }
  if (match.homeTeam && match.awayTeam) {
    return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  }
  return match.id;
}
