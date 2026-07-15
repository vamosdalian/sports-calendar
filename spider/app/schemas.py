from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models import CompetitionType, CrawlKind, CrawlStatus, TeamKind


class CountryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    url: str | None = None
    last_crawled_at: datetime | None = None


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: TeamKind
    name: str
    slug: str | None = None
    country_id: int | None = None
    parent_team_id: int | None = None
    logo_url: str | None = None


class CompetitionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    type: CompetitionType
    kind_of_teams: TeamKind | None = None
    country_id: int | None = None
    tier: str | None = None
    logo_url: str | None = None


class SeasonOut(BaseModel):
    id: int
    label: str


class PlayerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    position: str | None = None
    date_of_birth: date | None = None
    nationality: str | None = None
    height_cm: int | None = None
    foot: str | None = None
    market_value: int | None = None


class FixtureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    match_id: int | None = None
    competition_id: str
    season_id: int
    matchday: str | None = None
    kickoff: datetime | None = None
    home_team_id: int | None = None
    away_team_id: int | None = None
    home_name: str | None = None
    away_name: str | None = None
    home_score: int | None = None
    away_score: int | None = None


class StandingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    team_id: int
    group: str
    rank: int | None = None
    played: int | None = None
    win: int | None = None
    draw: int | None = None
    loss: int | None = None
    goals_for: int | None = None
    goals_against: int | None = None
    goal_diff: int | None = None
    points: int | None = None


class CrawlEnqueueIn(BaseModel):
    kind: CrawlKind
    target_id: str
    # If omitted for season-scoped tasks, the last 5 seasons are used.
    seasons: list[int] | None = None
    priority: int = 100


class CrawlEnqueueOut(BaseModel):
    enqueued: int
    # Poll these via GET /api/crawl/tasks/{id} to wait for the crawl to finish.
    task_ids: list[uuid.UUID]


class CrawlTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    kind: CrawlKind
    target_id: str
    season_id: int
    status: CrawlStatus
    priority: int
    attempts: int
    progress: int
    total: int
    message: str | None = None
    last_error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
