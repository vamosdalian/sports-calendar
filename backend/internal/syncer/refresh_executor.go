package syncer

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

const (
	defaultRefreshQueueSize  = 100
	defaultRecentRefreshSize = 20
)

type RefreshRunner interface {
	SyncLeague(ctx context.Context, target domain.LeagueSyncTarget) error
}

type refreshTaskRequest struct {
	target      domain.LeagueSyncTarget
	source      domain.RefreshRequestSource
	requestedAt time.Time
}

type RefreshExecutor struct {
	logger *logrus.Logger
	runner RefreshRunner

	mu      sync.Mutex
	queue   chan refreshTaskRequest
	queued  map[string]refreshTaskRequest
	running *refreshTaskRequest
	startedAt time.Time
	recent  []domain.RecentRefreshTask
	started bool
	stopCh  chan struct{}
	doneCh  chan struct{}
}

func NewRefreshExecutor(logger *logrus.Logger, runner RefreshRunner) (*RefreshExecutor, error) {
	if logger == nil {
		return nil, fmt.Errorf("logger is required")
	}
	if runner == nil {
		return nil, fmt.Errorf("refresh runner is required")
	}
	return &RefreshExecutor{
		logger: logger,
		runner: runner,
		queue:  make(chan refreshTaskRequest, defaultRefreshQueueSize),
		queued: make(map[string]refreshTaskRequest),
		stopCh: make(chan struct{}),
		doneCh: make(chan struct{}),
	}, nil
}

func (e *RefreshExecutor) Start() {
	if e == nil {
		return
	}
	e.mu.Lock()
	if e.started {
		e.mu.Unlock()
		return
	}
	e.started = true
	queueSize := len(e.queue)
	e.mu.Unlock()

	e.logger.WithField("queued", queueSize).Info("starting refresh executor")
	go e.run()
}

func (e *RefreshExecutor) Stop() {
	if e == nil {
		return
	}
	e.mu.Lock()
	if !e.started {
		e.mu.Unlock()
		return
	}
	e.started = false
	stopCh := e.stopCh
	doneCh := e.doneCh
	e.mu.Unlock()

	close(stopCh)
	<-doneCh
}

func (e *RefreshExecutor) Enqueue(target domain.LeagueSyncTarget, source domain.RefreshRequestSource) domain.RefreshEnqueueResponse {
	task := refreshTaskRequest{
		target:      target,
		source:      source,
		requestedAt: time.Now().UTC(),
	}
	key := refreshTaskKey(target)

	e.mu.Lock()
	if e.running != nil && refreshTaskKey(e.running.target) == key {
		e.mu.Unlock()
		return domain.RefreshEnqueueResponse{Status: domain.RefreshEnqueueStatusAlreadyRunning}
	}
	if _, exists := e.queued[key]; exists {
		e.mu.Unlock()
		return domain.RefreshEnqueueResponse{Status: domain.RefreshEnqueueStatusAlreadyQueued}
	}
	select {
	case e.queue <- task:
		e.queued[key] = task
		e.mu.Unlock()
		return domain.RefreshEnqueueResponse{Status: domain.RefreshEnqueueStatusQueued}
	default:
		e.mu.Unlock()
		return domain.RefreshEnqueueResponse{Status: domain.RefreshEnqueueStatusAlreadyQueued}
	}
}

func (e *RefreshExecutor) Snapshot() domain.RefreshQueueSnapshot {
	e.mu.Lock()
	defer e.mu.Unlock()

	queued := make([]domain.RefreshTask, 0, len(e.queued))
	for _, task := range e.queued {
		queued = append(queued, buildRefreshTask(task))
	}
	// preserve queue insertion order approximately by requested time
	sortRefreshTasks(queued)

	recent := append([]domain.RecentRefreshTask(nil), e.recent...)
	snapshot := domain.RefreshQueueSnapshot{
		Queued: queued,
		Recent: recent,
		Stats: domain.RefreshQueueStats{
			QueueLength: len(queued),
		},
	}
	if e.running != nil {
		runningTask := buildRunningRefreshTask(*e.running, e.startedAt)
		snapshot.Running = &runningTask
	}
	return snapshot
}

func (e *RefreshExecutor) run() {
	defer close(e.doneCh)
	for {
		select {
		case <-e.stopCh:
			return
		case task := <-e.queue:
			e.execute(task)
		}
	}
}

func (e *RefreshExecutor) execute(task refreshTaskRequest) {
	key := refreshTaskKey(task.target)
	startedAt := time.Now().UTC()

	e.mu.Lock()
	delete(e.queued, key)
	e.running = &task
	e.startedAt = startedAt
	e.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	err := e.runner.SyncLeague(ctx, task.target)
	finishedAt := time.Now().UTC()

	e.mu.Lock()
	e.running = nil
	e.startedAt = time.Time{}
	e.prependRecent(domain.RecentRefreshTask{
		RefreshTask: buildRefreshTask(task),
		StartedAt:   startedAt.Format(time.RFC3339),
		FinishedAt:  finishedAt.Format(time.RFC3339),
		Status:      refreshTaskStatus(err),
		Error:       refreshTaskError(err),
	})
	e.mu.Unlock()

	fields := logrus.Fields{
		"league": task.target.LeagueSlug,
		"season": task.target.SeasonSlug,
		"source": task.source,
	}
	if err != nil {
		e.logger.WithError(err).WithFields(fields).Error("refresh executor task failed")
		return
	}
	e.logger.WithFields(fields).Info("refresh executor task completed")
}

func (e *RefreshExecutor) prependRecent(task domain.RecentRefreshTask) {
	e.recent = append([]domain.RecentRefreshTask{task}, e.recent...)
	if len(e.recent) > defaultRecentRefreshSize {
		e.recent = e.recent[:defaultRecentRefreshSize]
	}
}

func refreshTaskKey(target domain.LeagueSyncTarget) string {
	return fmt.Sprintf("%d:%d", target.LeagueID, target.SeasonID)
}

func buildRefreshTask(task refreshTaskRequest) domain.RefreshTask {
	return domain.RefreshTask{
		LeagueID:    task.target.LeagueID,
		LeagueSlug:  task.target.LeagueSlug,
		SeasonID:    task.target.SeasonID,
		SeasonSlug:  task.target.SeasonSlug,
		RequestedAt: task.requestedAt.Format(time.RFC3339),
		Source:      task.source,
	}
}

func buildRunningRefreshTask(task refreshTaskRequest, startedAt time.Time) domain.RunningRefreshTask {
	return domain.RunningRefreshTask{
		RefreshTask: buildRefreshTask(task),
		StartedAt:   startedAt.Format(time.RFC3339),
		Status:      domain.RefreshTaskStatusRunning,
	}
}

func refreshTaskStatus(err error) domain.RefreshTaskStatus {
	if err != nil {
		return domain.RefreshTaskStatusFailed
	}
	return domain.RefreshTaskStatusSucceeded
}

func refreshTaskError(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func sortRefreshTasks(tasks []domain.RefreshTask) {
	for i := 0; i < len(tasks); i++ {
		for j := i + 1; j < len(tasks); j++ {
			if tasks[j].RequestedAt < tasks[i].RequestedAt {
				tasks[i], tasks[j] = tasks[j], tasks[i]
			}
		}
	}
}
