"""
LitigaForge AI — Matching Router
Case requirements, AI lawyer matching, and match management.
"""
import logging
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from auth import get_current_user, require_ai_user
from rate_limit import limiter
from database import fetchrow, fetch, execute, executemany, get_pool, create_case_requirement_with_quota
from sanitizer import sanitize_text
from ai_safety import wrap_user_prompt
from llm import legal_llm
from logger import get_logger

logger = get_logger("litigaforge.matching")
router = APIRouter(tags=["matching"])


def refund_within_decline_window(created_at, now=None) -> bool:
    """A paid match is refundable through the exact 48-hour boundary."""
    from datetime import datetime, timezone
    now = now or datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return (now - created_at).total_seconds() <= 48 * 3600


# ── AI helpers (local copy for matching scoring) ─────────────────────────────

import json
import os
import re
async def _ai(prompt: str, max_tokens: int = 2000) -> str:
    """Use the portable LiteLLM provider selected by LLM_MODEL."""
    try:
        return await legal_llm.acomplete(
            legal_llm.LEGAL_SYSTEM_PROMPT if hasattr(legal_llm, "LEGAL_SYSTEM_PROMPT") else
            "You are a careful legal matching assistant. Do not invent facts.",
            prompt,
            max_tokens=max_tokens,
        )
    except Exception as exc:
        logger.warning("Matching AI unavailable: %s", type(exc).__name__)
        return ""


def _extract_json_array(text: str) -> list:
    m = re.search(r'\[.*\]', text, re.DOTALL)
    return json.loads(m.group()) if m else []



# ── Case Requirements ────────────────────────────────────────────────────────

class CaseRequirementRequest(BaseModel):
    title: str
    case_type: str
    description: str = ""
    location: str = ""
    budget_range: str = ""
    budget_min: int = 0
    budget_max: int = 0
    is_anonymous: bool = False


@router.post("/cases/requirements")
async def create_case_requirement(
    req: CaseRequirementRequest,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    # Do not add an IP-based SlowAPI limit here. Replit's proxy addresses are
    # shared and may change between requests, so legitimate signed-in users can
    # exhaust one another's buckets. create_case_requirement_with_quota applies
    # the authenticated user's plan limit atomically in PostgreSQL.
    if not current_user:
        raise HTTPException(401, "Login required to post a case")
    if not current_user.get("email_verified") and os.getenv("ALLOW_UNVERIFIED") != "1":
        raise HTTPException(403, "Verify your email before posting a case")
    try:
        safe_title = sanitize_text(req.title, max_length=200, field_name="title")
        safe_case_type = sanitize_text(req.case_type, max_length=100, field_name="case_type")
        safe_desc = sanitize_text(req.description, max_length=2000, field_name="description")
        safe_location = sanitize_text(req.location, max_length=100, field_name="location")
        safe_budget = sanitize_text(req.budget_range, max_length=50, field_name="budget_range")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        row = await create_case_requirement_with_quota(
            current_user["id"],
            (safe_title, safe_case_type, safe_desc, safe_location, safe_budget,
             req.budget_min, req.budget_max, req.is_anonymous),
        )
    except PermissionError:
        return JSONResponse(
            status_code=402,
            content={"detail": "Free plan limit reached", "upgrade": "/subscription"},
        )
    except ValueError:
        raise HTTPException(401, "User not found")
    row["created_at"] = str(row["created_at"])
    # Matching is deliberately disabled unless explicitly enabled. This avoids
    # displaying speculative matches while the verified advocate supply is small.
    matches = []
    if os.getenv("MATCHING_ENABLED", "false").lower() == "true":
        result = await ai_match_lawyers(
            MatchRequest(case_requirement_id=row["id"]), request, current_user
        )
        matches = result.get("matches", [])
    return {"message": "Case requirement posted successfully", "case": row, "matches": matches}


@router.get("/cases/requirements")
async def list_case_requirements(
    current_user: Optional[dict] = Depends(get_current_user),
    case_type: Optional[str] = None,
    status: Optional[str] = None,
):
    if not current_user:
        raise HTTPException(401, "Login required")
    is_advocate = current_user.get("role") in ("advocate", "lawyer")
    viewer_lawyer_id = None
    if is_advocate:
        viewer = await fetchrow(
            "SELECT id FROM lawyers WHERE user_id = $1 AND verified = TRUE "
            "AND verification_status = 'verified'",
            current_user["id"],
        )
        if not viewer:
            raise HTTPException(403, "Only verified advocates can browse client cases")
        viewer_lawyer_id = viewer["id"]
    conds, params = [], []
    if case_type:
        conds.append("case_type = $" + str(len(params) + 1))
        params.append(case_type)
    if status:
        conds.append("status = $" + str(len(params) + 1))
        params.append(status)
    if not is_advocate:
        conds.append("user_id = $" + str(len(params) + 1))
        params.append(current_user["id"])
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    reveal_param = len(params) + 1
    reveal_value = viewer_lawyer_id if is_advocate else current_user["id"]
    params.append(reveal_value)
    reveal_match = (
        f"m.lawyer_id = ${reveal_param}" if is_advocate
        else f"m.client_id = ${reveal_param}"
    )
    reveal_status = (
        "m.status = 'accepted'" if is_advocate
        else "m.status IN ('accepted', 'interested')"
    )
    rows = await fetch(
        f"""SELECT id, user_id, title, case_type,
                  CASE WHEN NOT is_anonymous OR user_id = ${reveal_param}
                    OR EXISTS (
                      SELECT 1 FROM matches m
                      WHERE m.case_requirement_id = case_requirements.id
                        AND {reveal_match}
                        AND m.payment_status = 'paid'
                         AND {reveal_status}
                    )
                    THEN description ELSE NULL END AS description,
                  CASE WHEN NOT is_anonymous OR user_id = ${reveal_param}
                    OR EXISTS (
                      SELECT 1 FROM matches m
                      WHERE m.case_requirement_id = case_requirements.id
                        AND {reveal_match}
                        AND m.payment_status = 'paid'
                         AND {reveal_status}
                    )
                    THEN location ELSE NULL END AS location,
                  budget_range, is_anonymous, status, created_at
           FROM case_requirements {where}
           ORDER BY created_at DESC LIMIT 100""",
        *params,
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
        if r["is_anonymous"]:
            r["user_id"] = None
    return {"total": len(rows), "cases": rows}


@router.get("/cases/requirements/mine")
async def my_case_requirements(current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(401, "Login required")
    rows = await fetch(
        """SELECT id, title, case_type, description, location,
                  budget_range, is_anonymous, status, created_at
           FROM case_requirements WHERE user_id = $1
           ORDER BY created_at DESC""",
        current_user["id"],
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "cases": rows}



class UpdateRequirementRequest(BaseModel):
    title: str = ""
    case_type: str = ""
    description: str = ""
    location: str = ""
    budget_range: str = ""
    is_anonymous: Optional[bool] = None


@router.get("/cases/requirements/{req_id}")
async def get_case_requirement(
    req_id: int,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    row = await fetchrow(
        """SELECT id, title, case_type, description, location,
                  budget_range, is_anonymous, status, created_at
           FROM case_requirements WHERE id = $1 AND user_id = $2""",
        req_id, current_user["id"],
    )
    if not row:
        raise HTTPException(404, "Case requirement not found")
    row["created_at"] = str(row["created_at"])
    return dict(row)


@router.delete("/cases/requirements/{req_id}")
async def delete_case_requirement(
    req_id: int,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    existing = await fetchrow(
        "SELECT id FROM case_requirements WHERE id = $1 AND user_id = $2",
        req_id, current_user["id"],
    )
    if not existing:
        raise HTTPException(404, "Case requirement not found")
    await execute("DELETE FROM case_requirements WHERE id = $1", req_id)
    return {"message": "Case requirement deleted"}


@router.patch("/cases/requirements/{req_id}")
async def update_case_requirement(
    req_id: int,
    body: UpdateRequirementRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    existing = await fetchrow(
        "SELECT id FROM case_requirements WHERE id = $1 AND user_id = $2",
        req_id, current_user["id"],
    )
    if not existing:
        raise HTTPException(404, "Case requirement not found")
    fields = []
    params = []
    try:
        if body.title:
            fields.append(f"title = ${len(params)+1}")
            params.append(sanitize_text(body.title, max_length=200, field_name="title"))
        if body.case_type:
            fields.append(f"case_type = ${len(params)+1}")
            params.append(sanitize_text(body.case_type, max_length=100, field_name="case_type"))
        if body.description != "":
            fields.append(f"description = ${len(params)+1}")
            params.append(sanitize_text(body.description, max_length=5000, field_name="description"))
        if body.location != "":
            fields.append(f"location = ${len(params)+1}")
            params.append(sanitize_text(body.location, max_length=100, field_name="location"))
        if body.budget_range != "":
            fields.append(f"budget_range = ${len(params)+1}")
            params.append(sanitize_text(body.budget_range, max_length=50, field_name="budget_range"))
    except ValueError as ve:
        raise HTTPException(400, str(ve))
    if body.is_anonymous is not None:
        fields.append(f"is_anonymous = ${len(params)+1}")
        params.append(body.is_anonymous)
    if not fields:
        raise HTTPException(400, "No fields to update")
    # Safety: column names in `fields` are hardcoded strings ("title = $N", etc.),
    # never derived from user input. Only the $N-parameterised values carry user data.
    query = f"UPDATE case_requirements SET {', '.join(fields)} WHERE id = ${len(params)+1} RETURNING *"
    params.append(req_id)
    row = await fetchrow(query, *params)
    row["created_at"] = str(row["created_at"])
    return {"message": "Case requirement updated", "case": row}


# ── AI Case Overview ─────────────────────────────────────────────────────────

@router.post("/cases/requirements/{req_id}/ai-overview")
async def case_ai_overview(
    req_id: int,
    current_user: dict = Depends(require_ai_user),
):
    """Generate an AI legal overview for a case requirement."""
    case = await fetchrow(
        "SELECT * FROM case_requirements WHERE id = $1 AND user_id = $2",
        req_id, current_user["id"],
    )
    if not case:
        raise HTTPException(404, "Case requirement not found")

    desc = (case.get("description") or "").strip()
    prompt = f"""You are an expert Indian advocate specialising in Telangana and Andhra Pradesh law.
Analyse the following client case and write a concise legal overview in plain English.

Case Type: {case.get("case_type", "N/A")}
Location: {case.get("location") or "Not specified"}
Budget: {case.get("budget_range") or "Not specified"}
Description: {desc or "Not provided"}

Structure your response with EXACTLY these four sections (use the headings as shown):

**Case Summary**
Two to three sentences summarising what happened and what the client seeks.

**Key Legal Issues**
• Issue 1
• Issue 2
(max 4 bullet points)

**Recommended Next Steps**
• Step 1
• Step 2
(max 4 bullet points)

**Relevant Laws & Sections**
List applicable Indian statutes and sections using BNS for substantive offences,
BNSS for criminal procedure, and BSA for evidence for matters from 1 July 2024
onward. Mention IPC, CrPC, or the Evidence Act only when the offence or
proceeding predates 1 July 2024, and label that historical applicability.

Keep the entire response under 300 words. Be specific, practical, and jurisdiction-aware."""

    overview = await _ai(prompt, max_tokens=700)
    if not overview:
        overview = "The AI case overview is temporarily unavailable. Please try again shortly."
    return {"overview": overview}


# ── AI Matching Engine ──────────────────────────────────────────────────────

class MatchRequest(BaseModel):
    case_requirement_id: int


@router.post("/match/find-lawyers")
@limiter.limit("10/minute")
async def ai_match_lawyers(
    req: MatchRequest,
    request: Request,
    current_user: dict = Depends(require_ai_user),
):
    # This direct endpoint must honor the same fail-closed switch as matching
    # invoked while creating a case. Check before loading case or lawyer data.
    if os.getenv("MATCHING_ENABLED", "false").lower() != "true":
        return {
            "case_id": req.case_requirement_id,
            "matches": [],
            "message": "Matching is not currently available.",
        }
    # Fetch case requirement
    case = await fetchrow(
        "SELECT * FROM case_requirements WHERE id = $1 AND user_id = $2",
        req.case_requirement_id, current_user["id"],
    )
    if not case:
        raise HTTPException(404, "Case requirement not found")
    if case.get("connect_v2"):
        raise HTTPException(409, "This request uses the private Connect flow")

    # Fetch all verified lawyers
    lawyers = await fetch(
        """SELECT id, name, district, practice_areas, languages,
                  experience_years, bio, availability, verification_status
            FROM lawyers
            WHERE availability = 'available' AND verified = TRUE
              AND verification_status = 'verified' AND COALESCE(is_test, FALSE) = FALSE
              AND COALESCE(admin_hidden, FALSE) = FALSE
           ORDER BY id""",
    )

    if not lawyers:
        return {"case_id": req.case_requirement_id, "matches": [], "message": "No verified lawyers available at the moment. Please try again later."}

    # ── Location helpers ──────────────────────────────────────────────────────

    _TS_DISTRICTS = {
        "hyderabad", "secunderabad", "warangal", "hanamkonda", "karimnagar",
        "nizamabad", "khammam", "nalgonda", "medak", "rangareddy", "sangareddy",
        "siddipet", "mancherial", "mahabubabad", "suryapet", "yadadri",
        "vikarabad", "narayanpet", "nagarkurnool", "wanaparthy", "gadwal",
        "jogulamba", "kamareddy", "rajanna", "peddapalli", "bhadradri",
        "mulugu", "asifabad", "kumuram", "jayashankar", "bhupalpally",
        "jangaon", "adilabad", "nirmal", "ranga reddy",
    }
    _AP_DISTRICTS = {
        "vijayawada", "visakhapatnam", "vizag", "guntur", "tirupati",
        "kakinada", "nellore", "kurnool", "rajahmundry", "eluru",
        "machilipatnam", "amaravati", "chittoor", "ongole", "srikakulam",
        "vizianagaram", "bhimavaram", "tanuku", "narasaraopet", "tenali",
        "bapatla", "markapur", "nandyal", "kadapa", "anantapur",
        "hindupur", "proddatur", "dharmavaram", "tadpatri",
    }

    def _infer_state(district: str) -> str:
        """Return 'TS', 'AP', or '' from a lawyer's district string."""
        dl = district.lower()
        if any(d in dl for d in _TS_DISTRICTS):
            return "TS"
        if any(d in dl for d in _AP_DISTRICTS):
            return "AP"
        return ""

    def _parse_locations(loc: str) -> list[str]:
        """Split a multi-district location string into individual tokens."""
        import re as _re
        parts = _re.split(r'\s+and\s+|[,;&/]', loc.lower())
        return [p.strip() for p in parts if p.strip()]

    def _case_state(location_str: str) -> str:
        """Infer state code from case location string."""
        ll = location_str.lower()
        for d in _TS_DISTRICTS:
            if d in ll:
                return "TS"
        for d in _AP_DISTRICTS:
            if d in ll:
                return "AP"
        return ""

    def _normalize_state_code(raw: str) -> str:
        """Normalise various state-code forms to 'TS' or 'AP'."""
        r = raw.strip().upper()
        if r in ("TS", "TELANGANA", "TG"):
            return "TS"
        if r in ("AP", "ANDHRA PRADESH", "ANDHRAPRADESH"):
            return "AP"
        return ""

    # Compute match scores
    case_type = case.get("case_type", "").lower()
    case_location = case.get("location", "").lower()
    case_loc_parts = _parse_locations(case_location) if case_location else []
    # Primary: state_code stored on the case (set by extraction/user input).
    # Fallback: infer from the location string if state_code is absent/blank.
    _raw_state = case.get("state_code") or ""
    inferred_case_state = _normalize_state_code(_raw_state) if _raw_state else _case_state(case_location)

    # A real match must have both a practice-area and location/statewide tag
    # overlap. Never save zero-relevance or inferred matches.
    scored = []
    for l in lawyers:
        pas = [p.lower() for p in l.get("practice_areas", [])]
        area_match = case_type in pas or any(ct in p for ct in case_type.split() for p in pas)
        lawyer_district = (l.get("district") or "").strip().lower()
        # An empty district must never satisfy Python's ``'' in location``.
        # Statewide is an explicit opt-in location tag, never inferred.
        statewide = bool(lawyer_district) and any(
            marker in lawyer_district for marker in ("statewide", "telangana", "andhra pradesh")
        )
        location_match = statewide or (bool(lawyer_district and case_location) and any(
            lawyer_district in segment or segment in lawyer_district for segment in case_loc_parts
        ))
        if not (area_match and location_match):
            continue
        score = 0
        reasons = []

        # ── practice_areas (max 40 pts) ──────────────────────────────────────
        if case_type in pas:
            score += 40
            reasons.append(f"Specialises in {case_type.title()}")
        elif any(ct in p for ct in case_type.split() for p in pas):
            score += 25
            reasons.append("Related practice area overlap")

        # ── district / cross-district (max 20 pts) ───────────────────────────
        if case_location and case_loc_parts:
            # Cross-district: award points if lawyer matches ANY parsed segment
            matched_segment = None
            for seg in case_loc_parts:
                if lawyer_district in seg or seg in lawyer_district:
                    matched_segment = seg
                    break
            if matched_segment is None:
                # word-level partial match across all segments
                all_words = " ".join(case_loc_parts).split()
                if any(w in lawyer_district for w in all_words):
                    matched_segment = case_location  # partial

            if matched_segment is not None:
                if len(case_loc_parts) > 1:
                    chosen = matched_segment.title() if matched_segment != case_location else l["district"]
                    score += 20
                    reasons.append(f"Based in {l['district']} (matched '{chosen}' from multi-district case)")
                else:
                    score += 20
                    reasons.append(f"Based in {l['district']}")
            elif case_location and any(w in lawyer_district for w in case_location.split()):
                score += 10
                reasons.append("Nearby location")

        l["match_score"] = min(score, 60)
        l["match_reasons"] = reasons
        scored.append(l)

    scored.sort(key=lambda x: x["match_score"], reverse=True)
    top = scored[:10]

    # ── Optional AI explanations (deterministic tag score remains authoritative) ──
    # Claude scores ALL top-10 lawyers for semantic fit (0–10) and writes
    # explanations for the top 3 — blended 60 % semantic / 40 % deterministic.
    # Falls back to deterministic order silently on any JSON parse error.
    if top:
        all_summary = "\n".join(
            f"- id:{l['id']} {l['name']} ({l['district']}, "
            f"practices: {', '.join((l.get('practice_areas') or [])[:3])})"
            for l in top
        )
        rerank_prompt = f"""You are an AI legal assistant. A client has this legal need:

Case type: {case.get('case_type', 'unspecified')}
Location:  {case.get('location', 'unspecified')}
Description: {case.get('description', 'No description provided')}

Shortlisted lawyers (by keyword score):
{all_summary}

Tasks:
Write 2–3 sentences explaining why the 3 highest-scoring lawyers are the best match.
The listed practice areas and location tags are authoritative. Do not claim a lawyer
lacks a listed practice area and do not infer court admission.

Return ONLY a valid JSON object — no markdown, no commentary:
{{
  "explanations": [{{"lawyer_id": <int>, "explanation": "<string>"}}, ...]
}}"""

        raw = await _ai(rerank_prompt, 2000)
        try:
            import json as _json
            m = re.search(r'\{.*\}', raw, re.DOTALL)
            if m:
                parsed = _json.loads(m.group())
                for exp in parsed.get("explanations", []):
                    lid = exp.get("lawyer_id")
                    for l in top:
                        if l["id"] == lid:
                            l["ai_explanation"] = exp.get("explanation", "")
                            break
        except Exception:
            pass

    # Store matches in DB (batch)
    match_inserts = []
    for l in top:
        match_inserts.append((req.case_requirement_id, l["id"], current_user["id"], l["match_score"], l.get("ai_explanation", "")))
    if match_inserts:
        await executemany(
            """INSERT INTO matches (case_requirement_id, lawyer_id, client_id, match_score, ai_explanation, status, payment_status)
               VALUES ($1, $2, $3, $4, $5, 'pending', 'none')
               ON CONFLICT DO NOTHING""",
            match_inserts,
        )

    return {
        "case_id": req.case_requirement_id,
        "case_title": case.get("title", ""),
        "total_matches": len(top),
        "matches": [
            {k: l[k] for k in l if k not in ("user_id", "match_score", "rating", "hourly_rate")}
            for l in top
        ],
    }


# ── Match Management ──────────────────────────────────────────────────────────

@router.get("/matches/client")
async def client_matches(current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(401, "Login required")
    rows = await fetch(
        """SELECT m.id, m.status, m.ai_explanation,
                  m.client_message, m.lawyer_message, m.created_at,
                  m.payment_status, m.commission_amount,
                  c.title as case_title, c.case_type, c.budget_range,
                  l.id as lawyer_id, l.name as lawyer_name, l.district,
                  l.practice_areas, l.experience_years,
                  CASE WHEN m.payment_status = 'paid' THEN l.phone ELSE NULL END as lawyer_phone,
                  CASE WHEN m.payment_status = 'paid' THEN l.email ELSE NULL END as lawyer_email
           FROM matches m
           JOIN case_requirements c ON m.case_requirement_id = c.id
            JOIN lawyers l ON m.lawyer_id = l.id
            WHERE m.client_id = $1
               AND COALESCE(m.connect_v2, FALSE) = FALSE
              AND COALESCE(l.is_test, FALSE) = FALSE
              AND COALESCE(l.admin_hidden, FALSE) = FALSE
           ORDER BY m.created_at DESC""",
        current_user["id"],
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "matches": rows}


@router.get("/matches/lawyer")
async def lawyer_matches(current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(401, "Login required")
    if current_user.get("role") not in ("advocate", "lawyer"):
        raise HTTPException(403, "Advocate access required to receive matches")
    # Only verified, active advocate profiles may receive case data.  Keeping
    # this gate in the profile lookup also prevents suspended/revoked lawyers
    # from seeing anonymous details through previously-created matches.
    lawyer_row = await fetchrow(
        "SELECT id FROM lawyers "
        "WHERE user_id = $1 AND verified = TRUE "
        "AND verification_status = 'verified'",
        current_user["id"],
    )
    if not lawyer_row:
        raise HTTPException(403, "Only verified advocates can view case matches")
    lawyer_id = lawyer_row["id"]

    rows = await fetch(
        """SELECT m.id, m.status, m.ai_explanation, m.agreed_fee,
                  m.client_message, m.created_at, m.case_requirement_id,
                  c.title as case_title, c.case_type,
                  CASE WHEN NOT c.is_anonymous
                       OR (m.payment_status = 'paid' AND m.status IN ('accepted', 'interested'))
                       THEN c.description ELSE NULL END AS description,
                  CASE WHEN NOT c.is_anonymous
                       OR (m.payment_status = 'paid' AND m.status IN ('accepted', 'interested'))
                       THEN c.location ELSE NULL END AS location,
                  c.budget_range, m.payment_status,
                  CASE WHEN c.is_anonymous THEN NULL ELSE c.user_id END as client_user_id
           FROM matches m
           JOIN case_requirements c ON m.case_requirement_id = c.id
           WHERE m.lawyer_id = $1
              AND COALESCE(m.connect_v2, FALSE) = FALSE
           ORDER BY m.created_at DESC""",
        lawyer_id,
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "matches": rows}


class AgreedFeeRequest(BaseModel):
    agreed_fee: float


@router.patch("/matches/{match_id}/agreed-fee")
async def update_agreed_fee(
    match_id: int,
    req: AgreedFeeRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    if not math.isfinite(req.agreed_fee) or req.agreed_fee < 0 or req.agreed_fee > 999_999_999:
        raise HTTPException(422, "Enter an agreed fee between 0 and 999,999,999")
    lawyer = await fetchrow(
        "SELECT id FROM lawyers WHERE user_id=$1 AND verified=TRUE AND verification_status='verified'",
        current_user["id"],
    )
    if not lawyer:
        raise HTTPException(403, "Only verified advocates can record agreed fees")
    row = await fetchrow(
        """UPDATE matches SET agreed_fee=$1, updated_at=NOW()
           WHERE id=$2 AND lawyer_id=$3 AND status='accepted'
           RETURNING id, agreed_fee""",
        req.agreed_fee, match_id, lawyer["id"],
    )
    if not row:
        raise HTTPException(404, "Accepted case not found")
    return {"match_id": row["id"], "agreed_fee": float(row["agreed_fee"])}


# ── Transaction fee endpoints ─────────────────────────────────────────────────

from payments import (
    calc_commission_paise, create_match_order, verify_payment, DEMO_TOKEN,
    demo_payments_enabled, get_client, refund_match_payment,
)


class VerifyMatchPaymentRequest(BaseModel):
    razorpay_order_id: str = ""
    razorpay_payment_id: str = ""
    razorpay_signature: str = ""
    demo_token: str = ""


@router.post("/matches/{match_id}/create-payment")
async def create_match_payment(
    match_id: int,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    row = await fetchrow(
        """SELECT m.*
           FROM matches m
           JOIN case_requirements cr ON m.case_requirement_id = cr.id
           WHERE m.id = $1""",
        match_id,
    )
    if not row:
        raise HTTPException(404, "Match not found")
    if row.get("connect_v2"):
        raise HTTPException(409, "Connect requests do not use platform fees or commissions")
    if row["client_id"] != current_user["id"]:
        raise HTTPException(403, "Not your match")
    if row["status"] not in {"pending", "interested"}:
        raise HTTPException(400, f"Match is already {row['status']}")
    if (row.get("payment_status") or "pending_payment") == "paid":
        return {"already_paid": True}

    amount_paise = calc_commission_paise()
    await execute(
        "UPDATE matches SET commission_amount = $1 WHERE id = $2",
        amount_paise, match_id,
    )
    order = create_match_order(match_id, current_user["id"], amount_paise)
    order["match_id"] = match_id
    order["gst_inclusive"] = True
    return order


@router.post("/matches/{match_id}/verify-payment")
async def verify_match_payment(
    match_id: int,
    req: VerifyMatchPaymentRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    if req.demo_token == DEMO_TOKEN and demo_payments_enabled():
        payment_id = "DEMO_PAID"
    else:
        if not req.razorpay_order_id or not req.razorpay_payment_id or not req.razorpay_signature:
            raise HTTPException(400, "A valid Razorpay payment is required")
        try:
            provider = get_client()
            order = provider.order.fetch(req.razorpay_order_id)
            payment = provider.payment.fetch(req.razorpay_payment_id)
        except Exception:
            raise HTTPException(400, "Failed to fetch order or payment from payment provider")
        notes = order.get("notes") or {}
        if (
            payment.get("order_id") != req.razorpay_order_id
            or payment.get("status") != "captured"
            or order.get("currency") != "INR"
            or payment.get("currency") != "INR"
        ):
            raise HTTPException(400, "Payment is not a captured INR payment")
        ok = verify_payment(req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature)
        if not ok:
            raise HTTPException(400, "Payment verification failed — signature mismatch")
        payment_id = req.razorpay_payment_id

    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                match = await conn.fetchrow(
                    "SELECT * FROM matches WHERE id = $1 FOR UPDATE", match_id
                )
                if not match:
                    raise HTTPException(404, "Match not found")
                if match.get("connect_v2"):
                    raise HTTPException(409, "Connect requests do not use platform fees or commissions")
                if match["client_id"] != current_user["id"]:
                    raise HTTPException(403, "Not your match")
                expected_amount = int(match["commission_amount"] or calc_commission_paise())
                if req.demo_token == DEMO_TOKEN and demo_payments_enabled():
                    pass
                elif (
                    order.get("amount") != expected_amount
                    or payment.get("amount") != expected_amount
                    or str((order.get("notes") or {}).get("match_id")) != str(match_id)
                    or str((order.get("notes") or {}).get("client_id")) != str(current_user["id"])
                ):
                    raise HTTPException(400, "Payment order does not match this match")

                if match["payment_status"] == "paid":
                    if match["commission_payment_id"] != payment_id:
                        raise HTTPException(409, "Match has already been paid")
                else:
                    if payment_id != "DEMO_PAID":
                        used = await conn.fetchval(
                            "SELECT id FROM matches WHERE commission_payment_id = $1 FOR UPDATE",
                            payment_id,
                        )
                        if used and used != match_id:
                            raise HTTPException(409, "This payment has already been used for another match")
                    await conn.execute(
                        """UPDATE matches SET payment_status='paid',
                           commission_payment_id=$1, status='accepted',
                           updated_at=CURRENT_TIMESTAMP WHERE id=$2""",
                        payment_id, match_id,
                    )
                thread = await conn.fetchrow(
                    """INSERT INTO chat_threads (match_id, title)
                       SELECT m.id, COALESCE(cr.title, 'Legal Consultation')
                       FROM matches m LEFT JOIN case_requirements cr ON cr.id=m.case_requirement_id
                       WHERE m.id=$1
                       ON CONFLICT (match_id) DO UPDATE SET match_id=EXCLUDED.match_id
                       RETURNING id""",
                    match_id,
                )
                thread_id = thread["id"] if thread else await conn.fetchval(
                    "SELECT id FROM chat_threads WHERE match_id=$1", match_id
                )
                lawyer_row = await conn.fetchrow(
                    """SELECT l.name, l.phone, u.email FROM lawyers l
                       LEFT JOIN users u ON l.user_id=u.id WHERE l.id=$1""",
                    match["lawyer_id"],
                )
    except HTTPException:
        raise
    except Exception as exc:
        if "commission_payment_id" in str(exc) or "unique" in str(exc).lower():
            raise HTTPException(409, "This payment has already been used for another match")
        raise
    return {
        "success": True,
        "message": "Payment verified. Lawyer contact details revealed!",
        "thread_id": thread_id,
        "lawyer_contact": {
            "name":  lawyer_row["name"]  if lawyer_row else None,
            "phone": lawyer_row["phone"] if lawyer_row else None,
            "email": lawyer_row["email"] if lawyer_row else None,
        },
    }


@router.post("/matches/{match_id}/accept")
async def accept_match(
    match_id: int,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    match = await fetchrow("SELECT * FROM matches WHERE id = $1", match_id)
    if not match:
        raise HTTPException(404, "Match not found")
    if match.get("connect_v2"):
        raise HTTPException(409, "This request uses Advocate Connect; continue from the Connect case flow.")

    lawyer_row = await fetchrow("SELECT id FROM lawyers WHERE user_id = $1", current_user["id"])
    is_lawyer = lawyer_row and lawyer_row["id"] == match["lawyer_id"]
    is_client = match["client_id"] == current_user["id"]

    if not is_lawyer and not is_client:
        raise HTTPException(403, "Not authorized")

    if is_lawyer:
        await execute(
            "UPDATE matches SET status='interested', updated_at=CURRENT_TIMESTAMP WHERE id=$1",
            match_id,
        )
        return {"message": "Interest recorded. The client must complete payment before engagement begins."}

    if is_client:
        ps = (match.get("payment_status") or "pending_payment")
        if ps != "paid":
            raise HTTPException(
                402,
                "Platform connection fee required before accepting. Use /matches/{id}/create-payment",
            )

    return {"message": "Payment verified; the match is active."}


@router.post("/matches/{match_id}/decline")
async def decline_match(
    match_id: int,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    match = await fetchrow("SELECT * FROM matches WHERE id = $1", match_id)
    if not match:
        raise HTTPException(404, "Match not found")
    if match.get("connect_v2"):
        raise HTTPException(409, "This request uses Advocate Connect; continue from the Connect case flow.")

    lawyer_row = await fetchrow("SELECT id FROM lawyers WHERE user_id = $1", current_user["id"])
    is_lawyer = lawyer_row and lawyer_row["id"] == match["lawyer_id"]
    is_client = match["client_id"] == current_user["id"]

    if not is_lawyer and not is_client:
        raise HTTPException(403, "Not authorized")

    refund_pending = False
    if is_lawyer and match.get("payment_status") == "paid":
        created = match.get("updated_at") or match.get("created_at")
        if refund_within_decline_window(created):
            try:
                refund_match_payment(match.get("commission_payment_id"), int(match.get("commission_amount") or calc_commission_paise()))
                await execute(
                    "UPDATE matches SET status='declined', payment_status='refunded', updated_at=CURRENT_TIMESTAMP WHERE id=$1",
                    match_id,
                )
                return {"message": "Match declined and booking fee refunded", "refunded": True}
            except Exception as exc:
                logger.warning("Match refund pending for %s: %s", match_id, type(exc).__name__)
                refund_pending = True
                await execute(
                    """INSERT INTO match_refund_retries
                       (match_id, payment_id, amount_paise, last_error, next_attempt_at)
                       VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)
                       ON CONFLICT (match_id) DO UPDATE SET last_error=EXCLUDED.last_error,
                       next_attempt_at=CURRENT_TIMESTAMP""",
                    match_id, match.get("commission_payment_id"),
                    int(match.get("commission_amount") or calc_commission_paise()), str(exc)[:500],
                )
    await execute(
        "UPDATE matches SET status='declined', updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        match_id,
    )
    return {"message": "Match declined; refund pending reconciliation" if refund_pending else "Match declined",
            "refunded": False, "refund_pending": refund_pending}


# ── Legacy PUT ────────────────────────────────────────────────────────────────

class UpdateMatchRequest(BaseModel):
    status: str  # declined, completed (accepted only through paid flow)
    message: str = ""


@router.put("/matches/{match_id}")
async def update_match(
    match_id: int,
    req: UpdateMatchRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    match = await fetchrow("SELECT * FROM matches WHERE id = $1", match_id)
    if not match:
        raise HTTPException(404, "Match not found")

    # Determine role
    lawyer_row = await fetchrow("SELECT id FROM lawyers WHERE user_id = $1", current_user["id"])
    is_lawyer = lawyer_row and lawyer_row["id"] == match["lawyer_id"]
    is_client = match["client_id"] == current_user["id"]

    if not is_lawyer and not is_client:
        raise HTTPException(403, "Not authorized")
    if req.status not in {"declined", "completed"}:
        raise HTTPException(400, "Only declined or completed status updates are allowed")
    if req.status == "completed" and (match.get("payment_status") or "pending_payment") != "paid":
        raise HTTPException(402, "Platform connection fee required before completing this match")

    update_fields = ["status = $1", "updated_at = CURRENT_TIMESTAMP"]
    params = [req.status]
    idx = 2
    if is_lawyer and req.message:
        update_fields.append(f"lawyer_message = ${idx}")
        params.append(req.message)
        idx += 1
    if is_client and req.message:
        update_fields.append(f"client_message = ${idx}")
        params.append(req.message)
        idx += 1
    params.append(match_id)

    # Safety: update_fields contains only hardcoded column name strings ("status = $1", etc.)
    await execute(
        f"UPDATE matches SET {', '.join(update_fields)} WHERE id = ${idx}",
        *params,
    )
    return {"message": f"Match updated to {req.status}"}
