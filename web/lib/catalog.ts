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
  result?: string[];
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

/**
 * A single team's view of a season: only their fixtures, in one chronological
 * list, plus the rest of the league for cross-linking.
 */
export type TeamPageData = SeasonPageData & {
  team: Team;
  /** Every other team in the season, for internal links. */
  otherTeams: Team[];
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

/**
 * Distinct teams appearing in a season's fixtures, sorted for display.
 *
 * Teams are derived from the fixtures rather than fetched separately — the
 * season payload already carries both sides of every match, so there is no
 * team endpoint to call.
 */
export function buildTeamOptions(matches: Match[], locale: Locale): Team[] {
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

/**
 * Why this distinguishes the two failures: a missing season is a genuine 404,
 * but a missing team in an existing season usually means the slug went stale
 * after a data-source switch. Those URLs are already shared, so the caller
 * sends them back to the season page instead of serving a dead end.
 */
export type TeamPageResult =
  | { kind: "ok"; data: TeamPageData }
  | { kind: "season-not-found" }
  | { kind: "team-not-found" };

export async function getTeamPageData(
  sportSlug: string,
  leagueSlug: string,
  seasonSlug: string,
  teamSlug: string,
  locale: Locale,
): Promise<TeamPageResult> {
  const season = await getSeasonPageData(sportSlug, leagueSlug, seasonSlug, locale);
  if (!season) {
    return { kind: "season-not-found" };
  }

  const teams = buildTeamOptions(season.season.matches, locale);
  const team = teams.find((option) => option.slug === teamSlug);
  if (!team) {
    return { kind: "team-not-found" };
  }

  // One chronological list rather than a home/away split: a supporter reads a
  // fixture list to find the next few matches, and splitting it buries them.
  const teamMatches = season.season.matches
    .filter((match) => matchIncludesTeam(match, teamSlug))
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

  const data: TeamPageData = {
    ...season,
    // Narrow the season to this team so the page renders only their fixtures.
    // This is also what keeps the HTML small: a full league season is hundreds
    // of matches, one team is a few dozen.
    season: {
      ...season.season,
      matches: teamMatches,
      groups: season.season.groups
        .map((group) => ({
          ...group,
          matches: group.matches.filter((match) => matchIncludesTeam(match, teamSlug)),
        }))
        .filter((group) => group.matches.length > 0),
    },
    team,
    otherTeams: teams.filter((option) => option.slug !== teamSlug),
  };

  return { kind: "ok", data };
}

function matchIncludesTeam(match: Match, teamSlug: string) {
  return match.homeTeam?.slug === teamSlug || match.awayTeam?.slug === teamSlug;
}

/**
 * Every team page route, for the sitemap.
 *
 * Deliberately not used by generateStaticParams: prerendering a few hundred
 * team pages at build time would fetch every season payload again and risks
 * blowing the Cloudflare build budget. The pages are generated on demand and
 * then held in the ISR cache; the sitemap is what gets them discovered.
 */
export async function getAllTeamRoutes() {
  try {
    const seasonRoutes = await getAllSeasonRoutes();
    const routes: Array<{ sport: string; league: string; season: string; team: string }> = [];

    for (const route of seasonRoutes) {
      const season = await getSeasonPageData(route.sport, route.league, route.season, "en");
      if (!season) {
        continue;
      }
      for (const team of buildTeamOptions(season.season.matches, "en")) {
        routes.push({ ...route, team: team.slug });
      }
    }

    return routes;
  } catch {
    return [];
  }
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
  if (match.homeTeam && match.awayTeam) {
    if (hasMatchResult(match)) {
      return `${match.homeTeam.name} ${match.result[0]}:${match.result[1]} ${match.awayTeam.name}`;
    }
    return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  }
  if (match.title) {
    return match.title;
  }
  return match.id;
}

function hasMatchResult(match: Match): match is Match & { result: [string, string] } {
  return Array.isArray(match.result) && match.result.length === 2;
}

export function formatMatchLocation(match: Match) {
  return [match.venue, match.city, match.country].filter(Boolean).join(", ");
}

type LeagueSubscriptionUrlOptions = {
  locale?: Locale;
  teamSlug?: string;
};

// Feed URLs carry no season on purpose. A subscription is added to a calendar
// client once and then never revisited, so a season-pinned URL quietly stops
// delivering fixtures the day that season ends. The backend resolves the
// current season per request instead, which makes one subscription last across
// season rollovers.
export function getLeagueFeedUrl(
  sportSlug: string,
  leagueSlug: string,
  options: LeagueSubscriptionUrlOptions = {},
) {
  const icsUrl = `${publicApiBaseUrl}/ics/${encodeURIComponent(sportSlug)}/${encodeURIComponent(leagueSlug)}/matches.ics`;
  const query = new URLSearchParams();
  if (options.locale) {
    query.set("lang", options.locale);
  }
  if (options.teamSlug) {
    query.set("team", options.teamSlug);
  }

  const queryString = query.toString();
  return queryString ? `${icsUrl}?${queryString}` : icsUrl;
}

export function getLeagueSubscriptionUrl(
  sportSlug: string,
  leagueSlug: string,
  options: LeagueSubscriptionUrlOptions = {},
) {
  return getLeagueFeedUrl(sportSlug, leagueSlug, options).replace(/^https?:\/\//, "webcal://");
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
