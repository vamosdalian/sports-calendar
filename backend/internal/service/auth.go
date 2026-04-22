package service

import (
	"context"
	"fmt"
	"net/mail"
	"sort"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/vamosdalian/sports-calendar/backend/internal/auth"
	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

type tokenManager interface {
	Sign(email string, now time.Time) (domain.AuthToken, error)
	Verify(token string, now time.Time) (domain.TokenClaims, error)
}

func (s *Service) SetTokenManager(manager tokenManager) {
	s.tokenManager = manager
}

func (s *Service) RegisterAdmin(ctx context.Context, input domain.RegisterAdminInput) (domain.UserRecord, error) {
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	if _, err := mail.ParseAddress(input.Email); err != nil {
		return domain.UserRecord{}, invalidArgument("valid email is required")
	}
	if len(strings.TrimSpace(input.Password)) < 8 {
		return domain.UserRecord{}, invalidArgument("password must be at least 8 characters")
	}
	count, err := s.repo.CountUsers(ctx)
	if err != nil {
		return domain.UserRecord{}, err
	}
	if count > 0 {
		return domain.UserRecord{}, fmt.Errorf("%w: admin bootstrap already completed", ErrConflict)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return domain.UserRecord{}, fmt.Errorf("hash password: %w", err)
	}
	return s.repo.CreateUser(ctx, input.Email, string(hash))
}

func (s *Service) LoginAdmin(ctx context.Context, input domain.LoginInput) (domain.AuthToken, error) {
	if s.tokenManager == nil {
		return domain.AuthToken{}, fmt.Errorf("token manager is not configured")
	}
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	if _, err := mail.ParseAddress(input.Email); err != nil {
		return domain.AuthToken{}, invalidArgument("valid email is required")
	}
	if strings.TrimSpace(input.Password) == "" {
		return domain.AuthToken{}, invalidArgument("password is required")
	}
	user, passwordHash, err := s.repo.GetUserByEmail(ctx, input.Email)
	if err != nil {
		if err == domain.ErrNotFound {
			return domain.AuthToken{}, domain.ErrUnauthorized
		}
		return domain.AuthToken{}, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(input.Password)); err != nil {
		return domain.AuthToken{}, domain.ErrUnauthorized
	}
	return s.tokenManager.Sign(user.Email, time.Now().UTC())
}

func (s *Service) RefreshAdminToken(_ context.Context, input domain.RefreshTokenInput) (domain.AuthToken, error) {
	if s.tokenManager == nil {
		return domain.AuthToken{}, fmt.Errorf("token manager is not configured")
	}
	claims, err := s.tokenManager.Verify(strings.TrimSpace(input.Token), time.Now().UTC())
	if err != nil {
		if err == auth.ErrInvalidToken {
			return domain.AuthToken{}, domain.ErrUnauthorized
		}
		return domain.AuthToken{}, err
	}
	return s.tokenManager.Sign(claims.Email, time.Now().UTC())
}

func (s *Service) VerifyAdminToken(token string) (domain.TokenClaims, error) {
	if s.tokenManager == nil {
		return domain.TokenClaims{}, fmt.Errorf("token manager is not configured")
	}
	claims, err := s.tokenManager.Verify(strings.TrimSpace(token), time.Now().UTC())
	if err != nil {
		if err == auth.ErrInvalidToken {
			return domain.TokenClaims{}, domain.ErrUnauthorized
		}
		return domain.TokenClaims{}, err
	}
	return claims, nil
}

func (s *Service) ListAdminSports(ctx context.Context) (domain.AdminSportsResponse, error) {
	return s.repo.ListAdminSports(ctx)
}

func (s *Service) ListAdminLocales(ctx context.Context) (domain.AdminLocalesResponse, error) {
	return s.repo.ListAdminLocales(ctx)
}

func (s *Service) ListAdminLeagues(ctx context.Context, sportSlug string) (domain.AdminLeaguesResponse, error) {
	sportSlug = normalizeSlug(sportSlug)
	if sportSlug == "" {
		return domain.AdminLeaguesResponse{}, invalidArgument("sport slug is required")
	}
	return s.repo.ListAdminLeagues(ctx, sportSlug)
}

func (s *Service) ListAdminSeasons(ctx context.Context, sportSlug, leagueSlug string) (domain.AdminSeasonsResponse, error) {
	sportSlug = normalizeSlug(sportSlug)
	leagueSlug = normalizeSlug(leagueSlug)
	if sportSlug == "" {
		return domain.AdminSeasonsResponse{}, invalidArgument("sport slug is required")
	}
	if leagueSlug == "" {
		return domain.AdminSeasonsResponse{}, invalidArgument("league slug is required")
	}
	return s.repo.ListAdminSeasons(ctx, sportSlug, leagueSlug)
}

func (s *Service) ListAdminTeams(ctx context.Context, sportSlug, leagueSlug string) (domain.AdminTeamsResponse, error) {
	sportSlug = normalizeSlug(sportSlug)
	leagueSlug = normalizeSlug(leagueSlug)
	if sportSlug == "" {
		return domain.AdminTeamsResponse{}, invalidArgument("sport slug is required")
	}
	if leagueSlug == "" {
		return domain.AdminTeamsResponse{}, invalidArgument("league slug is required")
	}
	return s.repo.ListAdminTeams(ctx, sportSlug, leagueSlug)
}

func (s *Service) ListAdminVenues(ctx context.Context) (domain.AdminVenuesResponse, error) {
	return s.repo.ListAdminVenues(ctx)
}

func (s *Service) GetRefreshQueueSnapshot(_ context.Context) (domain.RefreshQueueSnapshot, error) {
	if s.executor == nil {
		return domain.RefreshQueueSnapshot{}, invalidArgument("refresh executor is not configured")
	}
	return s.executor.Snapshot(), nil
}

func (s *Service) GetAdminLeagueSeason(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.SeasonDetail, error) {
	sportSlug = normalizeSlug(sportSlug)
	leagueSlug = normalizeSlug(leagueSlug)
	seasonSlug = strings.TrimSpace(seasonSlug)
	if sportSlug == "" {
		return domain.SeasonDetail{}, invalidArgument("sport slug is required")
	}
	if leagueSlug == "" {
		return domain.SeasonDetail{}, invalidArgument("league slug is required")
	}
	if seasonSlug == "" {
		return domain.SeasonDetail{}, invalidArgument("season slug is required")
	}
	detail, err := s.repo.GetAdminLeagueSeason(ctx, sportSlug, leagueSlug, seasonSlug)
	if err != nil {
		return domain.SeasonDetail{}, err
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
