"""Shared, local-first case-law search for public and authenticated surfaces."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

logger = logging.getLogger("litigaforge.case_law_search")
IK_BASE = "https://api.indiankanoon.org"
_KEY_RE = re.compile(r"[^a-z0-9]+")


def _key(value: str) -> str:
    return _KEY_RE.sub("", (value or "").lower())


async def _ik_search(
    conn, query: str, limit: int, *, cache_writes: bool = True
) -> list[dict]:
    """Read-through cache for the documented Indian Kanoon API.

    Public callers can disable cache mutations to preserve a strictly read-only
    request path. Authenticated Workspace searches retain the existing cache.
    """
    token = (os.getenv("INDIANKANOON_API_TOKEN") or "").strip()
    if not token:
        return []
    qhash = hashlib.md5(query.lower().strip().encode()).hexdigest()
    cached = await conn.fetchrow(
        "SELECT results_json, fetched_at FROM ikanoon_search_cache WHERE query_hash=$1", qhash
    )
    if cached and datetime.now(timezone.utc) - cached["fetched_at"] < timedelta(hours=24):
        if cache_writes:
            await conn.execute(
                "UPDATE ikanoon_search_cache SET hit_count=hit_count+1 WHERE query_hash=$1", qhash
            )
        return list(cached["results_json"])[:limit]
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{IK_BASE}/search/", data={"formInput": query, "pagenum": 0},
                headers={"Authorization": f"Token {token}"},
            )
            response.raise_for_status()
            docs = list(response.json().get("docs") or [])[:10]
    except Exception as exc:
        logger.warning("Indian Kanoon search failed for %r: %s", query, exc)
        return []
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
    return docs[:limit]


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
    if len(results) < 3:
        for doc in await _ik_search(
            conn, query, max(10, limit), cache_writes=cache_writes
        ):
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
    return {"query": query, "count": len(results), "source": source, "results": results[:limit]}