"""
LitigaForge AI — Passkeys Router (WebAuthn / FIDO2)
Passwordless biometric login: Face ID, Touch ID, Windows Hello.
"""
import json
import os
import asyncio
from urllib.parse import urlparse

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel

from auth import require_user, create_token
from database import (
    fetchrow as db_fetchrow,
    fetch as db_fetch,
    execute as db_execute,
)
from rate_limit import limiter
from logger import get_logger

import base64 as _base64

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
    base64url_to_bytes,
)


def _bytes_to_base64url(data: bytes) -> str:
    return _base64.urlsafe_b64encode(data).rstrip(b"=").decode()


from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    ResidentKeyRequirement,
    RegistrationCredential,
    AuthenticationCredential,
    AuthenticatorAttestationResponse,
    AuthenticatorAssertionResponse,
)

logger = get_logger("litigaforge.passkeys")
router = APIRouter(tags=["passkeys"])

# In-memory challenge store with TTL (challenge_key → bytes)
_reg_challenges: dict[str, bytes] = {}
_auth_challenges: dict[str, bytes] = {}
_challenge_lock = asyncio.Lock()


def _rp_info(request: Request) -> tuple[str, str]:
    """Determine RP ID and expected origin from environment / request."""
    replit_domains = os.getenv("REPLIT_DOMAINS", "")
    if replit_domains:
        domain = replit_domains.split(",")[0].strip()
        return domain, f"https://{domain}"

    origin = request.headers.get("origin", "")
    if origin:
        parsed = urlparse(origin)
        return (parsed.hostname or "localhost"), origin

    return "localhost", "http://localhost:23790"


# ── Register: generate options ────────────────────────────────────────────────
@router.get("/auth/passkey/register-options")
@limiter.limit("20/minute")
async def passkey_register_options(
    request: Request, user: dict = Depends(require_user)
):
    rp_id, _ = _rp_info(request)
    options = generate_registration_options(
        rp_id=rp_id,
        rp_name="LitigaForge AI",
        user_id=str(user["id"]).encode(),
        user_name=user["email"],
        user_display_name=user["name"],
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.REQUIRED,
            resident_key=ResidentKeyRequirement.PREFERRED,
        ),
    )
    async with _challenge_lock:
        _reg_challenges[str(user["id"])] = options.challenge

    return json.loads(options_to_json(options))


# ── Register: verify & persist ────────────────────────────────────────────────
class _RegBody(BaseModel):
    id: str
    rawId: str
    type: str
    response: dict


@router.post("/auth/passkey/register")
@limiter.limit("10/minute")
async def passkey_register_verify(
    body: _RegBody,
    request: Request,
    user: dict = Depends(require_user),
):
    async with _challenge_lock:
        challenge = _reg_challenges.pop(str(user["id"]), None)
    if not challenge:
        raise HTTPException(400, "No pending challenge — refresh and try again")

    rp_id, expected_origin = _rp_info(request)
    try:
        verification = verify_registration_response(
            credential=RegistrationCredential(
                id=body.id,
                raw_id=base64url_to_bytes(body.rawId),
                response=AuthenticatorAttestationResponse(
                    client_data_json=base64url_to_bytes(body.response["clientDataJSON"]),
                    attestation_object=base64url_to_bytes(body.response["attestationObject"]),
                ),
            ),
            expected_challenge=challenge,
            expected_rp_id=rp_id,
            expected_origin=expected_origin,
            require_user_verification=True,
        )
    except Exception as exc:
        logger.warning("passkey_register_verify failed: %s", exc)
        raise HTTPException(400, str(exc))

    cred_id = _bytes_to_base64url(verification.credential_id)
    await db_execute(
        """
        INSERT INTO passkey_credentials (user_id, credential_id, public_key, sign_count)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (credential_id) DO UPDATE
            SET sign_count = EXCLUDED.sign_count,
                public_key = EXCLUDED.public_key
        """,
        user["id"],
        cred_id,
        verification.credential_public_key,
        verification.sign_count,
    )
    logger.info("passkey registered user_id=%s cred_id=%s", user["id"], cred_id[:16])
    return {"ok": True, "message": "Passkey registered — sign in with Face ID or Touch ID next time"}


# ── Login: generate options ───────────────────────────────────────────────────
@router.post("/auth/passkey/login-options")
@limiter.limit("30/minute")
async def passkey_login_options(request: Request):
    rp_id, _ = _rp_info(request)
    options = generate_authentication_options(
        rp_id=rp_id,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    session_key = (request.client.host if request.client else "anon")
    async with _challenge_lock:
        _auth_challenges[session_key] = options.challenge

    result = json.loads(options_to_json(options))
    result["rpId"] = rp_id
    return result


# ── Login: verify ─────────────────────────────────────────────────────────────
class _LoginBody(BaseModel):
    id: str
    rawId: str
    type: str
    response: dict


@router.post("/auth/passkey/login")
@limiter.limit("10/minute")
async def passkey_login_verify(body: _LoginBody, request: Request):
    session_key = (request.client.host if request.client else "anon")
    async with _challenge_lock:
        challenge = _auth_challenges.pop(session_key, None)
    if not challenge:
        raise HTTPException(400, "No pending challenge — start over")

    cred_row = await db_fetchrow(
        "SELECT * FROM passkey_credentials WHERE credential_id = $1", body.id
    )
    if not cred_row:
        raise HTTPException(404, "Passkey not found — please register first")

    rp_id, expected_origin = _rp_info(request)
    user_handle_raw = body.response.get("userHandle")
    try:
        verification = verify_authentication_response(
            credential=AuthenticationCredential(
                id=body.id,
                raw_id=base64url_to_bytes(body.rawId),
                response=AuthenticatorAssertionResponse(
                    client_data_json=base64url_to_bytes(body.response["clientDataJSON"]),
                    authenticator_data=base64url_to_bytes(body.response["authenticatorData"]),
                    signature=base64url_to_bytes(body.response["signature"]),
                    user_handle=base64url_to_bytes(user_handle_raw) if user_handle_raw else None,
                ),
            ),
            expected_challenge=challenge,
            expected_rp_id=rp_id,
            expected_origin=expected_origin,
            credential_public_key=bytes(cred_row["public_key"]),
            credential_current_sign_count=cred_row["sign_count"],
            require_user_verification=True,
        )
    except Exception as exc:
        logger.warning("passkey_login_verify failed: %s", exc)
        raise HTTPException(401, str(exc))

    await db_execute(
        "UPDATE passkey_credentials SET sign_count=$1 WHERE credential_id=$2",
        verification.new_sign_count, body.id,
    )

    user = await db_fetchrow(
        "SELECT id, email, name, subscription_tier, cases_this_month, "
        "month_reset_date, is_superuser, role, created_at FROM users WHERE id=$1",
        cred_row["user_id"],
    )
    if not user:
        raise HTTPException(404, "User account not found")

    token = create_token({"sub": str(user["id"]), "email": user["email"]})
    logger.info("passkey login user_id=%s", user["id"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "subscription_tier": user["subscription_tier"],
            "cases_this_month": user["cases_this_month"],
            "is_superuser": user["is_superuser"],
            "role": user["role"],
            "created_at": str(user["created_at"]),
        },
    }


# ── List passkeys for current user ────────────────────────────────────────────
@router.get("/auth/passkeys")
@limiter.limit("20/minute")
async def list_passkeys(request: Request, user: dict = Depends(require_user)):
    rows = await db_fetch(
        "SELECT credential_id, created_at FROM passkey_credentials "
        "WHERE user_id=$1 ORDER BY created_at DESC",
        user["id"],
    )
    return {"passkeys": [{"id": r["credential_id"], "created_at": str(r["created_at"])} for r in (rows or [])]}


# ── Delete a passkey ──────────────────────────────────────────────────────────
@router.delete("/auth/passkeys/{cred_id}")
@limiter.limit("10/minute")
async def delete_passkey(
    cred_id: str, request: Request, user: dict = Depends(require_user)
):
    await db_execute(
        "DELETE FROM passkey_credentials WHERE credential_id=$1 AND user_id=$2",
        cred_id, user["id"],
    )
    return {"ok": True}
