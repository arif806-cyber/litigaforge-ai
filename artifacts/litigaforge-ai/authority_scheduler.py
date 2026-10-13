"""Nightly, production-only refresh of user-owned authority monitors."""
import asyncio
import logging
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from database import get_pool
from routers.authorities import _check_monitor

logger = logging.getLogger("litigaforge.authority_scheduler")
IST = ZoneInfo("Asia/Kolkata")


async def run_authority_monitoring() -> dict:
    """Refresh each saved query once per IST day; IK requests use the shared rupee cap."""
    pool = await get_pool()
    cutoff = datetime.combine(datetime.now(IST).date(), time.min, tzinfo=IST).astimezone(timezone.utc)
    checked = 0
    new_alerts = 0
    skipped = 0
    async with pool.acquire() as conn:
        monitors = await conn.fetch(
            """SELECT 'saved_search' AS kind, id, user_id, query AS search_text
                 FROM saved_authority_searches
                WHERE last_checked_at IS NULL OR last_checked_at < $1
               UNION ALL
               SELECT 'citation_watch' AS kind, id, user_id, citation AS search_text
                 FROM citation_watches
                WHERE last_checked_at IS NULL OR last_checked_at < $1
               ORDER BY user_id, kind, id""",
            cutoff,
        )
        for monitor in monitors:
            try:
                result = await _check_monitor(
                    conn, int(monitor["user_id"]), monitor["kind"],
                    int(monitor["id"]), monitor["search_text"],
                )
                checked += 1
                new_alerts += int(result["new_count"])
            except Exception as exc:
                skipped += 1
                logger.warning(
                    "authority monitor failed kind=%s id=%s error=%s",
                    monitor["kind"], monitor["id"], type(exc).__name__,
                )
    summary = {"checked": checked, "new_alerts": new_alerts, "skipped": skipped}
    logger.info("authority monitor nightly refresh: %s", summary)
    return summary


async def _scheduler_loop() -> None:
    while True:
        now = datetime.now(IST)
        next_run = datetime.combine(now.date(), time(hour=2, minute=15), tzinfo=IST)
        if next_run <= now:
            next_run += timedelta(days=1)
        await asyncio.sleep((next_run - now).total_seconds())
        try:
            await run_authority_monitoring()
            from monitoring import heartbeat
            await heartbeat("HC_PING_AUTHORITY")
        except asyncio.CancelledError:
            raise
        except Exception:
            from monitoring import heartbeat
            await heartbeat("HC_PING_AUTHORITY", failed=True)
            logger.exception("authority monitor nightly refresh crashed")


def start_scheduler():
    from judgment_ingest import _is_prod
    if not _is_prod():
        logger.info("authority monitor: non-production environment — nightly scheduler disabled")
        return None
    logger.info("authority monitor: nightly refresh scheduled for 02:15 IST")
    return asyncio.create_task(_scheduler_loop())
