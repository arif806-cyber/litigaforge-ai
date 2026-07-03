"""
ForgeOS Mission Engine — unit tests with a mocked DB layer and mocked
orchestrator/registry calls (no live Postgres, no live LLM).
"""
import asyncio
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos import missions, approvals


def _mission_row(status="assigned", **overrides):
    row = {
        "id": 1, "title": "Draft the onboarding doc", "description": "Write it up",
        "agent_id": 1, "status": status, "requires_approval": False,
        "input": {}, "result": None, "error": None, "created_by": 1,
        "created_at": "2026-07-02T00:00:00", "updated_at": "2026-07-02T00:00:00",
    }
    row.update(overrides)
    return row


@pytest.mark.asyncio
async def test_create_mission_without_approval_schedules_execution(monkeypatch):
    published = []

    async def fake_fetchrow(query, *args):
        return _mission_row(status="assigned")

    async def fake_publish(topic, payload, source=""):
        published.append(topic)
        return {"topic": topic}

    executed = []

    async def fake_execute_mission(mission_id):
        executed.append(mission_id)

    monkeypatch.setattr(missions, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(missions.bus, "publish", fake_publish)
    monkeypatch.setattr(missions, "execute_mission", fake_execute_mission)

    mission = await missions.create_mission(title="Draft the onboarding doc",
                                             requires_approval=False)
    assert mission["status"] == "assigned"
    assert "mission.created" in published

    await asyncio.sleep(0)
    assert executed == [1]


@pytest.mark.asyncio
async def test_create_mission_with_approval_creates_approval_not_execution(monkeypatch):
    async def fake_fetchrow(query, *args):
        return _mission_row(status="waiting", requires_approval=True)

    async def fake_publish(topic, payload, source=""):
        return {"topic": topic}

    approval_calls = []

    async def fake_create_approval(mission_id=None, workflow_step_id=None,
                                    requested_by="system", reason=""):
        approval_calls.append(mission_id)
        return {"id": 99, "mission_id": mission_id, "status": "pending"}

    executed = []

    async def fake_execute_mission(mission_id):
        executed.append(mission_id)

    monkeypatch.setattr(missions, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(missions.bus, "publish", fake_publish)
    monkeypatch.setattr(approvals, "create_approval", fake_create_approval)
    monkeypatch.setattr(missions, "execute_mission", fake_execute_mission)

    mission = await missions.create_mission(title="Sensitive task", requires_approval=True)
    assert mission["status"] == "waiting"
    assert approval_calls == [1]

    await asyncio.sleep(0)
    assert executed == []


@pytest.mark.asyncio
async def test_create_mission_rejects_oversized_input(monkeypatch):
    monkeypatch.setattr(missions, "FORGEOS_MAX_INPUT_CHARS", 10)
    with pytest.raises(ValueError):
        await missions.create_mission(title="x", input_data={"a": "way too much data here"})


@pytest.mark.asyncio
async def test_create_mission_raises_for_unknown_agent_name(monkeypatch):
    async def fake_get_agent_by_name(name):
        return None

    monkeypatch.setattr(missions.registry, "get_agent_by_name", fake_get_agent_by_name)

    with pytest.raises(ValueError):
        await missions.create_mission(title="x", agent_name="Nonexistent Agent")


@pytest.mark.asyncio
async def test_execute_mission_skips_when_not_approved(monkeypatch, caplog):
    async def fake_get_mission(mission_id):
        return _mission_row(status="running")

    monkeypatch.setattr(missions, "get_mission", fake_get_mission)

    # Should return without raising and without touching the orchestrator.
    await missions.execute_mission(1)


@pytest.mark.asyncio
async def test_execute_mission_marks_failed_when_no_agent(monkeypatch):
    async def fake_get_mission(mission_id):
        return _mission_row(status="assigned", agent_id=None)

    statuses = []

    async def fake_set_status(mission_id, status, **fields):
        statuses.append(status)

    async def fake_publish(topic, payload, source=""):
        return {"topic": topic}

    monkeypatch.setattr(missions, "get_mission", fake_get_mission)
    monkeypatch.setattr(missions, "_set_status", fake_set_status)
    monkeypatch.setattr(missions.bus, "publish", fake_publish)

    await missions.execute_mission(1)
    assert statuses == ["running", "failed"]


@pytest.mark.asyncio
async def test_execute_mission_completes_on_success(monkeypatch):
    async def fake_get_mission(mission_id):
        return _mission_row(status="assigned", agent_id=5)

    async def fake_get_agent(agent_id):
        return {"id": 5, "name": "Backend Engineer", "role": "Backend Engineer"}

    statuses = []

    async def fake_set_status(mission_id, status, **fields):
        statuses.append(status)

    async def fake_publish(topic, payload, source=""):
        return {"topic": topic}

    async def fake_run_agent_task(agent, task_text):
        return {"output": "done", "model_used": "test-model", "error": None}

    async def fake_still_owns(mission_id, agent_id):
        return True

    monkeypatch.setattr(missions, "get_mission", fake_get_mission)
    monkeypatch.setattr(missions.registry, "get_agent", fake_get_agent)
    monkeypatch.setattr(missions, "_set_status", fake_set_status)
    monkeypatch.setattr(missions.bus, "publish", fake_publish)
    monkeypatch.setattr(missions, "_still_owns", fake_still_owns)

    from forgeos import orchestrator
    monkeypatch.setattr(orchestrator, "run_agent_task", fake_run_agent_task)

    await missions.execute_mission(1)
    assert statuses == ["running", "completed"]


@pytest.mark.asyncio
async def test_execute_mission_discards_stale_result_when_reassigned(monkeypatch):
    """If the scheduler reassigns a mission to another agent while this
    coroutine is still mid-flight (e.g. a slow fallback past the stuck-running
    threshold), the original coroutine must NOT clobber the reassigned
    mission's state when it finally finishes."""
    async def fake_get_mission(mission_id):
        return _mission_row(status="assigned", agent_id=5)

    async def fake_get_agent(agent_id):
        return {"id": 5, "name": "Backend Engineer", "role": "Backend Engineer"}

    statuses = []

    async def fake_set_status(mission_id, status, **fields):
        statuses.append(status)

    async def fake_publish(topic, payload, source=""):
        return {"topic": topic}

    async def fake_run_agent_task(agent, task_text):
        return {"output": "done", "model_used": "test-model", "error": None}

    async def fake_still_owns(mission_id, agent_id):
        return False

    async def fake_update_agent_activity(agent_id, **fields):
        return None

    monkeypatch.setattr(missions, "get_mission", fake_get_mission)
    monkeypatch.setattr(missions.registry, "get_agent", fake_get_agent)
    monkeypatch.setattr(missions, "_set_status", fake_set_status)
    monkeypatch.setattr(missions.bus, "publish", fake_publish)
    monkeypatch.setattr(missions, "_still_owns", fake_still_owns)
    monkeypatch.setattr(missions.registry, "update_agent_activity", fake_update_agent_activity)

    from forgeos import orchestrator
    monkeypatch.setattr(orchestrator, "run_agent_task", fake_run_agent_task)

    await missions.execute_mission(1)
    # Only the initial "running" transition happened before the coroutine's
    # own execute_mission call set it; the stale terminal write is discarded.
    assert statuses == ["running"]
