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


def seed_lawyers() -> int:
    """Idempotent seed: inserts 12 realistic TG/AP advocates if table is empty."""
    LAWYERS = [
        ("Adv. K. Venkata Ramaiah", "+919876543210", "vramaiah@litigaforge.in", "TS/1234/2020",
         "Hyderabad", ["Property & Real Estate", "Civil Matters", "RERA"], ["Telugu", "English"],
         18, 4.7, "Senior advocate specializing in property disputes, landlord-tenant matters, and RERA compliance across Telangana.", True),
        ("Adv. Smt. Padmaja Reddy", "+919912345678", "padmaja@litigaforge.in", "TS/5678/2018",
         "Hyderabad", ["Family Law", "Criminal Defense", "NDPS"], ["Telugu", "English", "Hindi"],
         22, 4.9, "Leading family law advocate with expertise in divorce, child custody, domestic violence cases, and criminal defense.", True),
        ("Adv. Suresh Babu Naidu", "+919988776655", "snaidu@litigaforge.in", "TS/9012/2021",
         "Warangal", ["Criminal Defense", "Motor Accident Claims", "Consumer Forum"], ["Telugu", "English", "Hindi"],
         14, 4.5, "Criminal law specialist based in Warangal. Extensive experience in bail applications, motor accident claims, and consumer disputes.", True),
        ("Adv. Dr. Ayesha Begum", "+919955443322", "ayesha@litigaforge.in", "TS/3456/2019",
         "Hyderabad", ["GST & Tax", "Corporate Law", "Banking & Finance"], ["English", "Urdu", "Hindi"],
         16, 4.6, "Taxation expert with LLM in Commercial Law. Handles GST disputes, corporate restructuring, and banking litigation for SMEs.", True),
        ("Adv. Ramesh Kumar Goud", "+919944332211", "rkgoud@litigaforge.in", "TS/7890/2017",
         "Karimnagar", ["Labour Law", "Civil Matters", "Revenue Law"], ["Telugu", "English"],
         20, 4.4, "Labour law advocate serving Karimnagar and surrounding districts. Specializes in industrial disputes, land revenue, and civil appeals.", True),
        ("Adv. Lakshmi Devi Sharma", "+919933221100", "lsharma@litigaforge.in", "TS/2345/2022",
         "Rangareddy", ["Family Law", "Property & Real Estate", "Consumer Forum"], ["Telugu", "Hindi", "English"],
         12, 4.3, "Rising star in family law with strong property litigation skills. Practices across Rangareddy and Hyderabad districts.", True),
        ("Adv. Mohammed Imran Khan", "+919922110099", "imran@litigaforge.in", "TS/6789/2016",
         "Nizamabad", ["Criminal Defense", "Civil Matters", "Motor Accident Claims"], ["Urdu", "Telugu", "English"],
         25, 4.8, "Veteran criminal defense counsel with 25 years at the bar. Known for meticulous case preparation and strong courtroom advocacy.", True),
        ("Adv. Sreeja Katakam", "+919911009988", "sreeja@litigaforge.in", "TS/4567/2023",
         "Khammam", ["GST & Tax", "Labour Law", "Banking & Finance"], ["Telugu", "English"],
         10, 4.2, "Young advocate bringing fresh energy to tax and labour disputes in Khammam district. Former law clerk at High Court.", True),
        ("Adv. Gopalakrishna Raju", "+919900998877", "graju@litigaforge.in", "TS/8901/2015",
         "Nalgonda", ["Civil Matters", "Property & Real Estate", "Revenue Law"], ["Telugu", "English", "Hindi"],
         28, 4.9, "Senior civil advocate with deep expertise in land disputes, revenue appeals, and property partition cases in Nalgonda district.", True),
        ("Adv. Fatima Sultana", "+919889977665", "fatima@litigaforge.in", "TS/1122/2020",
         "Medak", ["Family Law", "Criminal Defense", "NDPS"], ["Urdu", "Telugu", "English", "Hindi"],
         15, 4.5, "Compassionate family law advocate also handling criminal defense and NDPS matters. Multilingual practice serving diverse communities.", True),
        ("Adv. Bhanu Prakash Choudhary", "+919877665544", "bhanu@litigaforge.in", "TS/3344/2018",
         "Adilabad", ["Corporate Law", "Banking & Finance", "Insolvency"], ["Telugu", "English", "Hindi"],
         19, 4.6, "Corporate and banking law specialist. Handles insolvency proceedings, company law disputes, and financial restructuring for businesses.", True),
        ("Adv. Vijaya Lakshmi Iyer", "+919866554433", "viyer@litigaforge.in", "TS/5566/2021",
         "Mahbubnagar", ["Intellectual Property", "Corporate Law", "GST & Tax"], ["English", "Telugu", "Tamil"],
         13, 4.4, "IP law advocate with experience in trademark disputes, copyright infringement, and technology contracts. Serves Mahbubnagar region.", True),
    ]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM lawyers")
            if cur.fetchone()[0] > 0:
                return 0
            for l in LAWYERS:
                cur.execute(
                    """INSERT INTO lawyers
                       (name, phone, email, bar_number, district, practice_areas, languages, experience_years, rating, bio, verified)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    l,
                )
            conn.commit()
            return len(LAWYERS)
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
