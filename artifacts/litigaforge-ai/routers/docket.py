"""Advocate DocketView profile and honest cause-list source status."""
import asyncio
import json
import time
from datetime import datetime, timedelta
from hashlib import sha256
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_user
from database import get_pool
from cache import cache_get, cache_key, cache_set
from services import court_data_client

router = APIRouter(prefix="/docket", tags=["docket"])
SOURCE_URL = "https://services.ecourts.gov.in/ecourtindia_v6/?p=cause_list/index"
_SCHEDULE_REFRESH_LOCK = asyncio.Lock()
_DOCKET_CACHE_TTL_SECONDS = 3 * 60 * 60
_LOADS_BY_USER: dict[int, list[float]] = {}
_LOAD_RATE_LIMIT = 5
_LOAD_RATE_WINDOW_SECONDS = 60


def _court_config(value: str) -> dict[str, str]:
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        parsed = {}
    if not isinstance(parsed, dict):
        parsed = {}
    return {
        key: str(parsed.get(key) or "")
        for key in ("state", "district_code", "complex_code", "court", "court_no")
    }


def _validate_courts(values: list[str]) -> list[dict[str, str]]:
    if not 1 <= len(values) <= 10:
        raise HTTPException(status_code=422, detail="Select between 1 and 10 courts.")
    courts = [_court_config(value) for value in values]
    if any(not all(court.values()) for court in courts):
        raise HTTPException(status_code=422, detail="Each court must include all court location fields.")
    if len({json.dumps(court, sort_keys=True) for court in courts}) != len(courts):
        raise HTTPException(status_code=422, detail="Duplicate courts are not allowed.")
    return courts


def _record_load(user_id: int) -> None:
    now = time.monotonic()
    recent = [stamp for stamp in _LOADS_BY_USER.get(user_id, []) if now - stamp < _LOAD_RATE_WINDOW_SECONDS]
    if len(recent) >= _LOAD_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many cause-list loads. Wait a minute and try again.")
    recent.append(now)
    _LOADS_BY_USER[user_id] = recent


def _court_cache_key(court: dict[str, str], day: str) -> str:
    identity = json.dumps(court, sort_keys=True, separators=(",", ":"))
    return cache_key("docket-cause-list-v1", sha256(identity.encode()).hexdigest(), day)


async def _get_court_day(court: dict[str, str], day: str) -> dict:
    key = _court_cache_key(court, day)
    cached = await cache_get(key)
    if cached is not None:
        if court_data_client.is_daily_spend_cap_reached():
            cached = {
                **cached,
                "daily_limit_reached": True,
                "message": "Daily refresh limit reached, showing last update.",
            }
        return cached
    base = {"date": day, "source_url": SOURCE_URL, "fetched_at": datetime.now(ZoneInfo("Asia/Kolkata")).isoformat()}
    dates = await court_data_client.available_cause_list_dates(
        state=court["state"], district_code=court["district_code"], court_complex_code=court["complex_code"],
        court=court["court"], court_no=court["court_no"],
    )
    available = dates.get("dates") or dates.get("availableDates") or []
    if day not in {str(item.get("date") if isinstance(item, dict) else item)[:10] for item in available}:
        result = {**base, "status": "no_sitting", "matters": []}
    else:
        matters: list[dict] = []
        offset = 0
        while True:
            page = await court_data_client.search_cause_list(
                date_value=day, state=court["state"], district_code=court["district_code"],
                court_complex_code=court["complex_code"], court=court["court"], court_no=court["court_no"],
                limit=200, offset=offset,
            )
            rows = page.get("results") or page.get("entries") or page.get("matters") or []
            matters.extend(row for row in rows if isinstance(row, dict))
            if len(rows) < 200:
                break
            offset += 200
        result = {**base, "status": "ok" if matters else "no_sitting", "matters": matters}
    await cache_set(key, result, ttl=_DOCKET_CACHE_TTL_SECONDS)
    return result


async def _ensure_table(conn):
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS docket_profiles (
            user_id INTEGER PRIMARY KEY REFERENCES users(id),
            cause_list_name TEXT NOT NULL,
            enrolment_number TEXT NOT NULL,
            court_ids TEXT[] NOT NULL DEFAULT '{}',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


def _advocate_only(user):
    if user.get("role") not in {"advocate", "lawyer"}:
        raise HTTPException(status_code=403, detail="DocketView is for advocates.")
    return user


class DocketProfileInput(BaseModel):
    cause_list_name: str = Field(default="", max_length=160)
    enrolment_number: str = Field(default="", max_length=80)
    court_ids: list[str] = Field(min_length=1, max_length=10)


class DocketOnboardingSearch(BaseModel):
    name_variants: list[str] = Field(min_length=1, max_length=5)
    states: list[str] = Field(default_factory=list, max_length=10)
    court_codes: list[str] = Field(default_factory=list, max_length=20)
    name_match_mode: str = Field(default="phrase", pattern="^(phrase|fuzzy)$")


class DocketImportCases(BaseModel):
    cnrs: list[str] = Field(min_length=1, max_length=100)


class DocketLoadInput(BaseModel):
    court_ids: list[str] = Field(min_length=1, max_length=10)


@router.get("/profile")
async def get_profile(user=Depends(require_user)):
    _advocate_only(user)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await _ensure_table(conn)
        row = await conn.fetchrow(
            "SELECT cause_list_name, enrolment_number, court_ids, updated_at FROM docket_profiles WHERE user_id=$1",
            int(user["id"]),
        )
        advocate = await conn.fetchrow(
            "SELECT name, bar_number FROM lawyers WHERE user_id=$1",
            int(user["id"]),
        )
        tracked = await conn.fetchval(
            "SELECT COUNT(*) FROM tracked_cases WHERE user_id=$1 AND is_active=true AND cnr IS NOT NULL",
            int(user["id"]),
        )
    return {
        "profile": dict(row) if row else None,
        "advocate_profile": dict(advocate) if advocate else None,
        "tracked_cases_count": int(tracked or 0),
    }


@router.put("/profile")
async def save_profile(payload: DocketProfileInput, user=Depends(require_user)):
    _advocate_only(user)
    _validate_courts(payload.court_ids)
    name = " ".join(payload.cause_list_name.split())
    enrolment = " ".join(payload.enrolment_number.split())
    pool = await get_pool()
    async with pool.acquire() as conn:
        await _ensure_table(conn)
        row = await conn.fetchrow("""
            INSERT INTO docket_profiles(user_id, cause_list_name, enrolment_number, court_ids)
            VALUES($1, $2, $3, $4)
            ON CONFLICT(user_id) DO UPDATE SET
                cause_list_name=EXCLUDED.cause_list_name,
                enrolment_number=EXCLUDED.enrolment_number,
                court_ids=EXCLUDED.court_ids,
                updated_at=NOW()
            RETURNING cause_list_name, enrolment_number, court_ids, updated_at
        """, int(user["id"]), name, enrolment, payload.court_ids)
    return {"profile": dict(row)}


@router.get("/courts")
async def court_structure(path: str = "states", user=Depends(require_user)):
    _advocate_only(user)
    try:
        return {"data": await court_data_client.get_court_structure(path)}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except court_data_client.CourtDataError as exc:
        raise HTTPException(status_code=503, detail=exc.user_message) from exc


@router.post("/onboarding/suggestions")
async def onboarding_suggestions(payload: DocketOnboardingSearch, user=Depends(require_user)):
    _advocate_only(user)
    names = list(dict.fromkeys(" ".join(name.split()) for name in payload.name_variants if name.strip()))
    if not names:
        raise HTTPException(status_code=422, detail="At least one advocate name is required.")
    court_configs = [_court_config(value) for value in payload.court_codes]
    court_codes = list(dict.fromkeys(item["court"] for item in court_configs if item["court"]))
    states = list(dict.fromkeys(item["state"] for item in court_configs if item["state"]))
    try:
        result = await court_data_client.search_cases(
            advocates=names,
            states=payload.states or states or None,
            court_codes=court_codes or None,
            name_match_mode=payload.name_match_mode,
            page=1,
            page_size=100,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except court_data_client.CourtDataError as exc:
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    return {
        "total": int(result.get("total_hits") or len(result.get("results") or [])),
        "suggestions": result.get("results") or [],
    }


@router.post("/onboarding/import")
async def import_confirmed_cases(payload: DocketImportCases, user=Depends(require_user)):
    """Import only CNRs explicitly selected by the advocate; refresh in the normal batch job."""
    _advocate_only(user)
    try:
        cnrs = list(dict.fromkeys(court_data_client.normalize_cnr(cnr) for cnr in payload.cnrs))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if len(cnrs) > 100:
        raise HTTPException(status_code=422, detail="Import at most 100 cases at a time.")
    pool = await get_pool()
    inserted: list[str] = []
    async with pool.acquire() as conn:
        async with conn.transaction():
            for cnr in cnrs:
                row = await conn.fetchrow(
                    """
                    INSERT INTO tracked_cases (user_id, cnr, case_type, is_active, tier_gated)
                    VALUES ($1, $2, 'Unknown', true, true)
                    ON CONFLICT (user_id, cnr) DO NOTHING
                    RETURNING cnr
                    """,
                    int(user["id"]), cnr,
                )
                if row:
                    inserted.append(cnr)
    return {
        "imported": inserted,
        "already_tracked": [cnr for cnr in cnrs if cnr not in inserted],
        "refresh": "queued_for_scheduled_batch",
    }


@router.get("/schedule")
async def get_schedule(user=Depends(require_user)):
    _advocate_only(user)
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    tomorrow = today + timedelta(days=1)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await _ensure_table(conn)
        profile = await conn.fetchrow("SELECT court_ids FROM docket_profiles WHERE user_id=$1", int(user["id"]))
    courts = _validate_courts(list(profile["court_ids"] or [])) if profile and profile["court_ids"] else []
    result = []
    for court in courts:
        today_cache = await cache_get(_court_cache_key(court, today.isoformat()))
        tomorrow_cache = await cache_get(_court_cache_key(court, tomorrow.isoformat()))
        if court_data_client.is_daily_spend_cap_reached():
            for cached in (today_cache, tomorrow_cache):
                if cached is not None:
                    cached.update({
                        "daily_limit_reached": True,
                        "message": "Daily refresh limit reached, showing last update.",
                    })
        result.append({
            "court": court,
            "today": today_cache or {"date": today.isoformat(), "status": "not_loaded", "matters": []},
            "tomorrow": tomorrow_cache or {"date": tomorrow.isoformat(), "status": "not_loaded", "matters": []},
        })
    return {"courts": result, "source_url": SOURCE_URL}


@router.post("/load")
async def load_cause_list(payload: DocketLoadInput, user=Depends(require_user)):
    _advocate_only(user)
    user_id = int(user["id"])
    _record_load(user_id)
    courts = _validate_courts(payload.court_ids)
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    result = []
    for court in courts:
        court_result = {"court": court}
        for name, day in (("today", today), ("tomorrow", today + timedelta(days=1))):
            try:
                court_result[name] = await _get_court_day(court, day.isoformat())
            except court_data_client.CourtDataError as exc:
                court_result[name] = {
                    "date": day.isoformat(), "status": "unavailable", "matters": [],
                    "fetched_at": datetime.now(ZoneInfo("Asia/Kolkata")).isoformat(),
                    "message": exc.user_message, "source_url": SOURCE_URL,
                }
        result.append(court_result)
    return {"courts": result, "source_url": SOURCE_URL}


async def refresh_docket_schedules(target_day: str | None = None) -> dict[str, int]:
    """Prewarm one date for every unique saved court."""
    if _SCHEDULE_REFRESH_LOCK.locked():
        return {"courts": 0, "errors": 0, "total_profiles": 0, "skipped": 1}
    async with _SCHEDULE_REFRESH_LOCK:
        pool = await get_pool()
        async with pool.acquire() as conn:
            profiles = await conn.fetch("SELECT court_ids FROM docket_profiles ORDER BY user_id")
        unique = {
            json.dumps(court, sort_keys=True): court
            for profile in profiles
            for court in (_court_config(str(value)) for value in (profile["court_ids"] or []))
            if all(court.values())
        }
        result = {"courts": 0, "errors": 0, "total_profiles": len(profiles), "skipped": 0}
        target_day = target_day or datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat()
        for court in unique.values():
            try:
                await _get_court_day(court, target_day)
            except Exception:
                result["errors"] += 1
            result["courts"] += 1
        return result
