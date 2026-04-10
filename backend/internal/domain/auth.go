package domain

import "errors"

var ErrUnauthorized = errors.New("unauthorized")

type UserRecord struct {
	ID        int64  `json:"id"`
	Email     string `json:"email"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type RegisterAdminInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshTokenInput struct {
	Token string `json:"token"`
}

type AuthToken struct {
	Token     string `json:"token"`
	Email     string `json:"email"`
	ExpiresAt string `json:"expiresAt"`
}

type TokenClaims struct {
	Email     string
	ExpiresAt int64
}

type AdminSportItem struct {
	ID        int64         `json:"id"`
	Slug      string        `json:"slug"`
	Name      LocalizedText `json:"name"`
	CreatedAt string        `json:"createdAt"`
	UpdatedAt string        `json:"updatedAt"`
}

type AdminSportsResponse struct {
	Items     []AdminSportItem `json:"items"`
	UpdatedAt string           `json:"updatedAt"`
}

type AdminLeagueItem struct {
	ID                  int64         `json:"id"`
	SportSlug           string        `json:"sportSlug"`
	Slug                string        `json:"slug"`
	Name                LocalizedText `json:"name"`
	SyncInterval        string        `json:"syncInterval"`
	CalendarDescription LocalizedText `json:"calendarDescription"`
	DataSourceNote      LocalizedText `json:"dataSourceNote"`
	Notes               LocalizedText `json:"notes"`
	CreatedAt           string        `json:"createdAt"`
	UpdatedAt           string        `json:"updatedAt"`
}

type AdminLeaguesResponse struct {
	SportSlug string            `json:"sportSlug"`
	Items     []AdminLeagueItem `json:"items"`
	UpdatedAt string            `json:"updatedAt"`
}

type AdminSeasonItem struct {
	ID                          int64  `json:"id"`
	SportSlug                   string `json:"sportSlug"`
	LeagueSlug                  string `json:"leagueSlug"`
	Slug                        string `json:"slug"`
	Label                       string `json:"label"`
	StartYear                   int    `json:"startYear"`
	EndYear                     int    `json:"endYear"`
	DefaultMatchDurationMinutes int    `json:"defaultMatchDurationMinutes"`
	CreatedAt                   string `json:"createdAt"`
	UpdatedAt                   string `json:"updatedAt"`
}

type AdminSeasonsResponse struct {
	SportSlug  string            `json:"sportSlug"`
	LeagueSlug string            `json:"leagueSlug"`
	Items      []AdminSeasonItem `json:"items"`
	UpdatedAt  string            `json:"updatedAt"`
}
