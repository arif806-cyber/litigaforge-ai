"""
LitigaForge — Live Case Intelligence Router (Phase 1 + Phase 2 + Phase 3)

Endpoints:
  POST   /court-intel/track                Add a CNR + immediate refresh
  GET    /court-intel/my-cases             List tracked cases
  GET    /court-intel/{id}/timeline        Status + events (free: reduced, paid: full)
  GET    /court-intel/{id}/events          Full event feed          [LiveTrack only]
  POST   /court-intel/{id}/ask             RAG case companion       [LiveTrack only]
  POST   /court-intel/{id}/opponent-scan   Build opponent profile   [LiveTrack only]
  GET    /court-intel/{id}/opponent        Return cached profile    [LiveTrack only]
  GET    /court-intel/{id}/prediction      Predicted next hearing   [LiveTrack only]
  DELETE /court-intel/{id}                 Stop tracking
  POST   /court-intel/worker/run           Superuser: manual refresh trigger

Gating rule (enforced server-side on every request, not via cached flag):
  FREE tier    → /timeline (reduced), everything else returns 402
  LIVETRACK    → full access; tiers: professional | advocate_pro

The live subscription check (_check_livetrack_live) queries the subscriptions
table on every gated request so plan changes take effect immediately — no
cache invalidation needed, no re-login required.

Note: users.id is SERIAL INTEGER; tracked_cases.id is UUID.
Scope rule: vector searches ALWAYS filter by tracked_case_id — never cross-case.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from auth import require_user, reserve_hourly_ai_call
from database import (
    fetch as db_fetch,
    fetchrow as db_fetchrow,
    execute as db_execute,
    fetchval as db_fetchval,
)
from logger import get_logger
from services import court_data_client

logger = get_logger("litigaforge.court_intelligence")
router = APIRouter(tags=["court-intelligence"])

_BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")

_LIVETRACK_TIERS = {"professional", "advocate_pro"}

# Recognize pre-Partner-API refresh failures only so they can be suppressed and
# replaced. This pattern is never returned to clients or shown in the UI.
_LEGACY_CNR_REFRESH_PATTERN = (
    r"(ecourts\s+api.*unreachable.*server|"
    r"requires.*indian.*network.*ip|indian.*network.*ip)"
)
_LEGACY_CNR_REFRESH_RE = re.compile(_LEGACY_CNR_REFRESH_PATTERN, re.IGNORECASE)


def _normalize_refresh_state(status: Any, error: Any) -> tuple[Any, Any]:
    """Hide stale pre-Partner-API failures from every tracked-case response."""
    status_text = status if isinstance(status, str) else ""
    error_text = error if isinstance(error, str) else ""
    if _LEGACY_CNR_REFRESH_RE.search(status_text) or _LEGACY_CNR_REFRESH_RE.search(error_text):
        return "pending", None
    return status, error


# ── CNR validation ──────────────────────────────────────────────────────────────
def _validate_cnr(cnr: str) -> str:
    try:
        return court_data_client.normalize_cnr(cnr)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="Invalid CNR format. Expected 4 letters followed by 12 digits.",
        ) from exc


def _assert_owns(row: dict | None, user_id: int) -> dict:
    if not row:
        raise HTTPException(status_code=404, detail="Tracked case not found.")
    if int(row["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return row


# ── Phase 3: live subscription gate ────────────────────────────────────────────

async def _check_livetrack_live(user_id: int) -> bool:
    """
    Returns True if the user has an active LiveTrack subscription right now.
    Queries the subscriptions table directly — never relies on the cached
    users.subscription_tier column, so plan changes take effect immediately.
    """
    row = await db_fetchrow(
        """
        SELECT 1 FROM subscriptions
        WHERE  user_id = $1
          AND  status   = 'active'
          AND  tier     = ANY($2::text[])
          AND  (expires_at IS NULL OR expires_at > now())
        LIMIT 1
        """,
        user_id,
        list(_LIVETRACK_TIERS),
    )
    return row is not None


_UPGRADE_DETAIL = {
    "error": "upgrade_required",
    "message": "This feature requires LiveTrack (Professional or Advocate Pro).",
    "upgrade_url": "/subscription",
}


async def require_livetrack(user: dict = Depends(require_user)) -> dict:
    """
    FastAPI dependency: raises HTTP 402 if the user lacks a live LiveTrack subscription.
    Use on routes that must be gated at the API layer regardless of UI state.
    """
    if not await _check_livetrack_live(int(user["id"])):
        raise HTTPException(status_code=402, detail=_UPGRADE_DETAIL)
    return user


async def require_livetrack_ai(user: dict = Depends(require_livetrack)) -> dict:
    return await reserve_hourly_ai_call(user)


# ── Schemas ────────────────────────────────────────────────────────────────────

class TrackRequest(BaseModel):
    cnr: str = Field(..., description="16-character eCourts CNR number")
    case_type: str | None = Field(None, description="e.g. civil, criminal, property")


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)


class OpponentScanRequest(BaseModel):
    opponent_name: str = Field(
        ..., min_length=2, max_length=200,
        description="Full name of the opposing party as it appears in court records",
    )


# ── Background refresh helper ──────────────────────────────────────────────────

async def _trigger_single_refresh(tracked_case_id: str, cnr: str) -> None:
    """
    Fetch fresh data from eCourtsIndia for one tracked case and persist a snapshot.
    The client writes success timestamps only after the snapshot transaction commits.
    """
    try:
        from services.court_data_client import get_case_by_cnr
        # The paid refresh POST is made once; only its following detail GET is retried.
        await get_case_by_cnr(tracked_case_id, cnr, timeout=30.0, retries=3)
        logger.info("Immediate refresh done: tracked_case_id=%s cnr=%s", tracked_case_id, cnr)
    except Exception as exc:
        logger.exception(
            "Immediate eCourts refresh failed for tracked_case_id=%s cnr=%s "
            "error_type=%s message=%s",
            tracked_case_id, cnr, type(exc).__name__, str(exc)[:500],
        )


# ── POST /court-intel/track ────────────────────────────────────────────────────

@router.post("/court-intel/track")
async def track_case(
    body: TrackRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_user),
):
    cnr = _validate_cnr(body.cnr)
    user_id: int = int(user["id"])

    existing = await db_fetchrow(
        "SELECT id, is_active FROM tracked_cases WHERE user_id = $1 AND cnr = $2",
        user_id, cnr,
    )
    if existing:
        if existing["is_active"]:
            raise HTTPException(status_code=409, detail="You are already tracking this CNR.")
        tc_id = str(existing["id"])
        await db_execute(
            """
            UPDATE tracked_cases
            SET is_active = true, added_at = now(),
                refresh_status = 'pending', refresh_error = NULL
            WHERE id = $1::uuid
            """,
            tc_id,
        )
        background_tasks.add_task(_trigger_single_refresh, tc_id, cnr)
        return {"tracked_case_id": tc_id, "cnr": cnr, "status": "reactivated"}

    tc_id = await db_fetchval(
        """
        INSERT INTO tracked_cases (user_id, cnr, case_type, is_active, tier_gated)
        VALUES ($1, $2, $3, true, true)
        RETURNING id::text
        """,
        user_id, cnr, body.case_type,
    )
    logger.info("User %s started tracking CNR %s (id=%s)", user_id, cnr, tc_id)
    background_tasks.add_task(_trigger_single_refresh, str(tc_id), cnr)
    return {"tracked_case_id": str(tc_id), "cnr": cnr, "status": "tracking"}


# ── GET /court-intel/my-cases ──────────────────────────────────────────────────

@router.get("/court-intel/my-cases")
async def my_tracked_cases(
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_user),
):
    user_id: int = int(user["id"])

    # Normalize only the obsolete refresh fields. Case identity and every saved
    # snapshot stay intact; RETURNING makes this a one-time, race-safe refresh
    # enqueue for each affected case owned by this user.
    stale_cases = await db_fetch(
        """
        UPDATE tracked_cases
        SET    refresh_status = 'pending',
               refresh_error  = NULL
        WHERE  user_id = $1
          AND  is_active = true
          AND  (
                 COALESCE(refresh_error, '') ~* $2
                 OR COALESCE(refresh_status, '') ~* $2
               )
        RETURNING id::text AS id, cnr
        """,
        user_id,
        _LEGACY_CNR_REFRESH_PATTERN,
    )
    for stale_case in stale_cases:
        background_tasks.add_task(
            _trigger_single_refresh,
            stale_case["id"],
            stale_case["cnr"],
        )

    rows = await db_fetch(
        """
        SELECT tc.id::text, tc.cnr, tc.case_type, tc.court_name,
               tc.added_at, tc.last_refreshed, tc.is_active,
               tc.refresh_status, tc.refresh_error,
               cs.case_status, cs.next_hearing_date, cs.raw_response
        FROM   tracked_cases tc
        LEFT JOIN LATERAL (
            SELECT case_status, next_hearing_date, raw_response
            FROM   case_snapshots
            WHERE  tracked_case_id = tc.id
            ORDER  BY fetched_at DESC LIMIT 1
        ) cs ON true
        WHERE  tc.user_id = $1 AND tc.is_active = true
        ORDER  BY tc.added_at DESC
        """,
        user_id,
    )
    from services.court_data_client import normalize_snapshot_hearing_dates
    cases = []
    for row in rows:
        case = dict(row)
        (
            case["next_hearing_date"],
            case["last_listed_date"],
            case["disposal_date"],
        ) = normalize_snapshot_hearing_dates(
            case.get("case_status"),
            case.get("next_hearing_date"),
            case.get("raw_response"),
        )
        case.pop("raw_response", None)
        case["refresh_status"], case["refresh_error"] = _normalize_refresh_state(
            case.get("refresh_status"),
            case.get("refresh_error"),
        )
        cases.append(case)
    return {"cases": cases}


# ── GET /court-intel/{id}/timeline ────────────────────────────────────────────
# Free tier: case_status + next_hearing_date only (no event history).
# LiveTrack: full snapshots + events.
# Uses _check_livetrack_live for a live subscription check — not cached field.

@router.get("/court-intel/{case_id}/timeline")
async def get_timeline(case_id: str, user: dict = Depends(require_user)):
    row = await db_fetchrow(
        "SELECT id, user_id, cnr, case_type, court_name, last_refreshed, is_active, "
        "refresh_status, refresh_error "
        "FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))

    # Live subscription check — not from cached users.subscription_tier
    is_paid = await _check_livetrack_live(int(user["id"]))
    refresh_status, refresh_error = _normalize_refresh_state(
        row.get("refresh_status"),
        row.get("refresh_error"),
    )

    latest_snap = await db_fetchrow(
        """
        SELECT case_status, next_hearing_date, order_count, fetched_at, raw_response
        FROM   case_snapshots
        WHERE  tracked_case_id = $1::uuid
        ORDER  BY fetched_at DESC LIMIT 1
        """,
        case_id,
    )

    latest_status = dict(latest_snap) if latest_snap else None
    if latest_status:
        from services.court_data_client import normalize_snapshot_hearing_dates
        (
            latest_status["next_hearing_date"],
            latest_status["last_listed_date"],
            latest_status["disposal_date"],
        ) = normalize_snapshot_hearing_dates(
            latest_status.get("case_status"),
            latest_status.get("next_hearing_date"),
            latest_status.get("raw_response"),
        )
        latest_status.pop("raw_response", None)

    result: dict[str, Any] = {
        "cnr":            row["cnr"],
        "case_type":      row["case_type"],
        "court_name":     row["court_name"],
        "last_refreshed": row["last_refreshed"].isoformat() if row["last_refreshed"] else None,
        "refresh_status": refresh_status,
        "refresh_error": refresh_error,
        "is_active":      row["is_active"],
        "latest_status":  latest_status,
        "livetrack_tier": is_paid,
    }

    if not is_paid:
        result["upgrade_hint"] = (
            "Upgrade to Professional or Advocate Pro to unlock full timeline, "
            "events, AI case companion, opponent intelligence, and predictions."
        )
        return result

    snapshots = await db_fetch(
        """
        SELECT case_status, next_hearing_date, order_count, fetched_at
        FROM   case_snapshots
        WHERE  tracked_case_id = $1::uuid
        ORDER  BY fetched_at DESC LIMIT 50
        """,
        case_id,
    )
    events = await db_fetch(
        """
        SELECT event_type, summary, detected_at
        FROM   case_events
        WHERE  tracked_case_id = $1::uuid
        ORDER  BY detected_at DESC LIMIT 100
        """,
        case_id,
    )
    result["snapshots"] = [dict(s) for s in snapshots]
    result["events"]    = [dict(e) for e in events]
    return result


# ── GET /court-intel/{id}/events  [LiveTrack only] ────────────────────────────

@router.get("/court-intel/{case_id}/events")
async def get_events(case_id: str, user: dict = Depends(require_livetrack)):
    """
    Returns 402 for free-tier users (checked server-side via require_livetrack).
    Sample 402 body:
      {"error": "upgrade_required", "message": "...", "upgrade_url": "/subscription"}
    """
    row = await db_fetchrow(
        "SELECT id, user_id, cnr FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))

    events = await db_fetch(
        """
        SELECT id::text, event_type, summary, detected_at, notified
        FROM   case_events
        WHERE  tracked_case_id = $1::uuid
        ORDER  BY detected_at DESC LIMIT 200
        """,
        case_id,
    )
    return {"cnr": row["cnr"], "events": [dict(e) for e in events]}


# ── POST /court-intel/{id}/ask  (Phase 2 RAG)  [LiveTrack only] ───────────────

@router.post("/court-intel/{case_id}/ask")
async def ask_about_case(
    case_id: str,
    body: AskRequest,
    user: dict = Depends(require_livetrack_ai),
):
    """
    RAG endpoint: answer a question grounded only in this case's embedded court orders.

    Security invariant: the pgvector similarity search is ALWAYS scoped to
    WHERE tracked_case_id = {case_id} — one user's orders never leak into
    another user's answer.

    Returns 402 for free-tier users (via require_livetrack dependency).
    Returns 403 if the case belongs to a different user.
    Returns 404 if no orders have been embedded yet.
    """
    row = await db_fetchrow(
        "SELECT id, user_id, cnr, case_type, court_name "
        "FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))

    from llm.nim_embed import aembed_query, nim_embed_enabled
    if not nim_embed_enabled():
        raise HTTPException(
            status_code=503,
            detail="AI case companion is temporarily unavailable (embedding service offline).",
        )

    question_vec = await aembed_query(body.question)
    if question_vec is None:
        raise HTTPException(
            status_code=503,
            detail="Failed to embed question — please try again in a moment.",
        )

    from llm.nim_embed import vec_to_str

    # Scope filter is MANDATORY — never search across cases
    chunks = await db_fetch(
        """
        SELECT order_date, order_text,
               1 - (embedding <=> $1::vector) AS similarity
        FROM   case_order_embeddings
        WHERE  tracked_case_id = $2::uuid
        ORDER  BY embedding <=> $1::vector
        LIMIT  5
        """,
        vec_to_str(question_vec), case_id,
    )

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail=(
                "No court orders have been indexed for this case yet. "
                "Orders are embedded automatically when detected — "
                "check back after the next nightly refresh."
            ),
        )

    dated_excerpts = "\n\n".join(
        f"[Order dated {r['order_date'] or 'unknown'}]\n{r['order_text']}"
        for r in chunks
    )
    cited_dates: list[str] = [str(r["order_date"]) for r in chunks if r["order_date"]]

    system_prompt = (
        "You are an AI assistant helping a litigant understand their own court case. "
        "Answer ONLY using the provided court order excerpts below. "
        "If the excerpts do not contain the answer, say so plainly — do not guess, "
        "infer, or draw on general legal knowledge. "
        "This is legal information about a real, ongoing case; a wrong answer is "
        "worse than an honest 'I don't have that in the case record yet.'\n\n"
        f"Court order excerpts:\n\n{dated_excerpts}"
    )

    answer = ""
    try:
        from llm.legal_llm import acomplete
        answer = await acomplete(system_prompt, body.question, temperature=0.1)
    except Exception as llm_err:
        logger.error("[/ask] Portable LiteLLM failed: %s", llm_err)
        raise HTTPException(
            status_code=503,
            detail="AI service temporarily unavailable — please try again shortly.",
        )

    if not answer:
        raise HTTPException(
            status_code=503,
            detail="AI returned an empty response — please try again shortly.",
        )

    return {
        "answer": answer,
        "cited_order_dates": sorted(set(cited_dates)),
        "chunks_used": len(chunks),
    }


# ── POST /court-intel/{id}/opponent-scan  [LiveTrack only] ────────────────────

@router.post("/court-intel/{case_id}/opponent-scan")
async def opponent_scan(
    case_id: str,
    body: OpponentScanRequest,
    user: dict = Depends(require_livetrack_ai),
):
    """
    Build (or rebuild) an Opponent Intelligence profile on demand.
    Calls search_litigant() to find the opponent's other cases across eCourts,
    then stores an aggregated profile in opponent_profiles.

    This endpoint runs ONLY when the user explicitly calls it — it is NOT wired
    into any automatic or nightly workflow.

    Profile data is descriptive ("has appeared in 14 cases across 3 courts"),
    NOT predictive ("is likely to delay this case").
    """
    row = await db_fetchrow(
        "SELECT id, user_id, cnr, case_type, court_name "
        "FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))

    opponent_name = body.opponent_name.strip()

    from services.court_data_client import search_litigant
    try:
        cases = await search_litigant(opponent_name, court=row.get("court_name"))
    except court_data_client.CourtDataError as exc:
        status = exc.status_code
        http_status = (
            503 if exc.code == "missing_credentials" or status in {401, 402, 403, 429}
            else 504 if exc.code == "timeout"
            else 404 if status == 404
            else 422 if status == 400
            else 409 if status == 409
            else 502
        )
        headers = {"Retry-After": str(int(exc.retry_after))} if exc.retry_after is not None else None
        raise HTTPException(
            status_code=http_status,
            detail={"code": exc.code, "message": exc.user_message},
            headers=headers,
        ) from exc

    total = len(cases)
    court_breakdown: dict[str, int] = {}
    type_breakdown: dict[str, int] = {}

    for c in cases:
        court = (c.get("court_name") or c.get("court") or "Unknown").strip()
        ctype = (c.get("case_type") or c.get("type") or "Unknown").strip()
        court_breakdown[court] = court_breakdown.get(court, 0) + 1
        type_breakdown[ctype]  = type_breakdown.get(ctype, 0) + 1

    profile: dict[str, Any] = {
        "total_cases_found": total,
        "courts": court_breakdown,
        "case_types": type_breakdown,
    }

    # Adjournment rate — only when we have ≥3 hearing-date data points in the
    # eCourts API response for this opponent's cases.  We do NOT fabricate a
    # rate from a single data point.
    hearing_count = sum(
        1 for c in cases
        if c.get("hearings") and isinstance(c["hearings"], list) and len(c["hearings"]) >= 2
    )
    adj_count = sum(
        1 for c in cases
        for h in (c.get("hearings") or [])
        if (h.get("outcome") or "").lower() in ("adjourned", "adj", "postponed")
    )
    total_hearings = sum(
        len(c.get("hearings") or []) for c in cases
        if isinstance(c.get("hearings"), list)
    )
    if total_hearings >= 3 and adj_count > 0:
        profile["adjournment_rate"] = round(adj_count / total_hearings, 3)

    await db_execute(
        """
        INSERT INTO opponent_profiles
            (tracked_case_id, opponent_name, total_cases_found, profile_json, last_built_at)
        VALUES ($1::uuid, $2, $3, $4::jsonb, now())
        ON CONFLICT (tracked_case_id) DO UPDATE
            SET opponent_name     = EXCLUDED.opponent_name,
                total_cases_found = EXCLUDED.total_cases_found,
                profile_json      = EXCLUDED.profile_json,
                last_built_at     = now()
        """,
        case_id, opponent_name, total, json.dumps(profile),
    )

    logger.info(
        "Opponent scan complete: case_id=%s opponent=%s total_cases=%d",
        case_id, opponent_name, total,
    )
    return {"status": "built", "opponent_name": opponent_name, "profile": profile}


# ── GET /court-intel/{id}/opponent  [LiveTrack only] ──────────────────────────

@router.get("/court-intel/{case_id}/opponent")
async def get_opponent_profile(case_id: str, user: dict = Depends(require_livetrack)):
    """Return the cached Opponent Intelligence profile. 404 if not yet built."""
    row = await db_fetchrow(
        "SELECT id, user_id FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))

    profile_row = await db_fetchrow(
        """
        SELECT opponent_name, total_cases_found, profile_json, last_built_at
        FROM   opponent_profiles
        WHERE  tracked_case_id = $1::uuid
        """,
        case_id,
    )
    if not profile_row:
        raise HTTPException(
            status_code=404,
            detail=(
                "No opponent profile has been built for this case yet. "
                "Call POST /opponent-scan to generate one."
            ),
        )

    return {
        "opponent_name":     profile_row["opponent_name"],
        "total_cases_found": profile_row["total_cases_found"],
        "profile":           profile_row["profile_json"],
        "last_built_at":     profile_row["last_built_at"].isoformat()
                             if profile_row["last_built_at"] else None,
    }


# ── GET /court-intel/{id}/prediction  [LiveTrack only] ────────────────────────

@router.get("/court-intel/{case_id}/prediction")
async def get_prediction(case_id: str, user: dict = Depends(require_livetrack)):
    """
    Return the heuristic predicted_next_hearing date for this case.
    Returns a clear 'not enough data' message when the value is NULL rather
    than fabricating a number from insufficient history.
    """
    row = await db_fetchrow(
        "SELECT id, user_id, cnr, case_type, court_name, predicted_next_hearing "
        "FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))

    predicted = row["predicted_next_hearing"]
    if predicted is None:
        return {
            "predicted_next_hearing": None,
            "status": "not_enough_data",
            "message": (
                "Not enough historical hearing data for this court and case type yet. "
                "Predictions appear automatically once the system has seen 3 or more "
                "consecutive hearing intervals for this combination."
            ),
        }

    return {
        "predicted_next_hearing": str(predicted),
        "status": "available",
        "case_type":  row["case_type"],
        "court_name": row["court_name"],
    }


# ── POST /court-intel/{id}/refresh  (on-demand retry for any auth user) ───────

@router.post("/court-intel/{case_id}/refresh")
async def refresh_case(
    case_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_user),
):
    """
    Trigger an immediate background refresh for one tracked case.
    Available to any authenticated user for their own cases — no LiveTrack gate.
    Useful when the nightly worker hasn't run yet or the upstream API was offline.
    Returns immediately; actual fetch happens asynchronously.
    """
    row = await db_fetchrow(
        "SELECT id, user_id, cnr, is_active FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))
    if not row["is_active"]:
        raise HTTPException(status_code=409, detail="Case is no longer being tracked.")

    await db_execute(
        """
        UPDATE tracked_cases
        SET refresh_status = 'pending', refresh_error = NULL
        WHERE id = $1::uuid
        """,
        str(row["id"]),
    )
    background_tasks.add_task(_trigger_single_refresh, str(row["id"]), row["cnr"])
    return {"status": "refresh_queued", "cnr": row["cnr"]}


# ── DELETE /court-intel/{id} ──────────────────────────────────────────────────

@router.delete("/court-intel/{case_id}")
async def stop_tracking(case_id: str, user: dict = Depends(require_user)):
    row = await db_fetchrow(
        "SELECT id, user_id, cnr FROM tracked_cases WHERE id = $1::uuid",
        case_id,
    )
    _assert_owns(row, int(user["id"]))
    await db_execute(
        "UPDATE tracked_cases SET is_active = false WHERE id = $1::uuid",
        case_id,
    )
    logger.info("User %s stopped tracking CNR %s (id=%s)", user["id"], row["cnr"], case_id)
    return {"status": "stopped", "cnr": row["cnr"]}


# ── POST /court-intel/worker/run (superuser manual trigger) ───────────────────

@router.post("/court-intel/worker/run")
async def manual_run_worker(user: dict = Depends(require_user)):
    if not user.get("is_superuser"):
        raise HTTPException(status_code=403, detail="Superuser only.")
    from workers.case_refresh_worker import run_refresh
    result = await run_refresh()
    return {"status": "completed", **result}
