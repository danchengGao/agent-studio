from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.models.trigger import TriggerDB


def _job_id(trigger: TriggerDB) -> str:
    return f"trigger_{trigger.trigger_id}"


def register_trigger_job(scheduler: AsyncIOScheduler, trigger: TriggerDB) -> str:
    """
    Add or replace a scheduled job for a cron or polling trigger.
    Returns the APScheduler job ID (store in TriggerDB.scheduler_job_id).
    Do NOT call for webhook triggers — they have no scheduled job.
    """
    from openjiuwen_studio.core.scheduler.runner import execute_trigger_job

    job_id = _job_id(trigger)
    config = trigger.config or {}

    if trigger.trigger_type == "cron":
        cron_expr = config.get("cron_expr", "* * * * *")
        ap_trigger = CronTrigger.from_crontab(cron_expr, timezone="UTC")
    elif trigger.trigger_type == "polling":
        interval = int(config.get("poll_interval_seconds", 300))
        ap_trigger = IntervalTrigger(seconds=interval, timezone="UTC")
    else:
        raise ValueError(f"Non-schedulable trigger_type: {trigger.trigger_type!r}")

    job = scheduler.add_job(
        execute_trigger_job,
        trigger=ap_trigger,
        id=job_id,
        args=[trigger.trigger_id],
        kwargs={"fired_by": "scheduler"},
        replace_existing=True,
        name=f"{trigger.name} ({trigger.trigger_type})",
    )
    logger.info(
        f"[Scheduler] Job registered: id={job_id} name={trigger.name!r} "
        f"next_run_utc={job.next_run_time}"
    )
    return job_id


def remove_trigger_job(scheduler: AsyncIOScheduler, trigger: TriggerDB) -> None:
    """Remove the scheduled job. Safe to call even if no job exists."""
    try:
        scheduler.remove_job(_job_id(trigger))
    except Exception as e:
        logger.debug(f"Job removal failed (likely already removed): {e}")
