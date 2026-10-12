import asyncio
import os
import sys
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import auth
from routers import workspace
from demo_workspace import DEMO_DESCRIPTION, DEMO_DOCUMENTS, DEMO_NODES


def test_demo_fixture_is_explicitly_fictional_and_has_sample_documents():
    assert "FICTIONAL" in DEMO_DESCRIPTION
    assert len(DEMO_DOCUMENTS) >= 2
    assert all("FICTIONAL TRAINING DOCUMENT" in text for text in DEMO_DOCUMENTS.values())
    assert all(node["type"] != "judgment" for node in DEMO_NODES)


def test_demo_users_cannot_use_billing_dependencies():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth.require_non_demo_user({"id": 42, "is_demo": True}))
    assert exc.value.status_code == 403


def test_real_user_cannot_call_demo_reset(monkeypatch):
    pool = AsyncMock()
    monkeypatch.setattr(workspace, "get_pool", pool)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(workspace.reset_demo_workspace(object(), {"id": 99, "is_demo": False}))
    assert exc.value.status_code == 403
    pool.assert_not_awaited()


def test_workspace_session_lookup_is_scoped_to_authenticated_owner(monkeypatch):
    class Acquire:
        async def __aenter__(self):
            return conn

        async def __aexit__(self, *_args):
            return None

    class Pool:
        def acquire(self):
            return Acquire()

    conn = type("Conn", (), {})()
    conn.fetchrow = AsyncMock(return_value=None)
    monkeypatch.setattr(workspace, "get_pool", AsyncMock(return_value=Pool()))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(workspace.get_session(812, object(), {"id": 29, "is_demo": True}))
    assert exc.value.status_code == 404
    assert conn.fetchrow.await_args.args[-2:] == (812, 29)


def test_temporary_password_blocks_regular_authenticated_api_calls(monkeypatch):
    monkeypatch.setattr(auth, "decode_token", lambda token: 7)
    monkeypatch.setattr(
        auth, "get_user_by_id",
        AsyncMock(return_value={"id": 7, "must_change_password": True}),
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth.require_user("valid-cookie-token"))
    assert exc.value.status_code == 403
