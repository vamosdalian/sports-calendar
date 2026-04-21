package service

import (
	"context"
	"strings"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func (s *Service) CreateAdminLocale(ctx context.Context, input domain.CreateAdminLocaleInput) (domain.AdminLocaleItem, error) {
	input.Code = normalizeLocaleCode(input.Code)
	input.Label = strings.TrimSpace(input.Label)

	if input.Code == "" {
		return domain.AdminLocaleItem{}, invalidArgument("locale code is required")
	}
	if input.Label == "" {
		return domain.AdminLocaleItem{}, invalidArgument("locale label is required")
	}
	return s.repo.CreateAdminLocale(ctx, input)
}

func (s *Service) UpdateAdminLocale(ctx context.Context, input domain.UpdateAdminLocaleInput) (domain.AdminLocaleItem, error) {
	input.Code = normalizeLocaleCode(input.Code)
	input.Label = strings.TrimSpace(input.Label)

	if input.Code == "" {
		return domain.AdminLocaleItem{}, invalidArgument("locale code is required")
	}
	if input.Label == "" {
		return domain.AdminLocaleItem{}, invalidArgument("locale label is required")
	}
	return s.repo.UpdateAdminLocale(ctx, input)
}

func (s *Service) DeleteAdminLocale(ctx context.Context, code string) error {
	code = normalizeLocaleCode(code)
	if code == "" {
		return invalidArgument("locale code is required")
	}
	return s.repo.DeleteAdminLocale(ctx, code)
}
