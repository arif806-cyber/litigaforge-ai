"""
ForgeOS Dashboard Aggregation — unit tests with a mocked DB layer (no live
Postgres). Covers mission-status rollups, revenue-from-subscription-tier
math, AI-cost aggregation, and the merged/sorted activity feed.
"""
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos import dashboard, registry, missions as missions_mod


@pytest.mark.asyncio
async def test_mission_counts_defaults_every_status_to_zero(monkeypatch):
    async def fake_fetch(query, *args):
        return [{"status": "completed", "n": 3}, {"status": "running", "n": 1}]

    monkeypatch.setattr(dashboard, "fetch", fake_fetch)

    counts = await dashboard._mission_counts()
    assert counts["completed"] == 3
    assert counts["running"] == 1
    assert counts["planned"] == 0
    assert counts["failed"] == 0
    assert counts["total"] == 4


@pytest.mark.asyncio
async def test_revenue_summary_computes_mrr_from_subscription_tiers(monkeypatch):
    async def fake_fetch(query, *args):
        if "GROUP BY subscription_tier" in query:
            return [{"subscription_tier": "professional", "n": 2},
                    {"subscription_tier": "advocate_pro", "n": 1}]
        return [{"n": 3}]

    import payments
    monkeypatch.setattr(payments, "PLAN_PRICES", {"professional": 99900, "advocate_pro": 249900})
    monkeypatch.setattr(dashboard, "fetch", fake_fetch)

    revenue = await dashboard._revenue_summary()
    assert revenue["paid_subscribers"] == 3
    assert revenue["by_tier"]["professional"]["subscribers"] == 2
    assert revenue["by_tier"]["professional"]["mrr_rupees"] == 1998.0
    assert revenue["by_tier"]["advocate_pro"]["mrr_rupees"] == 2499.0
    assert revenue["mrr_rupees"] == 1998.0 + 2499.0


@pytest.mark.asyncio
async def test_ai_cost_summary_aggregates_cost_tokens_and_unmetered_calls(monkeypatch):
    async def fake_fetch(query, *args):
        # Order matters: check the most specific substrings first so the
        # broader "llm_cost_usd" check doesn't shadow the CURRENT_DATE /
        # by-agent / unmetered variants.
        if "a.id AS agent_id" in query:
            return [{"agent_id": 1, "name": "Backend Engineer", "cost_usd": 4.2}]
        if "ai_brain_cascade" in query:
            return [{"n": 2}]
        if "llm_tokens" in query:
            return [{"total": 15000}]
        if "llm_cost_usd" in query and "CURRENT_DATE" in query:
            return [{"total": 0.5}]
        if "llm_cost_usd" in query:
            return [{"total": 4.2}]
        return []

    monkeypatch.setattr(dashboard, "fetch", fake_fetch)

    summary = await dashboard._ai_cost_summary()
    assert summary["total_cost_usd"] == 4.2
    assert summary["total_tokens"] == 15000
    assert summary["cost_today_usd"] == 0.5
    assert summary["by_agent"] == [{"agent_id": 1, "name": "Backend Engineer", "cost_usd": 4.2}]
    assert summary["unmetered_calls"] == 2


@pytest.mark.asyncio
async def test_activity_feed_merges_audit_and_events_sorted_desc(monkeypatch):
    async def fake_list_audit_log(limit=30):
        return [{"created_at": "2026-07-01T10:00:00", "action": "mission.created",
                  "target_type": "mission", "target_id": "1", "detail": {}}]

    async def fake_recent_events(limit=30):
        return [{"created_at": "2026-07-01T12:00:00", "topic": "mission.completed", "payload": {}}]

    # dashboard.py does `from forgeos.audit import list_audit_log` (and same
    # for recent_events), binding its own local name at import time — so the
    # mock must target dashboard's reference, not the origin module's.
    monkeypatch.setattr(dashboard, "list_audit_log", fake_list_audit_log)
    monkeypatch.setattr(dashboard, "recent_events", fake_recent_events)

    feed = await dashboard._activity_feed(limit=30)
    assert len(feed) == 2
    assert feed[0]["kind"] == "event"  # the later timestamp sorts first
    assert feed[0]["action"] == "mission.completed"
    assert feed[1]["kind"] == "audit"
    assert feed[1]["action"] == "mission.created"


@pytest.mark.asyncio
async def test_activity_feed_respects_limit(monkeypatch):
    async def fake_list_audit_log(limit=30):
        return [{"created_at": f"2026-07-01T10:0{i}:00", "action": "a", "target_type": "",
                  "target_id": "", "detail": {}} for i in range(5)]

    async def fake_recent_events(limit=30):
        return []

    monkeypatch.setattr(dashboard, "list_audit_log", fake_list_audit_log)
    monkeypatch.setattr(dashboard, "recent_events", fake_recent_events)

    feed = await dashboard._activity_feed(limit=3)
    assert len(feed) == 3


@pytest.mark.asyncio
async def test_get_dashboard_snapshot_combines_all_sections(monkeypatch):
    async def fake_list_agents(status=None):
        return [{"id": 1, "name": "Backend Engineer", "status": "active"},
                {"id": 2, "name": "Disabled Agent", "status": "disabled"}]

    async def fake_list_missions(limit=20, status=None):
        return [{"id": 1, "title": "Mission A", "status": "completed"}]

    async def fake_mission_counts():
        return {"completed": 1, "total": 1}

    async def fake_revenue_summary():
        return {"mrr_rupees": 1998.0, "paid_subscribers": 2, "by_tier": {}}

    async def fake_ai_cost_summary():
        return {"total_cost_usd": 4.2, "total_tokens": 15000, "cost_today_usd": 0.5,
                "by_agent": [], "unmetered_calls": 0}

    async def fake_activity_feed(limit=30):
        return [{"kind": "event", "created_at": "now", "action": "x", "target_type": "",
                  "target_id": "", "detail": {}}]

    monkeypatch.setattr(registry, "list_agents", fake_list_agents)
    monkeypatch.setattr(missions_mod, "list_missions", fake_list_missions)
    monkeypatch.setattr(dashboard, "_mission_counts", fake_mission_counts)
    monkeypatch.setattr(dashboard, "_revenue_summary", fake_revenue_summary)
    monkeypatch.setattr(dashboard, "_ai_cost_summary", fake_ai_cost_summary)
    monkeypatch.setattr(dashboard, "_activity_feed", fake_activity_feed)

    snapshot = await dashboard.get_dashboard_snapshot()
    assert snapshot["agent_count"] == 2
    assert snapshot["active_agent_count"] == 1
    assert snapshot["mission_counts"]["total"] == 1
    assert snapshot["revenue"]["mrr_rupees"] == 1998.0
    assert snapshot["ai_cost"]["total_cost_usd"] == 4.2
    assert len(snapshot["activity"]) == 1
