"""
PostgreSQL database layer for LitigaForge AI — asyncpg.
Handles users, subscriptions, and case counting.
"""
import os
from typing import Any

import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL")
_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=30,
            statement_cache_size=0,  # required for pgbouncer / Replit
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def fetchrow(query: str, *args) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *args)
        return dict(row) if row else None


async def fetch(query: str, *args) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *args)
        return [dict(r) for r in rows]


async def execute(query: str, *args) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


async def fetchval(query: str, *args) -> Any:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval(query, *args)


async def executemany(query: str, args_list: list) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.executemany(query, args_list)


# ── Tier config ────────────────────────────────────────────────────────────────────────────────

TIER_LIMITS = {
    "free": 5,
    "professional": 50,
    "advocate_pro": -1,  # -1 = unlimited
}

SUBSCRIPTION_PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price_inr": 0,
        "cases_per_month": 5,
        "ai_label": "Smart Fallback",
        "features": [
            "5 cases per month",
            "Smart template AI",
            "All 16 API chains",
            "Case archives",
            "Email support",
        ],
    },
    {
        "id": "professional",
        "name": "Professional",
        "price_inr": 999,
        "cases_per_month": 50,
        "ai_label": "Gemini 2.5 Flash",
        "features": [
            "50 cases per month",
            "Gemini 2.5 Flash AI",
            "All 16 API chains",
            "Case archives & patterns",
            "Watch Mode alerts",
            "Priority support",
        ],
    },
    {
        "id": "advocate_pro",
        "name": "Advocate Pro",
        "price_inr": 2499,
        "cases_per_month": -1,
        "ai_label": "Multi-AI (Claude + Gemini + GPT-5)",
        "features": [
            "Unlimited cases",
            "Claude Sonnet + Gemini + GPT-5",
            "All 16 API chains",
            "Case archives & patterns",
            "Watch Mode + WhatsApp alerts",
            "Dedicated advocate support",
        ],
    },
]


# ── User CRUD ─────────────────────────────────────────────────────────────────────────────────────

async def create_user(email: str, name: str, password_hash: str, role: str = "client") -> dict:
    try:
        row = await fetchrow(
            """INSERT INTO users (email, name, password_hash, role)
               VALUES ($1, $2, $3, $4)
               RETURNING id, email, name, subscription_tier, role, created_at""",
            email.lower().strip(), name.strip(), password_hash, role,
        )
        row["created_at"] = str(row["created_at"])
        return row
    except asyncpg.exceptions.UniqueViolationError:
        raise ValueError("Email already registered")


async def get_user_by_email(email: str) -> dict | None:
    row = await fetchrow(
        """SELECT id, email, name, password_hash, subscription_tier,
                  cases_this_month, month_reset_date, is_superuser, role
           FROM users WHERE email = $1""",
        email.lower().strip(),
    )
    return row


async def get_user_by_id(user_id: int) -> dict | None:
    row = await fetchrow(
        """SELECT id, email, name, subscription_tier,
                  cases_this_month, month_reset_date, is_superuser, role, created_at
           FROM users WHERE id = $1""",
        user_id,
    )
    if not row:
        return None
    row["created_at"] = str(row["created_at"])
    row["month_reset_date"] = str(row["month_reset_date"])
    return row


async def increment_case_count(user_id: int) -> dict:
    row = await fetchrow(
        """UPDATE users
           SET cases_this_month = CASE
                 WHEN month_reset_date < date_trunc('month', CURRENT_DATE)
                 THEN 1
                 ELSE cases_this_month + 1
               END,
               month_reset_date = CASE
                 WHEN month_reset_date < date_trunc('month', CURRENT_DATE)
                 THEN CURRENT_DATE
                 ELSE month_reset_date
               END
           WHERE id = $1
           RETURNING cases_this_month, subscription_tier""",
        user_id,
    )
    return dict(row)


async def update_subscription(user_id: int, tier: str) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "UPDATE users SET subscription_tier = $1 WHERE id = $2 RETURNING id, email, name, subscription_tier",
                tier, user_id,
            )
            await conn.execute(
                "INSERT INTO subscriptions (user_id, tier) VALUES ($1, $2)",
                user_id, tier,
            )
            d = dict(row)
            d["created_at"] = str(row.get("created_at", ""))
            return d
