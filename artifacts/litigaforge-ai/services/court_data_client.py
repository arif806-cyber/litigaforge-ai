"""Single source of truth for the eCourtsIndia Partner REST API."""
from __future__ import annotations

import asyncio
import copy
import hashlib
import json
import os
import re
import time
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import quote
from zoneinfo import ZoneInfo

import httpx

from database import execute as db_execute, get_pool
from logger import get_logger

logger = get_logger("litigaforge.court_data_client")

PARTNER_API_BASE = "https://webapi.ecourtsindia.com"
_API_BASE = PARTNER_API_BASE
_PARTNER_PREFIX = "/api/partner"
_CNR_RE = re.compile(r"^[A-Z]{4}\d{12}$")
_ORDER_FILENAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$")
_DEFAULT_TIMEOUT = 20.0
_GET_RETRIES = 2
_SINGLE_REFRESH_WAIT_SECONDS = 7
_BULK_REFRESH_WAIT_SECONDS = 30
_HTTP_TRANSPORT: httpx.AsyncBaseTransport | None = None
_CASE_CACHE: dict[str, tuple[float, dict]] = {}
_CASE_CACHE_TTL_SECONDS = 5 * 60
_AVAILABLE_DATE_CACHE: dict[tuple, tuple[float, dict]] = {}
_CNR_LISTING_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CAUSE_CACHE_TTL_SECONDS = 4 * 60 * 60
_AVAILABLE_DATE_TTL_SECONDS = 60 * 60
_CNR_LISTING_TTL_SECONDS = 4 * 60 * 60


def _endpoint_cost(method: str, path: str, json_body: dict | None) -> tuple[str, float]:
    lowered = path.lower()
    if "/causelist/search" in lowered:
        return "CAUSE_LIST", 3.0
    if "/bulk-refresh-status" in lowered:
        return "REFRESH_STATUS", 0.0
    if lowered.endswith("/case/bulk-refresh") or ("/case/" in lowered and lowered.endswith("/refresh")):
        return "CASE_REFRESH", 0.15 * max(1, len((json_body or {}).get("cnrs") or []))
    if re.search(r"/case/[a-z]{4}\d{12}$", lowered):
        return "CASE_DETAIL", 1.5
    if "/available-dates" in lowered or "/court-structure/" in lowered:
        return "COURT_DATA", 0.0
    # The dashboard supplied no tariff for other billable endpoints, so budget
    # them at the highest listed rate rather than letting them bypass the cap.
    return "OTHER_UNPRICED", 3.0


def _daily_cap_override() -> Decimal | None:
    raw = os.getenv("ECOURTS_DAILY_CAP_INR")
    if raw is None or not raw.strip():
        return None
    try:
        cap = Decimal(raw.strip())
    except InvalidOperation as exc:
        raise ValueError("ECOURTS_DAILY_CAP_INR must be a rupee amount.") from exc
    if not cap.is_finite() or not Decimal("0") <= cap <= Decimal("100000"):
        raise ValueError("Daily spend cap must be between ₹0 and ₹100,000.")
    return cap


async def _get_daily_cap(conn) -> Decimal:
    override = _daily_cap_override()
    if override is not None:
        return override
    value = await conn.fetchval(
        "SELECT daily_cap_inr FROM ecourts_api_settings WHERE id=1"
    )
    return Decimal(str(value if value is not None else 60))


async def set_daily_spend_cap_inr(value: float, *, conn=None) -> float:
    try:
        cap = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("Daily spend cap must be a rupee amount.") from exc
    if not cap.is_finite() or not Decimal("0") <= cap <= Decimal("100000"):
        raise ValueError("Daily spend cap must be between ₹0 and ₹100,000.")
    if conn is None:
        pool = await get_pool()
        async with pool.acquire() as conn:
            return await set_daily_spend_cap_inr(value, conn=conn)
    else:
        await conn.execute(
            """INSERT INTO ecourts_api_settings(id,daily_cap_inr)
               VALUES(1,$1)
               ON CONFLICT(id) DO UPDATE SET daily_cap_inr=EXCLUDED.daily_cap_inr,
                 updated_at=NOW()""",
            cap,
        )
    return float(cap)


async def _reserve_api_usage(
    method: str, path: str, json_body: dict | None, *, conn=None,
) -> dict[str, Any]:
    """Reserve one vendor attempt in shared PostgreSQL before the network call."""
    endpoint, cost = _endpoint_cost(method, path, json_body)
    now = datetime.now(ZoneInfo("Asia/Kolkata"))
    day = now.date()
    if conn is None:
        pool = await get_pool()
        async with pool.acquire() as acquired:
            return await _reserve_api_usage(method, path, json_body, conn=acquired)
    override = _daily_cap_override()
    async with conn.transaction():
        reserved = await conn.fetchrow(
            """WITH cap AS (
                 SELECT COALESCE($3::numeric,
                   (SELECT daily_cap_inr FROM ecourts_api_settings WHERE id=1),
                   60::numeric) AS amount
               ), reservation AS (
                 INSERT INTO ecourts_api_daily_spend(day_ist,call_count,estimated_inr)
                 SELECT $1,1,$2 FROM cap
                 WHERE 0 < cap.amount AND $2 <= cap.amount
                 ON CONFLICT(day_ist) DO UPDATE
                   SET call_count=ecourts_api_daily_spend.call_count+1,
                       estimated_inr=ecourts_api_daily_spend.estimated_inr+EXCLUDED.estimated_inr,
                       updated_at=NOW()
                   WHERE ecourts_api_daily_spend.estimated_inr < (SELECT amount FROM cap)
                     AND ecourts_api_daily_spend.estimated_inr+EXCLUDED.estimated_inr
                         <= (SELECT amount FROM cap)
                 RETURNING day_ist
               ) SELECT day_ist FROM reservation""",
            day, Decimal(str(cost)), override,
        )
        if not reserved:
            logger.warning("eCourtsIndia daily spend cap reached; blocked endpoint=%s", endpoint)
            raise CourtDataError(
                "Daily refresh limit reached, showing last update.",
                status_code=429, code="daily_spend_cap",
            )
        await conn.execute(
            """INSERT INTO ecourts_api_usage(day_ist,endpoint,call_count,estimated_inr)
               VALUES($1,$2,1,$3)
               ON CONFLICT(day_ist,endpoint) DO UPDATE
                 SET call_count=ecourts_api_usage.call_count+1,
                     estimated_inr=ecourts_api_usage.estimated_inr+EXCLUDED.estimated_inr,
                     updated_at=NOW()""",
            day, endpoint, Decimal(str(cost)),
        )
    return {"day": day, "endpoint": endpoint, "cost": Decimal(str(cost))}


async def _release_api_usage(reservation: dict[str, Any], *, conn=None) -> None:
    """Undo a reservation only when transport failed before connecting to vendor."""
    if conn is None:
        pool = await get_pool()
        async with pool.acquire() as acquired:
            await _release_api_usage(reservation, conn=acquired)
        return
    async with conn.transaction():
        await conn.execute(
            """UPDATE ecourts_api_daily_spend
               SET call_count=GREATEST(call_count-1,0),
                   estimated_inr=GREATEST(estimated_inr-$2,0),updated_at=NOW()
               WHERE day_ist=$1""",
            reservation["day"], reservation["cost"],
        )
        await conn.execute(
            """UPDATE ecourts_api_usage
               SET call_count=GREATEST(call_count-1,0),
                   estimated_inr=GREATEST(estimated_inr-$3,0),updated_at=NOW()
               WHERE day_ist=$1 AND endpoint=$2""",
            reservation["day"], reservation["endpoint"], reservation["cost"],
        )


async def is_daily_spend_cap_reached(*, conn=None) -> bool:
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    if conn is None:
        pool = await get_pool()
        async with pool.acquire() as acquired:
            return await is_daily_spend_cap_reached(conn=acquired)
    row = await conn.fetchrow(
        "SELECT estimated_inr FROM ecourts_api_daily_spend WHERE day_ist=$1", today
    )
    return Decimal(str(row["estimated_inr"] or 0)) >= await _get_daily_cap(conn)


async def get_api_usage_summary(*, conn=None) -> dict[str, Any]:
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    start = today.fromordinal(today.toordinal() - 29)
    if conn is None:
        pool = await get_pool()
        async with pool.acquire() as acquired:
            return await get_api_usage_summary(conn=acquired)
    rows = await conn.fetch(
        """SELECT day_ist,endpoint,call_count,estimated_inr
           FROM ecourts_api_usage WHERE day_ist >= $1
           ORDER BY day_ist DESC,endpoint""",
        start,
    )
    cap = float(await _get_daily_cap(conn))
    cap_source = "environment" if _daily_cap_override() is not None else "admin_setting"
    days: dict[str, dict[str, Any]] = {}
    by_endpoint: list[dict[str, Any]] = []
    today_endpoints: dict[str, dict[str, Any]] = {}
    for row in rows:
        day = row["day_ist"].isoformat()
        endpoint = row["endpoint"]
        stats = {
            "calls": int(row["call_count"]),
            "estimated_inr": float(row["estimated_inr"]),
        }
        record = days.setdefault(day, {"date": day, "calls": 0, "estimated_inr": 0.0, "endpoints": {}})
        record["calls"] += stats["calls"]
        record["estimated_inr"] = round(record["estimated_inr"] + stats["estimated_inr"], 2)
        record["endpoints"][endpoint] = stats
        by_endpoint.append({"date": day, "endpoint": endpoint, **stats})
        if day == today.isoformat():
            today_endpoints[endpoint] = stats
    today_record = days.get(today.isoformat(), {"calls": 0, "estimated_inr": 0.0})
    return {
        "days": list(days.values()),
        "last_30_days_by_endpoint": by_endpoint,
        "persistence": "postgresql",
        "cap_source": cap_source,
        "currency": "INR",
        "daily_cap_inr": cap,
        "today_spend_inr": today_record["estimated_inr"],
        "today_calls": today_record["calls"],
        "today_endpoints": today_endpoints,
    }


def _cache_case(cnr: str, raw: dict) -> None:
    if len(_CASE_CACHE) > 2_000:
        expired = [key for key, (until, _) in _CASE_CACHE.items() if until <= time.monotonic()]
        for key in expired:
            _CASE_CACHE.pop(key, None)
        if len(_CASE_CACHE) > 2_000:
            _CASE_CACHE.pop(next(iter(_CASE_CACHE)))
    _CASE_CACHE[cnr] = (time.monotonic() + _CASE_CACHE_TTL_SECONDS, copy.deepcopy(raw))

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
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.retry_after = retry_after
        self.retryable = retryable
        self.details = details or {}

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
    params: dict | list[tuple[str, str]] | None = None,
    retries: int | None = None,
    timeout: float = _DEFAULT_TIMEOUT,
    auth_required: bool = True,
) -> dict:
    """Call the documented Partner API. Paid POSTs are never retried."""
    if auth_required:
        require_configured()
    method = method.upper()
    retry_count = _GET_RETRIES if retries is None and method == "GET" else (retries or 0)
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if auth_required:
        headers["Authorization"] = f"Bearer {_next_key()}"
    url = f"{PARTNER_API_BASE.rstrip('/')}/{path.lstrip('/')}"

    for attempt in range(retry_count + 1):
        await _bucket.acquire()
        reservation = await _reserve_api_usage(method, path, json_body)
        try:
            async with httpx.AsyncClient(timeout=timeout, transport=_HTTP_TRANSPORT) as client:
                try:
                    resp = await client.request(
                        method, url,
                        headers=headers,
                        json=json_body,
                        params=params,
                    )
                except (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout):
                    await _release_api_usage(reservation)
                    if method == "GET" and attempt < retry_count:
                        await asyncio.sleep(min(2 ** attempt, 8))
                        continue
                    raise
            if resp.status_code >= 400:
                error = _provider_error(resp)
                if method == "GET" and error.retryable and attempt < retry_count:
                    delay = min(error.retry_after or 2 ** attempt, 8)
                    logger.warning(
                        "eCourts Partner GET failed status=%s path=%s attempt=%d/%d; retrying in %.1fs",
                        error.status_code, path, attempt + 1, retry_count + 1, delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error(
                    "eCourts Partner request failed status=%s code=%s provider_code=%s path=%s",
                    error.status_code, error.code, error.details.get("provider_code"), path,
                )
                raise error
            try:
                payload = resp.json()
            except (ValueError, json.JSONDecodeError) as exc:
                raise CourtDataError(
                    "eCourtsIndia returned an invalid JSON response.",
                    status_code=502, code="invalid_json",
                ) from exc
            if isinstance(payload, list) and "/court-structure/" in path:
                payload = {"data": {"items": payload}}
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
        except httpx.TimeoutException as exc:
            error = CourtDataError(
                "The eCourtsIndia request timed out.",
                status_code=504,
                code="timeout",
                retryable=True,
            )
            if method == "GET" and attempt < retry_count:
                delay = min(2 ** attempt, 8)
                logger.warning(
                    "eCourts Partner GET timed out path=%s attempt=%d/%d; retrying in %ds",
                    path, attempt + 1, retry_count + 1, delay,
                )
                await asyncio.sleep(delay)
                continue
            logger.error("eCourts Partner timeout path=%s", path)
            raise error from exc
        except httpx.TransportError as exc:
            error = CourtDataError(
                "Could not reach eCourtsIndia. Check network access and retry.",
                status_code=502,
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
    provider_code = re.sub(r"[^A-Za-z0-9_.:-]", "_", provider_code.strip())[:80]
    provider_message = body_error.get("message") if isinstance(body_error, dict) else None
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
    elif status == 404:
        message = "eCourtsIndia could not find the requested case or order (HTTP 404)."
    elif status == 409:
        message = (
            "eCourtsIndia reports a conflict for this request (HTTP 409). "
            "Review the case state before retrying."
        )
    elif status == 400:
        message = "eCourtsIndia rejected the request as invalid (HTTP 400)."
    else:
        detail = str(provider_message or "").strip()[:240]
        message = f"eCourtsIndia rejected the request (HTTP {status})."
        if detail:
            message += f" {detail}"
    # Keep stable application codes for client responses; provider codes are
    # retained only as sanitized server-side diagnostics.
    application_code = {400: "invalid_request", 404: "not_found"}.get(status)
    return CourtDataError(
        message,
        status_code=status,
        code=application_code or provider_code or f"http_{status}",
        retry_after=retry_after,
        retryable=(status == 429 or status >= 500),
        details={"upstream_status": status, "provider_code": provider_code or None},
    )


def _unwrap_data(payload: dict, endpoint: str) -> dict:
    data = payload.get("data")
    if not isinstance(data, dict):
        raise CourtDataError(
            f"eCourtsIndia returned an invalid response envelope for {endpoint}.",
            status_code=502,
            code="invalid_response_envelope",
        )
    return data


def _normalize_case_response(payload: dict, expected_cnr: str | None = None) -> dict:
    """Unwrap the Partner envelope and retain its data in the app's stable model."""
    data = _unwrap_data(payload, "case detail")
    case = data.get("courtCaseData")
    if not isinstance(case, dict):
        raise CourtDataError(
            "eCourtsIndia case detail did not contain courtCaseData.",
            status_code=502,
            code="invalid_case_data",
        )

    entity_info = data.get("entityInfo")
    entity_info = entity_info if isinstance(entity_info, dict) else {}
    raw_cnr = case.get("cnr") or entity_info.get("cnr")
    try:
        cnr = normalize_cnr(raw_cnr)
    except ValueError as exc:
        raise CourtDataError(
            "eCourtsIndia returned case data without a valid CNR.",
            status_code=502,
            code="invalid_case_data",
        ) from exc
    if expected_cnr and cnr != expected_cnr:
        raise CourtDataError(
            "eCourtsIndia returned a different case than the requested CNR.",
            status_code=502,
            code="cnr_mismatch",
        )

    descriptions = data.get("descriptions")
    descriptions = descriptions if isinstance(descriptions, dict) else {}
    enum_lookup = descriptions.get("enumLookup")
    enum_lookup = enum_lookup if isinstance(enum_lookup, dict) else {}
    court_names = enum_lookup.get("courtCode")
    court_names = court_names if isinstance(court_names, dict) else {}
    court_code = case.get("cnrCourtCode") or case.get("courtComplexCode")
    court_name = case.get("courtName") or court_names.get(str(court_code)) or ""

    raw_files = data.get("files")
    if isinstance(raw_files, dict):
        files = raw_files.get("files") or []
    elif isinstance(raw_files, list):
        files = raw_files
    else:
        files = []
    files = [item for item in files if isinstance(item, dict)]
    file_by_name: dict[str, dict] = {}
    for item in files:
        for field in ("orderUrl", "filename", "fileName", "pdfFile"):
            filename = item.get(field)
            if filename:
                file_by_name[str(filename).rsplit("/", 1)[-1].lower()] = item

    orders: list[dict] = []
    seen_order_urls: set[str] = set()
    for field in ("interimOrders", "judgmentOrders"):
        raw_orders = case.get(field) or []
        if not isinstance(raw_orders, list):
            continue
        for order in raw_orders:
            if not isinstance(order, dict):
                continue
            order_url = order.get("orderUrl")
            if not order_url:
                continue
            order_url = str(order_url)
            if order_url in seen_order_urls:
                continue
            seen_order_urls.add(order_url)
            file_data = file_by_name.get(order_url.lower())
            if file_data is None:
                # Partner docs specify pdfFile as CNR-prefixed while orderUrl is
                # the bare filename (for example, order-1.pdf).
                file_data = next(
                    (
                        item for filename, item in file_by_name.items()
                        if filename.endswith(order_url.lower())
                    ),
                    {},
                )
            text = (
                order.get("markdownContent")
                or order.get("order_text")
                or file_data.get("markdownContent")
                or ""
            )
            orders.append({
                **order,
                "order_id": order_url,
                "order_url": order_url,
                "order_date": order.get("orderDate"),
                "order_text": text,
            })

    petitioners = case.get("petitioners") or []
    respondents = case.get("respondents") or []
    petitioner_advocates = case.get("petitionerAdvocates") or []
    respondent_advocates = case.get("respondentAdvocates") or []
    history = case.get("historyOfCaseHearings") or []
    business_entries = case.get("businessOnDateEntries") or []
    business_by_date = {
        str(item.get("date")): item
        for item in business_entries
        if isinstance(item, dict) and item.get("date")
    } if isinstance(business_entries, list) else {}
    if isinstance(history, list) and history:
        hearings = []
        for item in history:
            if not isinstance(item, dict):
                continue
            business = business_by_date.get(str(item.get("hearingDate") or ""))
            if business is None:
                business = business_by_date.get(str(item.get("businessOnDate") or ""), {})
            hearings.append({
                **item,
                "business": business.get("business"),
                "nextPurpose": business.get("nextPurpose"),
                "nextHearingDate": business.get("nextHearingDate"),
            })
    else:
        hearings = business_entries if isinstance(business_entries, list) else []
    judges = case.get("judges") or []
    latest_hearing = next(
        (entry for entry in reversed(hearings) if isinstance(entry, dict)),
        {},
    ) if isinstance(hearings, list) else {}
    acts_and_sections = case.get("actsAndSections") or []

    normalized = dict(case)
    normalized.update({
        "cnr": cnr,
        "case_number": case.get("registrationNumber") or case.get("caseNumber") or cnr,
        "case_type": case.get("caseTypeRaw") or case.get("caseType") or "",
        # PostgreSQL's case_status column is text. Some upstream records return
        # a structured status value instead of the usual string; normalize it
        # here rather than allowing asyncpg to raise DataError during snapshot
        # persistence.
        "case_status": str(case.get("caseStatus") or ""),
        "case_stage": case.get("purpose") or "",
        "court_name": court_name,
        "district": case.get("district") or "",
        "state": case.get("state") or "",
        "filing_date": case.get("filingDate") or "",
        "registration_date": case.get("registrationDate") or "",
        "next_hearing_date": (
            case.get("nextHearingDate")
            or entity_info.get("nextDateOfHearing")
            or ""
        ),
        "last_hearing_date": case.get("lastHearingDate") or "",
        "judge_name": (
            (judges[0] if judges else None)
            or latest_hearing.get("judge")
            or ""
        ),
        "petitioner_name": ", ".join(str(item) for item in petitioners if item),
        "respondent_name": ", ".join(str(item) for item in respondents if item),
        "advocate_petitioner": ", ".join(
            str(item) for item in petitioner_advocates if item
        ),
        "advocate_respondent": ", ".join(
            str(item) for item in respondent_advocates if item
        ),
        "under_act": "; ".join(str(item) for item in acts_and_sections if item)
        if isinstance(acts_and_sections, list)
        else str(acts_and_sections or ""),
        "under_section": case.get("judicialSection") or "",
        "hearings": hearings if isinstance(hearings, list) else [],
        "order_count": case.get("orderCount") or 0,
        "orders": orders,
        "files": files,
        "entity_info": entity_info,
        "descriptions": descriptions,
        "last_updated": entity_info.get("dateModified") or "",
    })
    return normalized


def _safe_snapshot_date(value: Any) -> date | None:
    if not value:
        return None
    candidate = str(value)[:10]
    try:
        # asyncpg's DATE codec expects datetime.date, not an ISO string.
        return date.fromisoformat(candidate)
    except ValueError:
        return None


def normalize_snapshot_hearing_dates(
    case_status: Any,
    next_hearing_date: Any,
    raw_response: Any,
    *,
    today: date | None = None,
) -> tuple[str | None, str | None, str | None]:
    """Return (next hearing, last listed, disposal) dates without stale next dates."""
    if isinstance(raw_response, str):
        try:
            raw_response = json.loads(raw_response)
        except (TypeError, ValueError):
            raw_response = {}
    raw = raw_response if isinstance(raw_response, dict) else {}
    sources = [raw]
    for key in ("entity_info", "entityInfo", "caseInfo"):
        nested = raw.get(key)
        if isinstance(nested, dict):
            sources.append(nested)
    today = today or date.today()

    def as_iso(value: Any) -> tuple[str | None, date | None]:
        parsed = _safe_snapshot_date(value)
        return (parsed.isoformat(), parsed) if parsed else (None, None)

    next_iso, next_date = as_iso(next_hearing_date)
    disposal_keys = (
        "disposal_date", "dateOfDisposal", "date_of_disposal",
        "dateOfDecision", "decisionDate", "dateOfJudgment", "judgmentDate",
    )
    disposal_iso = next(
        (
            as_iso(source.get(key))[0]
            for source in sources
            for key in disposal_keys
            if as_iso(source.get(key))[0]
        ),
        None,
    )
    listed_candidates = [
        as_iso(source.get(key))
        for source in sources
        for key in (
            "last_hearing_date", "lastHearingDate", "last_listed_date",
            "lastListedDate", "lastDateOfHearing",
        )
    ]
    listed_candidates = [
        (iso, parsed) for iso, parsed in listed_candidates
        if iso and parsed and parsed <= today
    ]
    if next_iso and next_date and next_date < today:
        listed_candidates.append((next_iso, next_date))
        next_iso = None

    last_listed_iso = (
        max(listed_candidates, key=lambda item: item[1])[0]
        if listed_candidates else None
    )
    closed = any(
        marker in str(case_status or "").lower()
        for marker in ("dispos", "closed", "completed")
    )
    if closed:
        next_iso = None
    return next_iso, last_listed_iso, disposal_iso


async def _persist_snapshots(tracked_case_ids: list[str], raw: dict) -> None:
    """Persist valid data and mark refresh success in the same database transaction."""
    if not tracked_case_ids:
        return
    case_status = raw.get("case_status") or None
    next_hearing = _safe_snapshot_date(raw.get("next_hearing_date"))
    try:
        order_count = max(0, int(raw.get("order_count") or 0))
    except (TypeError, ValueError):
        order_count = 0
    court_name = str(raw.get("court_name") or "")
    case_type = str(raw.get("caseTypeRaw") or raw.get("caseType") or "")
    serialized = json.dumps(raw, ensure_ascii=False, default=str)

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            for tracked_case_id in tracked_case_ids:
                await conn.execute(
                    """
                    INSERT INTO case_snapshots
                        (tracked_case_id, raw_response, case_status,
                         next_hearing_date, order_count)
                    VALUES ($1::uuid, $2::jsonb, $3, $4::date, $5)
                    """,
                    tracked_case_id, serialized, case_status, next_hearing, order_count,
                )
                await conn.execute(
                    """
                    UPDATE tracked_cases
                    SET last_refreshed = now(),
                        refresh_status = 'succeeded',
                        refresh_error = NULL,
                        cnr_not_found_count = 0,
                        court_name = COALESCE(NULLIF($2, ''), court_name),
                        case_type = COALESCE(case_type, NULLIF($3, ''))
                    WHERE id = $1::uuid
                    """,
                    tracked_case_id, court_name, case_type,
                )
    logger.debug(
        "Persisted eCourts snapshot for %d tracked record(s), cnr=%s",
        len(tracked_case_ids), raw.get("cnr"),
    )


async def _persist_snapshot(tracked_case_id: str, raw: dict) -> None:
    await _persist_snapshots([tracked_case_id], raw)


async def _mark_refresh_failure(tracked_case_id: str, exc: Exception) -> None:
    is_not_found = isinstance(exc, CourtDataError) and exc.code == "not_found"
    if isinstance(exc, CourtDataError):
        message = (
            "eCourtsIndia could not find this CNR yet."
            if is_not_found
            else exc.user_message
        )
    elif isinstance(exc, ValueError):
        message = str(exc)
    else:
        message = (
            "eCourts could not refresh this case right now. Previously saved data "
            "is unchanged. Please retry shortly."
        )
    if isinstance(exc, CourtDataError):
        logger.error(
            "eCourts refresh failed: tracked_case_id=%s error_type=%s "
            "code=%s status=%s message=%s",
            tracked_case_id, type(exc).__name__, exc.code, exc.status_code,
            str(exc)[:500],
        )
    else:
        # Keep the actual parser/database exception in server logs to diagnose
        # failures such as asyncpg DataError; never return driver details to users.
        logger.exception(
            "eCourts refresh failed unexpectedly: tracked_case_id=%s "
            "error_type=%s message=%s",
            tracked_case_id, type(exc).__name__, str(exc)[:500],
        )
    try:
        if is_not_found:
            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE tracked_cases
                    SET cnr_not_found_count = cnr_not_found_count + 1,
                        refresh_status = CASE
                            WHEN cnr_not_found_count + 1 >= 2 THEN 'cnr_not_found'
                            ELSE 'failed'
                        END,
                        refresh_error = CASE
                            WHEN cnr_not_found_count + 1 >= 2
                                THEN 'CNR not found on eCourts — check the number'
                            ELSE $2
                        END
                    WHERE id = $1::uuid
                    """,
                    tracked_case_id, message[:500],
                )
        else:
            await db_execute(
                "UPDATE tracked_cases SET refresh_status = 'failed', refresh_error = $2 "
                "WHERE id = $1::uuid",
                tracked_case_id, message[:500],
            )
    except Exception as state_exc:
        logger.warning(
            "Could not persist eCourts failure state for tracked_case_id=%s (%s)",
            tracked_case_id, type(state_exc).__name__,
        )


async def _fetch_case_detail(
    cnr: str,
    *,
    timeout: float = _DEFAULT_TIMEOUT,
    retries: int | None = None,
) -> dict:
    payload = await _request(
        "GET",
        f"{_PARTNER_PREFIX}/case/{quote(cnr, safe='')}",
        timeout=timeout,
        retries=retries,
    )
    return _normalize_case_response(payload, expected_cnr=cnr)


async def _queue_single_refresh(cnr: str, *, timeout: float = _DEFAULT_TIMEOUT) -> None:
    """Queue one paid refresh once, then follow the documented detail-fetch workflow."""
    payload = await _request(
        "POST",
        f"{_PARTNER_PREFIX}/case/{quote(cnr, safe='')}/refresh",
        timeout=timeout,
        retries=0,
    )
    data = _unwrap_data(payload, "single-case refresh")
    status = str(data.get("status") or "").upper()
    if status not in {"QUEUED", "REFRESHED", "COMPLETED", "SUCCESS"}:
        raise CourtDataError(
            "eCourtsIndia did not confirm the single-case refresh request.",
            status_code=502,
            code="refresh_not_accepted",
        )
    if status == "QUEUED":
        await asyncio.sleep(_SINGLE_REFRESH_WAIT_SECONDS)


async def get_case_by_cnr(
    tracked_case_id: str,
    cnr: str,
    *,
    timeout: float = 30.0,
    retries: int = 3,
) -> dict:
    """
    Queue one documented single-case refresh, fetch the detail envelope, and persist.
    The paid POST is never retried; only the subsequent idempotent GET may retry.
    """
    try:
        cleaned = normalize_cnr(cnr)
        await _queue_single_refresh(cleaned, timeout=timeout)
        raw = await _fetch_case_detail(cleaned, timeout=timeout, retries=retries)
        await _persist_snapshot(tracked_case_id, raw)
        _cache_case(cleaned, raw)
        return raw
    except Exception as exc:
        await _mark_refresh_failure(tracked_case_id, exc)
        raise


async def get_case_orders(cnr: str) -> list[dict]:
    """Read supported order lists from the documented case-detail response."""
    raw = await lookup_cnr(cnr)
    return raw.get("orders") or []


def _order_path(cnr: str, filename: str, kind: str) -> str:
    cleaned_cnr = normalize_cnr(cnr)
    cleaned_filename = str(filename or "").strip()
    if not _ORDER_FILENAME_RE.fullmatch(cleaned_filename):
        raise ValueError("Invalid eCourts order filename.")
    if kind not in {"order", "order-ai", "order-md"}:
        raise ValueError("Unsupported eCourts order endpoint.")
    return (
        f"{_PARTNER_PREFIX}/case/{quote(cleaned_cnr, safe='')}/"
        f"{kind}/{quote(cleaned_filename, safe='')}"
    )


async def get_order_metadata(cnr: str, filename: str) -> dict:
    """Fetch documented order download metadata for a filename from case detail."""
    payload = await _request("GET", _order_path(cnr, filename, "order"))
    return _unwrap_data(payload, "order metadata")


async def get_order_ai(cnr: str, filename: str) -> dict:
    """Fetch on-demand order analysis, retrying null analysis as the docs direct."""
    path = _order_path(cnr, filename, "order-ai")
    for attempt in range(4):
        payload = await _request(
            "GET",
            path,
            timeout=90.0,
            retries=0,
        )
        data = _unwrap_data(payload, "order AI")
        if data.get("aiAnalysis") is not None or attempt == 3:
            return data
        await asyncio.sleep(15)
    raise CourtDataError(
        "eCourtsIndia did not return order analysis after retries.",
        status_code=502,
        code="order_analysis_unavailable",
    )


async def get_order_markdown(cnr: str, filename: str) -> dict:
    """Fetch the documented markdown/PDF conversion endpoint without retrying it."""
    payload = await _request(
        "GET",
        _order_path(cnr, filename, "order-md"),
        timeout=300.0,
        retries=0,
    )
    return _unwrap_data(payload, "order markdown")


async def get_order_text(cnr: str, order_id: str) -> str | None:
    """Read the full order markdown already included in supported case detail."""
    cleaned_cnr = normalize_cnr(cnr)
    cleaned_filename = str(order_id or "").strip().lower()
    raw = await lookup_cnr(cleaned_cnr)
    for order in raw.get("orders") or []:
        if str(order.get("order_id") or "").lower() == cleaned_filename:
            text = order.get("order_text")
            return str(text).strip() if text else None
    return None


def _normalize_search_hit(item: dict) -> dict:
    petitioners = item.get("petitioners") or []
    respondents = item.get("respondents") or []
    title = " vs ".join(
        part for part in (
            ", ".join(map(str, petitioners)) if isinstance(petitioners, list) else str(petitioners),
            ", ".join(map(str, respondents)) if isinstance(respondents, list) else str(respondents),
        ) if part
    )
    return {
        **item,
        "cnr": item.get("cnr") or "",
        "case_type": item.get("caseTypeRaw") or item.get("caseType") or "",
        "case_status": item.get("caseStatus") or "",
        "case_number": item.get("registrationNumber") or item.get("cnr") or "",
        "court_name": item.get("courtName") or item.get("courtCode") or "",
        "next_hearing_date": item.get("nextHearingDate") or "",
        "filing_date": item.get("filingDate") or "",
        "petitioner_name": ", ".join(map(str, petitioners)) if isinstance(petitioners, list) else str(petitioners or ""),
        "respondent_name": ", ".join(map(str, respondents)) if isinstance(respondents, list) else str(respondents or ""),
        "title": title,
    }


async def search_cases(
    *,
    query: str | None = None,
    litigants: str | None = None,
    petitioners: str | None = None,
    respondents: str | None = None,
    advocates: str | list[str] | None = None,
    judges: str | None = None,
    court_codes: list[str] | None = None,
    states: list[str] | None = None,
    case_types: list[str] | None = None,
    case_statuses: list[str] | None = None,
    filing_date_from: str | None = None,
    filing_date_to: str | None = None,
    name_match_mode: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Search through the documented /api/partner/search contract."""
    if page < 1 or not 1 <= page_size <= 100:
        raise ValueError("Search page must be positive and page_size must be 1-100.")
    params: dict[str, Any] = {"page": page, "pageSize": page_size}
    for key, value in (
        ("query", query),
        ("litigants", litigants),
        ("petitioners", petitioners),
        ("respondents", respondents),
        ("judges", judges),
        ("filingDateFrom", filing_date_from),
        ("filingDateTo", filing_date_to),
        ("nameMatchMode", name_match_mode),
    ):
        if value and str(value).strip():
            params[key] = str(value).strip()
    if isinstance(advocates, list):
        clean_advocates = [str(value).strip() for value in advocates if str(value).strip()]
        if clean_advocates:
            params["advocates"] = clean_advocates
    elif advocates and advocates.strip():
        params["advocates"] = advocates.strip()
    for key, values in (
        ("courtCodes", court_codes),
        ("states", states),
        ("caseTypes", case_types),
        ("caseStatuses", case_statuses),
    ):
        if values:
            params[key] = [str(value).strip() for value in values if str(value).strip()]
    if not any(key in params for key in (
        "query", "litigants", "petitioners", "respondents",
        "advocates", "judges",
    )):
        raise ValueError("At least one eCourts search term is required.")

    payload = await _request("GET", f"{_PARTNER_PREFIX}/search", params=params)
    data = _unwrap_data(payload, "case search")
    results = data.get("results")
    if not isinstance(results, list) or any(not isinstance(item, dict) for item in results):
        raise CourtDataError(
            "eCourtsIndia case search returned an invalid results list.",
            status_code=502,
            code="invalid_search_response",
        )
    return {
        **data,
        "results": [_normalize_search_hit(item) for item in results],
        "total_hits": data.get("totalHits", 0),
        "page_size": data.get("pageSize", page_size),
        "total_pages": data.get("totalPages", 0),
        "has_next_page": data.get("hasNextPage", False),
    }


async def search_litigant(name: str, court: str | None = None) -> list[dict]:
    """Search the supported Partner API using its documented litigants parameter."""
    params: dict[str, Any] = {
        "litigants": name.strip(),
        "page_size": 100,
    }
    # Existing callers pass court_name. Only send courtCodes when it is already a
    # code; court display names are not valid Partner API filters.
    if court and re.fullmatch(r"(?=.*\d)[A-Z0-9]{4,12}", court.strip().upper()):
        params["court_codes"] = [court.strip().upper()]
    result = await search_cases(**params)
    return result["results"]


async def _wait_for_refresh_status(cnrs: list[str], timeout_seconds: float = 300.0) -> None:
    """Poll the free bulk status endpoint rather than paying for duplicate refreshes."""
    timeout_seconds = min(timeout_seconds, 300.0)
    deadline = time.monotonic() + timeout_seconds
    pending = set(cnrs)
    poll_count = 0
    while pending and time.monotonic() < deadline:
        try:
            payload = await _request(
                "POST",
                f"{_PARTNER_PREFIX}/case/bulk-refresh-status",
                json_body={"cnrs": sorted(pending)},
                retries=0,
            )
        except CourtDataError as exc:
            if exc.status_code == 429 and exc.retry_after is not None:
                await asyncio.sleep(min(exc.retry_after, max(0.1, deadline - time.monotonic())))
                continue
            raise
        data = _unwrap_data(payload, "bulk refresh status")
        queued = data.get("queued")
        if isinstance(queued, list):
            failures = data.get("failed") or data.get("invalid") or []
            if failures:
                raise CourtDataError(
                    "eCourtsIndia could not refresh one or more requested cases.",
                    status_code=502, code="refresh_failed",
                )
            pending = {normalize_cnr(value) for value in queued}
        else:
            entries = data.get("results") or data.get("cases") or data.get("statuses")
            if not isinstance(entries, list):
                raise CourtDataError(
                    "eCourtsIndia returned an invalid bulk refresh status.",
                    status_code=502, code="invalid_refresh_status",
                )
            pending = set()
            seen: set[str] = set()
            for item in entries:
                if not isinstance(item, dict):
                    continue
                cnr = normalize_cnr(item.get("cnr") or "")
                seen.add(cnr)
                status = str(item.get("status") or item.get("refreshStatus") or "").lower()
                if status in {"queued", "pending", "running", "processing", "in_progress"}:
                    pending.add(cnr)
                elif status in {"failed", "error", "invalid"}:
                    raise CourtDataError(
                        "eCourtsIndia could not refresh one or more requested cases.",
                        status_code=502, code="refresh_failed",
                    )
                elif status not in {"refreshed", "completed", "complete", "success", "succeeded"}:
                    raise CourtDataError(
                        "eCourtsIndia returned an unknown case refresh status.",
                        status_code=502, code="invalid_refresh_status",
                    )
            if not pending and not set(cnrs).issubset(seen):
                raise CourtDataError(
                    "eCourtsIndia omitted one or more CNRs from refresh status.",
                    status_code=502, code="missing_refresh_status",
                )
        if pending:
            poll_count += 1
            delay = (10.0, 30.0, 60.0)[min(poll_count - 1, 2)]
            await asyncio.sleep(min(delay, max(0.1, deadline - time.monotonic())))
    if pending:
        raise CourtDataError(
            "eCourtsIndia case refresh is still processing; retry the scheduled refresh later.",
            status_code=504, code="refresh_status_timeout", retryable=True,
        )


async def bulk_refresh(cases: list[dict]) -> dict[str, dict]:
    """
    Queue partner refreshes (single endpoint for one CNR, bulk endpoint for 2-50),
    wait per contract, fetch details, then persist a snapshot for every tracker.
    """
    by_cnr: dict[str, list[str]] = defaultdict(list)
    for item in cases:
        tracked_case_id = str(item["tracked_case_id"])
        try:
            cleaned = normalize_cnr(item.get("cnr"))
            by_cnr[cleaned].append(tracked_case_id)
        except ValueError as exc:
            await _mark_refresh_failure(tracked_case_id, exc)

    results: dict[str, dict] = {}
    unique_cnrs = list(by_cnr)
    for start in range(0, len(unique_cnrs), 50):
        batch = unique_cnrs[start : start + 50]
        eligible: list[str] = []
        queued: set[str] = set()
        try:
            if len(batch) == 1:
                cnr = batch[0]
                payload = await _request(
                    "POST",
                    f"{_PARTNER_PREFIX}/case/{quote(cnr, safe='')}/refresh",
                    retries=0,
                )
                data = _unwrap_data(payload, "single-case refresh")
                status = str(data.get("status") or "").upper()
                if status not in {"QUEUED", "REFRESHED", "COMPLETED", "SUCCESS"}:
                    raise CourtDataError(
                        "eCourtsIndia did not confirm the single-case refresh request.",
                        status_code=502,
                        code="refresh_not_accepted",
                    )
                eligible = [cnr]
                if status == "QUEUED":
                    queued.add(cnr)
            else:
                payload = await _request(
                    "POST",
                    f"{_PARTNER_PREFIX}/case/bulk-refresh",
                    json_body={"cnrs": batch},
                    retries=0,
                )
                data = _unwrap_data(payload, "bulk refresh")
                status_lists: dict[str, set[str]] = {}
                for field in ("refreshed", "queued", "invalid"):
                    values = data.get(field)
                    if not isinstance(values, list):
                        raise CourtDataError(
                            "eCourtsIndia bulk refresh returned an invalid status list.",
                            status_code=502,
                            code="invalid_bulk_response",
                        )
                    status_lists[field] = set()
                    for value in values:
                        try:
                            status_lists[field].add(normalize_cnr(value))
                        except ValueError:
                            raise CourtDataError(
                                "eCourtsIndia bulk refresh returned an invalid CNR.",
                                status_code=502,
                                code="invalid_bulk_response",
                            )
                queued = status_lists["queued"]
                for cnr in batch:
                    if cnr in status_lists["invalid"]:
                        error = CourtDataError(
                            "eCourtsIndia rejected this CNR during bulk refresh.",
                            status_code=400,
                            code="invalid_cnr",
                        )
                        for tracked_case_id in by_cnr[cnr]:
                            await _mark_refresh_failure(tracked_case_id, error)
                    elif cnr in status_lists["refreshed"] or cnr in queued:
                        eligible.append(cnr)
                    else:
                        error = CourtDataError(
                            "eCourtsIndia did not return a refresh status for this CNR.",
                            status_code=502,
                            code="missing_bulk_status",
                        )
                        for tracked_case_id in by_cnr[cnr]:
                            await _mark_refresh_failure(tracked_case_id, error)

            if queued:
                await _wait_for_refresh_status(batch)
        except Exception as exc:
            logger.warning(
                "eCourts refresh request failed for batch_size=%d (%s)",
                len(batch), type(exc).__name__,
            )
            for cnr in batch:
                for tracked_case_id in by_cnr[cnr]:
                    await _mark_refresh_failure(tracked_case_id, exc)
            continue

        for cnr in eligible:
            try:
                raw = await _fetch_case_detail(cnr)
                await _persist_snapshots(by_cnr[cnr], raw)
                _cache_case(cnr, raw)
                results[cnr] = raw
            except Exception as exc:
                logger.warning(
                    "eCourts detail fetch/persist failed for cnr=%s (%s)",
                    cnr, type(exc).__name__,
                )
                for tracked_case_id in by_cnr[cnr]:
                    await _mark_refresh_failure(tracked_case_id, exc)
    return results


async def lookup_cnr(cnr: str) -> dict:
    """Fetch and normalize case detail without persisting a tracked-case snapshot."""
    cleaned = normalize_cnr(cnr)
    require_configured()
    cached = _CASE_CACHE.get(cleaned)
    if cached and cached[0] > time.monotonic():
        return copy.deepcopy(cached[1])
    raw = await _fetch_case_detail(cleaned)
    _cache_case(cleaned, raw)
    return copy.deepcopy(raw)


async def search_cause_list(
    *,
    advocate: str | None = None,
    date_value: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    state: str | None = None,
    district_code: str | None = None,
    court_complex_code: str | None = None,
    court: str | None = None,
    court_no: str | None = None,
    list_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """Fetch a metered cause-list page through the official partner endpoint."""
    if not 1 <= limit <= 200 or offset < 0:
        raise ValueError("Cause-list limit must be 1-200 and offset must be non-negative.")
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    for key, value in (
        ("advocate", advocate), ("date", date_value),
        ("startDate", start_date), ("endDate", end_date),
        ("state", state), ("districtCode", district_code),
        ("courtComplexCode", court_complex_code), ("court", court),
        ("courtNo", court_no), ("listType", list_type),
    ):
        if value and str(value).strip():
            params[key] = str(value).strip()
    if not any(key in params for key in (
        "advocate", "date", "startDate", "endDate", "state",
        "districtCode", "courtComplexCode", "court", "courtNo",
    )):
        raise ValueError("At least one cause-list filter is required.")
    cache_key = hashlib.sha256(
        json.dumps(params, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    pool = await get_pool()
    async with pool.acquire() as conn:
        cached = await conn.fetchrow(
            """SELECT payload FROM ecourts_cause_list_cache
               WHERE cache_key=$1 AND expires_at>NOW()""",
            cache_key,
        )
    if cached:
        value = cached["payload"]
        return copy.deepcopy(json.loads(value) if isinstance(value, str) else dict(value))
    payload = await _request(
        "GET", f"{_PARTNER_PREFIX}/causelist/search", params=params,
    )
    data = _unwrap_data(payload, "cause-list search")
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO ecourts_cause_list_cache(cache_key,payload,expires_at)
               VALUES($1,$2::jsonb,NOW()+($3 * INTERVAL '1 second'))
               ON CONFLICT(cache_key) DO UPDATE SET payload=EXCLUDED.payload,
                 expires_at=EXCLUDED.expires_at""",
            cache_key, json.dumps(data), _CAUSE_CACHE_TTL_SECONDS,
        )
    return data


async def available_cause_list_dates(
    *,
    state: str | None = None,
    district_code: str | None = None,
    court_complex_code: str | None = None,
    court: str | None = None,
    court_no: str | None = None,
) -> dict:
    """Read free-but-authenticated dates with a published cause list."""
    params = {
        key: value for key, value in (
            ("state", state), ("districtCode", district_code),
            ("courtComplexCode", court_complex_code), ("court", court),
            ("courtNo", court_no),
        ) if value and str(value).strip()
    }
    if not params:
        raise ValueError("A court location is required to check available dates.")
    cache_key = tuple(sorted((key, str(value)) for key, value in params.items()))
    cached = _AVAILABLE_DATE_CACHE.get(cache_key)
    if cached and cached[0] > time.monotonic():
        return copy.deepcopy(cached[1])
    payload = await _request(
        "GET", f"{_PARTNER_PREFIX}/causelist/available-dates", params=params,
    )
    data = _unwrap_data(payload, "cause-list available dates")
    _AVAILABLE_DATE_CACHE[cache_key] = (time.monotonic() + _AVAILABLE_DATE_TTL_SECONDS, copy.deepcopy(data))
    return data


async def get_court_structure(path: str = "states") -> Any:
    """Fetch public court hierarchy data; restrict paths to documented hierarchy segments."""
    parts = [part for part in str(path or "").strip("/").split("/") if part]
    if not parts or parts[0] != "states" or len(parts) > 7:
        raise ValueError("Invalid court-structure path.")
    if any(not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", part) for part in parts):
        raise ValueError("Invalid court-structure path.")
    payload = await _request(
        "GET", f"{_PARTNER_PREFIX}/causelist/court-structure/" + "/".join(parts),
    )
    return _unwrap_data(payload, "court structure")


async def cause_list_cnrs_batch(cnrs: list[str]) -> dict:
    """Check up to 100 CNRs for upcoming listings in one non-retried partner call."""
    cleaned = list(dict.fromkeys(normalize_cnr(cnr) for cnr in cnrs))
    if not cleaned or len(cleaned) > 100:
        raise ValueError("CNR batch must contain 1-100 unique valid CNRs.")
    payload = await _request(
        "POST",
        f"{_PARTNER_PREFIX}/causelist/cnr/batch",
        json_body={"cnrs": cleaned},
        retries=0,
    )
    return _unwrap_data(payload, "cause-list CNR batch")


async def cause_list_cnrs_cached(cnrs: list[str]) -> dict:
    """Share per-CNR listing checks across advocates and bill only for cache misses."""
    cleaned = list(dict.fromkeys(normalize_cnr(cnr) for cnr in cnrs))
    now = time.monotonic()
    missing = [
        cnr for cnr in cleaned
        if cnr not in _CNR_LISTING_CACHE or _CNR_LISTING_CACHE[cnr][0] <= now
    ]
    for start in range(0, len(missing), 100):
        batch = missing[start:start + 100]
        data = await cause_list_cnrs_batch(batch)
        entries = data.get("results") or data.get("cases") or []
        by_cnr: dict[str, list[dict]] = defaultdict(list)
        for entry in entries:
            if isinstance(entry, dict) and entry.get("cnr"):
                by_cnr[normalize_cnr(entry["cnr"])].append(entry)
        expires = time.monotonic() + _CNR_LISTING_TTL_SECONDS
        for cnr in batch:
            _CNR_LISTING_CACHE[cnr] = (expires, by_cnr.get(cnr, []))
    merged = [
        entry
        for cnr in cleaned
        for entry in _CNR_LISTING_CACHE.get(cnr, (0, []))[1]
    ]
    return {"results": copy.deepcopy(merged)}
