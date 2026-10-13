"""Run the dated MCP contract and injection fixtures against a local dev server.

Requires MCP_REVIEWER_EMAIL and MCP_REVIEWER_PASSWORD from Replit Secrets.
The runner is restricted to loopback so it cannot target production.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parents[0]
WORKSPACE = HERE.parents[2]
FIXTURE_DIR = WORKSPACE / "docs" / "mcp-evals"
DEFAULT_BASE_URL = "http://127.0.0.1:8080"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def _url(base: str, path: str) -> str:
    return base.rstrip("/") + path


def _request(url: str, *, method: str = "GET", data: bytes | None = None,
             headers: dict | None = None) -> tuple[int, object, bytes]:
    request = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        response = OPENER.open(request, timeout=60)
        return response.status, response.headers, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.headers, exc.read()


def _json_request(url: str, *, method: str = "GET", payload: dict | None = None,
                  headers: dict | None = None) -> tuple[int, object]:
    request_headers = {"Accept": "application/json", **(headers or {})}
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    status, response_headers, raw = _request(url, method=method, data=body, headers=request_headers)
    try:
        parsed = json.loads(raw.decode("utf-8")) if raw else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        parsed = {}
    return status, {"headers": response_headers, "body": parsed}


def _oauth_token(base: str) -> str:
    email = os.getenv("MCP_REVIEWER_EMAIL", "").strip()
    password = os.getenv("MCP_REVIEWER_PASSWORD", "")
    if not email or not password:
        raise RuntimeError("Set MCP_REVIEWER_EMAIL and MCP_REVIEWER_PASSWORD in Replit Secrets.")

    redirect_uri = "http://127.0.0.1:49152/callback"
    status, result = _json_request(
        _url(base, "/api/oauth/register"),
        method="POST",
        payload={"client_name": "LitigaForge development evaluation", "redirect_uris": [redirect_uri]},
    )
    if status != 201:
        raise RuntimeError(f"OAuth dynamic registration failed (HTTP {status}).")
    client_id = result["body"].get("client_id")
    if not client_id:
        raise RuntimeError("OAuth registration response did not include a client ID.")

    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(24)
    params = urllib.parse.urlencode({
        "client_id": client_id, "redirect_uri": redirect_uri, "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256",
        "response_type": "code", "scope": "mcp:read",
    })
    status, _, page = _request(_url(base, "/api/oauth/authorize?" + params))
    if status != 200 or b"Authorize MCP access" not in page:
        raise RuntimeError(f"OAuth authorization page failed (HTTP {status}).")

    fields = {
        "client_id": client_id, "redirect_uri": redirect_uri, "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256",
        "response_type": "code", "scope": "mcp:read", "email": email, "password": password,
    }
    encoded = urllib.parse.urlencode(fields).encode()
    status, headers, _ = _request(
        _url(base, "/api/oauth/authorize"), method="POST", data=encoded,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    location = headers.get("Location", "") if headers else ""
    if status != 303 or not location.startswith(redirect_uri):
        raise RuntimeError(f"OAuth account authorization failed (HTTP {status}).")
    query = urllib.parse.parse_qs(urlsplit(location).query)
    code = (query.get("code") or [""])[0]
    if (query.get("state") or [""])[0] != state or not code:
        raise RuntimeError("OAuth callback state or authorization code was invalid.")

    token_data = urllib.parse.urlencode({
        "grant_type": "authorization_code", "client_id": client_id,
        "redirect_uri": redirect_uri, "code": code, "code_verifier": verifier,
        "resource": "https://litigaforge.com/mcp",
    }).encode()
    status, _, raw = _request(
        _url(base, "/api/oauth/token"), method="POST", data=token_data,
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
    )
    try:
        token_body = json.loads(raw.decode())
    except (UnicodeDecodeError, json.JSONDecodeError):
        token_body = {}
    token = token_body.get("access_token")
    if status != 200 or not token or token_body.get("token_type") != "Bearer":
        raise RuntimeError(f"OAuth PKCE token exchange failed (HTTP {status}).")
    return token


def _mcp_call(base: str, token: str, request_id: int, method: str,
              params: dict | None = None) -> dict:
    payload = {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or {}}
    status, response = _json_request(
        _url(base, "/mcp"), method="POST", payload=payload,
        headers={"Authorization": f"Bearer {token}", "MCP-Protocol-Version": "2025-06-18"},
    )
    body = response["body"]
    if status != 200 or not isinstance(body, dict):
        raise RuntimeError(f"MCP {method} failed (HTTP {status}).")
    return body


def _structured(response: dict) -> dict | None:
    result = response.get("result")
    if not isinstance(result, dict) or result.get("isError"):
        return None
    data = result.get("structuredContent")
    return data if isinstance(data, dict) else None


def _quality_reason(case: dict, response: dict, tool_names: set[str]) -> str:
    tool = case["tool"]
    if tool not in tool_names:
        return "tool missing from tools/list"
    data = _structured(response)
    result = response.get("result")
    content = result.get("content", []) if isinstance(result, dict) else []
    if not any(isinstance(block, dict) and block.get("type") == "text"
               and "https://" in str(block.get("text", "")) for block in content):
        return "tool result lacks concise linked text content"
    structured = result.get("structuredContent") if isinstance(result, dict) else None
    if (isinstance(result, dict) and result.get("isError") is True
            and tool == "judgment_passages" and isinstance(structured, dict)
            and isinstance(structured.get("data"), dict)
            and structured["data"].get("status") == "unavailable"):
        return "Indian Kanoon disabled path returns an explicit isError result with source link"
    if not data:
        result = response.get("result")
        content = result.get("content", []) if isinstance(result, dict) else []
        text = content[0].get("text", "") if content and isinstance(content[0], dict) else ""
        error = response.get("error") or text
        return ("tool returned an MCP error: " + str(error)[:120]) if error else "missing structured result"
    required = {"data", "source", "source_url", "retrieved_at", "citation_id", "notice"}
    missing = sorted(required - data.keys())
    if missing:
        return "missing provenance fields: " + ", ".join(missing)
    if not data["source"] or not data["retrieved_at"] or not data["citation_id"] or not data["notice"]:
        return "empty source, retrieval time, citation ID, or legal notice"
    if case["id"] in {"Q23", "Q24", "Q25", "Q28"}:
        encoded = json.dumps(data, ensure_ascii=False).lower()
        if "demo-cnr-001" not in encoded or "fictional" not in encoded:
            return "reviewer result did not identify its own fictional demo matter"
    if case["id"] == "Q31":
        encoded = json.dumps(data, ensure_ascii=False).lower()
        if "demo-cnr-001" not in encoded or "fictional" not in encoded:
            return "hearing brief did not remain within the fictional reviewer matter"
    return "provenance and read-only tool response contract passed"


def _protocol_checks(base: str, token: str) -> list[dict]:
    checks = []
    status, headers, _ = _request(_url(base, "/mcp"))
    checks.append({"name": "GET returns 405 with Allow: POST",
                   "passed": status == 405 and headers.get("Allow") == "POST"})

    status, challenge = _json_request(_url(base, "/mcp"), method="POST",
                                      payload={"jsonrpc": "2.0", "id": 800, "method": "initialize",
                                               "params": {"protocolVersion": "unsupported"}})
    authenticate = challenge["headers"].get("WWW-Authenticate", "")
    checks.append({"name": "initialize requires bearer on first request",
                   "passed": status == 401 and "resource_metadata=" in authenticate})
    invalid_status, invalid = _json_request(
        _url(base, "/mcp"), method="POST",
        payload={"jsonrpc": "2.0", "id": 801, "method": "initialize"},
        headers={"Authorization": "Bearer invalid-token"},
    )
    checks.append({"name": "invalid bearer includes invalid_token challenge",
                   "passed": invalid_status == 401 and 'error="invalid_token"' in
                   invalid["headers"].get("WWW-Authenticate", "")})

    status, init = _json_request(
        _url(base, "/mcp"), method="POST",
        payload={"jsonrpc": "2.0", "id": 802, "method": "initialize",
                 "params": {"protocolVersion": "not-supported"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    checks.append({"name": "unknown initialize version negotiates latest",
                   "passed": status == 200 and init["body"].get("result", {}).get("protocolVersion") == "2025-06-18"})
    status, missing = _json_request(
        _url(base, "/mcp"), method="POST",
        payload={"jsonrpc": "2.0", "id": 803, "method": "ping"},
        headers={"Authorization": f"Bearer {token}"},
    )
    checks.append({"name": "missing later version header assumes 2025-03-26",
                   "passed": status == 200 and missing["headers"].get("MCP-Protocol-Version") == "2025-03-26"})
    status, _ = _json_request(
        _url(base, "/mcp"), method="POST",
        payload={"jsonrpc": "2.0", "id": 804, "method": "ping"},
        headers={"Authorization": f"Bearer {token}", "MCP-Protocol-Version": "9.9"},
    )
    checks.append({"name": "unsupported later version returns 400", "passed": status == 400})

    status, _ = _json_request(
        _url(base, "/mcp"), method="POST",
        payload={"jsonrpc": "2.0", "id": 805, "method": "ping"},
        headers={"Origin": "https://attacker.example"},
    )
    checks.append({"name": "untrusted Origin remains blocked through the API proxy",
                   "passed": status == 403})
    status, metadata = _json_request(_url(base, "/.well-known/oauth-protected-resource"))
    checks.append({"name": "resource metadata identifies canonical MCP resource",
                   "passed": status == 200 and metadata["body"].get("resource") == "https://litigaforge.com/mcp"
                   and "https://litigaforge.com" in metadata["body"].get("authorization_servers", [])})
    return checks


def _case_ids(data: dict) -> list[str]:
    records = data.get("data")
    if isinstance(records, dict):
        records = [records]
    if not isinstance(records, list):
        return []
    return sorted(str(row.get("cnr")) for row in records if isinstance(row, dict) and row.get("cnr"))


def _reviewer_plan_config(config: dict | None = None) -> dict:
    sys.path.insert(0, str(PROJECT_ROOT))
    from database import close_pool, execute, fetchrow
    from runtime_env import assert_development_database

    async def run():
        try:
            assert_development_database()
            if config is None:
                row = await fetchrow("SELECT config FROM mcp_plan_settings WHERE plan_id='reviewer'")
                value = row["config"] if row else None
                if isinstance(value, str):
                    value = json.loads(value)
                if not isinstance(value, dict):
                    raise RuntimeError("Development Reviewer plan config is unavailable.")
                return value
            await execute("UPDATE mcp_plan_settings SET config=$1::jsonb WHERE plan_id='reviewer'",
                          json.dumps(config))
            return config
        finally:
            await close_pool()

    return asyncio.run(run())


def _run(base: str, original_plan_config: dict) -> tuple[list[dict], list[dict], list[str], dict]:
    token = _oauth_token(base)
    initialize = _mcp_call(base, token, 1, "initialize", {
        "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "dev-eval", "version": "1"},
    })
    if "error" in initialize:
        raise RuntimeError("MCP initialize failed.")
    listing = _mcp_call(base, token, 2, "tools/list")
    tools = listing.get("result", {}).get("tools", [])
    if not isinstance(tools, list):
        raise RuntimeError("MCP tools/list returned an invalid tool set.")
    tool_names = {item.get("name") for item in tools if isinstance(item, dict)}
    expected_tools = {
        "ecourts_case_status", "ecourts_cause_list", "ecourts_order", "judgment_search",
        "judgment_passages", "citing_judgments", "bare_act_section", "old_to_new_section",
        "limitation_lookup", "my_cases", "my_case", "verify_citation",
        "update_draft_sections", "hearing_brief",
    }
    if expected_tools - tool_names:
        raise RuntimeError("Reviewer tools/list omitted expected tools: " + ", ".join(sorted(expected_tools - tool_names)))

    quality_fixtures = json.loads((FIXTURE_DIR / "quality-queries.json").read_text())
    injection_fixtures = json.loads((FIXTURE_DIR / "injection-cases.json").read_text())
    quality = []
    baseline = None
    for i, case in enumerate(quality_fixtures["cases"], start=10):
        response = _mcp_call(base, token, i, "tools/call", {
            "name": case["tool"], "arguments": case.get("arguments", {}),
        })
        reason = _quality_reason(case, response, tool_names)
        quality.append({"id": case["id"], "tool": case["tool"],
                        "passed": reason.startswith(("provenance", "Indian Kanoon disabled path")),
                        "reason": reason})
        if case["id"] == "Q25":
            data = _structured(response)
            baseline = _case_ids(data) if data else []

    # Exercise the live tool policy with hostile text as an unknown argument:
    # my_cases must return only this authenticated user's own reviewer records.
    # The pure result-fencing check verifies that source strings remain marked
    # untrusted and cannot terminate their wrapper.
    sys.path.insert(0, str(PROJECT_ROOT))
    from routers.mcp_v2 import public_result

    injection = []
    if not baseline:
        baseline = []
    for i, case in enumerate(injection_fixtures["cases"], start=100):
        response = _mcp_call(base, token, i, "tools/call", {
            "name": "my_cases", "arguments": {"untrusted_source_text": case["source_text"]},
        })
        data = _structured(response)
        same_records = bool(data) and _case_ids(data) == baseline
        reflected = bool(data) and case["source_text"] in json.dumps(data, ensure_ascii=False)
        fenced = public_result(
            {"source_text": case["source_text"]}, source="evaluation fixture",
            source_url=None, identifier=case["id"], untrusted_text=True,
        )["data"]["source_text"]
        safely_fenced = (
            fenced.startswith("<UNTRUSTED SOURCE TEXT>\n")
            and fenced.endswith("\n</UNTRUSTED SOURCE TEXT>")
            and (
                "</UNTRUSTED SOURCE TEXT>" not in case["source_text"]
                or "&lt;/UNTRUSTED SOURCE TEXT&gt;" in fenced
            )
        )
        passed = same_records and not reflected and safely_fenced
        injection.append({
            "id": case["id"], "attack": case["attack"], "passed": passed,
            "reason": "identity unchanged; payload not reflected; untrusted text fenced"
            if passed else "identity, response reflection, or source fencing check failed",
        })

    open_world_names = {
        "ecourts_case_status", "ecourts_cause_list", "ecourts_order",
        "judgment_search", "judgment_passages", "citing_judgments",
        "verify_citation", "hearing_brief",
    }
    unsafe = []
    for tool in tools:
        name = tool.get("name", "?")
        annotations = tool.get("annotations") or {}
        description = tool.get("description", "")
        if not annotations.get("readOnlyHint", False):
            unsafe.append(f"{name}: missing readOnlyHint")
        if not tool.get("title") or not annotations.get("title"):
            unsafe.append(f"{name}: missing title")
        if not isinstance(description, str) or len(description) >= 1024:
            unsafe.append(f"{name}: missing or oversized description")
        if name in open_world_names and annotations.get("openWorldHint") is not True:
            unsafe.append(f"{name}: missing openWorldHint")
    _reviewer_plan_config(original_plan_config)
    quota = _live_quota_check(base, token, os.getenv("MCP_REVIEWER_EMAIL", "").strip().lower())
    return quality, injection, unsafe, quota


def _live_quota_check(base: str, token: str, email: str) -> dict:
    """Fill only the isolated dev reviewer's quota, assert denial, then remove fixture rows."""
    sys.path.insert(0, str(PROJECT_ROOT))
    from database import close_pool, execute, fetchrow
    from runtime_env import assert_development_database

    async def run() -> dict:
        assert_development_database()
        reviewer = await fetchrow("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", email)
        if not reviewer:
            raise RuntimeError("Development Reviewer account was not found.")
        user_id = int(reviewer["id"])
        count = await fetchrow(
            "SELECT COUNT(*) AS n FROM mcp_call_audit WHERE user_id=$1 AND created_at>=CURRENT_DATE",
            user_id,
        )
        needed = max(0, 200 - int(count["n"] or 0))
        if needed:
            await execute("""
                INSERT INTO mcp_call_audit(user_id,api_key_id,tool_name,args_sha256,outcome)
                SELECT $1,NULL,'my_cases','', 'quota_fixture' FROM generate_series(1,$2)
            """, user_id, needed)
        try:
            response = _mcp_call(base, token, 900, "tools/call", {"name": "my_cases", "arguments": {}})
            result = response.get("result", {})
            text = " ".join(str(block.get("text", "")) for block in result.get("content", [])
                            if isinstance(block, dict))
            passed = result.get("isError") is True and "Daily MCP plan limit reached" in text
            return {"passed": passed, "reason": "live Reviewer call was denied at the 200-call daily limit" if passed else "live call did not return a daily quota tool error"}
        finally:
            await execute(
                "DELETE FROM mcp_call_audit WHERE user_id=$1 AND outcome='quota_fixture'", user_id
            )
            await close_pool()

    return asyncio.run(run())


def _write_report(quality: list[dict], injection: list[dict], unsafe: list[str],
                  protocol: list[dict], base: str, quota: dict) -> Path:
    today = date.today().isoformat()
    target = FIXTURE_DIR / f"results-{today}.md"
    q_pass = sum(row["passed"] for row in quality)
    i_pass = sum(row["passed"] for row in injection)
    lines = [
        f"# MCP Evaluation Results — {today}", "",
        f"- Target: local development server `{base}/mcp` (loopback only; not production).",
        "- Authentication: dynamic client registration plus OAuth authorization-code/PKCE.",
        "- Judge: deterministic MCP response-contract and injection-boundary checks; no LLM legal-quality judge or live Claude connector was used.",
        "- Evaluation setup: the dedicated development Reviewer quota was temporarily raised for fixtures and restored before the live 200-call denial check.",
        f"- Quality suite: **{q_pass}/{len(quality)} passed ({q_pass / max(1, len(quality)):.0%})**.",
        f"- Injection suite: **{i_pass}/{len(injection)} passed ({i_pass / max(1, len(injection)):.0%})**.",
        f"- Live Reviewer quota denial: **{'PASS' if quota['passed'] else 'FAIL'}** — {quota['reason']}.",
        f"- Protocol conformance checks: **{sum(r['passed'] for r in protocol)}/{len(protocol)} passed**.",
        f"- Tool annotation check: **{'PASS' if not unsafe else 'FAIL'}**"
        + (f" ({', '.join(unsafe)})" if unsafe else " (titles, readOnlyHint, required openWorldHint, and bounded descriptions are present)."),
        "", "## Quality fixture results", "", "| Case | Tool | Result | Check |", "|---|---|---:|---|",
    ]
    lines.extend(
        f"| {row['id']} | `{row['tool']}` | {'PASS' if row['passed'] else 'FAIL'} | {row['reason']} |"
        for row in quality
    )
    lines += ["", "## Injection fixture results", "", "| Case | Attack | Result | Check |", "|---|---|---:|---|"]
    lines.extend(
        f"| {row['id']} | {row['attack']} | {'PASS' if row['passed'] else 'FAIL'} | {row['reason']} |"
        for row in injection
    )
    lines += ["", "## Protocol conformance", "", "| Check | Result |", "|---|---:|"]
    lines.extend(f"| {row['name']} | {'PASS' if row['passed'] else 'FAIL'} |" for row in protocol)
    lines += ["", "## Quota check", "", f"- {'PASS' if quota['passed'] else 'FAIL'} — {quota['reason']}.", ""]
    lines += [
        "", "## Interpretation", "",
        "The quality score covers server response structure, provenance fields, and the fictional Reviewer case boundary; it does not grade natural-language legal answers.",
        "The injection score checks that hostile text cannot change the authenticated `my_cases` identity/result and that untrusted source text remains fenced. It does not substitute for a live LLM-client prompt-injection evaluation.",
        "",
    ]
    target.write_text("\n".join(lines), encoding="utf-8")
    return target


def main() -> None:
    base = os.getenv("MCP_EVAL_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    host = urlsplit(base).hostname
    if host not in {"localhost", "127.0.0.1", "::1"}:
        raise SystemExit("Refusing non-loopback MCP_EVAL_BASE_URL; evaluations must use the development server.")
    original_plan = _reviewer_plan_config()
    temporary_plan = dict(original_plan)
    temporary_plan["daily_calls"] = 5000
    _reviewer_plan_config(temporary_plan)
    try:
        quality, injection, unsafe, quota = _run(base, original_plan)
    finally:
        _reviewer_plan_config(original_plan)
    token = _oauth_token(base)
    protocol = _protocol_checks(base, token)
    report = _write_report(quality, injection, unsafe, protocol, base, quota)
    q_pass = sum(row["passed"] for row in quality)
    i_pass = sum(row["passed"] for row in injection)
    print(f"Quality: {q_pass}/{len(quality)}; injection: {i_pass}/{len(injection)}; report: {report}")
    if (q_pass != len(quality) or i_pass != len(injection) or unsafe or not quota["passed"]
            or any(not row["passed"] for row in protocol)):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
