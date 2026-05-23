"""
LitigaForge AI — Chat Router
AI legal drafting chat and match-based messaging threads.
"""
import logging
import os
from typing import Optional

import requests as _req
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import get_current_user
from rate_limit import limiter
from database import fetchrow, fetch, execute
from sanitizer import sanitize_text
from ai_safety import wrap_user_prompt, add_disclaimer, validate_ai_response

logger = logging.getLogger("litigaforge.chat")
router = APIRouter(tags=["chat"])


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


# ── AI Legal Chat / Drafting ────────────────────────────────────────────────────────

class AIChatRequest(BaseModel):
    message: str
    context: str = ""
    thread_id: Optional[int] = None


@router.post("/ai-legal-chat")
@limiter.limit("20/minute")
async def ai_legal_chat(
    req: AIChatRequest,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")

    try:
        safe_message = sanitize_text(req.message, max_length=2000, field_name="message")
        safe_context = sanitize_text(req.context, max_length=2000, field_name="context") if req.context else ""
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    system_prompt = """You are LitigaForge AI, a legal assistant for the Indian legal system, specifically for Telangana and Andhra Pradesh.
You help advocates and clients with legal drafting, procedural guidance, and case analysis.

IMPORTANT: Always include this disclaimer at the end of your response:
"This is AI-generated guidance only. Please verify with a qualified lawyer before acting. This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice."

Be concise, accurate, and cite relevant Indian laws (IPC, CrPC, CPC, specific state acts) where applicable."""

    user_prompt = safe_message
    if safe_context:
        user_prompt = f"Context: {safe_context}\n\nQuestion: {safe_message}"

    full_prompt = f"{system_prompt}\n\n{user_prompt}"
    response = _ai(wrap_user_prompt(full_prompt), 2500)
    response = validate_ai_response(response)
    response = add_disclaimer(response)

    if req.thread_id:
        await execute(
            """INSERT INTO chat_messages (thread_id, sender_id, sender_role, content)
               VALUES ($1, NULL, 'ai', $2)""",
            req.thread_id, response,
        )

    return {"reply": response, "disclaimer": "AI-generated guidance only. Verify with a qualified lawyer."}


# ── Chat Threads & Messages ──────────────────────────────────────────────────────────

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
        """SELECT * FROM matches WHERE id = $1
           AND (client_id = $2 OR lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $3))""",
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

    try:
        safe_content = sanitize_text(req.content, max_length=2000, field_name="content")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    row = await fetchrow(
        """INSERT INTO chat_messages (thread_id, sender_id, sender_role, content)
           VALUES ($1, $2, 'user', $3)
           RETURNING id, thread_id, sender_id, sender_role, content, created_at""",
        req.thread_id, current_user["id"], safe_content,
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
