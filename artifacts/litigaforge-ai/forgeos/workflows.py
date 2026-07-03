"""
ForgeOS Workflow Engine — ordered, multi-step, multi-agent sequences.

Step state machine: pending -> running -> waiting_approval -> done/failed
                              \\-> done/failed  (when no approval required)

Workflows execute steps strictly in step_order. A failed or
awaiting-approval step halts the sequence; later steps stay "pending"
until the blocking step resolves.
"""
import asyncio
import json

from database import execute, fetch, fetchrow
from logger import get_logger
from forgeos.config import FORGEOS_MAX_INPUT_CHARS
from forgeos import registry
from forgeos.events import bus

logger = get_logger("litigaforge.forgeos")


def _serialize_step(row: dict) -> dict:
    row = dict(row)
    row["created_at"] = str(row["created_at"])
    row["updated_at"] = str(row["updated_at"])
    return row


def _serialize_workflow(row: dict) -> dict:
    row = dict(row)
    row["created_at"] = str(row["created_at"])
    row["updated_at"] = str(row["updated_at"])
    return row


async def create_workflow(mission_id: int | None, name: str, steps: list[dict]) -> dict:
    """steps: list of {name, agent_id?, agent_name?, input?, requires_approval?}"""
    if not steps:
        raise ValueError("A workflow needs at least one step")

    workflow = await fetchrow(
        """INSERT INTO forgeos_workflows (mission_id, name, status)
           VALUES ($1, $2, 'pending')
           RETURNING id, mission_id, name, status, created_at, updated_at""",
        mission_id, name.strip(),
    )
    workflow = _serialize_workflow(workflow)

    for order, step in enumerate(steps):
        agent_id = step.get("agent_id")
        agent_name = step.get("agent_name")
        if agent_id is None and agent_name:
            agent = await registry.get_agent_by_name(agent_name)
            if not agent:
                raise ValueError(f"Unknown agent '{agent_name}' in step {order}")
            agent_id = agent["id"]

        input_data = step.get("input") or {}
        input_text = json.dumps(input_data, default=str)
        if len(input_text) > FORGEOS_MAX_INPUT_CHARS:
            raise ValueError(f"Step {order} input exceeds {FORGEOS_MAX_INPUT_CHARS} characters")

        await execute(
            """INSERT INTO forgeos_workflow_steps
                   (workflow_id, step_order, agent_id, name, requires_approval, input)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb)""",
            workflow["id"], order, agent_id, step.get("name", f"step-{order}"),
            bool(step.get("requires_approval", False)), input_text,
        )

    logger.info("forgeos: workflow %s created — name=%r steps=%d", workflow["id"], workflow["name"], len(steps))

    asyncio.create_task(execute_workflow(workflow["id"]))
    return workflow


async def get_workflow(workflow_id: int) -> dict | None:
    workflow = await fetchrow(
        """SELECT id, mission_id, name, status, created_at, updated_at
           FROM forgeos_workflows WHERE id = $1""",
        workflow_id,
    )
    if not workflow:
        return None
    workflow = _serialize_workflow(workflow)
    steps = await fetch(
        """SELECT id, workflow_id, step_order, agent_id, name, status,
                  requires_approval, input, output, error, created_at, updated_at
           FROM forgeos_workflow_steps WHERE workflow_id = $1 ORDER BY step_order""",
        workflow_id,
    )
    workflow["steps"] = [_serialize_step(s) for s in steps]
    return workflow


async def _set_workflow_status(workflow_id: int, status: str) -> None:
    await execute(
        "UPDATE forgeos_workflows SET status = $1, updated_at = NOW() WHERE id = $2",
        status, workflow_id,
    )


async def _set_step_status(step_id: int, status: str, **fields) -> None:
    sets = ["status = $2", "updated_at = NOW()"]
    args: list = [step_id, status]
    idx = 3
    for key, value in fields.items():
        cast = "::jsonb" if key == "output" else ""
        sets.append(f"{key} = ${idx}{cast}")
        args.append(value)
        idx += 1
    await execute(
        f"UPDATE forgeos_workflow_steps SET {', '.join(sets)} WHERE id = $1",
        *args,
    )


async def execute_workflow(workflow_id: int) -> None:
    """Run steps in order until completion, failure, or an approval gate."""
    workflow = await get_workflow(workflow_id)
    if not workflow:
        logger.warning("forgeos: execute_workflow called for missing workflow %s", workflow_id)
        return

    await _set_workflow_status(workflow_id, "running")
    await bus.publish("workflow.started", {"workflow_id": workflow_id}, source="workflows")

    for step in workflow["steps"]:
        if step["status"] not in ("pending",):
            continue

        if step["requires_approval"]:
            await _set_step_status(step["id"], "waiting_approval")
            from forgeos.approvals import create_approval
            await create_approval(workflow_step_id=step["id"], requested_by="workflow_engine")
            logger.info("forgeos: workflow %s halted at step %s (%r) — awaiting approval",
                        workflow_id, step["id"], step.get("name"))
            await bus.publish("workflow.step.waiting_approval",
                               {"workflow_id": workflow_id, "step_id": step["id"]}, source="workflows")
            return  # halt — resumed via resume_step_after_approval()

        ok = await _run_step(step)
        if not ok:
            logger.warning("forgeos: workflow %s failed at step %s (%r)",
                            workflow_id, step["id"], step.get("name"))
            await _set_workflow_status(workflow_id, "failed")
            await bus.publish("workflow.failed", {"workflow_id": workflow_id, "step_id": step["id"]},
                               source="workflows")
            return

    logger.info("forgeos: workflow %s completed", workflow_id)
    await _set_workflow_status(workflow_id, "completed")
    await bus.publish("workflow.completed", {"workflow_id": workflow_id}, source="workflows")


async def _run_step(step: dict) -> bool:
    """Execute a single step's agent task. Returns True on success."""
    await _set_step_status(step["id"], "running")

    agent = await registry.get_agent(step["agent_id"]) if step["agent_id"] else None
    if not agent:
        await _set_step_status(step["id"], "failed", error="No agent assigned to step")
        return False

    from forgeos.orchestrator import run_agent_task
    task_text = json.dumps(step["input"]) if isinstance(step["input"], dict) else str(step["input"])
    try:
        outcome = await run_agent_task(agent, task_text)
    except Exception as e:
        logger.error("forgeos: workflow step %s crashed: %s", step["id"], e, exc_info=True)
        await _set_step_status(step["id"], "failed", error=str(e))
        return False

    if outcome.get("error"):
        await _set_step_status(step["id"], "failed", error=outcome["error"])
        return False

    if outcome.get("cost_usd") is not None:
        logger.info("forgeos: workflow step %s completed — model=%s tokens=%s cost=$%.4f",
                    step["id"], outcome["model_used"], outcome.get("tokens"), outcome["cost_usd"])
    else:
        logger.info("forgeos: workflow step %s completed — model=%s (fallback path, no usage reported)",
                    step["id"], outcome["model_used"])

    output_json = json.dumps({"output": outcome["output"], "model_used": outcome["model_used"]})
    await _set_step_status(step["id"], "done", output=output_json)
    return True


async def resume_step_after_approval(step_id: int) -> None:
    step = await fetchrow(
        """SELECT id, workflow_id, step_order, agent_id, name, status,
                  requires_approval, input, output, error, created_at, updated_at
           FROM forgeos_workflow_steps WHERE id = $1""",
        step_id,
    )
    if not step:
        logger.warning("forgeos: resume_step_after_approval called for missing step %s", step_id)
        return
    step = _serialize_step(step)

    ok = await _run_step(step)
    if not ok:
        await _set_workflow_status(step["workflow_id"], "failed")
        await bus.publish("workflow.failed", {"workflow_id": step["workflow_id"], "step_id": step_id},
                           source="workflows")
        return

    asyncio.create_task(execute_workflow(step["workflow_id"]))


async def mark_step_rejected(step_id: int) -> None:
    step = await fetchrow("SELECT workflow_id FROM forgeos_workflow_steps WHERE id = $1", step_id)
    await _set_step_status(step_id, "failed", error="Rejected by approver")
    if step:
        await _set_workflow_status(step["workflow_id"], "failed")
        await bus.publish("workflow.failed", {"workflow_id": step["workflow_id"], "step_id": step_id},
                           source="approvals")
