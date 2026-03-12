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
    slug TEXT NOT NULL UNIQUE,
    name JSONB NOT NULL,
    country_name JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

INSERT INTO sports (id, slug, name)
VALUES (1, 'football', '{"en": "Football", "zh": "足球"}'::JSONB);

INSERT INTO leagues (id, sport_id, slug, name, country_name)
VALUES (1, 1, 'csl', '{"en": "Chinese Super League", "zh": "中国足球超级联赛"}'::JSONB, '{"en": "China", "zh": "中国"}'::JSONB);

INSERT INTO seasons (
    id,
    league_id,
    slug,
    label,
    start_year,
    end_year,
    timezone,
    default_match_duration_minutes,
    calendar_description,
    data_source_note,
    notes
)
VALUES (
    1,
    1,
    '2026',
    '2026',
    2026,
    2026,
    'Asia/Shanghai',
    120,
    '{"en": "Chinese Super League 2026 match calendar", "zh": "2026 中超赛程日历"}'::JSONB,
    '{"en": "Seed data for local development", "zh": "本地开发初始数据"}'::JSONB,
    '{"en": "Replace with synced production data later", "zh": "后续可替换为同步数据"}'::JSONB
);

INSERT INTO teams (id, league_id, slug, name, short_name)
VALUES
    (1, 1, 'beijing-guoan', '{"en": "Beijing Guoan", "zh": "北京国安"}'::JSONB, '{"en": "Guoan", "zh": "国安"}'::JSONB),
    (2, 1, 'shanghai-shenhua', '{"en": "Shanghai Shenhua", "zh": "上海申花"}'::JSONB, '{"en": "Shenhua", "zh": "申花"}'::JSONB),
    (3, 1, 'shandong-taishan', '{"en": "Shandong Taishan", "zh": "山东泰山"}'::JSONB, '{"en": "Taishan", "zh": "泰山"}'::JSONB),
    (4, 1, 'chengdu-rongcheng', '{"en": "Chengdu Rongcheng", "zh": "成都蓉城"}'::JSONB, '{"en": "Rongcheng", "zh": "蓉城"}'::JSONB);

INSERT INTO matches (
    season_id,
    external_id,
    round_name,
    title,
    home_team_id,
    away_team_id,
    venue,
    city,
    starts_at,
    status,
    ticket_open_at,
    ticket_url,
    ticket_channel
)
VALUES
    (
        1,
        'csl-2026-r1-guoan-shenhua',
        'Round 1',
        '{"en": "Beijing Guoan vs Shanghai Shenhua", "zh": "北京国安 vs 上海申花"}'::JSONB,
        1,
        2,
        'Workers Stadium',
        'Beijing',
        '2026-03-14T19:35:00+08:00',
        'scheduled',
        '2026-03-10T10:00:00+08:00',
        'https://tickets.example.com/csl/guoan-shenhua',
        '{"en": "Official Ticketing", "zh": "官方票务"}'::JSONB
    ),
    (
        1,
        'csl-2026-r1-taishan-rongcheng',
        'Round 1',
        '{"en": "Shandong Taishan vs Chengdu Rongcheng", "zh": "山东泰山 vs 成都蓉城"}'::JSONB,
        3,
        4,
        'Jinan Olympic Sports Center',
        'Jinan',
        '2026-03-15T19:35:00+08:00',
        'scheduled',
        NULL,
        NULL,
        '{}'::JSONB
    );