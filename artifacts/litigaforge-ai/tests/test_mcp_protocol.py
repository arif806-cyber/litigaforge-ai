import asyncio
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from routers import mcp, mcp_oauth, mcp_v2

app = FastAPI()
app.include_router(mcp.router)
app.include_router(mcp_oauth.router)
client = TestClient(app)


def _rpc(method, params=None):
    return {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}


def test_get_endpoint_is_method_not_allowed():
    response = client.get("/mcp")
    assert response.status_code == 405
    assert response.headers["allow"] == "POST"


def test_initialize_negotiates_only_supported_versions(monkeypatch):
    monkeypatch.setattr(mcp_v2, "enabled", lambda: False)
    monkeypatch.setattr(mcp_v2, "authenticate_bearer", lambda _r: asyncio.sleep(0, result={}))
    for requested, expected in [
        ("2025-06-18", "2025-06-18"),
        ("2025-03-26", "2025-03-26"),
        ("2024-11-05", "2024-11-05"),
        ("2099-01-01", "2025-06-18"),
        ("future-version", "2025-06-18"),
        (None, "2025-06-18"),
    ]:
        response = client.post("/mcp", json=_rpc("initialize", {"protocolVersion": requested}),
                               headers={"Authorization": "Bearer lfm_valid"})
        assert response.status_code == 200
        assert response.json()["result"]["protocolVersion"] == expected
        assert response.headers["mcp-protocol-version"] == expected


def test_later_requests_accept_supported_and_missing_protocol_version(monkeypatch):
    monkeypatch.setattr(mcp_v2, "enabled", lambda: False)
    for headers, expected in [
        ({"MCP-Protocol-Version": "2025-06-18"}, "2025-06-18"),
        ({"MCP-Protocol-Version": "2024-11-05"}, "2024-11-05"),
        ({}, "2025-03-26"),
    ]:
        response = client.post("/mcp", json=_rpc("tools/list"), headers=headers)
        assert response.status_code == 200
        assert response.headers["mcp-protocol-version"] == expected
    rejected = client.post("/mcp", json=_rpc("ping"),
                           headers={"MCP-Protocol-Version": "9.9"})
    assert rejected.status_code == 400


def test_untrusted_origin_is_rejected_and_no_origin_is_allowed(monkeypatch):
    monkeypatch.setattr(mcp_v2, "enabled", lambda: False)
    for origin in ["https://attacker.example", "null", "http://claude.ai"]:
        assert client.post("/mcp", json=_rpc("ping"), headers={"Origin": origin}).status_code == 403
    assert client.post("/mcp", json=_rpc("ping")).status_code == 200
    assert client.post("/mcp", json=_rpc("ping"),
                       headers={"Origin": "https://claude.ai"}).status_code == 200


def test_v2_requires_bearer_from_initialize_and_advertises_oauth_challenge(monkeypatch):
    monkeypatch.setattr(mcp_v2, "enabled", lambda: True)
    async def reject(_request):
        raise HTTPException(401, "Invalid token")
    monkeypatch.setattr(mcp_v2, "authenticate_bearer", reject)
    for method in ("initialize", "tools/list", "tools/call", "prompts/list", "prompts/get"):
        response = client.post("/mcp", json=_rpc(method),
                               headers={"MCP-Protocol-Version": "2025-06-18"})
        assert response.status_code == 401
        assert 'resource_metadata="https://litigaforge.com/.well-known/oauth-protected-resource"' in response.headers["www-authenticate"]
        assert "error=" not in response.headers["www-authenticate"]
    bad = client.post("/mcp", json=_rpc("initialize"),
                      headers={"Authorization": "Bearer bad"})
    assert bad.status_code == 401
    assert 'error="invalid_token"' in bad.headers["www-authenticate"]


def test_invalid_credentials_are_rejected_even_for_anonymous_methods_with_v2_disabled(monkeypatch):
    monkeypatch.setattr(mcp_v2, "enabled", lambda: False)
    async def no_match(*_args):
        return None
    monkeypatch.setattr(mcp_v2, "fetchrow", no_match)
    methods = [
        ("ping", _rpc("ping")),
        ("tools/list", _rpc("tools/list")),
        ("initialize", _rpc("initialize")),
        ("notification", {"jsonrpc": "2.0", "method": "notifications/initialized"}),
    ]
    credentials = ["lfm_invalid-key", "lfo_expired-token", "lfo_revoked-token"]
    for _label, payload in methods:
        for credential in credentials:
            response = client.post(
                "/mcp", json=payload,
                headers={"Authorization": f"Bearer {credential}"},
            )
            assert response.status_code == 401
            challenge = response.headers["www-authenticate"]
            assert 'error="invalid_token"' in challenge
            assert 'resource_metadata="https://litigaforge.com/.well-known/oauth-protected-resource"' in challenge

    # V1 public methods remain anonymously accessible when v2 is disabled.
    assert client.post("/mcp", json=_rpc("ping")).status_code == 200
    assert client.post("/mcp", json=_rpc("tools/list")).status_code == 200
    assert client.post("/mcp", json=_rpc("initialize")).status_code == 401


def test_unknown_method_and_notifications_keep_jsonrpc_http_contract(monkeypatch):
    monkeypatch.setattr(mcp_v2, "enabled", lambda: False)
    unknown = client.post("/mcp", json=_rpc("not/a/method"))
    assert unknown.status_code == 200
    assert unknown.json()["error"]["code"] == -32601
    notification = client.post(
        "/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"}
    )
    assert notification.status_code == 202
    assert notification.content == b""


def test_valid_v2_bearer_audience_mismatch_is_rejected(monkeypatch):
    monkeypatch.setattr(mcp_v2, "enabled", lambda: True)
    token = "lfo_test-token"
    async def fetchrow(*_args):
        return {"token_hash": mcp_v2._hash(token), "resource": "https://other.example/mcp",
                "id": 1, "email": "x@example.test", "name": "X", "role": "client"}
    monkeypatch.setattr(mcp_v2, "fetchrow", fetchrow)
    response = client.post("/mcp", json=_rpc("initialize"),
                           headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert 'error="invalid_token"' in response.headers["www-authenticate"]


def test_tool_errors_are_results_not_jsonrpc_failures(monkeypatch):
    monkeypatch.setattr(mcp_v2, "enabled", lambda: True)
    monkeypatch.setattr(mcp_v2, "authenticate_bearer", lambda _r: asyncio.sleep(0, result={}))
    monkeypatch.setattr(mcp_v2, "verify_bearer", lambda *_a: asyncio.sleep(0, result=({"id": 1}, None, 1)))
    monkeypatch.setattr(mcp_v2, "ik_spend_today", lambda: asyncio.sleep(0, result=0))
    monkeypatch.setattr(mcp_v2, "audit_call", lambda *_a, **_k: asyncio.sleep(0))
    async def disabled(*_args):
        return mcp_v2.public_result({"status": "unavailable", "reason": "Indian Kanoon is disabled"},
                                    source="Indian Kanoon", source_url=None, identifier="test")
    monkeypatch.setattr(mcp_v2, "call_tool", disabled)
    headers = {"Authorization": "Bearer lfm_test", "MCP-Protocol-Version": "2025-06-18"}
    result = client.post("/mcp", json=_rpc("tools/call", {
        "name": "judgment_passages", "arguments": {"doc_id": "12", "query": "test"}
    }), headers=headers)
    assert result.status_code == 200
    assert "error" not in result.json()
    assert result.json()["result"]["isError"] is True
    assert "Indian Kanoon is disabled" in result.json()["result"]["content"][0]["text"]

    async def quota(*_args):
        raise HTTPException(429, detail={"code": "daily_quota_exceeded",
                                         "message": "Daily MCP plan limit reached."})
    monkeypatch.setattr(mcp_v2, "verify_bearer", quota)
    denied = client.post("/mcp", json=_rpc("tools/call", {"name": "my_cases", "arguments": {}}),
                         headers=headers)
    assert denied.status_code == 200
    assert denied.json()["result"]["isError"] is True
    assert "Daily MCP plan limit reached" in denied.json()["result"]["content"][0]["text"]


def test_timeout_is_readable_tool_error(monkeypatch):
    monkeypatch.setattr(mcp_v2, "enabled", lambda: True)
    monkeypatch.setattr(mcp_v2, "authenticate_bearer", lambda _r: asyncio.sleep(0, result={}))
    monkeypatch.setattr(mcp_v2, "verify_bearer", lambda *_a: asyncio.sleep(0, result=({"id": 1}, None, 1)))
    monkeypatch.setattr(mcp_v2, "ik_spend_today", lambda: asyncio.sleep(0, result=0))
    monkeypatch.setattr(mcp_v2, "audit_call", lambda *_a, **_k: asyncio.sleep(0))
    async def timeout(*_args):
        raise asyncio.TimeoutError()
    monkeypatch.setattr(mcp_v2, "call_tool", timeout)
    response = client.post("/mcp", json=_rpc("tools/call", {"name": "my_cases", "arguments": {}}),
                           headers={"Authorization": "Bearer lfm_test",
                                    "MCP-Protocol-Version": "2025-06-18"})
    assert response.status_code == 200
    assert response.json()["result"]["isError"] is True
    assert "timed out" in response.json()["result"]["content"][0]["text"]


def test_each_tool_response_has_structured_and_linked_text():
    result = mcp._tool_result({"data": {"count": 2}, "source": "Indian court index",
                               "source_url": "https://example.test/cases"})
    assert result["structuredContent"]["source"] == "Indian court index"
    assert result["content"][0]["type"] == "text"
    assert "https://example.test/cases" in result["content"][0]["text"]


def test_tools_have_titles_jurisdiction_and_open_world_annotations():
    for tool in mcp._TOOLS + mcp_v2.TOOL_LIST:
        assert tool["title"]
        assert tool["annotations"]["title"]
        assert tool["annotations"]["readOnlyHint"] is True
        assert len(tool["description"]) < 1024
    for tool in mcp_v2.TOOL_LIST:
        if tool["name"] in mcp_v2._OPEN_WORLD_TOOLS:
            assert tool["annotations"]["openWorldHint"] is True
