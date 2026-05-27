"""
JWT authentication + password hashing for LitigaForge AI.
Uses bcrypt directly (avoids passlib 1.7.x / bcrypt 4.x+ compatibility issues).
Access token: JWT, 15 min, httpOnly cookie "lf_token".
Refresh token: opaque 32-byte urlsafe token, 7 days, httpOnly cookie "lf_refresh",
               stored in the refresh_tokens DB table.
"""
import os
import secrets
from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, Request, Response
from jose import jwt, JWTError

from database import get_user_by_id

SECRET_KEY = os.getenv("SESSION_SECRET", "litigaforge-dev-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 15
REFRESH_TOKEN_DAYS = 7


# ── Cookie helpers ────────────────────────────────────────────────────────────

def _is_prod() -> bool:
    return os.getenv("ENVIRONMENT", "development").lower() in ("production", "prod")


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
    """Short-lived JWT access token (15 min)."""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token() -> str:
    """Opaque 32-byte URL-safe refresh token."""
    return secrets.token_urlsafe(32)


def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── FastAPI dependencies ───────────────────────────────────────────────────────

def _extract_token(request: Request) -> str | None:
    """Read access token from cookie first, then Authorization header fallback."""
    token = request.cookies.get("lf_token")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


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
    return user


def get_superuser(current_user: dict = Depends(require_user)) -> dict:
    """Admin-only dependency — raises 403 if user is not a superuser."""
    if not current_user.get("is_superuser"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
