"""Private, revocable ICS subscriptions for advocate case dates."""
import hashlib
import os
import secrets
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from auth import get_current_user
from database import execute, fetch, fetchrow

router = APIRouter(tags=["calendar-sync"])


def calendar_enabled() -> bool:
    return os.getenv("CALENDAR_SYNC_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\r", "").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")


def render_calendar(events: list[dict]) -> str:
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LitigaForge//Private Case Calendar//EN", "CALSCALE:GREGORIAN"]
    for event in events:
        if not event.get("event_date"):
            continue
        try:
            day = event["event_date"] if isinstance(event["event_date"], date) else date.fromisoformat(str(event["event_date"])[:10])
        except (ValueError, TypeError):
            continue
        uid = _escape(str(event["uid"]))
        lines.extend([
            "BEGIN:VEVENT", f"UID:{uid}@litigaforge", f"DTSTAMP:{day.strftime('%Y%m%d')}T000000Z",
            f"DTSTART;VALUE=DATE:{day.strftime('%Y%m%d')}",
            f"SUMMARY:{_escape(str(event.get('title') or 'Case reminder'))}",
            f"DESCRIPTION:{_escape(str(event.get('description') or ''))}",
            "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def _advocate(user):
    if not user or user.get("role") not in ("advocate", "lawyer"):
        raise HTTPException(403, "Advocate access required")


@router.post("/calendar-sync/feed")
async def create_calendar_feed(request: Request, user=Depends(get_current_user)):
    if not calendar_enabled():
        raise HTTPException(404, "Calendar sync is disabled")
    _advocate(user)
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode()).hexdigest()
    await execute(
        """INSERT INTO advocate_calendar_feeds(user_id,token_hash)
           VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,
             revoked_at=NULL,updated_at=NOW()""", user["id"], digest,
    )
    base_url = str(request.base_url).rstrip("/")
    base_path = os.getenv("BASE_PATH", "/litigaforge").rstrip("/")
    if base_path and base_url.endswith(base_path):
        base_url = base_url[:-len(base_path)]
    return {"feed_url": f"{base_url}{base_path}/calendar-sync/{token}.ics"}


@router.get("/calendar-sync/feed/status")
async def calendar_feed_status(user=Depends(get_current_user)):
    if not calendar_enabled():
        return {"enabled": False, "active": False}
    _advocate(user)
    feed = await fetchrow(
        """SELECT created_at FROM advocate_calendar_feeds
           WHERE user_id=$1 AND revoked_at IS NULL""",
        user["id"],
    )
    return {"enabled": True, "active": bool(feed)}


@router.delete("/calendar-sync/feed")
async def revoke_calendar_feed(user=Depends(get_current_user)):
    if not calendar_enabled():
        raise HTTPException(404, "Calendar sync is disabled")
    _advocate(user)
    await execute(
        "UPDATE advocate_calendar_feeds SET revoked_at=NOW(),updated_at=NOW() WHERE user_id=$1",
        user["id"],
    )
    return {"revoked": True}


@router.get("/calendar-sync/{token}.ics")
async def get_calendar_feed(token: str):
    if not calendar_enabled():
        raise HTTPException(404, "Calendar sync is disabled")
    digest = hashlib.sha256(token.encode()).hexdigest()
    feed = await fetchrow(
        "SELECT user_id FROM advocate_calendar_feeds WHERE token_hash=$1 AND revoked_at IS NULL",
        digest,
    )
    if not feed:
        raise HTTPException(404, "Calendar feed not found")
    events = await fetch(
        """SELECT id::text AS uid, hearing_date::date AS event_date, title,
                  COALESCE(case_type,'') || CASE WHEN COALESCE(client_name,'')='' THEN ''
                    ELSE ' — ' || client_name END AS description
           FROM lawyer_cases WHERE lawyer_id=$1 AND hearing_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
           UNION ALL
           SELECT u.id::text AS uid, u.next_step_date AS event_date,
                  COALESCE(c.title,'Case follow-up') AS title, u.next_step AS description
           FROM connect_case_updates u
           JOIN case_requirements c ON c.id=u.case_id
           JOIN matches m ON m.case_requirement_id=c.id AND m.status='accepted'
             AND m.connect_v2=TRUE
           JOIN lawyers l ON l.id=m.lawyer_id
           WHERE l.user_id=$1 AND u.next_step_date IS NOT NULL""",
        feed["user_id"],
    )
    return Response(
        render_calendar(events), media_type="text/calendar; charset=utf-8",
        headers={"Cache-Control": "private, no-store", "Content-Disposition": 'inline; filename="litigaforge.ics"'},
    )
