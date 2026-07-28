package analytics

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
)

type stubWriter struct {
	mu      sync.Mutex
	events  []FetchEvent
	err     error
	blockCh chan struct{}
}

func (s *stubWriter) InsertICSFetchLogs(ctx context.Context, events []FetchEvent) error {
	if s.blockCh != nil {
		<-s.blockCh
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return s.err
	}
	s.events = append(s.events, events...)
	return nil
}

func (s *stubWriter) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.events)
}

func newTestLogger() *logrus.Logger {
	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel)
	return logger
}

func TestRecorderFlushesOnStop(t *testing.T) {
	writer := &stubWriter{}
	recorder := NewRecorder(writer, "salt", newTestLogger())
	recorder.Start()

	for i := 0; i < 5; i++ {
		recorder.Record(FetchEvent{LeagueSlug: "epl", Client: ClientIOS})
	}
	recorder.Stop()

	if got := writer.count(); got != 5 {
		t.Fatalf("flushed %d events, want 5", got)
	}
}

func TestRecorderFlushesFullBatch(t *testing.T) {
	writer := &stubWriter{}
	recorder := NewRecorder(writer, "salt", newTestLogger())
	recorder.Start()
	defer recorder.Stop()

	for i := 0; i < defaultBatchSize; i++ {
		recorder.Record(FetchEvent{LeagueSlug: "epl", Client: ClientIOS})
	}

	// A full batch flushes without waiting for the ticker.
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if writer.count() >= defaultBatchSize {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("batch not flushed; got %d events, want %d", writer.count(), defaultBatchSize)
}

func TestRecordNeverBlocksWhenBufferIsFull(t *testing.T) {
	// The whole point of the buffer is that a stalled database can never slow
	// down an ICS response. Hold the writer open, overflow the buffer, and
	// assert that Record still returns immediately.
	writer := &stubWriter{blockCh: make(chan struct{})}
	recorder := NewRecorder(writer, "salt", newTestLogger())
	recorder.Start()

	done := make(chan struct{})
	go func() {
		defer close(done)
		for i := 0; i < defaultBufferSize*3; i++ {
			recorder.Record(FetchEvent{LeagueSlug: "epl", Client: ClientIOS})
		}
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Record blocked when the buffer was full")
	}

	if recorder.Dropped() == 0 {
		t.Fatal("expected overflow events to be counted as dropped")
	}

	close(writer.blockCh)
	recorder.Stop()
}

func TestRecorderSurvivesWriteFailure(t *testing.T) {
	writer := &stubWriter{err: errors.New("db down")}
	recorder := NewRecorder(writer, "salt", newTestLogger())
	recorder.Start()

	recorder.Record(FetchEvent{LeagueSlug: "epl", Client: ClientIOS})
	recorder.Stop()
	// Nothing to assert beyond not panicking or hanging: a failed analytics
	// write is dropped on purpose rather than retried.
}

func TestSubscriberHashIsStableAndSalted(t *testing.T) {
	recorder := NewRecorder(&stubWriter{}, "salt-a", newTestLogger())
	other := NewRecorder(&stubWriter{}, "salt-b", newTestLogger())

	first := recorder.SubscriberHash("203.0.113.7", "iOS/17.5.1 dataaccessd/1.0")
	second := recorder.SubscriberHash("203.0.113.7", "iOS/17.5.1 dataaccessd/1.0")
	if first != second {
		t.Fatal("same client must hash to the same subscriber id")
	}

	if changed := recorder.SubscriberHash("203.0.113.8", "iOS/17.5.1 dataaccessd/1.0"); changed == first {
		t.Fatal("different IPs must hash differently")
	}

	if salted := other.SubscriberHash("203.0.113.7", "iOS/17.5.1 dataaccessd/1.0"); salted == first {
		t.Fatal("a different salt must produce a different subscriber id")
	}

	if first == "203.0.113.7" || len(first) != 32 {
		t.Fatalf("unexpected hash shape %q", first)
	}
}

func TestNilRecorderIsNoOp(t *testing.T) {
	// main.go leaves the recorder nil when analytics is disabled, and the
	// handler must stay usable in that state.
	var recorder *Recorder
	recorder.Record(FetchEvent{LeagueSlug: "epl"})
	recorder.Start()
	recorder.Stop()
	if got := recorder.SubscriberHash("203.0.113.7", "ua"); got != "" {
		t.Fatalf("nil recorder hash = %q, want empty", got)
	}
	if got := recorder.Dropped(); got != 0 {
		t.Fatalf("nil recorder dropped = %d, want 0", got)
	}
}
