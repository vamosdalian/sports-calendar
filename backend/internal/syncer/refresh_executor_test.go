package syncer

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

type executorTestRunner struct {
	mu      sync.Mutex
	started chan domain.LeagueSyncTarget
	block   chan struct{}
	called  []domain.LeagueSyncTarget
}

func (r *executorTestRunner) SyncLeague(_ context.Context, target domain.LeagueSyncTarget) error {
	r.mu.Lock()
	r.called = append(r.called, target)
	r.mu.Unlock()
	if r.started != nil {
		r.started <- target
	}
	if r.block != nil {
		<-r.block
	}
	return nil
}

func TestRefreshExecutorEnqueueDeduplicatesQueuedAndRunning(t *testing.T) {
	logger := logrus.New()
	logger.SetOutput(ioDiscard{})
	runner := &executorTestRunner{
		started: make(chan domain.LeagueSyncTarget, 1),
		block:   make(chan struct{}),
	}
	executor, err := NewRefreshExecutor(logger, runner)
	if err != nil {
		t.Fatalf("create refresh executor: %v", err)
	}
	executor.Start()
	defer executor.Stop()

	target := domain.LeagueSyncTarget{LeagueID: 1, LeagueSlug: "csl", SeasonID: 2, SeasonSlug: "2026"}
	if got := executor.Enqueue(target, domain.RefreshRequestSourceManual).Status; got != domain.RefreshEnqueueStatusQueued {
		t.Fatalf("expected first enqueue queued, got %s", got)
	}
	if got := executor.Enqueue(target, domain.RefreshRequestSourceManual).Status; got != domain.RefreshEnqueueStatusAlreadyQueued {
		t.Fatalf("expected second enqueue already queued, got %s", got)
	}

	select {
	case <-runner.started:
	case <-time.After(time.Second):
		t.Fatalf("expected runner to start")
	}

	if got := executor.Enqueue(target, domain.RefreshRequestSourceManual).Status; got != domain.RefreshEnqueueStatusAlreadyRunning {
		t.Fatalf("expected enqueue while running to be already running, got %s", got)
	}

	snapshot := executor.Snapshot()
	if snapshot.Running == nil {
		t.Fatalf("expected running task in snapshot")
	}
	if snapshot.Stats.QueueLength != 0 {
		t.Fatalf("expected empty queue while running, got %d", snapshot.Stats.QueueLength)
	}

	close(runner.block)
	time.Sleep(50 * time.Millisecond)

	snapshot = executor.Snapshot()
	if len(snapshot.Recent) != 1 {
		t.Fatalf("expected one recent task, got %d", len(snapshot.Recent))
	}
	if snapshot.Recent[0].Status != domain.RefreshTaskStatusSucceeded {
		t.Fatalf("expected succeeded recent status, got %s", snapshot.Recent[0].Status)
	}
}
