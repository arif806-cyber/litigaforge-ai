"""
LitigaForge AI — Subscription Router
Razorpay subscription and plan management.
"""
import logging
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import require_non_demo_user
from database import get_pool, SUBSCRIPTION_PLANS
from plan_prices import ADVOCATE_PLAN_PRICES
from payments import (
    create_order,
    verify_payment,
    verify_webhook_signature,
    get_client,
    PLAN_PRICES,
    PLAN_BASE_PRICES,
    BILLING_PERIOD_DAYS,
    subscription_amount_paise,
)

logger = logging.getLogger("litigaforge.api")
router = APIRouter(tags=["subscription"])


class CreateOrderRequest(BaseModel):
    tier: str
    billing_period: str = "monthly"


class VerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    tier: str
    billing_period: str = "monthly"


def _validate_provider_payment(order_id: str, payment_id: str, expected_amount: int):
    """Fetch both provider objects and validate a paid payment belongs to order."""
    provider = get_client()
    order = provider.order.fetch(order_id)
    payment = provider.payment.fetch(payment_id)
    if (
        payment.get("order_id") != order_id
        or payment.get("status") != "captured"
        or order.get("amount") != expected_amount
        or payment.get("amount") != expected_amount
        or order.get("currency") != "INR"
        or payment.get("currency") != "INR"
    ):
        raise ValueError("Payment does not match a captured INR order")
    return order, payment


async def _activate_subscription(
    user_id: int,
    tier: str,
    payment_id: str,
    billing_period: str = "monthly",
) -> None:
    """Idempotently activate a server-validated paid tier."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            if tier not in PLAN_BASE_PRICES or billing_period not in BILLING_PERIOD_DAYS:
                raise ValueError("Invalid subscription plan option")
            await conn.fetchrow("SELECT id FROM users WHERE id=$1 FOR UPDATE", user_id)
            existing = await conn.fetchrow(
                """SELECT id, user_id, tier, expires_at, status, billing_period
                   FROM subscriptions WHERE payment_ref=$1 FOR UPDATE""",
                payment_id,
            )
            if existing:
                if existing["user_id"] != user_id:
                    raise ValueError("Payment is already assigned to another account")
                if (
                    existing["status"] != "active"
                    or not existing["expires_at"]
                ):
                    raise ValueError("This payment reference belongs to an expired subscription")
                # asyncpg returns a datetime for TIMESTAMP columns.
                from datetime import datetime, timezone
                expires_at = existing["expires_at"]
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at <= datetime.now(timezone.utc):
                    raise ValueError("This payment reference belongs to an expired subscription")
                await conn.execute(
                    "UPDATE users SET subscription_tier=$1 WHERE id=$2",
                    existing["tier"], user_id,
                )
                return
            current = await conn.fetchrow(
                """SELECT id, expires_at FROM subscriptions
                   WHERE user_id=$1 AND status='active' AND expires_at > NOW()
                   ORDER BY expires_at DESC LIMIT 1 FOR UPDATE""",
                user_id,
            )
            # Keep one active row, but carry all remaining paid time forward.
            await conn.execute(
                """UPDATE subscriptions SET status='superseded'
                   WHERE user_id=$1 AND status='active'""",
                user_id,
            )
            await conn.execute(
                "UPDATE users SET subscription_tier=$1 WHERE id=$2",
                tier,
                user_id,
            )
            if not existing:
                duration_days = BILLING_PERIOD_DAYS[billing_period]
                await conn.execute(
                    """INSERT INTO subscriptions
                       (user_id, tier, started_at, expires_at, status, payment_ref,
                        billing_period, is_trial)
                       VALUES (
                         $1, $2, NOW(),
                         GREATEST(NOW(), COALESCE($5, NOW()))
                           + ($4 * INTERVAL '1 day'),
                         'active', $3, $6, FALSE
                       )""",
                    user_id,
                    tier,
                    payment_id,
                    duration_days,
                    current["expires_at"] if current else None,
                    billing_period,
                )


async def _start_advocate_pro_trial(user_id: int) -> None:
    """Atomically grant one payment-free 30-day Advocate Pro trial per user."""
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.fetchrow("SELECT id FROM users WHERE id=$1 FOR UPDATE", user_id)
                prior_trial = await conn.fetchrow(
                    "SELECT id FROM subscriptions WHERE user_id=$1 AND is_trial=TRUE",
                    user_id,
                )
                if prior_trial:
                    raise ValueError("Your Advocate Pro free trial has already been used")
                active = await conn.fetchrow(
                    """SELECT id FROM subscriptions
                       WHERE user_id=$1 AND status='active' AND expires_at > NOW()""",
                    user_id,
                )
                if active:
                    raise ValueError("An active subscription already exists")
                await conn.execute(
                    """INSERT INTO subscriptions
                       (user_id, tier, started_at, expires_at, status, payment_ref,
                        billing_period, is_trial)
                        VALUES ($1, 'advocate_pro', NOW(),
                               NOW() + INTERVAL '30 days', 'active', NULL,
                               'monthly', TRUE)""",
                    user_id,
                )
                await conn.execute(
                    "UPDATE users SET subscription_tier='advocate_pro' WHERE id=$1",
                    user_id,
                )
    except ValueError:
        raise
    except Exception as exc:
        if "uq_subscriptions_user_trial" in str(exc) or "unique" in str(exc).lower():
            raise ValueError("Your Advocate Pro free trial has already been used") from exc
        raise


async def expire_subscriptions() -> int:
    """Downgrade all subscriptions whose 30-day term has elapsed."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            rows = await conn.fetch(
                """UPDATE subscriptions s SET status = 'expired'
                   WHERE s.status = 'active' AND s.expires_at IS NOT NULL
                     AND s.expires_at <= NOW()
                     AND NOT EXISTS (
                       SELECT 1 FROM subscriptions newer
                       WHERE newer.user_id=s.user_id AND newer.status='active'
                         AND newer.expires_at > NOW()
                     )
                   RETURNING user_id"""
            )
            if rows:
                await conn.execute(
                    """UPDATE users SET subscription_tier = 'free', cases_this_month = 0
                       WHERE id = ANY($1::int[])
                         AND NOT EXISTS (
                           SELECT 1 FROM subscriptions s
                           WHERE s.user_id=users.id AND s.status='active'
                             AND s.expires_at > NOW()
                         )""",
                    [r["user_id"] for r in rows],
                )
            return len(rows)


async def expire_subscription_for_user(user_id: int) -> bool:
    """Expire only one user's elapsed subscription during an interactive request."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            expired = await conn.fetchrow(
                """UPDATE subscriptions SET status = 'expired'
                   WHERE user_id = $1 AND status = 'active'
                     AND expires_at IS NOT NULL AND expires_at <= NOW()
                   RETURNING id""",
                user_id,
            )
            if not expired:
                return False
            await conn.execute(
                """UPDATE users SET subscription_tier = 'free', cases_this_month = 0
                   WHERE id = $1
                     AND NOT EXISTS (
                       SELECT 1 FROM subscriptions
                       WHERE user_id = $1 AND status = 'active'
                         AND expires_at > NOW()
                     )""",
                user_id,
            )
            return True


async def reconcile_active_subscriptions(user_id: int) -> None:
    """Keep the newest paid plan active and retain every older billing record."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.fetchrow("SELECT id FROM users WHERE id=$1 FOR UPDATE", user_id)
            await conn.execute(
                """UPDATE subscriptions SET status='expired'
                   WHERE user_id=$1 AND status='active'
                     AND expires_at IS NOT NULL AND expires_at<=NOW()""",
                user_id,
            )
            current = await conn.fetchrow(
                """SELECT id, tier FROM subscriptions
                   WHERE user_id=$1 AND status='active'
                     AND (expires_at IS NULL OR expires_at > NOW())
                   ORDER BY (payment_ref IS NOT NULL) DESC, started_at DESC, id DESC
                   LIMIT 1""",
                user_id,
            )
            if not current:
                await conn.execute(
                    "UPDATE users SET subscription_tier='free' WHERE id=$1",
                    user_id,
                )
                return
            await conn.execute(
                """UPDATE subscriptions SET status='superseded'
                   WHERE user_id=$1 AND status='active' AND id<>$2""",
                user_id, current["id"],
            )
            await conn.execute(
                "UPDATE users SET subscription_tier=$1 WHERE id=$2",
                current["tier"], user_id,
            )


@router.get("/subscription/plans")
async def subscription_plans():
    return SUBSCRIPTION_PLANS


@router.get("/subscription/status")
async def subscription_status(current_user: dict = Depends(require_non_demo_user)):
    """Return the current plan and its server-controlled expiry."""
    await reconcile_active_subscriptions(current_user["id"])
    await expire_subscription_for_user(current_user["id"])
    from database import fetchrow
    row = await fetchrow(
        """SELECT tier, started_at, expires_at, status, billing_period, is_trial
           FROM subscriptions WHERE user_id = $1
           ORDER BY started_at DESC LIMIT 1""",
        current_user["id"],
    )
    return {
        "tier": (
            "free" if not row or row["status"] != "active" else row["tier"]
        ),
        "started_at": str(row["started_at"]) if row and row["started_at"] else None,
        "expires_at": str(row["expires_at"]) if row and row["expires_at"] else None,
        "status": row["status"] if row else "free",
        "billing_period": row["billing_period"] if row else None,
        "is_trial": bool(row["is_trial"]) if row else False,
    }


@router.post("/subscription/create-order")
async def subscription_create_order(req: CreateOrderRequest, current_user: dict = Depends(require_non_demo_user)):
    if req.tier not in PLAN_BASE_PRICES or req.billing_period not in BILLING_PERIOD_DAYS:
        raise HTTPException(status_code=400, detail="Invalid tier. Choose professional or advocate_pro")
    try:
        order = create_order(req.tier, current_user["id"], req.billing_period)
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Payment service unavailable. Please try again later.")
    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": __import__("os").environ.get("RAZORPAY_KEY_ID", ""),
        "billing_period": req.billing_period,
    }


@router.post("/subscription/verify")
async def subscription_verify(req: VerifyRequest, current_user: dict = Depends(require_non_demo_user)):
    if req.tier not in PLAN_BASE_PRICES or req.billing_period not in BILLING_PERIOD_DAYS:
        raise HTTPException(status_code=400, detail="Invalid tier")

    # Fetch Razorpay order and verify amount matches expected tier price
    expected_amount = subscription_amount_paise(req.tier, req.billing_period)
    try:
        order, _payment = _validate_provider_payment(
            req.razorpay_order_id, req.razorpay_payment_id, expected_amount
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to fetch order from payment provider")
    actual_amount = order.get("amount")
    notes = order.get("notes") or {}
    if (
        actual_amount != expected_amount
        or order.get("currency") != "INR"
        or str(notes.get("user_id")) != str(current_user["id"])
        or notes.get("tier") != req.tier
        or notes.get("billing_period", "monthly") != req.billing_period
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

    try:
        await _activate_subscription(
            current_user["id"],
            req.tier,
            req.razorpay_payment_id,
            req.billing_period,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {
        "success": True,
        "tier": req.tier,
        "billing_period": req.billing_period,
        "payment_id": req.razorpay_payment_id,
    }


@router.post("/subscription/start-trial")
async def subscription_start_trial(current_user: dict = Depends(require_non_demo_user)):
    try:
        await _start_advocate_pro_trial(current_user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {
        "success": True,
        "tier": "professional",
        "trial_days": 30,
        "message": "Your 30-day Advocate Pro trial has started.",
    }


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

    notes = order.get("notes") or payment.get("notes") or {}
    tier = notes.get("tier")
    billing_period = notes.get("billing_period", "monthly")
    try:
        user_id = int(notes.get("user_id"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Webhook order has invalid ownership") from exc

    try:
        expected_amount = subscription_amount_paise(tier, billing_period)
    except ValueError:
        expected_amount = None
    payment_id = payment.get("id")
    if not expected_amount or not payment_id:
        raise HTTPException(status_code=400, detail="Webhook payment does not match a valid plan")
    paid_amount = payment.get("amount", order.get("amount"))
    currency = payment.get("currency", order.get("currency"))
    payment_order_id = payment.get("order_id")
    if (
        paid_amount != expected_amount
        or currency != "INR"
        or (payment_order_id and order.get("id") and payment_order_id != order["id"])
        or payment.get("status") != "captured"
    ):
        raise HTTPException(status_code=400, detail="Webhook payment does not match a valid plan")

    try:
        await _activate_subscription(user_id, tier, payment_id, billing_period)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"received": True, "activated": True}


@router.post("/subscription/upgrade")
async def subscription_upgrade_deprecated():
    raise HTTPException(status_code=410, detail="This endpoint is no longer available. Use /subscription/create-order and /subscription/verify.")


# ── Invoice generation ──────────────────────────────────────────────────────────────────

@router.get("/subscription/invoices")
async def subscription_invoices(current_user: dict = Depends(require_non_demo_user)):
    """Return invoice history for the current user."""
    await reconcile_active_subscriptions(current_user["id"])
    from database import fetch
    rows = await fetch(
        """SELECT id, user_id, tier, started_at, expires_at, status, payment_ref,
                  billing_period, is_trial
           FROM subscriptions WHERE user_id = $1 ORDER BY started_at DESC""",
        current_user["id"],
    )
    for r in rows:
        r["started_at"] = str(r["started_at"])
    return {"invoices": rows}


@router.get("/subscription/download-invoice/{subscription_id}")
async def download_invoice(subscription_id: int, current_user: dict = Depends(require_non_demo_user)):
    """Invoices are intentionally disabled until company billing details are verified."""
    raise HTTPException(status_code=410, detail="Invoices will be available soon.")

    """Download a single invoice as HTML."""
    from database import fetchrow
    row = await fetchrow(
        "SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2",
        subscription_id, current_user["id"],
    )
    if not row:
        raise HTTPException(404, "Invoice not found")

    tier_name = row["tier"].replace("_", " ").title()
    price_map = {
        "professional": f"₹{ADVOCATE_PLAN_PRICES['professional']['monthly']:,}",
        "advocate_pro": f"₹{ADVOCATE_PLAN_PRICES['advocate_pro']['monthly']:,}",
    }
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
      <div class="meta">LitigaForge AI</div>
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
    <p>For questions, contact info@litigaforge.com</p>
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
async def subscription_downgrade(current_user: dict = Depends(require_non_demo_user)):
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
