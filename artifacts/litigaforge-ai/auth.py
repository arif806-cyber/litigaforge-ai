"""
JWT authentication + password hashing for LitigaForge AI.
Uses bcrypt directly (avoids passlib 1.7.x / bcrypt 4.x+ compatibility issues).
Access token: JWT, 1 day, httpOnly cookie "lf_token".
Refresh token: opaque 32-byte urlsafe token, 7 days, httpOnly cookie "lf_refresh",
               stored in the refresh_tokens DB table.
"""
import os
import secrets
import hashlib
from datetime import datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response
from jwt.exceptions import PyJWTError

from database import get_user_by_id, fetchrow as _fetchrow
from rate_limit import get_client_ip

TIER_LIMITS = {
    "free": 5,
    "professional": 50,
    "advocate_pro": -1,
}

AI_HOURLY_LIMIT = 20
ANONYMOUS_ASK_DAILY_LIMIT = 2


def check_tier_usage(user: dict) -> bool:
    """Returns True if user is within their tier's monthly limit."""
    tier = user.get("subscription_tier", "free")
    limit = TIER_LIMITS.get(tier, 5)
    if limit == -1:
        return True
    return (user.get("cases_this_month", 0) or 0) < limit


_DEV_SECRET_FALLBACK = "litigaforge-dev-secret-change-in-prod"
SECRET_KEY = os.getenv("SESSION_SECRET", "")
if not SECRET_KEY:
    import logging as _startup_log
    _startup_log.getLogger("litigaforge.auth").critical(
        "SESSION_SECRET env var is not set — using insecure dev fallback. "
        "Set SESSION_SECRET in production before accepting real user sessions."
    )
    SECRET_KEY = _DEV_SECRET_FALLBACK
elif SECRET_KEY == _DEV_SECRET_FALLBACK:
    import logging as _startup_log
    _startup_log.getLogger("litigaforge.auth").warning(
        "SESSION_SECRET is the dev default value — rotate it before going to production."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 24 * 60
REFRESH_TOKEN_DAYS = 7


# ── Cookie helpers ────────────────────────────────────────────────────────────

def _is_prod() -> bool:
    from runtime_env import is_production
    return is_production()


def set_auth_cookie(response: Response, token: str) -> None:
    prod = _is_prod()
    response.set_cookie(
        key="lf_token",
        value=token,
        httponly=True,
        secure=prod,
        samesite="strict" if prod else "lax",
        max_age=ACCESS_TOKEN_MINUTES * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie("lf_token", path="/")


def set_refresh_cookie(response: Response, token: str) -> None:
    prod = _is_prod()
    response.set_cookie(
        key="lf_refresh",
        value=token,
        httponly=True,
        secure=prod,
        samesite="strict" if prod else "lax",
        max_age=REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        path="/litigaforge/auth/refresh",  # scoped: only sent to the refresh endpoint
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie("lf_refresh", path="/litigaforge/auth/refresh")


# ── Token creation / verification ─────────────────────────────────────────────

def hash_password(password: str) -> str:
    pw = password.encode("utf-8")
    if len(pw) > 72:
        pw = pw[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    pw = plain.encode("utf-8")
    if len(pw) > 72:
        pw = pw[:72]
    try:
        return bcrypt.checkpw(pw, hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: int) -> str:
    """JWT access token with a one-day lifetime; refresh remains cookie-only."""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token() -> str:
    """Opaque 32-byte URL-safe refresh token."""
    return secrets.token_urlsafe(32)


def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── FastAPI dependencies ───────────────────────────────────────────────────────

def _extract_token(request: Request) -> str | None:
    """Read the access token exclusively from the httpOnly browser cookie."""
    return request.cookies.get("lf_token")


def _token_dependency(request: Request) -> str | None:
    return _extract_token(request)


async def get_current_user(token: str | None = Depends(_token_dependency)) -> dict | None:
    """Optional auth — returns None if no token provided."""
    if not token:
        return None
    user_id = decode_token(token)
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_user(token: str | None = Depends(_token_dependency)) -> dict:
    """Strict auth — raises 401 if no valid token."""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = decode_token(token)
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("must_change_password"):
        raise HTTPException(
            status_code=403,
            detail="Change your temporary password before using LitigaForge.",
        )
    return user


async def require_advocate_role(
    request: Request,
    user: dict = Depends(require_user),
) -> dict:
    """Consistent role gate for advocate-only practice-management endpoints."""
    # This module's router also hosts explicitly client-scoped case endpoints.
    if request and "/client/" in request.url.path:
        return user
    if (
        user.get("role") not in ("advocate", "lawyer")
        or not user.get("has_lawyer_profile")
    ):
        raise HTTPException(
            status_code=403,
            detail="Advocate access required. Choose Advocate and complete your advocate profile.",
        )
    return user


async def require_non_demo_user(user: dict = Depends(require_user)) -> dict:
    """Prevent a shared demonstration identity from creating financial records."""
    if user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Billing is disabled for demo accounts.")
    return user


async def reserve_hourly_ai_call(user: dict) -> dict:
    """Atomically reserve one AI call in the user's current clock-hour bucket."""
    row = await _fetchrow(
        """INSERT INTO ai_usage_hourly (user_id, usage_hour, call_count)
           VALUES ($1, date_trunc('hour', CURRENT_TIMESTAMP), 1)
           ON CONFLICT (user_id, usage_hour) DO UPDATE
             SET call_count = ai_usage_hourly.call_count + 1,
                 updated_at = NOW()
           WHERE ai_usage_hourly.call_count < $2
           RETURNING call_count""",
        user["id"], AI_HOURLY_LIMIT,
    )
    if not row:
        raise HTTPException(
            status_code=429,
            detail=f"AI call limit reached ({AI_HOURLY_LIMIT}/hour).",
            headers={"Retry-After": "3600"},
        )
    return user


async def require_ai_user(current_user: dict = Depends(require_user)) -> dict:
    """Strict auth plus an atomic per-user hourly AI-call reservation."""
    user = await reserve_hourly_ai_call(current_user)
    from ai_budget import reserve_global_ai_capacity
    await reserve_global_ai_capacity()
    return user


async def require_ask_access(
    request: Request,
    current_user: dict | None = Depends(get_current_user),
) -> dict | None:
    """Meter logged-in users; allow only two anonymous /ask calls per IP/day."""
    if current_user:
        user = await reserve_hourly_ai_call(current_user)
        from ai_budget import reserve_global_ai_capacity
        await reserve_global_ai_capacity()
        return user

    ip_hash = hashlib.sha256(get_client_ip(request).encode("utf-8")).hexdigest()
    row = await _fetchrow(
        """INSERT INTO anonymous_ai_usage_daily (ip_hash, usage_date, call_count)
           VALUES ($1, CURRENT_DATE, 1)
           ON CONFLICT (ip_hash, usage_date) DO UPDATE
             SET call_count = anonymous_ai_usage_daily.call_count + 1,
                 updated_at = NOW()
           WHERE anonymous_ai_usage_daily.call_count < $2
           RETURNING call_count""",
        ip_hash, ANONYMOUS_ASK_DAILY_LIMIT,
    )
    if not row:
        raise HTTPException(
            status_code=401,
            detail="Anonymous question limit reached. Please log in to continue.",
        )
    from ai_budget import reserve_global_ai_capacity
    await reserve_global_ai_capacity()
    return None


def get_superuser(current_user: dict = Depends(require_user)) -> dict:
    """Admin-only dependency — raises 403 if user is not a superuser."""
    if not current_user.get("is_superuser"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
