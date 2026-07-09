// API client for the sports-spider (Transfermarkt crawler) backend.
//
// The crawler is never exposed publicly. All calls go through the admin Go
// backend's authenticated reverse proxy at `${API_BASE_URL}/api/spider/*`,
// which reuses admin auth and forwards to the crawler on the private network.
// So every request carries the admin bearer token and is same-backend as the
// rest of the admin API (no CORS, no separate spider origin).

import { API_BASE_URL } from '@/lib/config'

export type CompetitionType = 'league' | 'cup' | 'international' | 'other'
export type TeamKind = 'national' | 'club'
export type CrawlKind =
	| 'competition_clubs'
	| 'competition_standings'
	| 'competition_fixtures'
	| 'team_fixtures'
	| 'team_squad'
	| 'player_profile'
	| 'fallback_discovery'
export type CrawlStatus =
	| 'pending'
	| 'running'
	| 'done'
	| 'failed'
	| 'skipped'
	| 'cancelled'

export interface Country {
	id: number
	name: string
	url: string | null
	last_crawled_at: string | null
}

export interface Team {
	id: number
	kind: TeamKind
	name: string
	slug: string | null
	country_id: number | null
	parent_team_id: number | null
	logo_url: string | null
}

export interface Competition {
	id: string
	name: string
	type: CompetitionType
	kind_of_teams: TeamKind | null
	country_id: number | null
	tier: string | null
	logo_url: string | null
}

export interface Season {
	id: number
	label: string
}

export interface Player {
	id: number
	name: string
	position: string | null
	date_of_birth: string | null
	nationality: string | null
	height_cm: number | null
	foot: string | null
	market_value: number | null
}

export interface Standing {
	team_id: number
	group: string
	rank: number | null
	played: number | null
	win: number | null
	draw: number | null
	loss: number | null
	goals_for: number | null
	goals_against: number | null
	goal_diff: number | null
	points: number | null
}

export interface Fixture {
	id: number
	match_id: number | null
	competition_id: string
	season_id: number
	matchday: string | null
	kickoff: string | null
	home_team_id: number | null
	away_team_id: number | null
	home_name: string | null
	away_name: string | null
	home_score: number | null
	away_score: number | null
}

export interface CrawlTask {
	id: string
	kind: CrawlKind
	target_id: string
	season_id: number
	status: CrawlStatus
	priority: number
	attempts: number
	progress: number
	total: number
	message: string | null
	last_error: string | null
	created_at: string
	started_at: string | null
	finished_at: string | null
}

export interface BrowserStatus {
	needs_verification: boolean
	url: string | null
	waiting_seconds: number | null
}

// path is the crawler path (starts with /api/...); it is prefixed with the
// admin proxy mount so /api/tree/countries -> /api/spider/api/tree/countries.
async function http<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE_URL}/api/spider${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(init?.headers as Record<string, string> | undefined),
		},
	})
	if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
	return res.json() as Promise<T>
}

export type SpiderApi = ReturnType<typeof createSpiderApi>

// Builds a crawler API client bound to the current admin token. Recreate it
// when the token changes (see crawler-page useMemo).
export function createSpiderApi(token: string | null) {
	return {
		// ── tree expansion ──
		countries: (): Promise<Country[]> => http('/api/tree/countries', token),
		nationalTeams: (countryId: number): Promise<Team[]> =>
			http(`/api/tree/countries/${countryId}/national-teams`, token),
		countryCompetitions: (countryId: number): Promise<Competition[]> =>
			http(`/api/tree/countries/${countryId}/competitions`, token),
		seasons: (competitionId: string): Promise<Season[]> =>
			http(`/api/tree/competitions/${competitionId}/seasons`, token),
		competitionTeams: (competitionId: string): Promise<Team[]> =>
			http(`/api/tree/competitions/${competitionId}/teams`, token),

		// ── crawl ──
		enqueue: (body: {
			kind: CrawlKind
			target_id: string
			seasons?: number[]
			priority?: number
		}): Promise<{ enqueued: number }> =>
			http('/api/crawl', token, { method: 'POST', body: JSON.stringify(body) }),
		enqueueFallback: (): Promise<{ enqueued: number }> =>
			http('/api/crawl/fallback', token, { method: 'POST' }),
		tasks: (): Promise<CrawlTask[]> => http('/api/crawl/tasks?limit=100', token),

		// ── data browse ──
		standings: (competitionId: string, seasonId: number): Promise<Standing[]> =>
			http(`/api/data/standings?competition_id=${competitionId}&season_id=${seasonId}`, token),
		squad: (teamId: number, seasonId: number): Promise<Player[]> =>
			http(`/api/data/squad?team_id=${teamId}&season_id=${seasonId}`, token),
		fixtures: (teamId: number, seasonId: number): Promise<Fixture[]> =>
			http(`/api/data/fixtures?team_id=${teamId}&season_id=${seasonId}`, token),
		competitionFixtures: (competitionId: string, seasonId: number): Promise<Fixture[]> =>
			http(
				`/api/data/fixtures?competition_id=${competitionId}&season_id=${seasonId}`,
				token,
			),

		browserStatus: (): Promise<BrowserStatus> => http('/api/browser/status', token),
	}
}

export function formatMarketValue(v: number | null): string {
	if (v == null) return '—'
	if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}m`
	if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}k`
	return `€${v}`
}
