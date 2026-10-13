"""Opt-in advocate/client connection and multilingual reading aids."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import mimetypes
import os
import re
import time
import uuid
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
import httpx

from auth import get_current_user
from database import execute, fetch, fetchrow, get_pool
from sanitizer import sanitize_text
from storage import get_object_storage

router = APIRouter(tags=["connect-v2"])

PHASE1 = ["en", "hi", "te", "ta", "kn", "mr"]
PHASE2 = ["ml", "bn", "gu", "pa", "or", "ur"]
PHASE3 = ["as", "brx", "doi", "ks", "kok", "mai", "mni", "ne", "sa", "sat", "sd"]
LANGUAGES = set(PHASE1 + PHASE2 + PHASE3)
LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "te": "Telugu", "ta": "Tamil", "kn": "Kannada",
    "mr": "Marathi", "ml": "Malayalam", "bn": "Bengali", "gu": "Gujarati",
    "pa": "Punjabi", "or": "Odia", "ur": "Urdu", "as": "Assamese", "brx": "Bodo",
    "doi": "Dogri", "ks": "Kashmiri", "kok": "Konkani", "mai": "Maithili",
    "mni": "Manipuri", "ne": "Nepali", "sa": "Sanskrit", "sat": "Santali", "sd": "Sindhi",
}
_voice_semaphore = asyncio.Semaphore(2)
_voice_last_request: dict[int, float] = {}


def enabled() -> bool:
    value = os.getenv("connect_v2", os.getenv("CONNECT_V2_ENABLED", "false"))
    return value.strip().lower() in {"1", "true", "yes", "on"}


def multilang_enabled() -> bool:
    value = os.getenv("multilang", os.getenv("MULTILANG_ENABLED", "false"))
    return value.strip().lower() in {"1", "true", "yes", "on"}


def require_connect():
    if not enabled():
        raise HTTPException(404, "Advocate connect is not enabled")


def require_multilang():
    if not multilang_enabled():
        raise HTTPException(404, "Multilingual support is not enabled")


def detect_language(text: str) -> str:
    for code, start, end in [
        ("hi", 0x0900, 0x097F), ("te", 0x0C00, 0x0C7F), ("ta", 0x0B80, 0x0BFF),
        ("kn", 0x0C80, 0x0CFF), ("ml", 0x0D00, 0x0D7F), ("bn", 0x0980, 0x09FF),
        ("gu", 0x0A80, 0x0AFF), ("pa", 0x0A00, 0x0A7F), ("or", 0x0B00, 0x0B7F),
        ("ur", 0x0600, 0x06FF),
    ]:
        if any(start <= ord(ch) <= end for ch in text):
            return code
    return "en"


@router.get("/connect-v2/flags")
async def flags():
    return {
        "connect_v2": enabled(), "multilang": multilang_enabled(),
        "phase1": PHASE1, "phase2": PHASE2, "phase3": PHASE3,
        "languages_needing_review": PHASE2,
        "language_names": LANGUAGE_NAMES,
    }


class CasePost(BaseModel):
    problem_type: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=5, max_length=5000)
    location: str = Field(min_length=2, max_length=100)
    hide_name: bool = True
    language: str = "en"
    document_paths: list[str] = Field(default_factory=list, max_length=12)
    voice_path: str | None = None
    voice_transcript: str | None = Field(default=None, max_length=5000)
    voice_language: str | None = None


def _require_client(user):
    if user.get("role") not in ("client", "user"):
        raise HTTPException(403, "Client access required")


def _require_verified_advocate(user):
    if user.get("role") not in ("advocate", "lawyer"):
        raise HTTPException(403, "Advocate access required")


async def _advocate_profile(user):
    row = await fetchrow(
        """SELECT id, name, district, courts_practised, practice_areas, experience_years,
                  phone, verified, verification_status, availability
           FROM lawyers WHERE user_id=$1 AND verified=TRUE
             AND verification_status='verified' AND COALESCE(is_test,FALSE)=FALSE
             AND COALESCE(admin_hidden,FALSE)=FALSE""",
        user["id"],
    )
    if not row:
        raise HTTPException(403, "Only verified advocates can receive requests")
    return row


def _advocate_matches_case(advocate, location: str, problem_type: str) -> bool:
    loc = (location or "").casefold()
    district = (advocate.get("district") or "").casefold()
    courts = [str(x).casefold() for x in (advocate.get("courts_practised") or [])]
    practice = [str(x).casefold() for x in (advocate.get("practice_areas") or [])]
    location_match = bool(district and (district in loc or loc in district))
    location_match = location_match or any(court and court in loc for court in courts)
    type_key = problem_type.casefold()
    practice_match = any(p and (p in type_key or type_key in p) for p in practice)
    return location_match and practice_match


@router.post("/connect-v2/cases")
async def create_request(body: CasePost, user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    _require_client(user)
    if body.language not in LANGUAGES:
        raise HTTPException(422, "Choose a supported language")
    if (body.language != "en" or (body.voice_language and body.voice_language != "en")) and not multilang_enabled():
        raise HTTPException(404, "Multilingual support is not enabled")
    if body.voice_language and body.voice_language not in LANGUAGES:
        raise HTTPException(422, "Choose a supported voice-note language")
    description = sanitize_text(body.description, max_length=5000, field_name="description")
    location = sanitize_text(body.location, max_length=100, field_name="location")
    problem = sanitize_text(body.problem_type, max_length=80, field_name="problem_type")
    if any(not path.startswith(f"connect-v2/{user['id']}/") for path in body.document_paths):
        raise HTTPException(422, "Uploaded documents must belong to your account")
    if body.voice_path and not body.voice_path.startswith(f"connect-v2/{user['id']}/"):
        raise HTTPException(422, "Voice note must belong to your account")
    title = f"{problem}: {description[:90].strip()}"
    try:
        from database import create_case_requirement_with_quota
        row = await create_case_requirement_with_quota(
            user["id"], (title[:200], problem, description, location, "", 0, 0, body.hide_name)
        )
    except PermissionError:
        raise HTTPException(402, "Case-posting limit reached")
    await execute(
        """UPDATE case_requirements SET problem_type=$1, connect_v2=TRUE, original_language=$2,
             hide_name=$3, document_paths=$4::jsonb, voice_path=$5,
             voice_transcript=$6, voice_language=$7
           WHERE id=$8 AND user_id=$9""",
        problem, body.language, body.hide_name, json.dumps(body.document_paths),
        body.voice_path, body.voice_transcript, body.voice_language, row["id"], user["id"],
    )
    linked_paths = list(body.document_paths)
    if body.voice_path:
        linked_paths.append(body.voice_path)
    if linked_paths:
        await execute(
            """UPDATE client_documents SET case_requirement_id=$1
               WHERE client_id=$2 AND file_path=ANY($3::text[])""",
            row["id"], user["id"], linked_paths,
        )
    return {"case": {"id": row["id"], "problem_type": problem, "status": "open"}}


@router.post("/connect-v2/uploads")
async def upload_connect_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    if file.content_type not in {
        "image/jpeg", "image/png", "image/webp", "application/pdf",
        "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav",
    }:
        raise HTTPException(415, "Upload a photo, PDF, or voice note")
    data = await file.read(15 * 1024 * 1024 + 1)
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "Each upload must be 15 MB or smaller")
    if file.content_type == "image/jpeg" and not data.startswith(b"\xff\xd8\xff"):
        raise HTTPException(415, "File content does not match its type")
    if file.content_type == "image/png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(415, "File content does not match its type")
    if file.content_type == "application/pdf" and not data.startswith(b"%PDF-"):
        raise HTTPException(415, "File content does not match its type")
    storage = get_object_storage()
    if not storage:
        raise HTTPException(503, "Private file storage is not available")
    ext = mimetypes.guess_extension(file.content_type) or ".bin"
    key = f"connect-v2/{user['id']}/{uuid.uuid4().hex}{ext}"
    await asyncio.to_thread(storage.upload_from_bytes, key, data)
    safe_name = sanitize_text(file.filename or "upload", max_length=255, field_name="filename")
    await execute(
        """INSERT INTO client_documents
             (case_id, client_id, filename, file_type, file_size, file_path, file_url, case_requirement_id)
           VALUES (NULL,$1,$2,$3,$4,$5,$6,NULL)""",
        user["id"], safe_name, file.content_type, len(data), key, f"/secure-files/{key}",
    )
    return {"object_path": key, "filename": (file.filename or "upload")[:160],
            "content_type": file.content_type, "size": len(data)}


@router.post("/connect-v2/voice/transcribe")
async def transcribe_connect_voice(file: UploadFile = File(...), user=Depends(get_current_user)):
    require_connect()
    require_multilang()
    if not user:
        raise HTTPException(401, "Login required")
    mime = (file.content_type or "").lower().split(";")[0]
    if mime not in {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"}:
        raise HTTPException(415, "Upload a supported voice recording")
    now = time.monotonic()
    last = _voice_last_request.get(int(user["id"]), 0.0)
    if now - last < 3:
        raise HTTPException(429, "Please wait a moment before transcribing another recording")
    _voice_last_request[int(user["id"])] = now
    audio = await file.read(8 * 1024 * 1024 + 1)
    if not audio or len(audio) > 8 * 1024 * 1024:
        raise HTTPException(413, "Voice recordings must be under 8 MB")
    base = os.getenv("AI_INTEGRATIONS_GEMINI_BASE_URL", "").rstrip("/")
    key = os.getenv("AI_INTEGRATIONS_GEMINI_API_KEY", "").strip()
    if not base or not key:
        raise HTTPException(503, "Voice transcription is unavailable in this environment")
    url = f"{base}/models/gemini-2.5-flash:generateContent"
    payload = {
        "contents": [{"role": "user", "parts": [
            {"text": "Transcribe this legal voice note verbatim in the speaker's language. Do not translate, summarize, infer, or add words. Return only the transcript."},
            {"inline_data": {"mime_type": mime, "data": base64.b64encode(audio).decode("ascii")}},
        ]}],
        "generationConfig": {"maxOutputTokens": 8192},
    }
    async with _voice_semaphore:
        failure = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
                    response = await client.post(url, json=payload, headers={
                        "x-goog-api-key": key, "Content-Type": "application/json",
                    })
                if response.status_code == 429 or response.status_code >= 500:
                    failure = response.status_code
                    if attempt < 2:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                response.raise_for_status()
                data = response.json()
                transcript = "".join(
                    part.get("text", "") for part in
                    data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                ).strip()
                if not transcript:
                    raise HTTPException(502, "No transcript was returned")
                return {"transcript": transcript[:5000], "language": detect_language(transcript)}
            except HTTPException:
                raise
            except Exception as exc:
                failure = type(exc).__name__
                if attempt < 2:
                    await asyncio.sleep(0.5 * (attempt + 1))
    raise HTTPException(502, "Voice transcription failed; keep the original recording and enter a transcript manually")


@router.get("/connect-v2/cases/{case_id}/files/{object_path:path}")
async def get_connect_file(case_id: int, object_path: str, user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    case = await fetchrow(
        """SELECT c.user_id, c.document_paths, c.voice_path FROM case_requirements c
           WHERE c.id=$1 AND c.connect_v2=TRUE AND (c.user_id=$2 OR EXISTS (
             SELECT 1 FROM matches m JOIN lawyers l ON l.id=m.lawyer_id
             WHERE m.case_requirement_id=c.id AND m.status='accepted' AND m.connect_v2=TRUE AND l.user_id=$2))""",
        case_id, user["id"],
    )
    if not case:
        raise HTTPException(404, "File not found")
    paths = case.get("document_paths") or []
    if isinstance(paths, str):
        paths = json.loads(paths)
    if object_path not in paths and object_path != case.get("voice_path"):
        raise HTTPException(404, "File not found")
    storage = get_object_storage()
    if not storage:
        raise HTTPException(503, "Private file storage is not available")
    try:
        data = await asyncio.to_thread(storage.download_as_bytes, object_path)
    except Exception:
        raise HTTPException(404, "File not found")
    mime = mimetypes.guess_type(object_path)[0] or "application/octet-stream"
    return Response(content=data, media_type=mime, headers={"Cache-Control": "private, no-store"})


@router.get("/connect-v2/requests")
async def request_inbox(user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    _require_verified_advocate(user)
    advocate = await _advocate_profile(user)
    cases = await fetch(
        """SELECT c.id, c.created_at, c.problem_type, c.description, c.location,
                  c.document_paths
           FROM case_requirements c
           WHERE c.connect_v2=TRUE AND c.status='open' AND NOT EXISTS (
             SELECT 1 FROM matches m WHERE m.case_requirement_id=c.id
               AND m.lawyer_id=$1 AND m.status IN ('accepted','declined'))
           ORDER BY c.created_at DESC LIMIT 200""", advocate["id"],
    )
    requests = []
    for case in cases:
        if not _advocate_matches_case(advocate, case["location"], case["problem_type"] or ""):
            continue
        docs = case.get("document_paths") or []
        requests.append({
            "id": case["id"], "case_id": case["id"], "posted_at": str(case["created_at"]),
            "problem_type": case["problem_type"], "summary": (case["description"] or "")[:260],
            "location": case["location"], "document_count": len(docs),
        })
    return {"requests": requests}


class CaseUpdate(BaseModel):
    next_step: str = Field(min_length=1, max_length=1000)
    next_step_date: date | None = None
    latest_update: str = Field(min_length=1, max_length=3000)
    language: str = "auto"


@router.post("/connect-v2/requests/{case_id}/accept")
async def accept_request(case_id: int, user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    advocate = await _advocate_profile(user)
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            case = await conn.fetchrow(
                "SELECT * FROM case_requirements WHERE id=$1 AND connect_v2=TRUE FOR UPDATE", case_id
            )
            if not case or case["status"] != "open":
                raise HTTPException(409, "This request is no longer available")
            if not _advocate_matches_case(advocate, case["location"], case.get("problem_type") or ""):
                raise HTTPException(403, "This request does not match your practice area and location")
            changed = await conn.fetchrow(
                "UPDATE case_requirements SET status='assigned' WHERE id=$1 AND status='open' RETURNING id",
                case_id,
            )
            if not changed:
                raise HTTPException(409, "This request has already been accepted")
            match = await conn.fetchrow(
                """INSERT INTO matches
                     (case_requirement_id,lawyer_id,client_id,status,payment_status,connect_v2)
                   VALUES ($1,$2,$3,'accepted','none',TRUE) RETURNING id""",
                case_id, advocate["id"], case["user_id"],
            )
            thread = await conn.fetchrow(
                """INSERT INTO chat_threads(match_id,title) VALUES($1,$2)
                   ON CONFLICT(match_id) DO UPDATE SET title=EXCLUDED.title
                   RETURNING id""", match["id"], case["title"],
            )
            lawyer_case = await conn.fetchrow(
                """INSERT INTO lawyer_cases
                     (lawyer_id,client_id,title,case_type,description,client_name,status,connect_case_id)
                   VALUES ($1,$2,$3,$4,$5,$6,'active',$7)
                   ON CONFLICT(connect_case_id) DO NOTHING
                   RETURNING id""",
                user["id"], case["user_id"], case["title"], case["problem_type"],
                case["description"], (await conn.fetchrow(
                    "SELECT name FROM users WHERE id=$1", case["user_id"]
                ))["name"], case_id,
            )
    return {"accepted": True, "case_id": case_id, "match_id": match["id"],
            "thread_id": thread["id"], "lawyer_case_id": lawyer_case["id"] if lawyer_case else None}


@router.post("/connect-v2/requests/{case_id}/decline")
async def decline_request(case_id: int, user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    advocate = await _advocate_profile(user)
    await execute(
        """INSERT INTO matches(case_requirement_id,lawyer_id,client_id,status,payment_status,connect_v2)
           SELECT id,$2,user_id,'declined','none',TRUE FROM case_requirements
            WHERE id=$1 AND connect_v2=TRUE AND status='open'
           ON CONFLICT DO NOTHING""", case_id, advocate["id"],
    )
    return {"declined": True}


@router.get("/connect-v2/cases/mine")
async def my_connect_cases(user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    cases = await fetch(
        """SELECT c.*, m.id AS match_id, m.status AS match_status, t.id AS thread_id,
                  l.name AS advocate_name,l.verification_status,
                  l.practice_areas,l.experience_years,l.phone
           FROM case_requirements c
           LEFT JOIN matches m ON m.case_requirement_id=c.id AND m.status='accepted'
           LEFT JOIN lawyers l ON l.id=m.lawyer_id
           LEFT JOIN chat_threads t ON t.match_id=m.id
            WHERE c.user_id=$1 AND c.connect_v2=TRUE ORDER BY c.created_at DESC""", user["id"],
    )
    result = []
    for case in cases:
        updates = await fetch(
            "SELECT next_step,next_step_date,update_text,original_language FROM connect_case_updates WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1",
            case["id"],
        )
        docs = await fetch(
            "SELECT id,label,status FROM connect_case_checklist WHERE case_id=$1 ORDER BY id", case["id"]
        )
        stored_docs = case.get("document_paths") or []
        if isinstance(stored_docs, str):
            stored_docs = json.loads(stored_docs)
        attached_files = [
            {"name": path.rsplit("/", 1)[-1],
             "filename": path.rsplit("/", 1)[-1],
             "url": f"/litigaforge/connect-v2/cases/{case['id']}/files/{quote(path, safe='/')}"}
            for path in stored_docs
        ]
        if case.get("voice_path"):
            attached_files.append({
                "name": "Voice note", "filename": "Voice note",
                "content_type": mimetypes.guess_type(case["voice_path"])[0] or "audio/webm",
                "url": f"/litigaforge/connect-v2/cases/{case['id']}/files/{quote(case['voice_path'], safe='/')}",
            })
        adv = None
        if case.get("advocate_name"):
            adv = {
                "name": case["advocate_name"], "verification_status": case["verification_status"],
                "practice_areas": case["practice_areas"] or [],
                "experience_years": case["experience_years"], "phone": case["phone"],
            }
        result.append({
            "id": case["id"], "problem_type": case.get("problem_type") or case["case_type"],
            "description": case["description"], "location": case["location"],
            "language": case.get("original_language") or "en", "status": case["status"],
            "advocate": adv,
            "next_step": updates[0]["next_step"] if updates else "",
            "next_step_date": str(updates[0]["next_step_date"]) if updates and updates[0]["next_step_date"] else None,
            "latest_update": updates[0]["update_text"] if updates else "",
            "latest_update_language": updates[0]["original_language"] if updates else "en",
            "requested_documents": [dict(d) for d in docs], "thread_id": case.get("thread_id"),
            "documents": attached_files,
            "voice_transcript": case.get("voice_transcript"),
            "voice_language": case.get("voice_language") or case.get("original_language") or "en",
        })
    return {"cases": result}


@router.get("/connect-v2/advocate/cases")
async def advocate_connect_cases(user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    _require_verified_advocate(user)
    advocate = await _advocate_profile(user)
    cases = await fetch(
        """SELECT c.*, m.id AS match_id, t.id AS thread_id, u.name AS client_name,
                  u.phone AS client_phone, u.email AS client_email
           FROM case_requirements c
           JOIN matches m ON m.case_requirement_id=c.id AND m.status='accepted'
           LEFT JOIN chat_threads t ON t.match_id=m.id
           JOIN users u ON u.id=c.user_id
           WHERE m.lawyer_id=$1 AND COALESCE(m.connect_v2,FALSE)=TRUE
           ORDER BY c.created_at DESC""", advocate["id"],
    )
    result = []
    for case in cases:
        update = await fetchrow(
            """SELECT next_step,next_step_date,update_text,original_language
               FROM connect_case_updates WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1""",
            case["id"],
        )
        checklist = await fetch(
            "SELECT id,label,status FROM connect_case_checklist WHERE case_id=$1 ORDER BY id",
            case["id"],
        )
        paths = case.get("document_paths") or []
        if isinstance(paths, str):
            paths = json.loads(paths)
        attached = [
            {"name": path.rsplit("/", 1)[-1], "filename": path.rsplit("/", 1)[-1],
             "url": f"/litigaforge/connect-v2/cases/{case['id']}/files/{quote(path, safe='/')}"}
            for path in paths
        ]
        if case.get("voice_path"):
            attached.append({
                "name": "Voice note", "filename": "Voice note",
                "content_type": mimetypes.guess_type(case["voice_path"])[0] or "audio/webm",
                "url": f"/litigaforge/connect-v2/cases/{case['id']}/files/{quote(case['voice_path'], safe='/')}",
            })
        result.append({
            "id": case["id"], "problem_type": case.get("problem_type") or case["case_type"],
            "description": case["description"], "location": case["location"],
            "language": case.get("original_language") or "en", "status": case["status"],
            "client": {"name": case["client_name"], "phone": case["client_phone"], "email": case["client_email"]},
            "thread_id": case.get("thread_id"),
            "next_step": update["next_step"] if update else "",
            "next_step_date": str(update["next_step_date"]) if update and update["next_step_date"] else None,
            "latest_update": update["update_text"] if update else "",
            "requested_documents": [dict(item) for item in checklist],
            "documents": attached,
            "voice_transcript": case.get("voice_transcript"),
            "voice_language": case.get("voice_language") or case.get("original_language") or "en",
        })
    return {"cases": result}


@router.patch("/connect-v2/cases/{case_id}/update")
async def update_case(case_id: int, body: CaseUpdate, user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    _require_verified_advocate(user)
    advocate = await _advocate_profile(user)
    allowed = await fetchrow(
        """SELECT c.id FROM case_requirements c JOIN matches m ON m.case_requirement_id=c.id
           WHERE c.id=$1 AND m.lawyer_id=$2 AND m.status='accepted' AND m.connect_v2=TRUE""", case_id, advocate["id"],
    )
    if not allowed:
        raise HTTPException(404, "Accepted case not found")
    update_language = detect_language(body.latest_update) if body.language == "auto" else body.language
    if update_language not in LANGUAGES:
        raise HTTPException(422, "Choose a supported language")
    await execute(
        """INSERT INTO connect_case_updates(case_id,author_id,next_step,next_step_date,update_text,original_language)
           VALUES($1,$2,$3,$4,$5,$6)""",
        case_id, user["id"], sanitize_text(body.next_step, 1000, "next_step"),
        body.next_step_date, sanitize_text(body.latest_update, 3000, "latest_update"), update_language,
    )
    return {"saved": True}


@router.post("/connect-v2/cases/{case_id}/checklist")
async def add_checklist_item(case_id: int, body: dict, user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    advocate = await _advocate_profile(user)
    label = sanitize_text(str(body.get("label") or ""), 200, "label")
    if not label:
        raise HTTPException(422, "Document label is required")
    allowed = await fetchrow(
        "SELECT 1 FROM matches WHERE case_requirement_id=$1 AND lawyer_id=$2 AND status='accepted' AND connect_v2=TRUE",
        case_id, advocate["id"],
    )
    if not allowed:
        raise HTTPException(404, "Accepted case not found")
    row = await fetchrow(
        "INSERT INTO connect_case_checklist(case_id,label) VALUES($1,$2) RETURNING id,label,status",
        case_id, label,
    )
    return {"document": dict(row)}


@router.post("/connect-v2/cases/{case_id}/documents")
async def request_document(case_id: int, body: dict, user=Depends(get_current_user)):
    """Add a document request to the case checklist (not an upload)."""
    return await add_checklist_item(case_id, body, user)


@router.patch("/connect-v2/checklist/{item_id}")
async def update_checklist_item(item_id: int, body: dict, user=Depends(get_current_user)):
    require_connect()
    if not user:
        raise HTTPException(401, "Login required")
    status = body.get("status")
    if status not in ("requested", "received"):
        raise HTTPException(422, "Status must be requested or received")
    row = await fetchrow(
        """UPDATE connect_case_checklist d SET status=$1
           FROM matches m, lawyers l
           WHERE d.id=$2 AND m.case_requirement_id=d.case_id AND m.status='accepted' AND m.connect_v2=TRUE
             AND l.id=m.lawyer_id AND (m.client_id=$3 OR l.user_id=$3)
           RETURNING d.id""", status, item_id, user["id"],
    )
    if not row:
        raise HTTPException(404, "Checklist item not found")
    return {"updated": True}


@router.patch("/auth/profile/language")
async def set_preferred_language(body: dict, user=Depends(get_current_user)):
    require_multilang()
    if not user:
        raise HTTPException(401, "Login required")
    code = body.get("preferred_language")
    if code not in LANGUAGES:
        raise HTTPException(422, "Choose an available language")
    await execute("UPDATE users SET preferred_language=$1 WHERE id=$2", code, user["id"])
    return {"preferred_language": code}


_SENSITIVE = re.compile(
    r"\b(?:[A-Z]{2,}[/-]?\d{2,}(?:[/.-]\d{2,})*|[A-Z]{2,4}\d{12,16}|"
    r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:₹|Rs\.?\s?|INR\s?)\d[\d,]*(?:\.\d+)?|"
    r"\d[\d,]*(?:/\d[\d,]*)?\s*(?:sq\.?\s*ft|survey\s*(?:no\.?)?))\b"
)


class TranslateBody(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    source_language: str = "auto"
    target_language: str = "en"
    terms: list[str] = Field(default_factory=list, max_length=100)


@router.post("/connect-v2/translate")
async def translate_text(body: TranslateBody, user=Depends(get_current_user)):
    require_multilang()
    if not user:
        raise HTTPException(401, "Login required")
    source = detect_language(body.text) if body.source_language == "auto" else body.source_language
    target = body.target_language
    if source not in LANGUAGES | {"en"} or target not in LANGUAGES:
        raise HTTPException(422, "Unsupported language")
    if source == target:
        return {"text": body.text, "source_language": source, "target_language": target, "translated": False}
    text_hash = hashlib.sha256(body.text.encode()).hexdigest()
    key = hashlib.sha256(f"{text_hash}:{target}".encode()).hexdigest()
    cached = await fetchrow("SELECT translated_text FROM translation_cache WHERE cache_key=$1", key)
    if cached:
        return {"text": cached["translated_text"], "source_language": source, "target_language": target, "translated": True, "cached": True}
    try:
        from language_terms import legal_glossary
        protected = {}
        def hold(match):
            token = f"[[KEEP_{len(protected)}]]"
            protected[token] = match.group(0)
            return token
        safe_text = _SENSITIVE.sub(hold, body.text)
        prompt = (
            f"Translate from {LANGUAGE_NAMES.get(source, source)} to {LANGUAGE_NAMES.get(target, target)}. "
            "This is a legal communication. Preserve every [[KEEP_n]] token exactly, never translate names, "
            "case numbers, dates, currency, or survey numbers. Use this glossary consistently: "
            f"{json.dumps(legal_glossary(target), ensure_ascii=False)}. If a phrase is ambiguous, write "
            "'unclear — check original'. Return only the translation.\n\n" + safe_text
        )
        from llm import legal_llm
        system = "Translate legal communication faithfully. Do not add legal advice."
        try:
            translated = await legal_llm.acomplete_for_model(
                "anthropic/claude-haiku-5-5", system, prompt, max_tokens=8192,
            )
            if not translated:
                raise RuntimeError("Claude returned an empty translation")
        except Exception:
            import ai_brain
            translated = await ai_brain._call_gemini_async(system, prompt, 0.2, 8192)
            if not translated:
                translated = await ai_brain._call_openai_async(system, prompt, 0.2, 8192)
            if not translated:
                raise RuntimeError("Configured LLM providers unavailable")
        for token, original in protected.items():
            translated = translated.replace(token, original)
        await execute(
            "INSERT INTO translation_cache(cache_key,source_language,target_language,translated_text) VALUES($1,$2,$3,$4) ON CONFLICT(cache_key) DO NOTHING",
            key, source, target, translated,
        )
        return {"text": translated, "source_language": source, "target_language": target, "translated": True, "cached": False}
    except Exception:
        return {"text": body.text, "source_language": source, "target_language": target, "translated": False, "unavailable": True}

