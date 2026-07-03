"""
LitigaForge AI — Daily Product Health Check

Deterministic (non-LLM) end-to-end verification that the product's core
flows actually work: DB connectivity, key public reads, and a real login
as a reserved system test account. Runs once a day at 07:00 IST,
production-gated (mirrors digest.py's _is_prod()) — and deliberately kept
INDEPENDENT of FORGEOS_ENABLED so it still runs even if the ForgeOS
subsystem is off; its `health_check_runs` table lives outside the forgeos
schema for the same reason.

Two-severity model:
  - CRITICAL checks (DB, core public reads, login/session) — a single
    failure marks the whole run "critical" and fires a deterministic
    founder alert email. These never depend on an LLM call.
  - DEGRADED checks (AI-provider connectivity) — failures are recorded and
    shown on the dashboard, but never page the founder; a flaky LLM call
    is not "the product is down".

Reserved test account: a single well-known user (HEALTHCHECK_EMAIL) is
upserted once per run with a freshly generated random password — rotated
every run, bcrypt-hashed into the DB, used immediately to prove the real
HTTP login path, then discarded. No secret ever needs to be stored: the
plaintext only exists in memory for the few seconds of a single run.
"""
import asyncio
import json
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import httpx

from database import execute, fetchval
from alerts.email import send_founder_alert
from logger import get_logger

logger = get_logger("litigaforge.health_check")

IST = timezone(timedelta(hours=5, minutes=30))
_RUN_HOUR_IST = 7
_RUN_MINUTE_IST = 0

HEALTHCHECK_EMAIL = "healthcheck@litigaforge.test"
HEALTHCHECK_NAME = "LitigaForge Health Check"

BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")
PORT = int(os.getenv("PORT", "5000"))
_BASE_URL = f"http://127.0.0.1:{PORT}{BASE_PATH}"
_TIMEOUT = httpx.Timeout(30.0)


def _is_prod() -> bool:
    """Fail-closed production detection — mirrors digest.py/judgment_ingest.py
    so an unset ENVIRONMENT in a real deployment never accidentally toggles
    behaviour."""
    if (os.getenv("REPLIT_DEPLOYMENT") or "").strip():
        return True
    if (os.getenv("NODE_ENV") or "").strip().lower() == "production":
        return True
    return (os.getenv("ENVIRONMENT") or "development").strip().lower() in ("production", "prod")


def _next_run_seconds(now_utc: datetime) -> float:
    now_ist = now_utc.astimezone(IST)
    target = now_ist.replace(hour=_RUN_HOUR_IST, minute=_RUN_MINUTE_IST, second=0, microsecond=0)
    if target <= now_ist:
        target += timedelta(days=1)
    return (target - now_ist).total_seconds()


async def init_health_check_table() -> None:
    await execute("""
        CREATE TABLE IF NOT EXISTS health_check_runs (
            id SERIAL PRIMARY KEY,
            overall_status TEXT NOT NULL,
            results JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


async def _bootstrap_reserved_user() -> str:
    """Idempotently ensures the reserved health-check user exists and rotates
    its password to a fresh random value. Returns the new plaintext — never
    persisted anywhere, used immediately for a login check, then dropped."""
    plaintext = secrets.token_urlsafe(24)
    password_hash = bcrypt.hashpw(plaintext.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")
    await execute(
        """INSERT INTO users (email, name, password_hash, role, subscription_tier, is_superuser)
           VALUES ($1, $2, $3, 'client', 'free', FALSE)
           ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash""",
        HEALTHCHECK_EMAIL, HEALTHCHECK_NAME, password_hash,
    )
    return plaintext


def _record(results: list, name: str, severity: str, status: str, started: datetime, detail: str) -> None:
    latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
    results.append({"name": name, "severity": severity, "status": status,
                     "latency_ms": latency_ms, "detail": detail[:300]})


async def _run_check(results: list, name: str, severity: str, coro) -> None:
    """Runs one check, records a structured pass/fail row, never raises."""
    started = datetime.now(timezone.utc)
    try:
        detail = await coro
        _record(results, name, severity, "ok", started, detail or "OK")
    except Exception as e:
        _record(results, name, severity, "fail", started, f"{type(e).__name__}: {e}")
        logger.warning("health-check: '%s' failed: %s", name, e)


async def _check_database() -> str:
    val = await fetchval("SELECT 1")
    assert val == 1
    return "DB reachable"


async def _check_get_ok(client: httpx.AsyncClient, path: str) -> str:
    resp = await client.get(path)
    resp.raise_for_status()
    return f"HTTP {resp.status_code}"


async def _check_llm_health(client: httpx.AsyncClient) -> str:
    resp = await client.get("/llm/health", params={"probe": "true"})
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "ok":
        raise RuntimeError(data.get("detail") or f"llm/health status={data.get('status')}")
    return "LLM provider reachable"


async def _check_login_and_session(client: httpx.AsyncClient, results: list) -> None:
    started = datetime.now(timezone.utc)
    try:
        plaintext = await _bootstrap_reserved_user()
        resp = await client.post("/auth/login", json={"email": HEALTHCHECK_EMAIL, "password": plaintext})
        resp.raise_for_status()
        token = resp.json().get("token")
        if not token:
            raise RuntimeError("login succeeded but no token was returned")
        _record(results, "auth_login", "critical", "ok", started, "login OK")
    except Exception as e:
        _record(results, "auth_login", "critical", "fail", started, f"{type(e).__name__}: {e}")
        logger.warning("health-check: 'auth_login' failed: %s", e)
        return

    started2 = datetime.now(timezone.utc)
    try:
        resp2 = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        resp2.raise_for_status()
        me = resp2.json()
        if me.get("email") != HEALTHCHECK_EMAIL:
            raise RuntimeError(f"unexpected /auth/me identity: {me.get('email')!r}")
        _record(results, "auth_me", "critical", "ok", started2, "session OK")
    except Exception as e:
        _record(results, "auth_me", "critical", "fail", started2, f"{type(e).__name__}: {e}")
        logger.warning("health-check: 'auth_me' failed: %s", e)


async def run_health_check() -> dict:
    """Runs every configured check and returns {overall_status, results}.
    Also persists the run and fires a founder alert on a CRITICAL result."""
    results: list = []

    await _run_check(results, "database", "critical", _check_database())

    async with httpx.AsyncClient(base_url=_BASE_URL, timeout=_TIMEOUT) as client:
        await _run_check(results, "subscription_plans", "critical", _check_get_ok(client, "/subscription/plans"))
        await _run_check(results, "lawyer_directory", "critical", _check_get_ok(client, "/lawyers"))
        await _run_check(results, "legal_aid_contacts", "critical", _check_get_ok(client, "/legal-aid/contacts"))
        await _check_login_and_session(client, results)
        await _run_check(results, "ai_connectivity", "degraded", _check_llm_health(client))

    if any(r["status"] == "fail" and r["severity"] == "critical" for r in results):
        overall = "critical"
    elif any(r["status"] == "fail" for r in results):
        overall = "degraded"
    else:
        overall = "ok"

    await execute(
        "INSERT INTO health_check_runs (overall_status, results) VALUES ($1, $2::jsonb)",
        overall, json.dumps(results, default=str),
    )

    if overall == "critical":
        failed = [r for r in results if r["status"] == "fail" and r["severity"] == "critical"]
        try:
            await asyncio.to_thread(
                send_founder_alert,
                "LitigaForge Product Health Check — CRITICAL",
                "The daily health check found the product BROKEN on: "
                + ", ".join(r["name"] for r in failed)
                + ".\n\nDetails:\n"
                + "\n".join(f"- {r['name']}: {r['detail']}" for r in failed),
            )
        except Exception as e:
            logger.error("health-check: founder alert failed to send: %s", e)

    logger.info("health-check: run complete — overall=%s (%d checks)", overall, len(results))
    return {"overall_status": overall, "results": results}


async def get_latest_run() -> dict | None:
    from database import fetchrow
    return await fetchrow(
        "SELECT overall_status, results, created_at FROM health_check_runs ORDER BY id DESC LIMIT 1"
    )


async def _scheduler_loop():
    while True:
        try:
            seconds = _next_run_seconds(datetime.now(timezone.utc))
            logger.info("health-check: next run in %.0f minutes", seconds / 60)
            await asyncio.sleep(seconds)
            await run_health_check()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.exception("health-check: scheduler loop error: %s", e)
            await asyncio.sleep(3600)  # back off 1h on error


def start_scheduler():
    """Production-only, mirrors digest.py/judgment_ingest.py. Returns None
    (benign no-op) outside production."""
    if not _is_prod():
        logger.info("health-check: not production — scheduler disabled")
        return None
    return asyncio.ensure_future(_scheduler_loop())
