"""
LitigaForge AI — Daily Judgment Digest

Emails subscribers the top 5 newest, most-important judgments once a day at
07:00 IST. The production-gated daily scheduler mirrors judgment_ingest.py.

Subscribe / unsubscribe HTTP endpoints live in routers/community.py; this module
owns selection, email orchestration, and the scheduler.

NO silent fallback: if SMTP is not configured, send_daily_digest() reports it
LOUDLY (warning log) and sends nothing — it never mock-delivers to subscribers.
"""
import asyncio
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from database import execute, fetch, fetchval
from alerts.email import send_digest_email, smtp_configured
from logger import get_logger
from citation_extractor import extract_citations_sync

logger = get_logger("litigaforge.digest")

SITE_URL = os.getenv("PUBLIC_SITE_URL", "https://litigaforge.com").rstrip("/")
BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")

IST = timezone(timedelta(hours=5, minutes=30))
DIGEST_SIZE = 5
# A judgment counts as "new" for the digest if it was ingested within this
# window. The daily cadence is 24h; the buffer absorbs ingest/scheduler skew.
_RECENT_WINDOW_HOURS = 26


def _is_prod() -> bool:
    """Fail-closed production detection — ANY production signal counts. Mirrors
    judgment_ingest.py so an unset ENVIRONMENT in a real deployment never
    accidentally toggles behaviour."""
    if (os.getenv("REPLIT_DEPLOYMENT") or "").strip():
        return True
    if (os.getenv("NODE_ENV") or "").strip().lower() == "production":
        return True
    return (os.getenv("ENVIRONMENT") or "development").strip().lower() in ("production", "prod")


def _judgment_url(court_slug: str, year, slug: str) -> str:
    # Bare canonical (no country prefix, no BASE_PATH) — matches the sitemap and
    # the per-route SEO canonical; the SPA adds the country prefix on load.
    return f"{SITE_URL}/judgments/{court_slug}/{year}/{slug}"


def unsubscribe_url(token: str) -> str:
    # Points at the Python backend (served under BASE_PATH via the proxy) so the
    # link resolves directly from any email client, independent of the SPA.
    return f"{SITE_URL}{BASE_PATH}/digest/unsubscribe?token={token}"


def confirm_url(token: str) -> str:
    # Double opt-in confirmation link — resolves on the Python backend (under
    # BASE_PATH via the proxy) so it works directly from any email client.
    return f"{SITE_URL}{BASE_PATH}/digest/confirm/{token}"


def _two_line_summary(text: Optional[str], limit: int = 220) -> str:
    s = " ".join((text or "").split())
    if not s:
        return "Summary not yet available — open the full analysis for the details."
    if len(s) <= limit:
        return s
    cut = s[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(".,;:") + "…"


async def select_top_judgments(limit: int = DIGEST_SIZE) -> list:
    """Top judgments for the digest: published, ingested in the last ~26h, ranked
    by court importance (Supreme Court > High Court > other) then recency."""
    rows = await fetch(
        f"""
        SELECT case_name, court, court_slug, year, slug, summary_en, judgment_date
        FROM judgments
        WHERE status = 'published'
          AND created_at >= NOW() - INTERVAL '{_RECENT_WINDOW_HOURS} hours'
        ORDER BY
          CASE
            WHEN court_slug = 'supreme-court-of-india' THEN 0
            WHEN court_slug LIKE '%high-court%' THEN 1
            ELSE 2
          END,
          judgment_date DESC NULLS LAST,
          created_at DESC
        LIMIT $1
        """,
        limit,
    )
    items = []
    for r in rows:
        items.append({
            "case_name": r["case_name"],
            "court": r["court"],
            "summary": _two_line_summary(r["summary_en"]),
            "url": _judgment_url(r["court_slug"], r["year"], r["slug"]),
            # Top 3 cited cases extracted from the summary (IK links only — no DB
            # lookup needed here; digest emails go to subscribers, not search bots).
            "citations": extract_citations_sync(r.get("summary_en") or "")[:3],
        })
    return items


async def send_daily_digest(trigger: str = "scheduler") -> dict:
    """Select the top judgments and email every active subscriber.

    Order of checks matters:
      1. SMTP unconfigured  → LOUD warning, send nothing (never silent no-op).
      2. No new judgments   → benign info no-op (nothing to send).
      3. No subscribers     → benign info no-op.
      4. Otherwise          → send to each active subscriber, set last_sent_at.
    """
    items = await select_top_judgments(DIGEST_SIZE)
    active = await fetchval(
        "SELECT COUNT(*) FROM digest_subscribers WHERE is_active = TRUE AND confirmed = TRUE"
    ) or 0

    if not smtp_configured():
        logger.warning(
            "digest[%s]: SMTP is NOT configured — cannot send. %d active subscriber(s), "
            "%d judgment(s) selected today. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD "
            "to enable delivery. No emails sent.",
            trigger, active, len(items),
        )
        return {"sent": 0, "failed": 0, "subscribers": active,
                "judgments": len(items), "reason": "smtp_unconfigured"}

    if not items:
        logger.info(
            "digest[%s]: no new judgments in the last %dh — nothing to send to %d subscriber(s)",
            trigger, _RECENT_WINDOW_HOURS, active,
        )
        return {"sent": 0, "failed": 0, "subscribers": active,
                "judgments": 0, "reason": "no_new_judgments"}

    if not active:
        logger.info("digest[%s]: %d judgment(s) ready but no active subscribers", trigger, len(items))
        return {"sent": 0, "failed": 0, "subscribers": 0,
                "judgments": len(items), "reason": "no_subscribers"}

    subscribers = await fetch(
        "SELECT id, name, email, unsubscribe_token FROM digest_subscribers "
        "WHERE is_active = TRUE AND confirmed = TRUE"
    )
    date_label = datetime.now(IST).strftime("%d %B %Y").lstrip("0")
    sent = failed = 0
    for sub in subscribers:
        token = sub["unsubscribe_token"]
        if not token:
            token = secrets.token_urlsafe(32)
            await execute(
                "UPDATE digest_subscribers SET unsubscribe_token = $1 WHERE id = $2",
                token, sub["id"],
            )
        # send_digest_email is blocking (smtplib) — run it off the event loop.
        res = await asyncio.to_thread(
            send_digest_email,
            sub["email"], sub["name"] or "", items, date_label, unsubscribe_url(token),
        )
        if res.get("success"):
            sent += 1
            await execute(
                "UPDATE digest_subscribers SET last_sent_at = NOW() WHERE id = $1", sub["id"]
            )
        else:
            failed += 1
            logger.warning("digest[%s]: failed to send to %s: %s",
                           trigger, sub["email"], res.get("error"))

    logger.info(
        "digest[%s]: sent %d, failed %d (of %d active subscribers); %d judgments",
        trigger, sent, failed, len(subscribers), len(items),
    )
    return {"sent": sent, "failed": failed, "subscribers": len(subscribers),
            "judgments": len(items), "reason": "ok"}


# ── Daily scheduler (production only) ──────────────────────────────────────────

# 07:00 IST == 01:30 UTC (IST = UTC+5:30).
_RUN_HOUR_UTC = 1
_RUN_MINUTE_UTC = 30


def _next_run(now_utc: datetime) -> datetime:
    target = now_utc.replace(hour=_RUN_HOUR_UTC, minute=_RUN_MINUTE_UTC, second=0, microsecond=0)
    if target <= now_utc:
        target += timedelta(days=1)
    return target


async def _scheduler_loop() -> None:
    while True:
        now = datetime.now(timezone.utc)
        nxt = _next_run(now)
        delay = (nxt - now).total_seconds()
        logger.info(
            "digest: next run at %s UTC (07:00 IST) — in %.1f h",
            nxt.isoformat(), delay / 3600,
        )
        try:
            await asyncio.sleep(delay)
        except asyncio.CancelledError:
            logger.info("digest: scheduler cancelled")
            raise
        try:
            await send_daily_digest(trigger="scheduler")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            # Fail LOUD (error log) but keep the daily loop alive.
            logger.error("digest: scheduled run failed: %s", e, exc_info=True)


def start_scheduler() -> Optional["asyncio.Task"]:
    """Start the daily digest scheduler. Production only; returns the task handle
    (or None when disabled) so the caller can cancel it on shutdown."""
    if not _is_prod():
        logger.info("digest: non-production environment — daily scheduler disabled")
        return None
    if not smtp_configured():
        logger.warning(
            "digest: production scheduler started, but SMTP is NOT configured — daily runs "
            "will report and send nothing until SMTP_HOST/SMTP_USER/SMTP_PASSWORD are set"
        )
    else:
        logger.info("digest: production daily scheduler enabled (07:00 IST)")
    return asyncio.create_task(_scheduler_loop())
