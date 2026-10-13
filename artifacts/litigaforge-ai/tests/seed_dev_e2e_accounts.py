"""Create or remove the two isolated Connect V2 browser-test accounts.

This script refuses production signals and only touches the fixed *.local
fixture identities. Passwords live in tests/fixtures/e2e_accounts.json.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

import asyncpg

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
FIXTURE = json.loads((HERE / "fixtures" / "e2e_accounts.json").read_text())
ALLOWED_EMAILS = {
    FIXTURE["client"]["email"],
    FIXTURE["advocate"]["email"],
}


def _assert_development_only() -> None:
    from judgment_ingest import _is_prod

    if _is_prod() or os.getenv("REPLIT_DEPLOYMENT"):
        raise RuntimeError("Refusing to seed e2e identities in a production environment.")
    if not os.getenv("DATABASE_URL"):
        raise RuntimeError("DATABASE_URL is unavailable; no accounts were changed.")
    if (
        FIXTURE["client"]["email"] != "e2e-client@test.litigaforge.local"
        or FIXTURE["advocate"]["email"] != "e2e-advocate@dev.litigaforge.local"
    ):
        raise RuntimeError("Fixture identity allowlist is invalid.")


async def seed() -> None:
    _assert_development_only()
    from auth import hash_password

    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        async with conn.transaction():
            ids: dict[str, int] = {}
            for kind in ("client", "advocate"):
                user = FIXTURE[kind]
                row = await conn.fetchrow(
                    """INSERT INTO users (email,name,password_hash,role,email_verified,is_superuser)
                       VALUES ($1,$2,$3,$4,TRUE,FALSE)
                       ON CONFLICT (email) DO UPDATE SET
                         name=EXCLUDED.name, password_hash=EXCLUDED.password_hash,
                         role=EXCLUDED.role, email_verified=TRUE, is_superuser=FALSE
                       RETURNING id""",
                    user["email"], user["name"], hash_password(user["password"]),
                    "client" if kind == "client" else "advocate",
                )
                ids[kind] = int(row["id"])

            advocate = FIXTURE["advocate"]
            profile = await conn.fetchrow(
                "SELECT id FROM lawyers WHERE user_id=$1 ORDER BY id LIMIT 1",
                ids["advocate"],
            )
            values = (
                advocate["name"], advocate["email"], advocate["bar_number"],
                "Telangana Bar Council", ["Hyderabad District Courts"],
                "Hyderabad", ["Civil", "Property"], ["te", "en"], 5,
                "Development-only verified browser-test advocate.",
            )
            if profile:
                await conn.execute(
                    """UPDATE lawyers SET name=$1,email=$2,bar_number=$3,bar_council=$4,
                         courts_practised=$5,district=$6,practice_areas=$7,languages=$8,
                         experience_years=$9,bio=$10,availability='available',
                         verification_status='verified',verified=TRUE,is_test=FALSE,
                         admin_hidden=FALSE WHERE id=$11""",
                    *values, profile["id"],
                )
            else:
                await conn.execute(
                    """INSERT INTO lawyers
                         (user_id,name,email,bar_number,bar_council,courts_practised,
                          district,practice_areas,languages,experience_years,bio,availability,
                          verification_status,verified,is_test,admin_hidden)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'available',
                               'verified',TRUE,FALSE,FALSE)""",
                    ids["advocate"], *values,
                )
        print("Development E2E accounts seeded; credentials were not printed.")
    finally:
        await conn.close()


async def cleanup() -> None:
    _assert_development_only()
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        async with conn.transaction():
            ids = await conn.fetch(
                "SELECT id FROM users WHERE email=ANY($1::text[])",
                list(ALLOWED_EMAILS),
            )
            user_ids = [int(row["id"]) for row in ids]
            await conn.execute(
                "DELETE FROM lawyers WHERE user_id=ANY($1::int[])", user_ids,
            )
            await conn.execute(
                "DELETE FROM users WHERE email=ANY($1::text[])",
                list(ALLOWED_EMAILS),
            )
        print("Development E2E identities removed; credentials were not printed.")
    finally:
        await conn.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2 or sys.argv[1] not in {"seed", "cleanup"}:
        raise SystemExit("Usage: python tests/seed_dev_e2e_accounts.py seed|cleanup")
    asyncio.run(seed() if sys.argv[1] == "seed" else cleanup())
