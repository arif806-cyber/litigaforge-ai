import os
import sys
from unittest.mock import AsyncMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import maintenance
import payments
from routers import matching
from routers.community import PUBLIC_DIRECTORY_FIELDS


class _Tx:
    async def __aenter__(self): return self
    async def __aexit__(self, *args): return False


class _Conn:
    def __init__(self, rows):
        self.rows = rows
        self.updated = False

    def transaction(self): return _Tx()

    async def fetchval(self, query, *args):
        return True

    async def fetch(self, query, *args):
        return self.rows

    async def execute(self, query, *args):
        self.updated = True


class _Pool:
    def __init__(self, conn): self.conn = conn
    def acquire(self):
        conn = self.conn
        class _Acquire:
            async def __aenter__(self): return conn
            async def __aexit__(self, *args): return False
        return _Acquire()


def test_public_directory_allowlist_and_gst_inclusive_order(monkeypatch):
    assert "rating" not in PUBLIC_DIRECTORY_FIELDS
    assert "hourly_rate" not in PUBLIC_DIRECTORY_FIELDS
    monkeypatch.setenv("DEMO_PAYMENTS", "true")
    monkeypatch.delenv("RAZORPAY_KEY_ID", raising=False)
    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)
    order = payments.create_match_order(4, 7, 39900)
    assert order["gst_inclusive"] is True
    assert order["notes"]["gst_inclusive"] == "true"


def test_paid_match_refund_window_includes_exact_boundary():
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    assert matching.refund_within_decline_window(now - timedelta(hours=48), now)
    assert not matching.refund_within_decline_window(now - timedelta(hours=48, seconds=1), now)


@pytest.mark.asyncio
async def test_refund_reconciliation_success_is_idempotent(monkeypatch):
    row = {"match_id": 4, "payment_id": "pay_4", "amount_paise": 39900}
    conn = _Conn([row])
    monkeypatch.setattr(maintenance, "get_pool", AsyncMock(return_value=_Pool(conn)))
    monkeypatch.setattr(maintenance, "_refund", AsyncMock(return_value={"id": "rf_4"}))
    execute = AsyncMock()
    monkeypatch.setattr(maintenance, "execute", execute)

    assert await maintenance.reconcile_match_refunds() == 1
    maintenance._refund.assert_awaited_once_with("pay_4", 39900)
    assert any("DELETE FROM match_refund_retries" in call.args[0] for call in execute.await_args_list)


@pytest.mark.asyncio
async def test_refund_reconciliation_failure_keeps_pending_with_backoff(monkeypatch):
    row = {"match_id": 4, "payment_id": "pay_4", "amount_paise": 39900}
    monkeypatch.setattr(maintenance, "get_pool", AsyncMock(return_value=_Pool(_Conn([row]))))
    monkeypatch.setattr(maintenance, "_refund", AsyncMock(side_effect=RuntimeError("provider down")))
    execute = AsyncMock()
    monkeypatch.setattr(maintenance, "execute", execute)

    assert await maintenance.reconcile_match_refunds() == 0
    retry = [call for call in execute.await_args_list if "SET status='pending'" in call.args[0]]
    assert retry
    assert "next_attempt_at" in retry[0].args[0]