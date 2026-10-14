import asyncio

import pytest

from services import court_data_client as client


CNR = "DLHC010000012026"


def test_daily_spend_cap_blocks_vendor_call_after_budget(monkeypatch):
    monkeypatch.setattr(client, "_API_USAGE", {})
    monkeypatch.setattr(client, "_SPEND_LIMIT_BLOCKED_DAYS", set())
    monkeypatch.setattr(client, "_DAILY_SPEND_CAP_INR", 3.0)

    async def reserve_twice():
        await client._reserve_api_usage("POST", "/api/partner/causelist/search", {})
        with pytest.raises(client.CourtDataError) as limited:
            await client._reserve_api_usage("POST", "/api/partner/causelist/search", {})
        assert limited.value.code == "daily_spend_cap"
        with pytest.raises(client.CourtDataError) as free_poll_limited:
            await client._reserve_api_usage(
                "POST", "/api/partner/case/bulk-refresh-status", {"cnrs": [CNR]}
            )
        assert free_poll_limited.value.code == "daily_spend_cap"

    asyncio.run(reserve_twice())
    summary = client.get_api_usage_summary()
    assert summary["today_spend_inr"] == 3.0
    assert summary["today_endpoints"]["CAUSE_LIST"]["calls"] == 1
    assert client.is_daily_spend_cap_reached()


def test_refresh_status_polling_backoff_and_deadline(monkeypatch):
    clock = [0.0]
    delays = []
    calls = [0]

    def monotonic():
        return clock[0]

    async def sleep(seconds):
        delays.append(seconds)
        clock[0] += seconds

    async def request(*args, **kwargs):
        calls[0] += 1
        queued = [CNR] if calls[0] <= 6 else []
        return {"data": {"queued": queued}}

    monkeypatch.setattr(client.time, "monotonic", monotonic)
    monkeypatch.setattr(client.asyncio, "sleep", sleep)
    monkeypatch.setattr(client, "_request", request)
    asyncio.run(client._wait_for_refresh_status([CNR]))
    assert delays == [10.0, 30.0, 60.0, 60.0, 60.0, 60.0]

    clock[0] = 0.0
    delays.clear()

    async def always_pending(*args, **kwargs):
        return {"data": {"queued": [CNR]}}

    monkeypatch.setattr(client, "_request", always_pending)
    with pytest.raises(client.CourtDataError) as timeout:
        asyncio.run(client._wait_for_refresh_status([CNR], timeout_seconds=900))
    assert timeout.value.code == "refresh_status_timeout"
    assert sum(delays) == 300.0


def test_not_found_refresh_counter_stops_after_two_404s(monkeypatch):
    class Conn:
        count = 0
        status = ""
        error = ""

        async def execute(self, query, tracked_case_id, message):
            assert "cnr_not_found_count + 1 >= 2" in query
            assert "CNR not found on eCourts — check the number" in query
            self.count += 1
            self.status = "cnr_not_found" if self.count >= 2 else "failed"
            self.error = (
                "CNR not found on eCourts — check the number"
                if self.count >= 2 else message
            )

    class Acquire:
        def __init__(self, conn):
            self.conn = conn

        async def __aenter__(self):
            return self.conn

        async def __aexit__(self, *args):
            return None

    class Pool:
        def __init__(self):
            self.conn = Conn()

        def acquire(self):
            return Acquire(self.conn)

    pool = Pool()

    async def get_pool():
        return pool

    monkeypatch.setattr(client, "get_pool", get_pool)
    not_found = client.CourtDataError("404", status_code=404, code="not_found")

    async def mark_twice():
        await client._mark_refresh_failure("00000000-0000-0000-0000-000000000001", not_found)
        assert pool.conn.status == "failed"
        await client._mark_refresh_failure("00000000-0000-0000-0000-000000000001", not_found)

    asyncio.run(mark_twice())
    assert pool.conn.count == 2
    assert pool.conn.status == "cnr_not_found"
    assert pool.conn.error == "CNR not found on eCourts — check the number"
