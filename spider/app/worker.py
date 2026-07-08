"""In-process background worker.

Runs inside the FastAPI process as an asyncio task. It polls the ``crawl_tasks``
table for pending work and executes one task at a time. Every HTTP request goes
through the single global rate limiter, so serial execution keeps ordering and
progress reporting simple while staying under the configured QPS.
"""

from __future__ import annotations

import asyncio
import logging

from app.crawler import claim_next_pending, run_task

log = logging.getLogger("worker")

POLL_INTERVAL = 3.0  # seconds between checks when idle


class Worker:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    def start(self) -> None:
        if self._task is None:
            self._stop.clear()
            self._task = asyncio.create_task(self._loop(), name="crawl-worker")
            log.info("crawl worker started")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            await self._task
            self._task = None

    async def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                task_id = await claim_next_pending()
                if task_id is None:
                    await asyncio.wait_for(self._stop.wait(), timeout=POLL_INTERVAL)
                    continue
                log.info("running task %s", task_id)
                await run_task(task_id)
            except asyncio.TimeoutError:
                continue  # idle poll tick
            except Exception:  # noqa: BLE001
                log.exception("worker loop error")
                await asyncio.sleep(POLL_INTERVAL)


worker = Worker()
