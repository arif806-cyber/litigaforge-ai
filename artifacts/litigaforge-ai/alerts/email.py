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
import html as _html
import logging
import os
import smtplib
import ssl
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import urlsplit

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
        # UTF-8 throughout so emoji subjects (e.g. "⚖️ Top 5 Judgments Today")
        # and non-ASCII summaries (… ellipsis, accented case names) send cleanly.
        msg["Subject"] = Header(subject, "utf-8")
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        ctx = ssl.create_default_context()
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as s:
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
                s.ehlo()
                s.starttls(context=ctx)
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.send_message(msg)

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


def smtp_configured() -> bool:
    """True only when SMTP is fully configured for LIVE sending (host + user +
    password). The daily digest uses this to report an unconfigured mailer
    loudly instead of silently mock-delivering to every subscriber."""
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def _safe_url(raw: str) -> str:
    """Allow only absolute http(s) URLs or root-relative paths into href
    attributes; anything else (javascript:, data:, malformed) collapses to '#'.
    Result is HTML-attribute escaped. Judgment URLs are derived from
    external/AI-sourced data, so they are treated as untrusted."""
    raw = (raw or "").strip()
    if raw.startswith("/"):
        return _html.escape(raw, quote=True)
    parts = urlsplit(raw)
    if parts.scheme in ("http", "https") and parts.netloc:
        return _html.escape(raw, quote=True)
    return "#"


def send_digest_email(to_email: str, name: str, items: list, date_label: str,
                      unsubscribe_url: str) -> dict:
    """Send the 'Top 5 Judgments Today' daily digest to one subscriber.

    items: list of dicts with keys case_name, court, summary, url.

    Judgment fields (case_name/court/summary/url) and the subscriber name are
    treated as untrusted: every value interpolated into the HTML body is
    HTML-escaped (and URLs are scheme-validated) to prevent HTML/markup
    injection in the email broadcast.
    """
    greeting_raw = (name or "").strip() or "there"
    greeting = _html.escape(greeting_raw, quote=True)
    date_label_e = _html.escape((date_label or "").strip(), quote=True)
    unsub_safe = _safe_url(unsubscribe_url)

    rows_html = []
    rows_text = []
    for i, it in enumerate(items, 1):
        case_name = (it.get("case_name") or "Judgment").strip()
        court = (it.get("court") or "").strip()
        summary = (it.get("summary") or "").strip()
        url = it.get("url") or "#"
        case_name_e = _html.escape(case_name, quote=True)
        court_e = _html.escape(court, quote=True)
        summary_e = _html.escape(summary, quote=True)
        url_safe = _safe_url(url)
        court_html = (
            f'<p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#b45309;'
            f'text-transform:uppercase;letter-spacing:0.4px;">{court_e}</p>'
            if court else ""
        )
        rows_html.append(
            f'<table width="100%" cellpadding="0" cellspacing="0" '
            f'style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 16px;">'
            f'<tr><td style="padding:18px 20px;">'
            f'<p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0f172a;line-height:1.4;">'
            f'{i}. {case_name_e}</p>'
            f'{court_html}'
            f'<p style="margin:0 0 14px;font-size:14px;color:#475569;line-height:1.6;">{summary_e}</p>'
            f'<a href="{url_safe}" style="display:inline-block;background:#1a2744;color:#ffffff;'
            f'text-decoration:none;font-size:13px;font-weight:600;padding:9px 18px;border-radius:7px;">'
            f'Read Full Analysis &rarr;</a>'
            f'</td></tr></table>'
        )
        rows_text.append(
            f"{i}. {case_name}" + (f" ({court})" if court else "")
            + f"\n   {summary}\n   Read: {url}\n"
        )

    items_html = "\n".join(rows_html)
    subject = f"⚖️ Top 5 Judgments Today — {date_label}"

    body_html = f"""\
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#1a2744;padding:24px 28px;border-radius:12px 12px 0 0;">
          <p style="margin:0;color:#f0a500;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
            ⚖️ LitigaForge AI</p>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">
            Top 5 Judgments Today &middot; {date_label_e}</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:24px 28px 8px;">
          <p style="margin:0 0 18px;font-size:15px;color:#475569;line-height:1.6;">
            Hi {greeting}, here are today's most important new Supreme Court &amp; High Court judgments.
          </p>
          {items_html}
        </td></tr>
        <tr><td style="background:#ffffff;padding:8px 28px 24px;border-radius:0 0 12px 12px;
                       border-top:1px solid #f1f5f9;">
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
            You're receiving this because you subscribed to the LitigaForge daily judgment digest.
            <a href="{unsub_safe}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>.
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;line-height:1.6;">
            LitigaForge AI provides legal information, not legal advice.
            Always verify with a qualified advocate.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    text = (
        f"{subject}\n\n"
        f"Hi {greeting_raw},\n\n"
        "Today's most important new Supreme Court & High Court judgments:\n\n"
        + "\n".join(rows_text)
        + f"\nUnsubscribe: {unsubscribe_url}\n\n"
        "LitigaForge AI provides legal information, not legal advice.\n"
        "— LitigaForge AI"
    )
    return _send(to_email, subject, body_html, text)


def send_confirmation_email(to_email: str, name: str, confirm_link: str) -> dict:
    """Send the double opt-in confirmation email for the daily judgment digest.

    confirm_link is generated by us (digest.confirm_url) but is still passed
    through _safe_url for defense in depth; the subscriber name is HTML-escaped.
    """
    greeting_raw = (name or "").strip() or "there"
    greeting = _html.escape(greeting_raw, quote=True)
    link_safe = _safe_url(confirm_link)
    subject = "Confirm your LitigaForge daily digest subscription"

    body_html = f"""\
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:#1a2744;padding:28px 32px;">
          <p style="margin:0;color:#f0a500;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
            ⚖️ LitigaForge AI</p>
        </td></tr>
        <tr><td style="padding:32px 32px 12px;">
          <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">
            Confirm your subscription</p>
          <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6;">
            Hi {greeting}, thanks for subscribing to the LitigaForge <strong>Daily Judgment
            Digest</strong> — the 5 most important new Supreme Court &amp; High Court judgments,
            every morning at 7 AM IST.</p>
          <p style="margin:0 0 22px;font-size:15px;color:#475569;line-height:1.6;">
            Please confirm your email address to start receiving it:</p>
          <a href="{link_safe}"
             style="display:inline-block;background:#1a2744;color:#ffffff;text-decoration:none;
                    font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">
            Confirm my subscription &rarr;</a>
          <p style="margin:22px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
            If you didn't request this, you can safely ignore this email — you won't be subscribed.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
            LitigaForge AI provides legal information, not legal advice.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    text = (
        f"Hi {greeting_raw},\n\n"
        "Thanks for subscribing to the LitigaForge Daily Judgment Digest.\n"
        "Please confirm your subscription by opening this link:\n\n"
        f"{confirm_link}\n\n"
        "If you didn't request this, you can ignore this email — you won't be subscribed.\n\n"
        "— LitigaForge AI"
    )
    return _send(to_email, subject, body_html, text)
