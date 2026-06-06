"""Razorpay payment integration for LitigaForge AI subscription upgrades and connection fees."""
import os
import re as _re

import razorpay

_RAZORPAY_KEY_ID     = os.environ.get("RAZORPAY_KEY_ID", "")
_RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")

client = razorpay.Client(auth=(_RAZORPAY_KEY_ID, _RAZORPAY_KEY_SECRET))

PLAN_PRICES = {
    "professional": 99900,   # ₹999 in paise
    "advocate_pro": 249900,  # ₹2,499 in paise
}

# ── Connection fee config ─────────────────────────────────────────────────────
COMMISSION_RATE   = 0.08   # 8% of stated budget
COMMISSION_MIN    = 49900  # ₹499 minimum
COMMISSION_MAX    = 499900 # ₹4,999 maximum
COMMISSION_DEFAULT= 99900  # ₹999 when budget is unspecified

DEMO_TOKEN = "DEMO_LF_PAYMENT_V1"  # used in sandbox / no-key mode


def calc_commission_paise(budget_range: str, budget_min_rupees: int = 0) -> int:
    """Return platform connection fee in paise.
    Prefers numeric budget_min_rupees; falls back to parsing budget_range text."""
    if budget_min_rupees and budget_min_rupees > 0:
        commission_paise = int(budget_min_rupees * COMMISSION_RATE) * 100
        return max(COMMISSION_MIN, min(COMMISSION_MAX, commission_paise))
    # Legacy text parse
    nums = _re.findall(r"\d+", budget_range or "")
    bmin = int(nums[0]) if nums else 0
    if bmin == 0:
        return COMMISSION_DEFAULT
    if bmin < 1000:           # guard against very small text numbers
        bmin = bmin * 100
    commission_paise = int(bmin * COMMISSION_RATE) * 100
    return max(COMMISSION_MIN, min(COMMISSION_MAX, commission_paise))


def create_order(tier: str, user_id: int) -> dict:
    amount = PLAN_PRICES.get(tier)
    if not amount:
        raise ValueError(f"Invalid tier: {tier}")
    order = client.order.create({
        "amount": amount,
        "currency": "INR",
        "receipt": f"lf_{user_id}_{tier}",
        "notes": {"user_id": str(user_id), "tier": tier},
    })
    return order


def create_match_order(match_id: int, client_id: int, amount_paise: int) -> dict:
    """Create a Razorpay order for a lawyer connection fee.
    Falls back to demo mode if Razorpay keys are not configured."""
    if not _RAZORPAY_KEY_ID or not _RAZORPAY_KEY_SECRET:
        return {
            "demo_mode": True,
            "amount": amount_paise,
            "currency": "INR",
            "demo_token": DEMO_TOKEN,
        }
    order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"lf_match_{match_id}_c{client_id}",
        "notes": {
            "match_id": str(match_id),
            "client_id": str(client_id),
            "purpose": "connection_fee",
        },
    })
    order["key"] = _RAZORPAY_KEY_ID
    order["demo_mode"] = False
    return order


def verify_payment(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> bool:
    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
        return True
    except Exception:
        return False
