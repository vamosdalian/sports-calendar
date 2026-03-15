package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
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

func (r *PostgresRepository) ListLeagues(ctx context.Context) ([]domain.SportDirectoryItem, string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT s.slug, s.name, l.slug, l.name, se.slug, se.label
		FROM sports s
		JOIN leagues l ON l.sport_id = s.id
		JOIN LATERAL (
			SELECT slug, label
			FROM seasons
			WHERE league_id = l.id
			ORDER BY start_year DESC, end_year DESC, slug DESC
			LIMIT 1
		) se ON TRUE
		ORDER BY s.slug ASC, l.slug ASC
	`)
	if err != nil {
		return nil, "", fmt.Errorf("list leagues: %w", err)
	}
	defer rows.Close()

	items := make([]domain.SportDirectoryItem, 0)
	sportIndexes := map[string]int{}

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
			return nil, "", fmt.Errorf("scan leagues row: %w", scanErr)
		}

		sportIndex, exists := sportIndexes[sportSlug]
		if !exists {
			items = append(items, domain.SportDirectoryItem{
				SportSlug:  sportSlug,
				SportNames: decodeLocalizedText(sportNamesRaw),
				Leagues:    make([]domain.LeagueReference, 0),
			})
			sportIndex = len(items) - 1
			sportIndexes[sportSlug] = sportIndex
		}

		items[sportIndex].Leagues = append(items[sportIndex].Leagues, domain.LeagueReference{
			LeagueSlug:  leagueSlug,
			LeagueNames: decodeLocalizedText(leagueNamesRaw),
			DefaultSeason: domain.SeasonReference{
				Slug:  seasonSlug,
				Label: seasonLabel,
			},
		})
	}
	if err := rows.Err(); err != nil {
		return nil, "", fmt.Errorf("iterate leagues rows: %w", err)
	}

	updatedAt, err := r.latestUpdatedAt(ctx)
	if err != nil {
		return nil, "", err
	}
	return items, updatedAt, nil
}

func (r *PostgresRepository) ListLeagueSeasons(ctx context.Context, sportSlug, leagueSlug string) (domain.LeagueSeasons, error) {
	var (
		leagueID        int64
		sportNamesRaw   []byte
		leagueNamesRaw  []byte
		leagueUpdatedAt time.Time
	)

	err := r.pool.QueryRow(ctx, `
		SELECT l.id, s.name, l.name, GREATEST(s.updated_at, l.updated_at)
		FROM leagues l
		JOIN sports s ON s.id = l.sport_id
		WHERE s.slug = $1 AND l.slug = $2
	`, sportSlug, leagueSlug).Scan(
		&leagueID,
		&sportNamesRaw,
		&leagueNamesRaw,
		&leagueUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.LeagueSeasons{}, domain.ErrNotFound
		}
		return domain.LeagueSeasons{}, fmt.Errorf("find league seasons: %w", err)
	}

	seasonRows, err := r.pool.Query(ctx, `
		SELECT slug, label, updated_at
		FROM seasons
		WHERE league_id = $1
		ORDER BY start_year DESC, end_year DESC, slug DESC
	`, leagueID)
	if err != nil {
		return domain.LeagueSeasons{}, fmt.Errorf("list league seasons: %w", err)
	}
	defer seasonRows.Close()

	seasons := make([]domain.SeasonReference, 0)
	lastUpdatedAt := leagueUpdatedAt
	for seasonRows.Next() {
		var (
			seasonSlug  string
			seasonLabel string
			updatedAt   time.Time
		)
		if scanErr := seasonRows.Scan(&seasonSlug, &seasonLabel, &updatedAt); scanErr != nil {
			return domain.LeagueSeasons{}, fmt.Errorf("scan season row: %w", scanErr)
		}
		seasons = append(seasons, domain.SeasonReference{Slug: seasonSlug, Label: seasonLabel})
		lastUpdatedAt = maxTime(lastUpdatedAt, updatedAt)
	}
	if err := seasonRows.Err(); err != nil {
		return domain.LeagueSeasons{}, fmt.Errorf("iterate seasons: %w", err)
	}
	if len(seasons) == 0 {
		return domain.LeagueSeasons{}, domain.ErrNotFound
	}

	return domain.LeagueSeasons{
		SportSlug:   sportSlug,
		SportNames:  decodeLocalizedText(sportNamesRaw),
		LeagueSlug:  leagueSlug,
		LeagueNames: decodeLocalizedText(leagueNamesRaw),
		Seasons:     seasons,
		UpdatedAt:   lastUpdatedAt.UTC().Format(time.RFC3339),
	}, nil
}

func (r *PostgresRepository) GetLeagueSeason(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.SeasonDetail, error) {
	var (
		leagueID               int64
		sportNamesRaw          []byte
		leagueNamesRaw         []byte
		calendarDescriptionRaw []byte
		dataSourceNoteRaw      []byte
		notesRaw               []byte
		leagueUpdatedAt        time.Time
	)

	err := r.pool.QueryRow(ctx, `
		SELECT l.id, s.name, l.name, l.calendar_description, l.data_source_note, l.notes, GREATEST(s.updated_at, l.updated_at)
		FROM leagues l
		JOIN sports s ON s.id = l.sport_id
		WHERE s.slug = $1 AND l.slug = $2
	`, sportSlug, leagueSlug).Scan(
		&leagueID,
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

	var selected seasonRecord
	err = r.pool.QueryRow(ctx, `
		SELECT id, slug, label, default_match_duration_minutes, updated_at
		FROM seasons
		WHERE league_id = $1 AND slug = $2
	`, leagueID, seasonSlug).Scan(
		&selected.id,
		&selected.slug,
		&selected.label,
		&selected.defaultMatchDurationMinutes,
		&selected.updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.SeasonDetail{}, domain.ErrNotFound
		}
		return domain.SeasonDetail{}, fmt.Errorf("find season: %w", err)
	}

	teamRows, err := r.pool.Query(ctx, `
		SELECT id, slug, name
		FROM teams
		WHERE league_id = $1
	`, leagueID)
	if err != nil {
		return domain.SeasonDetail{}, fmt.Errorf("list teams: %w", err)
	}
	defer teamRows.Close()

	teamMap := make(map[int64]domain.Team)
	for teamRows.Next() {
		var (
			teamID   int64
			teamSlug string
			nameRaw  []byte
		)
		if scanErr := teamRows.Scan(&teamID, &teamSlug, &nameRaw); scanErr != nil {
			return domain.SeasonDetail{}, fmt.Errorf("scan team row: %w", scanErr)
		}
		teamMap[teamID] = domain.Team{Slug: teamSlug, Names: decodeLocalizedText(nameRaw)}
	}
	if err := teamRows.Err(); err != nil {
		return domain.SeasonDetail{}, fmt.Errorf("iterate teams: %w", err)
	}

	matchRows, err := r.pool.Query(ctx, `
		SELECT m.external_id, m.round_name, m.starts_at, m.status, m.venue, m.city, m.teams, m.updated_at
		FROM matches m
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
			match          domain.Match
			roundRaw       []byte
			startsAt       time.Time
			venueRaw       []byte
			cityRaw        []byte
			teamIDs        []int64
			matchUpdatedAt time.Time
		)
		if scanErr := matchRows.Scan(
			&match.ID,
			&roundRaw,
			&startsAt,
			&match.Status,
			&venueRaw,
			&cityRaw,
			&teamIDs,
			&matchUpdatedAt,
		); scanErr != nil {
			return domain.SeasonDetail{}, fmt.Errorf("scan match row: %w", scanErr)
		}

		match.Round = decodeLocalizedText(roundRaw)
		match.StartsAt = startsAt.UTC().Format(time.RFC3339)
		match.Venue = decodeLocalizedText(venueRaw)
		match.City = decodeLocalizedText(cityRaw)
		if len(teamIDs) > 0 {
			if team, ok := teamMap[teamIDs[0]]; ok {
				teamCopy := team
				match.HomeTeam = &teamCopy
			}
		}
		if len(teamIDs) > 1 {
			if team, ok := teamMap[teamIDs[1]]; ok {
				teamCopy := team
				match.AwayTeam = &teamCopy
			}
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
		CalendarDescription:         decodeLocalizedText(calendarDescriptionRaw),
		DataSourceNote:              decodeLocalizedText(dataSourceNoteRaw),
		Notes:                       decodeLocalizedText(notesRaw),
		Matches:                     matches,
		UpdatedAt:                   lastUpdatedAt.UTC().Format(time.RFC3339),
	}, nil
}

func (r *PostgresRepository) ListSyncTargets(ctx context.Context) ([]domain.LeagueSyncTarget, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT l.id, l.slug, l.sync_interval, se.id, se.slug, se.label
		FROM leagues l
		JOIN LATERAL (
			SELECT id, slug, label
			FROM seasons
			WHERE league_id = l.id
			ORDER BY start_year DESC, end_year DESC, slug DESC
			LIMIT 1
		) se ON TRUE
		ORDER BY l.slug ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list sync targets: %w", err)
	}
	defer rows.Close()

	targets := make([]domain.LeagueSyncTarget, 0)
	for rows.Next() {
		var target domain.LeagueSyncTarget
		if scanErr := rows.Scan(
			&target.LeagueID,
			&target.LeagueSlug,
			&target.SyncInterval,
			&target.SeasonID,
			&target.SeasonSlug,
			&target.SeasonLabel,
		); scanErr != nil {
			return nil, fmt.Errorf("scan sync target: %w", scanErr)
		}
		targets = append(targets, target)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate sync targets: %w", err)
	}

	return targets, nil
}

func (r *PostgresRepository) ReplaceLeagueSnapshot(ctx context.Context, snapshot domain.LeagueSnapshot) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin snapshot transaction: %w", err)
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	if _, err := tx.Exec(ctx, `
		UPDATE leagues
		SET name = name || $2::jsonb,
		    calendar_description = calendar_description || $3::jsonb,
		    data_source_note = data_source_note || $4::jsonb,
		    updated_at = NOW()
		WHERE id = $1
		  AND (
		    name IS DISTINCT FROM name || $2::jsonb OR
		    calendar_description IS DISTINCT FROM calendar_description || $3::jsonb OR
		    data_source_note IS DISTINCT FROM data_source_note || $4::jsonb
		  )
	`, snapshot.Target.LeagueID, encodeLocalizedText(snapshot.LeagueNames), encodeLocalizedText(snapshot.CalendarDescription), encodeLocalizedText(snapshot.DataSourceNote)); err != nil {
		return fmt.Errorf("update league metadata: %w", err)
	}

	teamIDs := make(map[int64]int64, len(snapshot.Teams))
	teams := append([]domain.TeamSyncRecord(nil), snapshot.Teams...)
	sort.Slice(teams, func(i, j int) bool {
		return teams[i].ID < teams[j].ID
	})
	for _, team := range teams {
		var teamID int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO teams (id, league_id, slug, name, short_name)
			VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
			ON CONFLICT (id) DO UPDATE
			SET league_id = EXCLUDED.league_id,
			    slug = EXCLUDED.slug,
			    name = teams.name || EXCLUDED.name,
			    short_name = teams.short_name || EXCLUDED.short_name,
			    updated_at = NOW()
			WHERE teams.league_id IS DISTINCT FROM EXCLUDED.league_id
			   OR teams.slug IS DISTINCT FROM EXCLUDED.slug
			   OR teams.name IS DISTINCT FROM teams.name || EXCLUDED.name
			   OR teams.short_name IS DISTINCT FROM teams.short_name || EXCLUDED.short_name
			RETURNING id
		`, team.ID, snapshot.Target.LeagueID, team.Slug, encodeLocalizedText(team.Names), encodeLocalizedText(team.ShortName)).Scan(&teamID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				if lookupErr := tx.QueryRow(ctx, `
					SELECT id
					FROM teams
					WHERE id = $1
				`, team.ID).Scan(&teamID); lookupErr != nil {
					return fmt.Errorf("load unchanged team id %d: %w", team.ID, lookupErr)
				}
			} else {
				return fmt.Errorf("upsert team %d: %w", team.ID, err)
			}
		}
		teamIDs[team.ID] = teamID
	}

	matchExternalIDs := make([]string, 0, len(snapshot.Matches))
	for _, match := range snapshot.Matches {
		storedTeamIDs := make([]int64, 0, len(match.Teams))
		for _, teamID := range match.Teams {
			storedTeamID, ok := teamIDs[teamID]
			if !ok {
				return fmt.Errorf("match %s references missing team %d", match.ExternalID, teamID)
			}
			storedTeamIDs = append(storedTeamIDs, storedTeamID)
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO matches (
				season_id,
				external_id,
				teams,
				round_name,
				venue,
				city,
				country,
				starts_at,
				status
			) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
			ON CONFLICT (external_id) DO UPDATE
			SET season_id = EXCLUDED.season_id,
			    teams = EXCLUDED.teams,
			    round_name = matches.round_name || EXCLUDED.round_name,
			    venue = matches.venue || EXCLUDED.venue,
			    city = matches.city || EXCLUDED.city,
			    country = matches.country || EXCLUDED.country,
			    starts_at = EXCLUDED.starts_at,
			    status = EXCLUDED.status,
			    updated_at = NOW()
			WHERE matches.season_id IS DISTINCT FROM EXCLUDED.season_id
			   OR matches.teams IS DISTINCT FROM EXCLUDED.teams
			   OR matches.round_name IS DISTINCT FROM matches.round_name || EXCLUDED.round_name
			   OR matches.venue IS DISTINCT FROM matches.venue || EXCLUDED.venue
			   OR matches.city IS DISTINCT FROM matches.city || EXCLUDED.city
			   OR matches.country IS DISTINCT FROM matches.country || EXCLUDED.country
			   OR matches.starts_at IS DISTINCT FROM EXCLUDED.starts_at
			   OR matches.status IS DISTINCT FROM EXCLUDED.status
		`, snapshot.Target.SeasonID, match.ExternalID, storedTeamIDs, encodeLocalizedText(match.Round), encodeLocalizedText(match.Venue), encodeLocalizedText(match.City), encodeLocalizedText(match.Country), match.StartsAt.UTC(), match.Status); err != nil {
			return fmt.Errorf("upsert match %s: %w", match.ExternalID, err)
		}
		matchExternalIDs = append(matchExternalIDs, match.ExternalID)
	}

	if len(matchExternalIDs) == 0 {
		if _, err := tx.Exec(ctx, `DELETE FROM matches WHERE season_id = $1`, snapshot.Target.SeasonID); err != nil {
			return fmt.Errorf("delete season matches: %w", err)
		}
	} else {
		if _, err := tx.Exec(ctx, `
			DELETE FROM matches
			WHERE season_id = $1
			  AND NOT (external_id = ANY($2))
		`, snapshot.Target.SeasonID, matchExternalIDs); err != nil {
			return fmt.Errorf("delete stale matches: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit snapshot transaction: %w", err)
	}
	tx = nil
	return nil
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

func encodeLocalizedText(value domain.LocalizedText) []byte {
	if len(value) == 0 {
		return []byte("{}")
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return []byte("{}")
	}
	return raw
}
