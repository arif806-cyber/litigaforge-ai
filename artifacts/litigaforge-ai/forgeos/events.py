"""
ForgeOS Event Bus — in-process pub/sub for a single-process, single-VM
deployment (no separate message queue infra). Every published event is also
persisted to forgeos_events as an audit log / for consumers that missed the
live broadcast (e.g. a REST client polling GET /forgeos/events).

Limitation (by design, foundation level): subscribers only receive events
published while the process is alive and their queue is actively being
read; there is no cross-process fan-out. If ForgeOS ever needs multi-process
delivery, swap this for Redis pub/sub (redis is already a dependency).
"""
import asyncio
import json
from typing import Any

from database import fetch, fetchrow
from logger import get_logger
from forgeos.config import FORGEOS_MAX_EVENT_PAYLOAD_CHARS

logger = get_logger("litigaforge.forgeos")


class EventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue]] = {}

    def subscribe(self, topic: str) -> asyncio.Queue:
        """Register a new subscriber queue for a topic, or every topic when
        topic="*" (used by the /forgeos/stream SSE endpoint so the dashboard
        gets a single live feed instead of one subscription per topic).
        Caller is responsible for eventually calling unsubscribe() to avoid
        leaking queues."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.setdefault(topic, []).append(queue)
        return queue

    def unsubscribe(self, topic: str, queue: asyncio.Queue) -> None:
        subs = self._subscribers.get(topic)
        if subs and queue in subs:
            subs.remove(queue)

    async def publish(self, topic: str, payload: dict[str, Any] | None = None,
                       source: str = "system") -> dict:
        """Broadcast to live in-process subscribers and persist an audit row.
        Never raises on subscriber delivery failure (a full queue just drops
        the event for that subscriber — audit log is the source of truth)."""
        payload = payload or {}
        payload_json = json.dumps(payload, default=str)
        if len(payload_json) > FORGEOS_MAX_EVENT_PAYLOAD_CHARS:
            payload_json = json.dumps({"truncated": True, "reason": "payload too large"})

        targets = list(self._subscribers.get(topic, []))
        if topic != "*":
            targets += self._subscribers.get("*", [])
        for queue in targets:
            try:
                queue.put_nowait({"topic": topic, "payload": payload, "source": source})
            except asyncio.QueueFull:
                logger.warning("forgeos: event queue full for topic=%s — dropping for one subscriber", topic)

        row = await fetchrow(
            """INSERT INTO forgeos_events (topic, payload, source)
               VALUES ($1, $2::jsonb, $3)
               RETURNING id, topic, payload, source, created_at""",
            topic, payload_json, source,
        )
        row["created_at"] = str(row["created_at"])
        return row


async def recent_events(topic: str | None = None, limit: int = 50) -> list[dict]:
    limit = max(1, min(limit, 200))
    if topic:
        rows = await fetch(
            """SELECT id, topic, payload, source, created_at
               FROM forgeos_events WHERE topic = $1
               ORDER BY created_at DESC LIMIT $2""",
            topic, limit,
        )
    else:
        rows = await fetch(
            """SELECT id, topic, payload, source, created_at
               FROM forgeos_events ORDER BY created_at DESC LIMIT $1""",
            limit,
        )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return rows


# Module-level singleton — shared across the whole process.
bus = EventBus()
