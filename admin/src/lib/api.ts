import { API_BASE_URL } from '@/lib/config'
import type {
	AdminLeaguesResponse,
	AdminSeasonsResponse,
	AdminTeamsResponse,
	AuthTokenResponse,
	ExternalLeagueLookup,
	ExternalLeaguesResponse,
	ExternalSeasonsResponse,
	ExternalSportsResponse,
	LeagueSeasonsResponse,
	SeasonDetailResponse,
	SportsResponse,
} from '@/types'

type RequestOptions = RequestInit & {
	token?: string | null
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const { token, headers, ...rest } = options
	const response = await fetch(`${API_BASE_URL}${path}`, {
		...rest,
		headers: {
			...(rest.body ? { 'Content-Type': 'application/json' } : {}),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...headers,
		},
	})
	if (!response.ok) {
		const payload = await response.json().catch(() => null)
		throw new Error(payload?.error?.message || `request failed: ${response.status}`)
	}
	if (response.status === 204) {
		return undefined as T
	}
	return response.json() as Promise<T>
}

export const api = {
	registerAdmin(email: string, password: string) {
		return request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) })
	},
	login(email: string, password: string) {
		return request<AuthTokenResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
	},
	refresh(token: string) {
		return request<AuthTokenResponse>('/api/auth/refresh', { method: 'POST', token })
	},
	listSports(token: string) {
		return request<SportsResponse>('/api/admin/sports', { token })
	},
	listTheSportsDBSports(token: string) {
		return request<ExternalSportsResponse>('/api/admin/thesportsdb/sports', { token })
	},
	createSport(token: string, payload: { id: number; slug: string; name: Record<string, string> }) {
		return request('/api/admin/sports', { method: 'POST', token, body: JSON.stringify(payload) })
	},
	updateSport(token: string, sportSlug: string, payload: { slug: string; name: Record<string, string> }) {
		return request(`/api/admin/sports/${sportSlug}`, { method: 'PUT', token, body: JSON.stringify(payload) })
	},
	deleteSport(token: string, sportSlug: string) {
		return request(`/api/admin/sports/${sportSlug}`, { method: 'DELETE', token })
	},
	listLeagues(token: string, sportSlug: string) {
		return request<AdminLeaguesResponse>(`/api/admin/${sportSlug}/leagues`, { token })
	},
	listTheSportsDBLeagues(token: string, sportSlug: string) {
		return request<ExternalLeaguesResponse>(`/api/admin/${sportSlug}/thesportsdb/leagues`, { token })
	},
	lookupTheSportsDBLeague(token: string, leagueID: number) {
		return request<ExternalLeagueLookup>(`/api/admin/thesportsdb/leagues/${leagueID}`, { token })
	},
	createLeague(token: string, payload: Record<string, unknown>) {
		return request('/api/admin/leagues', { method: 'POST', token, body: JSON.stringify(payload) })
	},
	updateLeague(token: string, sportSlug: string, leagueSlug: string, payload: Record<string, unknown>) {
		return request(`/api/admin/${sportSlug}/leagues/${leagueSlug}`, { method: 'PUT', token, body: JSON.stringify(payload) })
	},
	deleteLeague(token: string, sportSlug: string, leagueSlug: string) {
		return request(`/api/admin/${sportSlug}/leagues/${leagueSlug}`, { method: 'DELETE', token })
	},
	listAdminSeasons(token: string, sportSlug: string, leagueSlug: string) {
		return request<AdminSeasonsResponse>(`/api/admin/${sportSlug}/${leagueSlug}/seasons`, { token })
	},
	listAdminTeams(token: string, sportSlug: string, leagueSlug: string) {
		return request<AdminTeamsResponse>(`/api/admin/${sportSlug}/${leagueSlug}/teams`, { token })
	},
	updateTeam(token: string, sportSlug: string, leagueSlug: string, teamID: number, payload: { name: Record<string, string> }) {
		return request(`/api/admin/${sportSlug}/${leagueSlug}/teams/${teamID}`, { method: 'PUT', token, body: JSON.stringify(payload) })
	},
	listSeasons(sportSlug: string, leagueSlug: string) {
		return request<LeagueSeasonsResponse>(`/api/${sportSlug}/${leagueSlug}/seasons`)
	},
	listTheSportsDBSeasons(token: string, sportSlug: string, leagueSlug: string) {
		return request<ExternalSeasonsResponse>(`/api/admin/${sportSlug}/${leagueSlug}/thesportsdb/seasons`, { token })
	},
	createSeason(token: string, payload: Record<string, unknown>) {
		return request('/api/admin/seasons', { method: 'POST', token, body: JSON.stringify(payload) })
	},
	createMatch(token: string, payload: Record<string, unknown>) {
		return request('/api/admin/matches', { method: 'POST', token, body: JSON.stringify(payload) })
	},
	updateMatch(token: string, matchID: string, payload: Record<string, unknown>) {
		return request(`/api/admin/matches/${encodeURIComponent(matchID)}`, { method: 'PUT', token, body: JSON.stringify(payload) })
	},
	deleteMatch(token: string, sportSlug: string, leagueSlug: string, seasonSlug: string, matchID: string) {
		const params = new URLSearchParams({ sport: sportSlug, league: leagueSlug, season: seasonSlug })
		return request(`/api/admin/matches/${encodeURIComponent(matchID)}?${params.toString()}`, { method: 'DELETE', token })
	},
	updateSeason(token: string, sportSlug: string, leagueSlug: string, seasonSlug: string, payload: Record<string, unknown>) {
		return request(`/api/admin/${sportSlug}/${leagueSlug}/seasons/${seasonSlug}`, { method: 'PUT', token, body: JSON.stringify(payload) })
	},
	deleteSeason(token: string, sportSlug: string, leagueSlug: string, seasonSlug: string) {
		return request(`/api/admin/${sportSlug}/${leagueSlug}/seasons/${seasonSlug}`, { method: 'DELETE', token })
	},
	refreshSeasonSchedule(token: string, sportSlug: string, leagueSlug: string, seasonSlug: string) {
		return request(`/api/admin/${sportSlug}/${leagueSlug}/seasons/${seasonSlug}/refresh`, { method: 'POST', token })
	},
	getAdminSeasonDetail(token: string, sportSlug: string, leagueSlug: string, seasonSlug: string) {
		return request<SeasonDetailResponse>(`/api/admin/${sportSlug}/${leagueSlug}/seasons/${seasonSlug}`, { token })
	},
	getSeasonDetail(sportSlug: string, leagueSlug: string, seasonSlug: string) {
		return request<SeasonDetailResponse>(`/api/${sportSlug}/${leagueSlug}/${seasonSlug}`)
	},
}
