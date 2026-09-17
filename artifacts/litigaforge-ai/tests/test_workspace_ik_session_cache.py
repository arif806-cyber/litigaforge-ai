import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from routers import workspace


class FakeConnection:
    def __init__(self, row):
        self.row = row
        self.executions = []

    async def fetchrow(self, sql, *args):
        return self.row

    async def execute(self, sql, *args):
        self.executions.append((sql, args))


def test_session_ik_cache_returns_fresh_pinned_docs_without_search(monkeypatch):
    query = workspace._build_ik_query("wrongful termination employment dispute")
    docs = [{"tid": "123", "title": "A v B"}]
    conn = FakeConnection({
        "last_ik_query": query,
        "last_ik_docs": docs,
        "last_ik_fetched_at": datetime.now(timezone.utc) - timedelta(hours=2),
    })

    async def fail_search(*args, **kwargs):
        raise AssertionError("fresh session docs must bypass IK search")

    monkeypatch.setattr(workspace, "_cached_ik_search", fail_search)
    result, cache_hit = asyncio.run(
        workspace._session_ik_docs(conn, 7, 11, query)
    )

    assert result == docs
    assert cache_hit is True
    assert conn.executions == []


def test_session_ik_cache_refreshes_when_query_changes(monkeypatch):
    old_query = workspace._build_ik_query("contract dispute")
    new_query = workspace._build_ik_query("criminal bail application")
    conn = FakeConnection({
        "last_ik_query": old_query,
        "last_ik_docs": [{"tid": "old"}],
        "last_ik_fetched_at": datetime.now(timezone.utc),
    })
    calls = []

    async def fake_search(conn_arg, query, max_results=8, force_refresh=False):
        calls.append((query, max_results, force_refresh))
        return [{"tid": "new"}]

    monkeypatch.setattr(workspace, "_cached_ik_search", fake_search)
    result, cache_hit = asyncio.run(
        workspace._session_ik_docs(conn, 7, 11, new_query)
    )

    assert result == [{"tid": "new"}]
    assert cache_hit is False
    assert calls == [(new_query, 5, False)]
    assert "last_ik_fetched_at=NOW()" in conn.executions[0][0]


def test_session_ik_cache_refreshes_after_24_hours(monkeypatch):
    query = workspace._build_ik_query("property title dispute")
    conn = FakeConnection({
        "last_ik_query": query,
        "last_ik_docs": [{"tid": "old"}],
        "last_ik_fetched_at": datetime.now(timezone.utc) - timedelta(hours=25),
    })
    calls = []

    async def fake_search(*args, **kwargs):
        calls.append(kwargs)
        return [{"tid": "fresh"}]

    monkeypatch.setattr(workspace, "_cached_ik_search", fake_search)
    result, cache_hit = asyncio.run(
        workspace._session_ik_docs(conn, 7, 11, query)
    )

    assert result == [{"tid": "fresh"}]
    assert cache_hit is False
    assert calls == [{"max_results": 5, "force_refresh": False}]


def test_manual_session_refresh_bypasses_global_query_cache(monkeypatch):
    query = workspace._build_ik_query("consumer fraud")
    conn = FakeConnection({
        "last_ik_query": query,
        "last_ik_docs": [{"tid": "old"}],
        "last_ik_fetched_at": datetime.now(timezone.utc),
    })
    calls = []

    async def fake_search(*args, **kwargs):
        calls.append(kwargs)
        return [{"tid": "live"}]

    monkeypatch.setattr(workspace, "_cached_ik_search", fake_search)
    result, cache_hit = asyncio.run(
        workspace._session_ik_docs(conn, 7, 11, query, force_refresh=True)
    )

    assert result == [{"tid": "live"}]
    assert cache_hit is False
    assert calls == [{"max_results": 5, "force_refresh": True}]