import { API_BASE_URL } from '@/lib/config'
import type {
	AdminLeaguesResponse,
	AuthTokenResponse,
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
	createSport(token: string, payload: { id: number; slug: string; name: Record<string, string> }) {
		return request('/api/admin/sports', { method: 'POST', token, body: JSON.stringify(payload) })
	},
	listLeagues(token: string, sportSlug: string) {
		return request<AdminLeaguesResponse>(`/api/admin/${sportSlug}/leagues`, { token })
	},
	createLeague(token: string, payload: Record<string, unknown>) {
		return request('/api/admin/leagues', { method: 'POST', token, body: JSON.stringify(payload) })
	},
	listSeasons(sportSlug: string, leagueSlug: string) {
		return request<LeagueSeasonsResponse>(`/api/${sportSlug}/${leagueSlug}/seasons`)
	},
	createSeason(token: string, payload: Record<string, unknown>) {
		return request('/api/admin/seasons', { method: 'POST', token, body: JSON.stringify(payload) })
	},
	deleteSeason(token: string, sportSlug: string, leagueSlug: string, seasonSlug: string) {
		return request(`/api/admin/${sportSlug}/${leagueSlug}/seasons/${seasonSlug}`, { method: 'DELETE', token })
	},
	getSeasonDetail(sportSlug: string, leagueSlug: string, seasonSlug: string) {
		return request<SeasonDetailResponse>(`/api/${sportSlug}/${leagueSlug}/${seasonSlug}`)
	},
}