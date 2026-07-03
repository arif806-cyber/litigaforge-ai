"""
ForgeOS Workflow Engine — unit tests with a mocked DB layer and a mocked
orchestrator.run_agent_task (no live Postgres, no live LLM calls). Focus:
step-order execution, halting on approval gates, halting on step failure,
and correctly resuming/rejecting after a human approval decision.
"""
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos import workflows, registry, orchestrator, approvals
from forgeos.events import bus


def _step(step_id, order, status="pending", agent_id=1, requires_approval=False, input_data=None):
    return {
        "id": step_id, "workflow_id": 100, "step_order": order, "agent_id": agent_id,
        "name": f"step-{order}", "status": status, "requires_approval": requires_approval,
        "input": input_data or {"task": f"do thing {order}"}, "output": None, "error": None,
        "created_at": "now", "updated_at": "now",
    }


def _patch_events_and_agent(monkeypatch, agent=None):
    async def fake_publish(topic, payload, source=""):
        return {"topic": topic}
    monkeypatch.setattr(bus, "publish", fake_publish)

    async def fake_get_agent(agent_id):
        return agent or {"id": agent_id, "name": "Backend Engineer", "role": "Backend Engineer"}
    monkeypatch.setattr(registry, "get_agent", fake_get_agent)


# ── create_workflow ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_workflow_requires_at_least_one_step():
    with pytest.raises(ValueError, match="at least one step"):
        await workflows.create_workflow(mission_id=None, name="Empty", steps=[])


@pytest.mark.asyncio
async def test_create_workflow_resolves_agent_by_name(monkeypatch):
    async def fake_fetchrow(query, *args):
        return {"id": 100, "mission_id": None, "name": "Onboard client", "status": "pending",
                "created_at": "now", "updated_at": "now"}

    executed = []

    async def fake_execute(query, *args):
        executed.append(args)

    async def fake_get_agent_by_name(name):
        assert name == "Backend Engineer"
        return {"id": 7, "name": "Backend Engineer"}

    monkeypatch.setattr(workflows, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(workflows, "execute", fake_execute)
    monkeypatch.setattr(registry, "get_agent_by_name", fake_get_agent_by_name)
    monkeypatch.setattr(workflows.asyncio, "create_task", lambda coro: coro.close())

    workflow = await workflows.create_workflow(
        mission_id=None, name="Onboard client",
        steps=[{"name": "Draft welcome email", "agent_name": "Backend Engineer"}],
    )
    assert workflow["id"] == 100
    assert executed and executed[0][2] == 7  # agent_id resolved to 7 in the INSERT args


@pytest.mark.asyncio
async def test_create_workflow_raises_for_unknown_agent_name(monkeypatch):
    async def fake_fetchrow(query, *args):
        return {"id": 101, "mission_id": None, "name": "Bad step", "status": "pending",
                "created_at": "now", "updated_at": "now"}

    async def fake_get_agent_by_name(name):
        return None

    monkeypatch.setattr(workflows, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(registry, "get_agent_by_name", fake_get_agent_by_name)

    with pytest.raises(ValueError, match="Unknown agent"):
        await workflows.create_workflow(
            mission_id=None, name="Bad step",
            steps=[{"name": "step", "agent_name": "Ghost"}],
        )


@pytest.mark.asyncio
async def test_create_workflow_rejects_oversized_step_input(monkeypatch):
    async def fake_fetchrow(query, *args):
        return {"id": 102, "mission_id": None, "name": "Huge input", "status": "pending",
                "created_at": "now", "updated_at": "now"}

    monkeypatch.setattr(workflows, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(workflows, "FORGEOS_MAX_INPUT_CHARS", 10)

    with pytest.raises(ValueError, match="exceeds"):
        await workflows.create_workflow(
            mission_id=None, name="Huge input",
            steps=[{"name": "step", "agent_id": 1, "input": {"task": "x" * 100}}],
        )


# ── execute_workflow ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_workflow_runs_steps_in_order_and_completes(monkeypatch):
    _patch_events_and_agent(monkeypatch)
    workflow = {"id": 100, "steps": [_step(1, 0), _step(2, 1)]}

    async def fake_get_workflow(workflow_id):
        return workflow

    status_calls = []

    async def fake_set_workflow_status(workflow_id, status):
        status_calls.append(status)

    step_status_calls = []

    async def fake_set_step_status(step_id, status, **fields):
        step_status_calls.append((step_id, status))

    async def fake_run_agent_task(agent, task_text):
        return {"output": "done", "model_used": "test-model", "error": None,
                "tokens": None, "cost_usd": None}

    monkeypatch.setattr(workflows, "get_workflow", fake_get_workflow)
    monkeypatch.setattr(workflows, "_set_workflow_status", fake_set_workflow_status)
    monkeypatch.setattr(workflows, "_set_step_status", fake_set_step_status)
    monkeypatch.setattr(orchestrator, "run_agent_task", fake_run_agent_task)

    await workflows.execute_workflow(100)

    assert status_calls == ["running", "completed"]
    assert step_status_calls == [(1, "running"), (1, "done"), (2, "running"), (2, "done")]


@pytest.mark.asyncio
async def test_execute_workflow_halts_when_step_requires_approval(monkeypatch):
    _patch_events_and_agent(monkeypatch)
    workflow = {"id": 100, "steps": [_step(1, 0, requires_approval=True), _step(2, 1)]}

    async def fake_get_workflow(workflow_id):
        return workflow

    status_calls = []

    async def fake_set_workflow_status(workflow_id, status):
        status_calls.append(status)

    step_status_calls = []

    async def fake_set_step_status(step_id, status, **fields):
        step_status_calls.append((step_id, status))

    approval_calls = []

    async def fake_create_approval(workflow_step_id, requested_by):
        approval_calls.append(workflow_step_id)
        return {"id": 1}

    run_agent_calls = []

    async def fake_run_agent_task(agent, task_text):
        run_agent_calls.append(agent)
        return {"output": "done", "model_used": "x", "error": None, "tokens": None, "cost_usd": None}

    monkeypatch.setattr(workflows, "get_workflow", fake_get_workflow)
    monkeypatch.setattr(workflows, "_set_workflow_status", fake_set_workflow_status)
    monkeypatch.setattr(workflows, "_set_step_status", fake_set_step_status)
    monkeypatch.setattr(approvals, "create_approval", fake_create_approval)
    monkeypatch.setattr(orchestrator, "run_agent_task", fake_run_agent_task)

    await workflows.execute_workflow(100)

    assert status_calls == ["running"]  # never reaches completed/failed
    assert step_status_calls == [(1, "waiting_approval")]
    assert approval_calls == [1]
    assert run_agent_calls == []  # step 2 never runs — halted


@pytest.mark.asyncio
async def test_execute_workflow_fails_and_halts_when_step_fails(monkeypatch):
    _patch_events_and_agent(monkeypatch)
    workflow = {"id": 100, "steps": [_step(1, 0), _step(2, 1)]}

    async def fake_get_workflow(workflow_id):
        return workflow

    status_calls = []

    async def fake_set_workflow_status(workflow_id, status):
        status_calls.append(status)

    step_status_calls = []

    async def fake_set_step_status(step_id, status, **fields):
        step_status_calls.append((step_id, status))

    run_agent_calls = []

    async def fake_run_agent_task(agent, task_text):
        run_agent_calls.append(agent)
        return {"output": "", "model_used": None, "error": "LLM exploded", "tokens": None, "cost_usd": None}

    monkeypatch.setattr(workflows, "get_workflow", fake_get_workflow)
    monkeypatch.setattr(workflows, "_set_workflow_status", fake_set_workflow_status)
    monkeypatch.setattr(workflows, "_set_step_status", fake_set_step_status)
    monkeypatch.setattr(orchestrator, "run_agent_task", fake_run_agent_task)

    await workflows.execute_workflow(100)

    assert status_calls == ["running", "failed"]
    assert step_status_calls == [(1, "running"), (1, "failed")]
    assert len(run_agent_calls) == 1  # step 2 never attempted


@pytest.mark.asyncio
async def test_execute_workflow_warns_and_returns_for_missing_workflow(monkeypatch):
    async def fake_get_workflow(workflow_id):
        return None

    monkeypatch.setattr(workflows, "get_workflow", fake_get_workflow)
    # Should not raise even though nothing else is mocked.
    await workflows.execute_workflow(9999)


# ── resume_step_after_approval / mark_step_rejected ──────────────────────────

@pytest.mark.asyncio
async def test_resume_step_after_approval_continues_workflow(monkeypatch):
    _patch_events_and_agent(monkeypatch)
    step_row = _step(5, 1, status="waiting_approval")

    async def fake_fetchrow(query, *args):
        return step_row

    async def fake_run_agent_task(agent, task_text):
        return {"output": "approved and done", "model_used": "x", "error": None,
                "tokens": None, "cost_usd": None}

    step_status_calls = []

    async def fake_set_step_status(step_id, status, **fields):
        step_status_calls.append((step_id, status))

    created_tasks = []

    def fake_create_task(coro):
        created_tasks.append(coro)
        coro.close()  # don't actually run the continuation in this test

    monkeypatch.setattr(workflows, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(workflows, "_set_step_status", fake_set_step_status)
    monkeypatch.setattr(orchestrator, "run_agent_task", fake_run_agent_task)
    monkeypatch.setattr(workflows.asyncio, "create_task", fake_create_task)

    await workflows.resume_step_after_approval(5)

    assert step_status_calls == [(5, "running"), (5, "done")]
    assert len(created_tasks) == 1  # execute_workflow was scheduled to continue


@pytest.mark.asyncio
async def test_resume_step_after_approval_fails_workflow_when_step_fails(monkeypatch):
    _patch_events_and_agent(monkeypatch)
    step_row = _step(6, 1, status="waiting_approval")

    async def fake_fetchrow(query, *args):
        return step_row

    async def fake_run_agent_task(agent, task_text):
        return {"output": "", "model_used": None, "error": "boom", "tokens": None, "cost_usd": None}

    workflow_status_calls = []

    async def fake_set_workflow_status(workflow_id, status):
        workflow_status_calls.append((workflow_id, status))

    step_status_calls = []

    async def fake_set_step_status(step_id, status, **fields):
        step_status_calls.append((step_id, status))

    created_tasks = []

    def fake_create_task(coro):
        created_tasks.append(coro)
        coro.close()

    monkeypatch.setattr(workflows, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(workflows, "_set_step_status", fake_set_step_status)
    monkeypatch.setattr(workflows, "_set_workflow_status", fake_set_workflow_status)
    monkeypatch.setattr(orchestrator, "run_agent_task", fake_run_agent_task)
    monkeypatch.setattr(workflows.asyncio, "create_task", fake_create_task)

    await workflows.resume_step_after_approval(6)

    assert workflow_status_calls == [(100, "failed")]
    assert created_tasks == []  # workflow is NOT resumed after a step failure


@pytest.mark.asyncio
async def test_mark_step_rejected_fails_workflow(monkeypatch):
    async def fake_fetchrow(query, *args):
        return {"workflow_id": 100}

    step_status_calls = []

    async def fake_set_step_status(step_id, status, **fields):
        step_status_calls.append((step_id, status, fields))

    workflow_status_calls = []

    async def fake_set_workflow_status(workflow_id, status):
        workflow_status_calls.append((workflow_id, status))

    async def fake_publish(topic, payload, source=""):
        return {"topic": topic}

    monkeypatch.setattr(workflows, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(workflows, "_set_step_status", fake_set_step_status)
    monkeypatch.setattr(workflows, "_set_workflow_status", fake_set_workflow_status)
    monkeypatch.setattr(bus, "publish", fake_publish)

    await workflows.mark_step_rejected(9)

    assert step_status_calls == [(9, "failed", {"error": "Rejected by approver"})]
    assert workflow_status_calls == [(100, "failed")]
