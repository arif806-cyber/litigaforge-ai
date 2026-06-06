"""
LitigaForge AI — Web Push Notifications Router
Hearing reminders, match alerts, and case updates delivered to user devices.
Works on all browsers + iOS 16.4+ (Safari) + Android Chrome.
"""
import json
import os

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel

from auth import require_user
from database import fetchrow as db_fetchrow, fetch as db_fetch, execute as db_execute
from rate_limit import limiter
from logger import get_logger

logger = get_logger("litigaforge.push")
router = APIRouter(tags=["push"])

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS_SUB = os.getenv("VAPID_CLAIMS_SUB", "mailto:hello@litigaforge.ai")


def _push_available() -> bool:
    return bool(VAPID_PRIVATE_KEY)


# ── Subscribe ─────────────────────────────────────────────────────────────────
class SubscribeBody(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@router.post("/push/subscribe")
@limiter.limit("10/minute")
async def push_subscribe(
    body: SubscribeBody,
    request: Request,
    user: dict = Depends(require_user),
):
    await db_execute(
        """
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (endpoint) DO UPDATE
            SET user_id = EXCLUDED.user_id,
                p256dh = EXCLUDED.p256dh,
                auth = EXCLUDED.auth
        """,
        user["id"], body.endpoint, body.p256dh, body.auth,
    )
    logger.info("push_subscribe user_id=%s", user["id"])
    return {"ok": True, "message": "Push notifications enabled"}


# ── Unsubscribe ───────────────────────────────────────────────────────────────
class UnsubscribeBody(BaseModel):
    endpoint: str


@router.delete("/push/subscribe")
@limiter.limit("10/minute")
async def push_unsubscribe(
    body: UnsubscribeBody,
    request: Request,
    user: dict = Depends(require_user),
):
    await db_execute(
        "DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2",
        body.endpoint, user["id"],
    )
    return {"ok": True}


# ── Internal helper: send push to a single subscription ──────────────────────
async def _send_push(endpoint: str, p256dh: str, auth: str, payload: dict) -> bool:
    if not _push_available():
        return False
    try:
        from pywebpush import webpush, WebPushException

        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth},
            },
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CLAIMS_SUB},
        )
        return True
    except Exception as exc:
        logger.warning("push failed endpoint=%s error=%s", endpoint[:40], exc)
        return False


# ── Send to a specific user (internal use by other routers) ──────────────────
async def notify_user(user_id: int, title: str, body: str, url: str = "/") -> int:
    """Send a push notification to all subscriptions for a user. Returns sent count."""
    subs = await db_fetch(
        "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=$1",
        user_id,
    )
    if not subs:
        return 0
    payload = {"title": title, "body": body, "icon": "/icon-192.png", "url": url}
    sent = 0
    for sub in subs:
        ok = await _send_push(sub["endpoint"], sub["p256dh"], sub["auth"], payload)
        if ok:
            sent += 1
        else:
            # Remove dead subscription
            await db_execute(
                "DELETE FROM push_subscriptions WHERE endpoint=$1", sub["endpoint"]
            )
    return sent


# ── Test push (authenticated user sends to themselves) ────────────────────────
@router.post("/push/test")
@limiter.limit("5/minute")
async def push_test(request: Request, user: dict = Depends(require_user)):
    if not _push_available():
        raise HTTPException(
            503,
            "Push notifications not configured — add VAPID_PRIVATE_KEY to Replit Secrets",
        )
    sent = await notify_user(
        user["id"],
        "LitigaForge AI",
        f"Hello {user['name']} — push notifications are working!",
        "/client-dashboard",
    )
    return {"sent": sent, "message": f"Sent to {sent} device(s)"}


# ── Push notification status for current user ─────────────────────────────────
@router.get("/push/status")
@limiter.limit("20/minute")
async def push_status(request: Request, user: dict = Depends(require_user)):
    subs = await db_fetch(
        "SELECT COUNT(*) AS cnt FROM push_subscriptions WHERE user_id=$1",
        user["id"],
    )
    count = subs[0]["cnt"] if subs else 0
    return {
        "configured": _push_available(),
        "subscriptions": count,
    }
