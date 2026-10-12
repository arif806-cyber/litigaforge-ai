"""Advocate DocketView profile and honest cause-list source status."""
import asyncio
import time
from contextvars import ContextVar
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_user
from database import get_pool
from services import court_data_client

router = APIRouter(prefix="/docket", tags=["docket"])
SOURCE_URL = "https://services.ecourts.gov.in/ecourtindia_v6/?p=cause_list/index"
_SCHEDULE_CACHE: dict[tuple[int, str], tuple[float, dict]] = {}
_SCHEDULE_TTL_SECONDS = 15 * 60
_SCHEDULE_REFRESHING: ContextVar[bool] = ContextVar("docket_schedule_refreshing", default=False)
_SCHEDULE_REFRESH_LOCK = asyncio.Lock()


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
    cause_list_name: str = Field(min_length=2, max_length=160)
    enrolment_number: str = Field(min_length=2, max_length=80)
    court_ids: list[str] = Field(min_length=1, max_length=20)


class DocketOnboardingSearch(BaseModel):
    name_variants: list[str] = Field(min_length=1, max_length=5)
    states: list[str] = Field(default_factory=list, max_length=10)
    court_codes: list[str] = Field(default_factory=list, max_length=20)
    name_match_mode: str = Field(default="phrase", pattern="^(phrase|fuzzy)$")


class DocketImportCases(BaseModel):
    cnrs: list[str] = Field(min_length=1, max_length=100)


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
    return {"profile": dict(row) if row else None}


@router.put("/profile")
async def save_profile(payload: DocketProfileInput, user=Depends(require_user)):
    _advocate_only(user)
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
    for key in [key for key in _SCHEDULE_CACHE if key[0] == int(user["id"])]:
        _SCHEDULE_CACHE.pop(key, None)
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
    try:
        result = await court_data_client.search_cases(
            advocates=names,
            states=payload.states or None,
            court_codes=payload.court_codes or None,
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
    cache_key = (int(user["id"]), f"{today.isoformat()}:{tomorrow.isoformat()}")
    cached = _SCHEDULE_CACHE.get(cache_key)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    if not _SCHEDULE_REFRESHING.get():
        return {
            "today": {"date": today.isoformat(), "matters": [], "published": False},
            "tomorrow": {"date": tomorrow.isoformat(), "matters": [], "published": False},
            "source_url": SOURCE_URL, "fetched_at": None, "configured_courts": [],
            "source_status": "scheduled_refresh_pending",
            "message": "Cause-list results update on the scheduled eCourtsIndia refresh; no request is made when this page opens.",
        }
    pool = await get_pool()
    async with pool.acquire() as conn:
        await _ensure_table(conn)
        profile = await conn.fetchrow(
            "SELECT cause_list_name, court_ids FROM docket_profiles WHERE user_id=$1", int(user["id"])
        )
        tracked_rows = await conn.fetch(
            "SELECT DISTINCT cnr FROM tracked_cases WHERE user_id=$1 AND is_active=true AND cnr IS NOT NULL",
            int(user["id"]),
        )
    if not profile:
        return {
            "today": {"date": today.isoformat(), "matters": [], "published": False},
            "tomorrow": {"date": tomorrow.isoformat(), "matters": [], "published": False},
            "source_url": SOURCE_URL, "fetched_at": None, "configured_courts": [],
            "source_status": "profile_required", "message": "Complete your advocate profile to check cause lists.",
        }
    courts = [str(value) for value in (profile["court_ids"] or [])]
    tracked_cnrs = list(dict.fromkeys(str(row["cnr"]) for row in tracked_rows))

    async def day_results(day):
        matters: list[dict] = []
        published = False
        for court_code in courts:
            dates = await court_data_client.available_cause_list_dates(court=court_code)
            available = dates.get("dates") or dates.get("availableDates") or []
            available_values = {
                str(item.get("date") if isinstance(item, dict) else item)[:10]
                for item in available
            }
            if day.isoformat() not in available_values:
                continue
            published = True
            offset = 0
            while True:
                page = await court_data_client.search_cause_list(
                    advocate=profile["cause_list_name"], date_value=day.isoformat(),
                    court=court_code, limit=200, offset=offset,
                )
                rows = page.get("results") or page.get("entries") or page.get("matters") or []
                matters.extend(row for row in rows if isinstance(row, dict))
                if len(rows) < 200:
                    break
                offset += 200
        return {"date": day.isoformat(), "matters": matters, "published": published}

    try:
        today_data, tomorrow_data = await day_results(today), await day_results(tomorrow)
        for offset in range(0, len(tracked_cnrs), 100):
            batch = await court_data_client.cause_list_cnrs_cached(tracked_cnrs[offset:offset + 100])
            entries = batch.get("results") or batch.get("cases") or []
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                cnr = str(entry.get("cnr") or "").upper()
                hearing_date = str(entry.get("date") or entry.get("hearingDate") or entry.get("nextHearingDate") or "")[:10]
                target = today_data if hearing_date == today.isoformat() else tomorrow_data if hearing_date == tomorrow.isoformat() else None
                if target and not any(str(item.get("cnr") or "").upper() == cnr for item in target["matters"]):
                    target["matters"].append(entry)
        result = {
            "today": today_data, "tomorrow": tomorrow_data, "source_url": SOURCE_URL,
            "fetched_at": datetime.now(ZoneInfo("Asia/Kolkata")).isoformat(),
            "configured_courts": courts, "source_status": "connected",
            "message": "Cause lists are fetched from eCourtsIndia Partner API.",
        }
        _SCHEDULE_CACHE[cache_key] = (time.monotonic() + _SCHEDULE_TTL_SECONDS, result)
        return result
    except court_data_client.CourtDataError as exc:
        return {
            "today": {"date": today.isoformat(), "matters": [], "published": False},
            "tomorrow": {"date": tomorrow.isoformat(), "matters": [], "published": False},
            "source_url": SOURCE_URL, "fetched_at": None, "configured_courts": courts,
            "source_status": "upstream_error", "message": exc.user_message,
        }


async def refresh_docket_schedules() -> dict[str, int]:
    """Scheduled refresh for all configured advocate profiles; page views never call the vendor."""
    if _SCHEDULE_REFRESH_LOCK.locked():
        return {"profiles": 0, "errors": 0}
    async with _SCHEDULE_REFRESH_LOCK:
        pool = await get_pool()
        async with pool.acquire() as conn:
            profiles = await conn.fetch("SELECT user_id FROM docket_profiles ORDER BY user_id")
        result = {"profiles": 0, "errors": 0}
        refresh_token = _SCHEDULE_REFRESHING.set(True)
        try:
            for profile in profiles:
                user_id = int(profile["user_id"])
                for key in [key for key in _SCHEDULE_CACHE if key[0] == user_id]:
                    _SCHEDULE_CACHE.pop(key, None)
                try:
                    await get_schedule({"id": user_id, "role": "advocate"})
                    result["profiles"] += 1
                except Exception:
                    result["errors"] += 1
        finally:
            _SCHEDULE_REFRESHING.reset(refresh_token)
        return result
