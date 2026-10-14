import asyncio
import json

import pytest
from fastapi import HTTPException

from routers import docket


COURT = {
    "state": "Delhi",
    "district_code": "New Delhi",
    "complex_code": "Supreme Court",
    "court": "Court",
    "court_no": "1",
}


def test_profile_only_requires_courts_and_enforces_ten():
    profile = docket.DocketProfileInput(court_ids=[json.dumps(COURT)])
    assert profile.cause_list_name == ""
    assert profile.enrolment_number == ""
    assert len(docket._validate_courts(profile.court_ids)) == 1

    with pytest.raises(HTTPException) as too_many:
        docket._validate_courts([json.dumps(COURT)] * 11)
    assert too_many.value.status_code == 422


def test_court_day_cache_is_shared_by_court_and_date(monkeypatch):
    stored = {}
    calls = {"dates": 0, "search": 0}

    async def cache_get(key):
        return stored.get(key)

    async def cache_set(key, value, ttl):
        assert ttl == 3 * 60 * 60
        stored[key] = value

    async def cap_reached():
        return False

    async def available_cause_list_dates(**kwargs):
        calls["dates"] += 1
        return {"dates": ["2026-10-14"]}

    async def search_cause_list(**kwargs):
        calls["search"] += 1
        assert "advocate" not in kwargs
        return {"results": [{"itemNo": 1, "cnr": "DLHC010000012026"}]}

    monkeypatch.setattr(docket, "cache_get", cache_get)
    monkeypatch.setattr(docket, "cache_set", cache_set)
    monkeypatch.setattr(docket.court_data_client, "is_daily_spend_cap_reached", cap_reached)
    monkeypatch.setattr(docket.court_data_client, "available_cause_list_dates", available_cause_list_dates)
    monkeypatch.setattr(docket.court_data_client, "search_cause_list", search_cause_list)

    async def load_as_two_advocates():
        # The user identity is intentionally absent from the cache key.
        return await docket._get_court_day(COURT, "2026-10-14"), await docket._get_court_day(COURT, "2026-10-14")

    first, second = asyncio.run(load_as_two_advocates())
    assert first == second
    assert first["status"] == "ok"
    assert calls == {"dates": 1, "search": 1}


def test_load_rate_limit_is_per_advocate(monkeypatch):
    docket._LOADS_BY_USER.clear()
    monkeypatch.setattr(docket.time, "monotonic", lambda: 100.0)
    for _ in range(docket._LOAD_RATE_LIMIT):
        docket._record_load(42)
    with pytest.raises(HTTPException) as limited:
        docket._record_load(42)
    assert limited.value.status_code == 429
    docket._record_load(43)
