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

import psycopg2
import psycopg2.extras
import requests as _req
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user

logger = logging.getLogger("litigaforge.extra")
router = APIRouter()

DATABASE_URL = os.getenv("DATABASE_URL")


def _conn():
    return psycopg2.connect(DATABASE_URL)


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
async def ask_legal_question(req: QuestionRequest,
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

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            uid = current_user["id"] if current_user else None
            cur.execute(
                "INSERT INTO legal_questions (user_id, question, category, ai_answer) "
                "VALUES (%s,%s,%s,%s) RETURNING id, created_at",
                (uid, req.question.strip(), req.category, answer),
            )
            row = dict(cur.fetchone())
            conn.commit()
    finally:
        conn.close()

    return {
        "id": row["id"],
        "question": req.question,
        "category": req.category,
        "answer": answer,
        "created_at": str(row["created_at"]),
    }


@router.get("/ask")
async def list_questions(limit: int = 20, category: Optional[str] = None):
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if category and category != "all":
                cur.execute(
                    "SELECT id, question, category, ai_answer, upvotes, created_at "
                    "FROM legal_questions WHERE category=%s ORDER BY created_at DESC LIMIT %s",
                    (category, limit),
                )
            else:
                cur.execute(
                    "SELECT id, question, category, ai_answer, upvotes, created_at "
                    "FROM legal_questions ORDER BY created_at DESC LIMIT %s",
                    (limit,),
                )
            rows = [dict(r) for r in cur.fetchall()]
            for r in rows:
                r["created_at"] = str(r["created_at"])
            return {"total": len(rows), "questions": rows}
    finally:
        conn.close()


# ── Document Analyzer ──────────────────────────────────────────────────────────

class DocumentRequest(BaseModel):
    document_text: str
    document_type: str = "contract"


@router.post("/document/analyze")
async def analyze_document(req: DocumentRequest):
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
async def search_judgments(req: JudgmentSearchRequest):
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


@router.get("/lawyers")
async def list_lawyers(
    district: Optional[str] = None,
    practice_area: Optional[str] = None,
    language: Optional[str] = None,
    search: Optional[str] = None,
):
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            conds, params = [], []
            if district:
                conds.append("district ILIKE %s")
                params.append(f"%{district}%")
            if practice_area:
                conds.append("%s = ANY(practice_areas)")
                params.append(practice_area)
            if language:
                conds.append("%s = ANY(languages)")
                params.append(language)
            if search:
                conds.append("(name ILIKE %s OR bio ILIKE %s)")
                params.extend([f"%{search}%", f"%{search}%"])

            where = ("WHERE " + " AND ".join(conds)) if conds else ""
            cur.execute(
                f"SELECT id, name, email, phone, bar_number, district, practice_areas, "
                f"languages, experience_years, rating, bio, verified, created_at "
                f"FROM lawyers {where} ORDER BY verified DESC, rating DESC, experience_years DESC LIMIT 50",
                params,
            )
            rows = [dict(r) for r in cur.fetchall()]
            for r in rows:
                r["created_at"] = str(r["created_at"])
            return {"total": len(rows), "lawyers": rows}
    finally:
        conn.close()


@router.post("/lawyers/register")
async def register_lawyer(
    req: LawyerRegisterRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required to register as an advocate")
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """INSERT INTO lawyers
                   (name, email, phone, bar_number, district, practice_areas, languages, experience_years, bio)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   RETURNING id, name, district, verified""",
                (req.name, req.email, req.phone, req.bar_number, req.district,
                 req.practice_areas, req.languages, req.experience_years, req.bio),
            )
            row = dict(cur.fetchone())
            conn.commit()
            return {
                "message": "Advocate profile submitted. It will appear once verified by our team.",
                "lawyer": row,
            }
    finally:
        conn.close()


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
