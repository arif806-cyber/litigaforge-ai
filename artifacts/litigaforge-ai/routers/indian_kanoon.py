"""Flagged, server-side access to the official Indian Kanoon API."""
from __future__ import annotations

import asyncio
import json
import mimetypes
import os
import uuid
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auth import get_current_user
from case_law_search import (
    IKDailyCostCapExceeded, _ik_call, _ik_enabled, _ik_token,
    reserve_ik_budget, IK_BASE,
)
from database import fetchrow, get_pool
from storage import get_object_storage
from rate_limit import limiter

router = APIRouter(tags=["indian-kanoon"])


def _require_ik():
    if not _ik_enabled():
        raise HTTPException(404, "Indian Kanoon integration is disabled")
    if not _ik_token():
        raise HTTPException(503, "Indian Kanoon server secret is not configured")


@router.get("/ik/documents/{tid}")
@limiter.limit("20/minute")
async def get_ik_document(request: Request, tid: str, user=Depends(get_current_user)):
    _require_ik()
    if not user:
        raise HTTPException(401, "Login required")
    tid = tid[:40]
    row = await fetchrow(
        "SELECT document_json, metadata_json FROM ik_document_cache WHERE doc_id=$1", tid,
    )
    if row and row.get("document_json"):
        return {"document": row["document_json"], "metadata": row.get("metadata_json"), "cached": True}
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            document = await _ik_call(conn, f"/doc/{quote(tid, safe='')}/")
            metadata = await _ik_call(conn, f"/docmeta/{quote(tid, safe='')}/")
            await conn.execute(
                """INSERT INTO ik_document_cache(doc_id,document_json,metadata_json)
                   VALUES($1,$2::jsonb,$3::jsonb)
                   ON CONFLICT(doc_id) DO UPDATE SET document_json=EXCLUDED.document_json,
                     metadata_json=EXCLUDED.metadata_json,fetched_at=NOW()""",
                tid, json.dumps(document), json.dumps(metadata),
            )
    except IKDailyCostCapExceeded:
        raise HTTPException(429, "Indian Kanoon daily cost cap reached")
    except httpx.HTTPError:
        raise HTTPException(502, "Indian Kanoon document request failed")
    return {"document": document, "metadata": metadata, "cached": False}


@router.get("/ik/documents/{tid}/fragments")
@limiter.limit("20/minute")
async def get_ik_fragments(
    request: Request, tid: str, query: str = Query(min_length=2, max_length=300), user=Depends(get_current_user),
):
    _require_ik()
    if not user:
        raise HTTPException(401, "Login required")
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            result = await _ik_call(conn, f"/docfragment/{quote(tid[:40], safe='')}/", {"formInput": query})
    except IKDailyCostCapExceeded:
        raise HTTPException(429, "Indian Kanoon daily cost cap reached")
    except httpx.HTTPError:
        raise HTTPException(502, "Indian Kanoon fragment request failed")
    return {"fragments": result}


@router.post("/ik/documents/{tid}/attach/{case_id}")
@limiter.limit("5/minute")
async def attach_ik_original_copy(request: Request, tid: str, case_id: int, user=Depends(get_current_user)):
    _require_ik()
    if not user:
        raise HTTPException(401, "Login required")
    case = await fetchrow(
        "SELECT id,client_id,title FROM lawyer_cases WHERE id=$1 AND lawyer_id=$2",
        case_id, user["id"],
    )
    if not case:
        raise HTTPException(404, "Case not found")
    pool = await get_pool()
    async with pool.acquire() as conn:
        try:
            await reserve_ik_budget(conn, "/origdoc/")
        except IKDailyCostCapExceeded:
            raise HTTPException(429, "Indian Kanoon daily cost cap reached")
    token = _ik_token()
    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            f"{IK_BASE}/origdoc/{quote(tid[:40], safe='')}/",
            headers={"Authorization": f"Token {token}", "Accept": "*/*"},
        )
    if response.status_code in (401, 403):
        raise HTTPException(502, "Indian Kanoon authorization failed")
    response.raise_for_status()
    content = response.content
    if not content or len(content) > 30 * 1024 * 1024:
        raise HTTPException(502, "Original court copy was empty or too large")
    content_type = response.headers.get("content-type", "application/pdf").split(";")[0]
    if "pdf" not in content_type.lower() and not content.startswith(b"%PDF-"):
        raise HTTPException(502, "Indian Kanoon returned a non-PDF original copy")
    storage = get_object_storage()
    if not storage:
        raise HTTPException(503, "Private document storage is unavailable")
    suffix = mimetypes.guess_extension(content_type) or ".pdf"
    object_path = f"ik-originals/{user['id']}/{case_id}/{uuid.uuid4().hex}{suffix}"
    await asyncio.to_thread(storage.upload_from_bytes, object_path, content)
    filename = f"Indian-Kanoon-original-{tid}{suffix}"
    source_url = f"https://indiankanoon.org/doc/{quote(tid[:40], safe='')}/"
    row = await fetchrow(
        """INSERT INTO client_documents
             (case_id,client_id,filename,file_type,file_size,file_path,file_url,case_requirement_id,
              source_provider,source_url)
           VALUES($1,$2,$3,$4,$5,$6,$7,NULL,'IndianKanoon',$8)
           RETURNING id,filename,file_type,file_size""",
        case_id, case["client_id"], filename, suffix.lstrip("."), len(content),
        object_path, f"/secure-files/{object_path}", source_url,
    )
    return {"document": dict(row), "source": "Indian Kanoon"}
