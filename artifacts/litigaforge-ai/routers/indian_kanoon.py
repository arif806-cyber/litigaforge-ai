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
    IKDailyCostCapExceeded, _ik_call, _ik_enabled, _ik_token, get_ik_document as fetch_ik_document,
    ik_cached_request,
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
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            before = await conn.fetchval("SELECT 1 FROM ik_document_cache WHERE doc_id=$1", tid)
            document = await fetch_ik_document(conn, tid, feature="document")
            metadata = {"paragraphs": document.get("_paragraphs", []),
                        "citeList": document.get("citeList", []),
                        "citedbyList": document.get("citedbyList", [])}
    except IKDailyCostCapExceeded:
        raise HTTPException(429, "Indian Kanoon daily cost cap reached")
    except httpx.HTTPError:
        raise HTTPException(502, "Indian Kanoon document request failed")
    return {"document": document, "metadata": metadata, "cached": bool(before),
            "attribution": "Indian Kanoon"}


@router.get("/ik/admin/costs")
async def ik_costs_by_feature(user=Depends(get_current_user)):
    if not user or user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    from database import fetch
    rows = await fetch(
        """SELECT feature,endpoint,COUNT(*) AS calls,COALESCE(SUM(cost_inr),0) AS cost_inr
           FROM indian_kanoon_api_metrics WHERE created_at >= CURRENT_DATE
           GROUP BY feature,endpoint ORDER BY feature,endpoint"""
    )
    return {"date": "today", "costs": [dict(row) for row in rows], "currency": "INR"}


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
            result = await ik_cached_request(
                conn, f"/docfragment/{quote(tid[:40], safe='')}/",
                {"formInput": query}, feature="fragment",
            )
    except IKDailyCostCapExceeded:
        raise HTTPException(429, "Indian Kanoon daily cost cap reached")
    except httpx.HTTPError:
        raise HTTPException(502, "Indian Kanoon fragment request failed")
    return {"fragments": result, "attribution": "Indian Kanoon"}


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
            await reserve_ik_budget(conn, "/origdoc/", feature="original_copy")
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
