"""LitigaForge AI — FastAPI Server
Modular router aggregator: 9 clean routers, lifespan, CORS, rate limiting,
structured logging, request middleware, Sentry (conditional).
"""
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from logger import get_logger, forge_logger
from rate_limit import limiter, rate_limit_handler, RateLimitExceeded
from database import get_pool, close_pool
from watch_mode import WatchModeManager
from alerts.whatsapp import send_whatsapp_alert

logger = get_logger("litigaforge.main")

# —— Sentry (optional, only if SENTRY_DSN set) ——
_sentry_dsn = os.environ.get("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration

    _sensitive_keys = {
        "password", "password_hash", "token", "authorization",
        "lf_token", "session_secret", "pan", "gstin",
        "aadhaar", "phone", "email", "name",
        "razorpay_key_secret", "twilio_auth_token",
    }

    def _scrub(obj):
        if isinstance(obj, dict):
            return {k: "[REDACTED]" if k.lower() in _sensitive_keys else _scrub(v)
                    for k, v in obj.items()}
        if isinstance(obj, list):
            return [_scrub(i) for i in obj]
        return obj

    def _scrub_sensitive_data(event, hint):
        if "request" in event:
            if "data" in event["request"]:
                event["request"]["data"] = _scrub(event["request"]["data"])
            if "headers" in event["request"]:
                event["request"]["headers"] = _scrub(event["request"]["headers"])
        return event

    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.environ.get("ENVIRONMENT", "development"),
        release=os.environ.get("APP_VERSION", "1.0.0"),
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            CeleryIntegration(),
        ],
        traces_sample_rate=0.2,
        profiles_sample_rate=0.1,
        send_default_pii=False,
        before_send=_scrub_sensitive_data,
    )
    logger.info("Sentry error tracking initialised")
else:
    logger.info("SENTRY_DSN not set — error tracking disabled")

BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")
watcher = WatchModeManager(
    memory=__import__("litigaforge_engine").memory,
    alert_fn=send_whatsapp_alert,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await get_pool()
    conn = await pool.acquire()
    try:
        # Auto-initialize database tables on first startup
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                subscription_tier TEXT DEFAULT 'free',
                cases_this_month INTEGER DEFAULT 0,
                month_reset_date DATE DEFAULT CURRENT_DATE,
                is_superuser BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                tier TEXT NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                status TEXT DEFAULT 'active',
                payment_ref TEXT
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS legal_questions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                question TEXT NOT NULL,
                category TEXT,
                ai_answer TEXT,
                upvotes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS lawyers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                bar_number TEXT,
                district TEXT,
                practice_areas TEXT[],
                languages TEXT[],
                experience_years INTEGER,
                rating NUMERIC(3,2) DEFAULT 0,
                bio TEXT,
                hourly_rate INTEGER,
                availability TEXT DEFAULT 'available',
                verification_status TEXT DEFAULT 'pending',
                verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN DEFAULT FALSE")
        await conn.execute("ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
        await conn.execute("ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS hourly_rate INTEGER")
        await conn.execute("ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'available'")
        await conn.execute("ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS case_requirements (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                case_type TEXT NOT NULL,
                description TEXT,
                location TEXT,
                budget_range TEXT,
                is_anonymous BOOLEAN DEFAULT FALSE,
                status TEXT DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                id SERIAL PRIMARY KEY,
                case_requirement_id INTEGER REFERENCES case_requirements(id) ON DELETE CASCADE,
                lawyer_id INTEGER REFERENCES lawyers(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                status TEXT DEFAULT 'pending',
                match_score INTEGER DEFAULT 0,
                ai_explanation TEXT,
                client_message TEXT,
                lawyer_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_threads (
                id SERIAL PRIMARY KEY,
                match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                thread_id INTEGER REFERENCES chat_threads(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                sender_role TEXT DEFAULT 'user',
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info("Database tables initialized")
    except Exception as e:
        logger.warning("DB init check: %s", e)
    finally:
        await pool.release(conn)

    assert os.environ.get("SESSION_SECRET"), \
        "SESSION_SECRET is required — set it in Replit Secrets"
    assert os.environ.get("DATABASE_URL"), \
        "DATABASE_URL is required"
    logger.info("✓ Startup checks passed")

    if os.getenv("WATCH_MODE_AUTO_START", "false").lower() == "true":
        watcher.start()
    yield
    watcher.stop()
    await close_pool()


app = FastAPI(
    title="LitigaForge AI",
    description="Self-Evolving Legal API Forge for Hyderabad/Telangana Advocates",
    version="3.0.0",
    lifespan=lifespan,
    root_path=BASE_PATH,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

_cors_origins = [f"https://{d.strip()}" for d in os.getenv("REPLIT_DOMAINS", "").split(",") if d.strip()]
_frontend_url = os.environ.get("FRONTEND_URL", "").strip()
if _frontend_url:
    _cors_origins.append(_frontend_url)
if not _cors_origins:
    _cors_origins = ["http://localhost:5173", "http://localhost:4173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)

# ─── Include Routers ──────────────────────────────────────────────────────────
from routers import (
    auth_router, forge_router, subscription_router,
    matching_router, chat_router, community_router,
    watch_router, alerts_router, admin_router,
)

app.include_router(auth_router,         prefix=BASE_PATH)
app.include_router(matching_router,     prefix=BASE_PATH)  # before forge to win /cases/requirements
app.include_router(forge_router,        prefix=BASE_PATH)
app.include_router(subscription_router, prefix=BASE_PATH)
app.include_router(chat_router,        prefix=BASE_PATH)
app.include_router(community_router,   prefix=BASE_PATH)
app.include_router(watch_router,       prefix=BASE_PATH)
app.include_router(alerts_router,      prefix=BASE_PATH)
app.include_router(admin_router,       prefix=BASE_PATH)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        root_path=BASE_PATH,
        reload=os.getenv("RELOAD", "false").lower() == "true",
    )
