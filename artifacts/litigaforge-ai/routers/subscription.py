"""
LitigaForge AI — Subscription Router
Razorpay subscription and plan management.
"""
import logging
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import require_user
from database import get_pool, SUBSCRIPTION_PLANS
from payments import (
    create_order,
    verify_payment,
    verify_webhook_signature,
    get_client,
    PLAN_PRICES,
)

logger = logging.getLogger("litigaforge.api")
router = APIRouter(tags=["subscription"])


class CreateOrderRequest(BaseModel):
    tier: str


class VerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    tier: str


async def _activate_subscription(
    user_id: int,
    tier: str,
    payment_id: str,
) -> None:
    """Idempotently activate a server-validated paid tier."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            existing = await conn.fetchval(
                "SELECT id FROM subscriptions WHERE payment_ref=$1",
                payment_id,
            )
            await conn.execute(
                "UPDATE users SET subscription_tier=$1 WHERE id=$2",
                tier,
                user_id,
            )
            if not existing:
                await conn.execute(
                    """INSERT INTO subscriptions
                       (user_id, tier, started_at, status, payment_ref)
                       VALUES ($1, $2, NOW(), 'active', $3)""",
                    user_id,
                    tier,
                    payment_id,
                )


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

    # Fetch Razorpay order and verify amount matches expected tier price
    expected_amount = PLAN_PRICES[req.tier]
    try:
        rz = get_client()
        order = rz.order.fetch(req.razorpay_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to fetch order from payment provider")
    actual_amount = order.get("amount")
    notes = order.get("notes") or {}
    if (
        actual_amount != expected_amount
        or order.get("currency") != "INR"
        or str(notes.get("user_id")) != str(current_user["id"])
        or notes.get("tier") != req.tier
    ):
        logger.warning(
            "Order validation failed: user=%s tier=%s expected=%s actual=%s",
            current_user["id"], req.tier, expected_amount, actual_amount,
        )
        raise HTTPException(status_code=400, detail="Payment order does not match the selected plan")

    # Verify signature
    ok = verify_payment(req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature)
    if not ok:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    await _activate_subscription(
        current_user["id"],
        req.tier,
        req.razorpay_payment_id,
    )
    return {"success": True, "tier": req.tier, "payment_id": req.razorpay_payment_id}


@router.post("/subscription/webhook")
async def subscription_webhook(request: Request):
    """Activate captured Razorpay payments from a signed server callback."""
    raw = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    if not verify_webhook_signature(raw, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc

    event = payload.get("event")
    entities = payload.get("payload") or {}
    order = ((entities.get("order") or {}).get("entity") or {})
    payment = ((entities.get("payment") or {}).get("entity") or {})
    if event not in {"order.paid", "payment.captured"}:
        return {"received": True, "activated": False}

    if not order and payment.get("order_id"):
        try:
            order = get_client().order.fetch(payment["order_id"])
        except Exception as exc:
            logger.warning("Webhook order fetch failed: %s", type(exc).__name__)
            raise HTTPException(status_code=400, detail="Could not validate webhook order") from exc

    notes = order.get("notes") or payment.get("notes") or {}
    tier = notes.get("tier")
    try:
        user_id = int(notes.get("user_id"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Webhook order has invalid ownership") from exc

    expected_amount = PLAN_PRICES.get(tier)
    paid_amount = payment.get("amount", order.get("amount"))
    currency = payment.get("currency", order.get("currency"))
    payment_id = payment.get("id")
    if (
        not expected_amount
        or paid_amount != expected_amount
        or currency != "INR"
        or not payment_id
    ):
        raise HTTPException(status_code=400, detail="Webhook payment does not match a valid plan")

    await _activate_subscription(user_id, tier, payment_id)
    return {"received": True, "activated": True}


@router.post("/subscription/upgrade")
async def subscription_upgrade_deprecated():
    raise HTTPException(status_code=410, detail="This endpoint is no longer available. Use /subscription/create-order and /subscription/verify.")


# ── Invoice generation ──────────────────────────────────────────────────────────────────

@router.get("/subscription/invoices")
async def subscription_invoices(current_user: dict = Depends(require_user)):
    """Return invoice history for the current user."""
    from database import fetch
    rows = await fetch(
        """SELECT id, user_id, tier, started_at, status, payment_ref
           FROM subscriptions WHERE user_id = $1 ORDER BY started_at DESC""",
        current_user["id"],
    )
    for r in rows:
        r["started_at"] = str(r["started_at"])
    return {"invoices": rows}


@router.get("/subscription/download-invoice/{subscription_id}")
async def download_invoice(subscription_id: int, current_user: dict = Depends(require_user)):
    """Download a single invoice as HTML."""
    from database import fetchrow
    row = await fetchrow(
        "SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2",
        subscription_id, current_user["id"],
    )
    if not row:
        raise HTTPException(404, "Invoice not found")

    tier_name = row["tier"].replace("_", " ").title()
    price_map = {"professional": "₹999", "advocate_pro": "₹2,499"}
    price = price_map.get(row["tier"], "₹0")
    invoice_date = str(row["started_at"]).split(".")[0]
    invoice_number = f"LF-{current_user['id']}-{row['id']}-{invoice_date[:10].replace('-', '')}"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice {invoice_number} | LitigaForge AI</title>
<style>
body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; background: #f8fafc; }}
.container {{ max-width: 800px; margin: 0 auto; background: #fff; padding: 48px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
.header {{ display: flex; justify-content: space-between; align-items: start; margin-bottom: 48px; }}
.logo {{ font-size: 24px; font-weight: 700; color: #1a2744; }}
.logo span {{ color: #f59e0b; }}
.invoice-title {{ font-size: 32px; font-weight: 700; color: #1a2744; margin: 0; }}
.meta {{ color: #64748b; font-size: 14px; margin-top: 8px; }}
.table {{ width: 100%; border-collapse: collapse; margin: 32px 0; }}
.table th {{ text-align: left; padding: 12px 16px; background: #f1f5f9; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }}
.table td {{ padding: 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }}
.table td:last-child {{ text-align: right; font-weight: 600; }}
.total-row {{ font-size: 18px; font-weight: 700; }}
.total-row td {{ border-top: 2px solid #1a2744; border-bottom: none; padding-top: 20px; }}
.footer {{ margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <div class="logo">⛮️ LitigaForge<span>AI</span></div>
      <div class="meta">6-3-888/8, Somajiguda, Hyderabad, TG 500082<br>GST: 36AABCU9603R1ZX (India)</div>
    </div>
    <div style="text-align:right;">
      <h1 class="invoice-title">Invoice</h1>
      <div class="meta">{invoice_number}</div>
      <div class="meta">Date: {invoice_date}</div>
    </div>
  </div>
  <div style="margin-bottom: 32px;">
    <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Billed to</div>
    <div style="font-weight: 600; font-size: 16px;">{current_user.get('name', 'Customer')}</div>
    <div style="color: #64748b; font-size: 14px;">{current_user.get('email', '')}</div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>Description</th>
        <th>Period</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{tier_name} Plan — LitigaForge AI Subscription</td>
        <td>Monthly</td>
        <td>{price}</td>
      </tr>
      <tr class="total-row">
        <td colspan="2" style="text-align:right;">Total</td>
        <td>{price}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <p>This is a computer-generated invoice. No signature required.</p>
    <p>For questions, contact support@litigaforge.com</p>
    <p style="margin-top: 8px; font-size: 10px; color: #94a3b8;">
      LitigaForge AI — Client-Lawyer Matching Platform | litigaforge.com
    </p>
  </div>
</div>
</body>
</html>"""

    from fastapi.responses import Response
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f'inline; filename="invoice-{invoice_number}.html"'},
    )


# ── Prorated downgrade ────────────────────────────────────────────────────────────────

@router.post("/subscription/downgrade")
async def subscription_downgrade(current_user: dict = Depends(require_user)):
    """Cancel the active paid plan and immediately downgrade to free."""
    from database import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Get current active subscription
            sub = await conn.fetchrow(
                "SELECT id, tier, started_at FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY started_at DESC LIMIT 1",
                current_user["id"],
            )
            # Update user to free
            await conn.execute(
                "UPDATE users SET subscription_tier = 'free', cases_this_month = 0 WHERE id = $1",
                current_user["id"],
            )
            # Mark subscription as cancelled
            if sub:
                await conn.execute(
                    "UPDATE subscriptions SET status = 'cancelled' WHERE id = $1",
                    sub["id"],
                )
    return {
        "message": "Paid plan cancelled and account downgraded to Free.",
        "tier": "free",
    }
