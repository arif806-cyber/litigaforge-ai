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
  WS   /ws/chat/{id}                         — real-time message push (httpOnly cookie)
"""
import json
import asyncio
import logging
import os
import re
import time
import uuid
from typing import Dict, List, Optional

import requests as _req
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from auth import get_current_user, require_ai_user, decode_token
from routers.presence import manager as notification_manager
from rate_limit import limiter
from database import fetchrow, fetch, execute
from sanitizer import sanitize_text
from ai_safety import wrap_user_prompt, add_disclaimer, validate_ai_response
from jurisdiction import (
    jurisdiction_block, advisor_descriptor, localize_currency,
    country_name, normalize_code,
)
from jobs import enqueue_job
from legal_chat_policy import (
    build_case_profile, is_lawyer_request,
    make_legal_chat_prompt, validate_citations,
)

logger = logging.getLogger("litigaforge.chat")
router = APIRouter(tags=["chat"])

CHAT_FILE_MAX_BYTES = 10 * 1024 * 1024
CHAT_FILE_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
CHAT_FILE_MIMES = {"application/pdf", "image/jpeg", "image/png"}
CHAT_FILE_TYPE_RULES = {
    ".pdf": ("application/pdf", lambda data: data.startswith(b"%PDF-")),
    ".jpg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".jpeg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".png": ("image/png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
}


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


# ── WS endpoint: /ws/chat/{thread_id} (httpOnly cookie auth) ────────────────

@router.websocket("/ws/chat/{thread_id}")
async def chat_ws(thread_id: int, ws: WebSocket):
    """
    Real-time push for a chat thread. Auth is taken from the browser's httpOnly
    access cookie automatically included in the WebSocket handshake.
    Verifies the caller is the client or lawyer on this thread before accepting.
    """
    # Verify token
    token = ws.cookies.get("lf_token")
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
from llm import legal_llm

def _claude(prompt: str, max_tokens: int = 2000) -> str:
    try:
        return legal_llm.complete("", prompt, max_tokens=max_tokens)
    except Exception:
        return ""
    return ""


def _gemini(prompt: str, max_tokens: int = 2000) -> str:
    return _claude(prompt, max_tokens)


def _ai(prompt: str, max_tokens: int = 2000) -> str:
    return legal_llm.complete("", prompt, max_tokens=max_tokens)


# ── AI Legal Chat / Drafting ─────────────────────────────────────────────────

class AIChatRequest(BaseModel):
    message: str
    context: str = ""
    thread_id: Optional[int] = None
    country: str = "IN"
    history: List[dict] = Field(default_factory=list)


@router.post("/ai-legal-chat", status_code=202)
@limiter.limit("20/minute")
async def ai_legal_chat(
    req: AIChatRequest,
    request: Request,
    current_user: dict = Depends(require_ai_user),
):
    try:
        safe_message = sanitize_text(req.message, max_length=2000, field_name="message")
        safe_context = sanitize_text(req.context, max_length=2000, field_name="context") if req.context else ""
        history = [
            {"role": item.get("role"), "content": sanitize_text(
                str(item.get("content", "")), max_length=2000, field_name="history"
            )}
            for item in req.history[-12:]
            if isinstance(item, dict) and item.get("role") in {"user", "ai"}
        ]
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    code = normalize_code(req.country)
    case_profile = build_case_profile(history, safe_message + "\n" + safe_context)
    if code == "IN":
        full_prompt = make_legal_chat_prompt(safe_message, safe_context, case_profile, history)
    else:
        full_prompt = f"""You are LitigaForge AI, {advisor_descriptor(code)}.
{jurisdiction_block(code)}
Give practical, concise legal information for {country_name(code)}. Do not invent facts,
court limits, laws, citations, or case law. If a fact is missing, use [placeholders] for
a requested draft and list missing details at the end. Ask at most one concise round of
clarifying questions. Avoid repeated disclaimers; the page already displays one.
Prior conversation: {json.dumps(history[-16:], ensure_ascii=False)}
User context: {safe_context}
Current request: {safe_message}"""
    system_prompt = f"""You are LitigaForge AI, {advisor_descriptor(code)}.
You help advocates and clients with legal drafting, procedural guidance, and case analysis.

{jurisdiction_block(code)}

Before recommending any court, tribunal, consumer forum, or authority, check the
claim amount and stated territorial jurisdiction. Do not quote pecuniary limits
unless confident they are current and applicable. If venue depends on missing
facts or the limit is uncertain, say so and ask for the missing detail rather
than directing the user to a specific forum.

Be concise and accurate. Do not repeat the page's legal disclaimer."""
    full_prompt = f"{system_prompt}\n\n{full_prompt}"
    async def work():
        grounded_result = None
        if os.getenv("LITIGAFORGE_AI_PIPELINE_MODE", "legacy").strip().lower() == "grounded":
            if code != "IN":
                raise RuntimeError("Grounded pipeline is not enabled for this jurisdiction yet.")
            from database import get_pool
            from grounded_legal_pipeline import grounded_answer
            pool = await get_pool()
            async with pool.acquire() as conn:
                grounded_result = await grounded_answer(
                    conn, safe_message, history=history, context=safe_context, country=code,
                )
            response = grounded_result["reply"]
            if grounded_result["draft"] and not response.startswith(
                "Draft — review by an advocate before filing"
            ):
                response = "Draft — review by an advocate before filing\n\n" + response
            sources = grounded_result["sources"]
            if sources:
                response += "\n\n## Sources\n" + "\n".join(
                    f"- [{item['label']}]({item['url']})" for item in sources
                )
        else:
            response = await asyncio.to_thread(_ai, wrap_user_prompt(full_prompt), 3500)
        response = localize_currency(validate_ai_response(response), code)
        if code == "IN":
            response = validate_citations(response)
        # The page already carries a fixed disclaimer banner; remove the standard
        # appended block from this endpoint to avoid repeating it in every turn.
        response = re.sub(
            r"(?is)(?:\n{1,2}---\s*\n)?\*?This is (?:AI-generated guidance|legal information), not legal advice\..{0,350}$",
            "", response,
        ).strip()
        if response and not re.search(r"[.!?…)\]}`\"'»]$", response):
            response += "\n\nNote: This answer may have been shortened. Ask me to continue from the last sentence."
        if req.thread_id:
            await execute(
                """INSERT INTO chat_messages (thread_id, sender_id, sender_role, content)
                   VALUES ($1, NULL, 'ai', $2)""", req.thread_id, response,
            )
        actions = []
        if is_lawyer_request(safe_message):
            post_case_type = {
                "residential_rent_eviction": "Property Dispute",
                "family": "Family Matter",
                "criminal": "Criminal",
                "civil": "Civil",
                "consumer": "Consumer",
                "employment": "Labour",
                "motor_accident": "Motor",
            }.get(case_profile.get("matter_type"), "")
            prefill_lines = [
                f"Role: {case_profile['role']}" if case_profile.get("role") else "",
                f"Matter: {case_profile['matter_type']}" if case_profile.get("matter_type") else "",
                f"Location: {', '.join(x for x in [case_profile.get('city'), case_profile.get('state')] if x)}"
                if case_profile.get("city") or case_profile.get("state") else "",
                f"Monthly amount (INR): {case_profile['monthly_amount_inr']}" if case_profile.get("monthly_amount_inr") else "",
                f"Unpaid months: {case_profile['unpaid_months']}" if case_profile.get("unpaid_months") else "",
                f"Key dates: {', '.join(case_profile['key_dates'])}" if case_profile.get("key_dates") else "",
                f"Documents: {', '.join(case_profile['documents'])}" if case_profile.get("documents") else "",
                f"User request: {safe_message[:600]}",
            ]
            actions = [
                {"label": "Post this as a case", "href": "/post-case", "kind": "post_case",
                 "prefill": {"case_type": post_case_type,
                             "title": "Rental arrears / eviction consultation" if case_profile.get("matter_type") == "residential_rent_eviction" else "Legal matter consultation",
                             "location": ", ".join(x for x in [case_profile.get("city"), case_profile.get("state")] if x),
                             "description": "\n".join(line for line in prefill_lines if line)[:1800]}},
                {"label": "Browse advocates", "href": "/lawyers", "kind": "link"},
                {"label": "Free legal aid", "href": "/legal-aid", "kind": "link"},
            ]
        result = {"reply": response, "actions": actions}
        if grounded_result:
            result["sources"] = grounded_result["sources"]
            result["models"] = grounded_result["models"]
            result["latency_ms"] = grounded_result["latency_ms"]
            result["cost_usd"] = grounded_result["cost_usd"]
        return result
    return await enqueue_job(current_user["id"], work)


# ── Chat Threads & Messages ──────────────────────────────────────────────────

class ChatThreadRequest(BaseModel):
    match_id: int
    title: str = ""


class ChatMessageRequest(BaseModel):
    thread_id: int
    content: str
    language: str = "auto"


async def _authorized_chat_participants(thread_id: int, user_id: int):
    return await fetchrow(
        """SELECT m.id, m.client_id, l.user_id AS lawyer_user_id
           FROM matches m
           JOIN chat_threads t ON t.match_id = m.id
           JOIN lawyers l ON l.id = m.lawyer_id
           WHERE t.id = $1
             AND (m.client_id = $2
                  OR m.lawyer_id IN (SELECT id FROM lawyers WHERE user_id = $3))""",
        thread_id, user_id, user_id,
    )


async def _broadcast_chat_message(thread_id: int, current_user: dict, auth: dict, row: dict) -> None:
    try:
        await execute(
            "UPDATE chat_threads SET last_message_at = NOW() WHERE id = $1",
            thread_id,
        )
    except Exception:
        pass

    await chat_manager.broadcast(thread_id, {
        "event": "new_message",
        "message": dict(row),
    })

    recipient_id = (
        auth["lawyer_user_id"]
        if current_user["id"] == auth["client_id"]
        else auth["client_id"]
    )
    await notification_manager.broadcast(f"user:{recipient_id}", {
        "event": "new_message",
        "thread_id": thread_id,
        "sender_name": current_user.get("name") or "Someone",
        "message": dict(row),
    })


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
    auth = await _authorized_chat_participants(req.thread_id, current_user["id"])
    if not auth:
        raise HTTPException(403, "Not authorized")

    try:
        safe_content = sanitize_text(req.content, max_length=2000, field_name="content")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    language = "en"
    try:
        from routers.connect_v2 import detect_language, multilang_enabled, LANGUAGES
        if multilang_enabled():
            language = detect_language(safe_content) if req.language == "auto" else req.language
            if language not in LANGUAGES:
                raise HTTPException(422, "Unsupported message language")
    except ImportError:
        pass

    row = await fetchrow(
        """INSERT INTO chat_messages (thread_id, sender_id, sender_role, content, original_language)
           VALUES ($1, $2, 'user', $3, $4)
           RETURNING id, thread_id, sender_id, sender_role, content, message_type,
                     file_url, filename, file_size, original_language, created_at""",
        req.thread_id, current_user["id"], safe_content, language,
    )
    row["created_at"] = str(row["created_at"])
    await _broadcast_chat_message(req.thread_id, current_user, auth, row)
    return {"message": row}


@router.post("/chat/messages/file")
async def send_chat_file(
    request: Request,
    thread_id: int,
    file: UploadFile = File(...),
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Login required")

    auth = await _authorized_chat_participants(thread_id, current_user["id"])
    if not auth:
        raise HTTPException(403, "Not authorized")
    if not file.filename:
        raise HTTPException(400, "No file provided")

    try:
        safe_name = sanitize_text(
            os.path.basename(file.filename), max_length=255, field_name="filename"
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    ext = ("." + safe_name.rsplit(".", 1)[-1].lower()) if "." in safe_name else ""
    declared_mime = (file.content_type or "").lower().split(";")[0].strip()
    if ext not in CHAT_FILE_EXTENSIONS or declared_mime not in CHAT_FILE_MIMES:
        raise HTTPException(400, "Only PDF, JPG, and PNG files are allowed")

    content = await file.read(CHAT_FILE_MAX_BYTES + 1)
    if not content:
        raise HTTPException(400, "Uploaded file is empty")
    if len(content) > CHAT_FILE_MAX_BYTES:
        raise HTTPException(413, "File too large. Maximum allowed size is 10 MB")
    expected_mime, has_valid_signature = CHAT_FILE_TYPE_RULES[ext]
    if declared_mime != expected_mime or not has_valid_signature(content):
        raise HTTPException(400, "File contents do not match the selected file type")

    unique_name = (
        f"chat_{thread_id}_user_{current_user['id']}_{int(time.time())}_"
        f"{uuid.uuid4().hex[:10]}_{safe_name}"
    )
    obj_key = f"uploads/{unique_name}"
    file_url = f"/secure-files/{unique_name}"
    from storage import get_object_storage
    storage = get_object_storage()
    if storage is None:
        raise HTTPException(503, "File storage is temporarily unavailable")
    try:
        storage.upload_from_bytes(obj_key, content)
    except Exception:
        logger.exception("Chat file upload failed for thread %s", thread_id)
        raise HTTPException(503, "File upload failed. Please try again")

    try:
        row = await fetchrow(
            """INSERT INTO chat_messages
                   (thread_id, sender_id, sender_role, content, message_type,
                    file_url, filename, file_size, file_path)
               VALUES ($1, $2, 'user', $3, 'file', $4, $5, $6, $7)
               RETURNING id, thread_id, sender_id, sender_role, content, message_type,
                         file_url, filename, file_size, created_at""",
            thread_id, current_user["id"], safe_name, file_url, safe_name,
            len(content), obj_key,
        )
    except Exception:
        try:
            storage.delete(obj_key)
        except Exception:
            logger.warning("Could not remove orphaned chat object %s", obj_key)
        raise

    row["created_at"] = str(row["created_at"])
    await _broadcast_chat_message(thread_id, current_user, auth, row)
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
            """SELECT id, thread_id, sender_id, sender_role, content, message_type,
                      file_url, filename, file_size, original_language, created_at
               FROM (
                   SELECT id, thread_id, sender_id, sender_role, content, message_type,
                          file_url, filename, file_size, original_language, created_at
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
            """SELECT id, thread_id, sender_id, sender_role, content, message_type,
                      file_url, filename, file_size, original_language, created_at
               FROM (
                   SELECT id, thread_id, sender_id, sender_role, content, message_type,
                          file_url, filename, file_size, original_language, created_at
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
