"""Read-only browsing of the crawled data."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.db import get_session

router = APIRouter(prefix="/api/data", tags=["data"])


@router.get("/teams", response_model=list[schemas.TeamOut])
async def teams(
    session: AsyncSession = Depends(get_session),
    country_id: int | None = None,
    kind: models.TeamKind | None = None,
    q: str | None = None,
    limit: int = Query(200, le=1000),
):
    stmt = select(models.Team)
    if country_id is not None:
        stmt = stmt.where(models.Team.country_id == country_id)
    if kind is not None:
        stmt = stmt.where(models.Team.kind == kind)
    if q:
        stmt = stmt.where(models.Team.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(models.Team.name).limit(limit)
    return (await session.execute(stmt)).scalars().all()


@router.get("/squad", response_model=list[schemas.PlayerOut])
async def squad(
    team_id: int,
    season_id: int,
    session: AsyncSession = Depends(get_session),
):
    stmt = (
        select(models.Player)
        .join(
            models.PlayerTeamSeason,
            models.PlayerTeamSeason.player_id == models.Player.id,
        )
        .where(
            models.PlayerTeamSeason.team_id == team_id,
            models.PlayerTeamSeason.season_id == season_id,
        )
        .order_by(models.Player.name)
    )
    return (await session.execute(stmt)).scalars().all()


@router.get("/standings", response_model=list[schemas.StandingOut])
async def standings(
    competition_id: str,
    season_id: int,
    session: AsyncSession = Depends(get_session),
):
    stmt = (
        select(models.Standing)
        .where(
            models.Standing.competition_id == competition_id,
            models.Standing.season_id == season_id,
        )
        .order_by(models.Standing.group, models.Standing.rank.nulls_last())
    )
    return (await session.execute(stmt)).scalars().all()


@router.get("/fixtures", response_model=list[schemas.FixtureOut])
async def fixtures(
    session: AsyncSession = Depends(get_session),
    competition_id: str | None = None,
    team_id: int | None = None,
    season_id: int | None = None,
    limit: int = Query(1000, le=5000),
):
    stmt = select(models.Fixture)
    if competition_id is not None:
        stmt = stmt.where(models.Fixture.competition_id == competition_id)
    if team_id is not None:
        stmt = stmt.where(
            (models.Fixture.home_team_id == team_id)
            | (models.Fixture.away_team_id == team_id)
        )
    if season_id is not None:
        stmt = stmt.where(models.Fixture.season_id == season_id)
    stmt = stmt.order_by(
        models.Fixture.kickoff.nulls_last(), models.Fixture.id
    ).limit(limit)
    return (await session.execute(stmt)).scalars().all()


@router.get("/competitions", response_model=list[schemas.CompetitionOut])
async def competitions(
    session: AsyncSession = Depends(get_session),
    country_id: int | None = None,
    type: models.CompetitionType | None = None,
    q: str | None = None,
):
    stmt = select(models.Competition)
    if country_id is not None:
        stmt = stmt.where(models.Competition.country_id == country_id)
    if type is not None:
        stmt = stmt.where(models.Competition.type == type)
    if q:
        stmt = stmt.where(models.Competition.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(models.Competition.name)
    return (await session.execute(stmt)).scalars().all()
