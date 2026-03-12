package service

import (
	"context"
	"sort"
	"time"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/ics"
)

var ErrNotFound = domain.ErrNotFound

type readRepository interface {
	ListYears(ctx context.Context) ([]int, string, error)
	ListSportsByYear(ctx context.Context, year int) ([]domain.SportsYearItem, string, error)
	GetLeagueSeason(ctx context.Context, leagueSlug, seasonSlug string) (domain.SeasonDetail, error)
}

type Service struct {
	repo readRepository
}

type YearsResponse struct {
	Years     []int  `json:"years"`
	UpdatedAt string `json:"updatedAt"`
}

type SportsYearItem = domain.SportsYearItem
type LeagueSeasonReference = domain.LeagueSeasonReference
type SeasonReference = domain.SeasonReference
type SeasonDetail = domain.SeasonDetail

type SportsYearResponse struct {
	Year      int                     `json:"year"`
	Items     []domain.SportsYearItem `json:"items"`
	UpdatedAt string                  `json:"updatedAt"`
}

func New(repo readRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListYears(ctx context.Context) (YearsResponse, error) {
	years, updatedAt, err := s.repo.ListYears(ctx)
	if err != nil {
		return YearsResponse{}, err
	}
	sort.Slice(years, func(i, j int) bool {
		return years[i] > years[j]
	})
	return YearsResponse{Years: years, UpdatedAt: updatedAt}, nil
}

func (s *Service) ListSportsByYear(ctx context.Context, year int) (SportsYearResponse, error) {
	items, updatedAt, err := s.repo.ListSportsByYear(ctx, year)
	if err != nil {
		return SportsYearResponse{}, err
	}
	return SportsYearResponse{Year: year, Items: items, UpdatedAt: updatedAt}, nil
}

func (s *Service) GetLeagueSeason(ctx context.Context, leagueSlug, seasonSlug string) (SeasonDetail, error) {
	detail, err := s.repo.GetLeagueSeason(ctx, leagueSlug, seasonSlug)
	if err != nil {
		return SeasonDetail{}, err
	}
	matches := append([]domain.Match(nil), detail.Matches...)
	sort.Slice(matches, func(i, j int) bool {
		left, _ := matches[i].StartTime()
		right, _ := matches[j].StartTime()
		return left.Before(right)
	})
	detail.Matches = matches
	return detail, nil
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
