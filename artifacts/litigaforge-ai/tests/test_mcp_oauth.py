import asyncio
import base64
import hashlib
import importlib.util
from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
SPEC = importlib.util.spec_from_file_location(
    "mcp_oauth_test_module", ROOT / "routers" / "mcp_oauth.py"
)
oauth = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(oauth)
app = FastAPI()
app.include_router(oauth.router)
client = TestClient(app)


def test_discovery_metadata_uses_public_proxy_origin():
    resource = client.get(
        "/.well-known/oauth-protected-resource",
        headers={"x-forwarded-host": "preview.example", "x-forwarded-proto": "https"},
    ).json()
    server = client.get(
        "/.well-known/oauth-authorization-server",
        headers={"x-forwarded-host": "preview.example", "x-forwarded-proto": "https"},
    ).json()
    assert resource["resource"] == "https://preview.example/mcp"
    assert server["issuer"] == "https://preview.example"
    assert server["code_challenge_methods_supported"] == ["S256"]
    assert server["registration_endpoint"] == "https://preview.example/api/oauth/register"


def test_dcr_rejects_non_loopback_http_and_registers_public_client(monkeypatch):
    monkeypatch.setenv("MCP_V2_ENABLED", "true")
    monkeypatch.setattr(oauth, "execute", lambda *args: asyncio.sleep(0))
    bad = client.post(
        "/oauth/register",
        json={"redirect_uris": ["http://attacker.example/callback"]},
    )
    assert bad.status_code == 400
    created = client.post(
        "/oauth/register",
        json={
            "client_name": "Evaluation client",
            "redirect_uris": ["https://client.example/callback"],
            "grant_types": ["authorization_code"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        },
    )
    assert created.status_code == 201
    assert created.json()["client_id"]
    assert created.json()["token_endpoint_auth_method"] == "none"


def test_token_exchange_verifies_pkce_and_issues_expiring_bearer(monkeypatch):
    monkeypatch.setenv("MCP_V2_ENABLED", "true")
    verifier = "V" * 43
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    reads = iter([
        {"user_id": 27, "code_challenge": challenge},
        {"user_id": 27},
    ])
    stored = []

    async def fake_fetchrow(*_args):
        return next(reads)

    async def fake_execute(*args):
        stored.append(args)

    monkeypatch.setattr(oauth, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(oauth, "execute", fake_execute)
    response = client.post(
        "/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": "public-client",
            "code": "one-time-code",
            "redirect_uri": "https://client.example/callback",
            "code_verifier": verifier,
        },
    )
    assert response.status_code == 200
    assert response.json()["token_type"] == "Bearer"
    assert response.json()["expires_in"] == 3600
    assert response.json()["access_token"].startswith("lfo_")
    assert len(stored) == 1


def test_token_exchange_rejects_wrong_pkce_without_consuming_code(monkeypatch):
    monkeypatch.setenv("MCP_V2_ENABLED", "true")
    claimed = False

    async def fake_fetchrow(*_args):
        nonlocal claimed
        claimed = True
        return {"user_id": 27, "code_challenge": "A" * 43}

    monkeypatch.setattr(oauth, "fetchrow", fake_fetchrow)
    response = client.post(
        "/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": "public-client",
            "code": "one-time-code",
            "redirect_uri": "https://client.example/callback",
            "code_verifier": "V" * 43,
        },
    )
    assert response.status_code == 400
    assert "PKCE verification failed" in response.text
    assert claimed
