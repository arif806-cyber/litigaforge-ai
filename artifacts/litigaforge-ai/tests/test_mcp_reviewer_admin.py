import sys
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient


BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from routers import auth as auth_router
from routers import mcp_v2


ADMIN = {"id": 7, "email": "admin@example.test", "is_superuser": True}


def _client_for(user=ADMIN):
    app = FastAPI()
    app.include_router(mcp_v2.router)
    if user is None:
        def reject_non_admin():
            raise HTTPException(status_code=403, detail="Admin access required")

        app.dependency_overrides[mcp_v2.get_superuser] = reject_non_admin
    else:
        app.dependency_overrides[mcp_v2.get_superuser] = lambda: user
    return TestClient(app)


def _mock_reviewer_dependencies(monkeypatch, existing_account=None):
    monkeypatch.setenv("MCP_V2_ENABLED", "true")
    monkeypatch.setattr(mcp_v2, "ensure_schema", lambda: _async_result(None))
    monkeypatch.setattr(
        mcp_v2,
        "fetchrow",
        lambda query, *_args: _async_result(
            existing_account if "SELECT id,is_superuser,is_demo FROM users" in query
            else {"id": 42}
        ),
    )
    monkeypatch.setattr(mcp_v2, "execute", lambda *_args: _async_result(None))
    monkeypatch.setattr(
        mcp_v2,
        "grant_reviewer",
        lambda *_args: _async_result({"expires_in_days": 30}),
    )
    monkeypatch.setattr(
        auth_router,
        "_create_password_reset_token",
        lambda user_id: _async_result("reviewer-reset-token"),
    )
    monkeypatch.setattr(
        auth_router,
        "_frontend_account_url",
        lambda path, token: f"https://example.test{path}?token={token}",
    )


async def _async_result(value):
    return value


def test_admin_can_create_mcp_reviewer_with_setup_link_and_all_tools(monkeypatch):
    _mock_reviewer_dependencies(monkeypatch)

    response = _client_for().post(
        "/admin/mcp-reviewers",
        json={"email": "reviewer@example.test"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["plan"] == "reviewer"
    assert "reviewer-reset-token" in body["setup_url"]
    assert len(body["tools"]) == 14
    assert body["tools"] == mcp_v2._ALL_MCP_TOOLS


def test_non_admin_cannot_create_mcp_reviewer(monkeypatch):
    _mock_reviewer_dependencies(monkeypatch)

    response = _client_for(user=None).post(
        "/admin/mcp-reviewers",
        json={"email": "reviewer@example.test"},
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    "account",
    [
        {"id": 8, "is_superuser": True, "is_demo": False},
        {"id": 9, "is_superuser": False, "is_demo": True},
    ],
    ids=["admin-account", "demo-account"],
)
def test_admin_cannot_invite_admin_or_demo_account(monkeypatch, account):
    _mock_reviewer_dependencies(monkeypatch, existing_account=account)

    response = _client_for().post(
        "/admin/mcp-reviewers",
        json={"email": "existing@example.test"},
    )

    assert response.status_code == 409
