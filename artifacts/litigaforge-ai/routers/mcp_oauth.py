"""OAuth 2.0 authorization-code + PKCE endpoints for the MCP resource."""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import secrets
from datetime import datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from database import execute, fetchrow

router = APIRouter(tags=["mcp-oauth"])
API_PREFIX = "/api"
_S256 = re.compile(r"^[A-Za-z0-9_-]{43}$")
_VERIFIER = re.compile(r"^[A-Za-z0-9._~-]{43,128}$")


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _public_base(request: Request) -> str:
    configured = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")
    if configured:
        return configured
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    scheme = request.headers.get("x-forwarded-proto", "https").split(",", 1)[0].strip().lower()
    if not host or any(c in host for c in "\r\n/@") or scheme not in {"http", "https"}:
        raise HTTPException(400, "Cannot determine public OAuth issuer")
    return f"{scheme}://{host}"


def _valid_redirect(uri: str) -> bool:
    try:
        parsed = urlsplit(uri)
        if parsed.scheme == "https" and parsed.hostname and parsed.username is None and parsed.password is None:
            return bool(parsed.netloc) and not parsed.fragment
        return (
            parsed.scheme == "http"
            and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
            and parsed.port is not None
            and parsed.username is None
            and parsed.password is None
            and not parsed.fragment
        )
    except ValueError:
        return False


def _append_query(uri: str, pairs: list[tuple[str, str]]) -> str:
    parts = urlsplit(uri)
    query = parse_qsl(parts.query, keep_blank_values=True)
    query.extend(pairs)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _require_enabled() -> None:
    if os.getenv("MCP_V2_ENABLED", "false").strip().lower() not in {"1", "true", "yes", "on"}:
        raise HTTPException(404, "MCP v2 is disabled")


@router.get("/.well-known/oauth-protected-resource")
async def protected_resource_metadata(request: Request):
    base = _public_base(request)
    return {
        "resource": f"{base}/mcp",
        "authorization_servers": [base],
        "scopes_supported": ["mcp:read"],
        "bearer_methods_supported": ["header"],
    }


@router.get("/.well-known/oauth-authorization-server")
async def authorization_server_metadata(request: Request):
    base = _public_base(request)
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}{API_PREFIX}/oauth/authorize",
        "token_endpoint": f"{base}{API_PREFIX}/oauth/token",
        "registration_endpoint": f"{base}{API_PREFIX}/oauth/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": ["mcp:read"],
    }


@router.post("/oauth/register")
async def register_client(request: Request):
    _require_enabled()
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "Expected a JSON object")
    redirects = body.get("redirect_uris")
    if (
        not isinstance(redirects, list) or not redirects or len(redirects) > 20
        or any(not isinstance(uri, str) or not _valid_redirect(uri) for uri in redirects)
        or len(set(redirects)) != len(redirects)
    ):
        raise HTTPException(400, "redirect_uris must contain valid HTTPS or loopback redirect URIs")
    grant_types = body.get("grant_types", ["authorization_code"])
    response_types = body.get("response_types", ["code"])
    if grant_types != ["authorization_code"] or response_types != ["code"]:
        raise HTTPException(400, "Only authorization_code with response_type=code is supported")
    if body.get("token_endpoint_auth_method", "none") != "none":
        raise HTTPException(400, "Public clients must use token_endpoint_auth_method=none")
    name = str(body.get("client_name") or "MCP client").strip()[:120] or "MCP client"
    client_id = secrets.token_urlsafe(24)
    await execute(
        "INSERT INTO mcp_oauth_clients(client_id,client_name,redirect_uris) VALUES($1,$2,$3::jsonb)",
        client_id, name, json.dumps(redirects),
    )
    return JSONResponse({
        "client_id": client_id,
        "client_name": name,
        "redirect_uris": redirects,
        "grant_types": grant_types,
        "response_types": response_types,
        "token_endpoint_auth_method": "none",
        "client_id_issued_at": int(datetime.utcnow().timestamp()),
        "scope": "mcp:read",
    }, status_code=201, headers={"Cache-Control": "no-store"})


async def _client_and_challenge(client_id: str, redirect_uri: str, challenge: str, method: str):
    if method != "S256" or not _S256.fullmatch(challenge):
        raise HTTPException(400, "A valid S256 PKCE code challenge is required")
    client = await fetchrow("SELECT client_name,redirect_uris FROM mcp_oauth_clients WHERE client_id=$1", client_id)
    registered = client["redirect_uris"] if client else []
    if isinstance(registered, str):
        try:
            registered = json.loads(registered)
        except json.JSONDecodeError:
            registered = []
    if not client or redirect_uri not in registered:
        raise HTTPException(400, "Unknown client or redirect URI")
    return client


@router.get("/oauth/authorize", response_class=HTMLResponse)
async def authorize_page(
    client_id: str, redirect_uri: str, state: str, code_challenge: str,
    code_challenge_method: str, response_type: str = "code", scope: str = "mcp:read",
):
    _require_enabled()
    if response_type != "code" or scope != "mcp:read" or not state or len(state) > 512:
        raise HTTPException(400, "Invalid OAuth authorization request")
    client = await _client_and_challenge(client_id, redirect_uri, code_challenge, code_challenge_method)
    fields = {
        "client_id": client_id, "redirect_uri": redirect_uri, "state": state,
        "code_challenge": code_challenge, "code_challenge_method": code_challenge_method,
        "response_type": response_type, "scope": scope,
    }
    hidden = "".join(
        f'<input type="hidden" name="{html.escape(k)}" value="{html.escape(v, quote=True)}">'
        for k, v in fields.items()
    )
    page = (
        "<!doctype html><html><head><meta charset=utf-8><meta name=viewport "
        "content='width=device-width,initial-scale=1'><title>Connect LitigaForge</title></head>"
        "<body style='font:16px system-ui;max-width:30rem;margin:4rem auto;padding:1rem'>"
        "<h1>Authorize MCP access</h1><p><strong>" + html.escape(client["client_name"]) +
        "</strong> requests read-only legal research access to your LitigaForge account.</p>"
        "<p>Only your tracked cases and public legal references are available. The access token "
        "expires automatically after one hour.</p><form method=post action='" +
        API_PREFIX + "/oauth/authorize'>" + hidden +
        "<label>Email<br><input name=email type=email required autocomplete=username></label><br><br>"
        "<label>Password<br><input name=password type=password required autocomplete=current-password></label><br><br>"
        "<button type=submit>Authorize read-only access</button></form></body></html>"
    )
    return HTMLResponse(page, headers={"Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"} )


@router.post("/oauth/authorize")
async def authorize_submit(request: Request):
    _require_enabled()
    form = await request.form()
    client_id = str(form.get("client_id") or "")
    redirect_uri = str(form.get("redirect_uri") or "")
    state = str(form.get("state") or "")
    challenge = str(form.get("code_challenge") or "")
    method = str(form.get("code_challenge_method") or "")
    if (
        form.get("response_type") != "code" or form.get("scope") != "mcp:read"
        or not state or len(state) > 512
    ):
        raise HTTPException(400, "Invalid OAuth authorization request")
    await _client_and_challenge(client_id, redirect_uri, challenge, method)
    from database import fetchrow as db_fetchrow
    from auth import verify_password
    user = await db_fetchrow(
        "SELECT id,email,password_hash,must_change_password,is_demo,role FROM users WHERE LOWER(email)=LOWER($1)",
        str(form.get("email") or "").strip(),
    )
    if not user or user.get("must_change_password") or not verify_password(
        str(form.get("password") or ""), str(user["password_hash"])
    ):
        raise HTTPException(401, "Invalid account credentials")
    from runtime_env import is_production, is_seed_advocate_email
    if is_production() and (
        user.get("is_demo")
        or user.get("role") in ("advocate", "lawyer") and is_seed_advocate_email(user.get("email", ""))
    ):
        raise HTTPException(403, "Demo advocate accounts are disabled in production")
    code = secrets.token_urlsafe(32)
    await execute(
        """INSERT INTO mcp_oauth_codes(code_hash,client_id,user_id,redirect_uri,code_challenge,expires_at)
           VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '5 minutes')""",
        _digest(code), client_id, int(user["id"]), redirect_uri, challenge,
    )
    return RedirectResponse(_append_query(redirect_uri, [("code", code), ("state", state)]), status_code=303,
                            headers={"Cache-Control": "no-store"})


@router.post("/oauth/token")
async def token_exchange(request: Request):
    _require_enabled()
    form = await request.form()
    if form.get("grant_type") != "authorization_code":
        raise HTTPException(400, "Unsupported grant_type")
    client_id = str(form.get("client_id") or "")
    code = str(form.get("code") or "")
    redirect_uri = str(form.get("redirect_uri") or "")
    verifier = str(form.get("code_verifier") or "")
    if not _VERIFIER.fullmatch(verifier):
        raise HTTPException(400, "Invalid PKCE code_verifier")
    row = await fetchrow(
        """SELECT user_id,code_challenge FROM mcp_oauth_codes
           WHERE code_hash=$1 AND client_id=$2 AND redirect_uri=$3 AND expires_at>NOW()
             AND used_at IS NULL""",
        _digest(code), client_id, redirect_uri,
    )
    if not row:
        raise HTTPException(400, "Invalid or expired authorization code")
    import base64
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    if not secrets.compare_digest(challenge, str(row["code_challenge"])):
        raise HTTPException(400, "PKCE verification failed")
    claimed = await fetchrow(
        """UPDATE mcp_oauth_codes SET used_at=NOW()
           WHERE code_hash=$1 AND client_id=$2 AND redirect_uri=$3 AND expires_at>NOW()
             AND used_at IS NULL RETURNING user_id""",
        _digest(code), client_id, redirect_uri,
    )
    if not claimed:
        raise HTTPException(400, "Authorization code has already been used")
    token = "lfo_" + secrets.token_urlsafe(32)
    await execute(
        """INSERT INTO mcp_oauth_access_tokens(token_hash,token_prefix,client_id,user_id,expires_at)
           VALUES($1,$2,$3,$4,NOW()+INTERVAL '1 hour')""",
        _digest(token), token[:12], client_id, int(row["user_id"]),
    )
    return JSONResponse({
        "access_token": token, "token_type": "Bearer", "expires_in": 3600,
        "scope": "mcp:read",
    }, headers={"Cache-Control": "no-store", "Pragma": "no-cache"})
