package analytics

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sirupsen/logrus"
)

// FetchEvent is one recorded pull of an ICS feed.
type FetchEvent struct {
	SportSlug      string
	LeagueSlug     string
	SeasonSlug     string
	TeamSlug       string
	Locale         string
	Client         string
	UserAgent      string
	SubscriberHash string
	Status         int
	FetchedAt      time.Time
}

// FetchLogWriter persists a batch of fetch events.
type FetchLogWriter interface {
	InsertICSFetchLogs(ctx context.Context, events []FetchEvent) error
}

const (
	defaultBufferSize    = 2048
	defaultBatchSize     = 200
	defaultFlushInterval = 5 * time.Second
	maxUserAgentLength   = 512
	flushTimeout         = 10 * time.Second
)

// Recorder buffers fetch events in memory and writes them in batches.
//
// Recording is strictly best-effort: analytics must never slow down or fail a
// feed response. If the buffer is full — a database stall, a traffic spike —
// events are dropped and counted rather than queued, so back-pressure can
// never propagate into the request path.
type Recorder struct {
	events  chan FetchEvent
	writer  FetchLogWriter
	logger  *logrus.Logger
	salt    []byte
	dropped atomic.Int64
	stop    chan struct{}
	done    chan struct{}
	once    sync.Once
}

// NewRecorder builds a Recorder. The salt is mixed into every subscriber hash
// so a stored digest cannot be matched back to an IP address by brute force;
// keep it stable across restarts or distinct-subscriber counts will reset.
func NewRecorder(writer FetchLogWriter, salt string, logger *logrus.Logger) *Recorder {
	return &Recorder{
		events: make(chan FetchEvent, defaultBufferSize),
		writer: writer,
		logger: logger,
		salt:   []byte(salt),
		stop:   make(chan struct{}),
		done:   make(chan struct{}),
	}
}

// SubscriberHash derives the stable pseudonymous id for a caller. The raw IP
// is never stored — only this digest, which is enough to count distinct
// clients and nothing else.
func (r *Recorder) SubscriberHash(ip, userAgent string) string {
	if r == nil {
		return ""
	}
	digest := sha256.New()
	digest.Write(r.salt)
	digest.Write([]byte(ip))
	digest.Write([]byte("\x00"))
	digest.Write([]byte(userAgent))
	return hex.EncodeToString(digest.Sum(nil))[:32]
}

// Record queues an event without blocking. A nil Recorder is a no-op, which
// keeps the feed handler usable in tests that do not wire up analytics.
func (r *Recorder) Record(event FetchEvent) {
	if r == nil {
		return
	}
	if event.FetchedAt.IsZero() {
		event.FetchedAt = time.Now().UTC()
	}
	if len(event.UserAgent) > maxUserAgentLength {
		event.UserAgent = event.UserAgent[:maxUserAgentLength]
	}

	select {
	case r.events <- event:
	default:
		// Buffer full: drop rather than stall the ICS response.
		r.dropped.Add(1)
	}
}

// Dropped reports how many events were discarded because the buffer was full.
func (r *Recorder) Dropped() int64 {
	if r == nil {
		return 0
	}
	return r.dropped.Load()
}

// Start launches the background writer.
func (r *Recorder) Start() {
	if r == nil {
		return
	}
	go r.run()
}

func (r *Recorder) run() {
	defer close(r.done)

	ticker := time.NewTicker(defaultFlushInterval)
	defer ticker.Stop()

	batch := make([]FetchEvent, 0, defaultBatchSize)
	for {
		select {
		case event := <-r.events:
			batch = append(batch, event)
			if len(batch) >= defaultBatchSize {
				batch = r.flush(batch)
			}
		case <-ticker.C:
			batch = r.flush(batch)
		case <-r.stop:
			// Drain whatever is still buffered before going away.
			for {
				select {
				case event := <-r.events:
					batch = append(batch, event)
					if len(batch) >= defaultBatchSize {
						batch = r.flush(batch)
					}
					continue
				default:
				}
				break
			}
			r.flush(batch)
			return
		}
	}
}

// flush writes the batch and returns an emptied slice for reuse. A failed
// write is logged and the batch discarded — retrying risks unbounded memory
// growth for data that is only ever aggregate.
func (r *Recorder) flush(batch []FetchEvent) []FetchEvent {
	if len(batch) == 0 {
		return batch
	}

	ctx, cancel := context.WithTimeout(context.Background(), flushTimeout)
	defer cancel()

	if err := r.writer.InsertICSFetchLogs(ctx, batch); err != nil && r.logger != nil {
		r.logger.WithError(err).WithField("events", len(batch)).Warn("drop ics fetch analytics batch")
	}
	if dropped := r.dropped.Swap(0); dropped > 0 && r.logger != nil {
		r.logger.WithField("dropped", dropped).Warn("ics fetch analytics buffer overflow")
	}
	return batch[:0]
}

// Stop drains the buffer and waits for the final write.
func (r *Recorder) Stop() {
	if r == nil {
		return
	}
	r.once.Do(func() {
		close(r.stop)
		<-r.done
	})
}
