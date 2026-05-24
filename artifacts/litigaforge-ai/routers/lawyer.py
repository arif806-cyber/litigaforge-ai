"""
LitigaForge AI — Lawyer Portal Router
Case management + document uploads + AI analysis for advocates.
"""
import json
import os
import time
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
    client_id: Optional[int] = None
    court_name: str = ""
    cnr_number: str = ""
    hearing_date: str = ""
    case_stage: str = "filed"
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
        safe_cnr = sanitize_text(req.cnr_number, max_length=20, field_name="cnr_number")
        safe_status = sanitize_text(req.status, max_length=20, field_name="status")
        safe_hearing = sanitize_text(req.hearing_date, max_length=30, field_name="hearing_date")
        safe_stage = sanitize_text(req.case_stage, max_length=20, field_name="case_stage")
        client_id = req.client_id
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    row = await fetchrow(
        """INSERT INTO lawyer_cases (lawyer_id, client_id, title, case_type, description, client_name, court_name, cnr_number, hearing_date, case_stage, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, lawyer_id, client_id, title, case_type, description, client_name, court_name, cnr_number, hearing_date, case_stage, status, created_at""",
        current_user["id"], client_id, safe_title, safe_type, safe_desc, safe_client, safe_court, safe_cnr, safe_hearing, safe_stage, safe_status,
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
            """SELECT id, lawyer_id, client_id, title, case_type, description, client_name, court_name, cnr_number, hearing_date, case_stage, status, created_at
               FROM lawyer_cases WHERE lawyer_id = $1 AND status = $2 ORDER BY created_at DESC""",
            current_user["id"], status,
        )
    else:
        rows = await fetch(
            """SELECT id, lawyer_id, client_id, title, case_type, description, client_name, court_name, cnr_number, hearing_date, case_stage, status, created_at
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


@router.patch("/lawyer/cases/{case_id}")
@limiter.limit("30/minute")
async def update_lawyer_case(
    case_id: int,
    req: CreateCaseRequest,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Update case details (title, type, description, client, court, status)."""
    if not current_user:
        raise HTTPException(401, "Login required")

    case = await fetchrow(
        "SELECT id FROM lawyer_cases WHERE id = $1 AND lawyer_id = $2",
        case_id, current_user["id"],
    )
    if not case:
        raise HTTPException(404, "Case not found or not owned by you")

    try:
        safe_title = sanitize_text(req.title, max_length=200, field_name="title")
        safe_type = sanitize_text(req.case_type, max_length=100, field_name="case_type")
        safe_desc = sanitize_text(req.description, max_length=2000, field_name="description")
        safe_client = sanitize_text(req.client_name, max_length=100, field_name="client_name")
        safe_court = sanitize_text(req.court_name, max_length=100, field_name="court_name")
        safe_cnr = sanitize_text(req.cnr_number, max_length=20, field_name="cnr_number")
        safe_status = sanitize_text(req.status, max_length=20, field_name="status")
        safe_hearing = sanitize_text(req.hearing_date, max_length=30, field_name="hearing_date")
        safe_stage = sanitize_text(req.case_stage, max_length=20, field_name="case_stage")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    row = await fetchrow(
        """UPDATE lawyer_cases SET title = $1, case_type = $2, description = $3, client_id = $4, client_name = $5, court_name = $6, cnr_number = $7, hearing_date = $8, case_stage = $9, status = $10
           WHERE id = $11 AND lawyer_id = $12
           RETURNING id, lawyer_id, client_id, title, case_type, description, client_name, court_name, cnr_number, hearing_date, case_stage, status, created_at""",
        safe_title, safe_type, safe_desc, req.client_id, safe_client, safe_court, safe_cnr, safe_hearing, safe_stage, safe_status, case_id, current_user["id"],
    )
    row["created_at"] = str(row["created_at"])
    logger.info("lawyer %s updated case %s", current_user["id"], case_id)
    return {"message": "Case updated", "case": row}


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


# ── Client endpoints ────────────────────────────────────────────────────────────

@router.get("/client/cases")
async def list_client_cases(current_user: Optional[dict] = Depends(get_current_user)):
    """List all cases assigned to this client (by client_id)."""
    if not current_user:
        raise HTTPException(401, "Login required")
    rows = await fetch(
        """SELECT id, lawyer_id, title, case_type, description, client_name, court_name, cnr_number, hearing_date, case_stage, status, created_at
           FROM lawyer_cases WHERE client_id = $1 ORDER BY created_at DESC""",
        current_user["id"],
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    # Attach lawyer info
    for r in rows:
        lawyer = await fetchrow("SELECT name, email, phone FROM users WHERE id = $1", r["lawyer_id"])
        r["lawyer_name"] = lawyer["name"] if lawyer else ""
        r["lawyer_email"] = lawyer["email"] if lawyer else ""
        r["lawyer_phone"] = lawyer["phone"] if lawyer else ""
    return {"total": len(rows), "cases": rows}


@router.get("/client/cases/{case_id}")
async def get_client_case(case_id: int, current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(401, "Login required")
    row = await fetchrow(
        "SELECT * FROM lawyer_cases WHERE id = $1 AND client_id = $2",
        case_id, current_user["id"],
    )
    if not row:
        raise HTTPException(404, "Case not found or not assigned to you")
    row["created_at"] = str(row["created_at"])
    # Lawyer info
    lawyer = await fetchrow("SELECT name, email, phone FROM users WHERE id = $1", row["lawyer_id"])
    row["lawyer_name"] = lawyer["name"] if lawyer else ""
    row["lawyer_email"] = lawyer["email"] if lawyer else ""
    row["lawyer_phone"] = lawyer["phone"] if lawyer else ""
    # Documents shared for this case
    docs = await fetch(
        "SELECT id, filename, file_type, file_url, ai_summary, created_at FROM lawyer_documents WHERE case_id = $1 ORDER BY created_at DESC",
        case_id,
    )
    for d in docs:
        d["created_at"] = str(d["created_at"])
    row["documents"] = docs
    return row


class ClientUpdateRequest(BaseModel):
    description: str = ""
    hearing_date: str = ""


# ── Client Document Endpoints ───────────────────────────────────────────────────

@router.post("/client/cases/{case_id}/documents")
@limiter.limit("30/minute")
async def upload_client_document(
    case_id: int,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
    file: UploadFile = File(...),
):
    """Client uploads a document for their assigned case. File saved to local uploads/."""
    if not current_user:
        raise HTTPException(401, "Login required")

    # Verify case belongs to this client
    case = await fetchrow(
        "SELECT id FROM lawyer_cases WHERE id = $1 AND client_id = $2",
        case_id, current_user["id"],
    )
    if not case:
        raise HTTPException(404, "Case not found or not assigned to you")

    if not file.filename:
        raise HTTPException(400, "No file provided")

    # Save to local uploads directory
    import shutil, pathlib
    uploads_dir = pathlib.Path("uploads")
    uploads_dir.mkdir(parents=True, exist_ok=True)

    safe_name = sanitize_text(file.filename, max_length=255, field_name="filename")
    # Include case_id in filename to avoid collisions
    unique_name = f"case_{case_id}_user_{current_user['id']}_{int(time.time())}_{safe_name}"
    file_path = uploads_dir / unique_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_size = len(content)
    file_type = safe_name.split(".")[-1].lower() if "." in safe_name else "unknown"
    file_url = f"/uploads/{unique_name}"

    row = await fetchrow(
        """INSERT INTO client_documents (case_id, client_id, filename, file_type, file_size, file_path, file_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, case_id, client_id, filename, file_type, file_size, file_path, file_url, created_at""",
        case_id, current_user["id"], safe_name, file_type, file_size, str(file_path), file_url,
    )
    row["created_at"] = str(row["created_at"])
    logger.info("client %s uploaded document %s for case %s", current_user["id"], row["id"], case_id)
    return {"message": "Document uploaded", "document": row}


@router.get("/client/documents")
async def list_all_client_documents(
    current_user: Optional[dict] = Depends(get_current_user),
):
    """List ALL documents across all cases for the current client."""
    if not current_user:
        raise HTTPException(401, "Login required")

    rows = await fetch(
        """SELECT d.id, d.case_id, d.client_id, d.filename, d.file_type, d.file_size, d.file_url, d.created_at,
                  c.title as case_title, c.case_type
           FROM client_documents d
           LEFT JOIN lawyer_cases c ON d.case_id = c.id
           WHERE d.client_id = $1
           ORDER BY d.created_at DESC""",
        current_user["id"],
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "documents": rows}


@router.get("/client/cases/{case_id}/documents")
async def list_client_documents(
    case_id: int,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """List all documents for a client's case."""
    if not current_user:
        raise HTTPException(401, "Login required")

    # Verify case belongs to this client
    case = await fetchrow(
        "SELECT id FROM lawyer_cases WHERE id = $1 AND client_id = $2",
        case_id, current_user["id"],
    )
    if not case:
        raise HTTPException(404, "Case not found or not assigned to you")

    rows = await fetch(
        """SELECT id, case_id, client_id, filename, file_type, file_size, file_url, created_at
           FROM client_documents WHERE case_id = $1 ORDER BY created_at DESC""",
        case_id,
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "documents": rows}


@router.delete("/client/documents/{doc_id}")
@limiter.limit("30/minute")
async def delete_client_document(
    doc_id: int,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Delete a document. Client can delete their own docs; lawyer can delete docs for their cases."""
    if not current_user:
        raise HTTPException(401, "Login required")

    doc = await fetchrow(
        "SELECT * FROM client_documents WHERE id = $1",
        doc_id,
    )
    if not doc:
        raise HTTPException(404, "Document not found")

    # Check ownership: client must own the doc OR the case's lawyer
    case = await fetchrow("SELECT lawyer_id, client_id FROM lawyer_cases WHERE id = $1", doc["case_id"])
    if not case:
        raise HTTPException(404, "Case not found")

    is_owner = doc["client_id"] == current_user["id"]
    is_lawyer = case["lawyer_id"] == current_user["id"]
    if not (is_owner or is_lawyer):
        raise HTTPException(403, "Not authorized to delete this document")

    # Delete from filesystem
    import os, pathlib
    fp = doc.get("file_path")
    if fp and pathlib.Path(fp).exists():
        os.remove(fp)

    await execute("DELETE FROM client_documents WHERE id = $1", doc_id)
    logger.info("user %s deleted document %s", current_user["id"], doc_id)
    return {"message": "Document deleted"}


@router.patch("/client/cases/{case_id}")
@limiter.limit("30/minute")
async def update_client_case(
    case_id: int,
    req: ClientUpdateRequest,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Allow client to update description and hearing date of their assigned case."""
    if not current_user:
        raise HTTPException(401, "Login required")
    case = await fetchrow(
        "SELECT id FROM lawyer_cases WHERE id = $1 AND client_id = $2",
        case_id, current_user["id"],
    )
    if not case:
        raise HTTPException(404, "Case not found or not assigned to you")
    safe_desc = sanitize_text(req.description, max_length=2000, field_name="description")
    safe_hearing = sanitize_text(req.hearing_date, max_length=30, field_name="hearing_date")
    row = await fetchrow(
        """UPDATE lawyer_cases SET description = $1, hearing_date = $2
           WHERE id = $3 AND client_id = $4
           RETURNING id, lawyer_id, client_id, title, case_type, description, client_name, court_name, cnr_number, hearing_date, case_stage, status, created_at""",
        safe_desc, safe_hearing, case_id, current_user["id"],
    )
    row["created_at"] = str(row["created_at"])
    logger.info("client %s updated case %s", current_user["id"], case_id)
    return {"message": "Case updated", "case": row}
