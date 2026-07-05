"""
ForgeOS Business Pulse — unit tests with a mocked DB layer (no live Postgres).
Focus: build_pulse() must (a) always compute fresh numbers rather than reuse
a cached prompt, (b) refuse to run when the daily AI cost cap is already
reached, and (c) the scheduler's builder hook must tag the resulting mission
with mission_type=business_pulse and skip-without-failing on the cap case.
"""
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos import business_pulse, scheduler, orchestrator, dashboard, missions


@pytest.mark.asyncio
async def test_build_pulse_returns_none_when_cost_cap_reached(monkeypatch):
    async def fake_cap_exceeded():
        return 5.01

    monkeypatch.setattr(orchestrator, "_daily_cost_cap_exceeded", fake_cap_exceeded)
    monkeypatch.setattr(business_pulse, "_daily_cost_cap_exceeded", fake_cap_exceeded)

    result = await business_pulse.build_pulse()
    assert result is None


@pytest.mark.asyncio
async def test_build_pulse_embeds_live_numbers(monkeypatch):
    async def fake_cap_ok():
        return None

    async def fake_counts_today():
        return {
            "new_signups": 3, "new_cases": 2, "new_matches": 1,
            "accepted_matches": 1, "pending_verifications": 4,
            "new_contact_messages": 0,
        }

    async def fake_revenue_summary():
        return {"mrr_rupees": 49900.0, "paid_subscribers": 50, "by_tier": {}}

    async def fake_ai_cost_summary():
        return {"cost_today_usd": 0.42, "total_cost_usd": 12.5, "total_tokens": 1000,
                "by_agent": [], "unmetered_calls": 0}

    async def fake_week_over_week():
        return {
            "signups_this_week": 5, "signups_last_week": 3,
            "cases_this_week": 2, "cases_last_week": 2,
            "matches_this_week": 1, "matches_last_week": 0,
            "verified_lawyers": 10, "signups_this_month": 20,
        }

    async def fake_competitor_section_lines():
        return []

    monkeypatch.setattr(business_pulse, "_daily_cost_cap_exceeded", fake_cap_ok)
    monkeypatch.setattr(business_pulse, "_counts_today", fake_counts_today)
    monkeypatch.setattr(business_pulse, "_week_over_week", fake_week_over_week)
    monkeypatch.setattr(business_pulse, "_competitor_section_lines", fake_competitor_section_lines)
    monkeypatch.setattr(dashboard, "_revenue_summary", fake_revenue_summary)
    monkeypatch.setattr(dashboard, "_ai_cost_summary", fake_ai_cost_summary)

    result = await business_pulse.build_pulse()
    assert result is not None
    title, description = result
    assert title == "Business Pulse"
    assert "New signups: 3" in description
    assert "49,900" in description
    assert "$0.4200" in description
    assert "CEO" in description
    assert "Week-over-week" in description
    assert "Signups: 5 vs 3" in description


@pytest.mark.asyncio
async def test_build_pulse_includes_goal_progress_when_configured(monkeypatch):
    async def fake_cap_ok():
        return None

    async def fake_counts_today():
        return {"new_signups": 0, "new_cases": 0, "new_matches": 0,
                "accepted_matches": 0, "pending_verifications": 0, "new_contact_messages": 0}

    async def fake_week_over_week():
        return {"signups_this_week": 5, "signups_last_week": 3,
                "cases_this_week": 1, "cases_last_week": 1,
                "matches_this_week": 1, "matches_last_week": 1,
                "verified_lawyers": 8, "signups_this_month": 40}

    async def fake_revenue_summary():
        return {"mrr_rupees": 25000.0, "paid_subscribers": 25, "by_tier": {}}

    async def fake_ai_cost_summary():
        return {"cost_today_usd": 0.0, "total_cost_usd": 0.0, "total_tokens": 0,
                "by_agent": [], "unmetered_calls": 0}

    async def fake_competitor_section_lines():
        return []

    monkeypatch.setattr(business_pulse, "_daily_cost_cap_exceeded", fake_cap_ok)
    monkeypatch.setattr(business_pulse, "_counts_today", fake_counts_today)
    monkeypatch.setattr(business_pulse, "_week_over_week", fake_week_over_week)
    monkeypatch.setattr(business_pulse, "_competitor_section_lines", fake_competitor_section_lines)
    monkeypatch.setattr(dashboard, "_revenue_summary", fake_revenue_summary)
    monkeypatch.setattr(dashboard, "_ai_cost_summary", fake_ai_cost_summary)
    monkeypatch.setattr(business_pulse, "FORGEOS_GOAL_MONTHLY_SIGNUPS", 100)
    monkeypatch.setattr(business_pulse, "FORGEOS_GOAL_MRR_RUPEES", 50000.0)
    monkeypatch.setattr(business_pulse, "FORGEOS_GOAL_VERIFIED_LAWYERS", 0)

    result = await business_pulse.build_pulse()
    assert result is not None
    _, description = result
    assert "Progress vs configured goals" in description
    assert "Monthly signups goal: 40/100 (40%)" in description
    assert "MRR goal:" in description
    assert "Verified lawyers goal" not in description  # disabled (0) — no line shown


@pytest.mark.asyncio
async def test_competitor_section_lines_returns_empty_on_failure(monkeypatch):
    """A broken/unavailable growth_program dependency must never break a
    Business Pulse run — degrade to no competitor section, not a failure."""
    async def fake_get_competitor_snapshot(force_refresh=False):
        raise RuntimeError("boom")

    from forgeos import growth_program
    monkeypatch.setattr(growth_program, "get_competitor_snapshot", fake_get_competitor_snapshot)

    lines = await business_pulse._competitor_section_lines()
    assert lines == []


@pytest.mark.asyncio
async def test_scheduler_tags_business_pulse_mission(monkeypatch):
    async def fake_fetch(query, *args):
        return [{"id": 1, "name": "business_pulse", "interval_seconds": 21600,
                  "mission_template": {"builder": "business_pulse", "agent_name": "CEO"}}]

    async def fake_build_pulse():
        return ("Business Pulse", "fresh numbers here")

    created = []

    async def fake_create_mission(**kwargs):
        created.append(kwargs)
        return {"id": 99, "status": "assigned"}

    executed = []

    async def fake_execute(query, *args):
        executed.append((query, args))

    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "execute", fake_execute)
    monkeypatch.setattr(business_pulse, "build_pulse", fake_build_pulse)
    monkeypatch.setattr(missions, "create_mission", fake_create_mission)

    await scheduler._run_due_schedules()

    assert created and created[0]["title"] == "Business Pulse"
    assert created[0]["input_data"] == {"mission_type": "business_pulse"}
    assert executed


@pytest.mark.asyncio
async def test_scheduler_skips_business_pulse_when_cap_reached(monkeypatch):
    async def fake_fetch(query, *args):
        return [{"id": 1, "name": "business_pulse", "interval_seconds": 21600,
                  "mission_template": {"builder": "business_pulse", "agent_name": "CEO"}}]

    async def fake_build_pulse():
        return None

    executed = []

    async def fake_execute(query, *args):
        executed.append((query, args))

    created = []

    async def fake_create_mission(**kwargs):
        created.append(kwargs)
        return {"id": 100}

    async def fake_log_action(action, target_type="", target_id="", actor_user_id=None,
                               actor="system", detail=None):
        return {}

    from forgeos import audit
    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "execute", fake_execute)
    monkeypatch.setattr(business_pulse, "build_pulse", fake_build_pulse)
    monkeypatch.setattr(missions, "create_mission", fake_create_mission)
    monkeypatch.setattr(audit, "log_action", fake_log_action)

    await scheduler._run_due_schedules()

    assert created == []  # no mission created when the cap is hit
    assert executed  # next_run_at was still advanced, so it doesn't hot-loop
