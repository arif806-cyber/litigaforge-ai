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
    execute as db_execute, fetch as db_fetch,
    fetchrow as db_fetchrow,
)
from rate_limit import limiter
from sanitizer import sanitize_text
from logger import get_logger
import re as _re
import os as _os
import pathlib as _pathlib

logger = get_logger("litigaforge.auth")

router = APIRouter(tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "client"
    recaptcha_token: str | None = None


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
    # reCAPTCHA v3 (non-blocking when RECAPTCHA_SECRET_KEY not configured)
    _recaptcha_secret = _os.getenv("RECAPTCHA_SECRET_KEY")
    if _recaptcha_secret and req.recaptcha_token:
        try:
            import httpx as _httpx_rc
            async with _httpx_rc.AsyncClient(timeout=5.0) as _hc:
                _rv = await _hc.post(
                    "https://www.google.com/recaptcha/api/siteverify",
                    data={"secret": _recaptcha_secret, "response": req.recaptcha_token},
                )
            _rd = _rv.json()
            if not _rd.get("success") or float(_rd.get("score", 1.0)) < 0.5:
                raise HTTPException(status_code=400, detail="Bot detection triggered. Please try again.")
        except HTTPException:
            raise
        except Exception:
            pass  # non-blocking on network errors
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
    # Send verification email (no-op if SMTP not configured)
    try:
        vtoken = await _create_verification_token(user["id"])
        await _send_verification_email(req.email, vtoken)
    except Exception:
        pass
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


@router.post("/auth/google")
@limiter.limit("10/minute")
async def google_oauth(request: Request, response: Response):
    """Sign in / register with a Google Identity Services credential token."""
    import httpx as _httpx
    import secrets as _secrets

    body = await request.json()
    credential = (body.get("credential") or "").strip()
    role = body.get("role", "client")

    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential")

    google_client_id = _os.getenv("GOOGLE_CLIENT_ID")

    # Verify ID token with Google's tokeninfo endpoint
    try:
        async with _httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        token_info = r.json()
    except HTTPException:
        raise
    except _httpx.RequestError:
        raise HTTPException(status_code=503, detail="Could not reach Google to verify token")

    # Verify audience when CLIENT_ID is configured
    if google_client_id and token_info.get("aud") != google_client_id:
        raise HTTPException(status_code=401, detail="Token audience mismatch")

    email = token_info.get("email", "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email address")

    raw_name = (token_info.get("name") or token_info.get("given_name") or email.split("@")[0])[:100]
    try:
        name = sanitize_text(raw_name, max_length=100, field_name="name")
    except ValueError:
        name = email.split("@")[0]

    safe_role = role if role in ("client", "lawyer") else "client"

    user = await get_user_by_email(email)
    if not user:
        try:
            user = await create_user(
                email=email,
                name=name,
                password_hash=hash_password(_secrets.token_hex(24)),
                role=safe_role,
            )
        except ValueError:
            user = await get_user_by_email(email)
            if not user:
                raise HTTPException(status_code=500, detail="Failed to create Google account")
    else:
        user.pop("password_hash", None)

    token = await _issue_tokens(user["id"], response)
    logger.info(f"Google OAuth: user {user['id']} ({email})")
    return {"user": user, "token": token}


@router.get("/auth/me")
async def me(current_user: dict = Depends(require_user)):
    return current_user


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    email: str | None = None


@router.patch("/auth/profile")
@limiter.limit("10/minute")
async def update_profile(
    req: UpdateProfileRequest,
    request: Request,
    current_user: dict = Depends(require_user),
):
    """Update display name and/or email. DPDP Act 2023 § 12(a) — Right to Correction."""
    user_id = current_user["id"]
    updates: dict = {}

    if req.name is not None:
        name = sanitize_text(req.name.strip(), max_length=100, field_name="name")
        if len(name) < 2:
            raise HTTPException(400, "Name must be at least 2 characters")
        updates["name"] = name

    if req.email is not None:
        email = req.email.strip().lower()
        if not _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise HTTPException(400, "Invalid email address")
        existing = await get_user_by_email(email)
        if existing and existing["id"] != user_id:
            raise HTTPException(409, "Email already in use by another account")
        updates["email"] = email

    if not updates:
        raise HTTPException(400, "No fields to update")

    set_clause = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates))
    values = list(updates.values())
    row = await db_fetchrow(
        f"UPDATE users SET {set_clause} WHERE id = $1 RETURNING id, name, email, subscription_tier, is_superuser, created_at",
        user_id, *values,
    )
    if not row:
        raise HTTPException(404, "User not found")
    logger.info("Profile updated: user_id=%s fields=%s", user_id, list(updates.keys()))
    return row


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


async def _send_verification_email(email: str, token: str) -> bool:
    """Send verification email via SMTP. Returns True on success, False if SMTP not configured."""
    import smtplib
    from email.mime.text import MIMEText
    smtp_host = _os.getenv("SMTP_HOST")
    if not smtp_host:
        return False
    smtp_port = int(_os.getenv("SMTP_PORT", "587"))
    smtp_user = _os.getenv("SMTP_USER", "")
    smtp_pass = _os.getenv("SMTP_PASSWORD", "")
    smtp_from = _os.getenv("SMTP_FROM", smtp_user)
    verify_url = f"https://litiga-forge-ai.replit.app/litigaforge/auth/verify-email?token={token}"
    body = (
        f"Welcome to LitigaForge AI!\n\n"
        f"Please verify your email address by clicking the link below:\n\n"
        f"{verify_url}\n\n"
        f"This link expires in 24 hours.\n\n"
        f"— LitigaForge AI Team"
    )
    msg = MIMEText(body)
    msg["Subject"] = "Verify your LitigaForge AI email"
    msg["From"] = smtp_from
    msg["To"] = email
    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
                if smtp_user:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, [email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                if smtp_user:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, [email], msg.as_string())
        return True
    except Exception as exc:
        logger.warning("SMTP send failed for %s: %s", email, exc)
        return False


async def _create_verification_token(user_id: int) -> str:
    """Create and store a 24-hour verification token."""
    import secrets
    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=24)
    await db_execute(
        "DELETE FROM email_verification_tokens WHERE user_id = $1",
        user_id,
    )
    await db_execute(
        "INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
        user_id, token, expires,
    )
    return token


@router.get("/auth/verify-email")
async def verify_email(token: str):
    """Verify email via token from link. Marks user as verified."""
    row = await db_fetchrow(
        "SELECT user_id, expires_at FROM email_verification_tokens WHERE token = $1",
        token,
    )
    if not row:
        raise HTTPException(400, "Invalid or expired verification link")
    if row["expires_at"].replace(tzinfo=None) < datetime.utcnow():
        await db_execute("DELETE FROM email_verification_tokens WHERE token = $1", token)
        raise HTTPException(400, "Verification link has expired — please request a new one")
    await db_execute("UPDATE users SET email_verified = TRUE WHERE id = $1", row["user_id"])
    await db_execute("DELETE FROM email_verification_tokens WHERE token = $1", token)
    logger.info("Email verified for user_id=%s", row["user_id"])
    return {"message": "Email verified successfully"}


@router.post("/auth/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, current_user: dict = Depends(require_user)):
    """Resend verification email. Rate-limited to 3/minute."""
    if current_user.get("email_verified"):
        return {"message": "Email already verified"}
    token = await _create_verification_token(current_user["id"])
    sent = await _send_verification_email(current_user["email"], token)
    if sent:
        return {"message": "Verification email sent"}
    return {"message": "SMTP not configured — token created. Contact admin to verify manually."}


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    raw = request.cookies.get("lf_refresh")
    if raw:
        await delete_refresh_token(raw)
    clear_auth_cookie(response)
    clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.patch("/auth/password")
@limiter.limit("5/minute")
async def change_password(
    req: ChangePasswordRequest,
    request: Request,
    current_user: dict = Depends(require_user),
):
    """Change password after verifying the current one."""
    from auth import verify_password, hash_password
    user = await get_user_by_id(current_user["id"])
    if not user or not verify_password(req.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(req.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")
    new_hash = hash_password(req.new_password)
    await db_execute(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        new_hash, current_user["id"],
    )
    logger.info("Password changed: user_id=%s", current_user["id"])
    return {"message": "Password updated successfully"}


@router.delete("/auth/account")
@limiter.limit("3/minute")
async def delete_account(
    request: Request,
    response: Response,
    current_user: dict = Depends(require_user),
):
    """
    Permanently delete account and all personal data.
    Right to Erasure — Digital Personal Data Protection Act 2023, Section 12(1)(b).
    """
    user_id = current_user["id"]

    # 1. Revoke all active sessions first
    await delete_all_user_refresh_tokens(user_id)

    # 2. Delete files from Object Storage (or legacy local disk)
    docs = await db_fetch(
        "SELECT file_path FROM client_documents WHERE client_id = $1", user_id
    )
    for doc in docs:
        fp = doc.get("file_path") or ""
        if not fp:
            continue
        if not fp.startswith("/"):
            # Object storage key
            try:
                from replit.object_storage import Client as _OSClient
                _OSClient().delete(fp)
            except Exception:
                pass
        else:
            try:
                p = _pathlib.Path(fp)
                if p.is_file():
                    _os.remove(p)
            except OSError:
                pass

    # 3. Delete DB records in FK-safe order
    # Chat messages
    await db_execute("DELETE FROM chat_messages WHERE sender_id = $1", user_id)
    # Chat threads belonging to client's matches
    match_ids = await db_fetch(
        "SELECT id FROM matches WHERE client_id = $1", user_id
    )
    for m in match_ids:
        await db_execute("DELETE FROM chat_threads WHERE match_id = $1", m["id"])
    # Documents
    await db_execute("DELETE FROM client_documents WHERE client_id = $1", user_id)
    # Matches
    await db_execute("DELETE FROM matches WHERE client_id = $1 OR lawyer_id IN "
                     "(SELECT id FROM lawyers WHERE user_id = $1)", user_id)
    # Case requirements
    await db_execute("DELETE FROM case_requirements WHERE user_id = $1", user_id)
    # Lawyer cases where client
    await db_execute("DELETE FROM lawyer_cases WHERE client_id = $1", user_id)
    # Nullify lawyer profile link (preserve public profile, remove personal link)
    await db_execute("UPDATE lawyers SET user_id = NULL WHERE user_id = $1", user_id)
    # Legal questions
    await db_execute("DELETE FROM legal_questions WHERE user_id = $1", user_id)
    # Subscriptions
    await db_execute("DELETE FROM subscriptions WHERE user_id = $1", user_id)
    # Finally delete the user
    await db_execute("DELETE FROM users WHERE id = $1", user_id)

    # 4. Clear browser cookies
    clear_auth_cookie(response)
    clear_refresh_cookie(response)

    logger.info("DPDP erasure complete: user_id=%s", user_id)
    return {
        "message": "Your account and all personal data have been permanently deleted "
                   "in compliance with the Digital Personal Data Protection Act 2023."
    }


# ── Sign in with Apple ────────────────────────────────────────────────────────
class AppleLoginRequest(BaseModel):
    id_token: str
    first_name: str | None = None
    last_name: str | None = None
    role: str = "client"


@router.post("/auth/apple")
@limiter.limit("10/minute")
async def apple_login(req: AppleLoginRequest, request: Request, response: Response):
    """Verify Apple ID token, find-or-create user, issue JWT."""
    import httpx as _httpx_apple
    from jose import jwt as _jose_jwt, JWTError as _JWTError

    apple_client_id = _os.getenv("APPLE_CLIENT_ID", "")

    # Fetch Apple public keys
    try:
        async with _httpx_apple.AsyncClient(timeout=8.0) as _hc:
            _jwks_r = await _hc.get("https://appleid.apple.com/auth/keys")
        _jwks = _jwks_r.json().get("keys", [])
    except Exception as _e:
        logger.warning("apple_login: JWKS fetch failed: %s", _e)
        raise HTTPException(503, "Could not verify Apple credentials — try again")

    # Find matching key
    try:
        _header = _jose_jwt.get_unverified_header(req.id_token)
    except Exception:
        raise HTTPException(400, "Invalid Apple ID token format")

    _key = next((k for k in _jwks if k.get("kid") == _header.get("kid")), None)
    if not _key:
        raise HTTPException(400, "No matching Apple public key — token may be expired")

    # Verify token
    _decode_opts = {"verify_aud": bool(apple_client_id)}
    try:
        _claims = _jose_jwt.decode(
            req.id_token,
            _key,
            algorithms=["RS256"],
            audience=apple_client_id if apple_client_id else None,
            options=_decode_opts,
        )
    except _JWTError as _je:
        logger.warning("apple_login: JWT decode failed: %s", _je)
        raise HTTPException(401, "Apple ID token verification failed")

    if _claims.get("iss") != "https://appleid.apple.com":
        raise HTTPException(401, "Apple token issuer mismatch")

    apple_user_id = _claims.get("sub", "")
    email = _claims.get("email") or f"apple_{apple_user_id[:12]}@privaterelay.appleid.com"
    email_hidden = _claims.get("email_verified") is None  # relay email

    # Build display name — Apple only sends name on first sign-in
    display_name = " ".join(filter(None, [req.first_name, req.last_name])).strip()
    if not display_name:
        display_name = email.split("@")[0].replace(".", " ").title() or "Apple User"

    # Find or create user
    existing = await get_user_by_email(email)
    if existing:
        user = existing
    else:
        try:
            user = await create_user(
                email=email,
                name=display_name,
                password_hash=hash_password(_os.urandom(32).hex()),  # random, never used
                role=req.role,
            )
        except ValueError:
            user = await get_user_by_email(email)
            if not user:
                raise HTTPException(500, "Account creation failed")

    token = await _issue_tokens(user["id"], response)
    logger.info("apple_login: user_id=%s email_hidden=%s", user["id"], email_hidden)
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "subscription_tier": user.get("subscription_tier", "free"),
            "cases_this_month": user.get("cases_this_month", 0),
            "is_superuser": user.get("is_superuser", False),
            "role": user.get("role", "client"),
        },
    }
