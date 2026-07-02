"""
ForgeOS Shared Memory Service — a simple namespaced key/value store backed by
forgeos_memory, used by agents/missions/workflows to share context.

Distinct from the unrelated forge_memory/ package elsewhere in this
codebase, which serves a different, pre-existing feature.
"""
import json
from typing import Any

from database import execute, fetch, fetchrow
from logger import get_logger

logger = get_logger("litigaforge.forgeos")


async def set_value(namespace: str, key: str, value: Any) -> dict:
    row = await fetchrow(
        """INSERT INTO forgeos_memory (namespace, key, value, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW())
           ON CONFLICT (namespace, key)
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
           RETURNING id, namespace, key, value, updated_at""",
        namespace, key, json.dumps(value, default=str),
    )
    row["updated_at"] = str(row["updated_at"])
    return row


async def get_value(namespace: str, key: str) -> Any | None:
    row = await fetchrow(
        "SELECT value FROM forgeos_memory WHERE namespace = $1 AND key = $2",
        namespace, key,
    )
    return row["value"] if row else None


async def list_namespace(namespace: str) -> list[dict]:
    rows = await fetch(
        """SELECT key, value, updated_at FROM forgeos_memory
           WHERE namespace = $1 ORDER BY updated_at DESC""",
        namespace,
    )
    for r in rows:
        r["updated_at"] = str(r["updated_at"])
    return rows


async def delete_value(namespace: str, key: str) -> None:
    await execute(
        "DELETE FROM forgeos_memory WHERE namespace = $1 AND key = $2",
        namespace, key,
    )
