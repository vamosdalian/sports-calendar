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

type LeagueSeasonReference struct {
	LeagueSlug   string            `json:"leagueSlug"`
	LeagueNames  LocalizedText     `json:"leagueNames"`
	CountryNames LocalizedText     `json:"countryNames"`
	Seasons      []SeasonReference `json:"seasons"`
}

type SportsYearItem struct {
	SportSlug  string                  `json:"sportSlug"`
	SportNames LocalizedText           `json:"sportNames"`
	Leagues    []LeagueSeasonReference `json:"leagues"`
}

type SeasonDetail struct {
	SportSlug                   string            `json:"sportSlug"`
	SportNames                  LocalizedText     `json:"sportNames"`
	LeagueSlug                  string            `json:"leagueSlug"`
	LeagueNames                 LocalizedText     `json:"leagueNames"`
	CountryNames                LocalizedText     `json:"countryNames"`
	SeasonSlug                  string            `json:"seasonSlug"`
	SeasonLabel                 string            `json:"seasonLabel"`
	Timezone                    string            `json:"timezone"`
	DefaultMatchDurationMinutes int               `json:"defaultMatchDurationMinutes"`
	AvailableSeasons            []SeasonReference `json:"availableSeasons"`
	CalendarDescription         LocalizedText     `json:"calendarDescription"`
	DataSourceNote              LocalizedText     `json:"dataSourceNote"`
	Notes                       LocalizedText     `json:"notes"`
	Matches                     []Match           `json:"matches"`
	UpdatedAt                   string            `json:"updatedAt"`
}

type Match struct {
	ID       string        `json:"id"`
	Round    string        `json:"round"`
	Title    LocalizedText `json:"title"`
	StartsAt string        `json:"startsAt"`
	Status   string        `json:"status"`
	Venue    string        `json:"venue"`
	City     string        `json:"city"`
	HomeTeam *Team         `json:"homeTeam,omitempty"`
	AwayTeam *Team         `json:"awayTeam,omitempty"`
	Ticket   *Ticket       `json:"ticket,omitempty"`
}

type Team struct {
	Slug  string        `json:"slug"`
	Names LocalizedText `json:"names"`
}

type Ticket struct {
	OpenAt       string        `json:"openAt"`
	URL          string        `json:"url"`
	ChannelNames LocalizedText `json:"channelNames"`
}

func (m Match) StartTime() (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339, m.StartsAt)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse startsAt for %s: %w", m.ID, err)
	}
	return parsed, nil
}

func (m Match) DisplayTitle(locale string) string {
	if title := PickLocalized(m.Title, locale); title != "" {
		return title
	}
	if m.HomeTeam != nil && m.AwayTeam != nil {
		return fmt.Sprintf("%s vs %s", PickLocalized(m.HomeTeam.Names, locale), PickLocalized(m.AwayTeam.Names, locale))
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
