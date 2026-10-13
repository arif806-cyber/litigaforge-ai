import logging
import smtplib

import pytest

import alerts.email as email
import routers.admin as admin


def test_send_uses_verified_starttls_and_20_second_timeout(monkeypatch):
    sent = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            sent.update(host=host, port=port, timeout=timeout)

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def ehlo(self):
            pass

        def starttls(self, context):
            sent["context"] = context

        def login(self, user, password):
            sent["login"] = (user, password)

        def send_message(self, message):
            sent["message"] = message

    monkeypatch.setattr(email, "SMTP_HOST", "smtp.office365.com")
    monkeypatch.setattr(email, "SMTP_PORT", 587)
    monkeypatch.setattr(email, "SMTP_USER", "support@litigaforge.com")
    monkeypatch.setattr(email, "SMTP_PASSWORD", "test-only-password")
    monkeypatch.setattr(email.smtplib, "SMTP", FakeSMTP)

    result = email.send_test_email("admin@example.com")

    assert result == {"success": True, "mode": "live", "to": "admin@example.com"}
    assert sent["timeout"] == 20
    assert sent["port"] == 587
    assert sent["context"].verify_mode == email.ssl.CERT_REQUIRED
    assert sent["login"] == ("support@litigaforge.com", "test-only-password")
    assert sent["message"]["From"] == email.SMTP_FROM
    assert sent["message"]["Reply-To"] == "support@litigaforge.com"


def test_temporary_4xx_is_retried_once(monkeypatch):
    attempts = []

    class FakeSMTP:
        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def ehlo(self):
            pass

        def starttls(self, context):
            pass

        def login(self, *_):
            pass

        def send_message(self, _message):
            attempts.append(1)
            if len(attempts) == 1:
                raise smtplib.SMTPDataError(451, b"temporary failure")

    monkeypatch.setattr(email, "SMTP_PASSWORD", "test-only-password")
    monkeypatch.setattr(email.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(email.time, "sleep", lambda _: None)

    result = email.send_test_email("admin@example.com")

    assert result["success"] is True
    assert len(attempts) == 2


def test_microsoft_365_smtp_auth_disabled_error_is_clear_and_safe(monkeypatch, caplog):
    class FakeSMTP:
        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def ehlo(self):
            pass

        def starttls(self, context):
            pass

        def login(self, *_):
            raise smtplib.SMTPAuthenticationError(
                535,
                b"5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Tenant.",
            )

    monkeypatch.setattr(email, "SMTP_PASSWORD", "test-only-password")
    monkeypatch.setattr(email.smtplib, "SMTP", FakeSMTP)
    caplog.set_level(logging.ERROR, logger="litigaforge.email")

    result = email.send_test_email("admin@example.com")

    assert not result["success"]
    assert "SMTP AUTH must be enabled for this mailbox in Microsoft 365" in result["error"]
    assert "SMTP code=535" in caplog.text
    assert "5.7.139" in caplog.text
    assert "test-only-password" not in caplog.text


@pytest.mark.asyncio
async def test_admin_test_email_uses_admin_identity_and_is_admin_guarded(monkeypatch):
    route = next(
        route for route in admin.router.routes
        if getattr(route, "path", None) == "/admin/email/test"
    )
    assert any(
        dependency.call is admin.get_superuser
        for dependency in route.dependant.dependencies
    )

    received = []
    monkeypatch.setattr(
        admin,
        "send_test_email",
        lambda address: received.append(address) or {"success": True},
    )
    result = await admin.admin_send_test_email({"email": "admin@example.com"})

    assert result == {"success": True, "sent_to": "admin@example.com"}
    assert received == ["admin@example.com"]
