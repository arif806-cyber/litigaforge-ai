"""
ForgeOS Audit Log — append-only trail of every consequential action taken in
the subsystem (agent registered, mission created/reassigned, approval
decided, config change, etc). Backs the dashboard's "Activity" feed and any
future compliance/RBAC review.

Writes only — this module never allows updates or deletes, in keeping with
audit-log semantics. `actor_user_id` is nullable because many actions are
taken by the system itself (scheduler sweeps, seed script) rather than a
logged-in superuser.
"""
from typing import Any

from database import fetch, fetchrow
from logger import get_logger

logger = get_logger("litigaforge.forgeos")


def _serialize(row: dict) -> dict:
    row = dict(row)
    row["created_at"] = str(row["created_at"])
    return row


async def log_action(action: str, target_type: str = "", target_id: str = "",
                      actor_user_id: int | None = None, actor: str = "system",
                      detail: str | dict[str, Any] | None = None) -> dict:
    """Record one audit entry. `actor` is a human-readable label (e.g.
    "scheduler", "superuser:42's email") stored inside `detail` when there's
    no real `actor_user_id` — never raises, a logging failure shouldn't take
    down the caller's actual work."""
    payload: dict[str, Any] = {"actor": actor}
    if isinstance(detail, str):
        payload["message"] = detail
    elif isinstance(detail, dict):
        payload.update(detail)

    import json as _json
    try:
        row = await fetchrow(
            """INSERT INTO forgeos_audit_log (actor_user_id, action, target_type, target_id, detail)
               VALUES ($1, $2, $3, $4, $5::jsonb)
               RETURNING id, actor_user_id, action, target_type, target_id, detail, created_at""",
            actor_user_id, action, target_type, str(target_id) if target_id else "",
            _json.dumps(payload, default=str),
        )
        return _serialize(row)
    except Exception as e:
        logger.error("forgeos: failed to write audit log entry action=%s: %s", action, e, exc_info=True)
        return {}


async def list_audit_log(action: str | None = None, target_type: str | None = None,
                          limit: int = 100) -> list[dict]:
    limit = max(1, min(limit, 500))
    clauses: list[str] = []
    args: list[Any] = []
    if action:
        args.append(action)
        clauses.append(f"action = ${len(args)}")
    if target_type:
        args.append(target_type)
        clauses.append(f"target_type = ${len(args)}")

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    args.append(limit)
    rows = await fetch(
        f"""SELECT id, actor_user_id, action, target_type, target_id, detail, created_at
           FROM forgeos_audit_log {where}
           ORDER BY created_at DESC LIMIT ${len(args)}""",
        *args,
    )
    return [_serialize(r) for r in rows]
