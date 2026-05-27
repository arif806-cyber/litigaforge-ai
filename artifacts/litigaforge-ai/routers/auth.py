"""
LitigaForge AI — Auth Router
Registration, login, logout, token refresh, and user profile.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from auth import (
    hash_password, verify_password, create_token, create_refresh_token,
    get_current_user, require_user,
    set_auth_cookie, clear_auth_cookie,
    set_refresh_cookie, clear_refresh_cookie,
    REFRESH_TOKEN_DAYS,
)
from database import (
    create_user, get_user_by_email, get_user_by_id,
    store_refresh_token, get_refresh_token,
    delete_refresh_token, delete_all_user_refresh_tokens,
)
from rate_limit import limiter
from sanitizer import sanitize_text
import re as _re

router = APIRouter(tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "client"


class LoginRequest(BaseModel):
    email: str
    password: str


async def _issue_tokens(user_id: int, response: Response) -> str:
    """Create access + refresh tokens, set cookies, persist refresh token."""
    access_token = create_token(user_id)
    refresh_token = create_refresh_token()
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_DAYS)
    await store_refresh_token(user_id, refresh_token, expires_at)
    set_auth_cookie(response, access_token)
    set_refresh_cookie(response, refresh_token)
    return access_token


@router.post("/auth/register")
@limiter.limit("3/minute")
async def register(req: RegisterRequest, request: Request, response: Response):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(req.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name is too short")
    try:
        safe_name = sanitize_text(req.name, max_length=100, field_name="name")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if not _re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', req.email):
        raise HTTPException(status_code=422, detail="Invalid email format")
    try:
        user = await create_user(
            email=req.email,
            name=safe_name,
            password_hash=hash_password(req.password),
            role=req.role,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    token = await _issue_tokens(user["id"], response)
    return {"user": user, "token": token}


@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(req: LoginRequest, request: Request, response: Response):
    user = await get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    user.pop("password_hash", None)
    token = await _issue_tokens(user["id"], response)
    return {"user": user, "token": token}


@router.get("/auth/me")
async def me(current_user: dict = Depends(require_user)):
    return current_user


@router.post("/auth/refresh")
@limiter.limit("30/minute")
async def refresh_token(request: Request, response: Response):
    """
    Reads the lf_refresh cookie, validates it against the DB,
    rotates the refresh token (old one deleted, new one stored),
    and issues a fresh access token cookie.
    """
    raw = request.cookies.get("lf_refresh")
    if not raw:
        raise HTTPException(status_code=401, detail="No refresh token")

    row = await get_refresh_token(raw)
    if not row:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if row["expires_at"].replace(tzinfo=None) < datetime.utcnow():
        await delete_refresh_token(raw)
        clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user_id = row["user_id"]
    user = await get_user_by_id(user_id)
    if not user:
        await delete_refresh_token(raw)
        raise HTTPException(status_code=401, detail="User not found")

    # Rotate: delete old refresh token and issue a fresh pair
    await delete_refresh_token(raw)
    token = await _issue_tokens(user_id, response)
    return {"token": token}


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    raw = request.cookies.get("lf_refresh")
    if raw:
        await delete_refresh_token(raw)
    clear_auth_cookie(response)
    clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}
