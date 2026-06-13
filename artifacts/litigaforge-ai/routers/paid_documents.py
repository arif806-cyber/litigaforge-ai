"""Paid Documents — U.S. demand-letter tool with a Merchant-of-Record paywall.

Revenue-ready vertical slice (guest flow, email only, no login):
  • GET  /template          → field spec + display price + payment availability
  • POST /generate          → run AI cascade, STORE full letter server-side,
                              return ONLY an unguessable doc_id + watermarked preview
  • POST /checkout          → create a Lemon Squeezy hosted checkout (or demo off-prod)
  • POST /webhook           → verify signature, idempotently mark order paid
  • GET  /status/{doc_id}   → poll payment status
  • GET  /document/{doc_id} → release full letter ONLY when status == 'paid' (else 402)
  • POST /demo-complete/..  → simulate payment; HARD-disabled in production

The doc_id is a capability token (secrets.token_urlsafe): only the person who
generated the letter holds it, and the full text is never returned until the
signed Lemon Squeezy webhook confirms payment.

NOTE: do NOT add `from __future__ import annotations` here. The slowapi
@limiter.limit wrapper lives in slowapi's module, so PEP 563 string annotations
would be resolved against slowapi's globals (where our Pydantic request models
don't exist), and FastAPI would mis-bind request bodies as query params.
"""
import json
import logging
import os
import re
import secrets
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, urlencode, urlsplit, urlunsplit, parse_qsl

import sys
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_brain import _call_claude, _call_openai, _call_gemini
from ai_safety import safe_ai_output
from database import execute, fetchrow
from rate_limit import limiter
import payments_mor

logger = logging.getLogger("litigaforge.paid_documents")

router = APIRouter(prefix="/documents/paid", tags=["Paid Documents"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Bound public, unauthenticated input so a single request can't ship a huge
# payload into the AI cascade (cost/abuse control + prompt-injection surface).
MAX_FIELD_LEN = 4000
MAX_TOTAL_LEN = 12000

US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
    "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
]

CLAIM_TYPES = [
    "Unpaid invoice / debt",
    "Breach of contract",
    "Unreturned security deposit",
    "Property damage",
    "Defective goods or services",
    "Unpaid personal loan",
    "Unpaid wages",
    "Other",
]

CONSEQUENCES = [
    "File a claim in small claims court",
    "File a civil lawsuit",
    "Refer the debt to collections / credit reporting",
    "Report to the appropriate state agency",
]

# Field spec — shared by the frontend form and server-side validation.
FIELDS: List[Dict[str, Any]] = [
    {"name": "sender_name", "label": "Your Full Name", "type": "text", "required": True,
     "placeholder": "Jane A. Smith"},
    {"name": "sender_address", "label": "Your Mailing Address", "type": "textarea", "required": True,
     "placeholder": "123 Main St, Apt 4\nAustin, TX 78701"},
    {"name": "sender_email", "label": "Your Email", "type": "text", "required": True,
     "placeholder": "jane@example.com", "help_text": "Used on the letter and to send your unlock link."},
    {"name": "sender_phone", "label": "Your Phone", "type": "text", "required": False,
     "placeholder": "(512) 555-0142"},
    {"name": "recipient_name", "label": "Recipient Name (person or company)", "type": "text", "required": True,
     "placeholder": "Acme Property Management LLC"},
    {"name": "recipient_address", "label": "Recipient Mailing Address", "type": "textarea", "required": True,
     "placeholder": "500 Commerce Blvd\nAustin, TX 78702"},
    {"name": "state", "label": "Governing U.S. State", "type": "select", "required": True,
     "options": US_STATES, "placeholder": "Texas"},
    {"name": "claim_type", "label": "Type of Claim", "type": "select", "required": True,
     "options": CLAIM_TYPES},
    {"name": "amount", "label": "Amount Demanded (USD)", "type": "number", "required": True,
     "placeholder": "2500"},
    {"name": "incident_date", "label": "Date of Incident / Breach", "type": "date", "required": True},
    {"name": "facts", "label": "What Happened", "type": "textarea", "required": True,
     "placeholder": "Describe the dispute: what was owed/agreed, what went wrong, and any dates or invoice numbers."},
    {"name": "prior_contact", "label": "Prior Attempts to Resolve", "type": "textarea", "required": False,
     "placeholder": "e.g. Called twice in May, emailed an invoice on June 1 — no response."},
    {"name": "deadline_days", "label": "Days to Comply", "type": "number", "required": True,
     "placeholder": "14"},
    {"name": "consequence", "label": "Consequence if Ignored", "type": "select", "required": False,
     "options": CONSEQUENCES},
]

SLUG = "us-demand-letter"
TITLE = "U.S. Demand Letter"
DESCRIPTION = (
    "A firm, professional pre-litigation demand letter tailored to your U.S. state — "
    "demand payment for unpaid debts, broken contracts, deposits, or damages before you go to court."
)


def _is_prod() -> bool:
    """Fail-closed production detection: ANY production signal counts. This way
    an unset ENVIRONMENT in a real deployment can never accidentally enable the
    no-payment demo unlock path."""
    if (os.getenv("REPLIT_DEPLOYMENT") or "").strip():
        return True
    if (os.getenv("NODE_ENV") or "").strip().lower() == "production":
        return True
    return (os.getenv("ENVIRONMENT") or "development").strip().lower() in ("production", "prod")


def _demo_available() -> bool:
    """Demo (no-payment) unlock is allowed only off-production when no MoR keys are set."""
    return (not payments_mor.is_configured()) and (not _is_prod())


def _allowed_return_host(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    if not host:
        return False
    if host in ("localhost", "127.0.0.1"):
        return True
    if host.endswith("litigaforge.com"):
        return True
    domains = (os.getenv("REPLIT_DOMAINS") or "")
    for d in domains.split(","):
        d = d.strip().lower()
        if d and (host == d or host.endswith("." + d) or host == d):
            return True
    if host.endswith(".replit.app") or host.endswith(".replit.dev") or host.endswith(".repl.co"):
        return True
    return False


def _with_params(url: str, params: Dict[str, str]) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.update(params)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _make_preview(full_text: str) -> str:
    lines = full_text.splitlines()
    n = len(lines)
    keep = max(6, min(18, int(n * 0.35)))
    head = "\n".join(lines[:keep]).rstrip()
    lock = (
        "\n\n— — — — — — — — — — — — — — — — — — — — — —\n"
        "[ Free preview — the rest of your letter is locked ]\n"
        "Unlock the complete, ready-to-send demand letter to reveal the full body, "
        "the exact payment demand and deadline, the legal basis, the reservation of "
        "rights, and your signature block."
    )
    return head + lock


def _build_prompt(f: Dict[str, Any]) -> str:
    return f"""Draft a formal, professional U.S. DEMAND LETTER (pre-litigation) governed by the laws of the State of {f.get('state','')}, United States.

FROM (Sender / Claimant):
  Name: {f.get('sender_name','')}
  Address: {f.get('sender_address','')}
  Email: {f.get('sender_email','')}
  Phone: {f.get('sender_phone','') or 'N/A'}

TO (Recipient):
  Name: {f.get('recipient_name','')}
  Address: {f.get('recipient_address','')}

DISPUTE:
  Type of claim: {f.get('claim_type','')}
  Amount demanded: USD {f.get('amount','')}
  Date of incident / breach: {f.get('incident_date','')}
  What happened: {f.get('facts','')}
  Prior attempts to resolve: {f.get('prior_contact','') or 'None stated'}
  Deadline to comply: {f.get('deadline_days','14')} calendar days from the date of this letter
  Stated consequence of non-compliance: {f.get('consequence','') or 'Filing a claim in the appropriate court'}

REQUIREMENTS:
1. Use today's date and a proper U.S. business-letter format (sender block, date, recipient block, a clear "RE:" subject line).
2. Open by identifying the parties and the nature of the dispute.
3. State the facts in a clear, chronological, factual paragraph.
4. Demand the exact amount (USD {f.get('amount','')}) and explain the legal basis in plain terms (e.g., breach of contract, unjust enrichment, applicable {f.get('state','')} law). Keep any legal references accurate and general — do NOT invent specific statute or case numbers.
5. Give a firm deadline of {f.get('deadline_days','14')} calendar days and state the specific consequence of non-payment.
6. Reserve all legal rights and remedies.
7. Keep a firm, professional, non-threatening tone. Make no illegal threats or harassment, and if this reads as debt collection, stay consistent with the federal FDCPA.
8. End with a signature block for {f.get('sender_name','')}.

Output the COMPLETE letter as plain text only. No markdown, no commentary, and no bracketed placeholders — use the details provided above."""


SYSTEM_MSG = (
    "You are an experienced U.S. legal document drafter. You produce complete, "
    "professional, legally sound pre-litigation demand letters that comply with U.S. "
    "law and the FDCPA. Output plain text only — no markdown, no bracketed "
    "placeholders, and no commentary."
)


def _generate_letter(prompt: str) -> str:
    text: Optional[str] = None
    for fn, kwargs in (
        (_call_claude, {"max_tokens": 4000}),
        (_call_openai, {"max_tokens": 4000}),
        (_call_gemini, {"max_tokens": 4096}),
    ):
        try:
            text = fn(system=SYSTEM_MSG, user=prompt, temperature=0.3, **kwargs)
        except Exception:
            text = None
        if text:
            return safe_ai_output(text)
    return ""


# ── Models ────────────────────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    fields: Dict[str, Any]
    email: str = ""


class CheckoutRequest(BaseModel):
    doc_id: str
    email: str = ""
    return_url: str = ""


# ── Endpoints ───────────────────────────────────────────────────────────────--
@router.get("/template")
async def get_template() -> Dict[str, Any]:
    return {
        "slug": SLUG,
        "title": TITLE,
        "description": DESCRIPTION,
        "country": "US",
        "fields": FIELDS,
        "price_usd": payments_mor.price_usd(),
        "currency": "USD",
        "configured": payments_mor.is_configured(),
        "demo_available": _demo_available(),
    }


@router.post("/generate")
@limiter.limit("10/minute")
async def generate(req: GenerateRequest, request: Request) -> Dict[str, Any]:
    f = req.fields or {}

    # Bound input size before we touch the AI cascade.
    oversized = [
        fld["label"] for fld in FIELDS
        if len(str(f.get(fld["name"], ""))) > MAX_FIELD_LEN
    ]
    if oversized:
        raise HTTPException(
            status_code=422,
            detail=f"Too long: {', '.join(oversized)} (max {MAX_FIELD_LEN} characters each).",
        )
    if sum(len(str(v)) for v in f.values()) > MAX_TOTAL_LEN:
        raise HTTPException(status_code=422, detail="Your input is too long. Please shorten the details.")

    # Validate required fields
    missing = [
        fld["label"] for fld in FIELDS
        if fld["required"] and not str(f.get(fld["name"], "")).strip()
    ]
    if missing:
        raise HTTPException(status_code=422, detail=f"Please fill: {', '.join(missing)}")

    email = (req.email or f.get("sender_email", "") or "").strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="A valid email is required.")
    if not EMAIL_RE.match(str(f.get("sender_email", "")).strip()):
        raise HTTPException(status_code=422, detail="A valid sender email is required.")

    full_text = _generate_letter(_build_prompt(f))
    if not full_text or len(full_text.split()) < 60:
        raise HTTPException(
            status_code=503,
            detail="The drafting service is busy right now. Please try again in a moment.",
        )

    preview = _make_preview(full_text)
    doc_id = secrets.token_urlsafe(24)

    await execute(
        """
        INSERT INTO paid_documents
            (id, slug, country, email, fields, full_text, preview_text, status, currency)
        VALUES ($1, $2, 'US', $3, $4::jsonb, $5, $6, 'pending', 'USD')
        """,
        doc_id, SLUG, email, json.dumps(f), full_text, preview,
    )

    return {
        "doc_id": doc_id,
        "title": TITLE,
        "preview_text": preview,
        "word_count": len(full_text.split()),
        "price_usd": payments_mor.price_usd(),
        "currency": "USD",
        "configured": payments_mor.is_configured(),
        "demo_available": _demo_available(),
    }


@router.post("/checkout")
@limiter.limit("20/minute")
async def checkout(req: CheckoutRequest, request: Request) -> Dict[str, Any]:
    row = await fetchrow("SELECT id, email, status FROM paid_documents WHERE id = $1", req.doc_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")
    if row["status"] == "paid":
        return {"status": "paid"}

    email = (req.email or row["email"] or "").strip()

    if payments_mor.is_configured():
        return_url = req.return_url if _allowed_return_host(req.return_url) else ""
        if return_url:
            return_url = _with_params(return_url, {"doc": req.doc_id, "paid": "1"})
        url = await payments_mor.create_checkout(
            doc_id=req.doc_id, email=email, redirect_url=return_url or "",
        )
        if not url:
            raise HTTPException(status_code=502, detail="Could not start checkout. Please try again.")
        return {"checkout_url": url}

    if _demo_available():
        return {"demo": True}

    raise HTTPException(status_code=503, detail="Payments are not configured yet.")


@router.post("/webhook")
async def webhook(request: Request) -> Dict[str, Any]:
    raw = await request.body()
    signature = request.headers.get("X-Signature", "")
    if not payments_mor.verify_webhook(raw, signature):
        raise HTTPException(status_code=400, detail="Invalid signature.")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload.")

    evt = payments_mor.parse_order_event(payload)
    header_event = (request.headers.get("X-Event-Name") or "").strip().lower()
    event_name = evt["event_name"] or header_event

    # Only trust one-time order events (paid or refunded).
    if event_name not in ("order_created", "order_refunded") and event_name:
        return {"ok": True, "ignored": event_name}

    # Defense in depth: EVERY state-changing path must be for OUR store/variant.
    # When configured, the event must match exactly; a missing value in the
    # event is rejected, never trusted. Checked before any DB mutation so refund
    # events are held to the same bar as paid events.
    if payments_mor.store_id() and evt["store_id"] != payments_mor.store_id():
        logger.warning("Webhook store mismatch/missing — ignoring.")
        return {"ok": True, "store_mismatch": True}
    if payments_mor.variant_id() and evt["variant_id"] != payments_mor.variant_id():
        logger.warning("Webhook variant mismatch/missing — ignoring.")
        return {"ok": True, "variant_mismatch": True}

    if event_name == "order_refunded":
        # Best-effort: mark refunded so a refunded doc re-locks.
        if evt["doc_id"]:
            await execute(
                "UPDATE paid_documents SET status = 'refunded', updated_at = NOW() WHERE id = $1 AND status = 'paid'",
                evt["doc_id"],
            )
        return {"ok": True}

    if evt["status"] != "paid":
        return {"ok": True, "ignored_status": evt["status"]}
    if not evt["doc_id"]:
        return {"ok": True, "no_doc_id": True}

    # Idempotent: only the first paid event flips the row.
    await execute(
        """
        UPDATE paid_documents
           SET status = 'paid',
               mor_provider = 'lemonsqueezy',
               mor_order_id = $2,
               mor_variant_id = $3,
               mor_store_id = $4,
               paid_amount_cents = $5,
               currency = COALESCE($6, currency),
               webhook_event_id = $7,
               paid_at = NOW(),
               updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('paid', 'refunded')
        """,
        evt["doc_id"], evt["order_id"], evt["variant_id"], evt["store_id"],
        evt["total_cents"], evt["currency"], evt["order_id"],
    )
    return {"ok": True}


@router.get("/status/{doc_id}")
async def status(doc_id: str) -> Dict[str, Any]:
    row = await fetchrow("SELECT status FROM paid_documents WHERE id = $1", doc_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"status": row["status"]}


@router.get("/document/{doc_id}")
async def document(doc_id: str, response: Response) -> Dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    row = await fetchrow("SELECT status, full_text FROM paid_documents WHERE id = $1", doc_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")
    if row["status"] != "paid":
        raise HTTPException(status_code=402, detail="Payment required.")
    return {"doc_id": doc_id, "title": TITLE, "document_text": row["full_text"], "status": "paid"}


@router.post("/demo-complete/{doc_id}")
async def demo_complete(doc_id: str) -> Dict[str, Any]:
    if not _demo_available():
        raise HTTPException(status_code=403, detail="Demo completion is disabled.")
    row = await fetchrow("SELECT id, status FROM paid_documents WHERE id = $1", doc_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")
    await execute(
        """
        UPDATE paid_documents
           SET status = 'paid', mor_provider = 'demo', paid_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('paid', 'refunded')
        """,
        doc_id,
    )
    return {"status": "paid"}
