import asyncio
import os
import sys
import threading
import uuid

import pytest
from fastapi import HTTPException, Response

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("SESSION_SECRET", "test-secret-123456789012345678901234567890")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

import jobs


@pytest.mark.asyncio
async def test_run_job_persists_result_and_offloads_sync_worker(monkeypatch):
    calls = []
    main_thread = threading.get_ident()

    async def fake_execute(sql, *args):
        calls.append((sql, args))

    monkeypatch.setattr(jobs, "execute", fake_execute)
    job_id = uuid.uuid4()

    def worker():
        return {"thread_offloaded": threading.get_ident() != main_thread}

    await jobs._run_job(job_id, worker)

    assert "status='running'" in calls[0][0]
    assert "status='completed'" in calls[1][0]
    assert '"thread_offloaded": true' in calls[1][1][1]


@pytest.mark.asyncio
async def test_status_is_user_scoped(monkeypatch):
    job_id = uuid.uuid4()

    async def fake_fetchrow(*_args):
        return {
            "id": job_id,
            "user_id": 7,
            "status": "completed",
            "result": {"reply": "done"},
            "error": None,
        }

    monkeypatch.setattr(jobs, "fetchrow", fake_fetchrow)
    response = Response()
    result = await jobs.job_status(job_id, response, {"id": 7})
    assert result == {
        "job_id": str(job_id),
        "status": "completed",
        "result": {"reply": "done"},
    }
    assert response.headers["cache-control"] == "no-store"

    with pytest.raises(HTTPException) as exc:
        await jobs.job_status(job_id, Response(), {"id": 8})
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_anonymous_job_is_uuid_capability(monkeypatch):
    job_id = uuid.uuid4()

    async def fake_fetchrow(*_args):
        return {
            "id": job_id,
            "user_id": None,
            "status": "running",
            "result": None,
            "error": None,
        }

    monkeypatch.setattr(jobs, "fetchrow", fake_fetchrow)
    assert await jobs.job_status(job_id, Response(), None) == {
        "job_id": str(job_id),
        "status": "running",
    }