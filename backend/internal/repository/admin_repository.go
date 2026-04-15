package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func (r *PostgresRepository) ListAdminSports(ctx context.Context) (domain.AdminSportsResponse, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, slug, name, created_at, updated_at
		FROM sports
		ORDER BY slug ASC
	`)
	if err != nil {
		return domain.AdminSportsResponse{}, fmt.Errorf("list admin sports: %w", err)
	}
	defer rows.Close()

	items := make([]domain.AdminSportItem, 0)
	lastUpdatedAt := time.Time{}
	for rows.Next() {
		var (
			item      domain.AdminSportItem
			nameRaw   []byte
			createdAt time.Time
			updatedAt time.Time
		)
		if scanErr := rows.Scan(&item.ID, &item.Slug, &nameRaw, &createdAt, &updatedAt); scanErr != nil {
			return domain.AdminSportsResponse{}, fmt.Errorf("scan admin sport: %w", scanErr)
		}
		item.Name = decodeLocalizedText(nameRaw)
		item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		items = append(items, item)
		lastUpdatedAt = maxTime(lastUpdatedAt, updatedAt)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminSportsResponse{}, fmt.Errorf("iterate admin sports: %w", err)
	}
	if lastUpdatedAt.IsZero() {
		lastUpdatedAt = time.Now().UTC()
	}
	return domain.AdminSportsResponse{Items: items, UpdatedAt: lastUpdatedAt.UTC().Format(time.RFC3339)}, nil
}

func (r *PostgresRepository) ListAdminLeagues(ctx context.Context, sportSlug string) (domain.AdminLeaguesResponse, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT l.id, l.slug, l.name, l.show, l.sync_interval, l.calendar_description, l.data_source_note, l.notes, l.created_at, l.updated_at
		FROM leagues l
		JOIN sports s ON s.id = l.sport_id
		WHERE s.slug = $1
		ORDER BY l.slug ASC
	`, sportSlug)
	if err != nil {
		return domain.AdminLeaguesResponse{}, fmt.Errorf("list admin leagues: %w", err)
	}
	defer rows.Close()

	items := make([]domain.AdminLeagueItem, 0)
	lastUpdatedAt := time.Time{}
	for rows.Next() {
		var (
			item                   domain.AdminLeagueItem
			nameRaw                []byte
			calendarDescriptionRaw []byte
			dataSourceNoteRaw      []byte
			notesRaw               []byte
			createdAt              time.Time
			updatedAt              time.Time
		)
		if scanErr := rows.Scan(&item.ID, &item.Slug, &nameRaw, &item.Show, &item.SyncInterval, &calendarDescriptionRaw, &dataSourceNoteRaw, &notesRaw, &createdAt, &updatedAt); scanErr != nil {
			return domain.AdminLeaguesResponse{}, fmt.Errorf("scan admin league: %w", scanErr)
		}
		item.SportSlug = sportSlug
		item.Name = decodeLocalizedText(nameRaw)
		item.CalendarDescription = decodeLocalizedText(calendarDescriptionRaw)
		item.DataSourceNote = decodeLocalizedText(dataSourceNoteRaw)
		item.Notes = decodeLocalizedText(notesRaw)
		item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		items = append(items, item)
		lastUpdatedAt = maxTime(lastUpdatedAt, updatedAt)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminLeaguesResponse{}, fmt.Errorf("iterate admin leagues: %w", err)
	}
	if len(items) == 0 {
		var exists bool
		if err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sports WHERE slug = $1)`, sportSlug).Scan(&exists); err != nil {
			return domain.AdminLeaguesResponse{}, fmt.Errorf("check sport for admin leagues: %w", err)
		}
		if !exists {
			return domain.AdminLeaguesResponse{}, domain.ErrNotFound
		}
	}
	if lastUpdatedAt.IsZero() {
		lastUpdatedAt = time.Now().UTC()
	}
	return domain.AdminLeaguesResponse{SportSlug: sportSlug, Items: items, UpdatedAt: lastUpdatedAt.UTC().Format(time.RFC3339)}, nil
}

func (r *PostgresRepository) ListAdminSeasons(ctx context.Context, sportSlug, leagueSlug string) (domain.AdminSeasonsResponse, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT se.id, se.slug, se.label, se.show, se.start_year, se.end_year, se.default_match_duration_minutes, se.created_at, se.updated_at
		FROM seasons se
		JOIN leagues l ON l.id = se.league_id
		JOIN sports s ON s.id = l.sport_id
		WHERE s.slug = $1 AND l.slug = $2
		ORDER BY se.start_year DESC, se.end_year DESC, se.slug DESC
	`, sportSlug, leagueSlug)
	if err != nil {
		return domain.AdminSeasonsResponse{}, fmt.Errorf("list admin seasons: %w", err)
	}
	defer rows.Close()

	items := make([]domain.AdminSeasonItem, 0)
	lastUpdatedAt := time.Time{}
	for rows.Next() {
		var (
			item      domain.AdminSeasonItem
			createdAt time.Time
			updatedAt time.Time
		)
		if scanErr := rows.Scan(&item.ID, &item.Slug, &item.Label, &item.Show, &item.StartYear, &item.EndYear, &item.DefaultMatchDurationMinutes, &createdAt, &updatedAt); scanErr != nil {
			return domain.AdminSeasonsResponse{}, fmt.Errorf("scan admin season: %w", scanErr)
		}
		item.SportSlug = sportSlug
		item.LeagueSlug = leagueSlug
		item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		items = append(items, item)
		lastUpdatedAt = maxTime(lastUpdatedAt, updatedAt)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminSeasonsResponse{}, fmt.Errorf("iterate admin seasons: %w", err)
	}
	if len(items) == 0 {
		var exists bool
		if err := r.pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM leagues l
				JOIN sports s ON s.id = l.sport_id
				WHERE s.slug = $1 AND l.slug = $2
			)
		`, sportSlug, leagueSlug).Scan(&exists); err != nil {
			return domain.AdminSeasonsResponse{}, fmt.Errorf("check league for admin seasons: %w", err)
		}
		if !exists {
			return domain.AdminSeasonsResponse{}, domain.ErrNotFound
		}
	}
	if lastUpdatedAt.IsZero() {
		lastUpdatedAt = time.Now().UTC()
	}
	return domain.AdminSeasonsResponse{SportSlug: sportSlug, LeagueSlug: leagueSlug, Items: items, UpdatedAt: lastUpdatedAt.UTC().Format(time.RFC3339)}, nil
}

func (r *PostgresRepository) ListAdminTeams(ctx context.Context, sportSlug, leagueSlug string) (domain.AdminTeamsResponse, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.slug, t.name, t.updated_at
		FROM teams t
		JOIN leagues l ON l.id = t.league_id
		JOIN sports s ON s.id = l.sport_id
		WHERE s.slug = $1 AND l.slug = $2
		ORDER BY t.slug ASC
	`, sportSlug, leagueSlug)
	if err != nil {
		return domain.AdminTeamsResponse{}, fmt.Errorf("list admin teams: %w", err)
	}
	defer rows.Close()

	items := make([]domain.AdminTeamItem, 0)
	lastUpdatedAt := time.Time{}
	for rows.Next() {
		var (
			item      domain.AdminTeamItem
			nameRaw   []byte
			updatedAt time.Time
		)
		if scanErr := rows.Scan(&item.ID, &item.Slug, &nameRaw, &updatedAt); scanErr != nil {
			return domain.AdminTeamsResponse{}, fmt.Errorf("scan admin team: %w", scanErr)
		}
		item.Name = decodeLocalizedText(nameRaw)
		items = append(items, item)
		lastUpdatedAt = maxTime(lastUpdatedAt, updatedAt)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminTeamsResponse{}, fmt.Errorf("iterate admin teams: %w", err)
	}
	if len(items) == 0 {
		var exists bool
		if err := r.pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM leagues l
				JOIN sports s ON s.id = l.sport_id
				WHERE s.slug = $1 AND l.slug = $2
			)
		`, sportSlug, leagueSlug).Scan(&exists); err != nil {
			return domain.AdminTeamsResponse{}, fmt.Errorf("check league for admin teams: %w", err)
		}
		if !exists {
			return domain.AdminTeamsResponse{}, domain.ErrNotFound
		}
	}
	if lastUpdatedAt.IsZero() {
		lastUpdatedAt = time.Now().UTC()
	}
	return domain.AdminTeamsResponse{SportSlug: sportSlug, LeagueSlug: leagueSlug, Items: items, UpdatedAt: lastUpdatedAt.UTC().Format(time.RFC3339)}, nil
}

func (r *PostgresRepository) GetSeasonSyncTarget(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.LeagueSyncTarget, error) {
	var target domain.LeagueSyncTarget
	err := r.pool.QueryRow(ctx, `
		SELECT l.id, l.slug, l.sync_interval, se.id, se.slug, se.label
		FROM seasons se
		JOIN leagues l ON l.id = se.league_id
		JOIN sports s ON s.id = l.sport_id
		WHERE s.slug = $1 AND l.slug = $2 AND se.slug = $3
	`, sportSlug, leagueSlug, seasonSlug).Scan(
		&target.LeagueID,
		&target.LeagueSlug,
		&target.SyncInterval,
		&target.SeasonID,
		&target.SeasonSlug,
		&target.SeasonLabel,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.LeagueSyncTarget{}, domain.ErrNotFound
		}
		return domain.LeagueSyncTarget{}, fmt.Errorf("get season sync target: %w", err)
	}
	return target, nil
}

func (r *PostgresRepository) CountUsers(ctx context.Context) (int64, error) {
	var count int64
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return 0, fmt.Errorf("count users: %w", err)
	}
	return count, nil
}

func (r *PostgresRepository) CreateUser(ctx context.Context, email, passwordHash string) (domain.UserRecord, error) {
	var (
		user      domain.UserRecord
		createdAt time.Time
		updatedAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash)
		VALUES ($1, $2)
		RETURNING id, email, created_at, updated_at
	`, email, passwordHash).Scan(&user.ID, &user.Email, &createdAt, &updatedAt)
	if err != nil {
		return domain.UserRecord{}, mapWriteError("create user", err)
	}
	user.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	user.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return user, nil
}

func (r *PostgresRepository) GetUserByEmail(ctx context.Context, email string) (domain.UserRecord, string, error) {
	var (
		user         domain.UserRecord
		passwordHash string
		createdAt    time.Time
		updatedAt    time.Time
	)
	err := r.pool.QueryRow(ctx, `
		SELECT id, email, password_hash, created_at, updated_at
		FROM users
		WHERE email = $1
	`, email).Scan(&user.ID, &user.Email, &passwordHash, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.UserRecord{}, "", domain.ErrNotFound
		}
		return domain.UserRecord{}, "", fmt.Errorf("get user by email: %w", err)
	}
	user.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	user.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return user, passwordHash, nil
}
