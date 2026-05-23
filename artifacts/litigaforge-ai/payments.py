"""Razorpay payment integration for LitigaForge AI subscription upgrades."""
import os

import razorpay

client = razorpay.Client(auth=(
    os.environ.get("RAZORPAY_KEY_ID", ""),
    os.environ.get("RAZORPAY_KEY_SECRET", ""),
))

PLAN_PRICES = {
    "professional": 99900,   # Rs.999 in paise
    "advocate_pro": 249900,  # Rs.2499 in paise
}


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
