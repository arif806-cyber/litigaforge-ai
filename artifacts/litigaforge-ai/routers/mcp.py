"""Public, read-only Model Context Protocol endpoint for LitigaForge.

The transport intentionally uses stateless JSON responses over MCP Streamable
HTTP.  It exposes only published legal information and performs no AI calls or
writes, keeping the endpoint inexpensive and safe for remote clients.
"""

import asyncio
import json
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response

from country_router import COUNTRY_CONFIG
from database import fetch, fetchrow, get_pool
from case_law_search import search_case_law
from rate_limit import limiter


router = APIRouter(tags=["mcp"])

_PROTOCOL_VERSION = "2025-06-18"
_SUPPORTED_PROTOCOL_VERSIONS = {"2025-06-18", "2025-03-26", "2024-11-05"}
_TRUSTED_ORIGINS = {
    "https://claude.ai", "https://claude.com",
    "https://litigaforge.com", "https://www.litigaforge.com",
}
_SERVER_INFO = {"name": "litigaforge", "version": "1.0.0"}


def _protected_resource_metadata_url(request: Request) -> str:
    return "https://litigaforge.com/.well-known/oauth-protected-resource"


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
    source = safe_data.get("source") if isinstance(safe_data, dict) else None
    source_url = safe_data.get("source_url") if isinstance(safe_data, dict) else None
    if not source_url and isinstance(safe_data, dict):
        rows = safe_data.get("judgments") or []
        if isinstance(rows, list):
            source_url = next((row.get("url") for row in rows
                               if isinstance(row, dict) and row.get("url")), None)
    source_url = source_url or "https://litigaforge.com/mcp-docs"
    if is_error:
        nested = safe_data.get("data") if isinstance(safe_data, dict) else None
        detail = (safe_data.get("error") or safe_data.get("reason") or safe_data.get("message")
                  or (nested.get("reason") or nested.get("message") if isinstance(nested, dict) else None))
        summary = str(detail or safe_data.get("status") or
                      "The tool could not complete the request.")[:240]
    elif isinstance(safe_data, dict):
        detail = safe_data.get("data")
        if isinstance(detail, dict):
            count = detail.get("count")
            summary = f"Returned {count} result(s)." if count is not None else str(
                detail.get("status") or detail.get("message") or "Tool completed."
            )
        else:
            summary = f"Returned {safe_data.get('count')} result(s)." if safe_data.get("count") is not None else "Tool completed."
    else:
        summary = "Tool completed."
    text = f"{summary[:240]} Source: {source or 'LitigaForge'}. {source_url}"
    return {
        "content": [{"type": "text", "text": text}],
        "structuredContent": safe_data,
        "isError": is_error,
    }


def _error(request_id: Any, code: int, message: str, data: Any = None,
           protocol_version: str = _PROTOCOL_VERSION) -> JSONResponse:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return JSONResponse(
        {"jsonrpc": "2.0", "id": request_id, "error": error},
        headers={"MCP-Protocol-Version": protocol_version},
    )


def _authentication_error(
    request: Request, *, invalid_token: bool, request_id: Any = None,
    protocol_version: str = _PROTOCOL_VERSION,
) -> JSONResponse:
    response = _error(request_id, -32001, "MCP authentication required",
                       protocol_version=protocol_version)
    response.status_code = 401
    challenge = "Bearer"
    if invalid_token:
        challenge += ' error="invalid_token"'
    challenge += f', resource_metadata="{_protected_resource_metadata_url(request)}"'
    response.headers["WWW-Authenticate"] = challenge
    return response


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

# MCP annotations are advisory to clients; declare the safety contract on every
# tool, including the legacy anonymous read-only tools.
for _tool in _TOOLS:
    _tool["annotations"] = {
        "title": _tool["title"],
        "readOnlyHint": True,
        **({"openWorldHint": True} if _tool["name"] == "search_judgments" else {}),
    }
    _tool["description"] = (_tool["description"] + " Jurisdiction: India.").strip()[:1023]


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
            conn, query, limit=limit, court=court, feature="mcp"
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
    return JSONResponse({"error": "GET is not supported; use POST."}, status_code=405,
                        headers={"Allow": "POST"})


@router.post("/mcp")
@limiter.limit("60/minute")
async def mcp_post(request: Request):
    origin = request.headers.get("origin")
    if origin is not None and origin not in _TRUSTED_ORIGINS:
        return JSONResponse({"error": "Untrusted Origin"}, status_code=403)
    from routers import mcp_v2
    authorization = request.headers.get("authorization")
    if authorization is not None:
        try:
            await mcp_v2.authenticate_bearer(request)
        except HTTPException:
            return _authentication_error(request, invalid_token=True)
    try:
        payload = await request.json()
    except Exception:
        return _error(None, -32700, "Parse error")

    if not isinstance(payload, dict) or payload.get("jsonrpc") != "2.0":
        return _error(payload.get("id") if isinstance(payload, dict) else None, -32600, "Invalid Request")

    method = payload.get("method")
    request_id = payload.get("id")
    params = payload.get("params", {})
    if params is None:
        params = {}
    if not isinstance(params, dict):
        return _error(request_id, -32602, "Invalid params")

    if method != "initialize":
        header_version = request.headers.get("mcp-protocol-version")
        protocol_version = header_version or "2025-03-26"
        if protocol_version not in _SUPPORTED_PROTOCOL_VERSIONS:
            return JSONResponse(
                {"jsonrpc": "2.0", "id": request_id,
                 "error": {"code": -32600, "message": "Unsupported MCP-Protocol-Version"}},
                status_code=400,
            )
    else:
        protocol_version = _PROTOCOL_VERSION

    protected = method in {"initialize", "tools/list", "tools/call", "prompts/list", "prompts/get"}
    if (method == "initialize" or mcp_v2.enabled() and protected) and authorization is None:
        return _authentication_error(request, invalid_token=False,
                                     request_id=request_id, protocol_version=protocol_version)

    # JSON-RPC notifications intentionally have no response body.
    if method in {"notifications/initialized", "notifications/cancelled"}:
        return Response(status_code=202)

    if method == "initialize":
        requested_version = params.get("protocolVersion")
        version = requested_version if requested_version in _SUPPORTED_PROTOCOL_VERSIONS else _PROTOCOL_VERSION
        protocol_version = version
        capabilities = {"tools": {"listChanged": False}}
        if mcp_v2.enabled():
            capabilities["prompts"] = {"listChanged": False}
        result = {
            "protocolVersion": version,
            "capabilities": capabilities,
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
        if mcp_v2.enabled():
            result = {"tools": mcp_v2.TOOL_LIST}
        else:
            result = {"tools": _TOOLS}
    elif method in {"prompts/list", "prompts/get"}:
        if not mcp_v2.enabled():
            return _error(request_id, -32601, f"Method not found: {method}")
        if method == "prompts/list":
            result = {"prompts": mcp_v2.PROMPTS}
        else:
            if not isinstance(params, dict) or not isinstance(params.get("name"), str):
                return _error(request_id, -32602, "Invalid params", protocol_version=protocol_version)
            prompt = mcp_v2.get_prompt(params["name"], params.get("arguments") or {})
            if prompt is None:
                return _error(request_id, -32602, "Unknown prompt", protocol_version=protocol_version)
            result = prompt
    elif method == "tools/call":
        if not isinstance(params, dict):
            return _error(request_id, -32602, "Invalid params", protocol_version=protocol_version)
        name = params.get("name")
        arguments = params.get("arguments") or {}
        if not isinstance(name, str) or not isinstance(arguments, dict):
            return _error(request_id, -32602, "Invalid params", protocol_version=protocol_version)
        try:
            from routers import mcp_v2
            if name in mcp_v2.TOOLS:
                if not mcp_v2.enabled():
                    return _error(request_id, -32601, "Method not found", protocol_version=protocol_version)
                try:
                    units = 1
                    if name == "verify_citation":
                        citations = arguments.get("citations")
                        units = len(citations) if isinstance(citations, list) else 1
                    user, key_id, audit_id = await mcp_v2.verify_bearer(request, name, units)
                except Exception as exc:
                    detail = getattr(exc, "detail", "MCP authentication required")
                    if isinstance(exc, HTTPException) and exc.status_code == 401:
                        return _authentication_error(request, invalid_token=True,
                                                     request_id=request_id,
                                                     protocol_version=protocol_version)
                    message = detail.get("message", "MCP request denied") if isinstance(detail, dict) else str(detail)
                    result = _tool_result({"error": message, "code": detail.get("code") if isinstance(detail, dict) else None}, is_error=True)
                    return JSONResponse({"jsonrpc": "2.0", "id": request_id, "result": result},
                                        headers={"MCP-Protocol-Version": protocol_version})
                outcome = "ok"
                ik_metered_tools = {
                    "judgment_search", "judgment_passages", "verify_citation", "hearing_brief"
                }
                cost_before = await mcp_v2.ik_spend_today() if name in ik_metered_tools else 0
                try:
                    data = await asyncio.wait_for(
                        mcp_v2.call_tool(name, arguments, user),
                        timeout=90 if name == "verify_citation" else 60 if name == "hearing_brief" else 10,
                    )
                except Exception:
                    outcome = "error"
                    raise
                finally:
                    cost_after = await mcp_v2.ik_spend_today() if name in ik_metered_tools else cost_before
                    await mcp_v2.audit_call(user, key_id, audit_id, name, arguments,
                                            cost_inr=max(0, cost_after - cost_before),
                                            outcome=outcome)
            else:
                data = await _call_tool(name, arguments)
            unavailable = (isinstance(data, dict) and isinstance(data.get("data"), dict)
                           and data["data"].get("status") == "unavailable")
            result = _tool_result(data, is_error=unavailable)
        except LookupError as exc:
            return _error(request_id, -32601, str(exc), protocol_version=protocol_version)
        except (asyncio.TimeoutError, TimeoutError):
            result = _tool_result({"error": "The upstream legal-data service timed out. Please retry shortly."},
                                  is_error=True)
        except (TypeError, ValueError) as exc:
            result = _tool_result({"error": str(exc)}, is_error=True)
        except Exception:
            result = _tool_result(
                {"error": "LitigaForge could not complete this tool call"},
                is_error=True,
            )
    else:
        return _error(request_id, -32601, f"Method not found: {method}", protocol_version=protocol_version)

    return JSONResponse(
        {"jsonrpc": "2.0", "id": request_id, "result": result},
        headers={"MCP-Protocol-Version": protocol_version},
    )