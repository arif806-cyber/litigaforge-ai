import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException, Response

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("SESSION_SECRET", "test-secret-123456789012345678901234567890")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")


@pytest.mark.parametrize("marker", ["environment", "deployment"])
def test_demo_seed_script_refuses_production(monkeypatch, marker):
    from scripts import seed_demo_advocate

    monkeypatch.setenv("APP_ENV", "development")
    if marker == "environment":
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.delenv("REPLIT_DEPLOYMENT", raising=False)
    else:
        monkeypatch.setenv("REPLIT_DEPLOYMENT", "1")
        monkeypatch.delenv("ENVIRONMENT", raising=False)
    with pytest.raises(SystemExit, match="development-only"):
        asyncio.run(seed_demo_advocate.main())


@pytest.mark.asyncio
async def test_demo_advocate_login_is_blocked_in_production(monkeypatch):
    from routers import auth as auth_router

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("REPLIT_DEPLOYMENT", "1")
    user = {
        "id": 55, "email": "demo@litigaforge.local", "name": "Demo Advocate",
        "password_hash": "hash", "role": "advocate", "is_demo": True,
    }
    with patch.object(auth_router, "get_user_by_email", AsyncMock(return_value=user)), \
         patch.object(auth_router, "verify_password", return_value=True), \
         patch.object(auth_router, "_issue_tokens", AsyncMock()) as issue:
        with pytest.raises(HTTPException) as exc:
            await auth_router.login.__wrapped__(
                auth_router.LoginRequest(email=user["email"], password="password"),
                None, Response(),
            )
    assert exc.value.status_code == 403
    issue.assert_not_awaited()


@pytest.mark.asyncio
async def test_seed_advocate_registration_is_blocked_in_production(monkeypatch):
    from routers import auth as auth_router

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DEMO_ADVOCATE_EMAIL", "seed@litigaforge.test")
    request = auth_router.RegisterRequest(
        name="Seed Advocate", email="seed@litigaforge.test",
        password="safe-password-for-test", role="advocate",
    )
    with pytest.raises(HTTPException) as exc:
        await auth_router.register.__wrapped__(request, None, Response())
    assert exc.value.status_code == 403


def test_test_or_seed_guard_refuses_production_database(monkeypatch):
    from runtime_env import assert_development_database

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("REPLIT_DEPLOYMENT", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.setenv("PGDATABASE", "heliumdb")
    monkeypatch.setenv("DATABASE_URL", "postgresql://unused:unused@db.invalid/neondb")
    with pytest.raises(RuntimeError, match="production"):
        assert_development_database()


@pytest.mark.asyncio
async def test_test_identity_registration_refused_for_production_database(monkeypatch):
    from routers import auth as auth_router

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("REPLIT_DEPLOYMENT", raising=False)
    monkeypatch.setenv("PGDATABASE", "heliumdb")
    monkeypatch.setenv("DATABASE_URL", "postgresql://unused:unused@db.invalid/neondb")
    request = auth_router.RegisterRequest(
        name="Test User", email="test_abcdef@litigaforge.test",
        password="safe-password-for-test", role="client",
    )
    with pytest.raises(HTTPException) as exc:
        await auth_router.register.__wrapped__(request, None, Response())
    assert exc.value.status_code == 403
