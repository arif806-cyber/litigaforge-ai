"""
CourtDataClient — eCourtsIndia API wrapper for LitigaForge.

Single responsibility: talk to eCourtsIndia, nothing else.
No business logic — only fetch, retry, rate-limit, and persist raw snapshots.

Rate limits (as per eCourtsIndia API agreement):
  100 req/min · 3 000/hr · 50 000/day

If ECOURTSINDIA_API_KEY is not set the client raises RuntimeError on every
call; callers should handle this and surface a clear user-facing error.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any

import httpx

from database import execute as db_execute, fetchval as db_fetchval
from logger import get_logger

logger = get_logger("litigaforge.court_data_client")

_API_BASE = os.getenv("ECOURTSINDIA_API_BASE", "https://api.ecourts.gov.in/api/ords/ecourt")

# Support dual-key rotation for extra rate-limit headroom.
# ECOURTSINDIA_API_KEY is required; ECOURTSINDIA_API_KEY_2 is optional.
_KEY_POOL: list[str] = [
    k for k in [
        os.getenv("ECOURTSINDIA_API_KEY", ""),
        os.getenv("ECOURTSINDIA_API_KEY_2", ""),
    ]
    if k
]
_key_index = 0  # round-robin pointer (protected by _bucket._lock)

# Keep backward-compat name used by _require_key()
_API_KEY = _KEY_POOL[0] if _KEY_POOL else ""


class _TokenBucket:
    """Sliding-window token bucket — thread-safe via asyncio.Lock."""

    def __init__(self, per_minute: int = 100, per_hour: int = 3_000, per_day: int = 50_000):
        self._per_minute = per_minute
        self._per_hour   = per_hour
        self._per_day    = per_day
        self._lock       = asyncio.Lock()
        self._minute_ts: list[float] = []
        self._hour_ts:   list[float] = []
        self._day_ts:    list[float] = []

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            self._minute_ts = [t for t in self._minute_ts if now - t < 60]
            self._hour_ts   = [t for t in self._hour_ts   if now - t < 3_600]
            self._day_ts    = [t for t in self._day_ts    if now - t < 86_400]

            if (len(self._minute_ts) >= self._per_minute or
                    len(self._hour_ts) >= self._per_hour or
                    len(self._day_ts)  >= self._per_day):
                logger.warning(
                    "eCourtsIndia rate limit reached — throttling request "
                    "(minute=%d/%d hour=%d/%d day=%d/%d)",
                    len(self._minute_ts), self._per_minute,
                    len(self._hour_ts),   self._per_hour,
                    len(self._day_ts),    self._per_day,
                )
                await asyncio.sleep(1)

            self._minute_ts.append(now)
            self._hour_ts.append(now)
            self._day_ts.append(now)


_bucket = _TokenBucket()


def _require_key() -> str:
    if not _KEY_POOL:
        raise RuntimeError(
            "ECOURTSINDIA_API_KEY is not set. "
            "Add it in Replit Secrets to enable live case tracking."
        )
    return _KEY_POOL[0]


def _next_key() -> str:
    """Round-robin across the key pool. Call inside _bucket._lock for safety."""
    global _key_index
    if not _KEY_POOL:
        raise RuntimeError(
            "ECOURTSINDIA_API_KEY is not set. "
            "Add it in Replit Secrets to enable live case tracking."
        )
    key = _KEY_POOL[_key_index % len(_KEY_POOL)]
    _key_index = (_key_index + 1) % len(_KEY_POOL)
    return key


async def _request(
    method: str,
    path: str,
    *,
    json_body: dict | None = None,
    params: dict | None = None,
    retries: int = 3,
) -> dict:
    """Internal: rate-limited, retried HTTP call to eCourtsIndia."""
    if not _KEY_POOL:
        _require_key()  # raises with a clear message
    headers = {
        "Authorization": f"Bearer {_next_key()}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    url = f"{_API_BASE.rstrip('/')}/{path.lstrip('/')}"

    for attempt in range(retries):
        await _bucket.acquire()
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.request(
                    method, url,
                    headers=headers,
                    json=json_body,
                    params=params,
                )
            if resp.status_code < 400:
                return resp.json()
            if resp.status_code >= 500:
                raise httpx.HTTPStatusError(
                    f"5xx from eCourts: {resp.status_code}",
                    request=resp.request,
                    response=resp,
                )
            # 4xx — do NOT retry
            logger.error("eCourtsIndia 4xx for %s %s: %s", method, url, resp.text[:200])
            resp.raise_for_status()
        except (httpx.TimeoutException, httpx.HTTPStatusError) as exc:
            wait = 2 ** attempt
            if attempt < retries - 1:
                logger.warning("eCourts request failed (attempt %d/%d): %s — retrying in %ds",
                               attempt + 1, retries, exc, wait)
                await asyncio.sleep(wait)
            else:
                logger.error("eCourts request permanently failed after %d attempts: %s", retries, exc)
                raise

    raise RuntimeError("Unreachable")


async def _persist_snapshot(tracked_case_id: str, raw: dict) -> None:
    """Write raw payload to case_snapshots BEFORE any parsing."""
    case_status      = raw.get("case_status") or raw.get("status")
    next_hearing_raw = raw.get("next_hearing_date") or raw.get("nextHearingDate")
    order_count      = raw.get("order_count") or raw.get("orderCount") or 0

    await db_execute(
        """
        INSERT INTO case_snapshots
            (tracked_case_id, raw_response, case_status, next_hearing_date, order_count)
        VALUES ($1, $2::jsonb, $3, $4::date, $5)
        """,
        tracked_case_id,
        json.dumps(raw),
        str(case_status) if case_status else None,
        next_hearing_raw if next_hearing_raw else None,
        int(order_count) if order_count else 0,
    )
    logger.debug("Persisted snapshot for tracked_case_id=%s", tracked_case_id)


async def get_case_by_cnr(tracked_case_id: str, cnr: str) -> dict:
    """
    Fetch a single case from eCourtsIndia by CNR.
    Persists raw JSON to case_snapshots before returning.
    Returns the parsed response dict.
    """
    raw = await _request("GET", f"/case/cnr/{cnr}")
    await _persist_snapshot(tracked_case_id, raw)
    return raw


async def get_case_orders(cnr: str) -> list[dict]:
    """
    Fetch the list of orders for a case.
    Returns a list of order dicts (order_id, order_date, order_text / text, etc.).
    Returns [] on any failure — callers must treat this as a soft error.
    """
    try:
        raw = await _request("GET", f"/case/cnr/{cnr}/orders")
        orders = raw.get("orders") or raw.get("data") or []
        if not isinstance(orders, list):
            return []
        return orders
    except Exception as exc:
        logger.warning("get_case_orders failed for cnr=%s: %s", cnr, exc)
        return []


async def get_order_text(cnr: str, order_id: str) -> str | None:
    """
    Fetch the full text for a specific order by its eCourts order_id.
    Returns the text string, or None if unavailable (e.g. OCR not yet done).
    Failure is soft — callers should log and retry on the next nightly run.
    """
    try:
        raw = await _request("GET", f"/case/cnr/{cnr}/orders/{order_id}")
        text = (
            raw.get("order_text")
            or raw.get("text")
            or raw.get("content")
            or raw.get("order_content")
            or ""
        )
        return text.strip() or None
    except Exception as exc:
        logger.warning(
            "get_order_text failed for cnr=%s order_id=%s: %s", cnr, order_id, exc
        )
        return None


async def bulk_refresh(cases: list[dict]) -> dict[str, dict]:
    """
    Submit a batch refresh for up to 50 CNRs at a time.
    cases: list of {"tracked_case_id": str, "cnr": str}
    Returns {cnr: raw_payload} for all returned cases.
    Persists every raw payload before returning.
    """
    results: dict[str, dict] = {}
    for i in range(0, len(cases), 50):
        batch = cases[i : i + 50]
        cnr_list = [c["cnr"] for c in batch]
        cnr_map  = {c["cnr"]: c["tracked_case_id"] for c in batch}

        logger.info("Submitting bulk refresh for %d CNRs", len(cnr_list))
        resp = await _request("POST", "/case/bulk-cnr", json_body={"cnrs": cnr_list})

        # eCourtsIndia bulk is async — poll until complete
        job_id = resp.get("job_id") or resp.get("requestId")
        if job_id:
            raw_results = await _poll_bulk_job(job_id)
        else:
            # Some API versions return results immediately
            raw_results = resp.get("results") or resp.get("data") or []

        for item in raw_results:
            cnr      = item.get("cnr") or item.get("caseNumber")
            tc_id    = cnr_map.get(cnr)
            if cnr and tc_id:
                await _persist_snapshot(tc_id, item)
                results[cnr] = item

    return results


async def _poll_bulk_job(job_id: str, max_polls: int = 20, interval: int = 5) -> list[dict]:
    """Poll the eCourtsIndia async bulk job until it completes."""
    for poll in range(max_polls):
        await asyncio.sleep(interval)
        resp = await _request("GET", f"/case/bulk-cnr/status/{job_id}")
        status = resp.get("status", "").lower()
        if status in ("completed", "done", "success"):
            return resp.get("results") or resp.get("data") or []
        if status in ("failed", "error"):
            logger.error("Bulk job %s failed: %s", job_id, resp)
            return []
        logger.debug("Bulk job %s still %s (poll %d/%d)", job_id, status, poll + 1, max_polls)
    logger.warning("Bulk job %s did not complete after %d polls", job_id, max_polls)
    return []
