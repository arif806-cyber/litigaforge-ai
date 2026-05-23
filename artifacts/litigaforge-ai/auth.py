"""
JWT authentication + password hashing for LitigaForge AI.
Uses bcrypt directly (avoids passlib 1.7.x / bcrypt 4.x+ compatibility issues).
Auth token is read from httpOnly cookie first, with Authorization header as fallback.
"""
import os
from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, Request, Response
from jose import jwt, JWTError

from database import get_user_by_id

SECRET_KEY = os.getenv("SESSION_SECRET", "litigaforge-dev-secret-change-in-prod")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="lf_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=60 * 60 * 24 * TOKEN_EXPIRE_DAYS,
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie("lf_token")


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
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def _extract_token(request: Request) -> str | None:
    """Read token from cookie first, then Authorization header fallback."""
    token = request.cookies.get("lf_token")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def _token_dependency(request: Request) -> str | None:
    """FastAPI dependency that extracts token from request."""
    return _extract_token(request)


def get_current_user(token: str | None = Depends(_token_dependency)) -> dict | None:
    """Optional auth — returns None if no token provided."""
    if not token:
        return None
    user_id = decode_token(token)
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_user(token: str | None = Depends(_token_dependency)) -> dict:
    """Strict auth — raises 401 if no valid token."""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = decode_token(token)
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
