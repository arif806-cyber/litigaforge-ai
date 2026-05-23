"""
LitigaForge AI — Lawyer Portal Router
Case management + document uploads + AI analysis for advocates.
"""
import json
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from pydantic import BaseModel

from auth import get_current_user
from database import fetchrow, fetch, execute, fetchval
from logger import get_logger
from rate_limit import limiter
from sanitizer import sanitize_text
from ai_safety import wrap_user_prompt, validate_ai_response

logger = get_logger("litigaforge.lawyer")
router = APIRouter(tags=["lawyer"])


# ── Models ───────────────────────────────────────────────────────────────────────

class CreateCaseRequest(BaseModel):
    title: str
    case_type: str
    description: str = ""
    client_name: str = ""
    court_name: str = ""
    status: str = "active"

class CreateDocRequest(BaseModel):
    case_id: Optional[int] = None
    filename: str
    file_type: str = "pdf"
    file_url: str = ""
    content_text: str = ""


# ── Cases ────────────────────────────────────────────────────────────────────────

@router.post("/lawyer/cases")
@limiter.limit("20/minute")
async def create_lawyer_case(
    req: CreateCaseRequest,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    try:
        safe_title = sanitize_text(req.title, max_length=200, field_name="title")
        safe_type = sanitize_text(req.case_type, max_length=100, field_name="case_type")
        safe_desc = sanitize_text(req.description, max_length=2000, field_name="description")
        safe_client = sanitize_text(req.client_name, max_length=100, field_name="client_name")
        safe_court = sanitize_text(req.court_name, max_length=100, field_name="court_name")
        safe_status = sanitize_text(req.status, max_length=20, field_name="status")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    row = await fetchrow(
        """INSERT INTO lawyer_cases (lawyer_id, title, case_type, description, client_name, court_name, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, lawyer_id, title, case_type, description, client_name, court_name, status, created_at""",
        current_user["id"], safe_title, safe_type, safe_desc, safe_client, safe_court, safe_status,
    )
    row["created_at"] = str(row["created_at"])
    logger.info("lawyer %s created case %s", current_user["id"], row["id"])
    return {"message": "Case created", "case": row}


@router.get("/lawyer/cases")
async def list_lawyer_cases(
    current_user: Optional[dict] = Depends(get_current_user),
    status: Optional[str] = None,
):
    if not current_user:
        raise HTTPException(401, "Login required")
    if status:
        rows = await fetch(
            """SELECT id, lawyer_id, title, case_type, description, client_name, court_name, status, created_at
               FROM lawyer_cases WHERE lawyer_id = $1 AND status = $2 ORDER BY created_at DESC""",
            current_user["id"], status,
        )
    else:
        rows = await fetch(
            """SELECT id, lawyer_id, title, case_type, description, client_name, court_name, status, created_at
               FROM lawyer_cases WHERE lawyer_id = $1 ORDER BY created_at DESC""",
            current_user["id"],
        )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "cases": rows}


@router.get("/lawyer/cases/{case_id}")
async def get_lawyer_case(
    case_id: int,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    row = await fetchrow(
        "SELECT * FROM lawyer_cases WHERE id = $1 AND lawyer_id = $2",
        case_id, current_user["id"],
    )
    if not row:
        raise HTTPException(404, "Case not found")
    row["created_at"] = str(row["created_at"])
    # Attach documents
    docs = await fetch(
        "SELECT id, filename, file_type, file_url, ai_summary, created_at FROM lawyer_documents WHERE case_id = $1 ORDER BY created_at DESC",
        case_id,
    )
    for d in docs:
        d["created_at"] = str(d["created_at"])
    row["documents"] = docs
    return row


# ── Documents ────────────────────────────────────────────────────────────────────────

@router.post("/lawyer/documents")
@limiter.limit("30/minute")
async def create_lawyer_document(
    req: CreateDocRequest,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    try:
        safe_name = sanitize_text(req.filename, max_length=255, field_name="filename")
        safe_type = sanitize_text(req.file_type, max_length=20, field_name="file_type")
        safe_url = sanitize_text(req.file_url, max_length=1000, field_name="file_url")
        safe_content = sanitize_text(req.content_text, max_length=15000, field_name="content_text")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Verify case belongs to lawyer if case_id provided
    if req.case_id:
        case = await fetchrow(
            "SELECT id FROM lawyer_cases WHERE id = $1 AND lawyer_id = $2",
            req.case_id, current_user["id"],
        )
        if not case:
            raise HTTPException(404, "Case not found or not owned by you")

    row = await fetchrow(
        """INSERT INTO lawyer_documents (lawyer_id, case_id, filename, file_type, file_url, content_text)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, lawyer_id, case_id, filename, file_type, file_url, content_text, ai_summary, notes, created_at""",
        current_user["id"], req.case_id, safe_name, safe_type, safe_url, safe_content,
    )
    row["created_at"] = str(row["created_at"])
    return {"message": "Document uploaded", "document": row}


@router.patch("/lawyer/cases/{case_id}/status")
@limiter.limit("30/minute")
async def update_case_status(
    case_id: int,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Update a case status (active / pending / closed)."""
    if not current_user:
        raise HTTPException(401, "Login required")

    # Read the new status from the request body
    body = await request.json()
    new_status = body.get("status", "").strip().lower()
    if new_status not in ("active", "pending", "closed"):
        raise HTTPException(400, "status must be active, pending, or closed")

    safe_status = sanitize_text(new_status, max_length=20, field_name="status")

    case = await fetchrow(
        "UPDATE lawyer_cases SET status = $1 WHERE id = $2 AND lawyer_id = $3 RETURNING id, status",
        safe_status, case_id, current_user["id"],
    )
    if not case:
        raise HTTPException(404, "Case not found or not owned by you")
    logger.info("lawyer %s updated case %s status to %s", current_user["id"], case_id, safe_status)
    return {"message": "Status updated", "case_id": case_id, "status": safe_status}


@router.get("/lawyer/documents")
async def list_lawyer_documents(
    current_user: Optional[dict] = Depends(get_current_user),
    case_id: Optional[int] = None,
):
    if not current_user:
        raise HTTPException(401, "Login required")
    if case_id:
        rows = await fetch(
            """SELECT id, case_id, filename, file_type, file_url, content_text, ai_summary, notes, created_at
               FROM lawyer_documents WHERE lawyer_id = $1 AND case_id = $2 ORDER BY created_at DESC""",
            current_user["id"], case_id,
        )
    else:
        rows = await fetch(
            """SELECT id, case_id, filename, file_type, file_url, content_text, ai_summary, notes, created_at
               FROM lawyer_documents WHERE lawyer_id = $1 ORDER BY created_at DESC""",
            current_user["id"],
        )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "documents": rows}


# ── AI Document Analysis ────────────────────────────────────────────────────────

def _ai(prompt: str, max_tokens: int = 2500) -> str:
    """Call AI via Replit AI Integrations proxy."""
    import requests as _req
    base = os.getenv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "").rstrip("/")
    key = os.getenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY", "")
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


def _extract_json_object(text: str) -> dict:
    """Extract the first {...} block from a text string."""
    import re
    m = re.search(r'\{[\s\S]*?\}', text)
    if not m:
        raise ValueError("No JSON object found")
    return json.loads(m.group())


@router.post("/lawyer/documents/{doc_id}/analyze")
@limiter.limit("10/minute")
async def analyze_lawyer_document(
    doc_id: int,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")

    doc = await fetchrow(
        "SELECT * FROM lawyer_documents WHERE id = $1 AND lawyer_id = $2",
        doc_id, current_user["id"],
    )
    if not doc:
        raise HTTPException(404, "Document not found")

    text = (doc.get("content_text") or "")[:8000]
    file_type = doc.get("file_type", "document")

    if len(text.strip()) < 50:
        raise HTTPException(400, "Document text too short — upload a document with more content")

    prompt = f"""You are a senior Indian advocate. Analyze the following {file_type} and return ONLY a valid JSON object with this exact structure:

{{
  "risk_score": 0-100,
  "missing_clauses": ["list"],
  "red_flags": ["list"],
  "recommendations": ["list"],
  "compliance_notes": "string",
  "summary": "string"
}}

Document text:
---
{text}
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

    summary = result.get("summary", "")[:2000]
    await execute(
        "UPDATE lawyer_documents SET ai_summary = $1 WHERE id = $2",
        summary, doc_id,
    )

    return {"analysis": result, "document_id": doc_id, "file_type": file_type}


# ── Document Notes ────────────────────────────────────────────────────────────────────────────────

class NotesRequest(BaseModel):
    notes: str


@router.post("/lawyer/documents/{doc_id}/notes")
@limiter.limit("30/minute")
async def update_document_notes(
    doc_id: int,
    req: NotesRequest,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    doc = await fetchrow(
        "SELECT id FROM lawyer_documents WHERE id = $1 AND lawyer_id = $2",
        doc_id, current_user["id"],
    )
    if not doc:
        raise HTTPException(404, "Document not found")
    try:
        safe_notes = sanitize_text(req.notes, max_length=3000, field_name="notes")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    await execute(
        "UPDATE lawyer_documents SET notes = $1 WHERE id = $2",
        safe_notes, doc_id,
    )
    return {"message": "Notes saved", "document_id": doc_id}


@router.get("/lawyer/documents/{doc_id}")
async def get_lawyer_document(
    doc_id: int,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    row = await fetchrow(
        """SELECT id, case_id, filename, file_type, file_url, content_text, ai_summary, notes, created_at
           FROM lawyer_documents WHERE id = $1 AND lawyer_id = $2""",
        doc_id, current_user["id"],
    )
    if not row:
        raise HTTPException(404, "Document not found")
    row["created_at"] = str(row["created_at"])
    return row
