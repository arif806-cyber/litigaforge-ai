"""
ForgeOS Agent Registry — CRUD over forgeos_agents.

Beyond identity fields (name/role/description/capabilities/model/status),
agents carry dashboard-facing runtime state: avatar (display glyph), kpis
(free-form JSON scoreboard e.g. {"missions_completed": 12}), current_mission_id
(what they're working on right now), progress (0-100 for the current mission),
and last_activity_at (drives "idle" vs "active" in the UI).
"""
import json
from typing import Any

from database import execute, fetch, fetchrow
from logger import get_logger

logger = get_logger("litigaforge.forgeos")

VALID_STATUSES = ("active", "disabled")

_AGENT_COLUMNS = (
    "id, name, role, description, capabilities, model, status, avatar, kpis, "
    "current_mission_id, progress, last_activity_at, created_at"
)


def _serialize(row: dict | None) -> dict | None:
    if not row:
        return row
    row["created_at"] = str(row["created_at"])
    if row.get("last_activity_at") is not None:
        row["last_activity_at"] = str(row["last_activity_at"])
    return row


async def register_agent(name: str, role: str, description: str = "",
                          capabilities: list[str] | None = None,
                          model: str = "", avatar: str = "") -> dict:
    """Idempotent by name — re-registering an existing agent updates its
    role/description/capabilities/model/avatar rather than erroring. Runtime
    fields (status, kpis, progress, current_mission_id) are left untouched."""
    capabilities = capabilities or []
    row = await fetchrow(
        f"""INSERT INTO forgeos_agents (name, role, description, capabilities, model, avatar)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6)
           ON CONFLICT (name) DO UPDATE SET
               role = EXCLUDED.role,
               description = EXCLUDED.description,
               capabilities = EXCLUDED.capabilities,
               model = EXCLUDED.model,
               avatar = EXCLUDED.avatar
           RETURNING {_AGENT_COLUMNS}""",
        name.strip(), role.strip(), description.strip(),
        json.dumps(capabilities), model.strip(), avatar.strip(),
    )
    return _serialize(row)


async def list_agents(status: str | None = None) -> list[dict]:
    if status:
        rows = await fetch(
            f"""SELECT {_AGENT_COLUMNS}
               FROM forgeos_agents WHERE status = $1 ORDER BY id""",
            status,
        )
    else:
        rows = await fetch(
            f"""SELECT {_AGENT_COLUMNS}
               FROM forgeos_agents ORDER BY id"""
        )
    return [_serialize(r) for r in rows]


async def get_agent(agent_id: int) -> dict | None:
    row = await fetchrow(
        f"SELECT {_AGENT_COLUMNS} FROM forgeos_agents WHERE id = $1",
        agent_id,
    )
    return _serialize(row)


async def get_agent_by_name(name: str) -> dict | None:
    row = await fetchrow(
        f"SELECT {_AGENT_COLUMNS} FROM forgeos_agents WHERE name = $1",
        name,
    )
    return _serialize(row)


async def update_agent_status(agent_id: int, status: str) -> dict | None:
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{status}' — must be one of {VALID_STATUSES}")
    row = await fetchrow(
        f"""UPDATE forgeos_agents SET status = $1, last_activity_at = NOW() WHERE id = $2
           RETURNING {_AGENT_COLUMNS}""",
        status, agent_id,
    )
    return _serialize(row)


async def update_agent_activity(agent_id: int, current_mission_id: int | None = None,
                                 progress: int | None = None,
                                 kpis_patch: dict[str, Any] | None = None) -> dict | None:
    """Touch an agent's runtime state as it works a mission. `current_mission_id`
    accepts None explicitly to mean "clear" (mission finished/failed) — pass
    the sentinel-free default (no kwarg) to leave it unchanged is NOT
    supported here, callers must always pass the mission id or None."""
    sets = ["last_activity_at = NOW()", "current_mission_id = $2"]
    args: list = [agent_id, current_mission_id]
    idx = 3
    if progress is not None:
        sets.append(f"progress = ${idx}")
        args.append(max(0, min(100, progress)))
        idx += 1
    if kpis_patch:
        sets.append(f"kpis = kpis || ${idx}::jsonb")
        args.append(json.dumps(kpis_patch))
        idx += 1
    row = await fetchrow(
        f"""UPDATE forgeos_agents SET {', '.join(sets)} WHERE id = $1
           RETURNING {_AGENT_COLUMNS}""",
        *args,
    )
    return _serialize(row)


async def bump_agent_kpi(agent_id: int, key: str, delta: float = 1) -> None:
    """Increment a numeric KPI counter (e.g. missions_completed) atomically."""
    await execute(
        """UPDATE forgeos_agents SET kpis = jsonb_set(
               kpis, $2::text[], (COALESCE((kpis->>$3)::numeric, 0) + $4)::text::jsonb
           ) WHERE id = $1""",
        agent_id, [key], key, delta,
    )
