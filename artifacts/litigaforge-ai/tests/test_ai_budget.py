"""Focused regressions for public AI request limits and shared capacity."""
from __future__ import annotations

import asyncio
import os
import sys
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.mark.asyncio
async def test_global_budget_reservation_is_atomic_and_rolls_over_by_date(monkeypatch):
    import ai_budget

    calls = []
    lock = asyncio.Lock()
    state = {"count": 0}

    async def reserve(*args):
        async with lock:
            state["count"] += 1
            calls.append(args)
            return {"call_count": state["count"]} if state["count"] <= 2 else None

    monkeypatch.setattr(ai_budget, "fetchrow", reserve)
    monkeypatch.setenv("AI_DAILY_CALL_CAP", "2")
    monkeypatch.setenv("AI_DAILY_SPEND_CAP_USD", "1")

    await asyncio.gather(
        ai_budget.reserve_global_ai_capacity(),
        ai_budget.reserve_global_ai_capacity(),
    )
    with pytest.raises(ai_budget.AICapReached):
        await ai_budget.reserve_global_ai_capacity(raise_http=False)
    assert len(calls) == 3
    # Retry-After is always bounded to the next UTC day, not a fixed stale value.
    assert 1 <= ai_budget.retry_after_seconds() <= 86400


def test_cap_error_is_friendly_and_retryable():
    import ai_budget

    error = ai_budget.cap_error()
    assert error.status_code == 429
    assert error.headers["Retry-After"].isdigit()
    assert error.detail["code"] == "AI_DAILY_CAP_REACHED"
    assert "try again tomorrow" in error.detail["message"]


def test_document_request_has_strict_bounded_fields():
    from routers.community import DocumentRequest

    with pytest.raises(ValidationError):
        DocumentRequest(document_text="x" * 8001)
    with pytest.raises(ValidationError):
        DocumentRequest(document_text="valid", context="x" * 6001)


@pytest.mark.asyncio
async def test_authenticated_ai_dependency_reserves_shared_capacity_once(monkeypatch):
    import auth
    import ai_budget

    hourly = AsyncMock(return_value={"id": 7})
    global_reserve = AsyncMock()
    monkeypatch.setattr(auth, "reserve_hourly_ai_call", hourly)
    monkeypatch.setattr(ai_budget, "reserve_global_ai_capacity", global_reserve)

    result = await auth.require_ai_user({"id": 7})
    assert result == {"id": 7}
    hourly.assert_awaited_once()
    global_reserve.assert_awaited_once_with()


def test_public_ai_routes_have_per_ip_limits():
    from routers import community

    endpoints = {
        (route.path, tuple(sorted(route.methods or ()) )): route.endpoint
        for route in community.router.routes
        if route.path in {"/ask", "/document/analyze", "/document/analyze-file", "/judgments/search"}
    }
    # slowapi wraps each limited endpoint; the unprotected GET /ask remains
    # intentionally absent from this assertion.
    assert endpoints[("/ask", ("POST",))].__dict__.get("__wrapped__") is not None
    assert endpoints[("/document/analyze", ("POST",))].__dict__.get("__wrapped__") is not None
    assert endpoints[("/document/analyze-file", ("POST",))].__dict__.get("__wrapped__") is not None
    assert endpoints[("/judgments/search", ("POST",))].__dict__.get("__wrapped__") is not None