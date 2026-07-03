"""
ForgeOS Mission Engine — single-goal agent tasks with a small state machine:

    planned -> waiting -> assigned -> running -> completed
                        \\-> cancelled            \\-> reviewing -> completed
                                                   \\-> failed
    planned -> assigned -> running -> completed/failed   (when no approval required)

"reviewing" is a valid terminal-adjacent state (e.g. a QA/founder review pass
before a mission is considered done) that callers — workflows or a human
reviewer — can move a mission into; the engine itself doesn't force every
mission through it.

A concurrency cap (asyncio.Semaphore) bounds how many missions execute their
LLM call at once, so ForgeOS never starves the rest of the FastAPI event loop.
"""
import asyncio
import json

from database import fetch, fetchrow
from logger import get_logger
from forgeos.config import FORGEOS_MAX_CONCURRENT_MISSIONS, FORGEOS_MAX_INPUT_CHARS
from forgeos import registry
from forgeos.events import bus

logger = get_logger("litigaforge.forgeos")

_semaphore = asyncio.Semaphore(FORGEOS_MAX_CONCURRENT_MISSIONS)

VALID_STATUSES = (
    "planned", "waiting", "assigned", "running",
    "reviewing", "completed", "failed", "cancelled",
)


def _serialize(row: dict) -> dict:
    row = dict(row)
    row["created_at"] = str(row["created_at"])
    row["updated_at"] = str(row["updated_at"])
    return row


async def create_mission(title: str, description: str = "", agent_id: int | None = None,
                          agent_name: str | None = None, input_data: dict | None = None,
                          requires_approval: bool = False,
                          created_by: int | None = None) -> dict:
    input_data = input_data or {}
    task_text = json.dumps(input_data, default=str)
    if len(task_text) > FORGEOS_MAX_INPUT_CHARS:
        raise ValueError(f"Mission input exceeds {FORGEOS_MAX_INPUT_CHARS} characters")

    if agent_id is None and agent_name:
        agent = await registry.get_agent_by_name(agent_name)
        if not agent:
            raise ValueError(f"Unknown agent '{agent_name}'")
        agent_id = agent["id"]

    initial_status = "waiting" if requires_approval else "assigned"

    row = await fetchrow(
        """INSERT INTO forgeos_missions
               (title, description, agent_id, status, requires_approval, input, created_by)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
           RETURNING id, title, description, agent_id, status, requires_approval,
                     input, result, error, created_by, created_at, updated_at""",
        title.strip(), description.strip(), agent_id, initial_status,
        requires_approval, task_text, created_by,
    )
    mission = _serialize(row)

    await bus.publish("mission.created", {"mission_id": mission["id"], "status": mission["status"]},
                       source="missions")

    if requires_approval:
        from forgeos.approvals import create_approval
        await create_approval(mission_id=mission["id"], requested_by="mission_engine")
    else:
        asyncio.create_task(execute_mission(mission["id"]))

    return mission


async def get_mission(mission_id: int) -> dict | None:
    row = await fetchrow(
        """SELECT id, title, description, agent_id, status, requires_approval,
                  input, result, error, created_by, created_at, updated_at
           FROM forgeos_missions WHERE id = $1""",
        mission_id,
    )
    return _serialize(row) if row else None


async def list_missions(status: str | None = None, limit: int = 50) -> list[dict]:
    limit = max(1, min(limit, 200))
    if status:
        rows = await fetch(
            """SELECT id, title, description, agent_id, status, requires_approval,
                      input, result, error, created_by, created_at, updated_at
               FROM forgeos_missions WHERE status = $1
               ORDER BY created_at DESC LIMIT $2""",
            status, limit,
        )
    else:
        rows = await fetch(
            """SELECT id, title, description, agent_id, status, requires_approval,
                      input, result, error, created_by, created_at, updated_at
               FROM forgeos_missions ORDER BY created_at DESC LIMIT $1""",
            limit,
        )
    return [_serialize(r) for r in rows]


_JSONB_FIELDS = {"result", "input"}


async def _set_status(mission_id: int, status: str, **fields) -> None:
    sets = ["status = $2", "updated_at = NOW()"]
    args: list = [mission_id, status]
    idx = 3
    for key, value in fields.items():
        cast = "::jsonb" if key in _JSONB_FIELDS else ""
        sets.append(f"{key} = ${idx}{cast}")
        args.append(value)
        idx += 1
    await fetchrow(
        f"UPDATE forgeos_missions SET {', '.join(sets)} WHERE id = $1 RETURNING id",
        *args,
    )


async def _still_owns(mission_id: int, agent_id: int) -> bool:
    """Guard against a race with the stuck-mission scheduler sweep: if a
    mission ran long enough to be reassigned to another agent while this
    coroutine was still mid-flight (e.g. a slow fallback cascade past the
    'stuck running' threshold), the original coroutine must NOT clobber the
    reassigned mission's state when it finally finishes."""
    row = await fetchrow("SELECT agent_id, status FROM forgeos_missions WHERE id = $1", mission_id)
    return bool(row) and row["agent_id"] == agent_id and row["status"] == "running"


async def mark_approved_and_run(mission_id: int) -> None:
    await _set_status(mission_id, "assigned")
    asyncio.create_task(execute_mission(mission_id))


async def mark_rejected(mission_id: int) -> None:
    await _set_status(mission_id, "cancelled", error="Rejected by approver")
    await bus.publish("mission.cancelled", {"mission_id": mission_id}, source="approvals")


async def _record_llm_metrics(agent_id: int | None, mission_id: int, outcome: dict) -> None:
    """Persist real token usage / USD cost for a completed LLM call into
    forgeos_metrics — the source of truth for the dashboard's AI Cost widget.
    No-op when the path taken (e.g. the ai_brain fallback cascade) doesn't
    report usage; we never fabricate a number."""
    from database import execute as _execute
    tokens = outcome.get("tokens")
    if tokens:
        await _execute(
            """INSERT INTO forgeos_metrics (metric_type, agent_id, mission_id, value, unit, meta)
               VALUES ('llm_tokens', $1, $2, $3, 'tokens', $4::jsonb)""",
            agent_id, mission_id, tokens["total"], json.dumps(tokens),
        )
    cost_usd = outcome.get("cost_usd")
    if cost_usd is not None:
        await _execute(
            """INSERT INTO forgeos_metrics (metric_type, agent_id, mission_id, value, unit, meta)
               VALUES ('llm_cost_usd', $1, $2, $3, 'usd', $4::jsonb)""",
            agent_id, mission_id, cost_usd, json.dumps({"model": outcome.get("model_used")}),
        )


async def execute_mission(mission_id: int) -> None:
    """Run a mission's agent task. Bounded by the module-level semaphore so
    at most FORGEOS_MAX_CONCURRENT_MISSIONS run their LLM call at once."""
    mission = await get_mission(mission_id)
    if not mission:
        logger.warning("forgeos: execute_mission called for missing mission %s", mission_id)
        return
    if mission["status"] not in ("assigned",):
        logger.warning("forgeos: execute_mission called for mission %s in status %s — skipping",
                        mission_id, mission["status"])
        return

    async with _semaphore:
        await _set_status(mission_id, "running")
        await bus.publish("mission.started", {"mission_id": mission_id}, source="missions")

        agent = await registry.get_agent(mission["agent_id"]) if mission["agent_id"] else None
        if not agent:
            await _set_status(mission_id, "failed", error="No agent assigned to mission")
            await bus.publish("mission.failed", {"mission_id": mission_id, "error": "No agent assigned"},
                               source="missions")
            return

        await registry.update_agent_activity(agent["id"], current_mission_id=mission_id, progress=10)

        from forgeos.orchestrator import run_agent_task
        task_text = mission["description"] or mission["title"]
        try:
            outcome = await run_agent_task(agent, task_text)
        except Exception as e:
            logger.error("forgeos: mission %s crashed: %s", mission_id, e, exc_info=True)
            if not await _still_owns(mission_id, agent["id"]):
                logger.warning("forgeos: mission %s was reassigned mid-flight — discarding stale crash result",
                                mission_id)
                return
            await _set_status(mission_id, "failed", error=str(e))
            await bus.publish("mission.failed", {"mission_id": mission_id, "error": str(e)}, source="missions")
            await registry.update_agent_activity(agent["id"], current_mission_id=None, progress=0)
            await registry.bump_agent_kpi(agent["id"], "missions_failed")
            return

        if not await _still_owns(mission_id, agent["id"]):
            logger.warning("forgeos: mission %s was reassigned mid-flight — discarding stale outcome",
                            mission_id)
            return

        if outcome.get("error"):
            await _set_status(mission_id, "failed", error=outcome["error"])
            await bus.publish("mission.failed", {"mission_id": mission_id, "error": outcome["error"]},
                               source="missions")
            await registry.update_agent_activity(agent["id"], current_mission_id=None, progress=0)
            await registry.bump_agent_kpi(agent["id"], "missions_failed")
            return

        await _record_llm_metrics(agent["id"], mission_id, outcome)

        result_json = json.dumps({"output": outcome["output"], "model_used": outcome["model_used"]})
        await _set_status(mission_id, "completed", result=result_json)
        await bus.publish("mission.completed", {"mission_id": mission_id}, source="missions")
        await registry.update_agent_activity(agent["id"], current_mission_id=None, progress=100)
        await registry.bump_agent_kpi(agent["id"], "missions_completed")
