"""Tests for auth router — uses FastAPI TestClient with in-memory DB mocking."""
import os
import sys
import pytest
from unittest.mock import AsyncMock, patch

# Point to backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["SESSION_SECRET"] = "test-secret-123456789012345678901234567890"
os.environ["BASE_PATH"] = ""

from main import app
from routers import auth as auth_router
import auth as token_auth


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture(autouse=True)
def isolate_auth_side_effects(monkeypatch):
    monkeypatch.setattr(auth_router, "store_refresh_token", AsyncMock())
    monkeypatch.setattr(auth_router, "db_fetchrow", AsyncMock(return_value=None))
    monkeypatch.setattr(
        auth_router, "_create_verification_token",
        AsyncMock(return_value="test-verification-token"),
    )
    monkeypatch.setattr(auth_router, "_send_verification_email", AsyncMock(return_value=False))


def _assert_http_only_session_cookies(response):
    cookies = [header.lower() for header in response.headers.get_list("set-cookie")]
    assert any(cookie.startswith("lf_token=") and "httponly" in cookie for cookie in cookies)
    assert any(cookie.startswith("lf_refresh=") and "httponly" in cookie for cookie in cookies)


# ── Health / Root ──────────────────────────────────────────────────────────

def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["service"] == "litigaforge-ai"


def test_root_is_not_an_api_route(client):
    r = client.get("/")
    assert r.status_code == 404


# ── Auth ────────────────────────────────────────────────────────────────────

@patch("routers.auth.create_user")
def test_register_success(mock_create_user, client):
    mock_create_user.return_value = {
        "id": 1, "email": "test@example.com", "name": "Test User",
        "subscription_tier": "free", "role": "client", "created_at": "2024-01-01"
    }
    r = client.post(
        "/auth/register",
        json={"name": "Test User", "email": "test@example.com", "password": "password123", "role": "client"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["email"] == "test@example.com"
    assert "token" not in data
    _assert_http_only_session_cookies(r)


def test_register_short_password(client):
    r = client.post(
        "/auth/register",
        json={"name": "Test", "email": "test@example.com", "password": "short", "role": "client"},
    )
    assert r.status_code == 400
    assert "at least 8 characters" in r.json()["detail"]


def test_register_invalid_email(client):
    r = client.post(
        "/auth/register",
        json={"name": "Test", "email": "not-an-email", "password": "password123", "role": "client"},
    )
    assert r.status_code == 422


@patch("routers.auth.get_user_by_email")
@patch("routers.auth.verify_password")
def test_login_success(mock_verify, mock_get_user, client):
    mock_get_user.return_value = {
        "id": 1, "email": "test@example.com", "name": "Test",
        "password_hash": "hashed", "subscription_tier": "free", "role": "client",
    }
    mock_verify.return_value = True
    r = client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["email"] == "test@example.com"
    assert "token" not in data
    assert data["user"]["has_lawyer_profile"] is False
    _assert_http_only_session_cookies(r)


@patch("routers.auth.get_user_by_email")
def test_login_wrong_password(mock_get_user, client):
    mock_get_user.return_value = None
    r = client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "wrong"},
    )
    assert r.status_code == 401


def test_logout(client):
    r = client.post("/auth/logout")
    assert r.status_code == 200
    assert "logged out" in r.json()["message"].lower()


@pytest.mark.parametrize("role", ["client", "advocate"])
def test_registration_persists_role_and_supports_session_refresh_logout_and_login(
    role, client, monkeypatch
):
    """Exercise real hashing/JWT/cookie endpoints with an isolated test store."""
    auth_router.limiter.reset()
    users = {}
    refresh_tokens = {}
    ids = iter(range(1000, 1010))
    test_headers = {
        "cf-connecting-ip": "198.51.100.21" if role == "client" else "198.51.100.22"
    }

    async def create_user(*, email, name, password_hash, role):
        normalized = email.lower().strip()
        if normalized in users:
            raise ValueError("Email already registered")
        user = {
            "id": next(ids), "email": normalized, "name": name,
            "password_hash": password_hash, "subscription_tier": "free",
            "cases_this_month": 0, "month_reset_date": "2026-10-01",
            "is_superuser": False, "role": role, "email_verified": False,
            "is_profile_public": False, "preferred_language": "en",
            "is_demo": False, "must_change_password": False,
            "created_at": "2026-10-13",
        }
        users[normalized] = user
        return {key: value for key, value in user.items() if key != "password_hash"}

    async def get_by_email(email):
        user = users.get(email.lower().strip())
        return user.copy() if user else None

    async def get_by_id(user_id):
        return next(
            ({key: value for key, value in user.items() if key != "password_hash"}
             for user in users.values() if user["id"] == user_id),
            None,
        )

    async def store_refresh(user_id, token, expires_at):
        refresh_tokens[token] = {"user_id": user_id, "expires_at": expires_at}

    async def get_refresh(token):
        row = refresh_tokens.get(token)
        return row.copy() if row else None

    async def delete_refresh(token):
        refresh_tokens.pop(token, None)

    monkeypatch.setattr(auth_router, "create_user", create_user)
    monkeypatch.setattr(auth_router, "get_user_by_email", get_by_email)
    monkeypatch.setattr(auth_router, "get_user_by_id", get_by_id)
    monkeypatch.setattr(token_auth, "get_user_by_id", get_by_id)
    monkeypatch.setattr(auth_router, "store_refresh_token", store_refresh)
    monkeypatch.setattr(auth_router, "get_refresh_token", get_refresh)
    monkeypatch.setattr(auth_router, "delete_refresh_token", delete_refresh)
    monkeypatch.setattr(auth_router, "db_fetchrow", AsyncMock(return_value=None))
    from routers import subscription as subscription_router
    monkeypatch.setattr(
        subscription_router, "expire_subscription_for_user", AsyncMock(return_value=None)
    )

    email = f"auth-flow-{role}@litigaforge.test"
    payload = {
        "name": f"Test {role.title()}", "email": email,
        "password": "LocalTest123!", "role": role,
    }
    registered = client.post("/auth/register", json=payload)
    assert registered.status_code == 200
    assert registered.json()["user"]["role"] == role
    assert email in users
    _assert_http_only_session_cookies(registered)

    assert client.get("/auth/me").json()["email"] == email
    first_refresh = registered.cookies.get("lf_refresh")
    assert first_refresh in refresh_tokens
    refreshed = client.post("/auth/refresh", cookies={"lf_refresh": first_refresh})
    assert refreshed.status_code == 200
    rotated_refresh = refreshed.cookies.get("lf_refresh")
    assert rotated_refresh and rotated_refresh != first_refresh
    assert first_refresh not in refresh_tokens

    duplicate = client.post("/auth/register", json=payload)
    assert duplicate.status_code == 409
    bad_password = client.post(
        "/auth/login",
        json={"email": email, "password": "WrongPassword!", "role": role},
        headers=test_headers,
    )
    assert bad_password.status_code == 401

    logged_out = client.post("/auth/logout", cookies={"lf_refresh": rotated_refresh})
    assert logged_out.status_code == 200
    assert rotated_refresh not in refresh_tokens
    assert client.get("/auth/me").status_code == 401

    logged_in = client.post(
        "/auth/login",
        json={"email": email, "password": payload["password"], "role": role},
        headers=test_headers,
    )
    assert logged_in.status_code == 200
    assert logged_in.json()["user"]["role"] == role
    assert client.get("/auth/me").json()["email"] == email
