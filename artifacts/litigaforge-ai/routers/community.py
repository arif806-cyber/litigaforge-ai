"""
LitigaForge AI — Community Router
Legal Q&A, document analyzer, judgment finder, lawyer directory, legal aid.
"""
import json
import logging
import os
import re
from typing import List, Optional

import requests as _req
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from auth import get_current_user
from rate_limit import limiter
from database import fetchrow, fetch
from sanitizer import sanitize_text
from ai_safety import wrap_user_prompt, add_disclaimer, validate_ai_response
from jurisdiction import (
    get_config, advisor_descriptor, jurisdiction_block,
    caselaw_provider, caselaw_link, normalize_code,
)

logger = logging.getLogger("litigaforge.community")
router = APIRouter(tags=["community"])


# ── AI helpers ──────────────────────────────────────────────────────────────────────

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


# ── Legal Q&A ─────────────────────────────────────────────────────────────────────

class QuestionRequest(BaseModel):
    question: str
    category: str = "general"
    country: str = "IN"


@router.post("/ask")
@limiter.limit("20/minute")
async def ask_legal_question(req: QuestionRequest,
                             request: Request,
                             current_user: Optional[dict] = Depends(get_current_user)):
    try:
        safe_question = sanitize_text(req.question, max_length=1000, field_name="question")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    cfg = get_config(req.country)
    prompt = f"""You are {advisor_descriptor(req.country)}.

{jurisdiction_block(req.country)}

QUESTION: {safe_question}

Provide a thorough, practical answer in this format:

**SUMMARY**
(One-paragraph overview of the legal position under {cfg['name']} law)

**APPLICABLE LAW**
(Relevant {cfg['name']} acts, sections, and rules — cite specific statutes and provisions)

**PROCEDURE**
(Jurisdiction-specific steps, offices, courts/forums, or timelines if relevant)

**PRACTICAL NEXT STEPS**
1. …
2. …
3. …

**WHEN TO HIRE A LAWYER**
(Specific situations in this matter that require in-person legal counsel)

Be specific, cite real {cfg['name']} law, and avoid unhelpful generic disclaimers."""

    answer = _ai(wrap_user_prompt(prompt), 1800)
    answer = validate_ai_response(answer)
    answer = add_disclaimer(answer)
    if not answer.strip():
        answer = "Our AI advisors are temporarily busy. Please try again in a moment, or consult a local advocate directly."

    uid = current_user["id"] if current_user else None
    country = normalize_code(req.country)
    row = await fetchrow(
        "INSERT INTO legal_questions (user_id, question, category, ai_answer, country) "
        "VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at",
        uid, safe_question, req.category, answer, country,
    )
    return {
        "id": row["id"],
        "question": safe_question,
        "category": req.category,
        "country": country,
        "answer": answer,
        "created_at": str(row["created_at"]),
    }


@router.get("/ask")
async def list_questions(response: Response, limit: int = 20, category: Optional[str] = None, country: str = "IN"):
    response.headers["Cache-Control"] = "public, max-age=3600"
    cc = normalize_code(country)
    if category and category != "all":
        rows = await fetch(
            "SELECT id, question, category, ai_answer, country, upvotes, created_at "
            "FROM legal_questions WHERE category=$1 AND country=$2 ORDER BY created_at DESC LIMIT $3",
            category, cc, limit,
        )
    else:
        rows = await fetch(
            "SELECT id, question, category, ai_answer, country, upvotes, created_at "
            "FROM legal_questions WHERE country=$1 ORDER BY created_at DESC LIMIT $2",
            cc, limit,
        )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "country": cc, "questions": rows}


# ── Document Analyzer ────────────────────────────────────────────────────────────────────

class DocumentRequest(BaseModel):
    document_text: str
    document_type: str = "contract"
    country: str = "IN"


@router.post("/document/analyze")
@limiter.limit("10/minute")
async def analyze_document(req: DocumentRequest, request: Request):
    try:
        safe_text = sanitize_text(req.document_text, max_length=8000, field_name="document_text")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if len(safe_text.strip()) < 50:
        raise HTTPException(400, "Document too short — paste at least 50 characters")

    cfg = get_config(req.country)
    prompt = f"""You are {advisor_descriptor(req.country)} reviewing a {req.document_type}.

{jurisdiction_block(req.country)}

Analyze the following {req.document_type} under {cfg['name']} law and return ONLY a valid JSON object with this exact structure:

{{
  "risk_score": 0-100,
  "missing_clauses": ["list"],
  "red_flags": ["list"],
  "recommendations": ["list"],
  "compliance_notes": "string — note compliance specifically under {cfg['name']} law",
  "summary": "string"
}}

Document text:
---
{safe_text[:8000]}
---"""

    raw = _ai(wrap_user_prompt(prompt), 2500)
    raw = validate_ai_response(raw)
    try:
        result = _extract_json_object(raw)
    except Exception:
        result = {
            "risk_score": 50,
            "missing_clauses": [],
            "red_flags": ["Could not parse AI output"],
            "recommendations": ["Please review manually or try again"],
            "compliance_notes": "AI parsing failed — manual review recommended.",
            "summary": "Analysis could not be completed automatically.",
        }
    return {"analysis": result, "document_type": req.document_type}


# ── Judgment Finder ────────────────────────────────────────────────────────────────────

class JudgmentSearchRequest(BaseModel):
    query: str
    court: str = ""
    country: str = "IN"


@router.post("/judgments/search")
@limiter.limit("10/minute")
async def search_judgments(req: JudgmentSearchRequest, request: Request):
    try:
        safe_query = sanitize_text(req.query, max_length=500, field_name="query")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if len(safe_query.strip()) < 5:
        raise HTTPException(400, "Search query too short")

    cfg = get_config(req.country)
    prov_name, _ = caselaw_provider(req.country)
    courts = ", ".join(cfg.get("courts", [])) or "the relevant courts"
    court_note = f" Prioritise {req.court} judgments." if req.court else \
        f" Include the apex and appellate courts of {cfg['name']} ({courts}) and landmark judgments."

    prompt = f"""You are an expert in {cfg['name']} case law and legal research.

SEARCH QUERY: {safe_query}{court_note}

Return ONLY a valid JSON array of 5 highly relevant {cfg['name']} court judgments:
[
  {{
    "case_name": "Full case title — Party A v Party B",
    "citation": "a real citation in the standard {cfg['name']} format",
    "court": "a real {cfg['name']} court",
    "year": YYYY,
    "holding": "The core legal principle settled by this case — 3 to 4 specific sentences",
    "relevance": "Why this judgment directly applies to the query — 1 to 2 sentences",
    "search_query": "2–4 word search term"
  }}
]

Use real, verifiable {cfg['name']} citations where known. Prefer landmark judgments that lawyers actually cite."""

    raw = _ai(wrap_user_prompt(prompt), 3000)
    raw = validate_ai_response(raw)
    try:
        judgments = _extract_json_array(raw)
    except Exception:
        judgments = []

    for j in judgments:
        q = j.get("search_query") or j.get("ik_query") or j.get("case_name") or safe_query
        j["ik_link"] = caselaw_link(req.country, q)
        j["source_name"] = prov_name

    return {"query": safe_query, "total": len(judgments), "source_name": prov_name, "judgments": judgments}


# ── Lawyer Directory ────────────────────────────────────────────────────────────────────

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
    response: Response,
    district: Optional[str] = None,
    practice_area: Optional[str] = None,
    language: Optional[str] = None,
    search: Optional[str] = None,
):
    response.headers["Cache-Control"] = "public, max-age=3600"
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


# ── Legal Aid contacts (static + eligibility) ─────────────────────────────────────────────

@router.get("/legal-aid/contacts")
async def legal_aid_contacts(response: Response):
    response.headers["Cache-Control"] = "public, max-age=3600"
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
