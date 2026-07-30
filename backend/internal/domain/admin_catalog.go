package domain

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
