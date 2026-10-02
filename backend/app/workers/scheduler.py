"""APScheduler wrapper — optional background jobs at 60s intervals."""
from __future__ import annotations
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.workers.jobs import rerun_rebuild, snapshot_metrics


_scheduler: Optional[AsyncIOScheduler] = None


def start_scheduler() -> Optional[AsyncIOScheduler]:
    """Start the background scheduler. Enabled via SCHEDULER_ENABLED=1."""
    global _scheduler
    if not settings.SCHEDULER_ENABLED:
        return None
    if _scheduler and _scheduler.running:
        return _scheduler
    sched = AsyncIOScheduler()
    sched.add_job(rerun_rebuild, "interval", seconds=60, id="rerun_rebuild")
    sched.add_job(snapshot_metrics, "interval", seconds=60, id="snapshot_metrics")
    sched.start()
    _scheduler = sched
    return sched


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None