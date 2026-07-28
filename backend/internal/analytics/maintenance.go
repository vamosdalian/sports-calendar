package analytics

import (
	"context"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// MaintenanceStore is the persistence surface the background upkeep needs.
type MaintenanceStore interface {
	RollupICSDailyStats(ctx context.Context, since time.Time) error
	PruneICSFetchLogs(ctx context.Context) (int64, error)
}

const (
	rollupInterval = 10 * time.Minute
	pruneInterval  = 24 * time.Hour
	rollupTimeout  = 2 * time.Minute
	pruneTimeout   = 30 * time.Minute
	// rollupLookback recomputes yesterday as well as today so a run that spans
	// midnight, or a missed run, still closes out the previous day.
	rollupLookback = 36 * time.Hour
)

// Maintainer keeps the daily rollup fresh and enforces detail retention.
type Maintainer struct {
	store  MaintenanceStore
	logger *logrus.Logger
	stop   chan struct{}
	done   chan struct{}
	once   sync.Once
}

// NewMaintainer builds the background upkeep worker.
func NewMaintainer(store MaintenanceStore, logger *logrus.Logger) *Maintainer {
	return &Maintainer{
		store:  store,
		logger: logger,
		stop:   make(chan struct{}),
		done:   make(chan struct{}),
	}
}

// Start runs the upkeep loop in the background.
func (m *Maintainer) Start() {
	if m == nil {
		return
	}
	go m.run()
}

func (m *Maintainer) run() {
	defer close(m.done)

	rollupTicker := time.NewTicker(rollupInterval)
	defer rollupTicker.Stop()
	pruneTicker := time.NewTicker(pruneInterval)
	defer pruneTicker.Stop()

	// Roll up once at boot so a restart does not leave a visible gap.
	m.rollup()

	for {
		select {
		case <-rollupTicker.C:
			m.rollup()
		case <-pruneTicker.C:
			m.prune()
		case <-m.stop:
			return
		}
	}
}

func (m *Maintainer) rollup() {
	ctx, cancel := context.WithTimeout(context.Background(), rollupTimeout)
	defer cancel()

	since := time.Now().UTC().Add(-rollupLookback)
	if err := m.store.RollupICSDailyStats(ctx, since); err != nil && m.logger != nil {
		m.logger.WithError(err).Warn("ics daily rollup failed")
	}
}

func (m *Maintainer) prune() {
	ctx, cancel := context.WithTimeout(context.Background(), pruneTimeout)
	defer cancel()

	removed, err := m.store.PruneICSFetchLogs(ctx)
	if err != nil {
		if m.logger != nil {
			m.logger.WithError(err).Warn("ics fetch log prune failed")
		}
		return
	}
	if removed > 0 && m.logger != nil {
		m.logger.WithField("removed", removed).Info("pruned expired ics fetch logs")
	}
}

// Stop halts the upkeep loop.
func (m *Maintainer) Stop() {
	if m == nil {
		return
	}
	m.once.Do(func() {
		close(m.stop)
		<-m.done
	})
}
