"""Focused regression tests for the Phase 0/1 safety boundaries."""
import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("SESSION_SECRET", "test-secret-123456789012345678901234567890")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from fastapi import Response
from main import app


@pytest.mark.asyncio
async def test_advocate_role_is_not_downgraded():
    from routers.auth import RegisterRequest, register
    user = {
        "id": 17, "email": "advocate@example.com", "name": "Advocate",
        "subscription_tier": "free", "role": "advocate", "email_verified": False,
        "is_profile_public": False, "created_at": "2026-01-01",
    }
    with patch("routers.auth.create_user", AsyncMock(return_value=user)) as create_user, \
         patch("routers.auth._issue_tokens", AsyncMock(return_value="token")), \
         patch("routers.auth._create_verification_token", AsyncMock(return_value="verify")), \
         patch("routers.auth._send_verification_email", AsyncMock(return_value=False)):
        response = await register.__wrapped__(
            RegisterRequest(name="Advocate", email="advocate@example.com",
                            password="safe-password", role="advocate"),
            None, Response(),
        )
    assert response["user"]["role"] == "advocate"
    assert create_user.await_args.kwargs["role"] == "advocate"


@pytest.mark.asyncio
async def test_public_lawyer_query_is_verified_non_test_and_pii_free():
    from routers import community

    captured = {}

    async def fake_fetch(query, *args):
        captured["query"] = query
        return [{
            "id": 1, "name": "Real Advocate", "district": "Hyderabad",
            "city": "Hyderabad", "practice_areas": ["civil"], "languages": ["English"],
            "experience_years": 5, "rating": 4.5, "bio": "", "hourly_rate": None,
            "availability": "available", "verification_status": "verified", "verified": True,
        }]

    with patch.object(community, "cache_get", AsyncMock(return_value=None)), \
         patch.object(community, "cache_set", AsyncMock()), \
         patch.object(community, "fetch", fake_fetch):
        result = await community.list_lawyers(Response())
    assert "COALESCE(l.is_test, FALSE) = FALSE" in captured["query"]
    assert "l.email" not in captured["query"]
    assert not {"email", "phone", "bar_number"} & result["lawyers"][0].keys()


@pytest.mark.asyncio
async def test_sixth_free_case_returns_upgrade_response():
    from routers.matching import CaseRequirementRequest, create_case_requirement

    with patch("routers.matching.create_case_requirement_with_quota",
               AsyncMock(side_effect=PermissionError)):
        response = await create_case_requirement.__wrapped__(
            CaseRequirementRequest(title="Civil matter", case_type="civil"),
            None,
            {"id": 4, "email_verified": True, "subscription_tier": "free"},
        )
    assert response.status_code == 402
    assert b"Free plan limit reached" in response.body


@pytest.mark.asyncio
async def test_direct_matching_flag_off_does_no_database_work(monkeypatch):
    from routers.matching import MatchRequest, ai_match_lawyers

    monkeypatch.delenv("MATCHING_ENABLED", raising=False)
    with patch("routers.matching.fetchrow", AsyncMock()) as fetchrow, \
         patch("routers.matching.fetch", AsyncMock()) as fetch:
        result = await ai_match_lawyers.__wrapped__(
            MatchRequest(case_requirement_id=42), None, {"id": 8}
        )
    assert result["matches"] == []
    fetchrow.assert_not_awaited()
    fetch.assert_not_awaited()


@pytest.mark.asyncio
async def test_empty_lawyer_district_is_not_location_match(monkeypatch):
    from routers.matching import MatchRequest, ai_match_lawyers

    monkeypatch.setenv("MATCHING_ENABLED", "true")
    case = {"id": 42, "case_type": "civil", "location": "Hyderabad"}
    lawyer = {
        "id": 3, "name": "No Location", "district": "", "practice_areas": ["civil"],
        "languages": [], "experience_years": 1, "rating": 0, "bio": "",
        "hourly_rate": None, "availability": "available", "verification_status": "verified",
    }
    with patch("routers.matching.fetchrow", AsyncMock(return_value=case)), \
         patch("routers.matching.fetch", AsyncMock(return_value=[lawyer])), \
         patch("routers.matching.executemany", AsyncMock()) as inserts:
        result = await ai_match_lawyers.__wrapped__(
            MatchRequest(case_requirement_id=42), None, {"id": 8}
        )
    assert result["matches"] == []
    inserts.assert_not_awaited()


@pytest.mark.asyncio
async def test_case_overview_remains_available_when_matching_is_off(monkeypatch):
    from routers.matching import case_ai_overview

    monkeypatch.delenv("MATCHING_ENABLED", raising=False)
    with patch("routers.matching.fetchrow", AsyncMock(return_value={
        "id": 42, "case_type": "civil", "location": "Hyderabad", "description": "",
    })), patch("routers.matching._ai", return_value="Overview"):
        result = await case_ai_overview(42, {"id": 8})
    assert result == {"overview": "Overview"}


@pytest.mark.asyncio
async def test_analyze_emits_start_before_database_work():
    from routers.workspace import AnalyzeBody, analyze_session

    with patch(
        "routers.workspace.get_pool",
        AsyncMock(side_effect=AssertionError("database touched before first SSE frame")),
    ):
        response = await analyze_session(
            12,
            AnalyzeBody(case_description="MACT Hyderabad", context=""),
            None,
            {"id": 112},
        )
        first = await anext(response.body_iterator)

    assert '"type": "start"' in first


@pytest.mark.asyncio
async def test_public_mcp_search_strips_full_judgment_text():
    from routers import mcp

    class Acquire:
        async def __aenter__(self):
            return object()

        async def __aexit__(self, *_args):
            return None

    class Pool:
        def acquire(self):
            return Acquire()

    search_result = {
        "count": 1,
        "source": "local_db",
        "results": [{
            "case_name": "Example v State",
            "source": "local_db",
            "url": "/judgments/example/2026/example-v-state",
            "full_text": "x" * 50_000,
        }],
    }
    with patch.object(mcp, "get_pool", AsyncMock(return_value=Pool())), \
         patch.object(mcp, "search_case_law", AsyncMock(return_value=search_result)):
        result = await mcp._search_judgments({"query": "example", "limit": 5})

    assert "full_text" not in result["judgments"][0]


@pytest.mark.asyncio
async def test_workspace_sse_bypasses_gzip_buffering():
    from main import _ConditionalGZipMiddleware

    calls = []

    async def raw_app(_scope, _receive, _send):
        calls.append("raw")

    async def gzip_app(_scope, _receive, _send):
        calls.append("gzip")

    middleware = _ConditionalGZipMiddleware(raw_app)
    middleware.gzip_app = gzip_app
    await middleware(
        {
            "type": "http",
            "path": "/litigaforge/litigaforge/workspace/sessions/12/analyze",
        },
        None,
        None,
    )

    assert calls == ["raw"]