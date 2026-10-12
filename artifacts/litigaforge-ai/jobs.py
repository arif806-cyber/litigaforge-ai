"""Durable, user-scoped background AI jobs."""
import asyncio
import inspect
import json
import logging
import uuid
from contextvars import ContextVar
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response

from auth import get_current_user
from database import execute, fetchrow

logger = logging.getLogger("litigaforge.jobs")
router = APIRouter(tags=["jobs"])
_tasks: set[asyncio.Task] = set()
_current_job_id: ContextVar[uuid.UUID | None] = ContextVar("current_ai_job_id", default=None)
AI_JOB_TIMEOUT_SECONDS = 9 * 60


async def enqueue_job(user_id: int | None, worker: Callable[[], Any]) -> dict:
    """Persist and schedule work, returning the polling contract immediately."""
    job_id = uuid.uuid4()
    await execute(
        "INSERT INTO ai_jobs (id, user_id, status) VALUES ($1, $2, 'queued')",
        job_id, user_id,
    )
    task = asyncio.create_task(_run_job(job_id, worker))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"job_id": str(job_id), "status": "queued"}


async def _run_job(job_id: uuid.UUID, worker: Callable[[], Any]) -> None:
    token = _current_job_id.set(job_id)
    try:
        async with asyncio.timeout(AI_JOB_TIMEOUT_SECONDS):
            await execute(
                "UPDATE ai_jobs SET status='running', started_at=NOW(), updated_at=NOW() WHERE id=$1",
                job_id,
            )
            value = await asyncio.to_thread(worker)
            result = await value if inspect.isawaitable(value) else value
            await execute(
                """UPDATE ai_jobs SET status='completed', result=$2::jsonb,
                   completed_at=NOW(), updated_at=NOW() WHERE id=$1""",
                job_id, json.dumps(result, default=str),
            )
    except TimeoutError:
        message = f"AI job exceeded its {AI_JOB_TIMEOUT_SECONDS // 60}-minute limit. Retry the analysis."
        logger.error("AI job %s timed out after %s seconds", job_id, AI_JOB_TIMEOUT_SECONDS)
        await execute(
            """UPDATE ai_jobs SET status='failed', error=$2,
               completed_at=NOW(), updated_at=NOW() WHERE id=$1""",
            job_id, message,
        )
    except Exception as exc:
        logger.exception("AI job %s failed", job_id)
        await execute(
            """UPDATE ai_jobs SET status='failed', error=$2,
               completed_at=NOW(), updated_at=NOW() WHERE id=$1""",
            job_id, str(exc)[:2000],
        )
    finally:
        _current_job_id.reset(token)


async def collect_sse(generator) -> dict:
    """Collect an existing SSE generator without losing its meaningful events."""
    events: list[dict] = []
    async for chunk in generator:
        if not isinstance(chunk, str) or not chunk.startswith("data:"):
            continue
        try:
            events.append(json.loads(chunk[5:].strip()))
        except (TypeError, json.JSONDecodeError):
            continue
        job_id = _current_job_id.get()
        if job_id:
            await execute(
                """UPDATE ai_jobs SET result=$2::jsonb, updated_at=NOW()
                   WHERE id=$1 AND status='running'""",
                job_id, json.dumps({"events": events}, default=str),
            )
    final = events[-1] if events else {}
    return {"events": events, "final": final}


@router.get("/jobs/{job_id}/status")
async def job_status(
    job_id: uuid.UUID,
    response: Response,
    current_user: dict | None = Depends(get_current_user),
):
    response.headers["Cache-Control"] = "no-store"
    row = await fetchrow(
        "SELECT id, user_id, status, result, error FROM ai_jobs WHERE id=$1", job_id
    )
    if not row:
        raise HTTPException(404, "Job not found")
    # Authenticated jobs are never capability URLs: ownership is mandatory.
    if row["user_id"] is not None and (
        current_user is None or current_user["id"] != row["user_id"]
    ):
        raise HTTPException(404, "Job not found")
    result = {"job_id": str(row["id"]), "status": row["status"]}
    if row["status"] == "running" and row["result"]:
        progress = row["result"]
        if isinstance(progress, str):
            try:
                progress = json.loads(progress)
            except json.JSONDecodeError:
                progress = None
        if isinstance(progress, dict):
            result["progress"] = progress
    if row["status"] == "completed":
        stored = row["result"]
        if isinstance(stored, str):
            try:
                stored = json.loads(stored)
            except json.JSONDecodeError:
                pass
        result["result"] = stored
    elif row["status"] == "failed":
        result["error"] = row["error"] or "Job failed"
    return result