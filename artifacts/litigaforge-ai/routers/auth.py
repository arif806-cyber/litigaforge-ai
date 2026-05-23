"""
LitigaForge AI — Auth Router
Registration, login, logout, and user profile.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Optional

from auth import (
    hash_password, verify_password, create_token,
    get_current_user, require_user,
    set_auth_cookie, clear_auth_cookie,
)
from database import create_user, get_user_by_email
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
    token = create_token(user["id"])
    set_auth_cookie(response, token)
    return {"user": user, "token": token}


@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(req: LoginRequest, request: Request, response: Response):
    user = await get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    # Remove password hash from response
    user.pop("password_hash", None)
    token = create_token(user["id"])
    set_auth_cookie(response, token)
    return {"user": user, "token": token}


@router.get("/auth/me")
async def me(current_user: dict = Depends(require_user)):
    return current_user


@router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"message": "Logged out successfully"}
