package service

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/ics"
)

var ErrNotFound = domain.ErrNotFound

type readRepository interface {
	ListLeagues(ctx context.Context) ([]domain.SportDirectoryItem, string, error)
	ListLeagueSeasons(ctx context.Context, sportSlug, leagueSlug string) (domain.LeagueSeasons, error)
	GetLeagueSeason(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.SeasonDetail, error)
}

type Service struct {
	repo readRepository
}

type SportDirectoryItem = domain.SportDirectoryItem
type LeagueReference = domain.LeagueReference
type SeasonReference = domain.SeasonReference
type LeagueSeasons = domain.LeagueSeasons
type MatchGroup = domain.MatchGroup
type SeasonDetail = domain.SeasonDetail

type LeaguesResponse struct {
	Items     []domain.SportDirectoryItem `json:"items"`
	UpdatedAt string                      `json:"updatedAt"`
}

func New(repo readRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListLeagues(ctx context.Context) (LeaguesResponse, error) {
	items, updatedAt, err := s.repo.ListLeagues(ctx)
	if err != nil {
		return LeaguesResponse{}, err
	}
	return LeaguesResponse{Items: items, UpdatedAt: updatedAt}, nil
}

func (s *Service) ListLeagueSeasons(ctx context.Context, sportSlug, leagueSlug string) (LeagueSeasons, error) {
	payload, err := s.repo.ListLeagueSeasons(ctx, sportSlug, leagueSlug)
	if err != nil {
		return LeagueSeasons{}, err
	}
	return payload, nil
}

func (s *Service) GetLeagueSeason(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) (SeasonDetail, error) {
	detail, err := s.repo.GetLeagueSeason(ctx, sportSlug, leagueSlug, seasonSlug)
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
	detail.Groups = groupMatches(matches)
	return detail, nil
}

func (s *Service) BuildSeasonICS(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) ([]byte, error) {
	detail, err := s.GetLeagueSeason(ctx, sportSlug, leagueSlug, seasonSlug)
	if err != nil {
		return nil, err
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

func groupMatches(matches []domain.Match) []domain.MatchGroup {
	if len(matches) == 0 {
		return nil
	}

	type groupState struct {
		key   string
		label domain.LocalizedText
		items []domain.Match
	}

	ordered := make([]groupState, 0)
	indexByKey := make(map[string]int)

	for _, match := range matches {
		key := groupKey(match)
		index, exists := indexByKey[key]
		if !exists {
			ordered = append(ordered, groupState{
				key:   key,
				label: groupLabel(match, key),
				items: make([]domain.Match, 0, 1),
			})
			index = len(ordered) - 1
			indexByKey[key] = index
		}
		ordered[index].items = append(ordered[index].items, match)
	}

	groups := make([]domain.MatchGroup, 0, len(ordered))
	for _, state := range ordered {
		groups = append(groups, domain.MatchGroup{
			Key:     state.key,
			Label:   state.label,
			Matches: state.items,
		})
	}
	return groups
}

func groupKey(match domain.Match) string {
	if len(match.Round) > 0 {
		if text := domain.PickLocalized(match.Round, "en"); text != "" {
			return text
		}
		for _, text := range match.Round {
			if text != "" {
				return text
			}
		}
	}
	return fmt.Sprintf("match-%s", match.ID)
}

func groupLabel(match domain.Match, key string) domain.LocalizedText {
	if len(match.Round) > 0 {
		return match.Round
	}
	return domain.LocalizedText{"en": key}
}
