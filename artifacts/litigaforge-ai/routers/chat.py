"""
LitigaForge AI — Chat Router
AI legal drafting chat and match-based messaging threads.

Endpoints:
  POST /ai-legal-chat                         — AI legal drafting assistant
  POST /chat/threads                          — create thread (manual)
  GET  /chat/threads                          — list threads + unread_count
  POST /chat/messages                         — send a message (broadcasts via WS)
  GET  /chat/threads/{id}/messages?before=    — paginated history (latest 50 / cursor)
  POST /chat/threads/{id}/mark-read           — upsert thread_read_state
  WS   /ws/chat/{id}?token=                  — real-time message push
"""
import json
import logging
import os
from typing import Dict, List, Optional

import requests as _req
from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from auth import get_current_user, check_tier_usage, decode_token
from rate_limit import limiter
from database import fetchrow, fetch, execute
from sanitizer import sanitize_text
from ai_safety import wrap_user_prompt, add_disclaimer, validate_ai_response
from jurisdiction import (
    jurisdiction_block, advisor_descriptor, localize_currency,
    country_name, normalize_code,
)

logger = logging.getLogger("litigaforge.chat")
router = APIRouter(tags=["chat"])


# ── Chat WebSocket connection manager ────────────────────────────────────────
class ChatConnectionManager:
    """In-process WS hub keyed by thread_id. No Redis needed."""
    def __init__(self) -> None:
        self._conns: Dict[int, List[WebSocket]] = {}

    async def connect(self, thread_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self._conns.setdefault(thread_id, []).append(ws)

    def disconnect(self, thread_id: int, ws: WebSocket) -> None:
        bucket = self._conns.get(thread_id, [])
        try:
            bucket.remove(ws)
        except ValueError:
            pass
        if not bucket:
            self._conns.pop(thread_id, None)

    async def broadcast(self, thread_id: int, data: dict) -> None:
        bucket = list(self._conns.get(thread_id, []))
        dead: List[WebSocket] = []
        for ws in bucket:
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(thread_id, ws)


chat_manager = ChatConnectionManager()


# ── WS endpoint: /ws/chat/{thread_id}?token=<jwt> ───────────────────────────

@router.websocket("/ws/chat/{thread_id}")
async def chat_ws(thread_id: int, ws: WebSocket, token: Optional[str] = Query(None)):
    """
    Real-time push for a chat thread. Auth via ?token= (same JWT from localStorage).
    Verifies the caller is the client or lawyer on this thread before accepting.
    """
    # Verify token
    if not token:
        await ws.close(code=4001)
        return
    try:
        user_id = decode_token(token)
    except Exception:
        await ws.close(code=4001)
        return

    # Verify thread access
    auth = await fetchrow(
        """SELECT m.id FROM matches m
           JOIN chat_threads t ON t.match_id = m.id
           WHERE t.id = $1
             AND (m.client_id = $2
                  OR m.lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $3))""",
        thread_id, user_id, user_id,
    )
    if not auth:
        await ws.close(code=4003)
        return

    await chat_manager.connect(thread_id, ws)
    try:
        while True:
            await ws.receive_text()  # absorb client pings; ignore payload
    except WebSocketDisconnect:
        chat_manager.disconnect(thread_id, ws)
    except Exception:
        chat_manager.disconnect(thread_id, ws)


# ── AI helpers ───────────────────────────────────────────────────────────────

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


# ── AI Legal Chat / Drafting ─────────────────────────────────────────────────

class AIChatRequest(BaseModel):
    message: str
    context: str = ""
    thread_id: Optional[int] = None
    country: str = "IN"


@router.post("/ai-legal-chat")
@limiter.limit("20/minute")
async def ai_legal_chat(
    req: AIChatRequest,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")

    if not check_tier_usage(current_user):
        limit = {"free": 5, "professional": 50, "advocate_pro": -1}.get(
            current_user.get("subscription_tier", "free"), 5
        )
        raise HTTPException(403, f"Monthly limit reached ({limit} chats/month). Upgrade to continue.")

    try:
        safe_message = sanitize_text(req.message, max_length=2000, field_name="message")
        safe_context = sanitize_text(req.context, max_length=2000, field_name="context") if req.context else ""
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    code = normalize_code(req.country)
    system_prompt = f"""You are LitigaForge AI, {advisor_descriptor(code)}.
You help advocates and clients with legal drafting, procedural guidance, and case analysis.

{jurisdiction_block(code)}

IMPORTANT: Always include this disclaimer at the end of your response:
"This is AI-generated guidance only. Please verify with a qualified lawyer before acting. This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice."

Be concise and accurate, and cite the real statutes, sections, and procedures of {country_name(code)} where applicable."""

    user_prompt = safe_message
    if safe_context:
        user_prompt = f"Context: {safe_context}\n\nQuestion: {safe_message}"

    full_prompt = f"{system_prompt}\n\n{user_prompt}"
    response = _ai(wrap_user_prompt(full_prompt), 2500)
    response = validate_ai_response(response)
    response = localize_currency(response, code)
    response = add_disclaimer(response)

    if req.thread_id:
        await execute(
            """INSERT INTO chat_messages (thread_id, sender_id, sender_role, content)
               VALUES ($1, NULL, 'ai', $2)""",
            req.thread_id, response,
        )

    return {"reply": response, "disclaimer": "AI-generated guidance only. Verify with a qualified lawyer."}


# ── Chat Threads & Messages ──────────────────────────────────────────────────

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
    uid = current_user["id"]
    rows = await fetch(
        """SELECT t.id, t.match_id, t.title, t.created_at,
                  m.case_requirement_id, m.lawyer_id, m.client_id,
                  c.title as case_title, l.name as lawyer_name,
                  uc.name as client_name,
                  (SELECT content FROM chat_messages
                   WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message,
                  COALESCE(
                      t.last_message_at::text,
                      (SELECT created_at::text FROM chat_messages
                       WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1)
                  ) as last_message_at,
                  (
                      SELECT COUNT(*) FROM chat_messages cm
                      WHERE cm.thread_id = t.id
                      AND cm.created_at > COALESCE(
                          (SELECT last_read_at FROM thread_read_state
                           WHERE thread_id = t.id AND user_id = $3),
                          '1970-01-01'::timestamptz
                      )
                  ) as unread_count
           FROM chat_threads t
           JOIN matches m ON t.match_id = m.id
           JOIN case_requirements c ON m.case_requirement_id = c.id
           JOIN lawyers l ON m.lawyer_id = l.id
           LEFT JOIN users uc ON uc.id = m.client_id
           WHERE m.client_id = $1 OR m.lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $2)
           ORDER BY COALESCE(
               t.last_message_at,
               (SELECT created_at FROM chat_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1),
               t.created_at
           ) DESC""",
        uid, uid, uid,
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
        r["unread_count"] = int(r.get("unread_count") or 0)
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
           WHERE t.id = $1
             AND (m.client_id = $2
                  OR m.lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $3))""",
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

    # Update thread's last_message_at for fast sorting (best-effort)
    try:
        await execute(
            "UPDATE chat_threads SET last_message_at = NOW() WHERE id = $1",
            req.thread_id,
        )
    except Exception:
        pass

    # Broadcast to all WS subscribers of this thread
    await chat_manager.broadcast(req.thread_id, {
        "event": "new_message",
        "message": dict(row),
    })

    return {"message": row}


@router.get("/chat/threads/{thread_id}/messages")
async def get_chat_messages(
    thread_id: int,
    before: Optional[str] = Query(None, description="ISO timestamp cursor — return messages older than this"),
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")
    auth = await fetchrow(
        """SELECT m.id FROM matches m
           JOIN chat_threads t ON t.match_id = m.id
           WHERE t.id = $1
             AND (m.client_id = $2
                  OR m.lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $3))""",
        thread_id, current_user["id"], current_user["id"],
    )
    if not auth:
        raise HTTPException(403, "Not authorized")

    if before:
        # Cursor pagination: 50 messages before the timestamp, returned oldest-first
        rows = await fetch(
            """SELECT id, thread_id, sender_id, sender_role, content, created_at
               FROM (
                   SELECT id, thread_id, sender_id, sender_role, content, created_at
                   FROM chat_messages
                   WHERE thread_id = $1 AND created_at < $2::timestamptz
                   ORDER BY created_at DESC LIMIT 50
               ) sub
               ORDER BY created_at ASC""",
            thread_id, before,
        )
    else:
        # Initial load: latest 50, returned oldest-first
        rows = await fetch(
            """SELECT id, thread_id, sender_id, sender_role, content, created_at
               FROM (
                   SELECT id, thread_id, sender_id, sender_role, content, created_at
                   FROM chat_messages WHERE thread_id = $1
                   ORDER BY created_at DESC LIMIT 50
               ) sub
               ORDER BY created_at ASC""",
            thread_id,
        )

    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "messages": rows}


@router.post("/chat/threads/{thread_id}/mark-read")
async def mark_thread_read(
    thread_id: int,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Upsert thread_read_state so unread_count becomes 0 for the calling user."""
    if not current_user:
        raise HTTPException(401, "Login required")
    # Access check
    auth = await fetchrow(
        """SELECT m.id FROM matches m
           JOIN chat_threads t ON t.match_id = m.id
           WHERE t.id = $1
             AND (m.client_id = $2
                  OR m.lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $3))""",
        thread_id, current_user["id"], current_user["id"],
    )
    if not auth:
        raise HTTPException(403, "Not authorized")

    await execute(
        """INSERT INTO thread_read_state (thread_id, user_id, last_read_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (thread_id, user_id)
           DO UPDATE SET last_read_at = NOW()""",
        thread_id, current_user["id"],
    )
    return {"ok": True}
