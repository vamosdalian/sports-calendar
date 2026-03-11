package mockdata

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

type LocalizedText map[string]string

type Catalog struct {
	UpdatedAt string  `json:"updatedAt"`
	Sports    []Sport `json:"sports"`
}

type Sport struct {
	Slug    string        `json:"slug"`
	Names   LocalizedText `json:"names"`
	Leagues []League      `json:"leagues"`
}

type League struct {
	Slug         string        `json:"slug"`
	Names        LocalizedText `json:"names"`
	CountryNames LocalizedText `json:"countryNames"`
	Seasons      []Season      `json:"seasons"`
}

type Season struct {
	Slug                        string        `json:"slug"`
	Label                       string        `json:"label"`
	Timezone                    string        `json:"timezone"`
	DefaultMatchDurationMinutes int           `json:"defaultMatchDurationMinutes"`
	CalendarDescription         LocalizedText `json:"calendarDescription"`
	DataSourceNote              LocalizedText `json:"dataSourceNote"`
	Notes                       LocalizedText `json:"notes"`
	Matches                     []Match       `json:"matches"`
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

func LoadCatalog(path string) (*Catalog, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read catalog: %w", err)
	}

	var catalog Catalog
	if err := json.Unmarshal(content, &catalog); err != nil {
		return nil, fmt.Errorf("decode catalog: %w", err)
	}

	for sportIndex := range catalog.Sports {
		for leagueIndex := range catalog.Sports[sportIndex].Leagues {
			sort.Slice(catalog.Sports[sportIndex].Leagues[leagueIndex].Seasons, func(i, j int) bool {
				return catalog.Sports[sportIndex].Leagues[leagueIndex].Seasons[i].Slug > catalog.Sports[sportIndex].Leagues[leagueIndex].Seasons[j].Slug
			})
		}
	}

	return &catalog, nil
}

func ParseSeasonYears(slug string) (int, int, error) {
	parts := strings.Split(slug, "-")
	if len(parts) == 1 {
		year, err := strconv.Atoi(parts[0])
		if err != nil {
			return 0, 0, fmt.Errorf("parse season year %q: %w", slug, err)
		}
		return year, year, nil
	}
	if len(parts) == 2 {
		startYear, err := strconv.Atoi(parts[0])
		if err != nil {
			return 0, 0, fmt.Errorf("parse start year %q: %w", slug, err)
		}
		endYear, err := strconv.Atoi(parts[1])
		if err != nil {
			return 0, 0, fmt.Errorf("parse end year %q: %w", slug, err)
		}
		return startYear, endYear, nil
	}
	return 0, 0, fmt.Errorf("unsupported season format: %s", slug)
}

func SeasonContainsYear(slug string, year int) bool {
	startYear, endYear, err := ParseSeasonYears(slug)
	if err != nil {
		return false
	}
	return year >= startYear && year <= endYear
}

func (m Match) StartTime() (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339, m.StartsAt)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse startsAt for %s: %w", m.ID, err)
	}
	return parsed, nil
}

func (t *Ticket) OpenTime() (time.Time, error) {
	if t == nil || t.OpenAt == "" {
		return time.Time{}, nil
	}
	parsed, err := time.Parse(time.RFC3339, t.OpenAt)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse ticket openAt: %w", err)
	}
	return parsed, nil
}

func (m Match) DisplayTitle(locale string) string {
	if title := pickLocalized(m.Title, locale); title != "" {
		return title
	}
	if m.HomeTeam != nil && m.AwayTeam != nil {
		return fmt.Sprintf("%s vs %s", pickLocalized(m.HomeTeam.Names, locale), pickLocalized(m.AwayTeam.Names, locale))
	}
	return m.ID
}

func pickLocalized(value LocalizedText, locale string) string {
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
