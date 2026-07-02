"""
ForgeOS Scheduler — polls forgeos_schedules for due recurring mission
triggers. Hand-rolled asyncio loop (matching the pattern used by
digest.py / judgment_ingest.py / main.py's nightly refresh loops), NOT
APScheduler — kept consistent with existing precedent in this codebase.

Only started when FORGEOS_ENABLED is true (see main.py lifespan).
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from database import execute, fetch
from logger import get_logger
from forgeos.config import FORGEOS_SCHEDULER_POLL_SECONDS

logger = get_logger("litigaforge.forgeos")


async def _run_due_schedules() -> None:
    rows = await fetch(
        """SELECT id, name, mission_template, interval_seconds
           FROM forgeos_schedules
           WHERE enabled = TRUE AND next_run_at <= NOW()"""
    )
    for row in rows:
        try:
            template = row["mission_template"] or {}
            if isinstance(template, str):
                template = json.loads(template)

            from forgeos.missions import create_mission
            await create_mission(
                title=template.get("title", row["name"]),
                description=template.get("description", ""),
                agent_id=template.get("agent_id"),
                agent_name=template.get("agent_name"),
                input_data=template.get("input", {}),
                requires_approval=bool(template.get("requires_approval", False)),
            )
            await execute(
                """UPDATE forgeos_schedules
                   SET last_run_at = NOW(), next_run_at = NOW() + ($1 || ' seconds')::interval
                   WHERE id = $2""",
                str(row["interval_seconds"]), row["id"],
            )
            logger.info("forgeos: schedule '%s' fired a new mission", row["name"])
        except Exception as e:
            logger.error("forgeos: schedule '%s' failed: %s", row["name"], e, exc_info=True)
            # Push next_run_at forward anyway so a broken schedule doesn't fire in a tight loop.
            await execute(
                """UPDATE forgeos_schedules
                   SET next_run_at = NOW() + ($1 || ' seconds')::interval
                   WHERE id = $2""",
                str(row["interval_seconds"]), row["id"],
            )


async def _scheduler_loop() -> None:
    while True:
        try:
            await asyncio.sleep(FORGEOS_SCHEDULER_POLL_SECONDS)
        except asyncio.CancelledError:
            logger.info("forgeos: scheduler cancelled")
            raise
        try:
            await _run_due_schedules()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("forgeos: scheduler poll failed: %s", e, exc_info=True)


def start_scheduler() -> Optional["asyncio.Task"]:
    """Start the ForgeOS schedule poller. Only ever called when
    FORGEOS_ENABLED is true. Returns the task handle so the caller can
    cancel it on shutdown."""
    logger.info("forgeos: scheduler enabled — polling every %ss", FORGEOS_SCHEDULER_POLL_SECONDS)
    return asyncio.create_task(_scheduler_loop())
