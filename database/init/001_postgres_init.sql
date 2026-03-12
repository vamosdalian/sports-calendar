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
    calendar_description JSONB NOT NULL DEFAULT '{}'::JSONB,
    data_source_note JSONB NOT NULL DEFAULT '{}'::JSONB,
    notes JSONB NOT NULL DEFAULT '{}'::JSONB,
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
    default_match_duration_minutes INTEGER NOT NULL DEFAULT 120,
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
    round_name JSONB NOT NULL DEFAULT '{}'::JSONB,
    home_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    away_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    venue JSONB NOT NULL DEFAULT '{}'::JSONB,
    city JSONB NOT NULL DEFAULT '{}'::JSONB,
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
CREATE INDEX idx_matches_home_team_id ON matches (home_team_id);
CREATE INDEX idx_matches_away_team_id ON matches (away_team_id);

INSERT INTO sports (id, slug, name)
VALUES (1, 'football', '{"en": "Football", "zh": "足球"}'::JSONB);

INSERT INTO leagues (id, sport_id, slug, name, calendar_description, data_source_note, notes)
VALUES (
    1,
    1,
    'csl',
    '{"en": "Chinese Super League", "zh": "中国足球超级联赛"}'::JSONB,
    '{"en": "Chinese Super League 2026 match calendar", "zh": "2026 中超赛程日历"}'::JSONB,
    '{"en": "Seed data for local development", "zh": "本地开发初始数据"}'::JSONB,
    '{"en": "Replace with synced production data later", "zh": "后续可替换为同步数据"}'::JSONB
);

INSERT INTO seasons (
    id,
    league_id,
    slug,
    label,
    start_year,
    end_year,
    default_match_duration_minutes
)
VALUES (
    1,
    1,
    '2026',
    '2026',
    2026,
    2026,
    120
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
    home_team_id,
    away_team_id,
    venue,
    city,
    starts_at,
    status
)
VALUES
    (
        1,
        'csl-2026-r1-guoan-shenhua',
        '{"en": "Round 1", "zh": "第1轮"}'::JSONB,
        1,
        2,
        '{"en": "Workers Stadium", "zh": "工人体育场"}'::JSONB,
        '{"en": "Beijing", "zh": "北京"}'::JSONB,
        '2026-03-14T19:35:00+08:00',
        'scheduled'
    ),
    (
        1,
        'csl-2026-r1-taishan-rongcheng',
        '{"en": "Round 1", "zh": "第1轮"}'::JSONB,
        3,
        4,
        '{"en": "Jinan Olympic Sports Center", "zh": "济南奥体中心"}'::JSONB,
        '{"en": "Jinan", "zh": "济南"}'::JSONB,
        '2026-03-15T19:35:00+08:00',
        'scheduled'
    );