"""Upsert helpers that persist scraped dicts into Postgres."""

from __future__ import annotations

from datetime import datetime, time

from sqlalchemy import delete, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.models import TeamKind


# ── Countries ────────────────────────────────────────────────────────────────
async def upsert_country(session: AsyncSession, data: dict) -> None:
    values = {
        "id": data["id"],
        "name": data.get("name") or str(data["id"]),
        "url": data.get("url"),
    }
    stmt = insert(models.Country).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["id"],
        set_={"name": stmt.excluded.name, "url": stmt.excluded.url,
              "updated_at": datetime.utcnow()},
    )
    await session.execute(stmt)


# ── Teams (national teams + clubs) ───────────────────────────────────────────
async def upsert_team(session: AsyncSession, team: dict) -> None:
    tid = team.get("team_id") or team.get("id")
    kind = team.get("kind") or TeamKind.club
    if isinstance(kind, str):
        kind = TeamKind(kind)
    values = {
        "id": tid,
        "kind": kind,
        "name": team.get("name") or str(tid),
        "slug": team.get("slug"),
        "country_id": team.get("country_id"),
        "parent_team_id": team.get("parent_team_id"),
        "url": team.get("url"),
        "logo_url": team.get("logo_url"),
        "extra": team.get("extra"),
    }
    stmt = insert(models.Team).values(**values)
    # Keep an existing non-null slug/country/url if a later shallow discovery
    # passes NULLs (e.g. a team first seen as a fixture opponent).
    set_ = {"name": stmt.excluded.name, "kind": stmt.excluded.kind,
            "updated_at": datetime.utcnow()}
    for col in ("slug", "country_id", "parent_team_id", "url", "logo_url", "extra"):
        set_[col] = func.coalesce(stmt.excluded[col], getattr(models.Team, col))
    stmt = stmt.on_conflict_do_update(index_elements=["id"], set_=set_)
    await session.execute(stmt)


# ── Competitions ─────────────────────────────────────────────────────────────
async def upsert_competition(session: AsyncSession, data: dict) -> None:
    stmt = insert(models.Competition).values(**data)
    update_cols = {k: getattr(stmt.excluded, k) for k in data if k != "id"}
    update_cols["updated_at"] = datetime.utcnow()
    stmt = stmt.on_conflict_do_update(index_elements=["id"], set_=update_cols)
    await session.execute(stmt)


async def upsert_competition_shallow(
    session: AsyncSession, comp_id: str, name: str
) -> None:
    """For competitions discovered from a team's fixtures: record id + name
    without guessing/overwriting type (filled later by proper discovery)."""
    stmt = insert(models.Competition).values(
        id=comp_id, name=name or comp_id, type=models.CompetitionType.other
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["id"],
        set_={"name": func.coalesce(models.Competition.name, stmt.excluded.name),
              "updated_at": datetime.utcnow()},
    )
    await session.execute(stmt)


async def upsert_team_competition_season(
    session: AsyncSession, *, team_id: int, competition_id: str, season_id: int,
    squad_size: int | None = None, avg_age: float | None = None,
    foreigners: int | None = None, market_value: int | None = None,
    extra: dict | None = None,
) -> None:
    values = dict(
        team_id=team_id, competition_id=competition_id, season_id=season_id,
        squad_size=squad_size, avg_age=avg_age, foreigners=foreigners,
        market_value=market_value, extra=extra,
    )
    stmt = insert(models.TeamCompetitionSeason).values(**values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_team_comp_season",
        set_={k: getattr(stmt.excluded, k)
              for k in ("squad_size", "avg_age", "foreigners", "market_value", "extra")}
        | {"updated_at": datetime.utcnow()},
    )
    await session.execute(stmt)


# ── Players ──────────────────────────────────────────────────────────────────
async def upsert_player(session: AsyncSession, player: dict) -> None:
    values = {
        "id": player.get("player_id") or player.get("id"),
        "name": player.get("name") or str(player.get("player_id") or player.get("id")),
        "slug": player.get("slug"),
        "position": player.get("position"),
        "date_of_birth": player.get("date_of_birth"),
        "nationality": player.get("nationality"),
        "market_value": player.get("market_value"),
    }
    stmt = insert(models.Player).values(**values)
    set_ = {k: getattr(stmt.excluded, k) for k in values if k != "id"}
    set_["updated_at"] = datetime.utcnow()
    stmt = stmt.on_conflict_do_update(index_elements=["id"], set_=set_)
    await session.execute(stmt)


async def update_player_profile(session: AsyncSession, profile: dict) -> None:
    """Set bio fields from the profile page. Does not overwrite the name."""
    pid = profile.get("player_id") or profile.get("id")
    values = {
        "id": pid,
        "name": profile.get("name") or str(pid),
        "position": profile.get("position"),
        "date_of_birth": profile.get("date_of_birth"),
        "nationality": profile.get("nationality"),
        "height_cm": profile.get("height_cm"),
        "foot": profile.get("foot"),
        "market_value": profile.get("market_value"),
        "extra": profile.get("extra"),
        "profile_crawled_at": datetime.utcnow(),
    }
    stmt = insert(models.Player).values(**values)
    set_ = {
        k: getattr(stmt.excluded, k)
        for k in (
            "position", "date_of_birth", "nationality", "height_cm",
            "foot", "market_value", "extra", "profile_crawled_at",
        )
    }
    set_["updated_at"] = datetime.utcnow()
    stmt = stmt.on_conflict_do_update(index_elements=["id"], set_=set_)
    await session.execute(stmt)


async def upsert_player_team_season(
    session: AsyncSession, *, player_id: int, team_id: int, season_id: int,
    shirt_number: str | None = None, market_value: int | None = None,
) -> None:
    values = dict(
        player_id=player_id, team_id=team_id, season_id=season_id,
        shirt_number=shirt_number, market_value=market_value,
    )
    stmt = insert(models.PlayerTeamSeason).values(**values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_player_team_season",
        set_={"shirt_number": stmt.excluded.shirt_number,
              "market_value": stmt.excluded.market_value,
              "updated_at": datetime.utcnow()},
    )
    await session.execute(stmt)


# ── Fixtures ─────────────────────────────────────────────────────────────────
async def delete_fixtures(
    session: AsyncSession, competition_id: str, season_id: int
) -> None:
    await session.execute(
        delete(models.Fixture).where(
            models.Fixture.competition_id == competition_id,
            models.Fixture.season_id == season_id,
        )
    )


async def upsert_fixture(
    session: AsyncSession, *, competition_id: str, season_id: int, fx: dict,
) -> None:
    kickoff = None
    if fx.get("date"):
        kickoff = datetime.combine(fx["date"], fx.get("time") or time(0, 0))
    values = dict(
        match_id=fx.get("match_id"),
        competition_id=competition_id,
        season_id=season_id,
        matchday=fx.get("matchday"),
        kickoff=kickoff,
        home_team_id=fx.get("home_team_id"),
        away_team_id=fx.get("away_team_id"),
        home_name=fx.get("home_name"),
        away_name=fx.get("away_name"),
        home_score=fx.get("home_score"),
        away_score=fx.get("away_score"),
    )
    if fx.get("match_id"):
        stmt = insert(models.Fixture).values(**values)
        set_ = {k: getattr(stmt.excluded, k) for k in values if k != "match_id"}
        set_["updated_at"] = datetime.utcnow()
        stmt = stmt.on_conflict_do_update(constraint="uq_fixture_match_id", set_=set_)
        await session.execute(stmt)
    else:
        await session.execute(insert(models.Fixture).values(**values))


# ── Standings ────────────────────────────────────────────────────────────────
async def delete_standings(
    session: AsyncSession, competition_id: str, season_id: int
) -> None:
    await session.execute(
        delete(models.Standing).where(
            models.Standing.competition_id == competition_id,
            models.Standing.season_id == season_id,
        )
    )


async def upsert_standing(
    session: AsyncSession, *, competition_id: str, season_id: int, row: dict,
) -> None:
    values = dict(
        competition_id=competition_id,
        season_id=season_id,
        team_id=row["team_id"],
        group=row.get("group") or "",
        rank=row.get("rank"),
        played=row.get("played"),
        win=row.get("win"),
        draw=row.get("draw"),
        loss=row.get("loss"),
        goals_for=row.get("goals_for"),
        goals_against=row.get("goals_against"),
        goal_diff=row.get("goal_diff"),
        points=row.get("points"),
    )
    stmt = insert(models.Standing).values(**values)
    set_ = {
        k: getattr(stmt.excluded, k)
        for k in values if k not in ("competition_id", "season_id", "team_id", "group")
    }
    set_["updated_at"] = datetime.utcnow()
    stmt = stmt.on_conflict_do_update(
        constraint="uq_standing_comp_season_team", set_=set_
    )
    await session.execute(stmt)
