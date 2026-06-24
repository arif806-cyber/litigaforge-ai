"""
LitigaForge AI — Matching Router
Case requirements, AI lawyer matching, and match management.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import get_current_user
from rate_limit import limiter
from database import fetchrow, fetch, execute, executemany
from sanitizer import sanitize_text
from ai_safety import wrap_user_prompt
from logger import get_logger

logger = get_logger("litigaforge.matching")
router = APIRouter(tags=["matching"])


# ── AI helpers (local copy for matching scoring) ─────────────────────────────

import json
import os
import re
import requests as _req

def _claude(prompt: str, max_tokens: int = 2000) -> str:
    base = os.getenv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "").rstrip("/")
    key  = os.getenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY", "")
    if not base or not key:
        return ""
    try:
        r = _req.post(
            f"{base}/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": "claude-sonnet-4-6", "max_tokens": max_tokens,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=60,
        )
        if r.ok:
            return r.json()["content"][0]["text"]
    except Exception:
        pass
    return ""


def _gemini(prompt: str, max_tokens: int = 2000) -> str:
    base = os.getenv("AI_INTEGRATIONS_GEMINI_BASE_URL", "").rstrip("/")
    key  = os.getenv("AI_INTEGRATIONS_GEMINI_API_KEY", "")
    if not base or not key:
        return ""
    try:
        r = _req.post(
            f"{base}/models/gemini-2.5-flash:generateContent",
            headers={"x-goog-api-key": key},
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"maxOutputTokens": max_tokens}},
            timeout=60,
        )
        if r.ok:
            cands = r.json().get("candidates", [])
            if cands:
                return cands[0]["content"]["parts"][0]["text"]
    except Exception:
        pass
    return ""


def _ai(prompt: str, max_tokens: int = 2000) -> str:
    return _claude(prompt, max_tokens) or _gemini(prompt, max_tokens)


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
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required to post a case")
    try:
        safe_title = sanitize_text(req.title, max_length=200, field_name="title")
        safe_case_type = sanitize_text(req.case_type, max_length=100, field_name="case_type")
        safe_desc = sanitize_text(req.description, max_length=2000, field_name="description")
        safe_location = sanitize_text(req.location, max_length=100, field_name="location")
        safe_budget = sanitize_text(req.budget_range, max_length=50, field_name="budget_range")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    row = await fetchrow(
        """INSERT INTO case_requirements
           (user_id, title, case_type, description, location, budget_range, budget_min, budget_max, is_anonymous, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open')
           RETURNING id, user_id, title, case_type, description, location, budget_range, budget_min, budget_max, is_anonymous, status, created_at""",
        current_user["id"], safe_title, safe_case_type, safe_desc,
        safe_location, safe_budget, req.budget_min, req.budget_max, req.is_anonymous,
    )
    row["created_at"] = str(row["created_at"])
    return {"message": "Case requirement posted successfully", "case": row}


@router.get("/cases/requirements")
async def list_case_requirements(
    current_user: Optional[dict] = Depends(get_current_user),
    case_type: Optional[str] = None,
    status: Optional[str] = None,
):
    conds, params = [], []
    if case_type:
        conds.append("case_type = $" + str(len(params) + 1))
        params.append(case_type)
    if status:
        conds.append("status = $" + str(len(params) + 1))
        params.append(status)
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    rows = await fetch(
        f"""SELECT id, user_id, title, case_type, description, location,
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
    is_anonymous: bool = False


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
    if body.title:
        fields.append(f"title = ${len(params)+1}")
        params.append(sanitize_text(body.title, max_length=200, field_name="title"))
    if body.case_type:
        fields.append(f"case_type = ${len(params)+1}")
        params.append(sanitize_text(body.case_type, max_length=100, field_name="case_type"))
    if body.description != "":
        fields.append(f"description = ${len(params)+1}")
        params.append(sanitize_text(body.description, max_length=2000, field_name="description"))
    if body.location != "":
        fields.append(f"location = ${len(params)+1}")
        params.append(sanitize_text(body.location, max_length=100, field_name="location"))
    if body.budget_range != "":
        fields.append(f"budget_range = ${len(params)+1}")
        params.append(sanitize_text(body.budget_range, max_length=50, field_name="budget_range"))
    if body.is_anonymous is not None:
        fields.append(f"is_anonymous = ${len(params)+1}")
        params.append(body.is_anonymous)
    if not fields:
        raise HTTPException(400, "No fields to update")
    query = f"UPDATE case_requirements SET {', '.join(fields)} WHERE id = ${len(params)+1} RETURNING *"
    params.append(req_id)
    row = await fetchrow(query, *params)
    row["created_at"] = str(row["created_at"])
    return {"message": "Case requirement updated", "case": row}


# ── AI Matching Engine ──────────────────────────────────────────────────────

class MatchRequest(BaseModel):
    case_requirement_id: int


@router.post("/match/find-lawyers")
@limiter.limit("10/minute")
async def ai_match_lawyers(
    req: MatchRequest,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    # Fetch case requirement
    case = await fetchrow(
        "SELECT * FROM case_requirements WHERE id = $1 AND user_id = $2",
        req.case_requirement_id, current_user["id"],
    )
    if not case:
        raise HTTPException(404, "Case requirement not found")

    # Fetch all verified lawyers
    lawyers = await fetch(
        """SELECT id, name, district, practice_areas, languages,
                  experience_years, rating, bio, hourly_rate, availability, verification_status
           FROM lawyers WHERE availability = 'available' AND verification_status = 'verified'
           ORDER BY rating DESC, experience_years DESC""",
    )

    if not lawyers:
        return {"case_id": req.case_requirement_id, "matches": [], "message": "No verified lawyers available at the moment. Please try again later."}

    # Compute match scores
    case_type = case.get("case_type", "").lower()
    case_location = case.get("location", "").lower()

    scored = []
    for l in lawyers:
        score = 0
        reasons = []
        pas = [p.lower() for p in l.get("practice_areas", [])]
        if case_type in pas:
            score += 40
            reasons.append(f"Specialises in {case_type.title()}")
        elif any(ct in p for ct in case_type.split() for p in pas):
            score += 25
            reasons.append("Related practice area overlap")
        if l.get("experience_years", 0) >= 10:
            score += 20
            reasons.append(f"{l['experience_years']}+ years experience")
        elif l.get("experience_years", 0) >= 5:
            score += 10
            reasons.append(f"{l['experience_years']}+ years experience")
        if case_location and l.get("district", "").lower() in case_location:
            score += 20
            reasons.append(f"Based in {l['district']}")
        elif case_location and any(c in l.get("district", "").lower() for c in case_location.split()):
            score += 10
            reasons.append("Nearby location")
        rating = float(l.get("rating", 0) or 0)
        if rating >= 4.5:
            score += 10
            reasons.append(f"Excellent rating ({rating})")
        elif rating >= 4.0:
            score += 5
            reasons.append(f"Strong rating ({rating})")

        l["match_score"] = min(score, 100)
        l["match_reasons"] = reasons
        scored.append(l)

    scored.sort(key=lambda x: x["match_score"], reverse=True)
    top = scored[:10]

    # AI explanation for top 3
    if top:
        top_3 = top[:3]
        lawyer_summary = "\n".join(
            f"- {l['name']} ({l['district']}, {l['experience_years']} yrs, rating {l['rating']}, practices: {', '.join(l['practice_areas'][:3])})"
            for l in top_3
        )
        prompt = f"""You are an AI legal assistant matching a client with lawyers.

Client needs: {case['case_type']} in {case.get('location', 'unspecified location')}
Description: {case.get('description', 'No description')}

Top matched lawyers:
{lawyer_summary}

Write 2-3 sentences for EACH lawyer explaining why they are a good match, focusing on their expertise and location. Return ONLY a JSON array where each element is {{"lawyer_id": int, "explanation": str}}."""

        raw = _ai(prompt, 1500)
        try:
            explanations = _extract_json_array(raw)
            for exp in explanations:
                for l in top:
                    if l["id"] == exp.get("lawyer_id"):
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
            """INSERT INTO matches (case_requirement_id, lawyer_id, client_id, match_score, ai_explanation, status)
               VALUES ($1, $2, $3, $4, $5, 'pending')
               ON CONFLICT DO NOTHING""",
            match_inserts,
        )

    return {
        "case_id": req.case_requirement_id,
        "case_title": case.get("title", ""),
        "total_matches": len(top),
        "matches": [{k: l[k] for k in l if k not in ("user_id",)} for l in top],
    }


# ── Match Management ──────────────────────────────────────────────────────────

@router.get("/matches/client")
async def client_matches(current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(401, "Login required")
    rows = await fetch(
        """SELECT m.id, m.status, m.match_score, m.ai_explanation,
                  m.client_message, m.lawyer_message, m.created_at,
                  m.payment_status, m.commission_amount,
                  c.title as case_title, c.case_type, c.budget_range,
                  l.id as lawyer_id, l.name as lawyer_name, l.district,
                  l.practice_areas, l.experience_years, l.rating, l.hourly_rate,
                  CASE WHEN m.payment_status = 'paid' THEN l.phone ELSE NULL END as lawyer_phone,
                  CASE WHEN m.payment_status = 'paid' THEN l.email ELSE NULL END as lawyer_email
           FROM matches m
           JOIN case_requirements c ON m.case_requirement_id = c.id
           JOIN lawyers l ON m.lawyer_id = l.id
           WHERE m.client_id = $1
           ORDER BY m.match_score DESC, m.created_at DESC""",
        current_user["id"],
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "matches": rows}


@router.get("/matches/lawyer")
async def lawyer_matches(current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(401, "Login required")
    # Check if current user is a registered lawyer
    lawyer_row = await fetchrow("SELECT id FROM lawyers WHERE user_id = $1", current_user["id"])
    if not lawyer_row:
        return {"total": 0, "matches": [], "message": "Complete your lawyer profile to receive match notifications"}
    lawyer_id = lawyer_row["id"]

    rows = await fetch(
        """SELECT m.id, m.status, m.match_score, m.ai_explanation,
                  m.client_message, m.created_at, m.case_requirement_id,
                  c.title as case_title, c.case_type, c.description, c.location, c.budget_range,
                  CASE WHEN c.is_anonymous THEN NULL ELSE c.user_id END as client_user_id
           FROM matches m
           JOIN case_requirements c ON m.case_requirement_id = c.id
           WHERE m.lawyer_id = $1
           ORDER BY m.match_score DESC, m.created_at DESC""",
        lawyer_id,
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "matches": rows}


# ── Transaction fee endpoints ─────────────────────────────────────────────────

from payments import calc_commission_paise, create_match_order, verify_payment, DEMO_TOKEN


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
        """SELECT m.*, cr.budget_range
           FROM matches m
           JOIN case_requirements cr ON m.case_requirement_id = cr.id
           WHERE m.id = $1""",
        match_id,
    )
    if not row:
        raise HTTPException(404, "Match not found")
    if row["client_id"] != current_user["id"]:
        raise HTTPException(403, "Not your match")
    if row["status"] != "pending":
        raise HTTPException(400, f"Match is already {row['status']}")
    if (row.get("payment_status") or "pending_payment") == "paid":
        return {"already_paid": True}

    amount_paise = calc_commission_paise(row.get("budget_range") or "")
    await execute(
        "UPDATE matches SET commission_amount = $1 WHERE id = $2",
        amount_paise, match_id,
    )
    order = create_match_order(match_id, current_user["id"], amount_paise)
    order["match_id"] = match_id
    return order


@router.post("/matches/{match_id}/verify-payment")
async def verify_match_payment(
    match_id: int,
    req: VerifyMatchPaymentRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    match = await fetchrow("SELECT * FROM matches WHERE id = $1", match_id)
    if not match:
        raise HTTPException(404, "Match not found")
    if match["client_id"] != current_user["id"]:
        raise HTTPException(403, "Not your match")

    if req.demo_token == DEMO_TOKEN:
        payment_id = "DEMO_PAID"
    else:
        ok = verify_payment(req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature)
        if not ok:
            raise HTTPException(400, "Payment verification failed — signature mismatch")
        payment_id = req.razorpay_payment_id

    await execute(
        """UPDATE matches
           SET payment_status = 'paid',
               commission_payment_id = $1,
               status = 'accepted',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2""",
        payment_id, match_id,
    )

    lawyer_row = await fetchrow(
        """SELECT l.name, l.phone, u.email
           FROM lawyers l
           LEFT JOIN users u ON l.user_id = u.id
           WHERE l.id = $1""",
        match["lawyer_id"],
    )
    return {
        "success": True,
        "message": "Payment verified. Lawyer contact details revealed!",
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

    lawyer_row = await fetchrow("SELECT id FROM lawyers WHERE user_id = $1", current_user["id"])
    is_lawyer = lawyer_row and lawyer_row["id"] == match["lawyer_id"]
    is_client = match["client_id"] == current_user["id"]

    if not is_lawyer and not is_client:
        raise HTTPException(403, "Not authorized")

    if is_client:
        ps = (match.get("payment_status") or "pending_payment")
        if ps != "paid":
            raise HTTPException(
                402,
                "Platform connection fee required before accepting. Use /matches/{id}/create-payment",
            )

    await execute(
        "UPDATE matches SET status='accepted', updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        match_id,
    )

    # Auto-create a chat thread for this match (idempotent)
    existing_thread = await fetchrow(
        "SELECT id FROM chat_threads WHERE match_id = $1", match_id
    )
    if existing_thread:
        thread_id = existing_thread["id"]
    else:
        case_row = await fetchrow(
            """SELECT cr.title FROM case_requirements cr
               JOIN matches m ON m.case_requirement_id = cr.id
               WHERE m.id = $1""",
            match_id,
        )
        case_title = case_row["title"] if case_row else "Legal Consultation"
        new_thread = await fetchrow(
            "INSERT INTO chat_threads (match_id, title) VALUES ($1, $2) RETURNING id",
            match_id, case_title,
        )
        thread_id = new_thread["id"] if new_thread else None

    return {"message": "Match accepted", "thread_id": thread_id}


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

    lawyer_row = await fetchrow("SELECT id FROM lawyers WHERE user_id = $1", current_user["id"])
    is_lawyer = lawyer_row and lawyer_row["id"] == match["lawyer_id"]
    is_client = match["client_id"] == current_user["id"]

    if not is_lawyer and not is_client:
        raise HTTPException(403, "Not authorized")

    await execute(
        "UPDATE matches SET status='declined', updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        match_id,
    )
    return {"message": "Match declined"}


# ── Legacy PUT ────────────────────────────────────────────────────────────────

class UpdateMatchRequest(BaseModel):
    status: str  # accepted, declined, completed
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

    await execute(
        f"UPDATE matches SET {', '.join(update_fields)} WHERE id = ${idx}",
        *params,
    )
    return {"message": f"Match updated to {req.status}"}
