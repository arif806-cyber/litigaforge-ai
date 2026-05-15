"""
PostgreSQL database layer for LitigaForge AI.
Handles users, subscriptions, and case counting.
"""
import os
import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv("DATABASE_URL")


def get_conn():
    return psycopg2.connect(DATABASE_URL)


# ── Tier config ────────────────────────────────────────────────────────────────

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


# ── User CRUD ──────────────────────────────────────────────────────────────────

def create_user(email: str, name: str, password_hash: str) -> dict:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """INSERT INTO users (email, name, password_hash)
                   VALUES (%s, %s, %s)
                   RETURNING id, email, name, subscription_tier, created_at""",
                (email.lower().strip(), name.strip(), password_hash),
            )
            row = dict(cur.fetchone())
            row["created_at"] = str(row["created_at"])
            conn.commit()
            return row
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise ValueError("Email already registered")
    finally:
        conn.close()


def get_user_by_email(email: str) -> dict | None:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT id, email, name, password_hash, subscription_tier,
                          cases_this_month, month_reset_date
                   FROM users WHERE email=%s""",
                (email.lower().strip(),),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> dict | None:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT id, email, name, subscription_tier,
                          cases_this_month, month_reset_date, created_at
                   FROM users WHERE id=%s""",
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            d = dict(row)
            d["created_at"] = str(d["created_at"])
            d["month_reset_date"] = str(d["month_reset_date"])
            return d
    finally:
        conn.close()


def increment_case_count(user_id: int) -> dict:
    """Increment monthly case count, resetting if it's a new month."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
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
                   WHERE id=%s
                   RETURNING cases_this_month, subscription_tier""",
                (user_id,),
            )
            row = cur.fetchone()
            conn.commit()
            return dict(row)
    finally:
        conn.close()


def update_subscription(user_id: int, tier: str) -> dict:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "UPDATE users SET subscription_tier=%s WHERE id=%s RETURNING id, email, name, subscription_tier",
                (tier, user_id),
            )
            row = dict(cur.fetchone())
            cur.execute(
                "INSERT INTO subscriptions (user_id, tier) VALUES (%s, %s)",
                (user_id, tier),
            )
            conn.commit()
            return row
    finally:
        conn.close()
