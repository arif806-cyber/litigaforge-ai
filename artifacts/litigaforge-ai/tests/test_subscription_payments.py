import hashlib
import hmac
import json
import os
import sys
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("SESSION_SECRET", "test-secret-123456789012345678901234567890")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

import payments
import payments_mor
from routers import subscription, paid_documents
from database import SUBSCRIPTION_PLANS


def _webhook_request(path, header_name, signature):
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": b"{}", "more_body": False}

    return Request({
        "type": "http", "method": "POST", "path": path, "query_string": b"",
        "headers": [(header_name.lower().encode(), signature.encode())],
    }, receive)


def test_plan_catalog_exposes_market_pricing_gst_and_trial():
    plans = {plan["id"]: plan for plan in SUBSCRIPTION_PLANS}
    assert plans["free"]["price_inr"] == 0
    assert plans["professional"]["name"] == "Advocate Pro"
    assert plans["professional"]["monthly_price_inr"] == 999
    assert plans["professional"]["annual_price_inr"] == 9999
    assert plans["professional"]["trial_days"] == 30
    assert plans["professional"]["gst_label"] == "+ 18% GST"
    assert plans["advocate_pro"]["name"] == "Chamber"
    assert plans["advocate_pro"]["monthly_price_inr"] == 2499
    assert plans["advocate_pro"]["annual_price_inr"] == 24999
    assert plans["advocate_pro"]["chamber_advocates"] == 5


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
    assert captured["amount"] == 117882
    assert captured["notes"] == {
        "user_id": "42",
        "tier": "professional",
        "billing_period": "monthly",
    }


def test_annual_order_uses_exact_server_price_and_period(monkeypatch):
    captured = {}

    class FakeOrders:
        def create(self, payload):
            captured.update(payload)
            return {"id": "order_annual", **payload}

    class FakeClient:
        order = FakeOrders()

    monkeypatch.setattr(payments, "_get_client", lambda: FakeClient())
    payments.create_order("advocate_pro", 42, "annual")

    assert captured["amount"] == 2949882
    assert captured["notes"]["billing_period"] == "annual"
    assert payments.subscription_amount_paise("professional", "annual") == 1179882
    with pytest.raises(ValueError):
        payments.subscription_amount_paise("professional", "weekly")


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
                    "status": "captured",
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
    activate.assert_awaited_once_with(42, "professional", "pay_test", "monthly")


@pytest.mark.asyncio
async def test_signed_annual_webhook_validates_period_price(monkeypatch):
    secret = "webhook-test-secret"
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", secret)
    activate = AsyncMock()
    monkeypatch.setattr(subscription, "_activate_subscription", activate)
    amount = payments.subscription_amount_paise("advocate_pro", "annual")
    payload = {
        "event": "order.paid",
        "payload": {
            "order": {"entity": {
                "id": "order_annual",
                "amount": amount,
                "currency": "INR",
                "notes": {
                    "user_id": "42",
                    "tier": "advocate_pro",
                    "billing_period": "annual",
                },
            }},
            "payment": {"entity": {
                "id": "pay_annual",
                "status": "captured",
                "amount": amount,
                "currency": "INR",
                "order_id": "order_annual",
            }},
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

    request = Request({
        "type": "http",
        "method": "POST",
        "path": "/subscription/webhook",
        "headers": [(b"x-razorpay-signature", signature.encode())],
    }, receive)
    assert await subscription.subscription_webhook(request) == {
        "received": True,
        "activated": True,
    }
    activate.assert_awaited_once_with(
        42, "advocate_pro", "pay_annual", "annual"
    )


@pytest.mark.parametrize("configured", [False, True], ids=["missing-secret", "wrong-signature"])
@pytest.mark.asyncio
async def test_razorpay_subscription_webhook_fails_closed(configured, monkeypatch, caplog):
    if configured:
        monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "configured-test-secret")
    else:
        monkeypatch.delenv("RAZORPAY_WEBHOOK_SECRET", raising=False)
    with caplog.at_level("WARNING"), pytest.raises(HTTPException) as exc:
        await subscription.subscription_webhook(
            _webhook_request("/subscription/webhook", "X-Razorpay-Signature", "invalid")
        )
    assert exc.value.status_code == 400
    assert "Razorpay webhook rejected" in caplog.text


@pytest.mark.parametrize("configured", [False, True], ids=["missing-secret", "wrong-signature"])
@pytest.mark.asyncio
async def test_paid_documents_webhook_fails_closed_with_merchant_of_record_secret(
    configured, monkeypatch, caplog,
):
    if configured:
        monkeypatch.setenv("LEMONSQUEEZY_WEBHOOK_SECRET", "configured-test-secret")
    else:
        monkeypatch.delenv("LEMONSQUEEZY_WEBHOOK_SECRET", raising=False)
    with caplog.at_level("WARNING"), pytest.raises(HTTPException) as exc:
        await paid_documents.webhook(
            _webhook_request("/documents/paid/webhook", "X-Signature", "invalid")
        )
    assert exc.value.status_code == 400
    assert "Paid-documents webhook rejected" in caplog.text