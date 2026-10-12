"""Idempotently create the isolated demo advocate after the API schema is ready.

Required environment: DATABASE_URL, DEMO_ADVOCATE_EMAIL, DEMO_ADVOCATE_TEMP_PASSWORD.
Never prints the supplied temporary password. Re-running does not rotate it.
"""
import asyncio
import os
import re
import sys

import asyncpg

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from auth import hash_password
from demo_workspace import create_demo_fixture


async def main():
    dsn = os.getenv("DATABASE_URL", "").strip()
    email = os.getenv("DEMO_ADVOCATE_EMAIL", "").strip().lower()
    temporary_password = os.getenv("DEMO_ADVOCATE_TEMP_PASSWORD", "")
    if not dsn or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise SystemExit("Set DATABASE_URL and a valid DEMO_ADVOCATE_EMAIL first.")
    if len(temporary_password) < 16:
        raise SystemExit("DEMO_ADVOCATE_TEMP_PASSWORD must be at least 16 characters.")
    conn = await asyncpg.connect(dsn=dsn, statement_cache_size=0)
    try:
        async with conn.transaction():
            user = await conn.fetchrow(
                "SELECT id,is_demo FROM users WHERE email=$1 FOR UPDATE", email
            )
            if user and not user["is_demo"]:
                raise SystemExit("That email belongs to a non-demo account; refusing to modify it.")
            if user:
                user_id = int(user["id"])
                created = False
            else:
                row = await conn.fetchrow(
                    """INSERT INTO users
                       (email,name,password_hash,role,is_demo,must_change_password,email_verified)
                       VALUES ($1,'Demo Advocate',$2,'advocate',TRUE,TRUE,TRUE)
                       RETURNING id""",
                    email, hash_password(temporary_password),
                )
                user_id = int(row["id"])
                created = True
        has_fixture = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM workspace_sessions WHERE user_id=$1 AND is_demo_fixture=TRUE)",
            user_id,
        )
        if not has_fixture:
            async with conn.transaction():
                await create_demo_fixture(conn, user_id)
        print("Demo advocate account " + ("created" if created else "already exists") +
              "; fictional workspace fixture is ready. The account must change its temporary password at sign-in.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
