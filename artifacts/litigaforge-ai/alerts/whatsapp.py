"""Consent-gated WhatsApp alerts through Meta Cloud API or configured Twilio."""
import asyncio
import logging
import os
import re
from typing import Optional

import httpx

TWILIO_SANDBOX_SENDER = "whatsapp:+14155238886"
log = logging.getLogger("litigaforge.whatsapp")


def _normalize_phone(value: str) -> str:
    value = (value or "").strip()
    if value.lower().startswith("whatsapp:"):
        value = value.split(":", 1)[1]
    digits = re.sub(r"\D", "", value)
    return "+" + digits if 8 <= len(digits) <= 15 else ""


async def _is_opted_out(phone: str) -> bool:
    normalized = _normalize_phone(phone)
    if not normalized:
        return True
    try:
        from database import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            return bool(await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM whatsapp_opt_outs WHERE phone_e164=$1 AND opted_out_at IS NOT NULL)",
                normalized,
            ))
    except Exception:
        # Sending without checking durable consent is not safe.
        log.exception("WhatsApp consent check failed; refusing to send")
        return True


def whatsapp_alerts_enabled() -> bool:
    cloud_enabled = os.getenv("WA_CLOUD_ENABLED", "").strip().lower() == "true"
    cloud_ready = cloud_enabled and all(os.getenv(k, "").strip() for k in (
        "WA_CLOUD_TOKEN", "WA_PHONE_NUMBER_ID", "WA_BUSINESS_ACCOUNT_ID",
        "WA_APP_SECRET", "WA_WEBHOOK_VERIFY_TOKEN",
    )) and any(os.getenv(k, "").strip() for k in (
        "WA_TEMPLATE_GENERAL", "WA_TEMPLATE_INFO", "WA_TEMPLATE_WATCH", "WA_TEMPLATE_HEARING",
    ))
    sender = os.getenv("TWILIO_WHATSAPP_FROM", TWILIO_SANDBOX_SENDER).strip().lower()
    # This reports provider configuration only; the send path still fails closed
    # without credentials and a successful durable consent check.
    twilio_sender_configured = bool(sender and sender != TWILIO_SANDBOX_SENDER)
    return bool(cloud_ready or twilio_sender_configured)


async def _send_meta_template(message: str, recipient: str, alert_type: str) -> dict:
    version = os.getenv("WA_GRAPH_API_VERSION", "v22.0").strip()
    phone_id = os.environ["WA_PHONE_NUMBER_ID"]
    template = os.getenv(f"WA_TEMPLATE_{alert_type.upper()}") or os.getenv("WA_TEMPLATE_GENERAL", "")
    if not template:
        return {"success": False, "error": "Approved WhatsApp template is not configured"}
    language = os.getenv("WA_TEMPLATE_LANGUAGE", "en")
    payload = {
        "messaging_product": "whatsapp",
        "to": _normalize_phone(recipient).lstrip("+"),
        "type": "template",
        "template": {
            "name": template,
            "language": {"code": language},
            "components": [{"type": "body", "parameters": [{"type": "text", "text": message[:1024]}]}],
        },
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"https://graph.facebook.com/{version}/{phone_id}/messages",
            json=payload,
            headers={"Authorization": f"Bearer {os.environ['WA_CLOUD_TOKEN']}"},
        )
    if response.is_error:
        log.warning("Meta WhatsApp send failed status=%s", response.status_code)
        return {"success": False, "error": "WhatsApp provider rejected the template"}
    data = response.json()
    messages = data.get("messages") or []
    return {"success": bool(messages), "mode": "meta", "message_id": messages[0].get("id") if messages else None}


async def send_whatsapp_alert(message: str, to: Optional[str] = None, alert_type: str = "info") -> dict:
    recipient = to or os.getenv("ADVOCATE_WHATSAPP", "")
    if not recipient:
        return {"success": False, "error": "WhatsApp recipient is not configured"}
    normalized = _normalize_phone(recipient)
    if not normalized:
        return {"success": False, "error": "WhatsApp recipient phone is invalid"}
    if await _is_opted_out(normalized):
        return {"success": False, "error": "Recipient has opted out or consent could not be verified"}

    # Cloud API is explicitly inert unless the feature flag and all required
    # credentials are present. Never silently fall back to a different provider.
    if os.getenv("WA_CLOUD_ENABLED", "").strip().lower() == "true":
        if not whatsapp_alerts_enabled():
            return {"success": False, "error": "WhatsApp Cloud API is enabled but not fully configured"}
        try:
            return await _send_meta_template(message, normalized, alert_type)
        except Exception:
            log.exception("Meta WhatsApp send failed")
            return {"success": False, "error": "WhatsApp Cloud API request failed"}

    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    sender = os.getenv("TWILIO_WHATSAPP_FROM", TWILIO_SANDBOX_SENDER)
    if not account_sid or not auth_token or sender.strip().lower() == TWILIO_SANDBOX_SENDER:
        return {"success": False, "error": "WhatsApp messaging is not configured"}

    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        prefix = {
            "watch": "👁️ *LitigaForge Watch Alert*\n\n",
            "hearing": "⚖️ *Upcoming Hearing Reminder*\n\n",
            "forge": "🔥 *New Case Forged*\n\n",
            "info": "ℹ️ *LitigaForge Update*\n\n",
        }.get(alert_type, "")

        full_message = (
            prefix + message +
            "\n\n_Verify all facts independently. LitigaForge AI — Advocates Act compliant._"
        )
        msg = await asyncio.to_thread(
            client.messages.create, body=full_message, from_=sender,
            to=f"whatsapp:{normalized}",
        )
        return {"success": True, "mode": "live", "sid": msg.sid, "status": msg.status}
    except ImportError:
        return {"success": False, "error": "twilio not installed — run: pip install twilio"}
    except Exception:
        log.exception("Twilio WhatsApp send failed")
        return {"success": False, "error": "Twilio WhatsApp request failed"}


async def send_hearing_reminder(case_number: str, court: str, date: str, party: str, to: Optional[str] = None) -> dict:
    message = (
        f"Case: *{case_number}*\nCourt: {court}\n"
        f"Hearing Date: *{date}*\nParty: {party}\n\nPrepare your arguments and documents."
    )
    return await send_whatsapp_alert(message, to=to, alert_type="hearing")


async def send_watch_trigger(watch_id: str, trigger_reason: str, details: str, to: Optional[str] = None) -> dict:
    message = f"Watch ID: *{watch_id}*\nTrigger: {trigger_reason}\n\n{details}"
    return await send_whatsapp_alert(message, to=to, alert_type="watch")
