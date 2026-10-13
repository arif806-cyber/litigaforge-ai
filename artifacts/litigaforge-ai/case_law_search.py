"""Shared, local-first case-law search for public and authenticated surfaces."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

logger = logging.getLogger("litigaforge.case_law_search")
IK_BASE = "https://api.indiankanoon.org"
_KEY_RE = re.compile(r"[^a-z0-9]+")
_IK_MIN_REQUEST_INTERVAL_SECONDS = 2.5
_IK_ENDPOINT_PRICE_DEFAULTS_INR = {
    "search": Decimal("0.50"),
    "document": Decimal("0.20"),
    "fragment": Decimal("0.05"),
    "metadata": Decimal("0.02"),
    "original": Decimal("0.50"),
}
_IK_ENDPOINT_PRICE_ENV = {
    "search": "IK_PRICE_SEARCH_INR",
    "document": "IK_PRICE_DOCUMENT_INR",
    "fragment": "IK_PRICE_FRAGMENT_INR",
    "metadata": "IK_PRICE_METADATA_INR",
    "original": "IK_PRICE_ORIGINAL_INR",
}


def _ik_endpoint_kind(endpoint: str) -> str:
    path = endpoint.split("?", 1)[0].rstrip("/")
    if path == "/search" or path.startswith("/search/"):
        return "search"
    if path.startswith("/docfragment/"):
        return "fragment"
    if path.startswith("/docmeta/"):
        return "metadata"
    if path.startswith("/origdoc/"):
        return "original"
    if path.startswith("/doc/"):
        return "document"
    raise ValueError(f"Unpriced Indian Kanoon endpoint: {path}")


def ik_endpoint_price_inr(endpoint: str) -> Decimal:
    kind = _ik_endpoint_kind(endpoint)
    raw = os.getenv(_IK_ENDPOINT_PRICE_ENV[kind], str(_IK_ENDPOINT_PRICE_DEFAULTS_INR[kind]))
    try:
        price = Decimal(raw)
    except (InvalidOperation, TypeError):
        raise ValueError(f"{_IK_ENDPOINT_PRICE_ENV[kind]} must be a decimal rupee amount")
    if not price.is_finite() or price < 0:
        raise ValueError(f"{_IK_ENDPOINT_PRICE_ENV[kind]} must be a non-negative rupee amount")
    return price


def ik_daily_cap_inr() -> Decimal:
    try:
        cap = Decimal(os.getenv("IK_DAILY_COST_CAP_INR", "300"))
    except InvalidOperation:
        raise ValueError("IK_DAILY_COST_CAP_INR must be a decimal rupee amount")
    if not cap.is_finite() or cap < 0:
        raise ValueError("IK_DAILY_COST_CAP_INR must be a non-negative rupee amount")
    return cap


def _ik_enabled() -> bool:
    return os.getenv("IK_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def _ik_token() -> str:
    # Keep the legacy spelling as a migration fallback; never expose either value.
    return (os.getenv("INDIAN_KANOON_API_TOKEN") or os.getenv("INDIANKANOON_API_TOKEN") or "").strip()


async def _ik_spend_today(conn) -> Decimal:
    row = await conn.fetchrow(
        """SELECT COALESCE(SUM(cost_inr),0) AS total FROM indian_kanoon_api_metrics
           WHERE created_at >= CURRENT_DATE"""
    )
    return Decimal(str(row["total"] or 0)) if row else Decimal("0")


class IKDailyCostCapExceeded(RuntimeError):
    pass


async def reserve_ik_budget(conn, endpoint: str) -> None:
    """Atomically reserve the configured official per-endpoint rupee price."""
    async with conn.transaction():
        await conn.execute("SELECT pg_advisory_xact_lock(734239111)")
        last = await conn.fetchval(
            "SELECT MAX(created_at) FROM indian_kanoon_api_metrics"
        )
        if last:
            wait = _IK_MIN_REQUEST_INTERVAL_SECONDS - (datetime.now(timezone.utc) - last).total_seconds()
            if wait > 0:
                await conn.execute("SELECT pg_sleep($1)", wait)
        price = ik_endpoint_price_inr(endpoint)
        spent = await _ik_spend_today(conn)
        if spent + price > ik_daily_cap_inr():
            raise IKDailyCostCapExceeded("Indian Kanoon daily cost cap reached")
        await conn.execute(
            """INSERT INTO indian_kanoon_api_metrics(endpoint,cost_inr)
               VALUES($1,$2)""",
            endpoint.split("?")[0],
            price,
        )


async def _ik_call(conn, path: str, data: dict | None = None) -> dict:
    """Official API only; estimated call spend is tracked in ForgeOS metrics."""
    if not _ik_enabled():
        raise RuntimeError("Indian Kanoon integration is disabled")
    token = _ik_token()
    if not token:
        raise RuntimeError("Indian Kanoon server secret is not configured")
    await reserve_ik_budget(conn, path)
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{IK_BASE}{path}", data=data or {},
            headers={"Authorization": f"Token {token}", "Accept": "application/json"},
        )
    response.raise_for_status()
    result = response.json()
    return result if isinstance(result, dict) else {}


def _key(value: str) -> str:
    return _KEY_RE.sub("", (value or "").lower())


async def _ik_search(
    conn, query: str, limit: int, *, cache_writes: bool = True
) -> tuple[list[dict], bool]:
    """Read-through cache for the documented Indian Kanoon API.

    Public callers can disable cache mutations to preserve a strictly read-only
    request path. Authenticated Workspace searches retain the existing cache.
    """
    if not _ik_enabled() or not _ik_token():
        return [], False
    qhash = hashlib.md5(query.lower().strip().encode()).hexdigest()
    cached = await conn.fetchrow(
        "SELECT results_json, fetched_at FROM ikanoon_search_cache WHERE query_hash=$1", qhash
    )
    cache_fresh = bool(cached and datetime.now(timezone.utc) - cached["fetched_at"] < timedelta(hours=24))
    if cache_fresh:
        if cache_writes:
            await conn.execute(
                "UPDATE ikanoon_search_cache SET hit_count=hit_count+1 WHERE query_hash=$1", qhash
            )
        return list(cached["results_json"])[:limit], False
    try:
        data = await _ik_call(conn, "/search/", {"formInput": query, "pagenum": "0"})
        docs = list(data.get("docs") or [])[:10]
    except Exception as exc:
        if isinstance(exc, IKDailyCostCapExceeded):
            return list(cached["results_json"])[:limit], True
        logger.warning("Indian Kanoon search failed (%s)", type(exc).__name__)
        return (list(cached["results_json"])[:limit], False) if cached else ([], False)
    if cache_writes:
        try:
            await conn.execute(
                """INSERT INTO ikanoon_search_cache (query_hash, query_text, results_json)
                   VALUES ($1,$2,$3::jsonb)
                   ON CONFLICT (query_hash) DO UPDATE SET results_json=EXCLUDED.results_json,
                   fetched_at=NOW(), hit_count=0""",
                qhash, query, json.dumps(docs),
            )
        except Exception as exc:
            logger.warning("Indian Kanoon cache write failed: %s", exc)
    return docs[:limit], False


async def search_case_law(
    conn,
    query: str,
    *,
    limit: int = 10,
    court: str = "",
    cache_writes: bool = True,
) -> dict[str, Any]:
    """Search local published text first, then supplement sparse results with IK.

    The response labels each item and aggregate source honestly.  It intentionally
    uses only reads apart from the existing IK response cache.
    """
    query = query.strip()[:300]
    if len(query) < 2:
        raise ValueError("query must contain at least 2 characters")
    limit = max(1, min(int(limit), 10))
    court = court.strip()[:160]
    pattern = f"%{query}%"
    rows = await conn.fetch(
        """SELECT id, case_name, court, court_slug, judgment_date, year, slug,
                  summary_en, summary_hi, full_text, text_complete, acts_cited,
                  outcome, citation, source_name, source_url,
                  CASE WHEN case_name ILIKE $2 THEN 100 ELSE 0 END +
                  CASE WHEN array_to_string(acts_cited, ' ') ILIKE $2 THEN 70 ELSE 0 END +
                  CASE WHEN COALESCE(summary_en, '') ILIKE $2 OR COALESCE(summary_hi, '') ILIKE $2 THEN 45 ELSE 0 END +
                  CASE WHEN COALESCE(full_text, '') ILIKE $2 THEN 20 ELSE 0 END +
                  ts_rank(
                    setweight(to_tsvector('simple', COALESCE(case_name, '')), 'A') ||
                    setweight(to_tsvector('simple', COALESCE(array_to_string(acts_cited, ' '), '')), 'B') ||
                    setweight(to_tsvector('simple', COALESCE(summary_en, '') || ' ' || COALESCE(summary_hi, '')), 'C') ||
                    setweight(to_tsvector('simple', COALESCE(outcome, '') || ' ' || COALESCE(full_text, '') ||
                      ' ' || COALESCE(court, '') || ' ' || COALESCE(slug, '')), 'D'),
                    websearch_to_tsquery('simple', $1)
                  ) * 10
                  AS rank_score
           FROM judgments
           WHERE status='published' AND
             (
               case_name ILIKE $2 OR citation ILIKE $2 OR summary_en ILIKE $2 OR summary_hi ILIKE $2
               OR full_text ILIKE $2 OR outcome ILIKE $2 OR slug ILIKE $2
               OR array_to_string(acts_cited, ' ') ILIKE $2
               OR (
                 setweight(to_tsvector('simple', COALESCE(case_name, '')), 'A') ||
                 setweight(to_tsvector('simple', COALESCE(array_to_string(acts_cited, ' '), '')), 'B') ||
                 setweight(to_tsvector('simple', COALESCE(summary_en, '') || ' ' || COALESCE(summary_hi, '')), 'C') ||
                 setweight(to_tsvector('simple', COALESCE(outcome, '') || ' ' || COALESCE(full_text, '') ||
                   ' ' || COALESCE(court, '') || ' ' || COALESCE(slug, '')), 'D')
               ) @@ websearch_to_tsquery('simple', $1)
             )
             AND ($3='' OR court ILIKE '%' || $3 || '%' OR court_slug ILIKE '%' || $3 || '%')
           ORDER BY rank_score DESC, judgment_date DESC NULLS LAST, id DESC LIMIT $4""",
        query, pattern, court, limit,
    )
    results = []
    seen = set()
    for row in rows:
        item = dict(row)
        item["source"] = "local_db"
        item["url"] = f"/judgments/{item['court_slug']}/{item['year']}/{item['slug']}"
        seen.add(_key(item.get("source_url") or item["case_name"]))
        results.append(item)

    used_ik = False
    cached_due_to_cap = False
    if len(results) < 3:
        ik_docs, cached_due_to_cap = await _ik_search(
            conn, query, max(10, limit), cache_writes=cache_writes
        )
        for doc in ik_docs:
            tid = str(doc.get("tid") or doc.get("docid") or "")
            title = str(doc.get("title") or "")
            key = _key(tid or title)
            if not key or key in seen:
                continue
            seen.add(key)
            used_ik = True
            results.append({
                "id": f"ik-{tid}", "case_name": title or "Untitled judgment",
                "court": doc.get("docsource") or "Court", "court_slug": None,
                "judgment_date": doc.get("publishdate") or doc.get("date"), "year": str(doc.get("publishdate") or "")[:4] or None,
                "slug": None, "summary_en": re.sub(r"<[^>]+>", "", doc.get("headline") or "")[:1000],
                "summary_hi": None, "full_text": None, "text_complete": False,
                "acts_cited": [], "outcome": "", "citation": doc.get("citation") or "",
                "source_name": "IndianKanoon", "source_url": f"https://indiankanoon.org/doc/{tid}/" if tid else None,
                "source": "indian_kanoon", "url": f"https://indiankanoon.org/doc/{tid}/" if tid else None,
                "rank_score": 0, "ik_tid": tid, "num_citing": int(doc.get("numciting") or 0),
            })
            if len(results) >= limit:
                break
    source = "merged" if used_ik and rows else ("indian_kanoon" if used_ik else "local_db")
    return {
        "query": query, "count": len(results), "source": source,
        "results": results[:limit], "cached_due_to_cap": cached_due_to_cap,
        "status_message": "live search paused for today" if cached_due_to_cap else None,
    }