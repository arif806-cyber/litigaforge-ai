"""Focused regressions for authentication, privacy, and erasure boundaries."""
from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock

import pytest
from fastapi import Response
from starlette.requests import Request


def _request() -> Request:
    return Request({"type": "http", "method": "POST", "path": "/", "headers": []})

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class _Txn:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class _Conn:
    def __init__(self):
        self.queries: list[str] = []

    def transaction(self):
        return _Txn()

    async def execute(self, query, *args):
        self.queries.append(query)
        return "OK"


class _Acquire:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *args):
        return False


class _Pool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        return _Acquire(self.conn)


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["client", "advocate"])
async def test_account_erasure_removes_threads_before_both_side_matches(monkeypatch, role):
    import routers.auth as auth_router

    conn = _Conn()
    monkeypatch.setattr(auth_router, "db_fetch", AsyncMock(return_value=[]))
    monkeypatch.setattr(auth_router, "get_pool", AsyncMock(return_value=_Pool(conn)))
    monkeypatch.setattr(auth_router, "delete_all_user_refresh_tokens", AsyncMock())
    monkeypatch.setattr(auth_router, "get_user_by_id", AsyncMock(return_value={"id": 42}))

    await auth_router.delete_account(_request(), Response(), {"id": 42, "role": role})

    thread_index = next(i for i, q in enumerate(conn.queries) if "DELETE FROM chat_threads" in q)
    match_index = next(i for i, q in enumerate(conn.queries) if "DELETE FROM matches" in q)
    assert thread_index < match_index
    assert "LEFT JOIN lawyers" in conn.queries[thread_index]
    assert any("DELETE FROM refresh_tokens" in q for q in conn.queries)
    detach_index = next(i for i, q in enumerate(conn.queries) if "UPDATE client_documents SET case_id = NULL" in q)
    lawyer_docs_index = next(i for i, q in enumerate(conn.queries) if "DELETE FROM lawyer_documents" in q)
    lawyer_cases_index = next(i for i, q in enumerate(conn.queries) if "DELETE FROM lawyer_cases WHERE lawyer_id" in q)
    lawyer_profile_index = next(i for i, q in enumerate(conn.queries) if "DELETE FROM lawyers WHERE user_id" in q)
    user_index = next(i for i, q in enumerate(conn.queries) if "DELETE FROM users" in q)
    assert detach_index < lawyer_cases_index < lawyer_profile_index < user_index
    assert lawyer_docs_index < lawyer_cases_index


@pytest.mark.asyncio
async def test_me_reloads_user_after_current_user_expiry_check(monkeypatch):
    import routers.auth as auth_router

    fresh = {"id": 7, "subscription_tier": "free"}
    expire = AsyncMock(return_value=1)
    reload_user = AsyncMock(return_value=fresh)
    monkeypatch.setattr("routers.subscription.expire_subscription_for_user", expire)
    monkeypatch.setattr(auth_router, "get_user_by_id", reload_user)

    result = await auth_router.me({"id": 7, "subscription_tier": "professional"})
    expire.assert_awaited_once_with(7)
    reload_user.assert_awaited_once_with(7)
    assert result == fresh


@pytest.mark.asyncio
async def test_login_normalizes_email_before_lookup(monkeypatch):
    import routers.auth as auth_router

    user = {"id": 3, "email": "person@example.com", "password_hash": "hash"}
    lookup = AsyncMock(return_value=user)
    monkeypatch.setattr(auth_router, "get_user_by_email", lookup)
    monkeypatch.setattr(auth_router, "verify_password", lambda *_: True)
    monkeypatch.setattr(auth_router, "_issue_tokens", AsyncMock(return_value="token"))

    await auth_router.login(
        auth_router.LoginRequest(email="  PERSON@Example.COM ", password="password"),
        _request(),
        Response(),
    )
    lookup.assert_awaited_once_with("person@example.com")


@pytest.mark.asyncio
async def test_social_login_fails_closed_without_provider_ids(monkeypatch):
    import routers.auth as auth_router

    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("APPLE_CLIENT_ID", raising=False)
    with pytest.raises(Exception) as google:
        request = _request()
        request._body = b'{"credential":"x"}'
        await auth_router.google_oauth(request, Response())
    assert "not configured" in str(google.value).lower()
    with pytest.raises(Exception) as apple:
        await auth_router.apple_login(
            auth_router.AppleLoginRequest(id_token="x", role="client"),
            _request(),
            Response(),
        )
    assert "not configured" in str(apple.value).lower()


@pytest.mark.asyncio
async def test_case_list_requires_verified_advocate_and_hides_anonymous_details(monkeypatch):
    import routers.matching as matching_router

    fetch = AsyncMock(return_value=[])
    monkeypatch.setattr(matching_router, "fetchrow", AsyncMock(return_value={"id": 12}))
    monkeypatch.setattr(matching_router, "fetch", fetch)
    await matching_router.list_case_requirements(
        {"id": 9, "role": "advocate"}
    )
    query = fetch.await_args.args[0]
    verification_query = matching_router.fetchrow.await_args.args[0]
    assert "verification_status = 'verified'" in verification_query
    assert "CASE WHEN NOT is_anonymous" in query
    assert "m.lawyer_id =" in query
    assert "m.payment_status = 'paid'" in query
    assert "m.status = 'accepted'" in query
    assert "m.client_id =" not in query


@pytest.mark.asyncio
async def test_case_list_rejects_unverified_advocate(monkeypatch):
    import routers.matching as matching_router

    monkeypatch.setattr(matching_router, "fetchrow", AsyncMock(return_value=None))
    fetch = AsyncMock()
    monkeypatch.setattr(matching_router, "fetch", fetch)
    with pytest.raises(Exception) as error:
        await matching_router.list_case_requirements(
            {"id": 9, "role": "advocate"}
        )
    assert "verified advocates" in str(error.value)
    fetch.assert_not_awaited()


@pytest.mark.asyncio
async def test_lawyer_matches_masks_until_that_advocate_is_paid_and_interested():
    import routers.matching as matching_router

    monkeypatch = pytest.MonkeyPatch()
    try:
        monkeypatch.setattr(matching_router, "fetchrow", AsyncMock(return_value={"id": 12}))
        fetch = AsyncMock(return_value=[])
        monkeypatch.setattr(matching_router, "fetch", fetch)
        await matching_router.lawyer_matches({"id": 9, "role": "advocate"})
        query = fetch.await_args.args[0]
        profile_query = matching_router.fetchrow.await_args.args[0]
        assert "verified = TRUE" in profile_query
        assert "verification_status = 'verified'" in profile_query
        assert "m.lawyer_id = $1" in query
        assert "m.payment_status = 'paid'" in query
        assert "m.status IN ('accepted', 'interested')" in query
        assert "THEN c.description ELSE NULL" in query
    finally:
        monkeypatch.undo()


@pytest.mark.asyncio
async def test_lawyer_matches_rejects_suspended_or_revoked_advocate(monkeypatch):
    import routers.matching as matching_router

    monkeypatch.setattr(matching_router, "fetchrow", AsyncMock(return_value=None))
    fetch = AsyncMock(return_value=[{"id": 1, "is_anonymous": True}])
    monkeypatch.setattr(matching_router, "fetch", fetch)

    with pytest.raises(Exception) as error:
        await matching_router.lawyer_matches({"id": 9, "role": "advocate"})

    assert "verified advocates" in str(error.value).lower()
    fetch.assert_not_awaited()


@pytest.mark.asyncio
async def test_subscription_scheduler_runs_and_cancels_cleanly():
    from subscription_scheduler import start_scheduler

    calls = 0

    async def expire():
        nonlocal calls
        calls += 1
        return 0

    task = start_scheduler(expire, interval=3600)
    await __import__("asyncio").sleep(0)
    task.cancel()
    with pytest.raises(__import__("asyncio").CancelledError):
        await task
    assert calls == 1


@pytest.mark.asyncio
async def test_profile_email_change_requires_new_verification(monkeypatch):
    import routers.auth as auth_router

    row = {"id": 7, "email": "new@example.com", "email_verified": False}
    monkeypatch.setattr(auth_router, "get_user_by_email", AsyncMock(return_value=None))
    updated = AsyncMock(return_value=row)
    monkeypatch.setattr(auth_router, "db_fetchrow", updated)
    create_token = AsyncMock(return_value="new-token")
    send_email = AsyncMock(return_value=True)
    monkeypatch.setattr(auth_router, "_create_verification_token", create_token)
    monkeypatch.setattr(auth_router, "_send_verification_email", send_email)

    result = await auth_router.update_profile(
        auth_router.UpdateProfileRequest(email=" NEW@example.com "),
        _request(),
        {"id": 7, "email": "old@example.com"},
    )
    assert result["email_verified"] is False
    create_token.assert_awaited_once_with(7)
    send_email.assert_awaited_once_with("new@example.com", "new-token")
    assert "email_verified" in updated.await_args.args[0]


@pytest.mark.asyncio
async def test_account_erasure_fails_before_db_when_storage_delete_fails(monkeypatch):
    import routers.auth as auth_router

    monkeypatch.setattr(
        auth_router,
        "db_fetch",
        AsyncMock(return_value=[{"file_path": "documents/private.pdf"}]),
    )
    storage = type("Storage", (), {"delete": lambda self, key: (_ for _ in ()).throw(RuntimeError("storage down"))})()
    monkeypatch.setattr("storage.get_object_storage", lambda: storage)
    get_pool = AsyncMock()
    monkeypatch.setattr(auth_router, "get_pool", get_pool)

    with pytest.raises(Exception) as error:
        await auth_router.delete_account(_request(), Response(), {"id": 42})
    assert "stored files" in str(error.value).lower()
    get_pool.assert_not_awaited()


def test_anonymous_update_is_tristate():
    from routers.matching import UpdateRequirementRequest

    assert UpdateRequirementRequest().is_anonymous is None
    assert UpdateRequirementRequest(is_anonymous=False).is_anonymous is False
    assert UpdateRequirementRequest(is_anonymous=True).is_anonymous is True


def test_access_cookie_lifetime_is_one_day():
    from auth import ACCESS_TOKEN_MINUTES
    assert ACCESS_TOKEN_MINUTES == 24 * 60


def test_account_email_links_target_frontend_root(monkeypatch):
    import routers.auth as auth_router

    monkeypatch.setenv("APP_URL", "https://litigaforge.com/litigaforge")
    assert auth_router._frontend_account_url("/verify-email", "abc") == (
        "https://litigaforge.com/verify-email?token=abc"
    )
    assert auth_router._frontend_account_url("/reset-password", "xyz") == (
        "https://litigaforge.com/reset-password?token=xyz"
    )


@pytest.mark.asyncio
async def test_apple_login_normalizes_email(monkeypatch):
    import httpx
    from jose import jwt
    import routers.auth as auth_router

    class FakeResponse:
        def json(self):
            return {"keys": [{"kid": "key-1"}]}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setenv("APPLE_CLIENT_ID", "com.example.app")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    monkeypatch.setattr(jwt, "get_unverified_header", lambda _token: {"kid": "key-1"})
    monkeypatch.setattr(
        jwt,
        "decode",
        lambda *_args, **_kwargs: {
            "iss": "https://appleid.apple.com",
            "sub": "apple-user",
            "email": "  PERSON@Example.COM ",
            "email_verified": "true",
        },
    )
    lookup = AsyncMock(return_value={
        "id": 9,
        "email": "person@example.com",
        "name": "Person",
        "role": "client",
    })
    monkeypatch.setattr(auth_router, "get_user_by_email", lookup)
    monkeypatch.setattr(auth_router, "_issue_tokens", AsyncMock())

    await auth_router.apple_login(
        auth_router.AppleLoginRequest(id_token="token"),
        _request(),
        Response(),
    )
    lookup.assert_awaited_once_with("person@example.com")


def test_browser_auth_ignores_bearer_header():
    from auth import _extract_token
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/auth/me",
        "headers": [(b"authorization", b"Bearer should-not-be-accepted")],
        "query_string": b"",
    }
    assert _extract_token(Request(scope)) is None


def test_whatsapp_sandbox_is_not_advertised_as_available(monkeypatch):
    from alerts.whatsapp import whatsapp_alerts_enabled
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    assert whatsapp_alerts_enabled() is False
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155550123")
    assert whatsapp_alerts_enabled() is True