package repository

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"

	"github.com/vamosdalian/sports-calendar/backend/internal/analytics"
	"github.com/vamosdalian/sports-calendar/backend/internal/migrations"
)

// newAnalyticsTestPool connects to the database named by TEST_DATABASE_URL and
// applies migrations. These queries use rollup upserts, FILTER clauses, and a
// batched delete that a mock cannot meaningfully exercise, so the test is
// skipped rather than faked when no database is configured.
//
//	docker run --rm -e POSTGRES_DB=sctest -e POSTGRES_USER=sctest \
//	  -e POSTGRES_PASSWORD=sctest -p 55432:5432 -d postgres:16
//	TEST_DATABASE_URL=postgres://sctest:sctest@localhost:55432/sctest?sslmode=disable \
//	  go test ./internal/repository/ -run Analytics
func newAnalyticsTestPool(t *testing.T) (*PostgresRepository, *pgxpool.Pool) {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping analytics database test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	t.Cleanup(pool.Close)

	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel)
	if err := migrations.Run(ctx, pool, logger); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	if _, err := pool.Exec(ctx, `TRUNCATE ics_fetch_logs, ics_daily_stats`); err != nil {
		t.Fatalf("reset analytics tables: %v", err)
	}

	repo, err := NewPostgresRepository(pool)
	if err != nil {
		t.Fatalf("create repository: %v", err)
	}
	return repo, pool
}

func TestAnalyticsRoundTrip(t *testing.T) {
	repo, pool := newAnalyticsTestPool(t)
	ctx := context.Background()
	now := time.Now().UTC()

	events := []analytics.FetchEvent{
		// Two pulls from one iOS client: one subscriber, two fetches.
		{SportSlug: "soccer", LeagueSlug: "epl", SeasonSlug: "2025-2026", Client: analytics.ClientIOS, SubscriberHash: "hash-ios-1", Status: 200, FetchedAt: now.Add(-2 * time.Hour)},
		{SportSlug: "soccer", LeagueSlug: "epl", SeasonSlug: "2025-2026", Client: analytics.ClientIOS, SubscriberHash: "hash-ios-1", Status: 200, FetchedAt: now.Add(-1 * time.Hour)},
		{SportSlug: "soccer", LeagueSlug: "epl", SeasonSlug: "2025-2026", Client: analytics.ClientGoogle, SubscriberHash: "hash-google-1", Status: 200, FetchedAt: now.Add(-3 * time.Hour)},
		// A crawler must not be counted as a subscriber.
		{SportSlug: "soccer", LeagueSlug: "epl", SeasonSlug: "2025-2026", Client: analytics.ClientBot, SubscriberHash: "hash-bot-1", Status: 200, FetchedAt: now.Add(-4 * time.Hour)},
		// A team feed on another league.
		{SportSlug: "soccer", LeagueSlug: "csl", SeasonSlug: "2026", TeamSlug: "beijing-guoan", Client: analytics.ClientMacOS, SubscriberHash: "hash-mac-1", Status: 200, FetchedAt: now.Add(-5 * time.Hour)},
	}
	if err := repo.InsertICSFetchLogs(ctx, events); err != nil {
		t.Fatalf("insert fetch logs: %v", err)
	}

	if err := repo.RollupICSDailyStats(ctx, now.Add(-36*time.Hour)); err != nil {
		t.Fatalf("rollup: %v", err)
	}

	// The rollup must be idempotent: running it twice recomputes each day
	// rather than doubling the counts.
	if err := repo.RollupICSDailyStats(ctx, now.Add(-36*time.Hour)); err != nil {
		t.Fatalf("second rollup: %v", err)
	}

	var iosFetches, iosSubscribers int64
	err := pool.QueryRow(ctx, `
		SELECT fetch_count, subscriber_count FROM ics_daily_stats
		WHERE league_slug = 'epl' AND client = 'ios'
	`).Scan(&iosFetches, &iosSubscribers)
	if err != nil {
		t.Fatalf("read rollup: %v", err)
	}
	if iosFetches != 2 {
		t.Errorf("ios fetch_count = %d, want 2 (rollup must not double-count)", iosFetches)
	}
	if iosSubscribers != 1 {
		t.Errorf("ios subscriber_count = %d, want 1 (same client polling twice)", iosSubscribers)
	}

	overview, err := repo.GetICSAnalyticsOverview(ctx, 30)
	if err != nil {
		t.Fatalf("overview: %v", err)
	}

	// ios + google + macos = 3 subscribers; the bot is excluded.
	if overview.Totals.SubscribersToday != 3 {
		t.Errorf("SubscribersToday = %d, want 3 (bot must be excluded)", overview.Totals.SubscribersToday)
	}
	if overview.Totals.Subscribers7d != 3 {
		t.Errorf("Subscribers7d = %d, want 3", overview.Totals.Subscribers7d)
	}
	if overview.Totals.FetchesToday != 5 {
		t.Errorf("FetchesToday = %d, want 5 (fetch totals include bots)", overview.Totals.FetchesToday)
	}

	if len(overview.Feeds) != 2 {
		t.Fatalf("Feeds = %d rows, want 2", len(overview.Feeds))
	}
	// epl leads with 2 subscribers.
	if overview.Feeds[0].LeagueSlug != "epl" || overview.Feeds[0].Subscribers != 2 {
		t.Errorf("top feed = %+v, want epl with 2 subscribers", overview.Feeds[0])
	}

	if len(overview.Clients) == 0 {
		t.Fatal("expected client breakdown")
	}
	if len(overview.Trend) == 0 {
		t.Fatal("expected trend points from the rollup")
	}

	// The dashboard shows the trend and the headline totals side by side, so
	// "fetches" must mean the same thing in both: raw requests, crawlers
	// included. Filtering bots out of only one of them made the two disagree.
	var trendFetches, trendSubscribers int64
	for _, point := range overview.Trend {
		trendFetches += point.Fetches
		trendSubscribers += point.Subscribers
	}
	if trendFetches != overview.Totals.FetchesToday {
		t.Errorf("trend fetches = %d, want %d to match FetchesToday", trendFetches, overview.Totals.FetchesToday)
	}
	if trendSubscribers != overview.Totals.SubscribersToday {
		t.Errorf("trend subscribers = %d, want %d (bots excluded from both)", trendSubscribers, overview.Totals.SubscribersToday)
	}
}

func TestPruneICSFetchLogsRespectsRetention(t *testing.T) {
	repo, pool := newAnalyticsTestPool(t)
	ctx := context.Background()
	now := time.Now().UTC()

	events := []analytics.FetchEvent{
		{SportSlug: "soccer", LeagueSlug: "epl", SeasonSlug: "2025-2026", Client: analytics.ClientIOS, SubscriberHash: "recent", Status: 200, FetchedAt: now.Add(-24 * time.Hour)},
		{SportSlug: "soccer", LeagueSlug: "epl", SeasonSlug: "2025-2026", Client: analytics.ClientIOS, SubscriberHash: "old", Status: 200, FetchedAt: now.AddDate(0, 0, -(retentionDays + 5))},
	}
	if err := repo.InsertICSFetchLogs(ctx, events); err != nil {
		t.Fatalf("insert fetch logs: %v", err)
	}

	removed, err := repo.PruneICSFetchLogs(ctx)
	if err != nil {
		t.Fatalf("prune: %v", err)
	}
	if removed != 1 {
		t.Errorf("removed = %d, want 1", removed)
	}

	var remaining int64
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM ics_fetch_logs`).Scan(&remaining); err != nil {
		t.Fatalf("count remaining: %v", err)
	}
	if remaining != 1 {
		t.Errorf("remaining rows = %d, want 1 (in-window row must survive)", remaining)
	}
}
