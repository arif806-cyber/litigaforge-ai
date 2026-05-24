"""Tests for auth router — uses FastAPI TestClient with in-memory DB mocking."""
import os
import sys
import pytest
from unittest.mock import AsyncMock, patch

# Point to backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["SESSION_SECRET"] = "test-secret-123456789012345678901234567890"
os.environ["DATABASE_URL"] = "postgresql://test:test@localhost/test"
os.environ["BASE_PATH"] = ""

from main import app


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(app)


# ── Health / Root ──────────────────────────────────────────────────────────

def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "ai_mode" in data


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "LitigaForge AI"


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
    assert "token" in data


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
    assert "token" in data


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
