package service

import (
	"context"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

// defaultTrendDays matches the detail retention window closely enough that the
// trend and the 30-day headline figure describe the same period.
const defaultTrendDays = 30

// maxTrendDays bounds the rollup scan so a hand-crafted query cannot ask for
// an unbounded range.
const maxTrendDays = 365

type analyticsStore interface {
	GetICSAnalyticsOverview(ctx context.Context, trendDays int) (domain.ICSAnalyticsOverview, error)
}

// SetAnalyticsStore wires the ICS analytics reader. A nil store leaves the
// admin endpoint reporting that analytics is unavailable.
func (s *Service) SetAnalyticsStore(store analyticsStore) {
	s.analytics = store
}

// GetICSAnalyticsOverview returns the admin dashboard payload.
func (s *Service) GetICSAnalyticsOverview(ctx context.Context, trendDays int) (domain.ICSAnalyticsOverview, error) {
	if s.analytics == nil {
		return domain.ICSAnalyticsOverview{}, ErrNotFound
	}
	if trendDays <= 0 {
		trendDays = defaultTrendDays
	}
	if trendDays > maxTrendDays {
		trendDays = maxTrendDays
	}
	return s.analytics.GetICSAnalyticsOverview(ctx, trendDays)
}
