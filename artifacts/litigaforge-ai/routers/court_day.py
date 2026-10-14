"""Court Day: an advocate's day in court.

Everything here is built from data the advocate already has in LitigaForge:
their own cases, the cause lists they have loaded (cached, no new vendor
calls), the latest stored case snapshot, and board positions shared by other
verified advocates in the same court hall.

Deliberately NOT used: court live streams (prohibited by the courts'
live-streaming rules) or any scraping of court display boards.
"""
from __future__ import annotations

import json
import re
import time
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_user
from database import get_pool

router = APIRouter(prefix="/court-day", tags=["court-day"])

IST = ZoneInfo("Asia/Kolkata")
BOARD_FRESH_MINUTES = 20          # after this the board is shown as "last known"
BOARD_VISIBLE_HOURS = 3           # after this the board is not shown at all
CONFIRM_WINDOW_MINUTES = 10       # a surprising value needs a second advocate within this window
MAX_FORWARD_JUMP = 30             # accepted without confirmation if within [current-2, current+30]
MAX_BACKWARD_STEP = 2
UPDATE_COOLDOWN_SECONDS = 45      # one update per advocate per court per 45 s
MAX_ITEM = 2000

_SENSITIVE = re.compile(
    r"famil|matrimon|divorce|maintenance|custody|guardian|adoption|domestic\s+violence|dowry|"
    r"pocso|rape|sexual|outrag|\b(?:354|376|509)\b|juvenile|child",
    re.I,
)
_LAST_UPDATE: dict[tuple[int, str], float] = {}


# ── helpers ───────────────────────────────────────────────────────────────────
def _today() -> date:
    return datetime.now(IST).date()


def _week_of(day: date) -> list[date]:
    monday = day - timedelta(days=day.weekday())
    return [monday + timedelta(days=i) for i in range(7)]


def is_sensitive(*texts: Any) -> bool:
    """Family, matrimonial, child and sexual-offence matters: never expose party names beyond the advocate."""
    return any(_SENSITIVE.search(str(text or "")) for text in texts)


def court_key(court: dict[str, Any]) -> str:
    """Stable, human-readable identity of one court hall's board for a day."""
    parts = [str(court.get(k) or "").strip() for k in ("state", "district_code", "complex_code", "court_no")]
    if not all(parts):
        return ""
    return "|".join(re.sub(r"\s+", " ", p).upper() for p in parts)


def _pick(data: dict | None, *keys: str) -> Any:
    if not isinstance(data, dict):
        return None
    return next((data[k] for k in keys if data.get(k) not in (None, "")), None)


def _cnr_of(matter: dict) -> str:
    return str(_pick(matter, "cnr", "CNR", "cnr_number", "cnrNumber") or "").replace(" ", "").upper()


def _item_of(matter: dict) -> str | None:
    value = _pick(matter, "itemNo", "item_no", "item_number", "serialNo", "serial_no", "srNo", "sr_no")
    return str(value).strip() if value not in (None, "") else None


def _hall_label(court: dict) -> str | None:
    number = str(court.get("court_no") or "").strip()
    return number or None


def _parse_day(value: Any) -> date | None:
    text = str(value or "").strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        for fmt in ("%d-%m-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue
    return None


def _advocate_only(user: dict) -> dict:
    if user.get("role") not in {"advocate", "lawyer"} and not user.get("is_superuser"):
        raise HTTPException(status_code=403, detail="Court Day is for advocates.")
    return user


async def ensure_tables(conn) -> None:
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS court_board_updates (
            id          BIGSERIAL PRIMARY KEY,
            court_key   TEXT NOT NULL,
            board_date  DATE NOT NULL,
            item_no     INTEGER NOT NULL CHECK (item_no BETWEEN 1 AND 2000),
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status      TEXT NOT NULL CHECK (status IN ('accepted', 'pending')),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_court_board_updates_key_day "
        "ON court_board_updates (court_key, board_date, created_at DESC)"
    )


# ── board ─────────────────────────────────────────────────────────────────────
def summarise_board(rows: list[dict], now: datetime) -> dict | None:
    """Turn raw updates (newest first) into what the app shows. Pure, so it is unit-tested."""
    accepted = [r for r in rows if r["status"] == "accepted"]
    if not accepted:
        return None
    latest = accepted[0]
    age = now - latest["created_at"]
    if age > timedelta(hours=BOARD_VISIBLE_HOURS):
        return None
    window_start = latest["created_at"] - timedelta(minutes=CONFIRM_WINDOW_MINUTES)
    confirmers = {
        r["user_id"] for r in rows
        if r["item_no"] == latest["item_no"] and r["created_at"] >= window_start
    }
    minutes = max(int(age.total_seconds() // 60), 0)
    return {
        "now_item": latest["item_no"],
        "updated_at": latest["created_at"].isoformat(),
        "minutes_ago": minutes,
        "advocates": len(confirmers),
        "stale": age > timedelta(minutes=BOARD_FRESH_MINUTES),
        "source": "advocates_in_court",
    }


def decide_status(current: int | None, proposed: int, recent_pending: list[dict], user_id: int) -> str:
    """Accept ordinary progress at once; a surprising jump needs a second advocate. Pure, unit-tested."""
    if current is None:
        return "accepted"
    if current - MAX_BACKWARD_STEP <= proposed <= current + MAX_FORWARD_JUMP:
        return "accepted"
    if any(p["item_no"] == proposed and p["user_id"] != user_id for p in recent_pending):
        return "accepted"
    return "pending"


async def _board_rows(conn, key: str, day: date) -> list[dict]:
    rows = await conn.fetch(
        """SELECT item_no, user_id, status, created_at FROM court_board_updates
           WHERE court_key=$1 AND board_date=$2 ORDER BY created_at DESC LIMIT 200""",
        key, day,
    )
    return [dict(r) for r in rows]


async def _is_verified_advocate(conn, user: dict) -> bool:
    if user.get("is_superuser"):
        return True
    return bool(await conn.fetchval(
        "SELECT EXISTS (SELECT 1 FROM lawyers WHERE user_id=$1 AND verified IS TRUE)", int(user["id"]),
    ))


class BoardUpdate(BaseModel):
    court_key: str = Field(min_length=7, max_length=300)
    item_no: int = Field(ge=1, le=MAX_ITEM)


@router.get("/board")
async def get_board(court_key: str, user=Depends(require_user)):
    _advocate_only(user)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_tables(conn)
        rows = await _board_rows(conn, court_key, _today())
    return {"court_key": court_key, "board": summarise_board(rows, datetime.now(IST))}


@router.post("/board")
async def update_board(payload: BoardUpdate, user=Depends(require_user)):
    _advocate_only(user)
    user_id = int(user["id"])
    stamp = time.monotonic()
    last = _LAST_UPDATE.get((user_id, payload.court_key))
    if last is not None and stamp - last < UPDATE_COOLDOWN_SECONDS:
        raise HTTPException(status_code=429, detail="You just updated this board. Try again in a few seconds.")
    day = _today()
    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_tables(conn)
        if not await _is_verified_advocate(conn, user):
            raise HTTPException(
                status_code=403,
                detail="Only verified advocates can update court boards. Verify your enrolment in Settings.",
            )
        rows = await _board_rows(conn, payload.court_key, day)
        current = summarise_board(rows, datetime.now(IST))
        cutoff = datetime.now(IST) - timedelta(minutes=CONFIRM_WINDOW_MINUTES)
        pending = [r for r in rows if r["status"] == "pending" and r["created_at"] >= cutoff]
        status = decide_status(current["now_item"] if current else None, payload.item_no, pending, user_id)
        await conn.execute(
            """INSERT INTO court_board_updates (court_key, board_date, item_no, user_id, status)
               VALUES ($1, $2, $3, $4, $5)""",
            payload.court_key, day, payload.item_no, user_id, status,
        )
        rows = await _board_rows(conn, payload.court_key, day)
    _LAST_UPDATE[(user_id, payload.court_key)] = stamp
    return {
        "status": status,
        "message": "Board updated." if status == "accepted"
        else "That is a big jump. It will show once another advocate confirms it.",
        "board": summarise_board(rows, datetime.now(IST)),
    }


# ── today ─────────────────────────────────────────────────────────────────────
async def _cached_cause_lists(conn, user_id: int, days: list[date]) -> list[dict]:
    """Cause lists this advocate has already loaded (shared cache). Never calls the vendor."""
    from routers import docket
    await docket._ensure_table(conn)
    profile = await conn.fetchrow("SELECT court_ids FROM docket_profiles WHERE user_id=$1", user_id)
    courts = [docket._court_config(str(v)) for v in (profile["court_ids"] if profile and profile["court_ids"] else [])]
    out = []
    for court in courts:
        if not all(court.values()):
            continue
        for day in days:
            cached = await docket.cache_get(docket._court_cache_key(court, day.isoformat()))
            if cached and cached.get("status") == "ok":
                out.append({"court": court, "date": day, "matters": cached.get("matters") or []})
    return out


def locate_matter(cnr: str, day: date, lists: list[dict]) -> dict | None:
    """Find a CNR in that day's cause lists → court, hall, item, list size. Pure, unit-tested."""
    if not cnr:
        return None
    for entry in lists:
        if entry["date"] != day:
            continue
        for position, matter in enumerate(entry["matters"], start=1):
            if _cnr_of(matter) == cnr:
                court = entry["court"]
                return {
                    "court_key": court_key(court),
                    "court": court.get("court") or None,
                    "hall": _hall_label(court),
                    "item": _item_of(matter) or str(position),
                    "list_size": len(entry["matters"]),
                    "purpose": _pick(matter, "stage", "purpose", "business", "hearing_purpose"),
                    "source": "cause_list",
                }
    return None


@router.get("/today")
async def court_day_today(day: str | None = None, user=Depends(require_user)):
    _advocate_only(user)
    user_id = int(user["id"])
    today = _today()
    focus = _parse_day(day) or today
    week = _week_of(focus)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_tables(conn)
        cases = [dict(r) for r in await conn.fetch(
            """SELECT id, title, case_type, client_name, court_name, cnr_number, hearing_date, case_stage, status
               FROM lawyer_cases WHERE lawyer_id=$1 AND COALESCE(status,'active') <> 'closed'""",
            user_id,
        )]
        lists = await _cached_cause_lists(conn, user_id, [focus] if focus != today else [today, today + timedelta(days=1)])
        boards: dict[str, dict | None] = {}
        counts = {d: 0 for d in week}
        matters = []
        for case in cases:
            hearing = _parse_day(case.get("hearing_date"))
            if hearing in counts:
                counts[hearing] += 1
            if hearing != focus:
                continue
            cnr = str(case.get("cnr_number") or "").replace(" ", "").upper()
            place = locate_matter(cnr, focus, lists)
            board = None
            if place and place["court_key"] and focus == today:
                if place["court_key"] not in boards:
                    boards[place["court_key"]] = summarise_board(
                        await _board_rows(conn, place["court_key"], today), datetime.now(IST),
                    )
                board = boards[place["court_key"]]
            matters.append({
                "case_id": case["id"],
                "title": case["title"],
                "cnr": cnr or None,
                "case_type": case.get("case_type"),
                "client_name": case.get("client_name"),
                "stage": case.get("case_stage"),
                "sensitive": is_sensitive(case.get("case_type"), case.get("title")),
                "court": (place or {}).get("court") or case.get("court_name"),
                "hall": (place or {}).get("hall"),
                "item": (place or {}).get("item"),
                "list_size": (place or {}).get("list_size"),
                "court_key": (place or {}).get("court_key"),
                "place_source": "cause_list" if place else "case",
                "board": board,
            })
    def sort_key(m: dict):
        try:
            return (0, int(re.sub(r"\D", "", m["item"] or "") or 0))
        except ValueError:
            return (1, 0)
    matters.sort(key=lambda m: (m["item"] is None, sort_key(m), m["title"]))
    return {
        "date": focus.isoformat(),
        "today": today.isoformat(),
        "week": [{"date": d.isoformat(), "count": counts[d]} for d in week],
        "matters": matters,
        "notice": "Court, hall and item come from cause lists you have loaded. Board positions are shared by "
                  "advocates in court, not an official court feed.",
    }


# ── brief ─────────────────────────────────────────────────────────────────────
def _orders_from_snapshot(raw: dict) -> list[dict]:
    orders = []
    for key in ("orders", "interim_orders", "interimOrders", "final_orders", "finalOrders"):
        for order in raw.get(key) or []:
            if isinstance(order, dict):
                orders.append({
                    "date": str(_pick(order, "order_date", "date", "orderDate") or "")[:10] or None,
                    "text": str(_pick(order, "title", "order_title", "description", "purpose") or "Order")[:300],
                })
    orders.sort(key=lambda o: o["date"] or "", reverse=True)
    return orders[:3]


_CODE_LABEL = {"ipc": "IPC", "crpc": "CrPC", "evidence act": "Evidence Act"}


def law_mapping(text: str) -> list[dict]:
    """Old criminal-code sections mentioned in the case → BNS/BNSS/BSA, from the local crosswalk."""
    from routers.mcp_v2_legal_tools import _update_draft
    if not text.strip():
        return []
    try:
        result = _update_draft({"draft": text[:30000]})
    except Exception:
        return []
    out, seen = [], set()
    for ref in (result.get("data") or {}).get("references") or []:
        old = f"{_CODE_LABEL.get(ref.get('code'), str(ref.get('code')).upper())} s.{ref.get('section')}"
        if old in seen:
            continue
        seen.add(old)
        new = ref.get("suggested_sections") or []
        out.append({
            "old": old,
            "new": f"{ref.get('new_code')} s.{', '.join(new)}" if new else None,
            "note": ref.get("legacy_note"),
        })
    return out[:6]


@router.get("/brief/{case_id}")
async def hearing_brief(case_id: int, user=Depends(require_user)):
    """A factual brief from stored data only. No AI guessing, no vendor calls."""
    _advocate_only(user)
    from routers.mcp_v2_legal_tools import _checklist
    user_id = int(user["id"])
    pool = await get_pool()
    async with pool.acquire() as conn:
        case = await conn.fetchrow(
            """SELECT id, title, case_type, description, client_name, court_name, cnr_number, hearing_date, case_stage
               FROM lawyer_cases WHERE id=$1 AND lawyer_id=$2""",
            case_id, user_id,
        )
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        case = dict(case)
        cnr = str(case.get("cnr_number") or "").replace(" ", "").upper()
        snapshot = None
        if cnr:
            snapshot = await conn.fetchrow(
                """SELECT s.raw_response, s.case_status, s.next_hearing_date, s.fetched_at
                   FROM case_snapshots s JOIN tracked_cases t ON t.id = s.tracked_case_id
                   WHERE t.user_id=$1 AND t.cnr=$2 ORDER BY s.fetched_at DESC LIMIT 1""",
                user_id, cnr,
            )
    raw: dict = {}
    if snapshot:
        value = snapshot["raw_response"]
        raw = value if isinstance(value, dict) else (json.loads(value) if value else {})
    stage = str(_pick(raw, "stage", "currentStage", "caseStage", "purpose") or case.get("case_stage") or "")
    next_date = (str(snapshot["next_hearing_date"]) if snapshot and snapshot["next_hearing_date"]
                 else str(_pick(raw, "next_hearing_date", "nextHearingDate", "next_date") or "")[:10] or None)
    return {
        "case_id": case["id"],
        "title": case["title"],
        "cnr": cnr or None,
        "court": _pick(raw, "court", "court_name", "courtName") or case.get("court_name"),
        "judge": _pick(raw, "judge", "judge_name", "judgeName", "coram"),
        "stage": stage or None,
        "status": (snapshot["case_status"] if snapshot else None),
        "next_date": next_date,
        "last_orders": _orders_from_snapshot(raw),
        "checklist": _checklist(stage or ""),
        "law": law_mapping(" ".join(str(case.get(k) or "") for k in ("title", "description"))),
        "sensitive": is_sensitive(case.get("case_type"), case.get("title")),
        "data_as_of": snapshot["fetched_at"].isoformat() if snapshot else None,
        "source": "Your case record and the latest eCourts update stored in LitigaForge",
        "verify_notice": "Built from stored court data. Check the latest order before relying on it.",
    }
