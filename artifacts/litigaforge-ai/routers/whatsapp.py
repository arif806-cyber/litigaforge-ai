"""Signed Meta Cloud and Twilio WhatsApp inbound webhooks."""
import hashlib
import hmac
import os
import re

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse, Response

router = APIRouter(tags=["whatsapp"])


def _enabled() -> bool:
    return os.getenv("WA_CLOUD_ENABLED", "").strip().lower() == "true" and all(
        os.getenv(name, "").strip() for name in (
            "WA_CLOUD_TOKEN", "WA_PHONE_NUMBER_ID", "WA_BUSINESS_ACCOUNT_ID",
            "WA_APP_SECRET", "WA_WEBHOOK_VERIFY_TOKEN",
        )
    )


def _normalize_phone(value: str) -> str | None:
    value = (value or "").strip()
    if value.lower().startswith("whatsapp:"):
        value = value.split(":", 1)[1]
    digits = re.sub(r"\D", "", value)
    if not 8 <= len(digits) <= 15:
        return None
    return "+" + digits


async def _set_consent(phone: str, opted_out: bool, source: str) -> None:
    from database import get_pool
    normalized = _normalize_phone(phone)
    if not normalized:
        return
    digits = normalized.lstrip("+")
    pool = await get_pool()
    async with pool.acquire() as conn:
        user_id = await conn.fetchval(
            "SELECT id FROM users WHERE regexp_replace(COALESCE(phone,''),'\\D','','g')=$1 ORDER BY id LIMIT 1",
            digits,
        )
        await conn.execute(
            """INSERT INTO whatsapp_opt_outs(phone_e164,user_id,opted_out_at,opted_in_at,source)
               VALUES($1,$2,CASE WHEN $3 THEN NOW() END,CASE WHEN $3 THEN NULL ELSE NOW() END,$4)
               ON CONFLICT(phone_e164) DO UPDATE SET user_id=COALESCE(EXCLUDED.user_id,whatsapp_opt_outs.user_id),
                 opted_out_at=CASE WHEN $3 THEN NOW() ELSE NULL END,
                 opted_in_at=CASE WHEN $3 THEN NULL ELSE NOW() END,
                 source=EXCLUDED.source,updated_at=NOW()""",
            normalized, user_id, opted_out, source,
        )


def _meta_messages(payload: dict):
    for entry in payload.get("entry", []) if isinstance(payload, dict) else []:
        for change in entry.get("changes", []) if isinstance(entry, dict) else []:
            value = change.get("value", {}) if isinstance(change, dict) else {}
            for message in value.get("messages", []) if isinstance(value, dict) else []:
                yield message


async def _process_inbound(phone: str, text: str, source: str) -> None:
    command = re.sub(r"[^a-z]", "", (text or "").strip().lower())
    if command in {"stop", "unsubscribe", "cancel", "end", "quit"}:
        await _set_consent(phone, True, source)
    elif command in {"start", "unstop", "subscribe"}:
        await _set_consent(phone, False, source)


@router.get("/whatsapp/cloud/webhook")
async def meta_webhook_verify(request: Request):
    if not _enabled():
        raise HTTPException(404, "Webhook is disabled")
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token", "")
    challenge = request.query_params.get("hub.challenge", "")
    expected = os.getenv("WA_WEBHOOK_VERIFY_TOKEN", "")
    if mode != "subscribe" or not hmac.compare_digest(token, expected) or not challenge:
        raise HTTPException(403, "Webhook verification failed")
    return PlainTextResponse(challenge)


@router.post("/whatsapp/cloud/webhook")
async def meta_webhook(request: Request):
    if not _enabled():
        raise HTTPException(404, "Webhook is disabled")
    raw = await request.body()
    supplied = request.headers.get("X-Hub-Signature-256", "")
    expected = "sha256=" + hmac.new(
        os.environ["WA_APP_SECRET"].encode(), raw, hashlib.sha256
    ).hexdigest()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(401, "Invalid webhook signature")
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid webhook payload") from exc
    for message in _meta_messages(payload):
        sender = message.get("from")
        text = (message.get("text") or {}).get("body", "")
        if sender and text:
            await _process_inbound(sender, text, "meta")
    # Delivery statuses are acknowledged without storing message content.
    return {"received": True}


@router.post("/whatsapp/twilio/webhook")
async def twilio_webhook(request: Request):
    from twilio.request_validator import RequestValidator
    token = os.getenv("TWILIO_AUTH_TOKEN", "")
    if not token:
        raise HTTPException(404, "Twilio webhook is disabled")
    form = await request.form()
    signature = request.headers.get("X-Twilio-Signature", "")
    public_url = os.getenv("TWILIO_WEBHOOK_PUBLIC_URL", "").strip()
    if not public_url:
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme).split(",", 1)[0].strip()
        host = request.headers.get("x-forwarded-host", request.headers.get("host", request.url.netloc))
        public_url = f"{scheme}://{host}{request.url.path}"
        if request.url.query:
            public_url += f"?{request.url.query}"
    if not RequestValidator(token).validate(public_url, dict(form), signature):
        raise HTTPException(401, "Invalid Twilio webhook signature")
    await _process_inbound(str(form.get("From", "")), str(form.get("Body", "")), "twilio")
    return Response(content="<Response></Response>", media_type="application/xml")
