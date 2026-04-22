package service

import (
	"context"
	"strings"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func (s *Service) RefreshSeasonNow(ctx context.Context, input domain.RefreshSeasonInput) (domain.RefreshEnqueueResponse, error) {
	if s.executor == nil {
		return domain.RefreshEnqueueResponse{}, invalidArgument("refresh executor is not configured")
	}

	input.SportSlug = normalizeSlug(input.SportSlug)
	input.LeagueSlug = normalizeSlug(input.LeagueSlug)
	input.SeasonSlug = strings.TrimSpace(input.SeasonSlug)

	if input.SportSlug == "" {
		return domain.RefreshEnqueueResponse{}, invalidArgument("sportSlug is required")
	}
	if input.LeagueSlug == "" {
		return domain.RefreshEnqueueResponse{}, invalidArgument("leagueSlug is required")
	}
	if input.SeasonSlug == "" {
		return domain.RefreshEnqueueResponse{}, invalidArgument("seasonSlug is required")
	}

	target, err := s.repo.GetSeasonSyncTarget(ctx, input.SportSlug, input.LeagueSlug, input.SeasonSlug)
	if err != nil {
		return domain.RefreshEnqueueResponse{}, err
	}

	return s.executor.Enqueue(target, domain.RefreshRequestSourceManual), nil
}

func (s *Service) UpdateSport(ctx context.Context, input domain.UpdateSportInput) (SportRecord, error) {
	input.CurrentSlug = normalizeSlug(input.CurrentSlug)
	input.Slug = normalizeSlug(input.Slug)
	input.Name = trimLocalizedText(input.Name)
	if input.CurrentSlug == "" {
		return SportRecord{}, invalidArgument("current sport slug is required")
	}
	if input.Slug == "" {
		return SportRecord{}, invalidArgument("sport slug is required")
	}
	if err := validateLocalizedText(input.Name, "sport name"); err != nil {
		return SportRecord{}, err
	}
	record, err := s.repo.UpdateSport(ctx, input)
	if err != nil {
		return SportRecord{}, err
	}
	return record, nil
}

func (s *Service) UpdateLeague(ctx context.Context, input domain.UpdateLeagueInput) (LeagueRecord, error) {
	input.SportSlug = normalizeSlug(input.SportSlug)
	input.CurrentSlug = normalizeSlug(input.CurrentSlug)
	input.Slug = normalizeSlug(input.Slug)
	input.Name = trimLocalizedText(input.Name)
	input.SyncInterval = strings.TrimSpace(input.SyncInterval)
	input.CalendarDescription = trimLocalizedText(input.CalendarDescription)
	input.DataSourceNote = trimLocalizedText(input.DataSourceNote)
	input.Notes = trimLocalizedText(input.Notes)
	if input.SportSlug == "" {
		return LeagueRecord{}, invalidArgument("sportSlug is required")
	}
	if input.CurrentSlug == "" {
		return LeagueRecord{}, invalidArgument("current league slug is required")
	}
	if input.Slug == "" {
		return LeagueRecord{}, invalidArgument("league slug is required")
	}
	if err := validateLocalizedText(input.Name, "league name"); err != nil {
		return LeagueRecord{}, err
	}
	if input.SyncInterval == "" {
		input.SyncInterval = "@daily"
	}
	record, err := s.repo.UpdateLeague(ctx, input)
	if err != nil {
		return LeagueRecord{}, err
	}
	s.refreshSyncSchedule()
	return record, nil
}

func (s *Service) UpdateTeam(ctx context.Context, input domain.UpdateTeamInput) (domain.AdminTeamItem, error) {
	input.SportSlug = normalizeSlug(input.SportSlug)
	input.LeagueSlug = normalizeSlug(input.LeagueSlug)
	input.Name = trimLocalizedText(input.Name)
	if input.SportSlug == "" {
		return domain.AdminTeamItem{}, invalidArgument("sportSlug is required")
	}
	if input.LeagueSlug == "" {
		return domain.AdminTeamItem{}, invalidArgument("leagueSlug is required")
	}
	if input.TeamID <= 0 {
		return domain.AdminTeamItem{}, invalidArgument("teamID must be a positive integer")
	}
	if err := validateLocalizedText(input.Name, "team name"); err != nil {
		return domain.AdminTeamItem{}, err
	}
	return s.repo.UpdateTeam(ctx, input)
}

func (s *Service) UpdateSeason(ctx context.Context, input domain.UpdateSeasonInput) (SeasonRecord, error) {
	input.SportSlug = normalizeSlug(input.SportSlug)
	input.LeagueSlug = normalizeSlug(input.LeagueSlug)
	input.CurrentSlug = strings.TrimSpace(input.CurrentSlug)
	input.Slug = strings.TrimSpace(input.CurrentSlug)
	input.Label = strings.TrimSpace(input.Label)
	if input.SportSlug == "" {
		return SeasonRecord{}, invalidArgument("sportSlug is required")
	}
	if input.LeagueSlug == "" {
		return SeasonRecord{}, invalidArgument("leagueSlug is required")
	}
	if input.CurrentSlug == "" {
		return SeasonRecord{}, invalidArgument("current season slug is required")
	}
	if input.Slug == "" {
		return SeasonRecord{}, invalidArgument("season slug is required")
	}
	if input.Label == "" {
		return SeasonRecord{}, invalidArgument("season label is required")
	}
	if input.StartYear <= 0 || input.EndYear <= 0 {
		return SeasonRecord{}, invalidArgument("season years must be positive")
	}
	if input.EndYear < input.StartYear {
		return SeasonRecord{}, invalidArgument("endYear must be greater than or equal to startYear")
	}
	if input.DefaultMatchDurationMinutes <= 0 {
		input.DefaultMatchDurationMinutes = 120
	}
	record, err := s.repo.UpdateSeason(ctx, input)
	if err != nil {
		return SeasonRecord{}, err
	}
	s.refreshSyncSchedule()
	return record, nil
}
