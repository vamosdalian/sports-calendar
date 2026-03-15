package domain

import (
	"errors"
	"fmt"
	"time"
)

var ErrNotFound = errors.New("resource not found")

type LocalizedText map[string]string

type SeasonReference struct {
	Slug  string `json:"slug"`
	Label string `json:"label"`
}

type LeagueReference struct {
	LeagueSlug    string          `json:"leagueSlug"`
	LeagueNames   LocalizedText   `json:"leagueNames"`
	DefaultSeason SeasonReference `json:"defaultSeason"`
}

type SportDirectoryItem struct {
	SportSlug  string            `json:"sportSlug"`
	SportNames LocalizedText     `json:"sportNames"`
	Leagues    []LeagueReference `json:"leagues"`
}

type LeagueSeasons struct {
	SportSlug   string            `json:"sportSlug"`
	SportNames  LocalizedText     `json:"sportNames"`
	LeagueSlug  string            `json:"leagueSlug"`
	LeagueNames LocalizedText     `json:"leagueNames"`
	Seasons     []SeasonReference `json:"seasons"`
	UpdatedAt   string            `json:"updatedAt"`
}

type MatchGroup struct {
	Key     string        `json:"key"`
	Label   LocalizedText `json:"label"`
	Matches []Match       `json:"matches"`
}

type SeasonDetail struct {
	SportSlug                   string        `json:"sportSlug"`
	SportNames                  LocalizedText `json:"sportNames"`
	LeagueSlug                  string        `json:"leagueSlug"`
	LeagueNames                 LocalizedText `json:"leagueNames"`
	SeasonSlug                  string        `json:"seasonSlug"`
	SeasonLabel                 string        `json:"seasonLabel"`
	DefaultMatchDurationMinutes int           `json:"defaultMatchDurationMinutes"`
	CalendarDescription         LocalizedText `json:"calendarDescription"`
	DataSourceNote              LocalizedText `json:"dataSourceNote"`
	Notes                       LocalizedText `json:"notes"`
	Groups                      []MatchGroup  `json:"groups"`
	Matches                     []Match       `json:"matches"`
	UpdatedAt                   string        `json:"updatedAt"`
}

type Match struct {
	ID       string        `json:"id"`
	Round    LocalizedText `json:"round"`
	StartsAt string        `json:"startsAt"`
	Status   string        `json:"status"`
	Venue    LocalizedText `json:"venue"`
	City     LocalizedText `json:"city"`
	HomeTeam *Team         `json:"homeTeam,omitempty"`
	AwayTeam *Team         `json:"awayTeam,omitempty"`
}

type Team struct {
	Slug  string        `json:"slug"`
	Names LocalizedText `json:"names"`
}

func (m Match) StartTime() (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339, m.StartsAt)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse startsAt for %s: %w", m.ID, err)
	}
	return parsed, nil
}

func (m Match) DisplayTitle(locale string) string {
	if m.HomeTeam != nil && m.AwayTeam != nil {
		homeName := PickLocalized(m.HomeTeam.Names, locale)
		awayName := PickLocalized(m.AwayTeam.Names, locale)
		if homeName != "" && awayName != "" {
			return fmt.Sprintf("%s vs %s", homeName, awayName)
		}
	}
	return m.ID
}

func PickLocalized(value LocalizedText, locale string) string {
	if value == nil {
		return ""
	}
	if text := value[locale]; text != "" {
		return text
	}
	if text := value["en"]; text != "" {
		return text
	}
	for _, text := range value {
		return text
	}
	return ""
}
