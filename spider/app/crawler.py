"""Crawl task queue + worker task execution.

Replaces the old scrape_jobs/jobrunner. Tasks live in the ``crawl_tasks`` table
(deduped by ``(kind, target_id, season_id)``); the worker claims and runs them
one at a time. Tree *expansion* (lightweight enumeration) is synchronous and
lives in the routers — only the heavy *ingest* work goes through here.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app import models, repository
from app.db import SessionLocal
from app.models import (
    NO_SEASON,
    CompetitionType,
    CrawlKind,
    CrawlStatus,
    TeamKind,
)
from app.scraper import discovery
from app.scraper import transfermarkt as tm
from app.scraper.client import current_task_id

log = logging.getLogger("crawler")


def recent_seasons(n: int = 5) -> list[int]:
    """The last ``n`` Transfermarkt saison_id years (current season first)."""
    today = date.today()
    cur = today.year if today.month >= 7 else today.year - 1
    return list(range(cur, cur - n, -1))


def _segment(comp: models.Competition | None) -> str:
    if comp and comp.type in (CompetitionType.cup, CompetitionType.international):
        return "pokalwettbewerb"
    return "wettbewerb"


def _team_kind(comp: models.Competition | None) -> TeamKind:
    if comp is None:
        return TeamKind.club
    if comp.kind_of_teams is not None:
        return comp.kind_of_teams
    return (
        TeamKind.national
        if comp.type == CompetitionType.international
        else TeamKind.club
    )


def _to_float(v) -> float | None:
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _to_int(v) -> int | None:
    try:
        return int("".join(ch for ch in str(v) if ch.isdigit()))
    except (TypeError, ValueError):
        return None


# ── Queue ────────────────────────────────────────────────────────────────────
_REOPENABLE_STATUSES = (
    CrawlStatus.done,
    CrawlStatus.failed,
    CrawlStatus.cancelled,
)


async def enqueue(
    session, kind: CrawlKind, target_id: str, season_id: int = NO_SEASON,
    priority: int = 100,
) -> None:
    """Insert a task, or re-open an existing one that already finished.

    Tasks are deduped by ``(kind, target_id, season_id)``. A task still
    ``pending``/``running`` is left untouched so we never duplicate in-flight
    work. But one that already reached a terminal state (``done``/``failed``/
    ``cancelled``) is reset back to ``pending`` so the worker crawls it again —
    otherwise a competition/season is only ever crawled once and its data
    freezes forever.
    """
    stmt = insert(models.CrawlTask).values(
        kind=kind, target_id=str(target_id), season_id=season_id,
        priority=priority, status=CrawlStatus.pending,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_crawl_task",
        set_={
            "status": CrawlStatus.pending,
            "priority": stmt.excluded.priority,
            "started_at": None,
            "finished_at": None,
            "last_error": None,
        },
        where=models.CrawlTask.status.in_(_REOPENABLE_STATUSES),
    )
    await session.execute(stmt)


async def claim_next_pending():
    """Atomically claim the highest-priority pending task; mark it running."""
    async with SessionLocal() as s:
        stmt = (
            select(models.CrawlTask)
            .where(models.CrawlTask.status == CrawlStatus.pending)
            .order_by(models.CrawlTask.priority, models.CrawlTask.created_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        task = (await s.execute(stmt)).scalar_one_or_none()
        if task is None:
            return None
        task.status = CrawlStatus.running
        task.started_at = datetime.utcnow()
        task.attempts += 1
        task.last_error = None
        await s.commit()
        return task.id


async def _finish(task_id, status: CrawlStatus, message=None, error=None) -> None:
    async with SessionLocal() as s:
        task = await s.get(models.CrawlTask, task_id)
        if task is None:
            return
        task.status = status
        task.finished_at = datetime.utcnow()
        if message is not None:
            task.message = message
        if error is not None:
            task.last_error = error
        await s.commit()


# ── Dispatch ─────────────────────────────────────────────────────────────────
async def run_task(task_id) -> None:
    token = current_task_id.set(task_id)
    try:
        async with SessionLocal() as s:
            task = await s.get(models.CrawlTask, task_id)
            if task is None:
                return
            kind, target, season = task.kind, task.target_id, task.season_id
        handler = _HANDLERS.get(kind)
        if handler is None:
            await _finish(task_id, CrawlStatus.failed, error=f"no handler for {kind}")
            return
        msg = await handler(target, season)
        await _finish(task_id, CrawlStatus.done, message=msg)
        log.info("task %s (%s %s/%s) done: %s", task_id, kind, target, season, msg)
    except Exception as exc:  # noqa: BLE001
        log.exception("task %s failed", task_id)
        await _finish(task_id, CrawlStatus.failed, error=f"{type(exc).__name__}: {exc}")
    finally:
        current_task_id.reset(token)


# ── Handlers ─────────────────────────────────────────────────────────────────
async def _do_competition_clubs(comp_id: str, season: int) -> str:
    """Competition-dimension: who took part this season -> participation rows,
    then fan out a squad crawl per participating team."""
    async with SessionLocal() as s:
        comp = await s.get(models.Competition, comp_id)
    seg = _segment(comp)
    kind = _team_kind(comp)
    country_id = comp.country_id if comp else None

    teams: list[dict] = []
    if seg == "wettbewerb":
        data = await tm.scrape_competition_clubs(comp_id, season, "x", seg)
        teams = data["clubs"]
    else:
        # Cups have no squad table -> derive participants from the fixtures.
        fx = await tm.scrape_fixtures(comp_id, season, "x", seg)
        seen: dict[int, dict] = {}
        for f in fx["fixtures"]:
            for tid, nm in (
                (f.get("home_team_id"), f.get("home_name")),
                (f.get("away_team_id"), f.get("away_name")),
            ):
                if tid and tid not in seen:
                    seen[tid] = {"club_id": tid, "name": nm or str(tid)}
        teams = list(seen.values())

    async with SessionLocal() as s:
        for t in teams:
            tid = t["club_id"]
            extra = t.get("extra") or {}
            await repository.upsert_team(s, {
                "team_id": tid, "name": t.get("name"), "slug": t.get("slug"),
                "kind": kind, "country_id": country_id,
            })
            await repository.upsert_team_competition_season(
                s, team_id=tid, competition_id=comp_id, season_id=season,
                squad_size=t.get("squad_size"),
                avg_age=_to_float(extra.get("avg_age")),
                foreigners=_to_int(extra.get("foreigners")),
                market_value=t.get("market_value"),
            )
            await enqueue(s, CrawlKind.team_squad, tid, season, priority=150)
        await s.commit()
    return f"{len(teams)} 支参赛队"


async def _do_competition_fixtures(comp_id: str, season: int) -> str:
    """Competition-dimension: the whole-season match list in one shot."""
    async with SessionLocal() as s:
        comp = await s.get(models.Competition, comp_id)
        country_id = comp.country_id if comp else None
    data = await tm.scrape_fixtures(comp_id, season, "x", _segment(comp))
    fixtures = data["fixtures"]
    async with SessionLocal() as s:
        seen: set[int] = set()
        for f in fixtures:
            for tid, nm in (
                (f.get("home_team_id"), f.get("home_name")),
                (f.get("away_team_id"), f.get("away_name")),
            ):
                if tid and tid not in seen:
                    seen.add(tid)
                    await repository.upsert_team(s, {
                        "team_id": tid, "name": nm or str(tid),
                        "kind": _team_kind(comp), "country_id": country_id,
                    })
        await repository.delete_fixtures(s, comp_id, season)
        for f in fixtures:
            await repository.upsert_fixture(
                s, competition_id=comp_id, season_id=season, fx=f
            )
        await s.commit()
    return f"{len(fixtures)} 场比赛"


async def _do_competition_standings(comp_id: str, season: int) -> str:
    async with SessionLocal() as s:
        comp = await s.get(models.Competition, comp_id)
        country_id = comp.country_id if comp else None
    data = await tm.scrape_standings(comp_id, season, "x", _segment(comp))
    rows = data["standings"]
    async with SessionLocal() as s:
        await repository.delete_standings(s, comp_id, season)
        for row in rows:
            await repository.upsert_team(s, {
                "team_id": row["team_id"], "name": row["name"],
                "kind": TeamKind.club, "country_id": country_id,
            })
            await repository.upsert_standing(
                s, competition_id=comp_id, season_id=season, row=row
            )
        await s.commit()
    return f"{len(rows)} 行积分榜"


async def _do_team_fixtures(team_id: str, season: int) -> str:
    tid = int(team_id)
    data = await tm.scrape_team_fixtures(tid, season)
    fixtures = data["fixtures"]
    async with SessionLocal() as s:
        # Discovered competitions (reverse-engineered from the schedule).
        for comp in data["competitions"]:
            await repository.upsert_competition_shallow(s, comp["id"], comp["name"])
        # Opponent teams seen in the schedule.
        seen: set[int] = set()
        for fx in fixtures:
            for tid2, nm in (
                (fx.get("home_team_id"), fx.get("home_name")),
                (fx.get("away_team_id"), fx.get("away_name")),
            ):
                if tid2 and tid2 != tid and tid2 not in seen:
                    seen.add(tid2)
                    await repository.upsert_team(s, {
                        "team_id": tid2, "name": nm or str(tid2),
                        "kind": TeamKind.club,
                    })
        for fx in fixtures:
            await repository.upsert_fixture(
                s, competition_id=fx["competition_id"], season_id=season, fx=fx
            )
        await s.commit()
    return f"{len(fixtures)} 场比赛 / 发现 {len(data['competitions'])} 赛事"


async def _do_team_squad(team_id: str, season: int) -> str:
    tid = int(team_id)
    data = await tm.scrape_club_squad(tid, season)
    players = data["players"]
    async with SessionLocal() as s:
        for p in players:
            await repository.upsert_player(s, p)
            await repository.upsert_player_team_season(
                s, player_id=p["player_id"], team_id=tid, season_id=season,
                shirt_number=p.get("shirt_number"),
                market_value=p.get("market_value"),
            )
        await s.commit()
        # Queue profile crawls for players without one yet.
        ids = [p["player_id"] for p in players]
        existing = set()
        if ids:
            rows = (await s.execute(
                select(models.Player.id).where(
                    models.Player.id.in_(ids),
                    models.Player.profile_crawled_at.is_not(None),
                )
            )).scalars().all()
            existing = set(rows)
        for pid in ids:
            if pid not in existing:
                await enqueue(s, CrawlKind.player_profile, pid, priority=200)
        await s.commit()
    return f"{len(players)} 名球员"


async def _do_player_profile(player_id: str, season: int) -> str:
    profile = await tm.scrape_player_profile(int(player_id))
    async with SessionLocal() as s:
        await repository.update_player_profile(s, profile)
        await s.commit()
    return profile.get("name") or player_id


async def _do_fallback_discovery(target: str, season: int) -> str:
    found = 0
    for src in discovery.INTERNATIONAL_SOURCES:
        comps = await discovery.scrape_international(src)
        async with SessionLocal() as s:
            for comp in comps:
                await repository.upsert_competition(s, comp)
            await s.commit()
        found += len(comps)
    return f"补齐 {found} 国际/洲际赛事"


_HANDLERS = {
    CrawlKind.competition_clubs: _do_competition_clubs,
    CrawlKind.competition_fixtures: _do_competition_fixtures,
    CrawlKind.competition_standings: _do_competition_standings,
    CrawlKind.team_fixtures: _do_team_fixtures,
    CrawlKind.team_squad: _do_team_squad,
    CrawlKind.player_profile: _do_player_profile,
    CrawlKind.fallback_discovery: _do_fallback_discovery,
}
