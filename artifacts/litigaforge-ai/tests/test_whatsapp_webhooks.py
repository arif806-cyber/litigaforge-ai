import hashlib
import hmac
import json
import os
import sys

import pytest
from fastapi import HTTPException
from starlette.requests import Request

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import routers.whatsapp as webhook
import alerts.whatsapp as sender


def _request(method, path, body=b"", headers=None, query=None):
    raw_headers = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": method, "scheme": "https", "path": path, "raw_path": path.encode(),
        "query_string": query or b"", "headers": raw_headers, "server": ("example.test", 443),
        "client": ("127.0.0.1", 1234), "root_path": "",
    }
    sent = False
    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}
    return Request(scope, receive)


@pytest.mark.asyncio
async def test_meta_signature_and_optout_commands(monkeypatch):
    for key in ("WA_CLOUD_TOKEN", "WA_PHONE_NUMBER_ID", "WA_BUSINESS_ACCOUNT_ID",
                "WA_APP_SECRET", "WA_WEBHOOK_VERIFY_TOKEN"):
        monkeypatch.setenv(key, "test-value")
    monkeypatch.setenv("WA_CLOUD_ENABLED", "true")
    body = json.dumps({"entry": [{"changes": [{"value": {
        "messages": [{"from": "919876543210", "text": {"body": " STOP "}}]
    }}]}]}).encode()
    signature = "sha256=" + hmac.new(b"test-value", body, hashlib.sha256).hexdigest()
    recorded = []

    async def capture(phone, text, source):
        recorded.append((phone, text, source))

    monkeypatch.setattr(webhook, "_process_inbound", capture)
    await webhook.meta_webhook(_request("POST", "/whatsapp/cloud/webhook", body,
                                      {"X-Hub-Signature-256": signature}))
    assert recorded == [("919876543210", " STOP ", "meta")]

    with pytest.raises(HTTPException) as exc:
        await webhook.meta_webhook(_request("POST", "/whatsapp/cloud/webhook", body,
                                           {"X-Hub-Signature-256": "sha256=bad"}))
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_cloud_webhook_challenge_uses_configured_token(monkeypatch):
    for key in ("WA_CLOUD_TOKEN", "WA_PHONE_NUMBER_ID", "WA_BUSINESS_ACCOUNT_ID",
                "WA_APP_SECRET", "WA_WEBHOOK_VERIFY_TOKEN"):
        monkeypatch.setenv(key, "verify-me")
    monkeypatch.setenv("WA_CLOUD_ENABLED", "true")
    req = _request("GET", "/whatsapp/cloud/webhook",
                   query=b"hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123")
    response = await webhook.meta_webhook_verify(req)
    assert response.body == b"abc123"


@pytest.mark.asyncio
async def test_stop_and_start_update_persisted_consent(monkeypatch):
    changes = []

    async def record(phone, opted_out, source):
        changes.append((phone, opted_out, source))

    monkeypatch.setattr(webhook, "_set_consent", record)
    await webhook._process_inbound("+919876543210", "STOP", "meta")
    await webhook._process_inbound("+919876543210", "START", "twilio")
    assert changes == [
        ("+919876543210", True, "meta"),
        ("+919876543210", False, "twilio"),
    ]


@pytest.mark.asyncio
async def test_cloud_send_uses_graph_api_template(monkeypatch):
    for key, value in {
        "WA_CLOUD_ENABLED": "true", "WA_CLOUD_TOKEN": "token",
        "WA_PHONE_NUMBER_ID": "phone-id", "WA_BUSINESS_ACCOUNT_ID": "business-id",
        "WA_APP_SECRET": "app-secret", "WA_WEBHOOK_VERIFY_TOKEN": "verify",
        "WA_TEMPLATE_INFO": "approved_info_template",
    }.items():
        monkeypatch.setenv(key, value)

    async def opted_in(_phone):
        return False

    class Response:
        is_error = False
        def json(self):
            return {"messages": [{"id": "wamid.test"}]}

    calls = []
    class Client:
        def __init__(self, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return None
        async def post(self, url, **kwargs):
            calls.append((url, kwargs))
            return Response()

    monkeypatch.setattr(sender, "_is_opted_out", opted_in)
    monkeypatch.setattr(sender.httpx, "AsyncClient", Client)
    result = await sender.send_whatsapp_alert("A safe update", "+919876543210", "info")
    assert result["success"] is True and result["message_id"] == "wamid.test"
    assert calls[0][0].endswith("/v22.0/phone-id/messages")
    assert calls[0][1]["json"]["template"]["name"] == "approved_info_template"
    assert calls[0][1]["json"]["to"] == "919876543210"


@pytest.mark.asyncio
@pytest.mark.parametrize("provider_env", [
    {"WA_CLOUD_ENABLED": "true", "WA_CLOUD_TOKEN": "x", "WA_PHONE_NUMBER_ID": "1",
     "WA_BUSINESS_ACCOUNT_ID": "2", "WA_APP_SECRET": "x", "WA_WEBHOOK_VERIFY_TOKEN": "x"},
    {"WA_CLOUD_ENABLED": "false", "TWILIO_ACCOUNT_SID": "x", "TWILIO_AUTH_TOKEN": "x",
     "TWILIO_WHATSAPP_FROM": "whatsapp:+14155550123"},
])
async def test_opted_out_recipient_never_reaches_either_sender(monkeypatch, provider_env):
    for key in ("WA_CLOUD_ENABLED", "WA_CLOUD_TOKEN", "WA_PHONE_NUMBER_ID",
                "WA_BUSINESS_ACCOUNT_ID", "WA_APP_SECRET", "WA_WEBHOOK_VERIFY_TOKEN",
                "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"):
        monkeypatch.delenv(key, raising=False)
    for key, value in provider_env.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setattr(sender, "_is_opted_out", lambda _phone: _true())
    result = await sender.send_whatsapp_alert("test", "+919876543210")
    assert result["success"] is False
    assert "opted out" in result["error"]


async def _true():
    return True
