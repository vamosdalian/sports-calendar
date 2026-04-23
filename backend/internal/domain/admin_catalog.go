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

type AdminLocaleItem struct {
	Code  string `json:"code"`
	Label string `json:"label"`
}

type AdminLocalesResponse struct {
	Items []AdminLocaleItem `json:"items"`
}

type CreateAdminLocaleInput struct {
	Code  string `json:"code"`
	Label string `json:"label"`
}

type UpdateAdminLocaleInput struct {
	Code  string `json:"-"`
	Label string `json:"label"`
}

type AdminTeamItem struct {
	ID   int64         `json:"id"`
	Slug string        `json:"slug"`
	Name LocalizedText `json:"name"`
}

type AdminVenueItem struct {
	ID        int64         `json:"id"`
	Name      LocalizedText `json:"name"`
	City      LocalizedText `json:"city"`
	Country   LocalizedText `json:"country"`
	UpdatedAt string        `json:"updatedAt"`
}

type AdminVenuesResponse struct {
	Items     []AdminVenueItem `json:"items"`
	UpdatedAt string           `json:"updatedAt"`
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
