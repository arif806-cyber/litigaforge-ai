"""
ForgeOS Agent Registry — CRUD over forgeos_agents.
"""
import json
from typing import Any

from database import execute, fetch, fetchrow
from logger import get_logger

logger = get_logger("litigaforge.forgeos")

VALID_STATUSES = ("active", "disabled")


async def register_agent(name: str, role: str, description: str = "",
                          capabilities: list[str] | None = None,
                          model: str = "") -> dict:
    """Idempotent by name — re-registering an existing agent updates its
    role/description/capabilities/model rather than erroring."""
    capabilities = capabilities or []
    row = await fetchrow(
        """INSERT INTO forgeos_agents (name, role, description, capabilities, model)
           VALUES ($1, $2, $3, $4::jsonb, $5)
           ON CONFLICT (name) DO UPDATE SET
               role = EXCLUDED.role,
               description = EXCLUDED.description,
               capabilities = EXCLUDED.capabilities,
               model = EXCLUDED.model
           RETURNING id, name, role, description, capabilities, model, status, created_at""",
        name.strip(), role.strip(), description.strip(),
        json.dumps(capabilities), model.strip(),
    )
    row["created_at"] = str(row["created_at"])
    return row


async def list_agents(status: str | None = None) -> list[dict]:
    if status:
        rows = await fetch(
            """SELECT id, name, role, description, capabilities, model, status, created_at
               FROM forgeos_agents WHERE status = $1 ORDER BY id""",
            status,
        )
    else:
        rows = await fetch(
            """SELECT id, name, role, description, capabilities, model, status, created_at
               FROM forgeos_agents ORDER BY id"""
        )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return rows


async def get_agent(agent_id: int) -> dict | None:
    row = await fetchrow(
        """SELECT id, name, role, description, capabilities, model, status, created_at
           FROM forgeos_agents WHERE id = $1""",
        agent_id,
    )
    if row:
        row["created_at"] = str(row["created_at"])
    return row


async def get_agent_by_name(name: str) -> dict | None:
    row = await fetchrow(
        """SELECT id, name, role, description, capabilities, model, status, created_at
           FROM forgeos_agents WHERE name = $1""",
        name,
    )
    if row:
        row["created_at"] = str(row["created_at"])
    return row


async def update_agent_status(agent_id: int, status: str) -> dict | None:
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{status}' — must be one of {VALID_STATUSES}")
    row = await fetchrow(
        """UPDATE forgeos_agents SET status = $1 WHERE id = $2
           RETURNING id, name, role, description, capabilities, model, status, created_at""",
        status, agent_id,
    )
    if row:
        row["created_at"] = str(row["created_at"])
    return row
