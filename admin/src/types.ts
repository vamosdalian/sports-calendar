export type LocalizedText = Record<string, string>

export type AdminLocaleItem = {
	code: string
	label: string
}

export type AdminLocalesResponse = {
	items: AdminLocaleItem[]
}

export type AuthTokenResponse = {
	token: string
	email: string
	expiresAt: string
}

export type RefreshTaskSource = 'manual' | 'cron'

export type RefreshTaskStatus = 'running' | 'succeeded' | 'failed'

export type RefreshTaskItem = {
	leagueId: number
	leagueSlug: string
	seasonId: number
	seasonSlug: string
	requestedAt: string
	source: RefreshTaskSource
}

export type RunningRefreshTask = RefreshTaskItem & {
	startedAt: string
	status: RefreshTaskStatus
}

export type RecentRefreshTask = RefreshTaskItem & {
	startedAt: string
	finishedAt: string
	status: RefreshTaskStatus
	error?: string
}

export type RefreshQueueSnapshot = {
	running: RunningRefreshTask | null
	queued: RefreshTaskItem[]
	recent: RecentRefreshTask[]
	stats: {
		queueLength: number
	}
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

export type ExternalSportOption = {
	id: number
	name: string
	suggestedSlug: string
}

export type ExternalSportsResponse = {
	items: ExternalSportOption[]
}

export type LeagueItem = {
	id: number
	sportSlug: string
	slug: string
	name: LocalizedText
	show: boolean
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

export type AdminSeasonItem = {
	id: number
	sportSlug: string
	leagueSlug: string
	slug: string
	label: string
	show: boolean
	startYear: number
	endYear: number
	defaultMatchDurationMinutes: number
	createdAt: string
	updatedAt: string
}

export type AdminSeasonsResponse = {
	sportSlug: string
	leagueSlug: string
	items: AdminSeasonItem[]
	updatedAt: string
}

export type ExternalLeagueOption = {
	id: number
	name: string
	sport: string
	suggestedSlug: string
}

export type ExternalLeaguesResponse = {
	sportSlug: string
	items: ExternalLeagueOption[]
}

export type ExternalLeagueLookup = {
	id: number
	name: string
	sport: string
	country: string
	currentSeason: string
	suggestedSlug: string
	calendarDescription: string
	dataSourceNote: string
	syncInterval: string
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

export type ExternalSeasonOption = {
	seasonValue: string
	label: string
	suggestedSlug: string
	startYear: number
	endYear: number
}

export type ExternalSeasonsResponse = {
	sportSlug: string
	leagueSlug: string
	items: ExternalSeasonOption[]
}

export type TeamRef = {
	slug: string
	name: string
}

export type AdminTeamItem = {
	id: number
	slug: string
	name: LocalizedText
}

export type AdminVenueItem = {
	id: number
	name: LocalizedText
	city: LocalizedText
	country: LocalizedText
	updatedAt: string
}

export type AdminVenuesResponse = {
	items: AdminVenueItem[]
	updatedAt: string
}

export type AdminTeamsResponse = {
	sportSlug: string
	leagueSlug: string
	items: AdminTeamItem[]
	updatedAt: string
}

export type MatchItem = {
	id: string
	round: string
	startsAt: string
	status: string
	venueId?: number
	venue: string
	city: string
	country: string
	homeTeamID?: number
	awayTeamID?: number
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
