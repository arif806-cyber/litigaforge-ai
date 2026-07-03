"""
ForgeOS Approval Engine — human-in-the-loop gates for missions and workflow
steps. An approval row is created whenever a mission (or workflow step) is
flagged requires_approval; nothing proceeds until a superuser approves or
rejects it via the REST API.

Missions/workflows import this module to *create* approval requests.
This module lazy-imports missions/workflows *inside* approve()/reject() to
resume/cancel them — this avoids a circular import at module load time
while still letting the approval decision drive the state machine forward.
"""
from datetime import datetime, timezone

from database import fetch, fetchrow
from logger import get_logger

logger = get_logger("litigaforge.forgeos")

VALID_STATUSES = ("pending", "approved", "rejected")


async def create_approval(mission_id: int | None = None,
                           workflow_step_id: int | None = None,
                           requested_by: str = "system",
                           reason: str = "") -> dict:
    if mission_id is None and workflow_step_id is None:
        raise ValueError("create_approval requires mission_id or workflow_step_id")
    row = await fetchrow(
        """INSERT INTO forgeos_approvals (mission_id, workflow_step_id, requested_by, reason)
           VALUES ($1, $2, $3, $4)
           RETURNING id, mission_id, workflow_step_id, status, requested_by, reason,
                     created_at, reviewed_at""",
        mission_id, workflow_step_id, requested_by, reason,
    )
    return _serialize(row)


async def get_approval(approval_id: int) -> dict | None:
    row = await fetchrow(
        """SELECT id, mission_id, workflow_step_id, status, requested_by,
                  reviewed_by, reason, created_at, reviewed_at
           FROM forgeos_approvals WHERE id = $1""",
        approval_id,
    )
    return _serialize(row) if row else None


async def list_approvals(status: str | None = None) -> list[dict]:
    if status:
        rows = await fetch(
            """SELECT id, mission_id, workflow_step_id, status, requested_by,
                      reviewed_by, reason, created_at, reviewed_at
               FROM forgeos_approvals WHERE status = $1 ORDER BY created_at DESC""",
            status,
        )
    else:
        rows = await fetch(
            """SELECT id, mission_id, workflow_step_id, status, requested_by,
                      reviewed_by, reason, created_at, reviewed_at
               FROM forgeos_approvals ORDER BY created_at DESC"""
        )
    return [_serialize(r) for r in rows]


async def approve(approval_id: int, reviewer_id: int) -> dict:
    approval = await get_approval(approval_id)
    if not approval:
        raise ValueError("Approval not found")
    if approval["status"] != "pending":
        raise ValueError(f"Approval already {approval['status']}")

    row = await fetchrow(
        """UPDATE forgeos_approvals
           SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
           WHERE id = $2
           RETURNING id, mission_id, workflow_step_id, status, requested_by,
                     reviewed_by, reason, created_at, reviewed_at""",
        reviewer_id, approval_id,
    )
    result = _serialize(row)

    logger.info(
        "forgeos: approval %s approved by user %s (mission_id=%s workflow_step_id=%s)",
        approval_id, reviewer_id, result["mission_id"], result["workflow_step_id"],
    )

    if result["mission_id"] is not None:
        from forgeos.missions import mark_approved_and_run
        await mark_approved_and_run(result["mission_id"])
    elif result["workflow_step_id"] is not None:
        from forgeos.workflows import resume_step_after_approval
        await resume_step_after_approval(result["workflow_step_id"])

    return result


async def reject(approval_id: int, reviewer_id: int, reason: str = "") -> dict:
    approval = await get_approval(approval_id)
    if not approval:
        raise ValueError("Approval not found")
    if approval["status"] != "pending":
        raise ValueError(f"Approval already {approval['status']}")

    row = await fetchrow(
        """UPDATE forgeos_approvals
           SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(),
               reason = COALESCE(NULLIF($2, ''), reason)
           WHERE id = $3
           RETURNING id, mission_id, workflow_step_id, status, requested_by,
                     reviewed_by, reason, created_at, reviewed_at""",
        reviewer_id, reason, approval_id,
    )
    result = _serialize(row)

    logger.info(
        "forgeos: approval %s rejected by user %s (mission_id=%s workflow_step_id=%s reason=%r)",
        approval_id, reviewer_id, result["mission_id"], result["workflow_step_id"], reason,
    )

    if result["mission_id"] is not None:
        from forgeos.missions import mark_rejected
        await mark_rejected(result["mission_id"])
    elif result["workflow_step_id"] is not None:
        from forgeos.workflows import mark_step_rejected
        await mark_step_rejected(result["workflow_step_id"])

    return result


def _serialize(row: dict) -> dict:
    row = dict(row)
    for field in ("created_at", "reviewed_at"):
        if row.get(field) is not None:
            row[field] = str(row[field])
    return row
