"""Run one scheduled operation on demand without enabling the scheduler."""
import argparse
import asyncio
import json


async def run(job: str):
    if job == "judgment-ingest":
        from judgment_ingest import run_ingestion
        return await run_ingestion()
    if job == "digest":
        from digest import send_daily_digest
        return await send_daily_digest(trigger="cli")
    if job == "authority-monitor":
        from authority_scheduler import run_authority_monitoring
        return await run_authority_monitoring()
    if job == "health-check":
        from health_check import init_health_check_table
        from health_check import run_health_check
        await init_health_check_table()
        return await run_health_check()
    if job == "court-refresh":
        from workers.case_refresh_worker import run_refresh
        return await run_refresh()
    if job == "notification-retry":
        from workers.case_refresh_worker import run_notification_retry
        return await run_notification_retry()
    if job == "daily-reconciliation":
        from maintenance import run_daily_reconciliation
        return await run_daily_reconciliation()
    if job == "daily-sweep":
        from maintenance import run_daily_reconciliation
        from routers.subscription import expire_subscriptions
        expired = await expire_subscriptions()
        reconciled = await run_daily_reconciliation()
        return {"expired_subscriptions": expired, "reconciled": reconciled}
    if job == "subscription-expiry":
        from routers.subscription import expire_subscriptions
        return await expire_subscriptions()
    if job == "docket-refresh":
        from services.court_data_client import is_configured
        if not is_configured():
            return {"status": "skipped", "reason": "court data source is not configured"}
        from routers.docket import refresh_docket_schedules
        return await refresh_docket_schedules()
    if job == "forgeos-due":
        from forgeos.config import FORGEOS_ENABLED
        if not FORGEOS_ENABLED:
            return {"status": "skipped", "reason": "ForgeOS is disabled"}
        from forgeos.scheduler import _run_due_schedules
        await _run_due_schedules()
        return {"status": "completed"}
    raise ValueError(job)


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job", choices=[
        "judgment-ingest", "digest", "authority-monitor", "health-check",
        "court-refresh", "notification-retry", "daily-reconciliation",
        "daily-sweep", "subscription-expiry", "docket-refresh", "forgeos-due",
    ])
    args = parser.parse_args()
    try:
        result = await run(args.job)
        print(json.dumps(result, default=str, ensure_ascii=False))
    finally:
        from database import close_pool
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
