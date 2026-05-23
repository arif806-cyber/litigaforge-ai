"""
LitigaForge AI — Subscription Router
Razorpay subscription and plan management.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import require_user
from database import get_pool, SUBSCRIPTION_PLANS
from payments import create_order, verify_payment, PLAN_PRICES

logger = logging.getLogger("litigaforge.api")
router = APIRouter(tags=["subscription"])


class CreateOrderRequest(BaseModel):
    tier: str


class VerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    tier: str


@router.get("/subscription/plans")
async def subscription_plans():
    return SUBSCRIPTION_PLANS


@router.post("/subscription/create-order")
async def subscription_create_order(req: CreateOrderRequest, current_user: dict = Depends(require_user)):
    if req.tier not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="Invalid tier. Choose professional or advocate_pro")
    try:
        order = create_order(req.tier, current_user["id"])
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Payment service unavailable. Please try again later.")
    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": __import__("os").environ.get("RAZORPAY_KEY_ID", ""),
    }


@router.post("/subscription/verify")
async def subscription_verify(req: VerifyRequest, current_user: dict = Depends(require_user)):
    if req.tier not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="Invalid tier")
    ok = verify_payment(req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature)
    if not ok:
        raise HTTPException(status_code=400, detail="Payment verification failed")
    # Update user tier and record subscription
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE users SET subscription_tier=$1 WHERE id=$2",
                req.tier, current_user["id"],
            )
            await conn.execute(
                """INSERT INTO subscriptions (user_id, tier, started_at, status, payment_ref)
                   VALUES ($1, $2, NOW(), 'active', $3)""",
                current_user["id"], req.tier, req.razorpay_payment_id,
            )
    return {"success": True, "tier": req.tier, "payment_id": req.razorpay_payment_id}


@router.post("/subscription/upgrade")
async def subscription_upgrade_deprecated():
    raise HTTPException(status_code=410, detail="This endpoint is no longer available. Use /subscription/create-order and /subscription/verify.")
