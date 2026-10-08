"""Single source of truth for the eCourtsIndia Partner REST API."""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any
from urllib.parse import quote

import httpx

from database import execute as db_execute, fetchval as db_fetchval
from logger import get_logger

logger = get_logger("litigaforge.court_data_client")

PARTNER_API_BASE = "https://webapi.ecourtsindia.com"
_API_BASE = os.getenv("ECOURTSINDIA_API_BASE", PARTNER_API_BASE).rstrip("/")
_CNR_RE = re.compile(r"^[A-Z]{4}\d{12}$")
_DEFAULT_TIMEOUT = 20.0
_GET_RETRIES = 2

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


class CourtDataError(RuntimeError):
    """Safe, user-displayable eCourts failure (never contains request headers)."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str = "upstream_error",
        retry_after: float | None = None,
        retryable: bool = False,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.retry_after = retry_after
        self.retryable = retryable

    @property
    def user_message(self) -> str:
        return str(self)


class CourtDataConfigurationError(CourtDataError):
    def __init__(self):
        super().__init__(
            "eCourtsIndia is not configured. Add the vendor-issued partner token "
            "as the ECOURTSINDIA_API_KEY Replit Secret, then restart LitigaForge AI.",
            code="missing_credentials",
        )


def is_configured() -> bool:
    return bool(_KEY_POOL)


def require_configured() -> None:
    if not is_configured():
        raise CourtDataConfigurationError()


def normalize_cnr(cnr: str) -> str:
    cleaned = re.sub(r"[\s\-/]", "", str(cnr or "")).upper()
    if not _CNR_RE.fullmatch(cleaned):
        raise ValueError("Invalid CNR format. Expected 4 letters followed by 12 digits.")
    return cleaned


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
        raise CourtDataConfigurationError()
    return _KEY_POOL[0]


def _next_key() -> str:
    """Round-robin across the key pool. Call inside _bucket._lock for safety."""
    global _key_index
    if not _KEY_POOL:
        raise CourtDataConfigurationError()
    key = _KEY_POOL[_key_index % len(_KEY_POOL)]
    _key_index = (_key_index + 1) % len(_KEY_POOL)
    return key


async def _request(
    method: str,
    path: str,
    *,
    json_body: dict | None = None,
    params: dict | None = None,
    retries: int | None = None,
    timeout: float = _DEFAULT_TIMEOUT,
) -> dict:
    """Call a Partner API endpoint. Only GETs are retried to avoid duplicate paid POSTs."""
    require_configured()
    method = method.upper()
    retry_count = _GET_RETRIES if retries is None and method == "GET" else (retries or 0)
    headers = {
        "Authorization": f"Bearer {_next_key()}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    url = f"{_API_BASE.rstrip('/')}/{path.lstrip('/')}"

    for attempt in range(retry_count + 1):
        await _bucket.acquire()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.request(
                    method, url,
                    headers=headers,
                    json=json_body,
                    params=params,
                )
            if resp.status_code >= 400:
                error = _provider_error(resp)
                if method == "GET" and error.retryable and attempt < retry_count:
                    delay = error.retry_after or min(2 ** attempt, 8)
                    logger.warning(
                        "eCourts Partner GET failed status=%s path=%s attempt=%d/%d; retrying in %.1fs",
                        error.status_code, path, attempt + 1, retry_count + 1, delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error(
                    "eCourts Partner request failed status=%s code=%s path=%s",
                    error.status_code, error.code, path,
                )
                raise error
            try:
                payload = resp.json()
            except (ValueError, json.JSONDecodeError) as exc:
                raise CourtDataError(
                    "eCourtsIndia returned an invalid JSON response.",
                    status_code=502, code="invalid_json",
                ) from exc
            if not isinstance(payload, dict):
                raise CourtDataError(
                    "eCourtsIndia returned an unexpected response format.",
                    status_code=502, code="invalid_response",
                )
            request_id = (payload.get("meta") or {}).get("request_id") if isinstance(payload.get("meta"), dict) else None
            logger.debug("eCourts Partner request succeeded path=%s request_id=%s", path, request_id)
            return payload
        except CourtDataError:
            raise
        except httpx.TransportError as exc:
            error = CourtDataError(
                "Could not reach eCourtsIndia. Check network access and retry.",
                code="network_error",
                retryable=True,
            )
            if method == "GET" and attempt < retry_count:
                delay = min(2 ** attempt, 8)
                logger.warning(
                    "eCourts Partner GET transport failure path=%s attempt=%d/%d; retrying in %ds (%s)",
                    path, attempt + 1, retry_count + 1, delay, type(exc).__name__,
                )
                await asyncio.sleep(delay)
                continue
            logger.error("eCourts Partner transport failure path=%s (%s)", path, type(exc).__name__)
            raise error from exc
    raise CourtDataError("eCourtsIndia request failed after retries.", code="retry_exhausted", retryable=True)


def _provider_error(resp: httpx.Response) -> CourtDataError:
    status = resp.status_code
    try:
        body = resp.json()
    except Exception:
        body = {}
    body_error = body.get("error", {}) if isinstance(body, dict) else {}
    provider_code = str(body_error.get("code") or "") if isinstance(body_error, dict) else ""
    retry_after_raw = resp.headers.get("Retry-After")
    try:
        retry_after = min(max(float(retry_after_raw), 0.0), 30.0) if retry_after_raw else None
    except (TypeError, ValueError):
        retry_after = None

    if status == 401:
        message = "eCourtsIndia rejected the partner token (HTTP 401). Check the configured Replit Secret."
    elif status == 403:
        message = "eCourtsIndia denied this partner account (HTTP 403). Check account status and API access."
    elif status == 402:
        message = "eCourtsIndia requires available credits or an active subscription (HTTP 402)."
    elif status == 429:
        message = "eCourtsIndia rate-limited this request (HTTP 429). Wait before retrying."
    elif status >= 500:
        message = f"eCourtsIndia is temporarily unavailable (HTTP {status}). Retry later."
    else:
        provider_message = body_error.get("message") if isinstance(body_error, dict) else None
        detail = str(provider_message or "").strip()[:240]
        message = f"eCourtsIndia rejected the request (HTTP {status})."
        if detail:
            message += f" {detail}"
    return CourtDataError(
        message,
        status_code=status,
        code=provider_code or f"http_{status}",
        retry_after=retry_after,
        retryable=(status == 429 or status >= 500),
    )


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


async def get_case_by_cnr(
    tracked_case_id: str,
    cnr: str,
    *,
    timeout: float = 30.0,
    retries: int = 3,
) -> dict:
    """
    Fetch a single case from eCourtsIndia by CNR.
    Persists raw JSON to case_snapshots before returning.
    Returns the parsed response dict.
    timeout/retries: pass shorter values for on-demand (UI-triggered) refreshes
    so they fail fast instead of blocking for 90+ seconds.
    """
    raw = await _request("GET", f"/case/cnr/{cnr}", timeout=timeout, retries=retries)
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


async def search_litigant(name: str, court: str | None = None) -> list[dict]:
    """
    Search eCourtsIndia for cases where the given person appears as a litigant.
    Returns a list of case dicts (each has at minimum cnr/case_type/court_name).
    Returns [] on any failure — callers must treat this as a soft error.
    Follows the same rate-limiting and retry rules as other methods in this class.
    """
    try:
        params: dict = {"name": name.strip()}
        if court:
            params["court"] = court.strip()
        raw = await _request("GET", "/litigant/search", params=params)
        cases = (
            raw.get("cases")
            or raw.get("data")
            or raw.get("results")
            or []
        )
        return cases if isinstance(cases, list) else []
    except Exception as exc:
        logger.warning("search_litigant failed for name=%s: %s", name, exc)
        return []


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


async def lookup_cnr(cnr: str) -> dict:
    """
    Direct CNR lookup — returns raw eCourtsIndia payload without persisting a snapshot.
    Use this for on-demand queries (e.g. the /cnr/lookup REST endpoint) where there is
    no associated tracked_case_id.  Raises on any network / auth / upstream error so
    callers can fall back to demo data.
    """
    return await _request("GET", f"/case/cnr/{cnr}")
