package migrations

import (
	"context"
	"fmt"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
)

const advisoryLockKey int64 = 2026041201

type migration struct {
	version    int64
	name       string
	statements []string
}

type schemaState struct {
	hasCoreTables bool
	hasUsersTable bool
	hasShowFlags  bool
}

var allMigrations = []migration{
	{
		version: 1,
		name:    "postgres_init",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS sports (
			    id BIGSERIAL PRIMARY KEY,
			    slug TEXT NOT NULL UNIQUE,
			    name JSONB NOT NULL,
			    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`,
			`CREATE TABLE IF NOT EXISTS leagues (
			    id BIGINT PRIMARY KEY,
			    sport_id BIGINT NOT NULL,
			    slug TEXT NOT NULL UNIQUE,
			    name JSONB NOT NULL,
			    sync_interval TEXT NOT NULL DEFAULT '@daily',
			    calendar_description JSONB NOT NULL DEFAULT '{}'::JSONB,
			    data_source_note JSONB NOT NULL DEFAULT '{}'::JSONB,
			    notes JSONB NOT NULL DEFAULT '{}'::JSONB,
			    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`,
			`CREATE TABLE IF NOT EXISTS seasons (
			    id BIGSERIAL PRIMARY KEY,
			    league_id BIGINT NOT NULL,
			    slug TEXT NOT NULL,
			    label TEXT NOT NULL,
			    start_year SMALLINT NOT NULL,
			    end_year SMALLINT NOT NULL,
			    default_match_duration_minutes INTEGER NOT NULL DEFAULT 120,
			    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			    UNIQUE (league_id, slug)
			)`,
			`CREATE TABLE IF NOT EXISTS teams (
			    id BIGINT PRIMARY KEY,
			    league_id BIGINT NOT NULL,
			    slug TEXT NOT NULL,
			    name JSONB NOT NULL,
			    short_name JSONB NOT NULL DEFAULT '{}'::JSONB,
			    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			    UNIQUE (league_id, slug)
			)`,
			`CREATE TABLE IF NOT EXISTS matches (
			    id BIGSERIAL PRIMARY KEY,
			    season_id BIGINT NOT NULL,
			    external_id TEXT NOT NULL UNIQUE,
			    teams BIGINT[] NOT NULL DEFAULT '{}',
			    round_name JSONB NOT NULL DEFAULT '{}'::JSONB,
			    venue JSONB NOT NULL DEFAULT '{}'::JSONB,
			    city JSONB NOT NULL DEFAULT '{}'::JSONB,
			    country JSONB NOT NULL DEFAULT '{}'::JSONB,
			    starts_at TIMESTAMPTZ NOT NULL,
			    status TEXT NOT NULL CHECK (status IN ('scheduled', 'finished', 'cancelled', 'postponed')),
			    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`,
			`CREATE INDEX IF NOT EXISTS idx_leagues_sport_id ON leagues (sport_id)`,
			`CREATE INDEX IF NOT EXISTS idx_seasons_league_id ON seasons (league_id)`,
			`CREATE INDEX IF NOT EXISTS idx_seasons_year_range ON seasons (start_year, end_year)`,
			`CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams (league_id)`,
			`CREATE INDEX IF NOT EXISTS idx_matches_season_id_starts_at ON matches (season_id, starts_at)`,
			`CREATE INDEX IF NOT EXISTS idx_matches_teams ON matches USING GIN (teams)`,
		},
	},
	{
		version: 2,
		name:    "auth_init",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS users (
			    id BIGSERIAL PRIMARY KEY,
			    email TEXT NOT NULL UNIQUE,
			    password_hash TEXT NOT NULL,
			    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`,
			`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`,
		},
	},
	{
		version: 3,
		name:    "show_flags",
		statements: []string{
			`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS show BOOLEAN NOT NULL DEFAULT FALSE`,
			`ALTER TABLE seasons ADD COLUMN IF NOT EXISTS show BOOLEAN NOT NULL DEFAULT FALSE`,
			`CREATE INDEX IF NOT EXISTS idx_leagues_show ON leagues (show)`,
			`CREATE INDEX IF NOT EXISTS idx_seasons_show ON seasons (show)`,
		},
	},
}

func Run(ctx context.Context, pool *pgxpool.Pool, logger *logrus.Logger) error {
	if pool == nil {
		return fmt.Errorf("postgres pool is required")
	}

	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin migration transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, advisoryLockKey); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	if err := ensureMigrationsTable(ctx, tx); err != nil {
		return err
	}
	if err := recordBaselineIfNeeded(ctx, tx, logger); err != nil {
		return err
	}

	applied, err := loadAppliedVersions(ctx, tx)
	if err != nil {
		return err
	}

	for _, item := range allMigrations {
		if applied[item.version] {
			continue
		}
		if logger != nil {
			logger.WithFields(logrus.Fields{"version": item.version, "name": item.name}).Info("applying database migration")
		}
		for _, statement := range item.statements {
			if _, err := tx.Exec(ctx, statement); err != nil {
				return fmt.Errorf("apply migration %d (%s): %w", item.version, item.name, err)
			}
		}
		if err := insertAppliedVersion(ctx, tx, item.version, item.name); err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit migration transaction: %w", err)
	}
	return nil
}

func ensureMigrationsTable(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version BIGINT PRIMARY KEY,
			name TEXT NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("ensure schema_migrations table: %w", err)
	}
	return nil
}

func recordBaselineIfNeeded(ctx context.Context, tx pgx.Tx, logger *logrus.Logger) error {
	var count int64
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM schema_migrations`).Scan(&count); err != nil {
		return fmt.Errorf("count schema migrations: %w", err)
	}
	if count > 0 {
		return nil
	}

	state, err := inspectSchemaState(ctx, tx)
	if err != nil {
		return err
	}
	versions := baselineVersions(state)
	if len(versions) == 0 {
		return nil
	}

	for _, version := range versions {
		item, ok := migrationByVersion(version)
		if !ok {
			return fmt.Errorf("baseline migration version %d not found", version)
		}
		if err := insertAppliedVersion(ctx, tx, item.version, item.name); err != nil {
			return err
		}
		if logger != nil {
			logger.WithFields(logrus.Fields{"version": item.version, "name": item.name}).Info("recorded database migration baseline")
		}
	}
	return nil
}

func loadAppliedVersions(ctx context.Context, tx pgx.Tx) (map[int64]bool, error) {
	rows, err := tx.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return nil, fmt.Errorf("load applied schema migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[int64]bool)
	for rows.Next() {
		var version int64
		if err := rows.Scan(&version); err != nil {
			return nil, fmt.Errorf("scan schema migration version: %w", err)
		}
		applied[version] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate schema migration versions: %w", err)
	}
	return applied, nil
}

func insertAppliedVersion(ctx context.Context, tx pgx.Tx, version int64, name string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO schema_migrations (version, name)
		VALUES ($1, $2)
		ON CONFLICT (version) DO NOTHING
	`, version, name)
	if err != nil {
		return fmt.Errorf("record schema migration %d (%s): %w", version, name, err)
	}
	return nil
}

func inspectSchemaState(ctx context.Context, tx pgx.Tx) (schemaState, error) {
	coreTables := []string{"sports", "leagues", "seasons", "teams", "matches"}
	hasCoreTables := true
	for _, table := range coreTables {
		exists, err := tableExists(ctx, tx, table)
		if err != nil {
			return schemaState{}, err
		}
		if !exists {
			hasCoreTables = false
			break
		}
	}

	hasUsersTable, err := tableExists(ctx, tx, "users")
	if err != nil {
		return schemaState{}, err
	}

	leagueShow, err := columnExists(ctx, tx, "leagues", "show")
	if err != nil {
		return schemaState{}, err
	}
	seasonShow, err := columnExists(ctx, tx, "seasons", "show")
	if err != nil {
		return schemaState{}, err
	}

	return schemaState{
		hasCoreTables: hasCoreTables,
		hasUsersTable: hasUsersTable,
		hasShowFlags:  leagueShow && seasonShow,
	}, nil
}

func tableExists(ctx context.Context, tx pgx.Tx, tableName string) (bool, error) {
	var exists bool
	err := tx.QueryRow(ctx, `SELECT to_regclass($1) IS NOT NULL`, "public."+tableName).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check table %s exists: %w", tableName, err)
	}
	return exists, nil
}

func columnExists(ctx context.Context, tx pgx.Tx, tableName, columnName string) (bool, error) {
	var exists bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = $1
			  AND column_name = $2
		)
	`, tableName, columnName).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check column %s.%s exists: %w", tableName, columnName, err)
	}
	return exists, nil
}

func baselineVersions(state schemaState) []int64 {
	versions := make([]int64, 0, len(allMigrations))
	if state.hasCoreTables {
		versions = append(versions, 1)
	}
	if state.hasUsersTable {
		versions = append(versions, 2)
	}
	if state.hasShowFlags {
		versions = append(versions, 3)
	}
	sort.Slice(versions, func(i, j int) bool {
		return versions[i] < versions[j]
	})
	return versions
}

func migrationByVersion(version int64) (migration, bool) {
	for _, item := range allMigrations {
		if item.version == version {
			return item, true
		}
	}
	return migration{}, false
}
