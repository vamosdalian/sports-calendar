package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func (s *Service) SetSportsDataProvider(provider sportsDataProvider) {
	s.provider = provider
}

func (s *Service) ListExternalSports(ctx context.Context) (domain.AdminExternalSportsResponse, error) {
	if s.provider == nil {
		return domain.AdminExternalSportsResponse{}, fmt.Errorf("sports data provider is not configured")
	}
	items, err := s.provider.ListSports(ctx)
	if err != nil {
		return domain.AdminExternalSportsResponse{}, err
	}
	return domain.AdminExternalSportsResponse{Items: items}, nil
}

func (s *Service) ListExternalLeagues(ctx context.Context, sportSlug string) (domain.AdminExternalLeaguesResponse, error) {
	if s.provider == nil {
		return domain.AdminExternalLeaguesResponse{}, fmt.Errorf("sports data provider is not configured")
	}
	sportSlug = normalizeSlug(sportSlug)
	if sportSlug == "" {
		return domain.AdminExternalLeaguesResponse{}, invalidArgument("sport slug is required")
	}
	sportName, err := s.lookupSportName(ctx, sportSlug)
	if err != nil {
		return domain.AdminExternalLeaguesResponse{}, err
	}
	items, err := s.provider.ListLeaguesBySport(ctx, sportName)
	if err != nil {
		return domain.AdminExternalLeaguesResponse{}, err
	}
	return domain.AdminExternalLeaguesResponse{SportSlug: sportSlug, Items: items}, nil
}

func (s *Service) LookupExternalLeague(ctx context.Context, leagueID int64) (domain.AdminExternalLeagueLookup, error) {
	if s.provider == nil {
		return domain.AdminExternalLeagueLookup{}, fmt.Errorf("sports data provider is not configured")
	}
	if leagueID <= 0 {
		return domain.AdminExternalLeagueLookup{}, invalidArgument("league id is required")
	}
	return s.provider.LookupLeague(ctx, leagueID)
}

func (s *Service) ListExternalSeasons(ctx context.Context, sportSlug, leagueSlug string) (domain.AdminExternalSeasonsResponse, error) {
	if s.provider == nil {
		return domain.AdminExternalSeasonsResponse{}, fmt.Errorf("sports data provider is not configured")
	}
	sportSlug = normalizeSlug(sportSlug)
	leagueSlug = normalizeSlug(leagueSlug)
	if sportSlug == "" {
		return domain.AdminExternalSeasonsResponse{}, invalidArgument("sport slug is required")
	}
	if leagueSlug == "" {
		return domain.AdminExternalSeasonsResponse{}, invalidArgument("league slug is required")
	}
	leagueID, err := s.lookupLeagueID(ctx, sportSlug, leagueSlug)
	if err != nil {
		return domain.AdminExternalSeasonsResponse{}, err
	}
	items, err := s.provider.ListSeasons(ctx, leagueID)
	if err != nil {
		return domain.AdminExternalSeasonsResponse{}, err
	}
	return domain.AdminExternalSeasonsResponse{SportSlug: sportSlug, LeagueSlug: leagueSlug, Items: items}, nil
}

func (s *Service) lookupSportName(ctx context.Context, sportSlug string) (string, error) {
	payload, err := s.repo.ListAdminSports(ctx)
	if err != nil {
		return "", err
	}
	for _, item := range payload.Items {
		if normalizeSlug(item.Slug) != sportSlug {
			continue
		}
		name := strings.TrimSpace(item.Name["en"])
		if name == "" {
			name = strings.TrimSpace(domain.PickLocalized(item.Name, "en"))
		}
		if name == "" {
			return "", invalidArgument("sport must include an english name")
		}
		return name, nil
	}
	return "", fmt.Errorf("%w: sport not found", ErrNotFound)
}

func (s *Service) lookupLeagueID(ctx context.Context, sportSlug, leagueSlug string) (int64, error) {
	payload, err := s.repo.ListAdminLeagues(ctx, sportSlug)
	if err != nil {
		return 0, err
	}
	for _, item := range payload.Items {
		if normalizeSlug(item.Slug) == leagueSlug {
			return item.ID, nil
		}
	}
	return 0, fmt.Errorf("%w: league not found", ErrNotFound)
}
