"""
ForgeOS Shared Memory Service — unit tests with a mocked DB layer.
"""
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos import memory


@pytest.mark.asyncio
async def test_set_value_upserts_json(monkeypatch):
    captured = {}

    async def fake_fetchrow(query, *args):
        captured["query"] = query
        captured["args"] = args
        return {"id": 1, "namespace": args[0], "key": args[1], "value": {"foo": "bar"},
                "updated_at": "2026-07-02T00:00:00"}

    monkeypatch.setattr(memory, "fetchrow", fake_fetchrow)

    row = await memory.set_value("mission:1", "context", {"foo": "bar"})
    assert row["namespace"] == "mission:1"
    assert "ON CONFLICT (namespace, key)" in captured["query"]


@pytest.mark.asyncio
async def test_get_value_returns_none_when_missing(monkeypatch):
    async def fake_fetchrow(query, *args):
        return None

    monkeypatch.setattr(memory, "fetchrow", fake_fetchrow)

    value = await memory.get_value("mission:1", "missing-key")
    assert value is None


@pytest.mark.asyncio
async def test_list_namespace_returns_rows(monkeypatch):
    async def fake_fetch(query, *args):
        return [{"key": "context", "value": {"a": 1}, "updated_at": "2026-07-02T00:00:00"}]

    monkeypatch.setattr(memory, "fetch", fake_fetch)

    rows = await memory.list_namespace("mission:1")
    assert rows[0]["key"] == "context"
