"""
WhatsApp alert dispatch via Twilio WhatsApp Sandbox.
Sends case updates, watch-mode triggers, and hearing reminders to the advocate.
"""
import os
from typing import Optional

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
ADVOCATE_WHATSAPP = os.getenv("ADVOCATE_WHATSAPP", "")


def send_whatsapp_alert(message: str, to: Optional[str] = None, alert_type: str = "info") -> dict:
    recipient = to or ADVOCATE_WHATSAPP

    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        print(f"[WhatsApp MOCK] To {recipient}: {message[:100]}")
        return {
            "success": True,
            "mode": "mock",
            "recipient": recipient,
            "message_preview": message[:100],
            "note": "Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN for live alerts",
        }

    if not recipient:
        return {"success": False, "error": "No recipient — set ADVOCATE_WHATSAPP in .env"}

    try:
        from twilio.rest import Client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
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
        msg = client.messages.create(
            body=full_message,
            from_=TWILIO_WHATSAPP_FROM,
            to=f"whatsapp:{recipient}" if not recipient.startswith("whatsapp:") else recipient,
        )
        return {"success": True, "mode": "live", "sid": msg.sid, "status": msg.status}
    except ImportError:
        return {"success": False, "error": "twilio not installed — run: pip install twilio"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def send_hearing_reminder(case_number: str, court: str, date: str, party: str, to: Optional[str] = None) -> dict:
    message = (
        f"Case: *{case_number}*\nCourt: {court}\n"
        f"Hearing Date: *{date}*\nParty: {party}\n\nPrepare your arguments and documents."
    )
    return send_whatsapp_alert(message, to=to, alert_type="hearing")


def send_watch_trigger(watch_id: str, trigger_reason: str, details: str, to: Optional[str] = None) -> dict:
    message = f"Watch ID: *{watch_id}*\nTrigger: {trigger_reason}\n\n{details}"
    return send_whatsapp_alert(message, to=to, alert_type="watch")
