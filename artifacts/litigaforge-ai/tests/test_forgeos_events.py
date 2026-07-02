"""
ForgeOS Event Bus — unit tests with a mocked DB layer (no live Postgres).
"""
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos.events import EventBus


class _FakeRow(dict):
    """asyncpg Record-like dict."""


@pytest.mark.asyncio
async def test_publish_delivers_to_subscriber_and_persists(monkeypatch):
    bus = EventBus()

    inserted = {}

    async def fake_fetchrow(query, *args):
        inserted["query"] = query
        inserted["args"] = args
        return _FakeRow(id=1, topic=args[0], payload={"hello": "world"},
                         source=args[2], created_at="2026-07-02T00:00:00")

    monkeypatch.setattr("forgeos.events.fetchrow", fake_fetchrow)

    queue = bus.subscribe("mission.created")
    result = await bus.publish("mission.created", {"hello": "world"}, source="test")

    assert result["topic"] == "mission.created"
    assert result["id"] == 1
    assert "INSERT INTO forgeos_events" in inserted["query"]

    delivered = queue.get_nowait()
    assert delivered["topic"] == "mission.created"
    assert delivered["payload"] == {"hello": "world"}
    assert delivered["source"] == "test"


@pytest.mark.asyncio
async def test_publish_with_no_subscribers_does_not_raise(monkeypatch):
    bus = EventBus()

    async def fake_fetchrow(query, *args):
        return _FakeRow(id=2, topic=args[0], payload={}, source=args[2],
                         created_at="2026-07-02T00:00:00")

    monkeypatch.setattr("forgeos.events.fetchrow", fake_fetchrow)

    result = await bus.publish("nobody.listening", {}, source="test")
    assert result["id"] == 2


@pytest.mark.asyncio
async def test_unsubscribe_removes_queue(monkeypatch):
    bus = EventBus()
    queue = bus.subscribe("topic.a")
    bus.unsubscribe("topic.a", queue)
    assert queue not in bus._subscribers.get("topic.a", [])


@pytest.mark.asyncio
async def test_recent_events_passes_topic_filter(monkeypatch):
    from forgeos import events as events_module

    captured = {}

    async def fake_fetch(query, *args):
        captured["query"] = query
        captured["args"] = args
        return [{"id": 1, "topic": "mission.created", "payload": {}, "source": "x",
                  "created_at": "2026-07-02T00:00:00"}]

    monkeypatch.setattr(events_module, "fetch", fake_fetch)

    rows = await events_module.recent_events(topic="mission.created", limit=10)
    assert len(rows) == 1
    assert captured["args"] == ("mission.created", 10)
