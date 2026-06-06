"""LitigaForge AI — FastAPI Server
Modular router aggregator: 9 clean routers, lifespan, CORS, rate limiting,
structured logging, request middleware, Sentry (conditional).
"""
import os
import sys
import time
from contextlib import asynccontextmanager

# Ensure imports work when run from project root (production) or script dir (dev)
_script_dir = os.path.dirname(os.path.abspath(__file__))
if _script_dir not in sys.path:
    sys.path.insert(0, _script_dir)

from pathlib import Path as _Path
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from logger import get_logger
from rate_limit import limiter, rate_limit_handler, RateLimitExceeded
from database import get_pool, close_pool, fetchrow as db_fetchrow
from auth import require_user as _require_user

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
                role TEXT DEFAULT 'client',
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
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client'")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT")
        # ── matches: payment tracking columns ────────────────────────────────
        await conn.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending_payment'")
        await conn.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS commission_amount INTEGER DEFAULT 0")
        await conn.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS commission_payment_id TEXT")
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
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS lawyer_cases (
                id SERIAL PRIMARY KEY,
                lawyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                case_type TEXT NOT NULL,
                description TEXT,
                client_name TEXT,
                court_name TEXT,
                cnr_number TEXT,
                hearing_date TEXT,
                case_stage TEXT DEFAULT 'filed',
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS lawyer_documents (
                id SERIAL PRIMARY KEY,
                lawyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                case_id INTEGER REFERENCES lawyer_cases(id) ON DELETE SET NULL,
                filename TEXT NOT NULL,
                file_type TEXT DEFAULT 'pdf',
                file_url TEXT,
                content_text TEXT,
                ai_summary TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS client_documents (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES lawyer_cases(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                file_type TEXT DEFAULT 'pdf',
                file_size INTEGER DEFAULT 0,
                file_path TEXT,
                file_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON refresh_tokens (token)
        """)
        # ── Migrations ──
        try:
            await conn.execute("ALTER TABLE lawyer_documents ADD COLUMN IF NOT EXISTS notes TEXT")
            await conn.execute("ALTER TABLE lawyer_cases ADD COLUMN IF NOT EXISTS cnr_number TEXT")
            await conn.execute("ALTER TABLE lawyer_cases ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
            await conn.execute("ALTER TABLE lawyer_cases ADD COLUMN IF NOT EXISTS hearing_date TEXT")
            await conn.execute("ALTER TABLE lawyer_cases ADD COLUMN IF NOT EXISTS case_stage TEXT DEFAULT 'filed'")
            logger.info("Migration: notes + cnr + client_id + hearing_date + case_stage columns added")
        except Exception as me:
            logger.warning("Migration check: %s", me)

        # ── Budget columns on case_requirements ──────────────────────────────
        try:
            await conn.execute("ALTER TABLE case_requirements ADD COLUMN IF NOT EXISTS budget_min INTEGER DEFAULT 0")
            await conn.execute("ALTER TABLE case_requirements ADD COLUMN IF NOT EXISTS budget_max INTEGER DEFAULT 0")
            logger.info("Migration: budget_min + budget_max added to case_requirements")
        except Exception as me:
            logger.warning("Migration budget: %s", me)

        # ── Email verification on users ───────────────────────────────────────
        try:
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS email_verification_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            logger.info("Migration: email_verified + email_verification_tokens added")
        except Exception as me:
            logger.warning("Migration email_verify: %s", me)

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

    yield
    await close_pool()


app = FastAPI(
    title="LitigaForge AI",
    description="AI-powered client-lawyer matching platform for Telangana & AP",
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
# Always include the canonical production domain
_prod_domain = "https://litiga-forge-ai.replit.app"
if _prod_domain not in _cors_origins:
    _cors_origins.append(_prod_domain)
if not _cors_origins:
    _cors_origins = ["http://localhost:5173", "http://localhost:4173"]
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Industry-standard security headers on every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=(), payment=(), usb=(), "
        "accelerometer=(), gyroscope=(), magnetometer=()"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.razorpay.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.razorpay.com https://indiankanoon.org; "
        "frame-src https://api.razorpay.com; "
        "object-src 'none'; "
        "base-uri 'self';"
    )
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith(
        f"{BASE_PATH}/auth"
    ) else response.headers.get("Cache-Control", "no-cache")
    # Replit always terminates TLS — HSTS is safe to send on all responses
    response.headers["Strict-Transport-Security"] = (
        "max-age=63072000; includeSubDomains; preload"
    )
    return response

# ─── Include Routers ──────────────────────────────────────────────────────────
from routers import (
    auth_router, subscription_router,
    matching_router, chat_router, community_router,
    watch_router, alerts_router, admin_router,
    lawyer_router, documents_free_router,
)

@app.get(f"{BASE_PATH}/healthz", tags=["health"])
async def healthz():
    return {"status": "ok", "service": "litigaforge-ai"}

app.include_router(auth_router,         prefix=BASE_PATH)
app.include_router(matching_router,     prefix=BASE_PATH)
app.include_router(subscription_router, prefix=BASE_PATH)
app.include_router(chat_router,        prefix=BASE_PATH)
app.include_router(community_router,   prefix=BASE_PATH)
app.include_router(watch_router,       prefix=BASE_PATH)
app.include_router(alerts_router,      prefix=BASE_PATH)
app.include_router(admin_router,       prefix=BASE_PATH)
app.include_router(lawyer_router,      prefix=BASE_PATH)
app.include_router(documents_free_router, prefix=BASE_PATH)

@app.get(f"{BASE_PATH}/sitemap.xml", include_in_schema=False)
async def serve_sitemap():
    content = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://litiga-forge-ai.replit.app/</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/ask</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/review</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/judgments</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/legal-aid</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/use-cases</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/cases</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/free-documents</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/blog</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/blog/how-to-find-good-lawyer-hyderabad</loc><lastmod>2026-05-01</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/blog/free-legal-aid-telangana-nalsa-guide</loc><lastmod>2026-05-05</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/blog/file-consumer-forum-complaint-online-india</loc><lastmod>2026-05-10</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/blog/rera-property-buyers-andhra-pradesh</loc><lastmod>2026-05-15</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/blog/check-court-case-status-ecourts-india</loc><lastmod>2026-05-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <!-- Telangana districts -->
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/hyderabad</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/secunderabad</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/rangareddy</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/medchal</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/sangareddy</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/medak</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/nizamabad</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/karimnagar</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/warangal</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/hanumakonda</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/warangal-rural</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/khammam</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/nalgonda</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/suryapet</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/rajanna-sircilla</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/peddapalli</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/mancherial</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/adilabad</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/kumuram-bheem</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/nirmal</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/jagtial</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/kamareddy</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/siddipet</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/jangaon</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/mahabubnagar</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/nagarkurnool</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/wanaparthy</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/gadwal</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/narayanpet</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/vikarabad</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/mahabubabad</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/jayashankar-bhupalpally</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/mulugu</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/bhadradri-kothagudem</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/yadadri</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <!-- Andhra Pradesh districts -->
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/visakhapatnam</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/vijayawada</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/ntr-district</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/guntur</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/bapatla</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/palnadu</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/ongole</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/nellore</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/kurnool</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/nandyal</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/anantapur</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/sri-sathya-sai</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/kadapa</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/chittoor</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/tirupati</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/sri-balaji</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/rajahmundry</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/kakinada</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/konaseema</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/eluru</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/bhimavaram</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/krishna</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/srikakulam</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/vizianagaram</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/anakapalli</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/alluri-sitharama-raju</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://litiga-forge-ai.replit.app/lawyers/parvathipuram</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
</urlset>"""
    return Response(content=content, media_type="application/xml")

# ── Authenticated secure file serving (Replit Object Storage) ────────────────
# Files are stored in Replit Object Storage (GCS-backed), not local disk.
# Every download goes through this endpoint which verifies ownership first.

def _get_storage():
    try:
        from replit.object_storage import Client as _OSClient
        return _OSClient()
    except Exception:
        return None


@app.get(f"{BASE_PATH}/secure-files/{{filename}}")
async def serve_secure_file(
    filename: str,
    current_user: dict = Depends(_require_user),
):
    """
    Serve an uploaded case document only to the client who owns it or the
    assigned lawyer — never publicly. Prevents path traversal via basename check.
    """
    # Block path traversal
    safe = os.path.basename(filename)
    if safe != filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid file path")

    # Ownership check via DB
    file_url = f"/secure-files/{safe}"
    doc = await db_fetchrow(
        """SELECT d.client_id, d.file_path, c.lawyer_id
           FROM client_documents d
           LEFT JOIN lawyer_cases c ON d.case_id = c.id
           WHERE d.file_url = $1""",
        file_url,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    uid = current_user["id"]
    if doc["client_id"] != uid and (doc["lawyer_id"] is None or doc["lawyer_id"] != uid):
        raise HTTPException(status_code=403, detail="Access denied")

    # Try Object Storage first
    storage = _get_storage()
    obj_key = doc.get("file_path") or ""
    if storage and obj_key and not obj_key.startswith("/"):
        try:
            content = storage.download_as_bytes(obj_key)
            ext = safe.rsplit(".", 1)[-1].lower() if "." in safe else "bin"
            mime_map = {
                "pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "png": "image/png", "doc": "application/msword",
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "txt": "text/plain",
            }
            media_type = mime_map.get(ext, "application/octet-stream")
            return Response(
                content=content,
                media_type=media_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{safe}"',
                    "X-Content-Type-Options": "nosniff",
                },
            )
        except Exception as e:
            logger.warning("Object storage fetch failed for %s: %s", safe, e)

    # Fallback: local disk (legacy uploads before migration)
    import pathlib as _pl
    _uploads_dir = os.path.join(_script_dir, "uploads")
    fp = _pl.Path(_uploads_dir) / safe
    try:
        fp.resolve().relative_to(_pl.Path(_uploads_dir).resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file path")

    if fp.is_file():
        return FileResponse(
            str(fp),
            headers={
                "Content-Disposition": f'attachment; filename="{safe}"',
                "X-Content-Type-Options": "nosniff",
            },
        )

    raise HTTPException(status_code=404, detail="File not found")


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
