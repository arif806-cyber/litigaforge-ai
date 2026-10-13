"""Authenticated, read-only MCP v2 policy, API-key lifecycle, and audit ledger."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from auth import get_superuser, require_user
from database import execute, fetch, fetchrow, get_pool

router = APIRouter(tags=["mcp-v2"])
_PREFIX = "lfm_"
_DISCLAIMER = "Lead for advocate verification, not legal advice."


def enabled() -> bool:
    return os.getenv("MCP_V2_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def ensure_schema() -> None:
    if not enabled():
        return
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS mcp_api_keys (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                key_hash TEXT NOT NULL UNIQUE,
                key_prefix TEXT NOT NULL,
                label TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'read',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_used_at TIMESTAMPTZ,
                revoked_at TIMESTAMPTZ
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS mcp_call_audit (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                api_key_id BIGINT REFERENCES mcp_api_keys(id) ON DELETE SET NULL,
                tool_name TEXT NOT NULL,
                args_sha256 TEXT NOT NULL,
                cost_inr NUMERIC(12,2) NOT NULL DEFAULT 0,
                outcome TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS mcp_call_audit_user_day_idx
            ON mcp_call_audit(user_id, created_at)
        """)


async def _paid_advocate(user: dict) -> bool:
    if user.get("role") not in {"advocate", "lawyer"}:
        return False
    if user.get("subscription_tier") not in {"professional", "advocate_pro"}:
        return False
    row = await fetchrow("""
        SELECT 1 FROM subscriptions
        WHERE user_id = $1 AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
    """, int(user["id"]))
    return bool(row)


async def create_api_key(user: dict, label: str) -> dict:
    if not enabled():
        raise HTTPException(404, "MCP v2 is disabled")
    if user.get("role") not in {"advocate", "lawyer"}:
        raise HTTPException(403, "MCP access is limited to advocate accounts")
    cleaned = " ".join(label.split())[:64]
    if not cleaned:
        raise HTTPException(422, "Key label is required")
    raw = _PREFIX + secrets.token_urlsafe(32)
    row = await fetchrow("""
        INSERT INTO mcp_api_keys (user_id, key_hash, key_prefix, label, scope)
        VALUES ($1, $2, $3, $4, 'read')
        RETURNING id, key_prefix, label, scope, created_at
    """, int(user["id"]), _hash(raw), raw[:12], cleaned)
    return {**dict(row), "key": raw}


async def verify_bearer(request: Request) -> tuple[dict, int, int]:
    if not enabled():
        raise HTTPException(404, "MCP v2 is disabled")
    authz = request.headers.get("authorization", "")
    scheme, _, raw = authz.partition(" ")
    if scheme.lower() != "bearer" or not raw.startswith(_PREFIX):
        raise HTTPException(401, "A LitigaForge MCP API key is required",
                            headers={"WWW-Authenticate": 'Bearer realm="LitigaForge MCP"'})
    row = await fetchrow("""
        SELECT k.id AS api_key_id, k.user_id, k.key_hash, k.scope,
               u.email, u.name, u.role, u.subscription_tier
        FROM mcp_api_keys k JOIN users u ON u.id = k.user_id
        WHERE k.key_prefix = $1 AND k.revoked_at IS NULL
        ORDER BY k.id DESC LIMIT 1
    """, raw[:12])
    if not row or not hmac.compare_digest(str(row["key_hash"]), _hash(raw)):
        raise HTTPException(401, "Invalid or revoked MCP API key",
                            headers={"WWW-Authenticate": 'Bearer realm="LitigaForge MCP"'})
    if row["scope"] != "read":
        raise HTTPException(403, "This key has no read-only scope")
    user = dict(row)
    user["id"] = int(row["user_id"])
    if user.get("role") not in {"advocate", "lawyer"}:
        raise HTTPException(403, "MCP access is limited to advocate accounts")
    paid = await _paid_advocate(user)
    key_id = int(row["api_key_id"])
    user_id = int(row["user_id"])
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SELECT pg_advisory_xact_lock($1)", user_id)
            recent = await conn.fetchval("""
                SELECT COUNT(*) FROM mcp_call_audit
                WHERE api_key_id = $1 AND created_at > NOW() - INTERVAL '1 minute'
            """, key_id)
            daily = await conn.fetchval("""
                SELECT COUNT(*) FROM mcp_call_audit
                WHERE user_id = $1 AND created_at >= CURRENT_DATE
            """, user_id)
            max_daily = 500 if paid else 5
            if int(recent or 0) >= 30:
                raise HTTPException(429, "MCP API key rate limit reached")
            if int(daily or 0) >= max_daily:
                raise HTTPException(429, "Daily MCP quota reached")
            await conn.execute("UPDATE mcp_api_keys SET last_used_at=NOW() WHERE id=$1", key_id)
            audit_id = await conn.fetchval("""
                INSERT INTO mcp_call_audit(user_id,api_key_id,tool_name,args_sha256,outcome)
                VALUES($1,$2,'_reserved','', 'reserved') RETURNING id
            """, user_id, key_id)
    user["mcp_paid"] = paid
    return user, key_id, int(audit_id)


async def audit_call(user: dict, key_id: int, audit_id: int, tool: str, args: dict,
                     *, cost_inr: float = 0, outcome: str = "ok") -> None:
    canonical = json.dumps(args, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    await execute("""
        UPDATE mcp_call_audit
        SET tool_name=$1,args_sha256=$2,cost_inr=$3,outcome=$4
        WHERE id=$5 AND user_id=$6 AND api_key_id=$7 AND outcome='reserved'
    """, tool, hashlib.sha256(canonical.encode()).hexdigest(),
         max(0, float(cost_inr)), outcome[:32], audit_id, int(user["id"]), key_id)


async def ik_spend_today() -> float:
    row = await fetchrow("""
        SELECT COALESCE(SUM(cost_inr),0) AS total
        FROM indian_kanoon_api_metrics WHERE created_at >= CURRENT_DATE
    """)
    return float(row["total"] or 0) if row else 0.0


async def list_api_keys(user: dict) -> list[dict]:
    rows = await fetch("""
        SELECT id, key_prefix, label, scope, created_at, last_used_at
        FROM mcp_api_keys WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC
    """, int(user["id"]))
    return [dict(row) for row in rows]


async def revoke_api_key(user: dict, key_id: int) -> None:
    result = await execute("""
        UPDATE mcp_api_keys SET revoked_at=NOW()
        WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL
    """, key_id, int(user["id"]))
    if result.endswith(" 0"):
        raise HTTPException(404, "Active MCP key not found")


@router.get("/admin/mcp-audit")
async def get_audit_log(limit: int = 100, user: dict = Depends(get_superuser)):
    if not enabled():
        raise HTTPException(404, "MCP v2 is disabled")
    rows = await fetch("""
        SELECT id, user_id, api_key_id, tool_name, args_sha256, cost_inr, outcome, created_at
        FROM mcp_call_audit ORDER BY created_at DESC LIMIT $1
    """, max(1, min(limit, 500)))
    return {"calls": [dict(row) for row in rows]}


@router.get("/mcp/keys")
async def get_keys(user: dict = Depends(require_user)):
    if not enabled():
        raise HTTPException(404, "MCP v2 is disabled")
    return {"keys": await list_api_keys(user), "scope": "read"}


@router.post("/mcp/keys")
async def post_key(request: Request, user: dict = Depends(require_user)):
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc
    if not isinstance(body, dict):
        raise HTTPException(400, "Expected a JSON object")
    label = body.get("label")
    if label is not None and not isinstance(label, str):
        raise HTTPException(422, "label must be a string")
    return await create_api_key(user, label or "Claude")


@router.delete("/mcp/keys/{key_id}")
async def delete_key(key_id: int, user: dict = Depends(require_user)):
    if not enabled():
        raise HTTPException(404, "MCP v2 is disabled")
    await revoke_api_key(user, key_id)
    return {"revoked": True}


def public_result(data: Any, *, source: str, source_url: str | None,
                  identifier: str, untrusted_text: bool = False) -> dict:
    def fence(value: Any) -> Any:
        if isinstance(value, dict):
            return {key: fence(item) for key, item in value.items()}
        if isinstance(value, list):
            return [fence(item) for item in value]
        if isinstance(value, str):
            escaped = value.replace("</UNTRUSTED SOURCE TEXT>", "&lt;/UNTRUSTED SOURCE TEXT&gt;")
            return f"<UNTRUSTED SOURCE TEXT>\n{escaped}\n</UNTRUSTED SOURCE TEXT>"
        return value

    return {
        "data": fence(data) if untrusted_text else data,
        "source": source,
        "source_url": source_url,
        "retrieved_at": datetime.utcnow().isoformat() + "Z",
        "citation_id": identifier,
        "untrusted_source_text": untrusted_text,
        "notice": _DISCLAIMER,
    }


TOOL_DEFS = [
    ("ecourts_case_status", ["cnr"], {"cnr": {"type": "string", "maxLength": 20}}),
    ("ecourts_cause_list", ["date"], {"court": {"type": "string"}, "advocate": {"type": "string"}, "date": {"type": "string", "format": "date"}}),
    ("ecourts_order", ["cnr", "order_date"], {"cnr": {"type": "string"}, "order_date": {"type": "string", "format": "date"}}),
    ("judgment_search", ["query"], {"query": {"type": "string", "minLength": 3, "maxLength": 200}, "court": {"type": "string"}, "year_from": {"type": "integer"}, "year_to": {"type": "integer"}}),
    ("judgment_passages", ["doc_id", "query"], {"doc_id": {"type": "string"}, "query": {"type": "string"}}),
    ("citing_judgments", ["doc_id"], {"doc_id": {"type": "string"}}),
    ("bare_act_section", ["act", "section"], {"act": {"type": "string"}, "section": {"type": "string"}}),
    ("old_to_new_section", ["code", "section"], {"code": {"type": "string"}, "section": {"type": "string"}}),
    ("limitation_lookup", [], {"article": {"type": "string"}, "description": {"type": "string"}}),
    ("my_cases", [], {}),
    ("my_case", ["cnr"], {"cnr": {"type": "string"}}),
]
TOOLS = [name for name, _, _ in TOOL_DEFS]
TOOL_LIST = [
    {"name": name, "title": name.replace("_", " ").title(),
     "description": "Read-only Indian legal research. Results are leads for advocate verification.",
     "inputSchema": {"type": "object", "required": required, "properties": properties,
                     "additionalProperties": False}}
    for name, required, properties in TOOL_DEFS
]


def _section_excerpt(text: str, section: str) -> str | None:
    import re
    number = re.escape(section.strip().removeprefix("Section").strip())
    start = re.search(
        rf"(?im)^\s*(?:section\s+)?{number}[A-Z]?\s*[\.\):\-]\s*[^\n]{{0,300}}",
        text,
    )
    if not start:
        return None
    tail = text[start.start():]
    end = re.search(r"(?im)^\s*(?:section\s+)?\d+[A-Z]?\s*[\.\):\-]\s+", tail[1:])
    excerpt = tail[:end.start() + 1] if end else tail
    return excerpt.strip()[:8000]


async def _official_section(act: str, section: str) -> dict:
    from official_act_texts import ALIASES, ACT_ALIASES
    key = act.strip().casefold()
    aliases = {alias.casefold() for values in (*ALIASES.values(), *ACT_ALIASES.values()) for alias in values}
    if not key or not section.strip():
        raise ValueError("act and section are required")
    rows = await fetch("SELECT id,title,source_url,aliases,extracted_text,verified_on FROM official_act_texts")
    row = next((item for item in rows
                if key in {str(item["id"]).casefold(), str(item["title"]).casefold()}
                or key in {str(alias).casefold() for alias in (item["aliases"] or [])}
                or any(key == alias and alias in str(item["title"]).casefold()
                       for alias in aliases)), None)
    if not row:
        return {"status": "not loaded", "act": act, "section": section}
    excerpt = _section_excerpt(str(row["extracted_text"]), section)
    return {
        "status": "loaded" if excerpt else "section not found",
        "act": row["title"], "section": section, "text": excerpt,
        "source": row["source_url"], "verified_on": dict(row).get("verified_on"),
    }


async def call_tool(name: str, args: dict, user: dict) -> dict:
    """Dispatch only owner-scoped reads; unavailable source material fails explicitly."""
    user_id = int(user["id"])
    if name in {"my_cases", "my_case", "ecourts_case_status", "ecourts_order"}:
        cnr = str(args.get("cnr") or "").replace(" ", "").upper()
        if name in {"my_case", "ecourts_case_status", "ecourts_order"} and not cnr:
            raise ValueError("cnr is required")
        query = """
            SELECT id, cnr, case_type, court_name, added_at, last_refreshed,
                   refresh_status
            FROM tracked_cases WHERE user_id=$1 AND is_active=true
        """
        params: tuple = (user_id,)
        if name != "my_cases":
            query += " AND cnr=$2"
            params = (user_id, cnr)
        query += " ORDER BY added_at DESC LIMIT 100"
        rows = await fetch(query, *params)
        if name != "my_cases" and not rows:
            raise ValueError("That CNR is not in your tracked cases")
        if name == "my_cases":
            data = [dict(row) for row in rows]
        else:
            from services import court_data_client
            if name == "my_case":
                data = dict(rows[0])
            else:
                if name == "ecourts_order":
                    orders = await court_data_client.get_case_orders(cnr)
                    selected = [order for order in orders
                                if str(order.get("order_date") or order.get("date") or "")[:10]
                                == str(args.get("order_date") or "")[:10]]
                    data = {"cnr": cnr, "orders": selected}
                else:
                    data = await court_data_client.lookup_cnr(cnr)
        source = "LitigaForge tracked-case record" if name in {"my_cases", "my_case"} else "eCourtsIndia partner API"
        return public_result(data, source=source,
                             source_url="https://ecourts.gov.in", identifier=f"cnr:{cnr or 'owned-cases'}",
                             untrusted_text=name == "ecourts_order")
    if name == "ecourts_cause_list":
        from services.court_data_client import search_cause_list
        result = await search_cause_list(
            advocate=str(args.get("advocate") or "")[:160] or None,
            date_value=str(args.get("date") or "")[:10] or None,
            court=str(args.get("court") or "")[:160] or None,
            limit=50,
        )
        return public_result(result, source="eCourtsIndia partner API",
                             source_url="https://ecourts.gov.in", identifier="ecourts-cause-list",
                             untrusted_text=True)
    if name == "judgment_search":
        from routers.mcp import _search_judgments
        result = await _search_judgments({"query": args.get("query"), "limit": 5,
                                          "court": args.get("court")})
        for judgment in result.get("results", result.get("judgments", [])):
            judgment["indian_kanoon_attribution"] = "Powered by IKanoon"
            judgment["indian_kanoon_logo_url"] = (
                "https://api.indiankanoon.org/static/pics/ikanoon6_powered_transparent.png"
            )
        return public_result(result, source="Indian Kanoon and LitigaForge judgment index",
                             source_url="https://indiankanoon.org/", identifier="judgment-search",
                             untrusted_text=True)
    if name == "old_to_new_section":
        from legal_reference_tables import TABLES
        code = str(args.get("code") or "").strip().lower()
        section = str(args.get("section") or "").strip()
        mapping_key = {
            "ipc": "IPC_to_BNS", "crpc": "CrPC_to_BNSS",
            "evidence act": "Evidence_Act_to_BSA", "evidence": "Evidence_Act_to_BSA",
        }.get(code)
        if not mapping_key:
            raise ValueError("code must be IPC, CrPC, or Evidence Act")
        table = next(item for item in TABLES if item["id"] == "criminal-code-crosswalk-in")
        mapped = table["data"].get(mapping_key, {}).get(section)
        data = {"code": code, "section": section, "mapped_section": mapped,
                "note": table["data"]["note"], "status": table["status"]}
        return public_result(data, source="BPR&D correspondence table",
                             source_url=(table.get("sources") or [None])[0],
                             identifier=f"{mapping_key}:{section}")
    if name == "bare_act_section":
        act = str(args.get("act") or "")[:120]
        section = str(args.get("section") or "")[:40]
        data = await _official_section(act, section)
        return public_result(data, source="India Code official Act text",
                             source_url=data.get("source"),
                             identifier=f"act:{act}:{section}", untrusted_text=True)
    if name == "limitation_lookup":
        article = str(args.get("article") or "").strip()
        description = str(args.get("description") or "").strip()[:120]
        section = article or description
        data = await _official_section("Limitation Act", section)
        return public_result(data, source="India Code official Act text",
                             source_url=data.get("source"),
                             identifier=f"limitation-act:{section}", untrusted_text=True)
    if name == "judgment_passages":
        doc_id = str(args.get("doc_id") or "").strip()
        query = str(args.get("query") or "").strip()[:160]
        if not doc_id.isdigit() or len(query) < 2:
            raise ValueError("doc_id and a query of at least 2 characters are required")
        pool = await get_pool()
        async with pool.acquire() as conn:
            from case_law_search import _ik_call
            fragments = await _ik_call(conn, f"/docfragment/{doc_id}/", {"formInput": query})
        return public_result(fragments, source="Indian Kanoon document fragments",
                             source_url=f"https://indiankanoon.org/doc/{doc_id}/",
                             identifier=f"ik-doc:{doc_id}", untrusted_text=True)
    if name == "citing_judgments":
        doc_id = str(args.get("doc_id") or "").strip()
        if not doc_id.isdigit():
            raise ValueError("doc_id must be numeric")
        return public_result({"status": "not loaded", "doc_id": doc_id},
                             source="LitigaForge citation index", source_url=None,
                             identifier=f"citing-cases:{doc_id}")
    raise LookupError(f"unknown tool: {name}")


__all__ = ["router", "enabled", "ensure_schema", "verify_bearer", "audit_call",
           "ik_spend_today", "public_result", "TOOLS", "TOOL_LIST", "call_tool"]
