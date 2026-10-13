"""User-owned authority library, saved case-law searches, and citation watches."""
import hashlib
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_user
from database import get_pool
from case_law_search import search_case_law

router = APIRouter(tags=["authorities"])


class SavedSearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=280)


class CitationWatchRequest(BaseModel):
    citation: str = Field(min_length=3, max_length=240)


def _safe_source_url(value) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = urlparse(value)
        if parsed.scheme in {"http", "https"} and parsed.hostname:
            return value[:1000]
    except ValueError:
        pass
    return None


async def _check_monitor(conn, user_id: int, kind: str, monitor_id: int, query: str) -> dict:
    found = await search_case_law(conn, query[:280], limit=10, feature="authorities")
    new_alerts = []
    for item in found.get("results", []):
        case_name = str(item.get("case_name") or item.get("title") or "").strip()[:500]
        source_url = _safe_source_url(item.get("source_url") or item.get("url"))
        if not case_name or not source_url:
            continue
        citation = str(item.get("citation") or "")[:240]
        source_name = str(item.get("source_name") or "")[:80]
        dedupe_key = hashlib.sha256(
            f"{user_id}|{kind}|{monitor_id}|{source_url}".encode()
        ).hexdigest()
        row = await conn.fetchrow(
            """INSERT INTO authority_alerts
                 (user_id, monitor_kind, monitor_id, case_name, citation,
                  source_url, source_name, dedupe_key)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT (dedupe_key) DO NOTHING
               RETURNING id, case_name, citation, source_url, source_name, created_at""",
            user_id, kind, monitor_id, case_name, citation, source_url, source_name, dedupe_key,
        )
        if row:
            new_alerts.append(dict(row))
    table = "saved_authority_searches" if kind == "saved_search" else "citation_watches"
    await conn.execute(
        f"UPDATE {table} SET last_checked_at=NOW() WHERE id=$1 AND user_id=$2",
        monitor_id, user_id,
    )
    return {"new_count": len(new_alerts), "new_alerts": new_alerts}


async def _check_citation_watch(conn, user_id: int, monitor_id: int, citation: str) -> dict:
    """Resolve against the local citation index, then inspect one cached doc call."""
    import re
    from case_law_search import get_ik_document, _ik_enabled, _ik_token
    if not _ik_enabled():
        raise HTTPException(404, "Indian Kanoon integration is disabled")
    if not _ik_token():
        raise HTTPException(503, "Indian Kanoon server secret is not configured")

    row = await conn.fetchrow(
        """SELECT citation,case_name,source_url FROM judgments
           WHERE status='published' AND citation ILIKE '%' || $1 || '%'
           ORDER BY judgment_date DESC NULLS LAST LIMIT 1""",
        citation[:240],
    )
    tid_match = re.search(r"/doc/(\d+)", str(row.get("source_url") or "")) if row else None
    if not tid_match:
        await conn.execute(
            "UPDATE citation_watches SET last_checked_at=NOW() WHERE id=$1 AND user_id=$2",
            monitor_id, user_id,
        )
        return {"new_count": 0, "new_alerts": [], "status": "not_in_local_index"}
    document = await get_ik_document(conn, tid_match.group(1), feature="citation_watch")
    citing = document.get("citedbyList") or document.get("citedby") or []
    new_alerts = []
    for later in citing[:50] if isinstance(citing, list) else []:
        treatment = str(later.get("treatment") or later.get("treatments") or "").casefold()
        if not any(term in treatment for term in (
            "negative", "overruled", "overturned", "disapproved", "distinguished", "not followed",
        )):
            continue
        tid = str(later.get("tid") or later.get("docid") or "")
        title = str(later.get("title") or later.get("case_name") or "").strip()[:500]
        if not title or not tid.isdigit():
            continue
        court = str(later.get("docsource") or later.get("court") or "Court").strip()[:160]
        date = str(later.get("publishdate") or later.get("date") or "").strip()[:40]
        url = f"https://indiankanoon.org/doc/{tid}/"
        label = f"Negative treatment — {court}" + (f", {date}" if date else "")
        key = hashlib.sha256(f"{user_id}|citation_watch|{monitor_id}|{url}".encode()).hexdigest()
        inserted = await conn.fetchrow(
            """INSERT INTO authority_alerts
                 (user_id,monitor_kind,monitor_id,case_name,citation,source_url,source_name,dedupe_key)
               VALUES($1,'citation_watch',$2,$3,$4,$5,'Indian Kanoon',$6)
               ON CONFLICT(dedupe_key) DO NOTHING
               RETURNING id,case_name,citation,source_url,source_name,created_at""",
            user_id, monitor_id, title, label, url, key,
        )
        if inserted:
            new_alerts.append(dict(inserted))
    await conn.execute(
        "UPDATE citation_watches SET last_checked_at=NOW() WHERE id=$1 AND user_id=$2",
        monitor_id, user_id,
    )
    return {"new_count": len(new_alerts), "new_alerts": new_alerts, "source": "Indian Kanoon"}


@router.get("/authorities")
async def list_authorities(user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, category, jurisdiction, effective_from, verified_on,
                      status, source_urls, data
               FROM legal_reference_tables ORDER BY jurisdiction, category, id"""
        )
    return {"authorities": [dict(row) for row in rows]}


@router.get("/authorities/saved-searches")
async def list_saved_searches(user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, query, created_at, last_checked_at
               FROM saved_authority_searches WHERE user_id=$1 ORDER BY created_at DESC""",
            user["id"],
        )
    return {"searches": [dict(row) for row in rows]}


@router.post("/authorities/saved-searches", status_code=201)
async def create_saved_search(body: SavedSearchRequest, user=Depends(require_user)):
    query = " ".join(body.query.split())
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO saved_authority_searches(user_id,query)
               VALUES($1,$2) ON CONFLICT(user_id,query) DO UPDATE SET query=EXCLUDED.query
               RETURNING id,query,created_at,last_checked_at""",
            user["id"], query,
        )
    return dict(row)


@router.post("/authorities/saved-searches/{search_id}/check")
async def check_saved_search(search_id: int, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT query FROM saved_authority_searches WHERE id=$1 AND user_id=$2",
            search_id, user["id"],
        )
        if not row:
            raise HTTPException(404, "Saved search not found")
        result = await _check_monitor(conn, user["id"], "saved_search", search_id, row["query"])
    return result


@router.delete("/authorities/saved-searches/{search_id}", status_code=204)
async def delete_saved_search(search_id: int, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM authority_alerts WHERE user_id=$1 AND monitor_kind='saved_search' AND monitor_id=$2",
            user["id"], search_id,
        )
        result = await conn.execute(
            "DELETE FROM saved_authority_searches WHERE id=$1 AND user_id=$2",
            search_id, user["id"],
        )
    if result == "DELETE 0":
        raise HTTPException(404, "Saved search not found")


@router.get("/authorities/citation-watches")
async def list_citation_watches(user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, citation, created_at, last_checked_at
               FROM citation_watches WHERE user_id=$1 ORDER BY created_at DESC""",
            user["id"],
        )
    return {"watches": [dict(row) for row in rows]}


@router.post("/authorities/citation-watches", status_code=201)
async def create_citation_watch(body: CitationWatchRequest, user=Depends(require_user)):
    citation = " ".join(body.citation.split())
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO citation_watches(user_id,citation)
               VALUES($1,$2) ON CONFLICT(user_id,citation) DO UPDATE SET citation=EXCLUDED.citation
               RETURNING id,citation,created_at,last_checked_at""",
            user["id"], citation,
        )
    return dict(row)


@router.post("/authorities/citation-watches/{watch_id}/check")
async def check_citation_watch(watch_id: int, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT citation FROM citation_watches WHERE id=$1 AND user_id=$2",
            watch_id, user["id"],
        )
        if not row:
            raise HTTPException(404, "Citation watch not found")
        result = await _check_citation_watch(conn, user["id"], watch_id, row["citation"])
    return result


@router.delete("/authorities/citation-watches/{watch_id}", status_code=204)
async def delete_citation_watch(watch_id: int, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM authority_alerts WHERE user_id=$1 AND monitor_kind='citation_watch' AND monitor_id=$2",
            user["id"], watch_id,
        )
        result = await conn.execute(
            "DELETE FROM citation_watches WHERE id=$1 AND user_id=$2",
            watch_id, user["id"],
        )
    if result == "DELETE 0":
        raise HTTPException(404, "Citation watch not found")


@router.get("/authorities/alerts")
async def list_authority_alerts(user=Depends(require_user), unread_only: bool = True):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, monitor_kind, monitor_id, case_name, citation, source_url,
                      source_name, created_at, read_at
               FROM authority_alerts
               WHERE user_id=$1 AND ($2=FALSE OR read_at IS NULL)
               ORDER BY created_at DESC LIMIT 100""",
            user["id"], unread_only,
        )
    return {"alerts": [dict(row) for row in rows]}


@router.patch("/authorities/alerts/{alert_id}/read")
async def mark_authority_alert_read(alert_id: int, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE authority_alerts SET read_at=COALESCE(read_at,NOW())
               WHERE id=$1 AND user_id=$2
               RETURNING id,read_at""",
            alert_id, user["id"],
        )
    if not row:
        raise HTTPException(404, "Authority alert not found")
    return dict(row)
