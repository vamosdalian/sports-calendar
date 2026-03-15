CREATE TABLE sports (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE leagues (
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
);

CREATE TABLE seasons (
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
);

CREATE TABLE teams (
    id BIGINT PRIMARY KEY,
    league_id BIGINT NOT NULL,
    slug TEXT NOT NULL,
    name JSONB NOT NULL,
    short_name JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (league_id, slug)
);

CREATE TABLE matches (
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
);

CREATE INDEX idx_leagues_sport_id ON leagues (sport_id);
CREATE INDEX idx_seasons_league_id ON seasons (league_id);
CREATE INDEX idx_seasons_year_range ON seasons (start_year, end_year);
CREATE INDEX idx_teams_league_id ON teams (league_id);
CREATE INDEX idx_matches_season_id_starts_at ON matches (season_id, starts_at);
CREATE INDEX idx_matches_teams ON matches USING GIN (teams);