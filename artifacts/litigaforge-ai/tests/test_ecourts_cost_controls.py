import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from services import court_data_client as client

CNR = "DLHC010000012026"

class SharedStore:
    def __init__(self, cap=60):
        self.cap = cap
        self.daily = {}
        self.endpoints = {}
        self.cause_cache = {}
        self.lock = asyncio.Lock()

class SharedConnection:
    def __init__(self, store):
        self.store = store

    @asynccontextmanager
    async def transaction(self):
        yield

    async def fetchrow(self, query, *args):
        if "WITH cap AS" in query:
            day, amount, override = args
            cap = override if override is not None else self.store.cap
            async with self.store.lock:
                current = self.store.daily.get(day, {"calls": 0, "spend": 0.0})
                allowed = current["spend"] < cap and current["spend"] + float(amount) <= cap
                if not allowed:
                    return None
                current["calls"] += 1
                current["spend"] = round(current["spend"] + float(amount), 2)
                self.store.daily[day] = current
                return {"day_ist": day}
        if "SELECT estimated_inr FROM ecourts_api_daily_spend" in query:
            value = self.store.daily.get(args[0])
            return {"estimated_inr": value["spend"]} if value else None
        if "SELECT payload FROM ecourts_cause_list_cache" in query:
            return self.store.cause_cache.get(args[0])
        return None

    async def fetchval(self, query, *_args):
        if "SELECT daily_cap_inr" in query:
            return self.store.cap
        return None

    async def execute(self, query, *args):
        if "INSERT INTO ecourts_api_settings" in query:
            self.store.cap = float(args[0])
        elif "INSERT INTO ecourts_api_usage" in query:
            day, endpoint, amount = args
            row = self.store.endpoints.setdefault((day, endpoint), {"calls": 0, "spend": 0.0})
            row["calls"] += 1
            row["spend"] = round(row["spend"] + float(amount), 2)
        elif "INSERT INTO ecourts_cause_list_cache" in query:
            self.store.cause_cache[args[0]] = {"payload": args[1]}
        elif "UPDATE ecourts_api_daily_spend" in query:
            day, amount = args
            row = self.store.daily[day]
            row["calls"] -= 1
            row["spend"] = round(row["spend"] - float(amount), 2)
        elif "UPDATE ecourts_api_usage" in query:
            day, endpoint, amount = args
            row = self.store.endpoints[(day, endpoint)]
            row["calls"] -= 1
            row["spend"] = round(row["spend"] - float(amount), 2)

    async def fetch(self, query, since):
        return [
            {"day_ist": day, "endpoint": endpoint, "call_count": row["calls"], "estimated_inr": row["spend"]}
            for (day, endpoint), row in self.store.endpoints.items() if day >= since
        ]


def test_two_instances_share_the_same_daily_cap(monkeypatch):
    monkeypatch.delenv("ECOURTS_DAILY_CAP_INR", raising=False)
    async def run():
        store = SharedStore(cap=3)
        first_instance = SharedConnection(store)
        second_instance = SharedConnection(store)
        await client._reserve_api_usage("POST", "/api/partner/causelist/search", {}, conn=first_instance)
        with pytest.raises(client.CourtDataError) as limited:
            await client._reserve_api_usage("POST", "/api/partner/causelist/search", {}, conn=second_instance)
        assert limited.value.code == "daily_spend_cap"
        summary = await client.get_api_usage_summary(conn=second_instance)
        assert summary["today_spend_inr"] == 3
    asyncio.run(run())


def test_cap_and_spend_survive_a_new_client_instance(monkeypatch):
    monkeypatch.delenv("ECOURTS_DAILY_CAP_INR", raising=False)
    async def run():
        store = SharedStore()
        initial = SharedConnection(store)
        await client.set_daily_spend_cap_inr(6, conn=initial)
        await client._reserve_api_usage("POST", "/api/partner/causelist/search", {}, conn=initial)
        restarted = SharedConnection(store)
        assert await client._get_daily_cap(restarted) == 6
        summary = await client.get_api_usage_summary(conn=restarted)
        assert summary["daily_cap_inr"] == 6
        assert summary["today_spend_inr"] == 3
        await client._reserve_api_usage("POST", "/api/partner/causelist/search", {}, conn=restarted)
        with pytest.raises(client.CourtDataError):
            await client._reserve_api_usage("POST", "/api/partner/causelist/search", {}, conn=SharedConnection(store))
    asyncio.run(run())


def test_concurrent_reservations_cannot_exceed_cap(monkeypatch):
    monkeypatch.delenv("ECOURTS_DAILY_CAP_INR", raising=False)
    async def run():
        store = SharedStore(cap=12)
        connections = [SharedConnection(store) for _ in range(20)]
        results = await asyncio.gather(*(
            client._reserve_api_usage("POST", "/api/partner/causelist/search", {}, conn=conn)
            for conn in connections
        ), return_exceptions=True)
        assert sum(not isinstance(result, Exception) for result in results) == 4
        day = datetime.now(ZoneInfo("Asia/Kolkata")).date()
        assert store.daily[day]["spend"] == 12
    asyncio.run(run())


def test_cause_list_cache_is_shared_by_new_connections(monkeypatch):
    async def run():
        store = SharedStore()

        class Acquire:
            async def __aenter__(self):
                return SharedConnection(store)
            async def __aexit__(self, *_args):
                return None

        class Pool:
            def acquire(self):
                return Acquire()

        async def get_pool():
            return Pool()

        calls = []
        async def vendor_request(*_args, **_kwargs):
            calls.append(1)
            return {"data": {"results": [{"cnr": "DLHC010000012026"}]}}

        monkeypatch.setattr(client, "get_pool", get_pool)
        monkeypatch.setattr(client, "_request", vendor_request)
        first = await client.search_cause_list(date_value="2026-10-14", court="District Court")
        # A fresh connection simulates another API instance after a restart.
        second = await client.search_cause_list(date_value="2026-10-14", court="District Court")
        assert first == second
        assert len(calls) == 1

    asyncio.run(run())


def test_reservation_is_released_when_connection_fails_before_vendor(monkeypatch):
    reservation = {"day": None, "endpoint": "CASE_DETAIL", "cost": 1.5}
    released = []

    class BrokenClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *_args):
            return None
        async def request(self, *_args, **_kwargs):
            request = client.httpx.Request("GET", "https://webapi.ecourtsindia.com")
            raise client.httpx.ConnectError("no connection", request=request)

    async def reserve(*_args, **_kwargs):
        return reservation

    async def release(value, **_kwargs):
        released.append(value)

    async def run():
        monkeypatch.setattr(client, "_KEY_POOL", ["unit-test"])
        monkeypatch.setattr(client, "_reserve_api_usage", reserve)
        monkeypatch.setattr(client, "_release_api_usage", release)
        monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_kwargs: BrokenClient())
        with pytest.raises(client.CourtDataError) as failure:
            await client._request("GET", "/api/partner/case/DLHC010000012026", retries=0)
        assert failure.value.code == "network_error"

    asyncio.run(run())
    assert released == [reservation]


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
