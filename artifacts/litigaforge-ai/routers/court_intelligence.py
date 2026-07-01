"""
LitigaForge — Live Case Intelligence Router (Phase 1)

Endpoints:
  POST   /court-intel/track              Add a CNR to the watchlist + immediate refresh
  GET    /court-intel/my-cases           List all cases the user is tracking
  GET    /court-intel/{id}/timeline      Snapshots + events, newest first
  GET    /court-intel/{id}/events        Classified events only
  DELETE /court-intel/{id}               Stop tracking (soft delete)
  POST   /court-intel/worker/run         Superuser: manually trigger the diff worker

Free tier: latest status only.
LiveTrack (professional / advocate_pro): full events, timeline, predictions.

Note: users.id is SERIAL INTEGER; tracked_cases.id is UUID.
"""
from __future__ import annotations

import os
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from auth import require_user
from database import (
    fetch as db_fetch,
    fetchrow as db_fetchrow,
    execute as db_execute,
    fetchval as db_fetchval,
)
from logger import get_logger

logger = get_logger("litigaforge.court_intelligence")
router = APIRouter(tags=["court-intelligence"])

_BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")

_LIVETRACK_TIERS = {"professional", "advocate_pro"}

# ── CNR validation ─────────────────────────────────────────────────────────────
_CNR_RE = re.compile(r"^[A-Z]{2}[A-Z0-9]{4}\d{6}\d{4}$", re.IGNORECASE)


def _validate_cnr(cnr: str) -> str:
    cleaned = re.sub(r"[\s\-/]", "", cnr.upper().strip())
    if not _CNR_RE.match(cleaned):
        raise HTTPException(
            status_code=422,
            detail="Invalid CNR format. Expected 16-character code like TLHC010012342023.",
        )
    return cleaned


def _assert_owns(row: dict | None, user_id: int) -> dict:
    if not row:
        raise HTTPException(status_code=404, detail="Tracked case not found.")
    if int(row["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return row


# ── Schemas ────────────────────────────────────────────────────────────────────

class TrackRequest(BaseModel):
    cnr: str = Field(..., description="16-character eCourts CNR number")
    case_type: str | None = Field(None, description="e.g. civil, criminal, property")


# ── Background refresh helper ──────────────────────────────────────────────────

async def _trigger_single_refresh(tracked_case_id: str, cnr: str) -> None:
    try:
        from services.court_data_client import get_case_by_cnr
        await get_case_by_cnr(tracked_case_id, cnr)
        logger.info("Immediate refresh done: tracked_case_id=%s cnr=%s", tracked_case_id, cnr)
    except RuntimeError as exc:
        logger.warning("API key not set — skipping immediate refresh for %s: %s", cnr, exc)
    except Exception as exc:
        logger.exception("Immediate refresh failed for %s: %s", tracked_case_id, exc)


# ── POST /court-intel/track ────────────────────────────────────────────────────

@router.post(f"{_BASE_PATH}/court-intel/track")
async def track_case(
    body: TrackRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_user),
):
    cnr = _validate_cnr(body.cnr)
    user_id: int = int(user["id"])

    existing = await db_fetchrow(
        "SELECT id, is_active FROM tracked_cases WHERE user_id = $1 AND cnr = $2",
        user_id, cnr,
    )
    if existing:
        if existing["is_active"]:
            raise HTTPException(status_code=409, detail="You are already tracking this CNR.")
        tc_id = str(existing["id"])
        await db_execute(
            "UPDATE tracked_cases SET is_active = true, added_at = now() WHERE id = $1::uuid",
            tc_id,
        )
        background_tasks.add_task(_trigger_single_refresh, tc_id, cnr)
        return {"tracked_case_id": tc_id, "cnr": cnr, "status": "reactivated"}

    tc_id = await db_fetchval(
        """
        INSERT INTO tracked_cases (user_id, cnr, case_type, is_active, tier_gated)
        VALUES ($1, $2, $3, true, true)
        RETURNING id::text
        """,
        user_id, cnr, body.case_type,
    )
    logger.info("User %s started tracking CNR %s (id=%s)", user_id, cnr, tc_id)
    background_tasks.add_task(_trigger_single_refresh, str(tc_id), cnr)
    return {"tracked_case_id": str(tc_id), "cnr": cnr, "status": "tracking"}


# ── GET /court-intel/my-cases ──────────────────────────────────────────────────

@router.get(f"{_BASE_PATH}/court-intel/my-cases")
async def my_tracked_cases(user: dict = Depends(require_user)):
    user_id: int = int(user["id"])
    rows = await db_fetch(
        """
        SELECT tc.id::text, tc.cnr, tc.case_type, tc.court_name,
               tc.added_at, tc.last_refreshed, tc.is_active,
               cs.case_status, cs.next_hearing_date
        FROM   tracked_cases tc
        LEFT JOIN LATERAL (
            SELECT case_status, next_hearing_date
            FROM   case_snapshots
            WHERE  tracked_case_id = tc.id
            ORDER  BY fetched_at DESC LIMIT 1
        ) cs ON true
        WHERE  tc.user_id = $1 AND tc.is_active = true
        ORDER  BY tc.added_at DESC
        """,
        user_id,
    )
    return {"cases": [dict(r) for r in rows]}


# ── GET /court-intel/{id}/timeline ────────────────────────────────────────────

@router.get(f"{_BASE_PATH}/court-intel/{{case_id}}/timeline")
async def get_timeline(case_id: str, user: dict = Depends(require_user)):
    row = await db_fetchrow(
        "SELECT id, user_id, cnr, case_type, court_name, last_refreshed, is_active "
        "FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))

    tier = user.get("subscription_tier", "free")
    is_paid = tier in _LIVETRACK_TIERS

    latest_snap = await db_fetchrow(
        """
        SELECT case_status, next_hearing_date, order_count, fetched_at
        FROM   case_snapshots
        WHERE  tracked_case_id = $1::uuid
        ORDER  BY fetched_at DESC LIMIT 1
        """,
        case_id,
    )

    result: dict[str, Any] = {
        "cnr":            row["cnr"],
        "case_type":      row["case_type"],
        "court_name":     row["court_name"],
        "last_refreshed": row["last_refreshed"].isoformat() if row["last_refreshed"] else None,
        "is_active":      row["is_active"],
        "latest_status":  dict(latest_snap) if latest_snap else None,
        "livetrack_tier": is_paid,
    }

    if not is_paid:
        result["upgrade_hint"] = (
            "Upgrade to Professional or Advocate Pro to unlock full timeline, "
            "events, and AI insights."
        )
        return result

    snapshots = await db_fetch(
        """
        SELECT case_status, next_hearing_date, order_count, fetched_at
        FROM   case_snapshots
        WHERE  tracked_case_id = $1::uuid
        ORDER  BY fetched_at DESC LIMIT 50
        """,
        case_id,
    )
    events = await db_fetch(
        """
        SELECT event_type, summary, detected_at
        FROM   case_events
        WHERE  tracked_case_id = $1::uuid
        ORDER  BY detected_at DESC LIMIT 100
        """,
        case_id,
    )
    result["snapshots"] = [dict(s) for s in snapshots]
    result["events"]    = [dict(e) for e in events]
    return result


# ── GET /court-intel/{id}/events ──────────────────────────────────────────────

@router.get(f"{_BASE_PATH}/court-intel/{{case_id}}/events")
async def get_events(case_id: str, user: dict = Depends(require_user)):
    row = await db_fetchrow(
        "SELECT id, user_id, cnr FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))

    if user.get("subscription_tier", "free") not in _LIVETRACK_TIERS:
        raise HTTPException(
            status_code=402,
            detail="Full event feed requires Professional or Advocate Pro tier.",
        )

    events = await db_fetch(
        """
        SELECT id::text, event_type, summary, detected_at, notified
        FROM   case_events
        WHERE  tracked_case_id = $1::uuid
        ORDER  BY detected_at DESC LIMIT 200
        """,
        case_id,
    )
    return {"cnr": row["cnr"], "events": [dict(e) for e in events]}


# ── DELETE /court-intel/{id} ──────────────────────────────────────────────────

@router.delete(f"{_BASE_PATH}/court-intel/{{case_id}}")
async def stop_tracking(case_id: str, user: dict = Depends(require_user)):
    row = await db_fetchrow(
        "SELECT id, user_id, cnr FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))
    await db_execute(
        "UPDATE tracked_cases SET is_active = false WHERE id = $1::uuid",
        case_id,
    )
    logger.info("User %s stopped tracking CNR %s (id=%s)", user["id"], row["cnr"], case_id)
    return {"status": "stopped", "cnr": row["cnr"]}


# ── POST /court-intel/worker/run (superuser manual trigger) ───────────────────

@router.post(f"{_BASE_PATH}/court-intel/worker/run")
async def manual_run_worker(user: dict = Depends(require_user)):
    if not user.get("is_superuser"):
        raise HTTPException(status_code=403, detail="Superuser only.")
    from workers.case_refresh_worker import run_refresh
    result = await run_refresh()
    return {"status": "completed", **result}
