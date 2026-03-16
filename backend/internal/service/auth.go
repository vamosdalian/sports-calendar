package service

import (
	"context"
	"fmt"
	"net/mail"
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

func (s *Service) ListAdminLeagues(ctx context.Context, sportSlug string) (domain.AdminLeaguesResponse, error) {
	sportSlug = normalizeSlug(sportSlug)
	if sportSlug == "" {
		return domain.AdminLeaguesResponse{}, invalidArgument("sport slug is required")
	}
	return s.repo.ListAdminLeagues(ctx, sportSlug)
}
