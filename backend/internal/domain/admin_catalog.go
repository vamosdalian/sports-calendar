package domain

type AdminExternalSportOption struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	SuggestedSlug string `json:"suggestedSlug"`
}

type AdminExternalSportsResponse struct {
	Items []AdminExternalSportOption `json:"items"`
}

type AdminExternalLeagueOption struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Sport         string `json:"sport"`
	SuggestedSlug string `json:"suggestedSlug"`
}

type AdminExternalLeaguesResponse struct {
	SportSlug string                      `json:"sportSlug"`
	Items     []AdminExternalLeagueOption `json:"items"`
}

type AdminExternalLeagueLookup struct {
	ID                  int64  `json:"id"`
	Name                string `json:"name"`
	Sport               string `json:"sport"`
	Country             string `json:"country"`
	CurrentSeason       string `json:"currentSeason"`
	SuggestedSlug       string `json:"suggestedSlug"`
	CalendarDescription string `json:"calendarDescription"`
	DataSourceNote      string `json:"dataSourceNote"`
	SyncInterval        string `json:"syncInterval"`
}

type AdminExternalSeasonOption struct {
	SeasonValue   string `json:"seasonValue"`
	Label         string `json:"label"`
	SuggestedSlug string `json:"suggestedSlug"`
	StartYear     int    `json:"startYear"`
	EndYear       int    `json:"endYear"`
}

type AdminTeamItem struct {
	ID   int64         `json:"id"`
	Slug string        `json:"slug"`
	Name LocalizedText `json:"name"`
}

type AdminTeamsResponse struct {
	SportSlug  string          `json:"sportSlug"`
	LeagueSlug string          `json:"leagueSlug"`
	Items      []AdminTeamItem `json:"items"`
	UpdatedAt  string          `json:"updatedAt"`
}

type AdminExternalSeasonsResponse struct {
	SportSlug  string                      `json:"sportSlug"`
	LeagueSlug string                      `json:"leagueSlug"`
	Items      []AdminExternalSeasonOption `json:"items"`
}
