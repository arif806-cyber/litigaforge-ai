"""Merchant-of-Record payments (Lemon Squeezy) for paid documents.

Lemon Squeezy is the Merchant of Record, so it handles US sales tax, fraud, and
global card processing with no Stripe account needed (Stripe India is
invite-only). This module is intentionally small and self-contained:

  is_configured()             -> bool : are all required secrets present?
  create_checkout(...)               : create a hosted checkout, return its URL
  verify_webhook(raw, sig)    -> bool : constant-time HMAC-SHA256 verification
  parse_order_event(payload)         : pull the fields we trust from a webhook

Secret VALUES are never logged.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger("litigaforge.payments_mor")

LEMONSQUEEZY_CHECKOUTS_URL = "https://api.lemonsqueezy.com/v1/checkouts"
_JSONAPI = "application/vnd.api+json"


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip()


def api_key() -> str:
    return _env("LEMONSQUEEZY_API_KEY")


def store_id() -> str:
    return _env("LEMONSQUEEZY_STORE_ID")


def variant_id() -> str:
    return _env("LEMONSQUEEZY_VARIANT_ID")


def webhook_secret() -> str:
    return _env("LEMONSQUEEZY_WEBHOOK_SECRET")


def price_usd() -> str:
    """Display price only. The real charge is the LS variant's configured price;
    keep DEMAND_LETTER_PRICE_USD in sync with the variant so the UI matches."""
    return _env("DEMAND_LETTER_PRICE_USD") or "29"


def is_configured() -> bool:
    """True only when every secret required to take a real payment is present."""
    return bool(api_key() and store_id() and variant_id() and webhook_secret())


async def create_checkout(
    *,
    doc_id: str,
    email: str,
    redirect_url: str,
    product_name: str = "U.S. Demand Letter",
) -> Optional[str]:
    """Create a Lemon Squeezy hosted checkout. Returns the checkout URL or None.

    doc_id is passed as custom data so the signed webhook can correlate the paid
    order back to the stored document.
    """
    if not is_configured():
        return None

    attributes: Dict[str, Any] = {
        "checkout_data": {
            "email": email or "",
            "custom": {"doc_id": doc_id},
        },
        "product_options": {
            "name": product_name,
            "redirect_url": redirect_url,
        },
        "checkout_options": {"embed": False},
    }
    payload = {
        "data": {
            "type": "checkouts",
            "attributes": attributes,
            "relationships": {
                "store": {"data": {"type": "stores", "id": store_id()}},
                "variant": {"data": {"type": "variants", "id": variant_id()}},
            },
        }
    }
    headers = {
        "Authorization": f"Bearer {api_key()}",
        "Accept": _JSONAPI,
        "Content-Type": _JSONAPI,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                LEMONSQUEEZY_CHECKOUTS_URL, headers=headers, content=json.dumps(payload)
            )
        if resp.status_code >= 400:
            logger.error("Lemon Squeezy checkout failed: HTTP %s", resp.status_code)
            return None
        data = resp.json()
        url = ((data.get("data") or {}).get("attributes") or {}).get("url")
        return url or None
    except Exception as exc:  # network / parsing — never leak secrets
        logger.error("Lemon Squeezy checkout error: %s", type(exc).__name__)
        return None


def verify_webhook(raw_body: bytes, signature: str) -> bool:
    """Constant-time HMAC-SHA256 verification of a Lemon Squeezy webhook body."""
    secret = webhook_secret()
    if not secret or not signature:
        return False
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    try:
        return hmac.compare_digest(digest, signature.strip())
    except Exception:
        return False


def parse_order_event(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Extract only the trusted fields from an order_* webhook payload."""
    meta = payload.get("meta") or {}
    custom = meta.get("custom_data") or {}
    data = payload.get("data") or {}
    attrs = data.get("attributes") or {}
    first_item = attrs.get("first_order_item") or {}
    return {
        "event_name": str(meta.get("event_name") or "").strip().lower(),
        "doc_id": str(custom.get("doc_id") or "").strip(),
        "order_id": str(data.get("id") or attrs.get("identifier") or "").strip(),
        "variant_id": str(first_item.get("variant_id") or "").strip(),
        "store_id": str(attrs.get("store_id") or "").strip(),
        "status": str(attrs.get("status") or "").strip().lower(),
        "total_cents": attrs.get("total"),
        "currency": str(attrs.get("currency") or "USD").strip(),
    }
