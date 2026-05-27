"""
LitigaForge AI — Email notification helper.
Uses stdlib smtplib (no extra packages needed).
If SMTP_HOST is not set, logs a mock instead of failing.

Required env vars for live sending:
  SMTP_HOST     — e.g. smtp.gmail.com
  SMTP_PORT     — 587 (STARTTLS) or 465 (SSL); defaults to 587
  SMTP_USER     — sender login
  SMTP_PASSWORD — sender password / app-password
  SMTP_FROM     — display From address; falls back to SMTP_USER
"""
import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger("litigaforge.email")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER

_VERIFIED_HTML = """\
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr>
          <td style="background:#1a2744;padding:28px 32px;">
            <p style="margin:0;color:#f0a500;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
              ⚖️ LitigaForge AI
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 12px;">
            <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">
              Your advocate account is verified ✅
            </p>
            <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6;">
              Dear <strong>{name}</strong>,
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
              Your LitigaForge advocate profile has been reviewed and verified by our team.
              You can now log in and start receiving client case leads.
            </p>
            <a href="https://litiga-forge-ai.replit.app/litigaforge/login"
               style="display:inline-block;background:#1a2744;color:#ffffff;text-decoration:none;
                      font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;
                      letter-spacing:0.2px;">
              Log in to your dashboard →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 28px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              This is an automated message from LitigaForge AI.
              If you have questions, reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

_REJECTED_HTML = """\
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr>
          <td style="background:#1a2744;padding:28px 32px;">
            <p style="margin:0;color:#f0a500;font-size:20px;font-weight:700;">⚖️ LitigaForge AI</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 12px;">
            <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">
              Account verification update
            </p>
            <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6;">
              Dear <strong>{name}</strong>,
            </p>
            <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6;">
              We were unable to verify your LitigaForge advocate profile at this time.
            </p>
            {reason_block}
            <p style="margin:16px 0 0;font-size:15px;color:#475569;line-height:1.6;">
              Please re-register with updated credentials or contact our support team.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 28px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              This is an automated message from LitigaForge AI.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def _send(to_email: str, subject: str, html: str, text: str) -> dict:
    if not SMTP_HOST:
        logger.info("[Email MOCK] To %s | %s | %s", to_email, subject, text[:80])
        return {"success": True, "mode": "mock",
                "note": "Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD for live email"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))

        ctx = ssl.create_default_context()
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as s:
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.sendmail(SMTP_FROM, to_email, msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
                s.ehlo()
                s.starttls(context=ctx)
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.sendmail(SMTP_FROM, to_email, msg.as_string())

        logger.info("[Email] Sent '%s' → %s", subject, to_email)
        return {"success": True, "mode": "live", "to": to_email}
    except Exception as e:
        logger.warning("[Email] Failed to send to %s: %s", to_email, e)
        return {"success": False, "error": str(e)}


def send_verification_email(to_email: str, name: str) -> dict:
    """Send the 'account verified' email to an advocate."""
    html = _VERIFIED_HTML.format(name=name)
    text = (
        f"Dear {name},\n\n"
        "Your LitigaForge advocate account has been verified!\n"
        "You can now log in and start receiving client case leads.\n\n"
        "Log in: https://litiga-forge-ai.replit.app/litigaforge/login\n\n"
        "— LitigaForge AI Team"
    )
    return _send(to_email, "LitigaForge: Your Advocate Account is Verified ✅", html, text)


def send_rejection_email(to_email: str, name: str, reason: str = "") -> dict:
    """Send the 'verification rejected' email to an advocate."""
    reason_block = (
        f'<p style="margin:12px 0;padding:12px 16px;background:#fef2f2;border-radius:8px;'
        f'font-size:14px;color:#991b1b;line-height:1.6;"><strong>Reason:</strong> {reason}</p>'
        if reason else ""
    )
    html = _REJECTED_HTML.format(name=name, reason_block=reason_block)
    text = (
        f"Dear {name},\n\n"
        "We were unable to verify your LitigaForge advocate profile at this time.\n"
        + (f"Reason: {reason}\n" if reason else "")
        + "\nPlease re-register with updated credentials or contact support.\n\n"
        "— LitigaForge AI Team"
    )
    return _send(to_email, "LitigaForge: Advocate Verification Update", html, text)
