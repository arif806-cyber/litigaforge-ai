"""Durable, user-scoped background AI jobs."""
import asyncio
import inspect
import json
import logging
import uuid
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response

from auth import get_current_user
from database import execute, fetchrow

logger = logging.getLogger("litigaforge.jobs")
router = APIRouter(tags=["jobs"])
_tasks: set[asyncio.Task] = set()


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
    try:
        await execute(
            "UPDATE ai_jobs SET status='running', started_at=NOW(), updated_at=NOW() WHERE id=$1",
            job_id,
        )
        # Calling even an ordinary lambda happens in a worker thread.  This
        # guarantees synchronous SDK/provider setup cannot stall FastAPI's loop.
        value = await asyncio.to_thread(worker)
        result = await value if inspect.isawaitable(value) else value
        await execute(
            """UPDATE ai_jobs SET status='completed', result=$2::jsonb,
               completed_at=NOW(), updated_at=NOW() WHERE id=$1""",
            job_id, json.dumps(result, default=str),
        )
    except Exception as exc:
        logger.exception("AI job %s failed", job_id)
        await execute(
            """UPDATE ai_jobs SET status='failed', error=$2,
               completed_at=NOW(), updated_at=NOW() WHERE id=$1""",
            job_id, str(exc)[:2000],
        )


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