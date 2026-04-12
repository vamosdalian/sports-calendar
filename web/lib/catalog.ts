import type { Locale } from "./site";

export type Team = {
  slug: string;
  name: string;
};

export type Match = {
  id: string;
  round: string;
  title?: string;
  startsAt: string;
  status: string;
  venue: string;
  city: string;
  country: string;
  homeTeam?: Team;
  awayTeam?: Team;
};

export type MatchGroup = {
  key: string;
  label: string;
  matches: Match[];
};

export type Season = {
  slug: string;
  label: string;
  defaultMatchDurationMinutes: number;
  calendarDescription: string;
  dataSourceNote: string;
  notes: string;
  groups: MatchGroup[];
  matches: Match[];
};

export type SeasonReference = {
  slug: string;
  label: string;
};

export type LeagueDirectoryLeague = {
  leagueSlug: string;
  leagueName: string;
  defaultSeason?: SeasonReference;
};

export type LeagueDirectorySport = {
  sportSlug: string;
  sportName: string;
  leagues: LeagueDirectoryLeague[];
};

export type LeaguesDirectory = {
  updatedAt: string;
  items: LeagueDirectorySport[];
};

export type LeagueSeasonsData = {
  updatedAt: string;
  sport: {
    slug: string;
    name: string;
  };
  league: {
    slug: string;
    name: string;
  };
  seasons: SeasonReference[];
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
  };
  season: Season;
};

const defaultApiBaseUrl = process.env.NODE_ENV === "production"
  ? "https://api.sports-calendar.com"
  : "http://localhost:8080";
const apiBaseUrl = process.env.SPORTS_CALENDAR_API_BASE_URL ?? defaultApiBaseUrl;
const publicApiBaseUrl = process.env.SPORTS_CALENDAR_PUBLIC_API_BASE_URL ?? apiBaseUrl;
const REVALIDATE_SECONDS = 3600;

async function fetchJson<T>(path: string): Promise<T> {
  const requestUrl = `${apiBaseUrl}${path}`;
  const response = await fetch(requestUrl, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(await formatApiError(response, requestUrl));
  }

  return (await response.json()) as T;
}

async function fetchSeasonDetail(path: string): Promise<SeasonDetailResponse | null> {
  const requestUrl = `${apiBaseUrl}${path}`;
  const response = await fetch(requestUrl, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await formatApiError(response, requestUrl));
  }

  return (await response.json()) as SeasonDetailResponse;
}

async function fetchJsonOrNull<T>(path: string): Promise<T | null> {
  const requestUrl = `${apiBaseUrl}${path}`;
  const response = await fetch(requestUrl, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await formatApiError(response, requestUrl));
  }

  return (await response.json()) as T;
}

async function formatApiError(response: Response, requestUrl: string): Promise<string> {
  const responseText = (await response.text()).replace(/\s+/g, " ").trim();
  const snippet = responseText ? ` body=${JSON.stringify(responseText.slice(0, 240))}` : "";
  return `API request failed: ${response.status} ${response.statusText} (${requestUrl})${snippet}`;
}

type LeaguesResponse = {
  items: Array<{
    sportSlug: string;
    sportName: string;
    leagues: Array<{
      leagueSlug: string;
      leagueName: string;
      defaultSeason?: SeasonReference;
      seasons?: SeasonReference[];
    }>;
  }>;
  updatedAt: string;
};

type LeagueSeasonsResponse = {
  sportSlug: string;
  sportName: string;
  leagueSlug: string;
  leagueName: string;
  seasons: SeasonReference[];
  updatedAt: string;
};

type SeasonDetailResponse = {
  sportSlug: string;
  sportName: string;
  leagueSlug: string;
  leagueName: string;
  seasonSlug: string;
  seasonLabel: string;
  defaultMatchDurationMinutes: number;
  calendarDescription: string;
  dataSourceNote: string;
  notes: string;
  groups: MatchGroup[];
  updatedAt: string;
};

export async function getLeagues(locale: Locale): Promise<LeaguesDirectory> {
  const payload = await fetchJson<LeaguesResponse>(`/api/leagues?lang=${encodeURIComponent(locale)}`);

  return {
    updatedAt: payload.updatedAt,
    items: payload.items.map((sport) => ({
      sportSlug: sport.sportSlug,
      sportName: sport.sportName,
      leagues: sport.leagues.map((league) => ({
        leagueSlug: league.leagueSlug,
        leagueName: league.leagueName,
        defaultSeason: resolveDefaultSeason(league.defaultSeason, league.seasons),
      })),
    })),
  };
}

export async function getLeagueSeasons(
  sportSlug: string,
  leagueSlug: string,
  locale: Locale,
): Promise<LeagueSeasonsData | null> {
  const payload = await fetchJsonOrNull<LeagueSeasonsResponse>(
    `/api/${encodeURIComponent(sportSlug)}/${encodeURIComponent(leagueSlug)}/seasons?lang=${encodeURIComponent(locale)}`,
  );
  if (!payload) {
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
    },
    seasons: payload.seasons,
  };
}

export async function getSeasonPageData(
  sportSlug: string,
  leagueSlug: string,
  seasonSlug: string,
  locale: Locale,
): Promise<SeasonPageData | null> {
  const payload = await fetchSeasonDetail(
    `/api/${encodeURIComponent(sportSlug)}/${encodeURIComponent(leagueSlug)}/${encodeURIComponent(seasonSlug)}?lang=${encodeURIComponent(locale)}`,
  );
  if (!payload) {
    return null;
  }

  if (payload.sportSlug !== sportSlug || payload.leagueSlug !== leagueSlug || payload.seasonSlug !== seasonSlug) {
    return null;
  }

  const matches = payload.groups.flatMap((group) => group.matches);

  return {
    updatedAt: payload.updatedAt,
    sport: {
      slug: payload.sportSlug,
      name: payload.sportName,
    },
    league: {
      slug: payload.leagueSlug,
      name: payload.leagueName,
    },
    season: {
      slug: payload.seasonSlug,
      label: payload.seasonLabel,
      defaultMatchDurationMinutes: payload.defaultMatchDurationMinutes,
      calendarDescription: payload.calendarDescription,
      dataSourceNote: payload.dataSourceNote,
      notes: payload.notes,
      groups: payload.groups,
      matches,
    },
  };
}

export async function getAllSeasonRoutes() {
  try {
    const directory = await getLeagues("en");
    const routes: Array<{ sport: string; league: string; season: string }> = [];

    for (const sport of directory.items) {
      for (const league of sport.leagues) {
        const seasonsPayload = await getLeagueSeasons(sport.sportSlug, league.leagueSlug, "en");
        const seasons = seasonsPayload?.seasons.length
          ? seasonsPayload.seasons
          : league.defaultSeason
            ? [league.defaultSeason]
            : [];
        for (const season of seasons) {
          routes.push({
            sport: sport.sportSlug,
            league: league.leagueSlug,
            season: season.slug,
          });
        }
      }
    }

    return routes;
  } catch {
    return [];
  }
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

export function formatMatchLocation(match: Match) {
  return [match.venue, match.city, match.country].filter(Boolean).join(", ");
}

export function getSeasonSubscriptionUrl(sportSlug: string, leagueSlug: string, seasonSlug: string) {
  const icsUrl = `${publicApiBaseUrl}/ics/${encodeURIComponent(sportSlug)}/${encodeURIComponent(leagueSlug)}/${encodeURIComponent(seasonSlug)}/matches.ics`;
  return icsUrl.replace(/^https?:\/\//, "webcal://");
}

function resolveDefaultSeason(
  defaultSeason: SeasonReference | undefined,
  seasons: SeasonReference[] | undefined,
): SeasonReference | undefined {
  if (defaultSeason?.slug) {
    return defaultSeason;
  }

  const firstSeason = seasons?.find((season) => season?.slug);
  if (firstSeason) {
    return firstSeason;
  }

  return undefined;
}
