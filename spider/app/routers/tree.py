"""Lazy selection-tree expansion.

Each endpoint enumerates the *next* level (countries -> national teams /
competitions -> seasons -> teams) and upserts the lightweight entity rows so
the frontend tree can be browsed without launching heavy crawl tasks.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, repository, schemas
from app.db import get_session
from app.scraper import discovery
from app.scraper import parse_utils as pu
from app.scraper import quickselect
from app.scraper import transfermarkt as tm

router = APIRouter(prefix="/api/tree", tags=["tree"])


@router.get("/countries", response_model=list[schemas.CountryOut])
async def countries(session: AsyncSession = Depends(get_session)):
    for c in await quickselect.countries():
        await repository.upsert_country(session, {
            "id": int(c["id"]),
            "name": c.get("name"),
            "url": c.get("link"),
        })
    await session.commit()
    rows = (await session.execute(
        select(models.Country).order_by(models.Country.name)
    )).scalars().all()
    return rows


@router.get(
    "/countries/{country_id}/national-teams",
    response_model=list[schemas.TeamOut],
)
async def national_teams(
    country_id: int, session: AsyncSession = Depends(get_session)
):
    teams = await discovery.scrape_country_national_teams(country_id)
    for t in teams:
        await repository.upsert_team(session, {
            **t,
            "url": f"/{t.get('slug') or 'x'}/startseite/verein/{t['team_id']}",
        })
    await session.commit()
    rows = (await session.execute(
        select(models.Team)
        .where(models.Team.country_id == country_id,
               models.Team.kind == models.TeamKind.national)
        .order_by(models.Team.name)
    )).scalars().all()
    return rows


@router.get(
    "/countries/{country_id}/competitions",
    response_model=list[schemas.CompetitionOut],
)
async def country_competitions(
    country_id: int, session: AsyncSession = Depends(get_session)
):
    country = await session.get(models.Country, country_id)
    name = country.name if country else str(country_id)
    comps = await discovery.scrape_country_competitions(country_id, name)
    for comp in comps:
        await repository.upsert_competition(session, {
            "id": comp["id"],
            "name": comp["name"],
            "type": comp["type"],
            "kind_of_teams": models.TeamKind.club,
            "country_id": country_id,
            "tier": comp.get("tier"),
        })
    await session.commit()
    rows = (await session.execute(
        select(models.Competition)
        .where(models.Competition.country_id == country_id)
        .order_by(models.Competition.name)
    )).scalars().all()
    return rows


@router.get(
    "/competitions/{competition_id}/seasons",
    response_model=list[schemas.SeasonOut],
)
async def competition_seasons(
    competition_id: str,
    refresh: bool = False,
    session: AsyncSession = Depends(get_session),
):
    comp = await session.get(models.Competition, competition_id)
    if comp is None:
        raise HTTPException(404, "unknown competition")
    if comp.seasons and not refresh:
        return comp.seasons
    segment = (
        "pokalwettbewerb"
        if comp.type in (models.CompetitionType.cup, models.CompetitionType.international)
        else "wettbewerb"
    )
    seasons = await tm.scrape_competition_seasons(
        competition_id, pu.slugify(comp.name), segment
    )
    if seasons:
        comp.seasons = seasons
        await session.commit()
    return seasons


@router.get(
    "/competitions/{competition_id}/teams",
    response_model=list[schemas.TeamOut],
)
async def competition_teams(
    competition_id: str, session: AsyncSession = Depends(get_session)
):
    comp = await session.get(models.Competition, competition_id)
    country_id = comp.country_id if comp else None
    ids: list[int] = []
    for t in await quickselect.teams(competition_id):
        tid = int(t["id"])
        ids.append(tid)
        await repository.upsert_team(session, {
            "team_id": tid,
            "name": t.get("name"),
            "slug": pu.slug_from_href(t.get("link")),
            "kind": models.TeamKind.club,
            "country_id": country_id,
            "url": t.get("link"),
        })
    await session.commit()
    if not ids:
        return []
    rows = (await session.execute(
        select(models.Team).where(models.Team.id.in_(ids))
        .order_by(models.Team.name)
    )).scalars().all()
    return rows
