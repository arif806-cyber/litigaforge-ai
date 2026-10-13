"""Seed the isolated MCP Reviewer account from Replit Secrets.

Run with: python tests/seed_dev_mcp_reviewer.py seed
Required environment values: MCP_REVIEWER_EMAIL and MCP_REVIEWER_PASSWORD.
This script deliberately has no cleanup mode so it cannot delete account data.
"""
from __future__ import annotations

import asyncio
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

REVIEWER_NAME = "Development MCP Reviewer"
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def reviewer_credentials() -> tuple[str, str]:
    email = os.getenv("MCP_REVIEWER_EMAIL", "").strip().lower()
    password = os.getenv("MCP_REVIEWER_PASSWORD", "")
    if not _EMAIL.fullmatch(email):
        raise RuntimeError("MCP_REVIEWER_EMAIL must be a valid email configured in Replit Secrets.")
    if len(password) < 12:
        raise RuntimeError("MCP_REVIEWER_PASSWORD must contain at least 12 characters in Replit Secrets.")
    return email, password


def assert_development_only() -> None:
    from runtime_env import assert_development_database

    if os.getenv("APP_ENV", "development").strip().lower() in {"production", "prod"}:
        raise RuntimeError("Refusing to seed the Reviewer account in a production environment.")
    assert_development_database()
    if not os.getenv("DATABASE_URL"):
        raise RuntimeError("DATABASE_URL is unavailable; no account was changed.")
    if os.getenv("MCP_V2_ENABLED", "false").strip().lower() not in {"1", "true", "yes", "on"}:
        raise RuntimeError("Set MCP_V2_ENABLED=true in the development environment before seeding.")


async def seed() -> None:
    assert_development_only()
    email, password = reviewer_credentials()

    from auth import hash_password
    from database import close_pool, execute, fetchrow
    from routers.mcp_v2 import ensure_schema, grant_reviewer

    await ensure_schema()
    admin = await fetchrow(
        "SELECT id FROM users WHERE is_superuser=TRUE ORDER BY id LIMIT 1"
    )
    if not admin:
        raise RuntimeError("No development superuser is available to attribute the Reviewer grant.")
    existing = await fetchrow(
        "SELECT id,name FROM users WHERE LOWER(email)=LOWER($1)", email
    )
    if existing and existing["name"] != REVIEWER_NAME:
        raise RuntimeError(
            "MCP_REVIEWER_EMAIL belongs to a different account; choose a dedicated development address."
        )

    hashed = hash_password(password)
    if existing:
        user_id = int(existing["id"])
        await execute(
            """UPDATE users SET password_hash=$1,role='client',email_verified=TRUE,
                 is_superuser=FALSE WHERE id=$2""",
            hashed, user_id,
        )
    else:
        row = await fetchrow(
            """INSERT INTO users(email,name,password_hash,role,email_verified,is_superuser)
               VALUES($1,$2,$3,'client',TRUE,FALSE) RETURNING id""",
            email, REVIEWER_NAME, hashed,
        )
        user_id = int(row["id"])

    try:
        result = await grant_reviewer(user_id, {"id": int(admin["id"])})
        if result.get("fictional_demo_cases") != 2:
            raise RuntimeError("Reviewer demo cases were not seeded as expected.")
    finally:
        await close_pool()
    print("Development Reviewer seeded with fictional cases and public authorities; credentials were not printed.")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] != "seed":
        raise SystemExit("Usage: python tests/seed_dev_mcp_reviewer.py seed")
    asyncio.run(seed())
