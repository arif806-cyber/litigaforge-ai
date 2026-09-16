"""Regression tests for paid AI authentication and metering boundaries."""
import os
import sys
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("SESSION_SECRET", "test-secret-123456789012345678901234567890")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from auth import (
    AI_HOURLY_LIMIT,
    ANONYMOUS_ASK_DAILY_LIMIT,
    require_ask_access,
    reserve_hourly_ai_call,
)
from rate_limit import get_client_ip


@pytest.mark.asyncio
@pytest.mark.parametrize("tier", ["free", "professional", "advocate_pro"])
async def test_every_plan_uses_same_hourly_ai_limit(tier):
    with patch("auth._fetchrow", AsyncMock(return_value={"call_count": 1})) as fetchrow:
        user = {"id": 9, "subscription_tier": tier}
        assert await reserve_hourly_ai_call(user) == user
    assert fetchrow.await_args.args[-1] == AI_HOURLY_LIMIT == 20
    assert "date_trunc('hour', CURRENT_TIMESTAMP)" in fetchrow.await_args.args[0]


@pytest.mark.asyncio
async def test_user_ai_call_limit_is_atomic_and_returns_429():
    with patch("auth._fetchrow", AsyncMock(return_value=None)):
        with pytest.raises(HTTPException) as exc:
            await reserve_hourly_ai_call({"id": 9, "subscription_tier": "free"})
    assert exc.value.status_code == 429
    assert exc.value.headers["Retry-After"] == "3600"


class _Request:
    def __init__(self, headers=None, host="127.0.0.1"):
        self.headers = headers or {}
        self.client = type("Client", (), {"host": host})()


def test_client_ip_prefers_proxy_headers():
    request = _Request({
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": "198.51.100.2, 10.0.0.1",
    })
    assert get_client_ip(request) == "203.0.113.7"


@pytest.mark.asyncio
async def test_anonymous_ask_reserves_only_two_daily_calls_per_hashed_ip():
    request = _Request({"x-forwarded-for": "198.51.100.2, 10.0.0.1"})
    with patch("auth._fetchrow", AsyncMock(return_value={"call_count": 1})) as fetchrow:
        assert await require_ask_access(request, None) is None
    args = fetchrow.await_args.args
    assert args[-1] == ANONYMOUS_ASK_DAILY_LIMIT
    assert args[0] != "198.51.100.2"


@pytest.mark.asyncio
async def test_exhausted_anonymous_ask_returns_401():
    with patch("auth._fetchrow", AsyncMock(return_value=None)):
        with pytest.raises(HTTPException) as exc:
            await require_ask_access(_Request(), None)
    assert exc.value.status_code == 401


def test_all_user_facing_paid_ai_routes_have_metering_dependency():
    from auth import require_ai_user, require_ask_access
    from main import app
    from routers.court_intelligence import require_livetrack_ai

    expected = {
        "ask_legal_question": require_ask_access,
        "clarify_input": require_ai_user,
        "ai_legal_chat": require_ai_user,
        "analyze_document": require_ai_user,
        "analyze_document_file": require_ai_user,
        "generate_document": require_ai_user,
        "generate": require_ai_user,
        "case_ai_overview": require_ai_user,
        "ai_match_lawyers": require_ai_user,
        "workspace_smart_search": require_ai_user,
        "analyze_session": require_ai_user,
        "ask_agent": require_ai_user,
        "get_proactive_insights": require_ai_user,
        "simulate_what_if": require_ai_user,
        "suggest_fee": require_ai_user,
        "ask_about_case": require_livetrack_ai,
        "opponent_scan": require_livetrack_ai,
    }
    post_routes = {
        route.name: route
        for route in app.routes
        if "POST" in getattr(route, "methods", set())
    }
    for name, dependency in expected.items():
        assert name in post_routes
        calls = {item.call for item in post_routes[name].dependant.dependencies}
        assert dependency in calls, name


def test_anonymous_ask_is_ip_limited_but_authenticated_clarify_is_not():
    import inspect
    from routers import community

    assert '@limiter.limit("10/minute")' in inspect.getsource(community.ask_legal_question)
    assert "@limiter.limit" not in inspect.getsource(community.clarify_input)


def test_authenticated_document_analyzers_do_not_use_shared_proxy_ip_limits():
    import inspect
    from routers import community

    assert "@limiter.limit" not in inspect.getsource(community.analyze_document)
    assert "@limiter.limit" not in inspect.getsource(community.analyze_document_file)


def test_pre_verification_accounts_are_grandfathered_only_before_launch():
    import inspect
    from main import lifespan

    source = inspect.getsource(lifespan)
    assert "created_at < TIMESTAMPTZ '2026-06-06 06:33:35+00'" in source
    assert "SET email_verified = TRUE" in source