"""Razorpay payment integration for LitigaForge AI subscription upgrades and connection fees."""
import os
import hashlib
import hmac

import razorpay

GST_RATE_PERCENT = 18
BILLING_PERIOD_DAYS = {"monthly": 30, "annual": 365}
PLAN_BASE_PRICES = {
    "professional": {"monthly": 99900, "annual": 999900},
    "advocate_pro": {"monthly": 249900, "annual": 2499900},
}
# Backward-compatible monthly totals used by reporting and legacy callers.
PLAN_PRICES = {
    tier: base_prices["monthly"] * (100 + GST_RATE_PERCENT) // 100
    for tier, base_prices in PLAN_BASE_PRICES.items()
}

# ── Connection fee config ─────────────────────────────────────────────────────
# This is a flat client booking fee.  It must never depend on the client's
# budget or the advocate's quoted rate.
BOOKING_FEE_DEFAULT_RUPEES = 399
BOOKING_FEE_ENV = "MATCH_BOOKING_FEE_RUPEES"

DEMO_TOKEN = "DEMO_LF_PAYMENT_V1"


def demo_payments_enabled() -> bool:
    """Demo payments are opt-in and only possible without live Razorpay keys."""
    return (
        os.environ.get("DEMO_PAYMENTS", "").strip().lower() in {"1", "true", "yes"}
        and not _keys_present()
    )


def booking_fee_paise() -> int:
    """Return the configured flat client booking fee in paise."""
    raw = os.environ.get(BOOKING_FEE_ENV, str(BOOKING_FEE_DEFAULT_RUPEES))
    try:
        rupees = int(raw)
    except (TypeError, ValueError):
        rupees = BOOKING_FEE_DEFAULT_RUPEES
    if rupees < 0:
        raise RuntimeError(f"{BOOKING_FEE_ENV} must be a non-negative whole number")
    return rupees * 100


def get_client() -> razorpay.Client:
    """Return a Razorpay client using the current environment variables.
    Reading at call-time (not import-time) ensures secrets added after startup are picked up."""
    key_id     = os.environ.get("RAZORPAY_KEY_ID", "")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret:
        raise RuntimeError(
            "Razorpay keys are not configured. "
            "Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Replit Secrets."
        )
    return razorpay.Client(auth=(key_id, key_secret))


_get_client = get_client  # internal alias for backwards compatibility


def _keys_present() -> bool:
    return bool(os.environ.get("RAZORPAY_KEY_ID")) and bool(os.environ.get("RAZORPAY_KEY_SECRET"))


def calc_commission_paise(_budget_range: str = "", _budget_min_rupees: int = 0) -> int:
    """Backward-compatible name for the flat booking fee helper."""
    return booking_fee_paise()


def subscription_amount_paise(tier: str, billing_period: str = "monthly") -> int:
    """Return the exact GST-inclusive provider amount for a plan option."""
    base_amount = PLAN_BASE_PRICES.get(tier, {}).get(billing_period)
    if not base_amount:
        raise ValueError(f"Invalid plan option: {tier}/{billing_period}")
    return base_amount * (100 + GST_RATE_PERCENT) // 100


def create_order(tier: str, user_id: int, billing_period: str = "monthly") -> dict:
    amount = subscription_amount_paise(tier, billing_period)
    rz = _get_client()
    order = rz.order.create({
        "amount": amount,
        "currency": "INR",
        "receipt": f"lf_{user_id}_{tier}_{billing_period}",
        "notes": {
            "user_id": str(user_id),
            "tier": tier,
            "billing_period": billing_period,
        },
    })
    return order


def create_match_order(match_id: int, client_id: int, amount_paise: int) -> dict:
    """Create a Razorpay order for a lawyer connection fee.
    Falls back to demo mode if Razorpay keys are not configured."""
    if demo_payments_enabled():
        return {
            "demo_mode": True,
            "amount": amount_paise,
            "currency": "INR",
            "demo_token": DEMO_TOKEN,
            "notes": {"match_id": str(match_id), "client_id": str(client_id)},
        }
    if not _keys_present():
        raise RuntimeError("Live Razorpay keys are required for match payments")
    rz = _get_client()
    key_id = os.environ.get("RAZORPAY_KEY_ID", "")
    order = rz.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"lf_match_{match_id}_c{client_id}",
        "notes": {
            "match_id": str(match_id),
            "client_id": str(client_id),
            "purpose": "connection_fee",
        },
    })
    order["key"] = key_id
    order["demo_mode"] = False
    return order


def verify_payment(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> bool:
    try:
        rz = _get_client()
        rz.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
        return True
    except Exception:
        return False


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """Verify a Razorpay webhook against the dedicated webhook secret."""
    secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret or not signature:
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
