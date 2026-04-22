package syncer

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

type schedulerTestRunner struct {
	mu      sync.Mutex
	targets []domain.LeagueSyncTarget
	err     error
	called  []domain.LeagueSyncTarget
}

func (r *schedulerTestRunner) ListSyncTargets(_ context.Context) ([]domain.LeagueSyncTarget, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.err != nil {
		return nil, r.err
	}
	return append([]domain.LeagueSyncTarget(nil), r.targets...), nil
}

func (r *schedulerTestRunner) SyncLeague(_ context.Context, target domain.LeagueSyncTarget) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.called = append(r.called, target)
	return nil
}

func TestSchedulerRefreshReplacesTargets(t *testing.T) {
	runner := &schedulerTestRunner{targets: []domain.LeagueSyncTarget{{LeagueID: 1, LeagueSlug: "csl", SyncInterval: "@daily", SeasonID: 101, SeasonSlug: "2026", SeasonLabel: "2026"}}}
	logger := logrus.New()
	logger.SetOutput(ioDiscard{})

	scheduler, err := NewScheduler(logger, runner)
	if err != nil {
		t.Fatalf("create scheduler: %v", err)
	}

	if got := len(scheduler.targets); got != 1 {
		t.Fatalf("expected 1 target after init, got %d", got)
	}

	runner.mu.Lock()
	runner.targets = []domain.LeagueSyncTarget{{LeagueID: 2, LeagueSlug: "nba", SyncInterval: "0 * * * *", SeasonID: 202, SeasonSlug: "2025-2026", SeasonLabel: "2025-2026"}}
	runner.mu.Unlock()

	if err := scheduler.Refresh(context.Background()); err != nil {
		t.Fatalf("refresh scheduler: %v", err)
	}

	if got := len(scheduler.targets); got != 1 {
		t.Fatalf("expected 1 target after refresh, got %d", got)
	}
	if scheduler.targets[0].LeagueSlug != "nba" {
		t.Fatalf("expected refreshed target nba, got %s", scheduler.targets[0].LeagueSlug)
	}
	if got := len(scheduler.cron.Entries()); got != 1 {
		t.Fatalf("expected 1 cron entry after refresh, got %d", got)
	}
}

func TestSchedulerRefreshKeepsExistingTargetsOnError(t *testing.T) {
	runner := &schedulerTestRunner{targets: []domain.LeagueSyncTarget{{LeagueID: 1, LeagueSlug: "csl", SyncInterval: "@daily", SeasonID: 101, SeasonSlug: "2026", SeasonLabel: "2026"}}}
	logger := logrus.New()
	logger.SetOutput(ioDiscard{})

	scheduler, err := NewScheduler(logger, runner)
	if err != nil {
		t.Fatalf("create scheduler: %v", err)
	}

	runner.mu.Lock()
	runner.err = errors.New("load failed")
	runner.mu.Unlock()

	if err := scheduler.Refresh(context.Background()); err == nil {
		t.Fatalf("expected refresh error")
	}

	if got := len(scheduler.targets); got != 1 {
		t.Fatalf("expected existing targets to remain, got %d", got)
	}
	if scheduler.targets[0].LeagueSlug != "csl" {
		t.Fatalf("expected existing target csl to remain, got %s", scheduler.targets[0].LeagueSlug)
	}
}

func TestSchedulerStartDoesNotRunImmediateSync(t *testing.T) {
	runner := &schedulerTestRunner{targets: []domain.LeagueSyncTarget{{LeagueID: 1, LeagueSlug: "csl", SyncInterval: "@daily", SeasonID: 101, SeasonSlug: "2026", SeasonLabel: "2026"}}}
	logger := logrus.New()
	logger.SetOutput(ioDiscard{})

	scheduler, err := NewScheduler(logger, runner)
	if err != nil {
		t.Fatalf("create scheduler: %v", err)
	}

	scheduler.Start()
	defer scheduler.Stop()

	time.Sleep(200 * time.Millisecond)

	runner.mu.Lock()
	defer runner.mu.Unlock()
	if got := len(runner.called); got != 0 {
		t.Fatalf("expected no immediate sync run on start, got %d", got)
	}
}

type ioDiscard struct{}

func (ioDiscard) Write(p []byte) (int, error) {
	return len(p), nil
}
