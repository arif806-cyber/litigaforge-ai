"""Public, read-only Model Context Protocol endpoint for LitigaForge.

The transport intentionally uses stateless JSON responses over MCP Streamable
HTTP.  It exposes only published legal information and performs no AI calls or
writes, keeping the endpoint inexpensive and safe for remote clients.
"""

import json
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from country_router import COUNTRY_CONFIG
from database import fetch, fetchrow, get_pool
from case_law_search import search_case_law
from rate_limit import limiter


router = APIRouter(tags=["mcp"])

_PROTOCOL_VERSION = "2025-06-18"
_SERVER_INFO = {"name": "litigaforge", "version": "1.0.0"}


def _json_safe(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _tool_result(data: Any, *, is_error: bool = False) -> dict:
    safe_data = _json_safe(data)
    return {
        "content": [
            {
                "type": "text",
                "text": json.dumps(safe_data, ensure_ascii=False, default=str),
            }
        ],
        "structuredContent": safe_data,
        "isError": is_error,
    }


def _error(request_id: Any, code: int, message: str, data: Any = None) -> JSONResponse:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return JSONResponse(
        {"jsonrpc": "2.0", "id": request_id, "error": error},
        headers={"MCP-Protocol-Version": _PROTOCOL_VERSION},
    )


_TOOLS = [
    {
        "name": "list_recent_judgments",
        "title": "List Recent Judgments",
        "description": (
            "List recently published Indian court judgments in LitigaForge. "
            "Results contain summaries and links to the public judgment pages."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 20,
                    "default": 10,
                },
                "court": {
                    "type": "string",
                    "description": "Optional exact court slug, for example supreme-court-of-india.",
                },
                "year": {
                    "type": "integer",
                    "minimum": 1900,
                    "maximum": 2100,
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "search_judgments",
        "title": "Search Judgments",
        "description": (
            "Search published LitigaForge judgments by case name, summary, "
            "outcome, or cited law. This is a database search and does not "
            "generate or hallucinate cases."
        ),
        "inputSchema": {
            "type": "object",
            "required": ["query"],
            "properties": {
                "query": {"type": "string", "minLength": 3, "maxLength": 200},
                "court": {
                    "type": "string",
                    "description": "Optional partial court name or court slug.",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10,
                    "default": 5,
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_judgment",
        "title": "Get Judgment",
        "description": (
            "Retrieve one published judgment using the court slug, year, and "
            "judgment slug returned by the listing or search tools."
        ),
        "inputSchema": {
            "type": "object",
            "required": ["court_slug", "year", "slug"],
            "properties": {
                "court_slug": {"type": "string", "minLength": 1, "maxLength": 160},
                "year": {"type": "integer", "minimum": 1900, "maximum": 2100},
                "slug": {"type": "string", "minLength": 1, "maxLength": 240},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_country_legal_info",
        "title": "Get Country Legal Information",
        "description": (
            "Return LitigaForge's legal-system overview, courts, primary laws, "
            "legal-help contact, and authoritative sources for a supported country."
        ),
        "inputSchema": {
            "type": "object",
            "required": ["country_code"],
            "properties": {
                "country_code": {
                    "type": "string",
                    "enum": sorted(COUNTRY_CONFIG.keys()),
                    "description": "ISO country code supported by LitigaForge.",
                }
            },
            "additionalProperties": False,
        },
    },
]


async def _list_recent_judgments(arguments: dict) -> dict:
    limit = max(1, min(int(arguments.get("limit", 10)), 20))
    court = str(arguments.get("court") or "").strip()
    year = arguments.get("year")
    where = ["status = 'published'"]
    params: list[Any] = []
    if court:
        params.append(court)
        where.append(f"court_slug = ${len(params)}")
    if year is not None:
        params.append(int(year))
        where.append(f"year = ${len(params)}")
    params.append(limit)
    rows = await fetch(
        f"""SELECT case_name, court, court_slug, judgment_date, year, slug,
                   summary_en, text_complete, acts_cited, outcome, citation, source_name, source_url
            FROM judgments
            WHERE {' AND '.join(where)}
            ORDER BY judgment_date DESC NULLS LAST, id DESC
            LIMIT ${len(params)}""",
        *params,
    )
    for row in rows:
        row["url"] = (
            f"https://litigaforge.com/judgments/"
            f"{row['court_slug']}/{row['year']}/{row['slug']}"
        )
    return {"count": len(rows), "judgments": rows}


async def _search_judgments(arguments: dict) -> dict:
    query = str(arguments.get("query") or "").strip()
    if len(query) < 3:
        raise ValueError("query must contain at least 3 characters")
    query = query[:200]
    limit = max(1, min(int(arguments.get("limit", 5)), 10))
    court = str(arguments.get("court") or "").strip()[:160]
    pool = await get_pool()
    async with pool.acquire() as conn:
        search = await search_case_law(
            conn, query, limit=limit, court=court, cache_writes=False
        )
    for row in search["results"]:
        # Search is a discovery tool: never send stored judgment bodies in its
        # result list. Clients can request one bounded body via get_judgment.
        row.pop("full_text", None)
        if row.get("source") == "local_db":
            row["url"] = f"https://litigaforge.com{row['url']}"
    return {"query": query, "count": search["count"], "source": search["source"],
            "judgments": search["results"]}


async def _get_judgment(arguments: dict) -> dict:
    court_slug = str(arguments.get("court_slug") or "").strip()[:160]
    slug = str(arguments.get("slug") or "").strip()[:240]
    year = int(arguments.get("year"))
    if not court_slug or not slug:
        raise ValueError("court_slug and slug are required")
    row = await fetchrow(
        """SELECT case_name, court, court_slug, bench, judgment_date, year, slug,
                  summary_en, summary_hi, LEFT(full_text, 20000) AS full_text,
                  CASE WHEN LENGTH(COALESCE(full_text, '')) <= 20000
                       THEN text_complete ELSE FALSE END AS text_complete,
                  LENGTH(COALESCE(full_text, '')) > 20000 AS full_text_truncated,
                  acts_cited, outcome, citation, source_name, source_url
           FROM judgments
           WHERE status = 'published' AND court_slug = $1 AND year = $2 AND slug = $3""",
        court_slug,
        year,
        slug,
    )
    if not row:
        raise ValueError("published judgment not found")
    row["url"] = f"https://litigaforge.com/judgments/{court_slug}/{year}/{slug}"
    return row


async def _call_tool(name: str, arguments: dict) -> dict:
    if name == "list_recent_judgments":
        return await _list_recent_judgments(arguments)
    if name == "search_judgments":
        return await _search_judgments(arguments)
    if name == "get_judgment":
        return await _get_judgment(arguments)
    if name == "get_country_legal_info":
        code = str(arguments.get("country_code") or "").upper()
        config = COUNTRY_CONFIG.get(code)
        if config is None:
            raise ValueError(f"unsupported country code: {code}")
        return {"country_code": code, "config": config}
    raise LookupError(f"unknown tool: {name}")


@router.get("/mcp")
async def mcp_get():
    return JSONResponse(
        {
            "name": "LitigaForge MCP",
            "transport": "Streamable HTTP",
            "endpoint": "https://litigaforge.com/mcp",
            "message": "Connect with an MCP client using HTTP POST.",
        },
        headers={"Allow": "GET, POST", "MCP-Protocol-Version": _PROTOCOL_VERSION},
    )


@router.post("/mcp")
@limiter.limit("60/minute")
async def mcp_post(request: Request):
    try:
        payload = await request.json()
    except Exception:
        return _error(None, -32700, "Parse error")

    if not isinstance(payload, dict) or payload.get("jsonrpc") != "2.0":
        return _error(payload.get("id") if isinstance(payload, dict) else None, -32600, "Invalid Request")

    method = payload.get("method")
    request_id = payload.get("id")
    params = payload.get("params") or {}

    # JSON-RPC notifications intentionally have no response body.
    if method in {"notifications/initialized", "notifications/cancelled"}:
        return Response(status_code=202)

    if method == "initialize":
        requested_version = params.get("protocolVersion")
        version = requested_version if isinstance(requested_version, str) else _PROTOCOL_VERSION
        result = {
            "protocolVersion": version,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": _SERVER_INFO,
            "instructions": (
                "Use LitigaForge for read-only legal research. Results are legal "
                "information, not legal advice. Verify important conclusions with "
                "the cited primary source or a qualified lawyer."
            ),
        }
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": _TOOLS}
    elif method == "tools/call":
        if not isinstance(params, dict):
            return _error(request_id, -32602, "Invalid params")
        name = params.get("name")
        arguments = params.get("arguments") or {}
        if not isinstance(name, str) or not isinstance(arguments, dict):
            return _error(request_id, -32602, "Invalid params")
        try:
            data = await _call_tool(name, arguments)
            result = _tool_result(data)
        except LookupError as exc:
            return _error(request_id, -32601, str(exc))
        except (TypeError, ValueError) as exc:
            result = _tool_result({"error": str(exc)}, is_error=True)
        except Exception:
            result = _tool_result(
                {"error": "LitigaForge could not complete this tool call"},
                is_error=True,
            )
    else:
        return _error(request_id, -32601, f"Method not found: {method}")

    return JSONResponse(
        {"jsonrpc": "2.0", "id": request_id, "result": result},
        headers={"MCP-Protocol-Version": _PROTOCOL_VERSION},
    )