package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func (s *Service) CreateMatch(ctx context.Context, input domain.CreateMatchInput) error {
	input.SportSlug = normalizeSlug(input.SportSlug)
	input.LeagueSlug = normalizeSlug(input.LeagueSlug)
	input.SeasonSlug = strings.TrimSpace(input.SeasonSlug)
	input.Round = trimLocalizedText(input.Round)
	input.Status = normalizeManualMatchStatus(input.Status)
	input.HomeTeamID = domain.NormalizeTeamID(input.HomeTeamID)
	input.AwayTeamID = domain.NormalizeTeamID(input.AwayTeamID)

	if input.SportSlug == "" {
		return invalidArgument("sportSlug is required")
	}
	if input.LeagueSlug == "" {
		return invalidArgument("leagueSlug is required")
	}
	if input.SeasonSlug == "" {
		return invalidArgument("seasonSlug is required")
	}
	if err := validateLocalizedText(input.Round, "match round"); err != nil {
		return err
	}
	startsAt, err := time.Parse(time.RFC3339, strings.TrimSpace(input.StartsAt))
	if err != nil {
		return invalidArgument("startsAt must be a valid RFC3339 timestamp")
	}
	input.StartsAt = startsAt.UTC().Format(time.RFC3339)
	input.ExternalID = buildManualMatchExternalID(input.SeasonSlug, startsAt)

	return s.repo.CreateMatch(ctx, input)
}

func (s *Service) UpdateMatch(ctx context.Context, input domain.UpdateMatchInput) error {
	input.SportSlug = normalizeSlug(input.SportSlug)
	input.LeagueSlug = normalizeSlug(input.LeagueSlug)
	input.SeasonSlug = strings.TrimSpace(input.SeasonSlug)
	input.ExternalID = strings.TrimSpace(input.ExternalID)
	input.Round = trimLocalizedText(input.Round)
	input.Status = normalizeManualMatchStatus(input.Status)
	input.HomeTeamID = domain.NormalizeTeamID(input.HomeTeamID)
	input.AwayTeamID = domain.NormalizeTeamID(input.AwayTeamID)

	if input.SportSlug == "" {
		return invalidArgument("sportSlug is required")
	}
	if input.LeagueSlug == "" {
		return invalidArgument("leagueSlug is required")
	}
	if input.SeasonSlug == "" {
		return invalidArgument("seasonSlug is required")
	}
	if !strings.HasPrefix(input.ExternalID, "manual:") {
		return invalidArgument("only manual matches can be edited")
	}
	if err := validateLocalizedText(input.Round, "match round"); err != nil {
		return err
	}
	startsAt, err := time.Parse(time.RFC3339, strings.TrimSpace(input.StartsAt))
	if err != nil {
		return invalidArgument("startsAt must be a valid RFC3339 timestamp")
	}
	input.StartsAt = startsAt.UTC().Format(time.RFC3339)

	return s.repo.UpdateMatch(ctx, input)
}

func (s *Service) DeleteMatch(ctx context.Context, input domain.DeleteMatchInput) error {
	input.SportSlug = normalizeSlug(input.SportSlug)
	input.LeagueSlug = normalizeSlug(input.LeagueSlug)
	input.SeasonSlug = strings.TrimSpace(input.SeasonSlug)
	input.ExternalID = strings.TrimSpace(input.ExternalID)

	if input.SportSlug == "" {
		return invalidArgument("sportSlug is required")
	}
	if input.LeagueSlug == "" {
		return invalidArgument("leagueSlug is required")
	}
	if input.SeasonSlug == "" {
		return invalidArgument("seasonSlug is required")
	}
	if !strings.HasPrefix(input.ExternalID, "manual:") {
		return invalidArgument("only manual matches can be deleted")
	}

	return s.repo.DeleteMatch(ctx, input)
}

func normalizeManualMatchStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "scheduled":
		return "scheduled"
	case "finished":
		return "finished"
	case "cancelled":
		return "cancelled"
	case "postponed":
		return "postponed"
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}

func buildManualMatchExternalID(seasonSlug string, startsAt time.Time) string {
	return fmt.Sprintf("manual:%s:%s:%d", seasonSlug, startsAt.UTC().Format("20060102t150405"), time.Now().UTC().UnixNano())
}
