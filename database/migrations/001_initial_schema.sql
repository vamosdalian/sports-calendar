CREATE TABLE sports (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE leagues (
    id BIGSERIAL PRIMARY KEY,
    sport_id BIGINT NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name JSONB NOT NULL,
    country_name JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sport_id, slug)
);

CREATE TABLE seasons (
    id BIGSERIAL PRIMARY KEY,
    league_id BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    label TEXT NOT NULL,
    start_year SMALLINT NOT NULL,
    end_year SMALLINT NOT NULL,
    timezone TEXT NOT NULL,
    default_match_duration_minutes INTEGER NOT NULL DEFAULT 120,
    calendar_description JSONB NOT NULL DEFAULT '{}'::JSONB,
    data_source_note JSONB NOT NULL DEFAULT '{}'::JSONB,
    notes JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (league_id, slug)
);

CREATE TABLE teams (
    id BIGSERIAL PRIMARY KEY,
    league_id BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name JSONB NOT NULL,
    short_name JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (league_id, slug)
);

CREATE TABLE matches (
    id BIGSERIAL PRIMARY KEY,
    season_id BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL UNIQUE,
    round_name TEXT NOT NULL,
    title JSONB NOT NULL DEFAULT '{}'::JSONB,
    home_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    away_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    venue TEXT NOT NULL,
    city TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'finished', 'cancelled', 'postponed')),
    ticket_open_at TIMESTAMPTZ NULL,
    ticket_url TEXT NULL,
    ticket_channel JSONB NOT NULL DEFAULT '{}'::JSONB,
    source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leagues_sport_id ON leagues (sport_id);
CREATE INDEX idx_seasons_league_id ON seasons (league_id);
CREATE INDEX idx_seasons_year_range ON seasons (start_year, end_year);
CREATE INDEX idx_teams_league_id ON teams (league_id);
CREATE INDEX idx_matches_season_id_starts_at ON matches (season_id, starts_at);
CREATE INDEX idx_matches_home_team_id ON matches (home_team_id);
CREATE INDEX idx_matches_away_team_id ON matches (away_team_id);