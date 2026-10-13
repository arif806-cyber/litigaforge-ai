import os
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import payments
from routers import matching, subscription
import database


def test_booking_fee_is_flat_and_configurable(monkeypatch):
    monkeypatch.delenv("MATCH_BOOKING_FEE_RUPEES", raising=False)
    assert payments.calc_commission_paise("₹1,00,00,000") == 39900
    monkeypatch.setenv("MATCH_BOOKING_FEE_RUPEES", "375")
    assert payments.calc_commission_paise("1") == 37500


def test_demo_payments_are_explicitly_opt_in(monkeypatch):
    monkeypatch.delenv("RAZORPAY_KEY_ID", raising=False)
    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)
    monkeypatch.delenv("DEMO_PAYMENTS", raising=False)
    assert payments.demo_payments_enabled() is False
    monkeypatch.setenv("DEMO_PAYMENTS", "true")
    assert payments.demo_payments_enabled() is True
    monkeypatch.setenv("RAZORPAY_KEY_ID", "live-key")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "live-secret")
    assert payments.demo_payments_enabled() is False


def test_live_match_order_does_not_fall_back_to_demo(monkeypatch):
    monkeypatch.delenv("DEMO_PAYMENTS", raising=False)
    monkeypatch.delenv("RAZORPAY_KEY_ID", raising=False)
    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="Live Razorpay keys"):
        payments.create_match_order(3, 9, 19900)


def _match(payment_status="none", status="pending"):
    return {
        "id": 3, "client_id": 9, "lawyer_id": 12, "case_requirement_id": 20,
        "status": status, "payment_status": payment_status,
        "commission_amount": 19900, "commission_payment_id": None,
    }


@pytest.mark.asyncio
async def test_hardcoded_demo_token_is_rejected_when_keys_exist(monkeypatch):
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")
    monkeypatch.delenv("DEMO_PAYMENTS", raising=False)
    monkeypatch.setattr(matching, "fetchrow", AsyncMock(return_value=_match()))
    with pytest.raises(HTTPException) as exc:
        await matching.verify_match_payment(
            3, matching.VerifyMatchPaymentRequest(demo_token=payments.DEMO_TOKEN),
            {"id": 9},
        )
    assert exc.value.status_code == 400
    assert "valid Razorpay" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_order_notes_amount_currency_and_signature_are_validated(monkeypatch):
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")
    monkeypatch.delenv("DEMO_PAYMENTS", raising=False)

    class Orders:
        def fetch(self, _order_id):
            return {
                "amount": 19900, "currency": "INR",
                "notes": {"match_id": "3", "client_id": "9"},
            }
    class Payments:
        def fetch(self, _payment_id):
            return {"order_id": "order_3", "status": "captured",
                    "amount": 19900, "currency": "INR"}
    monkeypatch.setattr(matching, "get_client", lambda: type(
        "R", (), {"order": Orders(), "payment": Payments()}
    )())
    monkeypatch.setattr(matching, "verify_payment", lambda *_args: True)
    rows = AsyncMock(side_effect=[
        _match(), None, {"id": 33},
        {"name": "A", "phone": "1", "email": "a@x"},
    ])
    conn = _Conn(rows=rows)
    monkeypatch.setattr(matching, "get_pool", AsyncMock(return_value=_Pool(conn)))
    monkeypatch.setattr(matching, "fetchrow", AsyncMock())
    monkeypatch.setattr(matching, "execute", AsyncMock())
    result = await matching.verify_match_payment(
        3,
        matching.VerifyMatchPaymentRequest(
            razorpay_order_id="order_3", razorpay_payment_id="pay_3",
            razorpay_signature="sig",
        ),
        {"id": 9},
    )
    assert result["thread_id"] is not None
    assert result["lawyer_contact"]["email"] == "a@x"
    assert any("UPDATE matches" in args[0] for args in conn.calls)


@pytest.mark.asyncio
async def test_reused_payment_id_is_rejected(monkeypatch):
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")
    class Orders:
        def fetch(self, _order_id):
            return {"amount": 19900, "currency": "INR",
                    "notes": {"match_id": "3", "client_id": "9"}}
    class Payments:
        def fetch(self, _payment_id):
            return {"order_id": "o", "status": "captured",
                    "amount": 19900, "currency": "INR"}
    monkeypatch.setattr(matching, "get_client", lambda: type(
        "R", (), {"order": Orders(), "payment": Payments()}
    )())
    monkeypatch.setattr(matching, "verify_payment", lambda *_args: True)
    monkeypatch.setattr(matching, "get_pool", AsyncMock(return_value=_Pool(_Conn(rows=AsyncMock(side_effect=[_match(), {"id": 44}])))))
    with pytest.raises(HTTPException) as exc:
        await matching.verify_match_payment(
            3, matching.VerifyMatchPaymentRequest(
                razorpay_order_id="o", razorpay_payment_id="already-used",
                razorpay_signature="s",
            ), {"id": 9},
        )
    assert exc.value.status_code == 409


def test_match_payment_id_has_database_uniqueness_except_demo_and_null():
    from pathlib import Path

    source = (Path(__file__).parents[1] / "main.py").read_text()
    migration = source[source.index("DROP INDEX IF EXISTS uq_matches_commission_payment_id"):]
    migration = migration[:migration.index("CREATE TABLE IF NOT EXISTS chat_threads")]
    assert "CREATE UNIQUE INDEX uq_matches_commission_payment_id" in migration
    assert "commission_payment_id IS NOT NULL" in migration
    assert "commission_payment_id <> 'DEMO_PAID'" in migration


@pytest.mark.asyncio
@pytest.mark.parametrize("state,payment_order", [
    ("created", "order_3"), ("authorized", "order_3"), ("captured", "other-order"),
])
async def test_unpaid_or_wrong_order_payment_is_rejected(monkeypatch, state, payment_order):
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")
    class Orders:
        def fetch(self, _order_id):
            return {"amount": 19900, "currency": "INR",
                    "notes": {"match_id": "3", "client_id": "9"}}
    class Payments:
        def fetch(self, _payment_id):
            return {"order_id": payment_order, "status": state,
                    "amount": 19900, "currency": "INR"}
    monkeypatch.setattr(matching, "get_client", lambda: type(
        "R", (), {"order": Orders(), "payment": Payments()}
    )())
    with pytest.raises(HTTPException) as exc:
        await matching.verify_match_payment(
            3, matching.VerifyMatchPaymentRequest(
                razorpay_order_id="order_3", razorpay_payment_id="pay",
                razorpay_signature="sig",
            ), {"id": 9},
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_advocate_interest_has_no_thread_and_client_must_pay(monkeypatch):
    monkeypatch.setattr(matching, "fetchrow", AsyncMock(side_effect=[_match(), {"id": 12}]))
    execute = AsyncMock()
    monkeypatch.setattr(matching, "execute", execute)
    result = await matching.accept_match(3, {"id": 99})
    assert "Interest recorded" in result["message"]
    execute.assert_awaited_once()
    assert "chat_threads" not in execute.await_args.args[0]

    monkeypatch.setattr(matching, "fetchrow", AsyncMock(side_effect=[_match(), None]))
    with pytest.raises(HTTPException) as exc:
        await matching.accept_match(3, {"id": 9})
    assert exc.value.status_code == 402


@pytest.mark.asyncio
async def test_legacy_put_restricts_status_and_requires_payment_for_completion(monkeypatch):
    monkeypatch.setattr(matching, "fetchrow", AsyncMock(return_value=_match()))
    with pytest.raises(HTTPException) as exc:
        await matching.update_match(3, matching.UpdateMatchRequest(status="accepted"), {"id": 9})
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        await matching.update_match(3, matching.UpdateMatchRequest(status="completed"), {"id": 9})
    assert exc.value.status_code == 402


class _Conn:
    def __init__(self, rows=None):
        self.calls = []
        self.rows = rows
    async def fetchrow(self, *args):
        self.calls.append(args)
        if self.rows:
            return await self.rows(*args)
        return None
    async def fetchval(self, *_args):
        if self.rows:
            return await self.rows(*_args)
        return None
    async def execute(self, *args):
        self.calls.append(args)

    async def fetch(self, *_args):
        return []
    async def __aenter__(self):
        return self
    async def __aexit__(self, *_args):
        return False
    def transaction(self):
        return self


class _Pool:
    def __init__(self, conn):
        self.conn = conn
    def acquire(self):
        return self.conn


@pytest.mark.asyncio
async def test_subscription_activation_sets_30_day_expiry(monkeypatch):
    conn = _Conn()
    class Pool:
        def acquire(self):
            return conn
    monkeypatch.setattr(subscription, "get_pool", AsyncMock(return_value=Pool()))
    await subscription._activate_subscription(9, "professional", "pay_sub")
    insert = next(args for args in conn.calls if "INSERT INTO subscriptions" in args[0])
    assert "$4 * INTERVAL '1 day'" in insert[0]
    assert insert[4] == 30
    assert insert[6] == "monthly"
    assert any("users WHERE id=$1 FOR UPDATE" in args[0] for args in conn.calls)


@pytest.mark.asyncio
async def test_subscription_repurchase_supersedes_prior_active_rows(monkeypatch):
    conn = _Conn()
    class Pool:
        def acquire(self):
            return conn
    monkeypatch.setattr(subscription, "get_pool", AsyncMock(return_value=Pool()))
    await subscription._activate_subscription(9, "professional", "new-payment")
    assert any("status='superseded'" in args[0] for args in conn.calls)


@pytest.mark.asyncio
async def test_active_annual_renewal_extends_from_current_expiry(monkeypatch):
    current_expiry = datetime.now(timezone.utc) + timedelta(days=20)
    conn = _Conn()
    conn.rows = AsyncMock(side_effect=[
        {"id": 9},
        None,
        {"id": 4, "expires_at": current_expiry},
    ])

    class Pool:
        def acquire(self):
            return conn

    monkeypatch.setattr(subscription, "get_pool", AsyncMock(return_value=Pool()))
    await subscription._activate_subscription(
        9, "advocate_pro", "pay_annual", "annual"
    )
    insert = next(args for args in conn.calls if "INSERT INTO subscriptions" in args[0])
    assert "GREATEST(NOW(), COALESCE($5, NOW()))" in insert[0]
    assert insert[4] == 365
    assert insert[5] == current_expiry
    assert insert[6] == "annual"


@pytest.mark.asyncio
async def test_advocate_pro_trial_requires_no_payment_and_is_one_time(monkeypatch):
    conn = _Conn()
    conn.rows = AsyncMock(side_effect=[{"id": 9}, None, None])

    class Pool:
        def acquire(self):
            return conn

    monkeypatch.setattr(subscription, "get_pool", AsyncMock(return_value=Pool()))
    await subscription._start_advocate_pro_trial(9)
    insert = next(args for args in conn.calls if "INSERT INTO subscriptions" in args[0])
    assert "'professional'" in insert[0]
    assert "INTERVAL '30 days'" in insert[0]
    assert "NULL" in insert[0]
    assert "TRUE" in insert[0]
    assert any("subscription_tier='professional'" in args[0] for args in conn.calls)


@pytest.mark.asyncio
async def test_advocate_pro_trial_cannot_be_reused(monkeypatch):
    conn = _Conn()
    conn.rows = AsyncMock(side_effect=[{"id": 9}, {"id": 8}])

    class Pool:
        def acquire(self):
            return conn

    monkeypatch.setattr(subscription, "get_pool", AsyncMock(return_value=Pool()))
    with pytest.raises(ValueError, match="already been used"):
        await subscription._start_advocate_pro_trial(9)
    assert not any("INSERT INTO subscriptions" in args[0] for args in conn.calls)


def test_trial_eligibility_is_database_enforced():
    from pathlib import Path

    source = (Path(__file__).parents[1] / "main.py").read_text()
    assert "CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_trial" in source
    assert "WHERE is_trial = TRUE" in source


@pytest.mark.asyncio
async def test_expired_subscription_payment_replay_cannot_restore_access(monkeypatch):
    conn = _Conn()
    conn.rows = AsyncMock(return_value={
        "id": 4, "user_id": 9, "tier": "professional",
        "status": "expired",
        "expires_at": datetime.now(timezone.utc) - timedelta(days=1),
    })
    class Pool:
        def acquire(self):
            return conn
    monkeypatch.setattr(subscription, "get_pool", AsyncMock(return_value=Pool()))
    with pytest.raises(ValueError, match="expired subscription"):
        await subscription._activate_subscription(9, "professional", "old-payment")
    assert not any("UPDATE users SET subscription_tier" in args[0] for args in conn.calls)


@pytest.mark.asyncio
async def test_expired_subscription_status_is_free(monkeypatch):
    expire = AsyncMock()
    reconcile = AsyncMock()
    monkeypatch.setattr(subscription, "expire_subscription_for_user", expire)
    monkeypatch.setattr(subscription, "reconcile_active_subscriptions", reconcile)
    monkeypatch.setattr(database, "fetchrow", AsyncMock(return_value={
        "tier": "professional", "status": "expired",
        "started_at": None, "expires_at": "yesterday",
        "billing_period": "monthly", "is_trial": False,
    }))
    result = await subscription.subscription_status({"id": 9, "subscription_tier": "professional"})
    expire.assert_awaited_once_with(9)
    reconcile.assert_awaited_once_with(9)
    assert result["tier"] == "free"
    assert result["status"] == "expired"


@pytest.mark.asyncio
async def test_invoice_download_is_disabled():
    with pytest.raises(HTTPException) as exc:
        await subscription.download_invoice(1, {"id": 9})
    assert exc.value.status_code == 410
    assert "available soon" in str(exc.value.detail)