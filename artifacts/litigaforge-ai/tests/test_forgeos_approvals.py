"""
ForgeOS Approval Engine — unit tests with a mocked DB layer.
"""
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos import approvals


def _approval_row(status="pending", **overrides):
    row = {
        "id": 1, "mission_id": 1, "workflow_step_id": None, "status": status,
        "requested_by": "mission_engine", "reviewed_by": None, "reason": "",
        "created_at": "2026-07-02T00:00:00", "reviewed_at": None,
    }
    row.update(overrides)
    return row


@pytest.mark.asyncio
async def test_create_approval_requires_mission_or_step():
    with pytest.raises(ValueError):
        await approvals.create_approval()


@pytest.mark.asyncio
async def test_approve_pending_mission_resumes_mission(monkeypatch):
    async def fake_get_approval(approval_id):
        return _approval_row(status="pending")

    async def fake_fetchrow(query, *args):
        return _approval_row(status="approved", reviewed_by=42)

    resumed = []

    async def fake_mark_approved_and_run(mission_id):
        resumed.append(mission_id)

    monkeypatch.setattr(approvals, "get_approval", fake_get_approval)
    monkeypatch.setattr(approvals, "fetchrow", fake_fetchrow)
    from forgeos import missions
    monkeypatch.setattr(missions, "mark_approved_and_run", fake_mark_approved_and_run)

    result = await approvals.approve(1, reviewer_id=42)
    assert result["status"] == "approved"
    assert resumed == [1]


@pytest.mark.asyncio
async def test_approve_already_decided_raises(monkeypatch):
    async def fake_get_approval(approval_id):
        return _approval_row(status="approved")

    monkeypatch.setattr(approvals, "get_approval", fake_get_approval)

    with pytest.raises(ValueError):
        await approvals.approve(1, reviewer_id=42)


@pytest.mark.asyncio
async def test_approve_missing_raises(monkeypatch):
    async def fake_get_approval(approval_id):
        return None

    monkeypatch.setattr(approvals, "get_approval", fake_get_approval)

    with pytest.raises(ValueError):
        await approvals.approve(999, reviewer_id=42)


@pytest.mark.asyncio
async def test_reject_pending_mission_cancels_mission(monkeypatch):
    async def fake_get_approval(approval_id):
        return _approval_row(status="pending")

    async def fake_fetchrow(query, *args):
        return _approval_row(status="rejected", reviewed_by=42, reason="not needed")

    cancelled = []

    async def fake_mark_rejected(mission_id):
        cancelled.append(mission_id)

    monkeypatch.setattr(approvals, "get_approval", fake_get_approval)
    monkeypatch.setattr(approvals, "fetchrow", fake_fetchrow)
    from forgeos import missions
    monkeypatch.setattr(missions, "mark_rejected", fake_mark_rejected)

    result = await approvals.reject(1, reviewer_id=42, reason="not needed")
    assert result["status"] == "rejected"
    assert cancelled == [1]
