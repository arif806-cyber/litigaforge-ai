"""
ForgeOS Mission Engine — single-goal agent tasks with a small state machine:

    draft -> pending_approval -> approved -> running -> completed
                               \\-> rejected/cancelled       \\-> failed
    draft -> approved -> running -> completed/failed   (when no approval required)

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
    "draft", "pending_approval", "approved", "running",
    "completed", "failed", "cancelled",
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

    initial_status = "pending_approval" if requires_approval else "approved"

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


async def mark_approved_and_run(mission_id: int) -> None:
    await _set_status(mission_id, "approved")
    asyncio.create_task(execute_mission(mission_id))


async def mark_rejected(mission_id: int) -> None:
    await _set_status(mission_id, "cancelled", error="Rejected by approver")
    await bus.publish("mission.cancelled", {"mission_id": mission_id}, source="approvals")


async def execute_mission(mission_id: int) -> None:
    """Run a mission's agent task. Bounded by the module-level semaphore so
    at most FORGEOS_MAX_CONCURRENT_MISSIONS run their LLM call at once."""
    mission = await get_mission(mission_id)
    if not mission:
        logger.warning("forgeos: execute_mission called for missing mission %s", mission_id)
        return
    if mission["status"] not in ("approved",):
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

        from forgeos.orchestrator import run_agent_task
        task_text = mission["description"] or mission["title"]
        try:
            outcome = await run_agent_task(agent, task_text)
        except Exception as e:
            logger.error("forgeos: mission %s crashed: %s", mission_id, e, exc_info=True)
            await _set_status(mission_id, "failed", error=str(e))
            await bus.publish("mission.failed", {"mission_id": mission_id, "error": str(e)}, source="missions")
            return

        if outcome.get("error"):
            await _set_status(mission_id, "failed", error=outcome["error"])
            await bus.publish("mission.failed", {"mission_id": mission_id, "error": outcome["error"]},
                               source="missions")
            return

        result_json = json.dumps({"output": outcome["output"], "model_used": outcome["model_used"]})
        await _set_status(mission_id, "completed", result=result_json)
        await bus.publish("mission.completed", {"mission_id": mission_id}, source="missions")
