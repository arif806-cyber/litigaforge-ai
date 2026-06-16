"""
LitigaForge AI — Admin Router
Superuser-only lawyer verification and user management.
"""
import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from auth import get_superuser
from database import fetch, fetchrow, execute
from logger import get_logger
from sanitizer import sanitize_text
from alerts.whatsapp import send_whatsapp_alert
from alerts.email import send_verification_email, send_rejection_email

logger = get_logger("litigaforge.admin")

router = APIRouter(tags=["admin"])

# Background judgment-ingestion tasks. Kept referenced so the event loop does not
# garbage-collect an in-flight task (asyncio holds only a weak reference to it).
_INGEST_BG_TASKS: set = set()


class RejectRequest(BaseModel):
    reason: str = ""


def _notify_approved(name: str, email: str, phone: str) -> None:
    """Fire-and-forget: WhatsApp + email to the newly approved advocate."""
    wa_msg = (
        f"🎉 Congratulations, Advocate {name}!\n\n"
        "Your LitigaForge advocate account has been verified by our team. "
        "You can now log in and start receiving client leads directly.\n\n"
        "👉 https://litiga-forge-ai.replit.app/litigaforge/login"
    )
    if phone:
        send_whatsapp_alert(wa_msg, to=phone, alert_type="info")
    else:
        send_whatsapp_alert(wa_msg, alert_type="info")

    if email:
        send_verification_email(email, name)


def _notify_rejected(name: str, email: str, phone: str, reason: str) -> None:
    """Fire-and-forget: WhatsApp + email to the rejected advocate."""
    wa_msg = (
        f"Hi Advocate {name},\n\n"
        "Your LitigaForge advocate profile could not be verified at this time."
        + (f"\n\nReason: {reason}" if reason else "")
        + "\n\nPlease re-register with updated credentials or contact support."
    )
    if phone:
        send_whatsapp_alert(wa_msg, to=phone, alert_type="info")

    if email:
        send_rejection_email(email, name, reason)


@router.get("/admin/lawyers/pending")
async def admin_pending_lawyers(current_user: dict = Depends(get_superuser)):
    rows = await fetch(
        """SELECT id, name, email, phone, bar_number, district, practice_areas,
                  experience_years, created_at
           FROM lawyers WHERE verified = FALSE
           ORDER BY created_at DESC""",
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "lawyers": rows}


@router.post("/admin/lawyers/{lawyer_id}/approve")
async def admin_approve_lawyer(
    lawyer_id: int,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_superuser),
):
    row = await fetchrow(
        "UPDATE lawyers SET verified = TRUE, verification_status = 'verified' WHERE id = $1 RETURNING id",
        lawyer_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Lawyer not found")

    lawyer = await fetchrow(
        "SELECT name, email, phone FROM lawyers WHERE id = $1",
        lawyer_id,
    )
    if lawyer:
        background_tasks.add_task(
            _notify_approved,
            name=lawyer["name"] or "Advocate",
            email=lawyer["email"] or "",
            phone=lawyer["phone"] or "",
        )

    return {"success": True, "lawyer_id": lawyer_id, "status": "verified"}


@router.post("/admin/lawyers/{lawyer_id}/reject")
async def admin_reject_lawyer(
    lawyer_id: int,
    req: RejectRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_superuser),
):
    try:
        safe_reason = sanitize_text(req.reason, max_length=500, field_name="reason") if req.reason else ""
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    row = await fetchrow(
        "UPDATE lawyers SET verification_status = 'rejected' WHERE id = $1 RETURNING id",
        lawyer_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Lawyer not found")

    lawyer = await fetchrow(
        "SELECT name, email, phone FROM lawyers WHERE id = $1",
        lawyer_id,
    )
    if lawyer:
        background_tasks.add_task(
            _notify_rejected,
            name=lawyer["name"] or "Advocate",
            email=lawyer["email"] or "",
            phone=lawyer["phone"] or "",
            reason=safe_reason,
        )

    return {"success": True, "lawyer_id": lawyer_id, "status": "rejected", "reason": safe_reason}


@router.get("/admin/users")
async def admin_list_users(
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_superuser),
):
    offset = max((page - 1) * limit, 0)
    rows = await fetch(
        """SELECT id, name, email, subscription_tier,
                  cases_this_month, is_superuser, created_at
           FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2""",
        limit, offset,
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"page": page, "limit": limit, "users": rows}


@router.post("/admin/users/{user_id}/reset-usage")
async def admin_reset_usage(user_id: int, current_user: dict = Depends(get_superuser)):
    await execute("UPDATE users SET cases_this_month = 0 WHERE id = $1", user_id)
    return {"success": True}


@router.post("/admin/judgments/ingest/run")
async def admin_run_judgment_ingest(
    max_docs: int = 0,
    queries: str = "",
    per_query_max: int = 0,
    background: bool = False,
    current_user: dict = Depends(get_superuser),
):
    """Manually trigger one judgment-ingestion pass (ops + verification).

    Mirrors the daily scheduler but runs on demand. Advisory-locked inside
    ``run_ingestion`` so it can never overlap the scheduler. Returns a benign
    "no_source_configured" result when no compliant API token is set; returns
    HTTP 502 when a *configured* source is unavailable — it never falls back to
    scraping or fabricated data.

    Optional params:

    - ``queries``: semicolon-separated IndianKanoon ``formInput`` strings to use
      instead of the configured defaults (e.g.
      ``"Article 21 right to life doctypes: supremecourt; consumer rights doctypes: supremecourt"``).
      Leave empty to use ``JUDGMENT_INGEST_QUERIES`` / built-in defaults.
    - ``per_query_max``: cap the number of NEW judgments ingested per query
      (best-effort; dedup/out-of-scope docs do not count). ``0`` = no per-query cap.
    - ``background``: when true, run the pass as a detached server-side task and
      return immediately with ``{"started": true}``. Required for large batches —
      each judgment's AI summary takes ~30-45s and a synchronous request would be
      killed by the ~60s gateway timeout before anything is inserted.
    """
    from judgment_ingest import run_ingestion, IndianKanoonError

    # Parse optional custom queries (mirrors judgment_ingest._queries() labelling).
    parsed_queries: list[tuple[str, str]] | None = None
    raw = (queries or "").strip()
    if raw:
        parsed_queries = [
            (part.strip()[:60], part.strip())
            for part in raw.split(";")
            if part.strip()
        ] or None

    pqm = per_query_max if per_query_max > 0 else None

    if background:
        async def _bg_ingest() -> None:
            try:
                result = await run_ingestion(
                    max_docs=max_docs or None,
                    trigger="manual-bg",
                    queries=parsed_queries,
                    per_query_max=pqm,
                )
                logger.info("[admin] background judgment ingest finished: %s", result)
            except Exception as e:  # log loud, never let a bg task die silently
                logger.error("[admin] background judgment ingest failed: %s", e, exc_info=True)

        task = asyncio.create_task(_bg_ingest())
        _INGEST_BG_TASKS.add(task)
        task.add_done_callback(_INGEST_BG_TASKS.discard)
        return {
            "success": True,
            "started": True,
            "background": True,
            "max_docs": max_docs or None,
            "per_query_max": pqm,
            "queries": [label for label, _ in (parsed_queries or [])],
        }

    try:
        stats = await run_ingestion(
            max_docs=max_docs or None,
            trigger="manual",
            queries=parsed_queries,
            per_query_max=pqm,
        )
    except IndianKanoonError as e:
        raise HTTPException(status_code=502, detail=f"Compliant source unavailable: {e}")
    return {"success": True, "result": stats}
