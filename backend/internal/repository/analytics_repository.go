package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/vamosdalian/sports-calendar/backend/internal/analytics"
	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

// retentionDays bounds how long raw fetch rows are kept. Rollups outlive them,
// so trends survive the sweep; only per-request detail is lost.
const retentionDays = 90

// pruneBatchSize keeps each delete statement short enough that the sweep never
// holds a long transaction against the write path.
const pruneBatchSize = 10000

// InsertICSFetchLogs bulk-writes buffered fetch events.
func (r *PostgresRepository) InsertICSFetchLogs(ctx context.Context, events []analytics.FetchEvent) error {
	if len(events) == 0 {
		return nil
	}

	rows := make([][]any, 0, len(events))
	for _, event := range events {
		rows = append(rows, []any{
			event.SportSlug,
			event.LeagueSlug,
			event.SeasonSlug,
			event.TeamSlug,
			event.Locale,
			event.Client,
			event.UserAgent,
			event.SubscriberHash,
			int16(event.Status),
			event.FetchedAt.UTC(),
		})
	}

	_, err := r.pool.CopyFrom(
		ctx,
		pgx.Identifier{"ics_fetch_logs"},
		[]string{
			"sport_slug", "league_slug", "season_slug", "team_slug", "locale",
			"client", "user_agent", "subscriber_hash", "status", "fetched_at",
		},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("insert ics fetch logs: %w", err)
	}
	return nil
}

// RollupICSDailyStats recomputes the daily rollup for the trailing window.
//
// It fully recomputes each affected day rather than incrementing, so running
// it more often than necessary is harmless and a missed run self-heals on the
// next pass.
func (r *PostgresRepository) RollupICSDailyStats(ctx context.Context, since time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO ics_daily_stats (
		    day, sport_slug, league_slug, season_slug, team_slug, client,
		    fetch_count, subscriber_count, updated_at
		)
		SELECT
		    (fetched_at AT TIME ZONE 'UTC')::date AS day,
		    sport_slug,
		    league_slug,
		    season_slug,
		    team_slug,
		    client,
		    COUNT(*),
		    COUNT(DISTINCT subscriber_hash) FILTER (WHERE subscriber_hash <> ''),
		    NOW()
		FROM ics_fetch_logs
		WHERE fetched_at >= $1
		GROUP BY 1, 2, 3, 4, 5, 6
		ON CONFLICT (day, sport_slug, league_slug, season_slug, team_slug, client)
		DO UPDATE SET
		    fetch_count = EXCLUDED.fetch_count,
		    subscriber_count = EXCLUDED.subscriber_count,
		    updated_at = NOW()
	`, since.UTC())
	if err != nil {
		return fmt.Errorf("rollup ics daily stats: %w", err)
	}
	return nil
}

// PruneICSFetchLogs deletes detail rows past the retention window, in batches.
// Returns the number of rows removed.
func (r *PostgresRepository) PruneICSFetchLogs(ctx context.Context) (int64, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays)
	var total int64
	for {
		tag, err := r.pool.Exec(ctx, `
			DELETE FROM ics_fetch_logs
			WHERE id IN (
			    SELECT id FROM ics_fetch_logs WHERE fetched_at < $1 LIMIT $2
			)
		`, cutoff, pruneBatchSize)
		if err != nil {
			return total, fmt.Errorf("prune ics fetch logs: %w", err)
		}
		affected := tag.RowsAffected()
		total += affected
		if affected < pruneBatchSize {
			return total, nil
		}
		// Yield between batches so a large backlog cannot monopolise the pool.
		select {
		case <-ctx.Done():
			return total, ctx.Err()
		case <-time.After(100 * time.Millisecond):
		}
	}
}

// GetICSAnalyticsOverview assembles the admin dashboard payload.
//
// Distinct-subscriber counts over multi-day windows are read from the detail
// table: daily rollups cannot be summed without double-counting a client that
// polls on more than one day.
func (r *PostgresRepository) GetICSAnalyticsOverview(ctx context.Context, trendDays int) (domain.ICSAnalyticsOverview, error) {
	if trendDays <= 0 {
		trendDays = 30
	}

	overview := domain.ICSAnalyticsOverview{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Trend:       []domain.ICSAnalyticsTrendPoint{},
		Feeds:       []domain.ICSAnalyticsFeedRow{},
		Clients:     []domain.ICSAnalyticsClientRow{},
	}

	totals, err := r.icsTotals(ctx)
	if err != nil {
		return domain.ICSAnalyticsOverview{}, err
	}
	overview.Totals = totals

	trend, err := r.icsTrend(ctx, trendDays)
	if err != nil {
		return domain.ICSAnalyticsOverview{}, err
	}
	overview.Trend = trend

	feeds, err := r.icsFeeds(ctx)
	if err != nil {
		return domain.ICSAnalyticsOverview{}, err
	}
	overview.Feeds = feeds

	clients, err := r.icsClients(ctx)
	if err != nil {
		return domain.ICSAnalyticsOverview{}, err
	}
	overview.Clients = clients

	return overview, nil
}

// subscriberFilter excludes crawlers and one-off browser hits so the headline
// numbers cannot be inflated by traffic that will never come back.
const subscriberFilter = `client NOT IN ('bot', 'browser', 'unknown')`

func (r *PostgresRepository) icsTotals(ctx context.Context) (domain.ICSAnalyticsTotals, error) {
	var totals domain.ICSAnalyticsTotals
	err := r.pool.QueryRow(ctx, `
		SELECT
		    COUNT(DISTINCT subscriber_hash) FILTER (
		        WHERE fetched_at >= NOW() - INTERVAL '1 day' AND `+subscriberFilter+`
		    ),
		    COUNT(DISTINCT subscriber_hash) FILTER (
		        WHERE fetched_at >= NOW() - INTERVAL '7 days' AND `+subscriberFilter+`
		    ),
		    COUNT(DISTINCT subscriber_hash) FILTER (
		        WHERE fetched_at >= NOW() - INTERVAL '30 days' AND `+subscriberFilter+`
		    ),
		    COUNT(*) FILTER (WHERE fetched_at >= NOW() - INTERVAL '1 day'),
		    COUNT(*) FILTER (WHERE fetched_at >= NOW() - INTERVAL '7 days')
		FROM ics_fetch_logs
		WHERE fetched_at >= NOW() - INTERVAL '30 days'
	`).Scan(
		&totals.SubscribersToday,
		&totals.Subscribers7d,
		&totals.Subscribers30d,
		&totals.FetchesToday,
		&totals.Fetches7d,
	)
	if err != nil {
		return domain.ICSAnalyticsTotals{}, fmt.Errorf("query ics totals: %w", err)
	}
	return totals, nil
}

func (r *PostgresRepository) icsTrend(ctx context.Context, days int) ([]domain.ICSAnalyticsTrendPoint, error) {
	// Per-day distinct counts are additive across feeds only approximately --
	// a client subscribed to two feeds counts twice. Reading the daily rollup
	// keeps the trend cheap; the headline totals above are the exact figures.
	//
	// The filter applies to subscribers only, never to fetches: fetch counts
	// mean raw requests everywhere in this payload, so the trend and the
	// headline totals cannot disagree.
	rows, err := r.pool.Query(ctx, `
		SELECT
		    day::text,
		    COALESCE(SUM(subscriber_count) FILTER (WHERE `+subscriberFilter+`), 0),
		    SUM(fetch_count)
		FROM ics_daily_stats
		WHERE day >= (NOW() AT TIME ZONE 'UTC')::date - $1::int
		GROUP BY day
		ORDER BY day ASC
	`, days)
	if err != nil {
		return nil, fmt.Errorf("query ics trend: %w", err)
	}
	defer rows.Close()

	points := make([]domain.ICSAnalyticsTrendPoint, 0)
	for rows.Next() {
		var point domain.ICSAnalyticsTrendPoint
		if scanErr := rows.Scan(&point.Day, &point.Subscribers, &point.Fetches); scanErr != nil {
			return nil, fmt.Errorf("scan ics trend: %w", scanErr)
		}
		points = append(points, point)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate ics trend: %w", err)
	}
	return points, nil
}

func (r *PostgresRepository) icsFeeds(ctx context.Context) ([]domain.ICSAnalyticsFeedRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
		    sport_slug, league_slug, season_slug, team_slug,
		    COUNT(DISTINCT subscriber_hash) FILTER (WHERE `+subscriberFilter+`),
		    COUNT(*)
		FROM ics_fetch_logs
		WHERE fetched_at >= NOW() - INTERVAL '7 days'
		GROUP BY sport_slug, league_slug, season_slug, team_slug
		ORDER BY 5 DESC, 6 DESC
		LIMIT 100
	`)
	if err != nil {
		return nil, fmt.Errorf("query ics feeds: %w", err)
	}
	defer rows.Close()

	items := make([]domain.ICSAnalyticsFeedRow, 0)
	for rows.Next() {
		var row domain.ICSAnalyticsFeedRow
		if scanErr := rows.Scan(
			&row.SportSlug, &row.LeagueSlug, &row.SeasonSlug, &row.TeamSlug,
			&row.Subscribers, &row.Fetches,
		); scanErr != nil {
			return nil, fmt.Errorf("scan ics feed: %w", scanErr)
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate ics feeds: %w", err)
	}
	return items, nil
}

func (r *PostgresRepository) icsClients(ctx context.Context) ([]domain.ICSAnalyticsClientRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT client, COUNT(DISTINCT subscriber_hash), COUNT(*)
		FROM ics_fetch_logs
		WHERE fetched_at >= NOW() - INTERVAL '7 days'
		GROUP BY client
		ORDER BY 2 DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("query ics clients: %w", err)
	}
	defer rows.Close()

	items := make([]domain.ICSAnalyticsClientRow, 0)
	for rows.Next() {
		var row domain.ICSAnalyticsClientRow
		if scanErr := rows.Scan(&row.Client, &row.Subscribers, &row.Fetches); scanErr != nil {
			return nil, fmt.Errorf("scan ics client: %w", scanErr)
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate ics clients: %w", err)
	}
	return items, nil
}
