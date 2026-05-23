"""
LitigaForge AI — Extra Community Feature Routes
- Legal Q&A with AI (Claude/Gemini)
- Document Analyzer
- Judgment Finder (AI-powered citations + IndianKanoon links)
- Lawyer Directory
- Free Legal Aid contacts
"""
import json
import logging
import os
import re
from typing import List, Optional

import requests as _req
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import get_current_user
from rate_limit import limiter
from database import fetchrow, fetch, execute, executemany

logger = logging.getLogger("litigaforge.extra")
router = APIRouter()


# ── AI helpers ─────────────────────────────────────────────────────────────────

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
        logger.warning("Claude HTTP %s: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("Claude error: %s", e)
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
    except Exception as e:
        logger.warning("Gemini error: %s", e)
    return ""


def _ai(prompt: str, max_tokens: int = 2000) -> str:
    """Claude → Gemini cascade."""
    return _claude(prompt, max_tokens) or _gemini(prompt, max_tokens)


def _extract_json_object(text: str) -> dict:
    m = re.search(r'\{.*\}', text, re.DOTALL)
    return json.loads(m.group()) if m else {}


def _extract_json_array(text: str) -> list:
    m = re.search(r'\[.*\]', text, re.DOTALL)
    return json.loads(m.group()) if m else []


# ── Legal Q&A ──────────────────────────────────────────────────────────────────

class QuestionRequest(BaseModel):
    question: str
    category: str = "general"


@router.post("/ask")
@limiter.limit("20/minute")
async def ask_legal_question(req: QuestionRequest,
                             request: Request,
                             current_user: Optional[dict] = Depends(get_current_user)):
    if len(req.question.strip()) < 10:
        raise HTTPException(400, "Question is too short")

    prompt = f"""You are a senior Indian legal advisor specialising in Telangana and Andhra Pradesh law.

CLIENT QUESTION: {req.question.strip()}
CATEGORY: {req.category}

Structure your answer clearly:

**DIRECT ANSWER**
(2–3 clear sentences answering the question)

**APPLICABLE LAW**
(Relevant Indian acts, sections, and rules — e.g. Transfer of Property Act 1882 s.54, CrPC s.156, GST Act s.73)

**TELANGANA / AP PROCEDURE**
(State-specific steps, offices, or timelines if relevant)

**PRACTICAL NEXT STEPS**
1. …
2. …
3. …

**WHEN TO HIRE A LAWYER**
(Specific situations in this matter that require in-person legal counsel)

Be specific, cite real law, and avoid unhelpful generic disclaimers."""

    answer = _ai(prompt, 1800)
    if not answer:
        answer = "Our AI advisors are temporarily busy. Please try again in a moment, or consult a local advocate directly."

    uid = current_user["id"] if current_user else None
    row = await fetchrow(
        "INSERT INTO legal_questions (user_id, question, category, ai_answer) "
        "VALUES ($1, $2, $3, $4) RETURNING id, created_at",
        uid, req.question.strip(), req.category, answer,
    )
    return {
        "id": row["id"],
        "question": req.question,
        "category": req.category,
        "answer": answer,
        "created_at": str(row["created_at"]),
    }


@router.get("/ask")
async def list_questions(limit: int = 20, category: Optional[str] = None):
    if category and category != "all":
        rows = await fetch(
            "SELECT id, question, category, ai_answer, upvotes, created_at "
            "FROM legal_questions WHERE category=$1 ORDER BY created_at DESC LIMIT $2",
            category, limit,
        )
    else:
        rows = await fetch(
            "SELECT id, question, category, ai_answer, upvotes, created_at "
            "FROM legal_questions ORDER BY created_at DESC LIMIT $1",
            limit,
        )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "questions": rows}


# ── Document Analyzer ──────────────────────────────────────────────────────────

class DocumentRequest(BaseModel):
    document_text: str
    document_type: str = "contract"


@router.post("/document/analyze")
@limiter.limit("10/minute")
async def analyze_document(req: DocumentRequest, request: Request):
    text = req.document_text.strip()
    if len(text) < 50:
        raise HTTPException(400, "Document text is too short to analyse")

    snippet = text[:8000]

    prompt = f"""You are a senior Indian legal professional specialising in Telangana/AP law.

Analyse this {req.document_type} and return ONLY valid JSON with this exact structure:

{{
  "summary": "2–3 sentence executive summary of what this document is and its key purpose",
  "risk_score": 6,
  "risks": [
    {{"severity": "HIGH", "issue": "Specific legal risk", "section": "Clause or section reference if visible"}}
  ],
  "missing_clauses": ["Important clause or provision that is absent"],
  "jurisdiction_issues": ["Venue, governing law, or jurisdiction concern if any"],
  "recommendations": ["Specific action — e.g. Add a dispute resolution clause", "..."]
}}

Risk score: 1 (very safe) to 10 (extremely risky). Be specific to Indian law and Telangana/AP jurisdiction.

DOCUMENT:
{snippet}"""

    raw = _ai(prompt, 2500)
    try:
        result = _extract_json_object(raw)
    except Exception:
        result = {}

    if not result:
        result = {
            "summary": raw[:400] if raw else "Analysis unavailable",
            "risk_score": 5,
            "risks": [],
            "missing_clauses": [],
            "jurisdiction_issues": [],
            "recommendations": ["Review with a qualified advocate before signing"],
        }

    return result


# ── Judgment Finder ────────────────────────────────────────────────────────────

class JudgmentSearchRequest(BaseModel):
    query: str
    court: Optional[str] = None


@router.post("/judgments/search")
@limiter.limit("10/minute")
async def search_judgments(req: JudgmentSearchRequest, request: Request):
    if len(req.query.strip()) < 5:
        raise HTTPException(400, "Search query too short")

    court_note = f" Prioritise {req.court} judgments." if req.court else \
        " Include Supreme Court, Telangana/AP High Court, and landmark District Court judgments."

    prompt = f"""You are an expert in Indian case law and legal research.

SEARCH QUERY: {req.query.strip()}{court_note}

Return ONLY a valid JSON array of 5 highly relevant Indian court judgments:
[
  {{
    "case_name": "Full case title — Party A v Party B",
    "citation": "AIR YYYY SC XXXX or (YYYY) X SCC XXX or YYYY SCC OnLine Tel XXXX",
    "court": "Supreme Court of India / Telangana High Court / AP High Court / etc.",
    "year": YYYY,
    "holding": "The core legal principle settled by this case — 3 to 4 specific sentences",
    "relevance": "Why this judgment directly applies to the query — 1 to 2 sentences",
    "ik_query": "2–4 word search for IndianKanoon"
  }}
]

Use real, verifiable citations where known. Prefer landmark judgments that advocates actually cite."""

    raw = _ai(prompt, 3000)
    try:
        judgments = _extract_json_array(raw)
    except Exception:
        judgments = []

    for j in judgments:
        q = j.get("ik_query", j.get("case_name", req.query)).replace(" ", "+")
        j["ik_link"] = f"https://indiankanoon.org/search/?formInput={q}&type=judgments"

    return {"query": req.query, "total": len(judgments), "judgments": judgments}


# ── Lawyer Directory ───────────────────────────────────────────────────────────

class LawyerRegisterRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    district: str
    practice_areas: List[str]
    languages: List[str] = ["English"]
    experience_years: int = 0
    bio: str = ""
    bar_number: Optional[str] = None
    hourly_rate: Optional[int] = None


@router.get("/lawyers")
async def list_lawyers(
    district: Optional[str] = None,
    practice_area: Optional[str] = None,
    language: Optional[str] = None,
    search: Optional[str] = None,
):
    conds, params = ["verified = TRUE"], []
    if district:
        conds.append("district ILIKE $" + str(len(params) + 2))
        params.append(f"%{district}%")
    if practice_area:
        conds.append("$" + str(len(params) + 2) + " = ANY(practice_areas)")
        params.append(practice_area)
    if language:
        conds.append("$" + str(len(params) + 2) + " = ANY(languages)")
        params.append(language)
    if search:
        conds.append("(name ILIKE $" + str(len(params) + 2) + " OR bio ILIKE $" + str(len(params) + 3) + ")")
        params.extend([f"%{search}%", f"%{search}%"])

    where = "WHERE " + " AND ".join(conds)
    rows = await fetch(
        f"SELECT id, name, email, phone, bar_number, district, practice_areas, "
        f"languages, experience_years, rating, bio, hourly_rate, availability, "
        f"verification_status, verified, created_at "
        f"FROM lawyers {where} ORDER BY verified DESC, rating DESC, experience_years DESC LIMIT 50",
        *params,
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "lawyers": rows}


@router.post("/lawyers/register")
async def register_lawyer(
    req: LawyerRegisterRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required to register as an advocate")
    row = await fetchrow(
        """INSERT INTO lawyers
           (user_id, name, email, phone, bar_number, district, practice_areas, languages, experience_years, bio, hourly_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           RETURNING id, name, district, verified""",
        current_user["id"], req.name, req.email, req.phone, req.bar_number, req.district,
        req.practice_areas, req.languages, req.experience_years, req.bio, req.hourly_rate,
    )
    return {
        "message": "Advocate profile submitted. It will appear once verified by our team.",
        "lawyer": row,
    }


# ── Case Requirements (Client posts legal needs) ───────────────────────────────

class CaseRequirementRequest(BaseModel):
    title: str
    case_type: str
    description: str = ""
    location: str = ""
    budget_range: str = ""
    is_anonymous: bool = False


@router.post("/cases/requirements")
async def create_case_requirement(
    req: CaseRequirementRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required to post a case")
    row = await fetchrow(
        """INSERT INTO case_requirements
           (user_id, title, case_type, description, location, budget_range, is_anonymous, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
           RETURNING id, user_id, title, case_type, description, location, budget_range, is_anonymous, status, created_at""",
        current_user["id"], req.title, req.case_type, req.description,
        req.location, req.budget_range, req.is_anonymous,
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


# ── AI Matching Engine ────────────────────────────────────────────────────────

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
        return {"case_id": req.case_requirement_id, "matches": [], "message": "No verified lawyers available at the moment."}

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
                  c.title as case_title, c.case_type,
                  l.id as lawyer_id, l.name as lawyer_name, l.district, l.phone, l.email, l.practice_areas, l.experience_years, l.rating
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
                  m.client_message, m.created_at,
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


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatThreadRequest(BaseModel):
    match_id: int
    title: str = ""


class ChatMessageRequest(BaseModel):
    thread_id: int
    content: str


@router.post("/chat/threads")
async def create_chat_thread(
    req: ChatThreadRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    match = await fetchrow(
        """SELECT * FROM matches WHERE id = $1 AND (client_id = $2 OR lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $3))""",
        req.match_id, current_user["id"], current_user["id"],
    )
    if not match:
        raise HTTPException(403, "Not authorized for this match")

    row = await fetchrow(
        """INSERT INTO chat_threads (match_id, title)
           VALUES ($1, $2)
           RETURNING id, match_id, title, created_at""",
        req.match_id, req.title or "Legal Consultation",
    )
    row["created_at"] = str(row["created_at"])
    return {"thread": row}


@router.get("/chat/threads")
async def list_chat_threads(current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(401, "Login required")
    rows = await fetch(
        """SELECT t.id, t.title, t.created_at,
                  m.case_requirement_id, m.lawyer_id, m.client_id,
                  c.title as case_title, l.name as lawyer_name
           FROM chat_threads t
           JOIN matches m ON t.match_id = m.id
           JOIN case_requirements c ON m.case_requirement_id = c.id
           JOIN lawyers l ON m.lawyer_id = l.id
           WHERE m.client_id = $1 OR m.lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $2)
           ORDER BY t.created_at DESC""",
        current_user["id"], current_user["id"],
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "threads": rows}


@router.post("/chat/messages")
async def send_chat_message(
    req: ChatMessageRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    auth = await fetchrow(
        """SELECT m.id FROM matches m
           JOIN chat_threads t ON t.match_id = m.id
           WHERE t.id = $1 AND (m.client_id = $2 OR m.lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $3))""",
        req.thread_id, current_user["id"], current_user["id"],
    )
    if not auth:
        raise HTTPException(403, "Not authorized")

    row = await fetchrow(
        """INSERT INTO chat_messages (thread_id, sender_id, sender_role, content)
           VALUES ($1, $2, 'user', $3)
           RETURNING id, thread_id, sender_id, sender_role, content, created_at""",
        req.thread_id, current_user["id"], req.content,
    )
    row["created_at"] = str(row["created_at"])
    return {"message": row}


@router.get("/chat/threads/{thread_id}/messages")
async def get_chat_messages(
    thread_id: int,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    auth = await fetchrow(
        """SELECT m.id FROM matches m
           JOIN chat_threads t ON t.match_id = m.id
           WHERE t.id = $1 AND (m.client_id = $2 OR m.lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $3))""",
        thread_id, current_user["id"], current_user["id"],
    )
    if not auth:
        raise HTTPException(403, "Not authorized")

    rows = await fetch(
        """SELECT id, thread_id, sender_id, sender_role, content, created_at
           FROM chat_messages WHERE thread_id = $1 ORDER BY created_at ASC""",
        thread_id,
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "messages": rows}


# ── AI Legal Chat / Drafting ─────────────────────────────────────────────────

class AIChatRequest(BaseModel):
    message: str
    context: str = ""
    thread_id: Optional[int] = None


@router.post("/ai-legal-chat")
async def ai_legal_chat(
    req: AIChatRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")

    system_prompt = """You are LitigaForge AI, a legal assistant for the Indian legal system, specifically for Telangana and Andhra Pradesh. 
You help advocates and clients with legal drafting, procedural guidance, and case analysis.

IMPORTANT: Always include this disclaimer at the end of your response:
"This is AI-generated guidance only. Please verify with a qualified lawyer before acting. This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice."

Be concise, accurate, and cite relevant Indian laws (IPC, CrPC, CPC, specific state acts) where applicable."""

    user_prompt = req.message
    if req.context:
        user_prompt = f"Context: {req.context}\n\nQuestion: {req.message}"

    full_prompt = f"{system_prompt}\n\n{user_prompt}"
    response = _ai(full_prompt, 2500)

    if req.thread_id:
        await execute(
            """INSERT INTO chat_messages (thread_id, sender_id, sender_role, content)
               VALUES ($1, NULL, 'ai', $2)""",
            req.thread_id, response,
        )

    return {"reply": response, "disclaimer": "AI-generated guidance only. Verify with a qualified lawyer."}


# ── Legal Aid contacts (static + eligibility) ──────────────────────────────────

@router.get("/legal-aid/contacts")
async def legal_aid_contacts():
    return {
        "national": {
            "name": "NALSA — National Legal Services Authority",
            "helpline": "15100",
            "website": "https://nalsa.gov.in",
            "eligibility": [
                "Annual income below ₹3,00,000",
                "SC / ST community members",
                "Women and children",
                "Persons with disabilities",
                "Victims of trafficking / mass disaster",
                "Industrial workmen",
                "Persons in custody",
            ],
        },
        "telangana": {
            "name": "Telangana State Legal Services Authority (TSLSA)",
            "website": "https://tslsa.telangana.gov.in",
            "address": "High Court of Telangana Campus, Hyderabad – 500004",
            "phone": "+91-40-23450027",
        },
        "districts": [
            {"district": "Hyderabad", "dlsa": "DLSA Hyderabad", "phone": "+91-40-23219999",
             "address": "City Civil Court Campus, Nampally, Hyderabad"},
            {"district": "Rangareddy", "dlsa": "DLSA Rangareddy", "phone": "+91-40-24010073",
             "address": "District Courts Complex, Jubilee Hills, Hyderabad"},
            {"district": "Warangal", "dlsa": "DLSA Warangal", "phone": "+91-870-2578901",
             "address": "District Court Campus, Warangal"},
            {"district": "Karimnagar", "dlsa": "DLSA Karimnagar", "phone": "+91-878-2234567",
             "address": "District Courts, Karimnagar"},
            {"district": "Khammam", "dlsa": "DLSA Khammam", "phone": "+91-8742-234890",
             "address": "District Court Complex, Khammam"},
            {"district": "Nizamabad", "dlsa": "DLSA Nizamabad", "phone": "+91-8462-220345",
             "address": "District Court Campus, Nizamabad"},
            {"district": "Nalgonda", "dlsa": "DLSA Nalgonda", "phone": "+91-8682-234567",
             "address": "District Courts, Nalgonda"},
            {"district": "Medak", "dlsa": "DLSA Medak", "phone": "+91-8452-224567",
             "address": "District Court Complex, Sangareddy"},
        ],
        "other_resources": [
            {"name": "Telangana Women Helpline", "phone": "181"},
            {"name": "Child Helpline", "phone": "1098"},
            {"name": "Police Control Room", "phone": "100"},
            {"name": "Senior Citizens Helpline", "phone": "14567"},
        ],
    }
