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
  homeTeam?: Team;
  awayTeam?: Team;
};

export type Season = {
  slug: string;
  label: string;
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

export type YearDirectoryLeague = {
  leagueSlug: string;
  leagueName: string;
  seasons: SeasonReference[];
};

export type YearDirectorySport = {
  sportSlug: string;
  sportName: string;
  leagues: YearDirectoryLeague[];
};

export type YearDirectory = {
  year: number;
  updatedAt: string;
  items: YearDirectorySport[];
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
  years: number[];
  updatedAt: string;
};

type LeaguesByYearResponse = {
  year: number;
  items: YearDirectorySport[];
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
  availableSeasons: SeasonReference[];
  calendarDescription: string;
  dataSourceNote: string;
  notes: string;
  matches: Match[];
  updatedAt: string;
};

export async function getAvailableYears(): Promise<number[]> {
  const payload = await fetchJson<CatalogResponse>("/api/years");
  return payload.years;
}

export async function getLeaguesByYear(year: number, locale: Locale): Promise<YearDirectory> {
  return fetchJson<LeaguesByYearResponse>(
    `/api/leagues?year=${encodeURIComponent(String(year))}&lang=${encodeURIComponent(locale)}`,
  );
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
    },
    season: {
      slug: payload.seasonSlug,
      label: payload.seasonLabel,
      defaultMatchDurationMinutes: payload.defaultMatchDurationMinutes,
      calendarDescription: payload.calendarDescription,
      dataSourceNote: payload.dataSourceNote,
      notes: payload.notes,
      matches: payload.matches,
    },
  };
}

export async function getAllSeasonRoutes() {
  try {
    const years = await getAvailableYears();
    const directories = await Promise.all(years.map((year) => getLeaguesByYear(year, "en")));
    const seen = new Set<string>();
    const routes: Array<{ sport: string; league: string; season: string }> = [];

    for (const directory of directories) {
      for (const sport of directory.items) {
        for (const league of sport.leagues) {
          for (const season of league.seasons) {
            const key = `${sport.sportSlug}/${league.leagueSlug}/${season.slug}`;
            if (seen.has(key)) {
              continue;
            }
            seen.add(key);
            routes.push({
              sport: sport.sportSlug,
              league: league.leagueSlug,
              season: season.slug,
            });
          }
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
