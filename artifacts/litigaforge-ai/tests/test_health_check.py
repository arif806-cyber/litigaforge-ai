"""
LitigaForge AI — Daily Product Health Check — unit tests with a mocked DB
and HTTP layer (no live Postgres, no real network calls). Focus: the
two-severity model must classify runs correctly (ok / degraded / critical)
and a founder alert must fire exactly on CRITICAL, never on a merely
DEGRADED (AI-only) failure.
"""
import os
import sys
from datetime import datetime, timezone

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

import health_check as hc
import alerts.email as alerts_email


def _patch_all_checks_ok(monkeypatch):
    async def ok_database():
        return "DB reachable"

    async def ok_get(client, path):
        return f"HTTP 200 {path}"

    async def ok_login(client, results):
        results.append({"name": "auth_login", "severity": "critical", "status": "ok",
                         "latency_ms": 5, "detail": "login OK"})
        results.append({"name": "auth_me", "severity": "critical", "status": "ok",
                         "latency_ms": 5, "detail": "session OK"})

    async def ok_llm(client):
        return "LLM provider reachable"

    executed = []

    async def fake_execute(query, *args):
        executed.append((query, args))

    monkeypatch.setattr(hc, "_check_database", ok_database)
    monkeypatch.setattr(hc, "_check_get_ok", ok_get)
    monkeypatch.setattr(hc, "_check_login_and_session", ok_login)
    monkeypatch.setattr(hc, "_check_llm_health", ok_llm)
    monkeypatch.setattr(hc, "execute", fake_execute)
    return executed


@pytest.mark.asyncio
async def test_all_checks_pass_yields_ok_and_no_alert(monkeypatch):
    executed = _patch_all_checks_ok(monkeypatch)

    alerts_sent = []

    def fake_alert(subject, message):
        alerts_sent.append(subject)
        return [{"success": True}]

    monkeypatch.setattr(alerts_email, "send_founder_alert", fake_alert)
    monkeypatch.setattr(hc, "send_founder_alert", fake_alert)

    result = await hc.run_health_check()

    assert result["overall_status"] == "ok"
    assert all(r["status"] == "ok" for r in result["results"])
    assert alerts_sent == []
    assert executed  # the run was persisted to health_check_runs


@pytest.mark.asyncio
async def test_critical_failure_marks_run_critical_and_alerts_founder(monkeypatch):
    _patch_all_checks_ok(monkeypatch)

    async def failing_database():
        raise RuntimeError("connection refused")

    monkeypatch.setattr(hc, "_check_database", failing_database)

    alerts_sent = []

    async def fake_alert_async(*a, **k):
        # send_founder_alert is sync and called via asyncio.to_thread — a
        # coroutine here would prove the code isn't actually running it in
        # a thread, so keep this deliberately sync-shaped below instead.
        raise AssertionError("should be called as a sync function via to_thread")

    def fake_alert(subject, message):
        alerts_sent.append((subject, message))
        return [{"success": True}]

    monkeypatch.setattr(hc, "send_founder_alert", fake_alert)

    result = await hc.run_health_check()

    assert result["overall_status"] == "critical"
    failed = [r for r in result["results"] if r["status"] == "fail"]
    assert any(r["name"] == "database" for r in failed)
    assert len(alerts_sent) == 1
    assert "database" in alerts_sent[0][1]


@pytest.mark.asyncio
async def test_degraded_ai_only_failure_does_not_alert_founder(monkeypatch):
    _patch_all_checks_ok(monkeypatch)

    async def failing_llm(client):
        raise RuntimeError("provider timeout")

    monkeypatch.setattr(hc, "_check_llm_health", failing_llm)

    alerts_sent = []

    def fake_alert(subject, message):
        alerts_sent.append(subject)
        return [{"success": True}]

    monkeypatch.setattr(hc, "send_founder_alert", fake_alert)

    result = await hc.run_health_check()

    assert result["overall_status"] == "degraded"
    assert alerts_sent == []  # a flaky AI provider must never page the founder


def test_next_run_seconds_targets_7am_ist():
    # 06:00 IST same day -> 1 hour until 07:00 IST
    now_utc = datetime(2026, 7, 3, 0, 30, tzinfo=timezone.utc)  # 06:00 IST
    seconds = hc._next_run_seconds(now_utc)
    assert abs(seconds - 3600) < 1

    # 08:00 IST same day -> next run is tomorrow 07:00 IST (23 hours away)
    now_utc2 = datetime(2026, 7, 3, 2, 30, tzinfo=timezone.utc)  # 08:00 IST
    seconds2 = hc._next_run_seconds(now_utc2)
    assert abs(seconds2 - 23 * 3600) < 1


def test_start_scheduler_disabled_outside_production(monkeypatch):
    monkeypatch.setattr(hc, "_is_prod", lambda: False)
    assert hc.start_scheduler() is None


@pytest.mark.asyncio
async def test_bootstrap_reserved_user_rotates_password_each_call(monkeypatch):
    inserted = []

    async def fake_execute(query, *args):
        inserted.append(args)

    monkeypatch.setattr(hc, "execute", fake_execute)

    p1 = await hc._bootstrap_reserved_user()
    p2 = await hc._bootstrap_reserved_user()

    assert p1 != p2  # rotates every run — never a fixed/reused password
    assert len(inserted) == 2
    assert inserted[0][0] == hc.HEALTHCHECK_EMAIL
