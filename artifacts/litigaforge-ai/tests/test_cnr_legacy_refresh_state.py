"""Regression coverage for stale CNR refresh state and the current retry path."""
from __future__ import annotations

import os
import re
import sys
from unittest.mock import AsyncMock

import pytest
from fastapi import BackgroundTasks

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers import court_intelligence as court_intel


LEGACY_MESSAGE = (
    "eCourts API unreachable from server "
    "\u2014 requires an Indian network IP."
)
TEST_CNR = "DLND020047882015"
TEST_CASE_ID = "00000000-0000-4000-8000-000000000001"


def test_legacy_refresh_state_is_normalized_without_emitting_old_error():
    status, error = court_intel._normalize_refresh_state("failed", LEGACY_MESSAGE)

    assert status == "pending"
    assert error is None


@pytest.mark.asyncio
async def test_loading_cases_clears_only_legacy_error_and_queues_current_refresh(monkeypatch):
    calls = []

    async def fake_fetch(query, *args):
        calls.append((query, args))
        if query.lstrip().startswith("UPDATE tracked_cases"):
            assert args[0] == 42
            assert re.search(args[1], LEGACY_MESSAGE, re.IGNORECASE)
            assert "refresh_status = 'pending'" in query
            assert "refresh_error  = NULL" in query
            assert "last_refreshed" not in query
            return [{"id": TEST_CASE_ID, "cnr": TEST_CNR}]
        return [{
            "id": TEST_CASE_ID,
            "cnr": TEST_CNR,
            "case_type": "civil",
            "court_name": "Test Court",
            "added_at": None,
            "last_refreshed": "2026-10-09T11:16:00+00:00",
            "is_active": True,
            "refresh_status": "pending",
            "refresh_error": None,
            "case_status": "Pending",
            "next_hearing_date": None,
        }]

    refresh = AsyncMock()
    monkeypatch.setattr(court_intel, "db_fetch", fake_fetch)
    monkeypatch.setattr(court_intel, "_trigger_single_refresh", refresh)

    background_tasks = BackgroundTasks()
    response = await court_intel.my_tracked_cases(background_tasks, {"id": 42})

    assert len(calls) == 2
    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0].func is refresh
    assert background_tasks.tasks[0].args == (TEST_CASE_ID, TEST_CNR)
    case = response["cases"][0]
    assert case["refresh_status"] == "pending"
    assert case["refresh_error"] is None
    assert case["last_refreshed"] == "2026-10-09T11:16:00+00:00"
    assert case["case_status"] == "Pending"
    assert "Indian network IP" not in repr(response)


@pytest.mark.asyncio
async def test_manual_retry_queues_the_partner_api_refresh_helper(monkeypatch):
    monkeypatch.setattr(
        court_intel,
        "db_fetchrow",
        AsyncMock(return_value={
            "id": TEST_CASE_ID,
            "user_id": 42,
            "cnr": TEST_CNR,
            "is_active": True,
        }),
    )
    execute = AsyncMock()
    monkeypatch.setattr(court_intel, "db_execute", execute)
    refresh = AsyncMock()
    monkeypatch.setattr(court_intel, "_trigger_single_refresh", refresh)

    background_tasks = BackgroundTasks()
    response = await court_intel.refresh_case(
        TEST_CASE_ID,
        background_tasks,
        {"id": 42},
    )

    assert response == {"status": "refresh_queued", "cnr": TEST_CNR}
    assert execute.await_count == 1
    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0].func is refresh
    assert background_tasks.tasks[0].args == (TEST_CASE_ID, TEST_CNR)


@pytest.mark.asyncio
async def test_background_refresh_calls_the_current_partner_api_client(monkeypatch):
    partner_lookup = AsyncMock()
    monkeypatch.setattr(court_intel.court_data_client, "get_case_by_cnr", partner_lookup)

    await court_intel._trigger_single_refresh(TEST_CASE_ID, TEST_CNR)

    partner_lookup.assert_awaited_once_with(
        TEST_CASE_ID,
        TEST_CNR,
        timeout=15.0,
        retries=2,
    )
