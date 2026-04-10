package syncer

import (
	"context"
	"fmt"

	"github.com/sirupsen/logrus"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

type SyncRepository interface {
	ListSyncTargets(ctx context.Context) ([]domain.LeagueSyncTarget, error)
	ReplaceLeagueSnapshot(ctx context.Context, snapshot domain.LeagueSnapshot) error
}

type Runner interface {
	ListSyncTargets(ctx context.Context) ([]domain.LeagueSyncTarget, error)
	SyncLeague(ctx context.Context, target domain.LeagueSyncTarget) error
}

type LeagueSyncer struct {
	logger  *logrus.Logger
	repo    SyncRepository
	fetcher SnapshotFetcher
}

func NewLeagueSyncer(logger *logrus.Logger, repo SyncRepository, fetcher SnapshotFetcher) (*LeagueSyncer, error) {
	if logger == nil {
		return nil, fmt.Errorf("logger is required")
	}
	if repo == nil {
		return nil, fmt.Errorf("sync repository is required")
	}
	if fetcher == nil {
		return nil, fmt.Errorf("snapshot fetcher is required")
	}

	return &LeagueSyncer{logger: logger, repo: repo, fetcher: fetcher}, nil
}

func (s *LeagueSyncer) ListSyncTargets(ctx context.Context) ([]domain.LeagueSyncTarget, error) {
	return s.repo.ListSyncTargets(ctx)
}

func (s *LeagueSyncer) SyncLeague(ctx context.Context, target domain.LeagueSyncTarget) error {
	snapshot, err := s.fetcher.FetchLeagueSnapshot(ctx, target)
	if err != nil {
		return fmt.Errorf("fetch %s snapshot: %w", target.LeagueSlug, err)
	}
	if err := s.repo.ReplaceLeagueSnapshot(ctx, snapshot); err != nil {
		return fmt.Errorf("store %s snapshot: %w", target.LeagueSlug, err)
	}

	s.logger.WithFields(logrus.Fields{
		"league":  target.LeagueSlug,
		"season":  target.SeasonSlug,
		"teams":   len(snapshot.Teams),
		"matches": len(snapshot.Matches),
	}).Info("league sync completed")
	return nil
}
