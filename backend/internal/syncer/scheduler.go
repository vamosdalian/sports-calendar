package syncer

import (
	"context"
	"fmt"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/sirupsen/logrus"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

type Scheduler struct {
	cron    *cron.Cron
	logger  *logrus.Logger
	runner  Runner
	targets []domain.LeagueSyncTarget
}

func NewScheduler(logger *logrus.Logger, runner Runner) (*Scheduler, error) {
	if logger == nil {
		return nil, fmt.Errorf("logger is required")
	}
	if runner == nil {
		return nil, fmt.Errorf("sync runner is required")
	}

	instance := cron.New()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	targets, err := runner.ListSyncTargets(ctx)
	if err != nil {
		return nil, fmt.Errorf("load sync targets: %w", err)
	}

	for _, target := range targets {
		targetCopy := target
		if _, err := instance.AddFunc(targetCopy.SyncInterval, func() {
			runTarget(logger, runner, targetCopy)
		}); err != nil {
			return nil, fmt.Errorf("register sync schedule for %s: %w", targetCopy.LeagueSlug, err)
		}
	}

	return &Scheduler{cron: instance, logger: logger, runner: runner, targets: targets}, nil
}

func (s *Scheduler) Start() {
	if s == nil || s.cron == nil {
		return
	}
	s.logger.WithField("targets", len(s.targets)).Info("starting league sync scheduler")
	s.cron.Start()
	for _, target := range s.targets {
		targetCopy := target
		go runTarget(s.logger, s.runner, targetCopy)
	}
}

func (s *Scheduler) Stop() {
	if s == nil || s.cron == nil {
		return
	}
	s.logger.Info("stopping league sync scheduler")
	ctx := s.cron.Stop()
	<-ctx.Done()
}

func runTarget(logger *logrus.Logger, runner Runner, target domain.LeagueSyncTarget) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	logger.WithFields(logrus.Fields{
		"league": target.LeagueSlug,
		"season": target.SeasonSlug,
	}).Info("league sync started")

	if err := runner.SyncLeague(ctx, target); err != nil {
		logger.WithError(err).WithFields(logrus.Fields{
			"league": target.LeagueSlug,
			"season": target.SeasonSlug,
		}).Error("league sync failed")
	}
}
