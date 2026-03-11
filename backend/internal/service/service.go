package service

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/vamosdalian/sports-calendar/backend/internal/ics"
	"github.com/vamosdalian/sports-calendar/backend/internal/mockdata"
)

var ErrNotFound = errors.New("resource not found")

type catalogProvider interface {
	Catalog(ctx context.Context) (*mockdata.Catalog, error)
}

type Service struct {
	repo catalogProvider
}

type YearsResponse struct {
	Years     []int  `json:"years"`
	UpdatedAt string `json:"updatedAt"`
}

type SportsYearResponse struct {
	Year      int              `json:"year"`
	Items     []SportsYearItem `json:"items"`
	UpdatedAt string           `json:"updatedAt"`
}

type SportsYearItem struct {
	SportSlug  string                  `json:"sportSlug"`
	SportNames mockdata.LocalizedText  `json:"sportNames"`
	Leagues    []LeagueSeasonReference `json:"leagues"`
}

type LeagueSeasonReference struct {
	LeagueSlug   string                 `json:"leagueSlug"`
	LeagueNames  mockdata.LocalizedText `json:"leagueNames"`
	CountryNames mockdata.LocalizedText `json:"countryNames"`
	Seasons      []SeasonReference      `json:"seasons"`
}

type SeasonReference struct {
	Slug  string `json:"slug"`
	Label string `json:"label"`
}

type CatalogSummaryResponse struct {
	UpdatedAt string                `json:"updatedAt"`
	Sports    []CatalogSportSummary `json:"sports"`
}

type CatalogSportSummary struct {
	Slug    string                 `json:"slug"`
	Name    string                 `json:"name"`
	Leagues []CatalogLeagueSummary `json:"leagues"`
}

type CatalogLeagueSummary struct {
	Slug        string            `json:"slug"`
	Name        string            `json:"name"`
	CountryName string            `json:"countryName"`
	Seasons     []SeasonReference `json:"seasons"`
}

type SeasonDetail struct {
	SportSlug                   string                 `json:"sportSlug"`
	SportNames                  mockdata.LocalizedText `json:"sportNames"`
	LeagueSlug                  string                 `json:"leagueSlug"`
	LeagueNames                 mockdata.LocalizedText `json:"leagueNames"`
	CountryNames                mockdata.LocalizedText `json:"countryNames"`
	SeasonSlug                  string                 `json:"seasonSlug"`
	SeasonLabel                 string                 `json:"seasonLabel"`
	Timezone                    string                 `json:"timezone"`
	DefaultMatchDurationMinutes int                    `json:"defaultMatchDurationMinutes"`
	AvailableSeasons            []SeasonReference      `json:"availableSeasons"`
	CalendarDescription         mockdata.LocalizedText `json:"calendarDescription"`
	DataSourceNote              mockdata.LocalizedText `json:"dataSourceNote"`
	Notes                       mockdata.LocalizedText `json:"notes"`
	Matches                     []mockdata.Match       `json:"matches"`
	UpdatedAt                   string                 `json:"updatedAt"`
}

func New(repo catalogProvider) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListYears(ctx context.Context) (YearsResponse, error) {
	catalog, err := s.repo.Catalog(ctx)
	if err != nil {
		return YearsResponse{}, err
	}

	values := map[int]struct{}{}
	for _, sport := range catalog.Sports {
		for _, league := range sport.Leagues {
			for _, season := range league.Seasons {
				startYear, endYear, parseErr := mockdata.ParseSeasonYears(season.Slug)
				if parseErr != nil {
					continue
				}
				for year := startYear; year <= endYear; year++ {
					values[year] = struct{}{}
				}
			}
		}
	}

	years := make([]int, 0, len(values))
	for year := range values {
		years = append(years, year)
	}
	sort.Slice(years, func(i, j int) bool {
		return years[i] > years[j]
	})

	return YearsResponse{Years: years, UpdatedAt: catalog.UpdatedAt}, nil
}

func (s *Service) ListSportsByYear(ctx context.Context, year int) (SportsYearResponse, error) {
	catalog, err := s.repo.Catalog(ctx)
	if err != nil {
		return SportsYearResponse{}, err
	}

	items := make([]SportsYearItem, 0, len(catalog.Sports))
	for _, sport := range catalog.Sports {
		item := SportsYearItem{
			SportSlug:  sport.Slug,
			SportNames: sport.Names,
		}
		for _, league := range sport.Leagues {
			ref := LeagueSeasonReference{
				LeagueSlug:   league.Slug,
				LeagueNames:  league.Names,
				CountryNames: league.CountryNames,
			}
			for _, season := range league.Seasons {
				if mockdata.SeasonContainsYear(season.Slug, year) {
					ref.Seasons = append(ref.Seasons, SeasonReference{Slug: season.Slug, Label: season.Label})
				}
			}
			if len(ref.Seasons) > 0 {
				item.Leagues = append(item.Leagues, ref)
			}
		}
		if len(item.Leagues) > 0 {
			items = append(items, item)
		}
	}

	return SportsYearResponse{Year: year, Items: items, UpdatedAt: catalog.UpdatedAt}, nil
}

func (s *Service) GetCatalogSummary(ctx context.Context, locale string) (CatalogSummaryResponse, error) {
	catalog, err := s.repo.Catalog(ctx)
	if err != nil {
		return CatalogSummaryResponse{}, err
	}

	sports := make([]CatalogSportSummary, 0, len(catalog.Sports))
	for _, sport := range catalog.Sports {
		leagues := make([]CatalogLeagueSummary, 0, len(sport.Leagues))
		for _, league := range sport.Leagues {
			seasons := make([]SeasonReference, 0, len(league.Seasons))
			for _, season := range league.Seasons {
				seasons = append(seasons, SeasonReference{Slug: season.Slug, Label: season.Label})
			}

			leagues = append(leagues, CatalogLeagueSummary{
				Slug:        league.Slug,
				Name:        pickLocalized(league.Names, locale),
				CountryName: pickLocalized(league.CountryNames, locale),
				Seasons:     seasons,
			})
		}

		sports = append(sports, CatalogSportSummary{
			Slug:    sport.Slug,
			Name:    pickLocalized(sport.Names, locale),
			Leagues: leagues,
		})
	}

	return CatalogSummaryResponse{UpdatedAt: catalog.UpdatedAt, Sports: sports}, nil
}

func (s *Service) GetLeagueSeason(ctx context.Context, leagueSlug, seasonSlug string) (SeasonDetail, error) {
	catalog, err := s.repo.Catalog(ctx)
	if err != nil {
		return SeasonDetail{}, err
	}

	for _, sport := range catalog.Sports {
		for _, league := range sport.Leagues {
			if league.Slug != leagueSlug {
				continue
			}

			selectedSeason := seasonSlug
			if selectedSeason == "" && len(league.Seasons) > 0 {
				selectedSeason = league.Seasons[0].Slug
			}

			available := make([]SeasonReference, 0, len(league.Seasons))
			for _, season := range league.Seasons {
				available = append(available, SeasonReference{Slug: season.Slug, Label: season.Label})
			}

			for _, season := range league.Seasons {
				if season.Slug == selectedSeason {
					matches := append([]mockdata.Match(nil), season.Matches...)
					sort.Slice(matches, func(i, j int) bool {
						left, _ := matches[i].StartTime()
						right, _ := matches[j].StartTime()
						return left.Before(right)
					})
					return SeasonDetail{
						SportSlug:                   sport.Slug,
						SportNames:                  sport.Names,
						LeagueSlug:                  league.Slug,
						LeagueNames:                 league.Names,
						CountryNames:                league.CountryNames,
						SeasonSlug:                  season.Slug,
						SeasonLabel:                 season.Label,
						Timezone:                    season.Timezone,
						DefaultMatchDurationMinutes: season.DefaultMatchDurationMinutes,
						AvailableSeasons:            available,
						CalendarDescription:         season.CalendarDescription,
						DataSourceNote:              season.DataSourceNote,
						Notes:                       season.Notes,
						Matches:                     matches,
						UpdatedAt:                   catalog.UpdatedAt,
					}, nil
				}
			}
			return SeasonDetail{}, ErrNotFound
		}
	}

	return SeasonDetail{}, ErrNotFound
}

func (s *Service) BuildSeasonICS(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) ([]byte, error) {
	detail, err := s.GetLeagueSeason(ctx, leagueSlug, seasonSlug)
	if err != nil {
		return nil, err
	}
	if detail.SportSlug != sportSlug {
		return nil, ErrNotFound
	}
	return ics.BuildCalendar(ics.CalendarPayload{
		SportSlug:                   detail.SportSlug,
		LeagueSlug:                  detail.LeagueSlug,
		LeagueNames:                 detail.LeagueNames,
		SeasonLabel:                 detail.SeasonLabel,
		DefaultMatchDurationMinutes: detail.DefaultMatchDurationMinutes,
		Matches:                     detail.Matches,
	}, time.Now().UTC())
}

func pickLocalized(value map[string]string, locale string) string {
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
