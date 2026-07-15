"""Crawl-task management: enqueue selected work and inspect the queue."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import crawler, models, schemas
from app.db import get_session
from app.models import NO_SEASON, CrawlKind, CrawlStatus

router = APIRouter(prefix="/api/crawl", tags=["crawl"])

# Tasks that operate on a single season.
_SEASON_KINDS = {
    CrawlKind.competition_clubs,
    CrawlKind.competition_fixtures,
    CrawlKind.competition_standings,
    CrawlKind.team_fixtures,
    CrawlKind.team_squad,
}


@router.post("", response_model=schemas.CrawlEnqueueOut)
async def enqueue(
    payload: schemas.CrawlEnqueueIn, session: AsyncSession = Depends(get_session)
):
    """Queue a crawl task. Season-scoped kinds fan out over the given seasons
    (defaulting to the last 5).

    The returned task ids can be polled via ``GET /api/crawl/tasks/{id}``, which
    is how a caller waits for fresh data rather than reading whatever the
    previous run happened to leave behind.
    """
    task_ids = []
    if payload.kind in _SEASON_KINDS:
        seasons = payload.seasons or crawler.recent_seasons()
        for s in seasons:
            task_ids.append(
                await crawler.enqueue(
                    session, payload.kind, payload.target_id, s, payload.priority
                )
            )
    else:
        task_ids.append(
            await crawler.enqueue(
                session, payload.kind, payload.target_id, NO_SEASON, payload.priority
            )
        )
    await session.commit()
    return {"enqueued": len(task_ids), "task_ids": task_ids}


@router.post("/fallback", response_model=dict)
async def enqueue_fallback(session: AsyncSession = Depends(get_session)):
    """Backstop discovery: fifa + continental cup boxes (no participant needed)."""
    await crawler.enqueue(session, CrawlKind.fallback_discovery, "all", NO_SEASON, 50)
    await session.commit()
    return {"enqueued": 1}


@router.get("/tasks", response_model=list[schemas.CrawlTaskOut])
async def list_tasks(
    session: AsyncSession = Depends(get_session),
    status: CrawlStatus | None = None,
    limit: int = Query(100, le=500),
):
    stmt = select(models.CrawlTask)
    if status:
        stmt = stmt.where(models.CrawlTask.status == status)
    stmt = stmt.order_by(models.CrawlTask.created_at.desc()).limit(limit)
    return (await session.execute(stmt)).scalars().all()


@router.get("/tasks/{task_id}", response_model=schemas.CrawlTaskOut)
async def get_task(task_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    task = await session.get(models.CrawlTask, task_id)
    if task is None:
        raise HTTPException(404, "task not found")
    return task


@router.post("/tasks/{task_id}/cancel", response_model=schemas.CrawlTaskOut)
async def cancel_task(
    task_id: uuid.UUID, session: AsyncSession = Depends(get_session)
):
    task = await session.get(models.CrawlTask, task_id)
    if task is None:
        raise HTTPException(404, "task not found")
    if task.status == CrawlStatus.pending:
        task.status = CrawlStatus.cancelled
        await session.commit()
        await session.refresh(task)
    return task
