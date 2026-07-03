"""
ForgeOS Scheduler — unit tests with a mocked DB layer (no live Postgres).
Focus: the stuck-mission sweep must not relaunch/reassign a mission that is
still legitimately in-flight in this process (missions.is_mission_task_active
== True), only ones truly orphaned by a crash/restart.
"""
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos import scheduler, missions, registry, audit
from forgeos.events import bus
import alerts.email as alerts_email


def _patch_common(monkeypatch):
    """No-op the side-effecting bits every _reassign_stuck_missions test
    touches, so each test only has to override what it's actually asserting."""
    async def fake_publish(topic, payload, source=""):
        return {"topic": topic}

    async def fake_log_action(action, target_type="", target_id="", actor_user_id=None,
                               actor="system", detail=None):
        return {}

    def fake_send_founder_alert(subject, message):
        # Real send_founder_alert is a plain sync function called via
        # asyncio.to_thread — the mock must be sync too, or to_thread just
        # hands back an unawaited coroutine and this body never runs.
        return [{"success": True, "mode": "mock"}]

    async def fake_update_agent_activity(agent_id, **fields):
        return None

    monkeypatch.setattr(bus, "publish", fake_publish)
    monkeypatch.setattr(audit, "log_action", fake_log_action)
    monkeypatch.setattr(alerts_email, "send_founder_alert", fake_send_founder_alert)
    monkeypatch.setattr(registry, "update_agent_activity", fake_update_agent_activity)


def _empty_rows(query, *args):
    return []


@pytest.mark.asyncio
async def test_stuck_assigned_skipped_when_task_still_active(monkeypatch):
    """A mission queued behind the concurrency semaphore (is_mission_task_active
    == True) must NOT be relaunched even if it's been 'assigned' a long time —
    this is exactly the false-positive the fix targets."""
    _patch_common(monkeypatch)

    async def fake_fetch(query, *args):
        if "'assigned'" in query:
            return [{"id": 1, "title": "Slow mission", "agent_id": 5}]
        return []

    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "fetchrow", _empty_rows)
    monkeypatch.setattr(missions, "is_mission_task_active", lambda mid: True)

    spawned = []
    monkeypatch.setattr(missions, "_spawn_execution", lambda mid: spawned.append(mid))

    await scheduler._reassign_stuck_missions()
    assert spawned == []


@pytest.mark.asyncio
async def test_stuck_assigned_relaunched_when_orphaned(monkeypatch):
    """Not active in this process (e.g. process just restarted) -> genuinely
    orphaned -> relaunch."""
    _patch_common(monkeypatch)

    async def fake_fetch(query, *args):
        if "'assigned'" in query:
            return [{"id": 2, "title": "Orphaned mission", "agent_id": 5}]
        return []

    executed = []

    async def fake_execute(query, *args):
        executed.append(query)
        return None

    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "fetchrow", _empty_rows)
    monkeypatch.setattr(scheduler, "execute", fake_execute)
    monkeypatch.setattr(missions, "is_mission_task_active", lambda mid: False)

    spawned = []
    monkeypatch.setattr(missions, "_spawn_execution", lambda mid: spawned.append(mid))

    await scheduler._reassign_stuck_missions()
    assert spawned == [2]
    assert executed  # updated_at touch happened


@pytest.mark.asyncio
async def test_stuck_running_skipped_when_task_still_active(monkeypatch):
    """A genuinely long-running LLM call (is_mission_task_active == True) must
    not be reassigned to a different agent mid-flight."""
    _patch_common(monkeypatch)

    async def fake_fetch(query, *args):
        if "'running'" in query:
            return [{"id": 3, "title": "Long LLM call", "agent_id": 5, "status": "running"}]
        return []

    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "fetchrow", _empty_rows)
    monkeypatch.setattr(missions, "is_mission_task_active", lambda mid: True)

    spawned = []
    monkeypatch.setattr(missions, "_spawn_execution", lambda mid: spawned.append(mid))
    reassign_calls = []
    monkeypatch.setattr(registry, "list_agents", lambda status=None: reassign_calls.append(1) or [])

    await scheduler._reassign_stuck_missions()
    assert spawned == []
    # _find_replacement_agent should never even be consulted for an active task.
    assert reassign_calls == []


@pytest.mark.asyncio
async def test_stuck_running_reassigned_to_replacement_when_orphaned(monkeypatch):
    _patch_common(monkeypatch)

    async def fake_fetch(query, *args):
        if "'running'" in query:
            return [{"id": 4, "title": "Crashed mid-call", "agent_id": 5, "status": "running"}]
        return []

    async def fake_fetchrow(query, *args):
        return {"id": 4}

    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(missions, "is_mission_task_active", lambda mid: False)

    async def fake_list_agents(status=None):
        return [{"id": 9, "name": "Backup Engineer", "capabilities": ["coding"],
                  "current_mission_id": None, "last_activity_at": None}]

    async def fake_get_agent(agent_id):
        return {"id": 5, "name": "Backend Engineer", "capabilities": ["coding"]}

    monkeypatch.setattr(registry, "list_agents", fake_list_agents)
    monkeypatch.setattr(registry, "get_agent", fake_get_agent)

    spawned = []
    monkeypatch.setattr(missions, "_spawn_execution", lambda mid: spawned.append(mid))

    await scheduler._reassign_stuck_missions()
    assert spawned == [4]


@pytest.mark.asyncio
async def test_stuck_running_marked_failed_when_no_replacement_available(monkeypatch):
    _patch_common(monkeypatch)

    async def fake_fetch(query, *args):
        if "'running'" in query:
            return [{"id": 6, "title": "No one else free", "agent_id": 5, "status": "running"}]
        return []

    async def fake_fetchrow(query, *args):
        return {"id": 6}

    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(missions, "is_mission_task_active", lambda mid: False)

    async def fake_list_agents(status=None):
        return []  # no other active agents

    monkeypatch.setattr(registry, "list_agents", fake_list_agents)

    alerts_sent = []

    def fake_send_founder_alert(subject, message):
        alerts_sent.append(subject)
        return [{"success": True}]

    monkeypatch.setattr(alerts_email, "send_founder_alert", fake_send_founder_alert)

    spawned = []
    monkeypatch.setattr(missions, "_spawn_execution", lambda mid: spawned.append(mid))

    await scheduler._reassign_stuck_missions()
    assert spawned == []
    assert alerts_sent  # founder was alerted since the mission is genuinely blocked


@pytest.mark.asyncio
async def test_stuck_waiting_alerts_founder_once_per_backoff_window(monkeypatch):
    _patch_common(monkeypatch)

    async def fake_fetch(query, *args):
        if "'waiting'" in query:
            return [{"id": 7, "title": "Needs approval"}]
        return []

    async def fake_fetchrow(query, *args):
        # No prior alert within the backoff window.
        return None

    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "fetchrow", fake_fetchrow)

    alerts_sent = []

    def fake_send_founder_alert(subject, message):
        alerts_sent.append(subject)
        return [{"success": True}]

    monkeypatch.setattr(alerts_email, "send_founder_alert", fake_send_founder_alert)

    await scheduler._reassign_stuck_missions()
    assert len(alerts_sent) == 1


@pytest.mark.asyncio
async def test_stuck_waiting_deduped_when_already_alerted_recently(monkeypatch):
    _patch_common(monkeypatch)

    async def fake_fetch(query, *args):
        if "'waiting'" in query:
            return [{"id": 8, "title": "Needs approval"}]
        return []

    async def fake_fetchrow(query, *args):
        # A prior alert already exists within the backoff window.
        return {"id": 1}

    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "fetchrow", fake_fetchrow)

    alerts_sent = []

    async def fake_send_founder_alert(subject, message):
        alerts_sent.append(subject)
        return [{"success": True}]

    monkeypatch.setattr(alerts_email, "send_founder_alert", fake_send_founder_alert)

    await scheduler._reassign_stuck_missions()
    assert alerts_sent == []


@pytest.mark.asyncio
async def test_run_due_schedules_creates_mission_and_advances_next_run(monkeypatch):
    async def fake_fetch(query, *args):
        return [{"id": 1, "name": "Nightly digest", "interval_seconds": 3600,
                  "mission_template": {"title": "Run digest", "agent_name": "Backend Engineer"}}]

    created = []

    async def fake_create_mission(**kwargs):
        created.append(kwargs)
        return {"id": 42, "status": "assigned"}

    executed = []

    async def fake_execute(query, *args):
        executed.append((query, args))

    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "execute", fake_execute)
    monkeypatch.setattr(missions, "create_mission", fake_create_mission)

    await scheduler._run_due_schedules()
    assert created and created[0]["title"] == "Run digest"
    assert executed  # next_run_at was advanced


@pytest.mark.asyncio
async def test_run_due_schedules_advances_next_run_even_on_failure(monkeypatch):
    """A broken schedule (e.g. bad template) must not fire in a tight loop —
    next_run_at is pushed forward even when mission creation raises."""
    async def fake_fetch(query, *args):
        return [{"id": 2, "name": "Broken schedule", "interval_seconds": 60,
                  "mission_template": {"agent_name": "Nonexistent"}}]

    async def fake_create_mission(**kwargs):
        raise ValueError("Unknown agent 'Nonexistent'")

    executed = []

    async def fake_execute(query, *args):
        executed.append((query, args))

    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "execute", fake_execute)
    monkeypatch.setattr(missions, "create_mission", fake_create_mission)

    await scheduler._run_due_schedules()
    assert executed  # next_run_at was still advanced despite the failure
