"""
Watch Mode — background scheduler that monitors active cases and triggers WhatsApp hearing alerts.
Uses APScheduler to run periodic reminders for watched cases.
"""
import os
import uuid
import logging
from datetime import datetime
from typing import Dict

logger = logging.getLogger("litigaforge.watch")


class WatchModeManager:
    def __init__(self, memory, alert_fn):
        self.memory = memory
        self.alert_fn = alert_fn
        self._scheduler = None
        self._running = False

    def start(self):
        if self._running:
            return {"status": "already_running"}
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            interval = int(os.getenv("WATCH_INTERVAL_MINUTES", "60"))

            # Use PostgreSQL job store for persistence across restarts
            job_store_kwargs: dict = {}
            db_url = os.getenv("DATABASE_URL", "")
            if db_url:
                try:
                    from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
                    # asyncpg DSN → psycopg2 DSN for SQLAlchemy sync driver
                    pg_url = db_url.replace("postgresql+asyncpg://", "postgresql://") \
                                   .replace("postgres://", "postgresql://")
                    job_store_kwargs = {
                        "jobstores": {"default": SQLAlchemyJobStore(url=pg_url)},
                    }
                    logger.info("APScheduler using PostgreSQL job store")
                except Exception as jse:
                    logger.warning("PostgreSQL job store unavailable (%s) — using in-memory", jse)

            self._scheduler = BackgroundScheduler(**job_store_kwargs)
            # replace_existing=True lets us survive restart without duplicate job
            self._scheduler.add_job(
                self._check_all_watches,
                trigger="interval",
                minutes=interval,
                id="watch_mode_main",
                replace_existing=True,
            )
            self._scheduler.start()
            self._running = True
            return {"status": "started", "interval_minutes": interval}
        except ImportError:
            return {"status": "error", "detail": "apscheduler not installed — run: pip install apscheduler"}
        except Exception as e:
            return {"status": "error", "detail": str(e)}

    def stop(self):
        if self._scheduler and self._running:
            self._scheduler.shutdown(wait=False)
            self._running = False
            return {"status": "stopped"}
        return {"status": "not_running"}

    def add_watch(self, party_name: str = None, case_number: str = None, phone: str = None, notes: str = "") -> dict:
        if not party_name and not case_number:
            return {"success": False, "error": "Provide party_name or case_number"}
        watch_id = str(uuid.uuid4())[:8]
        self.memory.add_to_watch_list({
            "id": watch_id,
            "party_name": party_name,
            "case_number": case_number,
            "alert_phone": phone,
            "notes": notes,
            "last_checked": None,
            "last_status": None,
        })
        return {"success": True, "watch_id": watch_id, "watching": party_name or case_number}

    def remove_watch(self, watch_id: str) -> dict:
        self.memory.deactivate_watch(watch_id)
        return {"success": True, "watch_id": watch_id, "message": "Watch deactivated"}

    def list_watches(self) -> list:
        return self.memory.get_watch_list(active_only=True)

    def _check_all_watches(self):
        watches = self.memory.get_watch_list(active_only=True)
        logger.info(f"Watch cycle: checking {len(watches)} item(s)")
        for watch in watches:
            try:
                self._fire_alert(watch)
                watch["last_checked"] = datetime.utcnow().isoformat()
            except Exception as e:
                logger.error(f"Watch alert failed for {watch.get('id')}: {e}")

    def _fire_alert(self, watch: Dict):
        from alerts.whatsapp import send_watch_trigger
        send_watch_trigger(
            watch_id=watch["id"],
            trigger_reason="Scheduled hearing reminder",
            details=f"Case: {watch.get('case_number') or watch.get('party_name', 'N/A')} — Please check the court website for the latest hearing date.",
            to=watch.get("alert_phone"),
        )

    @property
    def is_running(self) -> bool:
        return self._running
