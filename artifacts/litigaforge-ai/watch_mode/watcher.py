"""
Watch Mode — background scheduler that monitors active cases and triggers WhatsApp alerts.
Uses APScheduler to run periodic eCourts checks on watched cases.
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
            self._scheduler = BackgroundScheduler()
            self._scheduler.add_job(
                self._check_all_watches,
                trigger="interval",
                minutes=int(os.getenv("WATCH_INTERVAL_MINUTES", "60")),
                id="watch_mode_main",
            )
            self._scheduler.start()
            self._running = True
            return {"status": "started", "interval_minutes": int(os.getenv("WATCH_INTERVAL_MINUTES", "60"))}
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
        from api_chains.ecourts import fetch_ecourts
        watches = self.memory.get_watch_list(active_only=True)
        logger.info(f"Watch cycle: checking {len(watches)} item(s)")
        for watch in watches:
            try:
                result = fetch_ecourts(
                    party_name=watch.get("party_name"),
                    case_number=watch.get("case_number"),
                )
                current_status = str(result.get("cases", []))
                if watch.get("last_status") and current_status != watch["last_status"]:
                    self._fire_alert(watch, result)
                watch["last_checked"] = datetime.utcnow().isoformat()
                watch["last_status"] = current_status
            except Exception as e:
                logger.error(f"Watch check failed for {watch.get('id')}: {e}")

    def _fire_alert(self, watch: Dict, result: Dict):
        from alerts.whatsapp import send_watch_trigger
        cases = result.get("cases", [])
        details = "\n".join(
            f"• {c['case_number']} — Next hearing: {c.get('next_hearing', 'TBD')} | {c.get('status', '')}"
            for c in cases[:3]
        )
        send_watch_trigger(
            watch_id=watch["id"],
            trigger_reason="Case status update detected",
            details=details or "No detail available",
            to=watch.get("alert_phone"),
        )

    @property
    def is_running(self) -> bool:
        return self._running
