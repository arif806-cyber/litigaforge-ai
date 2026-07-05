"""
ForgeOS Growth & Competitive Intelligence Program — unit tests with a mocked
DB/HTTP layer (no live Postgres, no real outbound requests).

Focus: (a) every builder returns None when the daily AI cost cap is already
reached, (b) the competitor snapshot cache is TTL-based and never re-scrapes
when fresh, (c) the snapshot diff logic surfaces real, specific changes, and
(d) topic rotation persists a cursor in forgeos_memory instead of scanning
mission titles.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos import growth_program, memory, scheduler, dashboard


def _fresh_snapshot(fetched_at=None):
    return {
        "fetched_at": (fetched_at or datetime.now(timezone.utc)).isoformat(),
        "sites": {
            "LawRato": {"url": "https://lawrato.com/", "status": 200, "available": True,
                        "title": "LawRato - Lawyers Online", "meta_description": "Find lawyers"},
        },
    }


@pytest.mark.asyncio
async def test_all_builders_skip_when_cost_cap_reached(monkeypatch):
    async def fake_cap_exceeded():
        return 5.01

    monkeypatch.setattr(growth_program, "_daily_cost_cap_exceeded", fake_cap_exceeded)

    for name, builder in growth_program.BUILDERS.items():
        result = await builder()
        assert result is None, f"{name} should return None when cost cap is reached"


@pytest.mark.asyncio
async def test_get_competitor_snapshot_uses_cache_when_fresh(monkeypatch):
    cached = _fresh_snapshot(datetime.now(timezone.utc) - timedelta(hours=2))

    async def fake_get_value(namespace, key):
        assert namespace == "growth_program"
        return cached if key == "competitor_snapshot" else None

    async def fake_scrape_should_not_run():
        raise AssertionError("should not re-scrape while cache is within TTL")

    monkeypatch.setattr(memory, "get_value", fake_get_value)
    monkeypatch.setattr(growth_program, "_scrape_competitors", fake_scrape_should_not_run)

    result = await growth_program.get_competitor_snapshot()
    assert result == cached


@pytest.mark.asyncio
async def test_get_competitor_snapshot_refreshes_when_stale(monkeypatch):
    stale = _fresh_snapshot(datetime.now(timezone.utc) - timedelta(hours=25))
    fresh_sites = {"LawRato": {"url": "https://lawrato.com/", "available": True, "title": "New Title"}}

    async def fake_get_value(namespace, key):
        return stale if key == "competitor_snapshot" else None

    set_calls = []

    async def fake_set_value(namespace, key, value):
        set_calls.append((namespace, key, value))
        return {}

    async def fake_scrape():
        return fresh_sites

    monkeypatch.setattr(memory, "get_value", fake_get_value)
    monkeypatch.setattr(memory, "set_value", fake_set_value)
    monkeypatch.setattr(growth_program, "_scrape_competitors", fake_scrape)

    result = await growth_program.get_competitor_snapshot()
    assert result["sites"] == fresh_sites
    keys_set = [c[1] for c in set_calls]
    assert "competitor_snapshot_prev" in keys_set  # old snapshot preserved for diffing
    assert "competitor_snapshot" in keys_set


@pytest.mark.asyncio
async def test_get_competitor_snapshot_force_refresh_ignores_fresh_cache(monkeypatch):
    cached = _fresh_snapshot()

    async def fake_get_value(namespace, key):
        return cached if key == "competitor_snapshot" else None

    async def fake_set_value(namespace, key, value):
        return {}

    scrape_calls = []

    async def fake_scrape():
        scrape_calls.append(1)
        return {"LawRato": {"available": True}}

    monkeypatch.setattr(memory, "get_value", fake_get_value)
    monkeypatch.setattr(memory, "set_value", fake_set_value)
    monkeypatch.setattr(growth_program, "_scrape_competitors", fake_scrape)

    await growth_program.get_competitor_snapshot(force_refresh=True)
    assert scrape_calls == [1]


def test_diff_snapshots_no_prior():
    changes = growth_program._diff_snapshots(None, _fresh_snapshot())
    assert "first run" in changes[0].lower()


def test_diff_snapshots_detects_title_change():
    prev = _fresh_snapshot()
    current = _fresh_snapshot()
    current["sites"]["LawRato"]["title"] = "LawRato - New Positioning"
    changes = growth_program._diff_snapshots(prev, current)
    assert any("title changed" in c for c in changes)


def test_diff_snapshots_detects_became_unavailable():
    prev = _fresh_snapshot()
    current = _fresh_snapshot()
    current["sites"]["LawRato"] = {"available": False}
    changes = growth_program._diff_snapshots(prev, current)
    assert any("unreachable" in c for c in changes)


def test_diff_snapshots_no_changes():
    snap = _fresh_snapshot()
    changes = growth_program._diff_snapshots(snap, snap)
    assert "no detected" in changes[0].lower()


@pytest.mark.asyncio
async def test_next_topic_rotates_and_persists(monkeypatch):
    state = {}

    async def fake_get_value(namespace, key):
        return state.get(key)

    async def fake_set_value(namespace, key, value):
        state[key] = value

    monkeypatch.setattr(memory, "get_value", fake_get_value)
    monkeypatch.setattr(memory, "set_value", fake_set_value)

    topics = ["A", "B", "C"]
    first = await growth_program._next_topic("cursor", topics)
    second = await growth_program._next_topic("cursor", topics)
    third = await growth_program._next_topic("cursor", topics)
    fourth = await growth_program._next_topic("cursor", topics)

    assert [first, second, third, fourth] == ["A", "B", "C", "A"]


@pytest.mark.asyncio
async def test_build_content_drafting_returns_title_and_scoping_note(monkeypatch):
    async def fake_cap_ok():
        return None

    async def fake_get_value(namespace, key):
        return None

    async def fake_set_value(namespace, key, value):
        return {}

    monkeypatch.setattr(growth_program, "_daily_cost_cap_exceeded", fake_cap_ok)
    monkeypatch.setattr(memory, "get_value", fake_get_value)
    monkeypatch.setattr(memory, "set_value", fake_set_value)

    result = await growth_program.build_content_drafting()
    assert result is not None
    title, description = result
    assert title == "Growth Program: Blog Content Brief"
    assert "does not publish anything itself" in description
    assert "RECURRING weekly" in description


@pytest.mark.asyncio
async def test_build_competitor_watchlist_includes_diff(monkeypatch):
    async def fake_cap_ok():
        return None

    prev = _fresh_snapshot()
    current = _fresh_snapshot()
    current["sites"]["LawRato"]["title"] = "Repositioned Title"

    async def fake_snapshot(force_refresh=False):
        return current

    async def fake_get_value(namespace, key):
        return prev if key == "competitor_snapshot_prev" else None

    monkeypatch.setattr(growth_program, "_daily_cost_cap_exceeded", fake_cap_ok)
    monkeypatch.setattr(growth_program, "get_competitor_snapshot", fake_snapshot)
    monkeypatch.setattr(memory, "get_value", fake_get_value)

    result = await growth_program.build_competitor_watchlist()
    assert result is not None
    title, description = result
    assert title == "Growth Program: Competitor Watchlist"
    assert "public info only" in description.lower()
    assert "Repositioned Title" in description


@pytest.mark.asyncio
async def test_build_bar_verification_states_no_public_api(monkeypatch):
    async def fake_cap_ok():
        return None

    async def fake_kpi_lines():
        return ["- MRR: Rs 0"]

    monkeypatch.setattr(growth_program, "_daily_cost_cap_exceeded", fake_cap_ok)
    monkeypatch.setattr(growth_program, "_kpi_context_lines", fake_kpi_lines)

    result = await growth_program.build_bar_verification_api_design()
    assert result is not None
    _, description = result
    assert "no public Bar Council of India API" in description


@pytest.mark.asyncio
async def test_scheduler_dispatches_growth_builder(monkeypatch):
    """The generalized builder registry in scheduler.py must be able to fire
    any growth_program builder the same way it fires business_pulse."""
    async def fake_fetch(query, *args):
        return [{"id": 5, "name": "growth_seo_audit", "interval_seconds": 604800,
                  "mission_template": {"builder": "growth_seo_audit", "agent_name": "Backend Engineer"}}]

    async def fake_builder():
        return ("Growth Program: Technical SEO & CWV Audit", "audit body")

    monkeypatch.setattr(scheduler, "_get_builders",
                         lambda: {"growth_seo_audit": fake_builder})

    created = []

    async def fake_create_mission(**kwargs):
        created.append(kwargs)
        return {"id": 200, "status": "assigned"}

    executed = []

    async def fake_execute(query, *args):
        executed.append((query, args))

    from forgeos import missions
    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "execute", fake_execute)
    monkeypatch.setattr(missions, "create_mission", fake_create_mission)

    await scheduler._run_due_schedules()

    assert created and created[0]["title"] == "Growth Program: Technical SEO & CWV Audit"
    assert created[0]["input_data"] == {"mission_type": "growth_seo_audit"}
    assert executed


@pytest.mark.asyncio
async def test_scheduler_skips_growth_builder_when_cap_reached(monkeypatch):
    async def fake_fetch(query, *args):
        return [{"id": 6, "name": "growth_content_drafting", "interval_seconds": 604800,
                  "mission_template": {"builder": "growth_content_drafting", "agent_name": "Legal Research Agent"}}]

    async def fake_builder():
        return None

    monkeypatch.setattr(scheduler, "_get_builders",
                         lambda: {"growth_content_drafting": fake_builder})

    created = []

    async def fake_create_mission(**kwargs):
        created.append(kwargs)
        return {"id": 201}

    executed = []

    async def fake_execute(query, *args):
        executed.append((query, args))

    async def fake_log_action(action, target_type="", target_id="", actor_user_id=None,
                               actor="system", detail=None):
        return {}

    from forgeos import missions, audit
    monkeypatch.setattr(scheduler, "fetch", fake_fetch)
    monkeypatch.setattr(scheduler, "execute", fake_execute)
    monkeypatch.setattr(missions, "create_mission", fake_create_mission)
    monkeypatch.setattr(audit, "log_action", fake_log_action)

    await scheduler._run_due_schedules()

    assert created == []
    assert executed
