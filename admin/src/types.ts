export type LocalizedText = Record<string, string>

export type AuthTokenResponse = {
	token: string
	email: string
	expiresAt: string
}

export type SportItem = {
	id: number
	slug: string
	name: LocalizedText
	createdAt: string
	updatedAt: string
}

export type SportsResponse = {
	items: SportItem[]
	updatedAt: string
}

export type LeagueItem = {
	id: number
	sportSlug: string
	slug: string
	name: LocalizedText
	syncInterval: string
	calendarDescription: LocalizedText
	dataSourceNote: LocalizedText
	notes: LocalizedText
	createdAt: string
	updatedAt: string
}

export type AdminLeaguesResponse = {
	sportSlug: string
	items: LeagueItem[]
	updatedAt: string
}

export type SeasonReference = {
	slug: string
	label: string
}

export type LeagueSeasonsResponse = {
	sportSlug: string
	leagueSlug: string
	seasons: SeasonReference[]
	updatedAt: string
}

export type TeamRef = {
	slug: string
	name: string
}

export type MatchItem = {
	id: string
	round: string
	startsAt: string
	status: string
	venue: string
	city: string
	homeTeam?: TeamRef
	awayTeam?: TeamRef
}

export type MatchGroup = {
	key: string
	label: string
	matches: MatchItem[]
}

export type SeasonDetailResponse = {
	sportSlug: string
	sportName: string
	leagueSlug: string
	leagueName: string
	seasonSlug: string
	seasonLabel: string
	defaultMatchDurationMinutes: number
	calendarDescription: string
	dataSourceNote: string
	notes: string
	groups: MatchGroup[]
	updatedAt: string
}