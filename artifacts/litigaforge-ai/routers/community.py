"""
LitigaForge AI — Community Router
Legal Q&A, document analyzer, judgment finder, lawyer directory, legal aid.
"""
import asyncio
import json
import logging
import os
import re
import secrets
from typing import List, Optional

import requests as _req
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from auth import get_current_user, check_tier_usage
from rate_limit import limiter
from database import fetchrow, fetch, execute, fetchval
from cache import cache_get, cache_set, cache_key
from sanitizer import sanitize_text
from alerts.email import smtp_configured, send_confirmation_email
from ai_safety import wrap_user_prompt, add_disclaimer, validate_ai_response
from jurisdiction import (
    get_config, advisor_descriptor, jurisdiction_block,
    caselaw_provider, caselaw_link, normalize_code,
)
from llm import legal_llm

logger = logging.getLogger("litigaforge.community")
router = APIRouter(tags=["community"])

_SITE_URL = os.getenv("PUBLIC_SITE_URL", "https://litigaforge.com").rstrip("/")
_BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")


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


# ── Clarifying questions (shared) ─────────────────────────────────────────────────

_SURFACE_LABELS = {
    "ask": "asking a legal question",
    "document": "having a legal document analysed",
    "judgments": "searching for relevant court judgments / precedents",
    "chat": "chatting with the legal drafting assistant",
    "case": "posting a case to be matched with a lawyer",
    "general": "getting legal guidance",
}


class ClarifyRequest(BaseModel):
    text: str = ""
    surface: str = "general"
    country: str = "IN"


@router.post("/clarify")
@limiter.limit("30/minute")
async def clarify_input(req: ClarifyRequest, request: Request,
                        current_user: Optional[dict] = Depends(get_current_user)):
    """Given the user's draft input, return up to 3 short, jurisdiction-aware
    clarifying questions that would materially improve the answer. Returns an
    empty list when the input is already detailed enough."""
    try:
        safe_text = sanitize_text(req.text or "", max_length=4000, field_name="text")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    cfg = get_config(req.country)
    label = _SURFACE_LABELS.get(req.surface, _SURFACE_LABELS["general"])

    if len(safe_text.strip()) < 2:
        return {"needs_clarification": False, "questions": []}

    prompt = f"""You are {advisor_descriptor(req.country)} helping a user get a more accurate answer.
The user is {label}. Their current input is shown below.

Decide whether 1 to 3 SHORT clarifying questions would materially improve the quality of the answer.
Rules:
- If the input is already specific and detailed enough, return an EMPTY array.
- Each question must be specific, answerable in one short sentence, and relevant to {cfg['name']} law.
- Never ask for personally identifying information (full name, exact address, ID numbers).
- Do not repeat information the user already provided.
- Maximum 3 questions.

Return ONLY a valid JSON array of strings, e.g. ["Which state or city is this in?", "Was anyone injured?"]
Return [] if no clarification is needed.

USER INPUT:
---
{safe_text[:4000]}
---"""

    raw = _ai(wrap_user_prompt(prompt, req.country), 400)
    raw = validate_ai_response(raw)
    try:
        questions = _extract_json_array(raw)
    except Exception:
        questions = []
    # Keep only non-empty strings, cap at 3
    questions = [str(q).strip() for q in questions if isinstance(q, str) and str(q).strip()][:3]
    return {"needs_clarification": bool(questions), "questions": questions}


# ── Contact form ──────────────────────────────────────────────────────────────────

CONTACT_SUBJECTS = {
    "General Inquiry", "Legal Question", "Technical Support",
    "Partnership", "Press & Media", "Other",
}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ContactRequest(BaseModel):
    name: str
    email: str
    subject: str = "General Inquiry"
    message: str


@router.post("/contact")
@limiter.limit("5/minute")
async def submit_contact(req: ContactRequest, request: Request):
    """Public contact form — saves a message to the database. No auth required."""
    try:
        name = sanitize_text(req.name, max_length=200, field_name="name")
        message = sanitize_text(req.message, max_length=5000, field_name="message")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    email = (req.email or "").strip().lower()
    if not name.strip():
        raise HTTPException(status_code=422, detail="Please enter your name.")
    if not _EMAIL_RE.match(email) or len(email) > 320:
        raise HTTPException(status_code=422, detail="Please enter a valid email address.")
    if not message.strip():
        raise HTTPException(status_code=422, detail="Please enter a message.")

    subject = req.subject if req.subject in CONTACT_SUBJECTS else "Other"

    await execute(
        """INSERT INTO contact_messages (name, email, subject, message)
           VALUES ($1, $2, $3, $4)""",
        name.strip(), email, subject, message.strip(),
    )
    return {"ok": True, "message": "Thank you! We will get back to you within 24 hours."}


# ── Daily Judgment Digest ───────────────────────────────────────────────────────────

class DigestSubscribeRequest(BaseModel):
    name: str = ""
    email: str
    country: str = "in"


# Countries offered in the signup dropdown. The digest content is India-focused
# today; the field is stored for future per-country segmentation. Unknown values
# fall back to 'in'.
_DIGEST_COUNTRIES = {"in", "us", "uk", "ae", "de", "au", "ca", "sg"}


@router.post("/digest/subscribe")
@limiter.limit("5/minute")
async def subscribe_digest(req: DigestSubscribeRequest, request: Request):
    """Public signup for the daily Top-5 judgment digest email. No auth.

    Double opt-in when email can be delivered: a new/unconfirmed address gets an
    UNCONFIRMED row plus a confirmation email and only starts receiving the
    digest after clicking the link (GET /digest/confirm/{token}). When SMTP is
    NOT configured we cannot send a confirmation email, so we fall back to
    immediate (single) opt-in — signups never silently break, and the address
    begins receiving the digest as soon as SMTP is configured.

    Idempotent: re-subscribing reactivates the row and preserves the original
    unsubscribe token so links in older emails keep working. An already-confirmed
    address is reactivated without sending another confirmation email.
    """
    try:
        name = sanitize_text(req.name, max_length=120, field_name="name") if req.name else ""
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    email = (req.email or "").strip().lower()
    if not _EMAIL_RE.match(email) or len(email) > 320:
        raise HTTPException(status_code=422, detail="Please enter a valid email address.")

    country = (req.country or "in").strip().lower()
    if country not in _DIGEST_COUNTRIES:
        country = "in"

    unsub_token = secrets.token_urlsafe(32)
    confirm_token = secrets.token_urlsafe(32)

    if smtp_configured():
        # Double opt-in: create / refresh an UNCONFIRMED row, then email a link.
        row = await fetchrow(
            """
            INSERT INTO digest_subscribers
                (name, email, country, is_active, confirmed, confirm_token, unsubscribe_token)
            VALUES ($1, $2, $3, TRUE, FALSE, $4, $5)
            ON CONFLICT (email) DO UPDATE
            SET is_active = TRUE,
                name = COALESCE(NULLIF(EXCLUDED.name, ''), digest_subscribers.name),
                country = EXCLUDED.country,
                confirm_token = CASE WHEN digest_subscribers.confirmed
                                     THEN digest_subscribers.confirm_token
                                     ELSE EXCLUDED.confirm_token END,
                unsubscribe_token = COALESCE(digest_subscribers.unsubscribe_token,
                                             EXCLUDED.unsubscribe_token)
            RETURNING confirmed, confirm_token
            """,
            (name.strip() or None), email, country, confirm_token, unsub_token,
        )
        if row and row["confirmed"]:
            return {"ok": True, "confirmed": True,
                    "message": "You're already subscribed — you'll keep getting the daily digest at 7 AM IST."}

        link = f"{_SITE_URL}{_BASE_PATH}/digest/confirm/{row['confirm_token']}"
        try:
            res = await asyncio.wait_for(
                asyncio.to_thread(send_confirmation_email, email, name.strip() or "", link),
                timeout=25,
            )
            if not res.get("success"):
                logger.warning("digest: confirmation email to %s failed: %s", email, res.get("error"))
        except asyncio.TimeoutError:
            logger.warning("digest: confirmation email to %s timed out", email)
        except Exception as e:  # never let a mail hiccup 500 the signup
            logger.warning("digest: confirmation email to %s errored: %s", email, e)

        return {"ok": True, "confirmed": False,
                "message": "Almost there! Check your email and click the confirmation link "
                           "to start receiving the daily digest."}

    # SMTP not configured → immediate (single) opt-in fallback.
    await execute(
        """
        INSERT INTO digest_subscribers
            (name, email, country, is_active, confirmed, unsubscribe_token)
        VALUES ($1, $2, $3, TRUE, TRUE, $4)
        ON CONFLICT (email) DO UPDATE
        SET is_active = TRUE,
            confirmed = TRUE,
            name = COALESCE(NULLIF(EXCLUDED.name, ''), digest_subscribers.name),
            country = EXCLUDED.country,
            unsubscribe_token = COALESCE(digest_subscribers.unsubscribe_token,
                                         EXCLUDED.unsubscribe_token)
        """,
        (name.strip() or None), email, country, unsub_token,
    )
    return {"ok": True, "confirmed": True,
            "message": "You're subscribed! You'll get the top 5 judgments every morning at 7 AM IST."}


def _unsub_page(title: str, body: str, ok: bool) -> str:
    accent = "#059669" if ok else "#dc2626"
    icon = "✓" if ok else "!"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>{title} — LitigaForge AI</title>
</head>
<body style="margin:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:64px auto;padding:0 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="background:#1a2744;padding:22px 28px;">
        <p style="margin:0;color:#f0a500;font-size:19px;font-weight:700;">⚖️ LitigaForge AI</p>
      </div>
      <div style="padding:28px;">
        <div style="width:46px;height:46px;border-radius:50%;background:{accent}1a;color:{accent};
                    font-size:24px;font-weight:700;text-align:center;line-height:46px;">{icon}</div>
        <h1 style="margin:18px 0 8px;font-size:21px;color:#0f172a;">{title}</h1>
        <p style="margin:0 0 22px;font-size:15px;color:#475569;line-height:1.6;">{body}</p>
        <a href="{_SITE_URL}/digest" style="display:inline-block;background:#1a2744;color:#fff;
           text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">
          Manage subscription</a>
        <a href="{_SITE_URL}/" style="display:inline-block;margin-left:8px;color:#64748b;
           text-decoration:underline;font-size:14px;padding:10px 4px;">Go to homepage</a>
      </div>
    </div>
  </div>
</body>
</html>"""


@router.get("/digest/unsubscribe")
async def unsubscribe_digest(token: str = ""):
    """Tokenized one-click unsubscribe. Returns a styled confirmation page so the
    link works directly from any email client (no SPA / JS required)."""
    token = (token or "").strip()
    if not token:
        return HTMLResponse(
            _unsub_page("Invalid link",
                        "This unsubscribe link is missing its token. Please use the "
                        "link from your digest email.",
                        ok=False),
            status_code=400,
        )
    row = await fetchrow(
        "UPDATE digest_subscribers SET is_active = FALSE "
        "WHERE unsubscribe_token = $1 RETURNING email",
        token,
    )
    if not row:
        return HTMLResponse(
            _unsub_page("Link not recognised",
                        "This unsubscribe link is invalid or has already been used. "
                        "You may already be unsubscribed.",
                        ok=False),
            status_code=404,
        )
    return HTMLResponse(
        _unsub_page("You're unsubscribed",
                    "You will no longer receive the LitigaForge daily judgment digest. "
                    "Changed your mind? You can re-subscribe any time.",
                    ok=True),
    )


@router.get("/digest/confirm/{token}")
async def confirm_digest(token: str):
    """Double opt-in confirmation. Marks the subscriber confirmed + active and
    clears the one-time token. Returns a styled page so the link works directly
    from any email client (no SPA / JS required)."""
    token = (token or "").strip()
    if not token:
        return HTMLResponse(
            _unsub_page("Invalid link",
                        "This confirmation link is missing its token. Please use the "
                        "link from your confirmation email.",
                        ok=False),
            status_code=400,
        )
    row = await fetchrow(
        "UPDATE digest_subscribers "
        "SET confirmed = TRUE, is_active = TRUE, confirm_token = NULL "
        "WHERE confirm_token = $1 RETURNING email",
        token,
    )
    if not row:
        return HTMLResponse(
            _unsub_page("Link not recognised",
                        "This confirmation link is invalid or has already been used. "
                        "If you've already confirmed, you're all set.",
                        ok=False),
            status_code=404,
        )
    return HTMLResponse(
        _unsub_page("Subscription confirmed",
                    "You're all set! You'll receive the top 5 judgments every morning at "
                    "7 AM IST. Every email has a one-click unsubscribe link.",
                    ok=True),
    )


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

    # Tier enforcement
    if current_user and not check_tier_usage(current_user):
        limit = TIER_LIMITS.get(current_user.get("subscription_tier", "free"), 5)
        raise HTTPException(403, f"Monthly limit reached ({limit} questions/month). Upgrade to continue.")

    # Portable LiteLLM layer first; fall back to the multi-provider cascade (_ai).
    answer = ""
    if legal_llm.is_configured():
        try:
            answer = await legal_llm.acomplete(
                None, wrap_user_prompt(prompt, req.country), None, 1800
            )
        except Exception as e:
            logger.warning("[/ask] LiteLLM failed; falling back to cascade: %s", e)
            answer = ""
    if not (answer or "").strip():
        answer = _ai(wrap_user_prompt(prompt, req.country), 1800)
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
    context: str = ""


@router.post("/document/analyze")
@limiter.limit("10/minute")
async def analyze_document(req: DocumentRequest, request: Request):
    try:
        safe_text = sanitize_text(req.document_text, max_length=8000, field_name="document_text")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if len(safe_text.strip()) < 50:
        raise HTTPException(400, "Document too short — paste at least 50 characters")

    try:
        safe_context = sanitize_text(req.context or "", max_length=1500, field_name="context") if req.context else ""
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    cfg = get_config(req.country)
    context_block = f"\nAdditional context provided by the user:\n{safe_context}\n" if safe_context else ""
    prompt = f"""You are {advisor_descriptor(req.country)} reviewing a {req.document_type}.

{jurisdiction_block(req.country)}
{context_block}
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

    raw = _ai(wrap_user_prompt(prompt, req.country), 2500)
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


# ── File Upload Analyzer ──────────────────────────────────────────────────────────────────

def _extract_text_from_pdf(data: bytes) -> str:
    """Extract text from PDF bytes using PyPDF2."""
    try:
        from PyPDF2 import PdfReader
        from io import BytesIO
        reader = PdfReader(BytesIO(data))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text[:8000]
    except Exception:
        return ""


def _extract_text_from_docx(data: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    try:
        from docx import Document
        from io import BytesIO
        doc = Document(BytesIO(data))
        text = "\n".join(p.text for p in doc.paragraphs if p.text)
        return text[:8000]
    except Exception:
        return ""


from fastapi import File, UploadFile

@router.post("/document/analyze-file")
@limiter.limit("10/minute")
async def analyze_document_file(
    request: Request,
    file: UploadFile = File(...),
    document_type: str = "contract",
    country: str = "IN",
    context: str = "",
):
    """Analyze uploaded file (PDF, DOCX, TXT, PNG, JPG). Extracts text then runs AI analysis."""
    allowed = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
               "text/plain", "image/png", "image/jpeg", "image/jpg", "image/webp"}
    content_type = file.content_type or ""
    filename = (file.filename or "").lower()

    if not content_type or content_type == "application/octet-stream":
        if filename.endswith(".pdf"):
            content_type = "application/pdf"
        elif filename.endswith(".docx"):
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif filename.endswith(".txt"):
            content_type = "text/plain"
        elif filename.endswith(".png"):
            content_type = "image/png"
        elif filename.endswith(".jpg") or filename.endswith(".jpeg"):
            content_type = "image/jpeg"
        elif filename.endswith(".webp"):
            content_type = "image/webp"

    if content_type not in allowed:
        raise HTTPException(415, f"Unsupported file type: {content_type}. Supported: PDF, DOCX, TXT, PNG, JPG, WEBP")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "File too large. Max 10MB.")

    extracted_text = ""
    analysis_source = "text_extraction"

    if content_type == "application/pdf":
        extracted_text = _extract_text_from_pdf(data)
        analysis_source = "text_extraction"
    elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        extracted_text = _extract_text_from_docx(data)
        analysis_source = "text_extraction"
    elif content_type.startswith("text/"):
        extracted_text = data.decode("utf-8", errors="replace")[:8000]
        analysis_source = "text_extraction"
    elif content_type.startswith("image/"):
        # ── NIM Vision path: one-shot extraction + analysis ──────────────────
        # Reads the image directly — understands stamps, handwriting, tables,
        # and multi-column layouts that pytesseract misses. Falls back to
        # pytesseract → Claude on any error (missing key, timeout, API failure).
        from llm.nim_vision import analyze_image, nim_vision_enabled
        cfg_now = get_config(country)

        try:
            safe_ctx_early = sanitize_text(context, max_length=1500, field_name="context") if context else ""
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        if nim_vision_enabled():
            nim_result = await analyze_image(
                image_bytes=data,
                content_type=content_type,
                document_type=document_type,
                jurisdiction=cfg_now["name"],
                context=safe_ctx_early,
            )
            if nim_result is not None:
                return {
                    "analysis": nim_result,
                    "document_type": document_type,
                    "source": "nim_vision",
                    "extracted_chars": 0,
                }

        # Tesseract fallback
        analysis_source = "tesseract_fallback"
        try:
            import pytesseract
            from PIL import Image
            from io import BytesIO
            img = Image.open(BytesIO(data))
            extracted_text = pytesseract.image_to_string(img)[:8000]
        except Exception:
            extracted_text = ""

    if not extracted_text or len(extracted_text.strip()) < 50:
        raise HTTPException(
            422,
            "Could not extract sufficient text from the file. "
            "Please paste the text directly or try a clearer document."
            + (" NIM Vision is unavailable; pytesseract may not read handwritten or stamp-heavy images well."
               if analysis_source == "tesseract_fallback" else ""),
        )

    try:
        safe_context = sanitize_text(context, max_length=1500, field_name="context") if context else ""
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    cfg = get_config(country)
    context_block = f"\nAdditional context provided by the user:\n{safe_context}\n" if safe_context else ""
    prompt = f"""You are {advisor_descriptor(country)} reviewing a {document_type}.

{jurisdiction_block(country)}
{context_block}
Analyze the following {document_type} under {cfg['name']} law and return ONLY a valid JSON object with this exact structure:

{{
  "risk_score": 0-100,
  "missing_clauses": ["list"],
  "red_flags": ["list"],
  "recommendations": ["list"],
  "compliance_notes": "string — note compliance specifically under {cfg['name']} law",
  "summary": "string"
}}

Document text:
----
{extracted_text[:8000]}
----"""

    raw = _ai(wrap_user_prompt(prompt, country), 2500)
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
    return {
        "analysis": result,
        "document_type": document_type,
        "source": analysis_source,
        "extracted_chars": len(extracted_text),
    }


# ── Judgment Finder ────────────────────────────────────────────────────────────────────

class JudgmentSearchRequest(BaseModel):
    query: str
    court: str = ""
    country: str = "IN"


async def _search_judgments_semantic(
    query: str, court_filter: str, limit: int = 10
) -> list:
    """
    Semantic search: embed the query with NIM, find closest DB judgments by
    cosine distance (embedding <=> query_vec).  Returns a list of serialised
    judgment dicts, or an empty list if NIM is unavailable or no embeddings exist.
    """
    from llm.nim_embed import aembed_query, nim_embed_enabled, vec_to_str
    from routers.judgments import _serialize

    if not nim_embed_enabled():
        return []

    query_vec = await aembed_query(query)
    if query_vec is None:
        return []

    vec_str = vec_to_str(query_vec)
    try:
        from database import fetch as db_fetch, fetchval as db_fetchval

        # Only run vector search if there are actually embeddings stored.
        embedded_count = await db_fetchval(
            "SELECT COUNT(*) FROM judgments WHERE embedding IS NOT NULL AND status = 'published'"
        )
        if not embedded_count:
            return []

        if court_filter:
            rows = await db_fetch(
                """SELECT id, case_name, court, court_slug, bench, judgment_date, year, slug,
                          summary_en, summary_hi, acts_cited, outcome, citation,
                          source_name, source_url, og_image_url, created_at,
                          1 - (embedding <=> $1::vector) AS similarity
                   FROM judgments
                   WHERE status = 'published' AND embedding IS NOT NULL
                     AND (court ILIKE $3 OR court_slug ILIKE $3)
                   ORDER BY embedding <=> $1::vector
                   LIMIT $2""",
                vec_str, limit, f"%{court_filter}%",
            )
        else:
            rows = await db_fetch(
                """SELECT id, case_name, court, court_slug, bench, judgment_date, year, slug,
                          summary_en, summary_hi, acts_cited, outcome, citation,
                          source_name, source_url, og_image_url, created_at,
                          1 - (embedding <=> $1::vector) AS similarity
                   FROM judgments
                   WHERE status = 'published' AND embedding IS NOT NULL
                   ORDER BY embedding <=> $1::vector
                   LIMIT $2""",
                vec_str, limit,
            )

        results = []
        for r in rows:
            d = _serialize(dict(r))
            d["similarity"] = round(float(r.get("similarity") or 0.0), 4)
            d["search_source"] = "nim_semantic"
            results.append(d)
        return results

    except Exception as e:
        import logging as _log
        _log.getLogger("litigaforge.community").warning(
            "semantic search failed: %s", e
        )
        return []


async def _search_judgments_keyword(query: str, court_filter: str, limit: int = 10) -> list:
    """
    Keyword fallback: full-text ILIKE search across case_name, summary_en, outcome.
    Returns serialised judgment dicts (may be empty).
    """
    from database import fetch as db_fetch
    from routers.judgments import _serialize

    try:
        q = f"%{query}%"
        if court_filter:
            rows = await db_fetch(
                """SELECT id, case_name, court, court_slug, bench, judgment_date, year, slug,
                          summary_en, summary_hi, acts_cited, outcome, citation,
                          source_name, source_url, og_image_url, created_at
                   FROM judgments
                   WHERE status = 'published'
                     AND (court ILIKE $3 OR court_slug ILIKE $3)
                     AND (case_name ILIKE $1 OR summary_en ILIKE $1 OR outcome ILIKE $1)
                   ORDER BY judgment_date DESC NULLS LAST
                   LIMIT $2""",
                q, limit, f"%{court_filter}%",
            )
        else:
            rows = await db_fetch(
                """SELECT id, case_name, court, court_slug, bench, judgment_date, year, slug,
                          summary_en, summary_hi, acts_cited, outcome, citation,
                          source_name, source_url, og_image_url, created_at
                   FROM judgments
                   WHERE status = 'published'
                     AND (case_name ILIKE $1 OR summary_en ILIKE $1 OR outcome ILIKE $1)
                   ORDER BY judgment_date DESC NULLS LAST
                   LIMIT $2""",
                q, limit,
            )
        results = []
        for r in rows:
            d = _serialize(dict(r))
            d["search_source"] = "keyword"
            results.append(d)
        return results
    except Exception:
        return []


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

    # ── Step 1: try NIM semantic search against real DB judgments ──────────────
    db_results = await _search_judgments_semantic(safe_query, req.court or "")
    search_source = "nim_semantic"

    # ── Step 2: keyword fallback if semantic search returned nothing ───────────
    if not db_results:
        db_results = await _search_judgments_keyword(safe_query, req.court or "")
        search_source = "keyword"

    # ── No results: return empty rather than hallucinate ───────────────────────
    if not db_results:
        return {
            "query": safe_query,
            "total": 0,
            "source_name": prov_name,
            "search_source": "keyword",
            "judgments": [],
            "hint": (
                "No matching judgments found in the database. "
                "Run the admin embed-backfill to index judgments for semantic search, "
                "or ingest more judgments via the IndianKanoon source."
            ),
        }

    # ── Format DB results to match existing response shape ─────────────────────
    judgments = []
    for r in db_results:
        j = {
            "case_name": r.get("case_name", ""),
            "citation": r.get("citation") or "",
            "court": r.get("court", ""),
            "year": r.get("year"),
            "holding": r.get("summary_en") or r.get("outcome") or "",
            "relevance": r.get("outcome") or "",
            "search_query": safe_query[:50],
            "ik_link": caselaw_link(req.country, r.get("case_name") or safe_query),
            "source_name": r.get("source_name") or prov_name,
            "search_source": r.get("search_source", search_source),
            "slug": r.get("slug"),
            "court_slug": r.get("court_slug"),
            "path": r.get("path"),
            "url": r.get("url"),
            "og_image_url": r.get("og_image_url"),
            "similarity": r.get("similarity"),
        }
        judgments.append(j)

    return {
        "query": safe_query,
        "total": len(judgments),
        "source_name": prov_name,
        "search_source": search_source,
        "judgments": judgments,
    }


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
    country: str = "in"


@router.get("/lawyers")
async def list_lawyers(
    response: Response,
    country: Optional[str] = None,
    district: Optional[str] = None,
    practice_area: Optional[str] = None,
    language: Optional[str] = None,
    search: Optional[str] = None,
):
    response.headers["Cache-Control"] = "public, max-age=300"

    ck = cache_key("lawyers", country or "", district or "", practice_area or "", language or "", search or "")
    cached = await cache_get(ck)
    if cached is not None:
        return cached

    conds, params = ["l.verified = TRUE"], []
    if country:
        conds.append("LOWER(l.country) = $" + str(len(params) + 1))
        params.append(country.lower())
    if district:
        conds.append("l.district ILIKE $" + str(len(params) + 1))
        params.append(f"%{district}%")
    if practice_area:
        conds.append("$" + str(len(params) + 1) + " = ANY(l.practice_areas)")
        params.append(practice_area)
    if language:
        conds.append("$" + str(len(params) + 1) + " = ANY(l.languages)")
        params.append(language)
    if search:
        conds.append(
            "(l.name ILIKE $" + str(len(params) + 1) +
            " OR l.bio ILIKE $" + str(len(params) + 2) + ")"
        )
        params.extend([f"%{search}%", f"%{search}%"])

    where = "WHERE " + " AND ".join(conds)
    rows = await fetch(
        f"SELECT l.id, l.name, l.email, l.phone, l.bar_number, l.district, l.country, "
        f"l.practice_areas, l.languages, l.experience_years, l.rating, l.bio, "
        f"l.hourly_rate, l.availability, l.verification_status, l.verified, l.created_at, "
        f"u.subscription_tier "
        f"FROM lawyers l "
        f"LEFT JOIN users u ON u.id = l.user_id "
        f"{where} "
        f"ORDER BY "
        f"  CASE WHEN u.subscription_tier = 'advocate_pro' THEN 0 ELSE 1 END, "
        f"  l.verified DESC, l.rating DESC, l.experience_years DESC "
        f"LIMIT 50",
        *params,
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])

    result = {"total": len(rows), "lawyers": rows}
    await cache_set(ck, result, ttl=300)
    return result


@router.post("/lawyers/register")
async def register_lawyer(
    req: LawyerRegisterRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required to register as an advocate")
    row = await fetchrow(
        """INSERT INTO lawyers
           (user_id, name, email, phone, bar_number, district, practice_areas, languages, experience_years, bio, hourly_rate, country)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING id, name, district, verified""",
        current_user["id"], req.name, req.email, req.phone, req.bar_number, req.district,
        req.practice_areas, req.languages, req.experience_years, req.bio, req.hourly_rate,
        (req.country or "in").lower(),
    )
    return {
        "message": "Advocate profile submitted. It will appear once verified by our team.",
        "lawyer": row,
    }


# ── Legal Aid contacts (static + eligibility) ─────────────────────────────────────────────

# Real, publicly-published legal-aid bodies per country. Phone numbers are the
# official national helplines where one exists; otherwise we rely on the official
# website as the authoritative link rather than inventing local office numbers.
LEGAL_AID: dict = {
    "IN": {
        "country_name": "India", "flag": "🇮🇳", "currency_symbol": "₹",
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
        "regional": [
            {"name": "Telangana State Legal Services Authority (TSLSA)", "region": "Telangana",
             "website": "https://tslsa.telangana.gov.in", "phone": "+91-40-23450027",
             "address": "High Court of Telangana Campus, Hyderabad – 500004"},
            {"name": "DLSA Hyderabad", "region": "Hyderabad", "phone": "+91-40-23219999",
             "address": "City Civil Court Campus, Nampally, Hyderabad"},
            {"name": "DLSA Rangareddy", "region": "Rangareddy", "phone": "+91-40-24010073",
             "address": "District Courts Complex, Jubilee Hills, Hyderabad"},
            {"name": "DLSA Warangal", "region": "Warangal", "phone": "+91-870-2578901",
             "address": "District Court Campus, Warangal"},
        ],
        "other_resources": [
            {"name": "Women Helpline", "phone": "181"},
            {"name": "Child Helpline", "phone": "1098"},
            {"name": "Police Control Room", "phone": "100"},
            {"name": "Senior Citizens Helpline", "phone": "14567"},
        ],
    },
    "US": {
        "country_name": "United States", "flag": "🇺🇸", "currency_symbol": "$",
        "national": {
            "name": "Legal Services Corporation (LSC) — find your local legal aid",
            "helpline": "211",
            "website": "https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help",
            "eligibility": [
                "Household income at or below 125% of the Federal Poverty Guidelines",
                "Seniors, veterans, and people with disabilities",
                "Survivors of domestic violence",
                "Tenants facing eviction",
                "Limited civil matters (not most criminal cases)",
            ],
        },
        "regional": [
            {"name": "LawHelp.org — directory of local legal aid programs", "region": "All states",
             "website": "https://www.lawhelp.org"},
            {"name": "American Bar Association — Free Legal Answers", "region": "Nationwide",
             "website": "https://www.freelegalanswers.org"},
        ],
        "other_resources": [
            {"name": "National Domestic Violence Hotline", "phone": "1-800-799-7233"},
            {"name": "Emergency", "phone": "911"},
            {"name": "Community services & referrals", "phone": "211"},
        ],
    },
    "GB": {
        "country_name": "United Kingdom", "flag": "🇬🇧", "currency_symbol": "£",
        "national": {
            "name": "Civil Legal Advice (CLA) — government legal aid service",
            "helpline": "0345 345 4 345",
            "website": "https://www.gov.uk/check-legal-aid",
            "eligibility": [
                "Pass the means test (low income / on certain benefits)",
                "Case passes the merits test",
                "Debt, housing, domestic abuse and family matters",
                "Discrimination and some immigration/asylum cases",
            ],
        },
        "regional": [
            {"name": "Citizens Advice", "region": "England & Wales", "phone": "0800 144 8848",
             "website": "https://www.citizensadvice.org.uk"},
            {"name": "Law Centres Network", "region": "UK-wide",
             "website": "https://www.lawcentres.org.uk"},
        ],
        "other_resources": [
            {"name": "National Domestic Abuse Helpline", "phone": "0808 2000 247"},
            {"name": "Emergency", "phone": "999"},
            {"name": "Shelter (housing)", "phone": "0808 800 4444"},
        ],
    },
    "AE": {
        "country_name": "United Arab Emirates", "flag": "🇦🇪", "currency_symbol": "د.إ",
        "national": {
            "name": "UAE Ministry of Justice — Legal Aid Department",
            "helpline": "800 33",
            "website": "https://www.moj.gov.ae",
            "eligibility": [
                "Insolvent or low-income applicants who cannot afford a lawyer",
                "Mandatory legal aid for serious criminal cases",
                "Cases referred by the courts",
                "Minors and persons of determination (people of disability)",
            ],
        },
        "regional": [
            {"name": "Dubai Courts — Legal Aid", "region": "Dubai", "phone": "800 33",
             "website": "https://www.dc.gov.ae"},
            {"name": "Abu Dhabi Judicial Department", "region": "Abu Dhabi", "phone": "800 23823",
             "website": "https://www.adjd.gov.ae"},
            {"name": "Community Development Authority", "region": "Dubai",
             "website": "https://www.cda.gov.ae"},
        ],
        "other_resources": [
            {"name": "Police / Emergency", "phone": "999"},
            {"name": "Dubai Foundation for Women & Children", "phone": "800 111"},
            {"name": "Ministry of Human Resources (labour disputes)", "phone": "600 590000"},
        ],
    },
    "AU": {
        "country_name": "Australia", "flag": "🇦🇺", "currency_symbol": "A$",
        "national": {
            "name": "National Legal Aid — find your state Legal Aid Commission",
            "helpline": "1300 888 529",
            "website": "https://www.nationallegalaid.org",
            "eligibility": [
                "Pass the income and assets means test",
                "Case passes the merits test",
                "Family, criminal and some civil law matters",
                "Priority for children, First Nations people and those facing family violence",
            ],
        },
        "regional": [
            {"name": "LawAccess NSW", "region": "New South Wales", "phone": "1300 888 529",
             "website": "https://www.legalaid.nsw.gov.au"},
            {"name": "Victoria Legal Aid", "region": "Victoria", "phone": "1300 792 387",
             "website": "https://www.legalaid.vic.gov.au"},
            {"name": "Legal Aid Queensland", "region": "Queensland", "phone": "1300 651 188",
             "website": "https://www.legalaid.qld.gov.au"},
        ],
        "other_resources": [
            {"name": "1800RESPECT (family & sexual violence)", "phone": "1800 737 732"},
            {"name": "Emergency", "phone": "000"},
        ],
    },
    "CA": {
        "country_name": "Canada", "flag": "🇨🇦", "currency_symbol": "CA$",
        "national": {
            "name": "Legal Aid — provincial programs (find yours)",
            "helpline": "1-800-668-8258",
            "website": "https://www.justice.gc.ca/eng/fund-fina/gov-gouv/aid-aide.html",
            "eligibility": [
                "Meet the provincial financial eligibility (low income)",
                "Serious criminal charges and family law matters",
                "Immigration and refugee cases",
                "Domestic violence and child protection matters",
            ],
        },
        "regional": [
            {"name": "Legal Aid Ontario", "region": "Ontario", "phone": "1-800-668-8258",
             "website": "https://www.legalaid.on.ca"},
            {"name": "Legal Aid BC", "region": "British Columbia", "phone": "1-866-577-2525",
             "website": "https://legalaid.bc.ca"},
            {"name": "Commission des services juridiques", "region": "Québec", "phone": "1-800-842-2213",
             "website": "https://www.csj.qc.ca"},
        ],
        "other_resources": [
            {"name": "Emergency", "phone": "911"},
            {"name": "Kids Help Phone", "phone": "1-800-668-6868"},
        ],
    },
    "SG": {
        "country_name": "Singapore", "flag": "🇸🇬", "currency_symbol": "S$",
        "national": {
            "name": "Legal Aid Bureau (LAB), Ministry of Law",
            "helpline": "1800 2255 529",
            "website": "https://www.mlaw.gov.sg/lab",
            "eligibility": [
                "Pass the Means Test (disposable income & capital limits)",
                "Pass the Merits Test",
                "Singapore citizens and permanent residents",
                "Civil matters; criminal aid via CLAS",
            ],
        },
        "regional": [
            {"name": "Pro Bono SG (Community Legal Clinics)", "region": "Singapore", "phone": "1800 225 5529",
             "website": "https://www.probono.sg"},
            {"name": "Criminal Legal Aid Scheme (CLAS)", "region": "Singapore",
             "website": "https://www.probono.sg/get-help/clas"},
        ],
        "other_resources": [
            {"name": "Police", "phone": "999"},
            {"name": "AWARE Women's Helpline", "phone": "1800 777 5555"},
        ],
    },
    "DE": {
        "country_name": "Germany", "flag": "🇩🇪", "currency_symbol": "€",
        "national": {
            "name": "Beratungshilfe & Prozesskostenhilfe — apply at your local Amtsgericht",
            "helpline": "",
            "website": "https://www.bmj.de/DE/themen/gerichtsverfahren/beratungs_prozesskostenhilfe/beratungs_prozesskostenhilfe_node.html",
            "eligibility": [
                "Geringes Einkommen / niedrige Einkünfte (low income)",
                "Beratungshilfe für außergerichtliche Rechtsberatung",
                "Prozesskostenhilfe (PKH) für Gerichtsverfahren",
                "Hinreichende Erfolgsaussicht der Sache",
            ],
        },
        "regional": [
            {"name": "Deutscher Anwaltverein — Anwaltssuche", "region": "Bundesweit",
             "website": "https://anwaltauskunft.de"},
            {"name": "Rechtsantragstelle (am örtlichen Amtsgericht)", "region": "Lokal",
             "website": "https://www.justiz.de"},
        ],
        "other_resources": [
            {"name": "Polizei / Notruf", "phone": "110"},
            {"name": "Hilfetelefon Gewalt gegen Frauen", "phone": "116 016"},
        ],
    },
}


@router.get("/legal-aid/contacts")
async def legal_aid_contacts(response: Response, country: str = "IN"):
    response.headers["Cache-Control"] = "public, max-age=3600"
    code = country.upper() if country.upper() in LEGAL_AID else "IN"
    data = LEGAL_AID[code]
    return {"country": code, **data}


@router.get("/stats")
@limiter.limit("60/minute")
async def public_stats(request: Request, response: Response):
    """Public, read-only aggregate counts for the homepage social-proof bar.

    Returns real platform totals only (no PII). Each metric independently
    degrades to 0 on query failure so a single bad count never 500s the
    endpoint or breaks the landing page. Cached publicly for 1 hour.
    """
    response.headers["Cache-Control"] = "public, max-age=3600"

    async def _count(sql: str) -> int:
        try:
            return int(await fetchval(sql) or 0)
        except Exception as e:  # pragma: no cover - defensive
            logger.warning("public_stats count failed: %s", e)
            return 0

    answered_questions = await _count(
        "SELECT COUNT(*) FROM legal_questions WHERE ai_answer IS NOT NULL"
    )
    verified_lawyers = await _count(
        "SELECT COUNT(*) FROM lawyers WHERE verified = TRUE"
    )
    documents_generated = await _count(
        "SELECT COUNT(*) FROM paid_documents WHERE status = 'paid'"
    )

    return {
        "answered_questions": answered_questions,
        "verified_lawyers": verified_lawyers,
        "documents_generated": documents_generated,
    }
