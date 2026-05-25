from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.models.trigger import TriggerDB

# POSIX cron day-of-week: 0=Sun, 1=Mon … 6=Sat (7=Sun alias)
# APScheduler from_crontab() does NOT convert numeric values — it treats
# them with its own 0=Mon convention, causing an off-by-one for all days.
# Replacing numbers with 3-letter names makes from_crontab() unambiguous.
_POSIX_DOW_NAMES = {
    "0": "sun", "7": "sun",
    "1": "mon", "2": "tue", "3": "wed",
    "4": "thu", "5": "fri", "6": "sat",
}


def _normalize_dow_token(token: str) -> str:
    """Replace a single dow token (number, range, step) with name equivalents."""
    if "/" in token:
        base, step = token.split("/", 1)
        return f"{_normalize_dow_token(base)}/{step}"
    if "-" in token:
        start, end = token.split("-", 1)
        return f"{_POSIX_DOW_NAMES.get(start, start)}-{_POSIX_DOW_NAMES.get(end, end)}"
    return _POSIX_DOW_NAMES.get(token, token)


def _normalize_posix_cron(cron_expr: str) -> str:
    """
    Convert the day-of-week field of a POSIX cron expression from numeric
    values to 3-letter abbreviations so that APScheduler's from_crontab()
    interprets them correctly (APScheduler numeric 0=Mon ≠ POSIX numeric 0=Sun).
    """
    parts = cron_expr.strip().split()
    if len(parts) != 5:
        return cron_expr
    minute, hour, dom, month, dow = parts
    if dow == "*":
        return cron_expr
    normalized_dow = ",".join(_normalize_dow_token(t) for t in dow.split(","))
    return f"{minute} {hour} {dom} {month} {normalized_dow}"


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
        # Normalize POSIX numeric day-of-week to names before passing to
        # APScheduler; from_crontab() does not convert POSIX 0=Sun numbering
        # to its own 0=Mon convention, which causes an off-by-one for weekly.
        cron_expr_normalized = _normalize_posix_cron(cron_expr)
        ap_trigger = CronTrigger.from_crontab(cron_expr_normalized, timezone="UTC")
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
