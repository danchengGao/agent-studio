from __future__ import annotations

from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        raise RuntimeError("Scheduler not initialized. Call init_scheduler() first.")
    return _scheduler


def init_scheduler(database_url: str) -> AsyncIOScheduler:
    """
    Create and configure the global AsyncIOScheduler.
    Uses the existing SQLAlchemy database — no new infrastructure required.
    APScheduler will auto-create an 'apscheduler_jobs' table on first start.
    """
    global _scheduler

    # SQLite requires check_same_thread=False because APScheduler accesses the
    # job store from its internal thread pool on every job fire. Without this,
    # SQLite raises "objects created in a thread can only be used in that same thread"
    # which silently kills the job before it runs.
    is_sqlite = "sqlite" in database_url.lower()
    engine_options = {"connect_args": {"check_same_thread": False}} if is_sqlite else {}

    jobstores = {
        "default": SQLAlchemyJobStore(url=database_url, engine_options=engine_options)
    }
    _scheduler = AsyncIOScheduler(
        jobstores=jobstores,
        job_defaults={
            "coalesce": True,             # If multiple fires were missed, fire only once
            "max_instances": 1,           # Never run two instances of the same job concurrently
            "misfire_grace_time": 86400,  # Accept a job up to 60 seconds late
        },
        timezone="UTC",
    )
    return _scheduler
