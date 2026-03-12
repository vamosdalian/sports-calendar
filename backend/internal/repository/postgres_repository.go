package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) (*PostgresRepository, error) {
	if pool == nil {
		return nil, fmt.Errorf("postgres pool is required")
	}
	return &PostgresRepository{pool: pool}, nil
}

func (r *PostgresRepository) ListYears(ctx context.Context) ([]int, string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT year
		FROM (
			SELECT generate_series(start_year::integer, end_year::integer) AS year
			FROM seasons
		) AS expanded
		ORDER BY year DESC
	`)
	if err != nil {
		return nil, "", fmt.Errorf("list years: %w", err)
	}
	defer rows.Close()

	years := make([]int, 0)
	for rows.Next() {
		var year int
		if scanErr := rows.Scan(&year); scanErr != nil {
			return nil, "", fmt.Errorf("scan year: %w", scanErr)
		}
		years = append(years, year)
	}
	if err := rows.Err(); err != nil {
		return nil, "", fmt.Errorf("iterate years: %w", err)
	}

	updatedAt, err := r.latestUpdatedAt(ctx)
	if err != nil {
		return nil, "", err
	}
	return years, updatedAt, nil
}

func (r *PostgresRepository) ListSportsByYear(ctx context.Context, year int) ([]domain.SportsYearItem, string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT s.slug, s.name, l.slug, l.name, se.slug, se.label
		FROM sports s
		JOIN leagues l ON l.sport_id = s.id
		JOIN seasons se ON se.league_id = l.id
		WHERE se.start_year <= $1 AND se.end_year >= $1
		ORDER BY s.slug ASC, l.slug ASC, se.start_year DESC, se.end_year DESC, se.slug DESC
	`, year)
	if err != nil {
		return nil, "", fmt.Errorf("list sports by year: %w", err)
	}
	defer rows.Close()

	items := make([]domain.SportsYearItem, 0)
	sportIndexes := map[string]int{}
	leagueIndexes := map[string]int{}

	for rows.Next() {
		var (
			sportSlug      string
			sportNamesRaw  []byte
			leagueSlug     string
			leagueNamesRaw []byte
			seasonSlug     string
			seasonLabel    string
		)
		if scanErr := rows.Scan(&sportSlug, &sportNamesRaw, &leagueSlug, &leagueNamesRaw, &seasonSlug, &seasonLabel); scanErr != nil {
			return nil, "", fmt.Errorf("scan sports by year row: %w", scanErr)
		}

		sportIndex, exists := sportIndexes[sportSlug]
		if !exists {
			items = append(items, domain.SportsYearItem{
				SportSlug:  sportSlug,
				SportNames: decodeLocalizedText(sportNamesRaw),
				Leagues:    make([]domain.LeagueSeasonReference, 0),
			})
			sportIndex = len(items) - 1
			sportIndexes[sportSlug] = sportIndex
		}

		leagueKey := sportSlug + ":" + leagueSlug
		leagueIndex, exists := leagueIndexes[leagueKey]
		if !exists {
			items[sportIndex].Leagues = append(items[sportIndex].Leagues, domain.LeagueSeasonReference{
				LeagueSlug:  leagueSlug,
				LeagueNames: decodeLocalizedText(leagueNamesRaw),
				Seasons:     make([]domain.SeasonReference, 0),
			})
			leagueIndex = len(items[sportIndex].Leagues) - 1
			leagueIndexes[leagueKey] = leagueIndex
		}

		items[sportIndex].Leagues[leagueIndex].Seasons = append(items[sportIndex].Leagues[leagueIndex].Seasons, domain.SeasonReference{
			Slug:  seasonSlug,
			Label: seasonLabel,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, "", fmt.Errorf("iterate sports by year rows: %w", err)
	}

	updatedAt, err := r.latestUpdatedAt(ctx)
	if err != nil {
		return nil, "", err
	}
	return items, updatedAt, nil
}

func (r *PostgresRepository) GetLeagueSeason(ctx context.Context, leagueSlug, seasonSlug string) (domain.SeasonDetail, error) {
	var (
		leagueID               int64
		sportID                int64
		sportSlug              string
		sportNamesRaw          []byte
		leagueNamesRaw         []byte
		calendarDescriptionRaw []byte
		dataSourceNoteRaw      []byte
		notesRaw               []byte
		leagueUpdatedAt        time.Time
	)

	err := r.pool.QueryRow(ctx, `
		SELECT l.id, s.id, s.slug, s.name, l.name, l.calendar_description, l.data_source_note, l.notes, GREATEST(s.updated_at, l.updated_at)
		FROM leagues l
		JOIN sports s ON s.id = l.sport_id
		WHERE l.slug = $1
	`, leagueSlug).Scan(
		&leagueID,
		&sportID,
		&sportSlug,
		&sportNamesRaw,
		&leagueNamesRaw,
		&calendarDescriptionRaw,
		&dataSourceNoteRaw,
		&notesRaw,
		&leagueUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.SeasonDetail{}, domain.ErrNotFound
		}
		return domain.SeasonDetail{}, fmt.Errorf("find league: %w", err)
	}

	type seasonRecord struct {
		id                          int64
		slug                        string
		label                       string
		defaultMatchDurationMinutes int
		updatedAt                   time.Time
	}

	seasonRows, err := r.pool.Query(ctx, `
		SELECT id, slug, label, default_match_duration_minutes, updated_at
		FROM seasons
		WHERE league_id = $1
		ORDER BY start_year DESC, end_year DESC, slug DESC
	`, leagueID)
	if err != nil {
		return domain.SeasonDetail{}, fmt.Errorf("list seasons: %w", err)
	}
	defer seasonRows.Close()

	available := make([]domain.SeasonReference, 0)
	seasons := make([]seasonRecord, 0)
	for seasonRows.Next() {
		var record seasonRecord
		if scanErr := seasonRows.Scan(
			&record.id,
			&record.slug,
			&record.label,
			&record.defaultMatchDurationMinutes,
			&record.updatedAt,
		); scanErr != nil {
			return domain.SeasonDetail{}, fmt.Errorf("scan season row: %w", scanErr)
		}
		seasons = append(seasons, record)
		available = append(available, domain.SeasonReference{Slug: record.slug, Label: record.label})
	}
	if err := seasonRows.Err(); err != nil {
		return domain.SeasonDetail{}, fmt.Errorf("iterate seasons: %w", err)
	}
	if len(seasons) == 0 {
		return domain.SeasonDetail{}, domain.ErrNotFound
	}

	selected := seasons[0]
	if seasonSlug != "" {
		found := false
		for _, season := range seasons {
			if season.slug == seasonSlug {
				selected = season
				found = true
				break
			}
		}
		if !found {
			return domain.SeasonDetail{}, domain.ErrNotFound
		}
	}

	matchRows, err := r.pool.Query(ctx, `
		SELECT m.external_id, m.round_name, m.starts_at, m.status, m.venue, m.city,
		       ht.slug, ht.name, at.slug, at.name, m.updated_at
		FROM matches m
		LEFT JOIN teams ht ON ht.id = m.home_team_id
		LEFT JOIN teams at ON at.id = m.away_team_id
		WHERE m.season_id = $1
		ORDER BY m.starts_at ASC, m.id ASC
	`, selected.id)
	if err != nil {
		return domain.SeasonDetail{}, fmt.Errorf("list matches: %w", err)
	}
	defer matchRows.Close()

	matches := make([]domain.Match, 0)
	lastUpdatedAt := maxTime(leagueUpdatedAt, selected.updatedAt)
	for matchRows.Next() {
		var (
			match            domain.Match
			roundRaw         []byte
			startsAt         time.Time
			venueRaw         []byte
			cityRaw          []byte
			homeTeamSlug     *string
			homeTeamNamesRaw []byte
			awayTeamSlug     *string
			awayTeamNamesRaw []byte
			matchUpdatedAt   time.Time
		)
		if scanErr := matchRows.Scan(
			&match.ID,
			&roundRaw,
			&startsAt,
			&match.Status,
			&venueRaw,
			&cityRaw,
			&homeTeamSlug,
			&homeTeamNamesRaw,
			&awayTeamSlug,
			&awayTeamNamesRaw,
			&matchUpdatedAt,
		); scanErr != nil {
			return domain.SeasonDetail{}, fmt.Errorf("scan match row: %w", scanErr)
		}

		match.Round = decodeLocalizedText(roundRaw)
		match.StartsAt = startsAt.UTC().Format(time.RFC3339)
		match.Venue = decodeLocalizedText(venueRaw)
		match.City = decodeLocalizedText(cityRaw)
		if homeTeamSlug != nil {
			match.HomeTeam = &domain.Team{Slug: *homeTeamSlug, Names: decodeLocalizedText(homeTeamNamesRaw)}
		}
		if awayTeamSlug != nil {
			match.AwayTeam = &domain.Team{Slug: *awayTeamSlug, Names: decodeLocalizedText(awayTeamNamesRaw)}
		}
		matches = append(matches, match)
		lastUpdatedAt = maxTime(lastUpdatedAt, matchUpdatedAt)
	}
	if err := matchRows.Err(); err != nil {
		return domain.SeasonDetail{}, fmt.Errorf("iterate matches: %w", err)
	}

	return domain.SeasonDetail{
		SportSlug:                   sportSlug,
		SportNames:                  decodeLocalizedText(sportNamesRaw),
		LeagueSlug:                  leagueSlug,
		LeagueNames:                 decodeLocalizedText(leagueNamesRaw),
		SeasonSlug:                  selected.slug,
		SeasonLabel:                 selected.label,
		DefaultMatchDurationMinutes: selected.defaultMatchDurationMinutes,
		AvailableSeasons:            available,
		CalendarDescription:         decodeLocalizedText(calendarDescriptionRaw),
		DataSourceNote:              decodeLocalizedText(dataSourceNoteRaw),
		Notes:                       decodeLocalizedText(notesRaw),
		Matches:                     matches,
		UpdatedAt:                   lastUpdatedAt.UTC().Format(time.RFC3339),
	}, nil
}

func (r *PostgresRepository) latestUpdatedAt(ctx context.Context) (string, error) {
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT GREATEST(
			COALESCE((SELECT MAX(updated_at) FROM sports), '-infinity'::timestamptz),
			COALESCE((SELECT MAX(updated_at) FROM leagues), '-infinity'::timestamptz),
			COALESCE((SELECT MAX(updated_at) FROM seasons), '-infinity'::timestamptz),
			COALESCE((SELECT MAX(updated_at) FROM teams), '-infinity'::timestamptz),
			COALESCE((SELECT MAX(updated_at) FROM matches), '-infinity'::timestamptz)
		)
	`).Scan(&updatedAt)
	if err != nil {
		return "", fmt.Errorf("load latest updatedAt: %w", err)
	}
	if updatedAt.Year() <= 1 {
		updatedAt = time.Now().UTC()
	}
	return updatedAt.UTC().Format(time.RFC3339), nil
}

func decodeLocalizedText(raw []byte) domain.LocalizedText {
	if len(raw) == 0 {
		return domain.LocalizedText{}
	}
	value := domain.LocalizedText{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return domain.LocalizedText{}
	}
	return value
}

func maxTime(left, right time.Time) time.Time {
	if right.After(left) {
		return right
	}
	return left
}
