import hashlib
import hmac
import json
import os
import sys
from unittest.mock import AsyncMock

import pytest
from starlette.requests import Request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("SESSION_SECRET", "test-secret-123456789012345678901234567890")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

import payments
from routers import subscription


def test_create_order_enforces_server_price(monkeypatch):
    captured = {}

    class FakeOrders:
        def create(self, payload):
            captured.update(payload)
            return {"id": "order_test", **payload}

    class FakeClient:
        order = FakeOrders()

    monkeypatch.setattr(payments, "_get_client", lambda: FakeClient())

    payments.create_order("professional", 42)

    assert captured["amount"] == payments.PLAN_PRICES["professional"]
    assert captured["notes"] == {"user_id": "42", "tier": "professional"}


@pytest.mark.asyncio
async def test_signed_order_paid_webhook_activates_valid_plan(monkeypatch):
    secret = "webhook-test-secret"
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", secret)
    activate = AsyncMock()
    monkeypatch.setattr(subscription, "_activate_subscription", activate)

    payload = {
        "event": "order.paid",
        "payload": {
            "order": {
                "entity": {
                    "id": "order_test",
                    "amount": payments.PLAN_PRICES["professional"],
                    "currency": "INR",
                    "notes": {"user_id": "42", "tier": "professional"},
                }
            },
            "payment": {
                "entity": {
                    "id": "pay_test",
                    "amount": payments.PLAN_PRICES["professional"],
                    "currency": "INR",
                    "order_id": "order_test",
                }
            },
        },
    }
    raw = json.dumps(payload, separators=(",", ":")).encode()
    signature = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": raw, "more_body": False}

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/subscription/webhook",
            "headers": [(b"x-razorpay-signature", signature.encode())],
        },
        receive,
    )

    assert await subscription.subscription_webhook(request) == {
        "received": True,
        "activated": True,
    }
    activate.assert_awaited_once_with(42, "professional", "pay_test")