package syncer

import (
	"github.com/robfig/cron/v3"
	"github.com/sirupsen/logrus"
)

type Scheduler struct {
	cron   *cron.Cron
	logger *logrus.Logger
}

func NewScheduler(logger *logrus.Logger) (*Scheduler, error) {
	instance := cron.New()
	if _, err := instance.AddFunc("0 */6 * * *", func() {
		logger.WithField("source", "api-sports.io").Info("mock sync job placeholder triggered")
	}); err != nil {
		return nil, err
	}

	return &Scheduler{cron: instance, logger: logger}, nil
}

func (s *Scheduler) Start() {
	if s == nil || s.cron == nil {
		return
	}
	s.logger.Info("starting mock sync scheduler")
	s.cron.Start()
}

func (s *Scheduler) Stop() {
	if s == nil || s.cron == nil {
		return
	}
	s.logger.Info("stopping mock sync scheduler")
	ctx := s.cron.Stop()
	<-ctx.Done()
}