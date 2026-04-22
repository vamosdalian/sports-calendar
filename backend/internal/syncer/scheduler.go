package syncer

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/sirupsen/logrus"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

type Scheduler struct {
	mu      sync.Mutex
	cron    *cron.Cron
	logger  *logrus.Logger
	loader  targetLoader
	queue   queueProducer
	targets []domain.LeagueSyncTarget
	started bool
}

type targetLoader interface {
	ListSyncTargets(ctx context.Context) ([]domain.LeagueSyncTarget, error)
}

type queueProducer interface {
	Enqueue(target domain.LeagueSyncTarget, source domain.RefreshRequestSource) domain.RefreshEnqueueResponse
}

func NewScheduler(logger *logrus.Logger, loader targetLoader, queue queueProducer) (*Scheduler, error) {
	if logger == nil {
		return nil, fmt.Errorf("logger is required")
	}
	if loader == nil {
		return nil, fmt.Errorf("sync target loader is required")
	}
	if queue == nil {
		return nil, fmt.Errorf("refresh queue producer is required")
	}

	scheduler := &Scheduler{cron: cron.New(), logger: logger, loader: loader, queue: queue}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := scheduler.Refresh(ctx); err != nil {
		return nil, err
	}
	return scheduler, nil
}

func (s *Scheduler) Start() {
	if s == nil {
		return
	}
	s.mu.Lock()
	if s.cron == nil || s.started {
		s.mu.Unlock()
		return
	}
	s.started = true
	instance := s.cron
	targets := append([]domain.LeagueSyncTarget(nil), s.targets...)
	s.mu.Unlock()

	s.logger.WithField("targets", len(targets)).Info("starting league sync scheduler")
	instance.Start()
}

func (s *Scheduler) Stop() {
	if s == nil {
		return
	}
	s.mu.Lock()
	if s.cron == nil || !s.started {
		s.mu.Unlock()
		return
	}
	instance := s.cron
	s.started = false
	s.mu.Unlock()

	s.logger.Info("stopping league sync scheduler")
	ctx := instance.Stop()
	<-ctx.Done()
}

func (s *Scheduler) Refresh(ctx context.Context) error {
	if s == nil {
		return nil
	}
	targets, err := s.loader.ListSyncTargets(ctx)
	if err != nil {
		return fmt.Errorf("load sync targets: %w", err)
	}

	instance := cron.New()
	for _, target := range targets {
		targetCopy := target
		if _, err := instance.AddFunc(targetCopy.SyncInterval, func() {
			s.queue.Enqueue(targetCopy, domain.RefreshRequestSourceCron)
		}); err != nil {
			return fmt.Errorf("register sync schedule for %s: %w", targetCopy.LeagueSlug, err)
		}
	}

	s.mu.Lock()
	oldCron := s.cron
	wasStarted := s.started
	s.cron = instance
	s.targets = append([]domain.LeagueSyncTarget(nil), targets...)
	s.mu.Unlock()

	if wasStarted {
		instance.Start()
	}
	if wasStarted && oldCron != nil {
		stopCtx := oldCron.Stop()
		<-stopCtx.Done()
	}

	s.logger.WithField("targets", len(targets)).Info("refreshed league sync scheduler")
	return nil
}
