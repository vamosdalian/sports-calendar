package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrNotFound = errors.New("resource not found")
var ErrConflict = errors.New("resource conflict")
var ErrInvalidArgument = errors.New("invalid argument")

const UnknownTeamID int64 = -1

type LocalizedText map[string]string

type SeasonReference struct {
	Slug  string `json:"slug"`
	Label string `json:"label"`
}

type LeagueReference struct {
	LeagueSlug    string          `json:"leagueSlug"`
	LeagueNames   LocalizedText   `json:"leagueNames"`
	Show          bool            `json:"show"`
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
	ID         string        `json:"id"`
	Round      LocalizedText `json:"round"`
	StartsAt   string        `json:"startsAt"`
	Status     string        `json:"status"`
	VenueID    *int64        `json:"venueId,omitempty"`
	Venue      LocalizedText `json:"venue"`
	City       LocalizedText `json:"city"`
	Country    LocalizedText `json:"country"`
	HomeTeamID int64         `json:"homeTeamID,omitempty"`
	AwayTeamID int64         `json:"awayTeamID,omitempty"`
	HomeTeam   *Team         `json:"homeTeam,omitempty"`
	AwayTeam   *Team         `json:"awayTeam,omitempty"`
}

type Team struct {
	Slug  string        `json:"slug"`
	Names LocalizedText `json:"names"`
}

type SportRecord struct {
	ID        int64         `json:"id"`
	Slug      string        `json:"slug"`
	Name      LocalizedText `json:"name"`
	CreatedAt string        `json:"createdAt"`
	UpdatedAt string        `json:"updatedAt"`
}

type LeagueRecord struct {
	ID                  int64         `json:"id"`
	SportSlug           string        `json:"sportSlug"`
	Slug                string        `json:"slug"`
	Name                LocalizedText `json:"name"`
	Show                bool          `json:"show"`
	SyncInterval        string        `json:"syncInterval"`
	CalendarDescription LocalizedText `json:"calendarDescription"`
	DataSourceNote      LocalizedText `json:"dataSourceNote"`
	Notes               LocalizedText `json:"notes"`
	CreatedAt           string        `json:"createdAt"`
	UpdatedAt           string        `json:"updatedAt"`
}

type SeasonRecord struct {
	ID                          int64  `json:"id"`
	SportSlug                   string `json:"sportSlug"`
	LeagueSlug                  string `json:"leagueSlug"`
	Slug                        string `json:"slug"`
	Label                       string `json:"label"`
	Show                        bool   `json:"show"`
	StartYear                   int    `json:"startYear"`
	EndYear                     int    `json:"endYear"`
	DefaultMatchDurationMinutes int    `json:"defaultMatchDurationMinutes"`
	CreatedAt                   string `json:"createdAt"`
	UpdatedAt                   string `json:"updatedAt"`
}

type VenueRecord struct {
	ID        int64         `json:"id"`
	Name      LocalizedText `json:"name"`
	City      LocalizedText `json:"city"`
	Country   LocalizedText `json:"country"`
	CreatedAt string        `json:"createdAt"`
	UpdatedAt string        `json:"updatedAt"`
}

type CreateSportInput struct {
	ID   int64         `json:"id"`
	Slug string        `json:"slug"`
	Name LocalizedText `json:"name"`
}

type UpdateSportInput struct {
	CurrentSlug string        `json:"-"`
	Slug        string        `json:"slug"`
	Name        LocalizedText `json:"name"`
}

type CreateLeagueInput struct {
	ID                  int64         `json:"id"`
	SportSlug           string        `json:"sportSlug"`
	Slug                string        `json:"slug"`
	Name                LocalizedText `json:"name"`
	Show                bool          `json:"show"`
	SyncInterval        string        `json:"syncInterval"`
	CalendarDescription LocalizedText `json:"calendarDescription"`
	DataSourceNote      LocalizedText `json:"dataSourceNote"`
	Notes               LocalizedText `json:"notes"`
}

type UpdateLeagueInput struct {
	SportSlug           string        `json:"-"`
	CurrentSlug         string        `json:"-"`
	Slug                string        `json:"slug"`
	Name                LocalizedText `json:"name"`
	Show                bool          `json:"show"`
	SyncInterval        string        `json:"syncInterval"`
	CalendarDescription LocalizedText `json:"calendarDescription"`
	DataSourceNote      LocalizedText `json:"dataSourceNote"`
	Notes               LocalizedText `json:"notes"`
}

type CreateSeasonInput struct {
	SportSlug                   string `json:"sportSlug"`
	LeagueSlug                  string `json:"leagueSlug"`
	Slug                        string `json:"slug"`
	Label                       string `json:"label"`
	Show                        bool   `json:"show"`
	StartYear                   int    `json:"startYear"`
	EndYear                     int    `json:"endYear"`
	DefaultMatchDurationMinutes int    `json:"defaultMatchDurationMinutes"`
}

type UpdateSeasonInput struct {
	SportSlug                   string `json:"-"`
	LeagueSlug                  string `json:"-"`
	CurrentSlug                 string `json:"-"`
	Slug                        string `json:"slug"`
	Label                       string `json:"label"`
	Show                        bool   `json:"show"`
	StartYear                   int    `json:"startYear"`
	EndYear                     int    `json:"endYear"`
	DefaultMatchDurationMinutes int    `json:"defaultMatchDurationMinutes"`
}

type UpdateTeamInput struct {
	SportSlug  string        `json:"-"`
	LeagueSlug string        `json:"-"`
	TeamID     int64         `json:"-"`
	Name       LocalizedText `json:"name"`
}

type DeleteSeasonInput struct {
	SportSlug  string
	LeagueSlug string
	SeasonSlug string
}

type CreateMatchInput struct {
	SportSlug  string        `json:"sportSlug"`
	LeagueSlug string        `json:"leagueSlug"`
	SeasonSlug string        `json:"seasonSlug"`
	ExternalID string        `json:"externalId,omitempty"`
	HomeTeamID int64         `json:"homeTeamID"`
	AwayTeamID int64         `json:"awayTeamID"`
	Round      LocalizedText `json:"round"`
	StartsAt   string        `json:"startsAt"`
	Status     string        `json:"status"`
	VenueID    *int64        `json:"venueId"`
}

type UpdateMatchInput struct {
	SportSlug  string        `json:"sportSlug"`
	LeagueSlug string        `json:"leagueSlug"`
	SeasonSlug string        `json:"seasonSlug"`
	ExternalID string        `json:"externalId"`
	HomeTeamID int64         `json:"homeTeamID"`
	AwayTeamID int64         `json:"awayTeamID"`
	Round      LocalizedText `json:"round"`
	StartsAt   string        `json:"startsAt"`
	Status     string        `json:"status"`
	VenueID    *int64        `json:"venueId"`
}

type CreateVenueInput struct {
	ID      int64         `json:"id"`
	Name    LocalizedText `json:"name"`
	City    LocalizedText `json:"city"`
	Country LocalizedText `json:"country"`
}

type UpdateVenueInput struct {
	ID      int64         `json:"-"`
	Name    LocalizedText `json:"name"`
	City    LocalizedText `json:"city"`
	Country LocalizedText `json:"country"`
}

type DeleteMatchInput struct {
	SportSlug  string
	LeagueSlug string
	SeasonSlug string
	ExternalID string
}

type DeleteSportInput struct {
	SportSlug string
}

type DeleteLeagueInput struct {
	SportSlug  string
	LeagueSlug string
}

type RefreshSeasonInput struct {
	SportSlug  string
	LeagueSlug string
	SeasonSlug string
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
			return fmt.Sprintf("%s%s%s", homeName, versusSeparator(locale), awayName)
		}
	}
	return m.ID
}

func versusSeparator(locale string) string {
	if strings.HasPrefix(locale, "zh") {
		return " 对阵 "
	}
	return " vs "
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

func NormalizeTeamID(teamID int64) int64 {
	if teamID <= 0 {
		return UnknownTeamID
	}
	return teamID
}

func UnknownTeam() Team {
	return Team{
		Slug:  "unknown",
		Names: UnknownTeamNames(),
	}
}

func UnknownTeamNames() LocalizedText {
	return LocalizedText{
		"en": "Unknown team",
		"zh": "未知球队",
	}
}
