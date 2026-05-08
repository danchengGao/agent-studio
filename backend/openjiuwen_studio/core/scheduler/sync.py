"""
On startup: make DB the source of truth for the scheduler.
The SQLAlchemy job store persists jobs across restarts, but the DB may have
been modified while the server was down. This function rebuilds scheduler
state from DB to guarantee consistency.
"""
from __future__ import annotations

import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.core.database import SessionLocal
from openjiuwen_studio.core.scheduler.jobs import register_trigger_job
from openjiuwen_studio.models.trigger import TriggerDB


async def sync_triggers_to_scheduler(scheduler: AsyncIOScheduler) -> None:
    """Rebuild scheduler state from DB. Call before scheduler.start()."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _sync, scheduler)


def _sync(scheduler: AsyncIOScheduler) -> None:
    db = SessionLocal()
    try:
        # Remove all jobs first — DB is authoritative
        scheduler.remove_all_jobs()

        active = (
            db.query(TriggerDB)
            .filter(
                TriggerDB.is_active.is_(True),
                TriggerDB.trigger_type.in_(["cron", "polling"]),
            )
            .all()
        )

        for trigger in active:
            try:
                register_trigger_job(scheduler, trigger)
                logger.info(
                    f"[Scheduler] Loaded trigger={trigger.trigger_id} "
                    f"type={trigger.trigger_type} name={trigger.name!r}"
                )
            except Exception as e:
                logger.error(
                    f"[Scheduler] Failed to load trigger={trigger.trigger_id}: {e}"
                )

        logger.info(f"[Scheduler] Sync complete — {len(active)} triggers loaded")
    finally:
        db.close()
