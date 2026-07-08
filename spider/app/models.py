from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class CompetitionType(str, enum.Enum):
    league = "league"
    cup = "cup"
    international = "international"
    other = "other"


class TeamKind(str, enum.Enum):
    national = "national"  # national team (A / youth / women)
    club = "club"


class CrawlKind(str, enum.Enum):
    # Competition-dimension (the primary axis): enter via competition + season.
    competition_clubs = "competition_clubs"          # participants -> team_competition_seasons
    competition_standings = "competition_standings"  # league/group table
    competition_fixtures = "competition_fixtures"     # whole-season match list
    # Team-dimension: enter via a team (national teams, ad-hoc, reverse-discovery).
    team_fixtures = "team_fixtures"
    team_squad = "team_squad"
    player_profile = "player_profile"
    fallback_discovery = "fallback_discovery"


class CrawlStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"
    skipped = "skipped"
    cancelled = "cancelled"


# Sentinel season for tasks that have no season dimension (player_profile,
# fallback_discovery). Keeping it non-null makes the (kind, target_id,
# season_id) unique constraint dedupe correctly (NULLs would be distinct).
NO_SEASON = 0


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# ── Countries ────────────────────────────────────────────────────────────────
class Country(Base, TimestampMixin):
    __tablename__ = "countries"

    # Transfermarkt flag id (e.g. England = 189).
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(128))
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_crawled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ── Teams (national teams + clubs) ───────────────────────────────────────────
class Team(Base, TimestampMixin):
    __tablename__ = "teams"

    # Transfermarkt "verein" id (national teams are vereine too).
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    kind: Mapped[TeamKind] = mapped_column(Enum(TeamKind, name="team_kind"))
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country_id: Mapped[int | None] = mapped_column(
        ForeignKey("countries.id", ondelete="SET NULL"), nullable=True
    )
    parent_team_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_crawled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


# ── Competitions (leagues / cups / international) ────────────────────────────
class Competition(Base, TimestampMixin):
    __tablename__ = "competitions"

    # Transfermarkt competition code, e.g. "GB1", "ES1", "CL", "FIWC".
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    type: Mapped[CompetitionType] = mapped_column(
        Enum(CompetitionType, name="competition_type"),
        default=CompetitionType.league,
    )
    # Participating subject: clubs (Champions League) or national teams (World
    # Cup). Drives which crawl edges apply.
    kind_of_teams: Mapped[TeamKind | None] = mapped_column(
        Enum(TeamKind, name="team_kind"), nullable=True
    )
    country_id: Mapped[int | None] = mapped_column(
        ForeignKey("countries.id", ondelete="SET NULL"), nullable=True
    )
    tier: Mapped[str | None] = mapped_column(String(64), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Real season list scraped from the saison_id dropdown:
    # [{"id": 2023, "label": "2024"}, ...]. None until first fetched.
    seasons: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    last_crawled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


# ── Team participation in a competition for a season ─────────────────────────
class TeamCompetitionSeason(Base, TimestampMixin):
    __tablename__ = "team_competition_seasons"
    __table_args__ = (
        UniqueConstraint(
            "team_id", "competition_id", "season_id", name="uq_team_comp_season"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    competition_id: Mapped[str] = mapped_column(
        ForeignKey("competitions.id", ondelete="CASCADE")
    )
    season_id: Mapped[int] = mapped_column(Integer)  # season start year
    squad_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_age: Mapped[float | None] = mapped_column(Float, nullable=True)
    foreigners: Mapped[int | None] = mapped_column(Integer, nullable=True)
    market_value: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    team: Mapped[Team] = relationship(lazy="joined")


# ── Players ──────────────────────────────────────────────────────────────────
class Player(Base, TimestampMixin):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[str | None] = mapped_column(String(64), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(128), nullable=True)
    height_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    foot: Mapped[str | None] = mapped_column(String(16), nullable=True)
    market_value: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # Set once the player_profile page has been scraped.
    profile_crawled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class PlayerTeamSeason(Base, TimestampMixin):
    """A player on a team's roster for a season (club or national team)."""

    __tablename__ = "player_team_seasons"
    __table_args__ = (
        UniqueConstraint(
            "player_id", "team_id", "season_id", name="uq_player_team_season"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    season_id: Mapped[int] = mapped_column(Integer)
    shirt_number: Mapped[str | None] = mapped_column(String(8), nullable=True)
    market_value: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    contract_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    player: Mapped[Player] = relationship(lazy="joined")


# ── Fixtures / matches ───────────────────────────────────────────────────────
class Fixture(Base, TimestampMixin):
    __tablename__ = "fixtures"
    __table_args__ = (UniqueConstraint("match_id", name="uq_fixture_match_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    competition_id: Mapped[str] = mapped_column(
        ForeignKey("competitions.id", ondelete="CASCADE")
    )
    season_id: Mapped[int] = mapped_column(Integer)
    matchday: Mapped[str | None] = mapped_column(String(64), nullable=True)
    kickoff: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )
    home_team_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    away_team_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    home_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    away_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


# ── League / group standings ─────────────────────────────────────────────────
class Standing(Base, TimestampMixin):
    __tablename__ = "standings"
    __table_args__ = (
        UniqueConstraint(
            "competition_id", "season_id", "team_id", "group",
            name="uq_standing_comp_season_team",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    competition_id: Mapped[str] = mapped_column(
        ForeignKey("competitions.id", ondelete="CASCADE")
    )
    season_id: Mapped[int] = mapped_column(Integer)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    # "" for a single-table league; group label for group stages.
    group: Mapped[str] = mapped_column(String(32), default="")
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    played: Mapped[int | None] = mapped_column(Integer, nullable=True)
    win: Mapped[int | None] = mapped_column(Integer, nullable=True)
    draw: Mapped[int | None] = mapped_column(Integer, nullable=True)
    loss: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goals_for: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goals_against: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goal_diff: Mapped[int | None] = mapped_column(Integer, nullable=True)
    points: Mapped[int | None] = mapped_column(Integer, nullable=True)

    team: Mapped[Team] = relationship(lazy="joined")


# ── Crawl tasks (queue + dedup ledger; replaces scrape_jobs) ─────────────────
class CrawlTask(Base, TimestampMixin):
    __tablename__ = "crawl_tasks"
    __table_args__ = (
        UniqueConstraint(
            "kind", "target_id", "season_id", name="uq_crawl_task"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    kind: Mapped[CrawlKind] = mapped_column(Enum(CrawlKind, name="crawl_kind"))
    target_id: Mapped[str] = mapped_column(String(64))
    season_id: Mapped[int] = mapped_column(Integer, default=NO_SEASON)
    status: Mapped[CrawlStatus] = mapped_column(
        Enum(CrawlStatus, name="crawl_status"),
        default=CrawlStatus.pending,
        index=True,
    )
    priority: Mapped[int] = mapped_column(Integer, default=100)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ── Raw page snapshots (stored in object storage) ───────────────────────────
class RawSnapshot(Base, TimestampMixin):
    __tablename__ = "raw_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    url: Mapped[str] = mapped_column(Text)
    s3_key: Mapped[str] = mapped_column(Text)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crawl_tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
