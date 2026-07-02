"""
ForgeOS Agent Registry — unit tests with a mocked DB layer.
"""
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos import registry


@pytest.mark.asyncio
async def test_register_agent_upserts_by_name(monkeypatch):
    captured = {}

    async def fake_fetchrow(query, *args):
        captured["query"] = query
        captured["args"] = args
        return {
            "id": 1, "name": args[0], "role": args[1], "description": args[2],
            "capabilities": args[3], "model": args[4], "status": "active",
            "created_at": "2026-07-02T00:00:00",
        }

    monkeypatch.setattr(registry, "fetchrow", fake_fetchrow)

    agent = await registry.register_agent("CEO", "Chief Executive Officer",
                                           description="Leads.", capabilities=["planning"])
    assert agent["name"] == "CEO"
    assert "ON CONFLICT (name) DO UPDATE" in captured["query"]


@pytest.mark.asyncio
async def test_list_agents_filters_by_status(monkeypatch):
    captured = {}

    async def fake_fetch(query, *args):
        captured["query"] = query
        captured["args"] = args
        return [{"id": 1, "name": "CTO", "role": "Chief Technology Officer",
                  "description": "", "capabilities": [], "model": "", "status": "active",
                  "created_at": "2026-07-02T00:00:00"}]

    monkeypatch.setattr(registry, "fetch", fake_fetch)

    agents = await registry.list_agents(status="active")
    assert len(agents) == 1
    assert captured["args"] == ("active",)


@pytest.mark.asyncio
async def test_get_agent_by_name_returns_none_when_missing(monkeypatch):
    async def fake_fetchrow(query, *args):
        return None

    monkeypatch.setattr(registry, "fetchrow", fake_fetchrow)

    agent = await registry.get_agent_by_name("Nonexistent")
    assert agent is None


@pytest.mark.asyncio
async def test_update_agent_status_rejects_invalid_status():
    with pytest.raises(ValueError):
        await registry.update_agent_status(1, "not-a-real-status")
