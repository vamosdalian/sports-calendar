"""Upsert helpers that persist scraped dicts into Postgres."""

from __future__ import annotations

from datetime import datetime, time

from sqlalchemy import delete, func, literal, select
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
async def count_fixtures(
    session: AsyncSession, competition_id: str, season_id: int
) -> int:
    return await session.scalar(
        select(func.count())
        .select_from(models.Fixture)
        .where(
            models.Fixture.competition_id == competition_id,
            models.Fixture.season_id == season_id,
        )
    ) or 0


async def delete_fixtures(
    session: AsyncSession, competition_id: str, season_id: int
) -> None:
    await session.execute(
        delete(models.Fixture).where(
            models.Fixture.competition_id == competition_id,
            models.Fixture.season_id == season_id,
        )
    )


def resolve_kickoff(fx: dict) -> tuple[datetime | None, bool]:
    """Return the fixture's kickoff and whether its time is still pending.

    Transfermarkt publishes a match date long before the broadcaster picks a
    kickoff time, printing only the date until then. We still store a datetime
    (at local midnight) so the fixture can be ordered and put on a calendar,
    but midnight is then indistinguishable from a real kickoff — hence the
    flag, so consumers don't announce a time the source never gave.
    """
    if not fx.get("date"):
        return None, False
    published = fx.get("time")
    return datetime.combine(fx["date"], published or time(0, 0)), published is None


async def upsert_fixture(
    session: AsyncSession, *, competition_id: str, season_id: int, fx: dict,
) -> None:
    kickoff, kickoff_time_tbd = resolve_kickoff(fx)
    values = dict(
        match_id=fx.get("match_id"),
        competition_id=competition_id,
        season_id=season_id,
        matchday=fx.get("matchday"),
        kickoff=kickoff,
        kickoff_time_tbd=kickoff_time_tbd,
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


# ── Venues ───────────────────────────────────────────────────────────────────
async def upsert_venue(session: AsyncSession, venue: dict) -> None:
    values = {
        "id": venue["venue_id"],
        "name": venue.get("name") or str(venue["venue_id"]),
        "city": venue.get("city"),
        "country_id": venue.get("country_id"),
        "capacity": venue.get("capacity"),
        "url": venue.get("url"),
    }
    stmt = insert(models.Venue).values(**values)
    # A match report only carries the name, so never let it null out the city
    # and capacity a stadium overview page already established.
    set_ = {
        "name": stmt.excluded.name,
        "city": func.coalesce(stmt.excluded.city, models.Venue.city),
        "country_id": func.coalesce(stmt.excluded.country_id, models.Venue.country_id),
        "capacity": func.coalesce(stmt.excluded.capacity, models.Venue.capacity),
        "url": func.coalesce(stmt.excluded.url, models.Venue.url),
        "updated_at": datetime.utcnow(),
    }
    await session.execute(stmt.on_conflict_do_update(index_elements=["id"], set_=set_))


async def upsert_match_venue(
    session: AsyncSession, *, match_id: int, venue_id: int | None, source: str
) -> None:
    """Record where a match is played, refusing to downgrade the source.

    A club_home guess must never overwrite what the match report itself said:
    a competition-wide recrawl would otherwise walk a Champions League final
    back from its neutral ground to the home side's stadium every time.
    """
    values = {
        "match_id": match_id,
        "venue_id": venue_id,
        "source": source,
        "crawled_at": datetime.utcnow(),
    }
    stmt = insert(models.MatchVenue).values(**values)
    set_ = {
        "venue_id": stmt.excluded.venue_id,
        "source": stmt.excluded.source,
        "crawled_at": stmt.excluded.crawled_at,
        "updated_at": datetime.utcnow(),
    }
    condition = None
    if source == models.VENUE_SOURCE_CLUB_HOME:
        condition = models.MatchVenue.source != models.VENUE_SOURCE_MATCH_PAGE
    await session.execute(
        stmt.on_conflict_do_update(
            index_elements=["match_id"], set_=set_, where=condition
        )
    )


async def assign_home_venues(
    session: AsyncSession, *, competition_id: str, season_id: int
) -> int:
    """Point every fixture of a season at its home team's ground.

    One statement rather than a round trip per fixture: this runs on every
    stadium crawl for every competition. Fixtures whose home club has no known
    ground are skipped by the join, and matches already confirmed by a match
    report are protected by the WHERE on the conflict clause.
    """
    source = select(
        models.Fixture.match_id,
        models.Fixture.home_team_id,
        literal(models.VENUE_SOURCE_CLUB_HOME),
        func.now(),
    ).join(
        models.Venue, models.Venue.id == models.Fixture.home_team_id
    ).where(
        models.Fixture.competition_id == competition_id,
        models.Fixture.season_id == season_id,
        models.Fixture.match_id.is_not(None),
    )
    stmt = insert(models.MatchVenue).from_select(
        ["match_id", "venue_id", "source", "crawled_at"], source
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["match_id"],
        set_={
            "venue_id": stmt.excluded.venue_id,
            "source": stmt.excluded.source,
            "crawled_at": stmt.excluded.crawled_at,
            "updated_at": datetime.utcnow(),
        },
        where=models.MatchVenue.source != models.VENUE_SOURCE_MATCH_PAGE,
    )
    return (await session.execute(stmt)).rowcount or 0


async def match_ids_missing_venue(
    session: AsyncSession,
    *,
    competition_id: str,
    season_id: int,
    source: str | None = None,
    limit: int = 500,
) -> list[int]:
    """Matches of a season whose venue is absent, or only a club_home guess.

    Drives per-match crawling: pass source=None for "no venue at all", or
    VENUE_SOURCE_MATCH_PAGE for "not yet confirmed by a match report".
    """
    joined = select(models.Fixture.match_id).outerjoin(
        models.MatchVenue, models.MatchVenue.match_id == models.Fixture.match_id
    ).where(
        models.Fixture.competition_id == competition_id,
        models.Fixture.season_id == season_id,
        models.Fixture.match_id.is_not(None),
    )
    if source is None:
        joined = joined.where(models.MatchVenue.match_id.is_(None))
    else:
        joined = joined.where(
            (models.MatchVenue.match_id.is_(None))
            | (models.MatchVenue.source != source)
        )
    joined = joined.order_by(models.Fixture.kickoff.nulls_last()).limit(limit)
    return [row for row in (await session.execute(joined)).scalars().all() if row]


async def home_venue_map(session: AsyncSession) -> dict[int, int]:
    """club id -> venue id. Identity today (a venue *is* keyed by its club),
    but kept as a lookup so only grounds we have actually seen are assigned."""
    rows = (await session.execute(select(models.Venue.id))).scalars().all()
    return {vid: vid for vid in rows}


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
