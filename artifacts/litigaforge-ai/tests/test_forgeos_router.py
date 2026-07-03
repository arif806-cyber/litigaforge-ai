"""
ForgeOS REST API — smoke tests against an isolated FastAPI app that mounts
only the forgeos router, with auth dependencies overridden and the
registry/missions/events/approvals modules mocked (no live DB, no live LLM).
"""
import asyncio
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from auth import require_user, get_superuser
from forgeos.router import router as forgeos_router
from forgeos import registry, missions, approvals, dashboard, github, audit
from forgeos.events import bus


NORMAL_USER = {"id": 1, "email": "user@test.com", "is_superuser": False}
ADMIN_USER = {"id": 2, "email": "admin@test.com", "is_superuser": True}


def _make_app(as_admin: bool = False) -> FastAPI:
    app = FastAPI()
    app.include_router(forgeos_router)
    user = ADMIN_USER if as_admin else NORMAL_USER
    app.dependency_overrides[require_user] = lambda: user
    app.dependency_overrides[get_superuser] = lambda: user
    return app


def test_list_agents_requires_auth_dependency_only(monkeypatch):
    async def fake_list_agents(status=None):
        return [{"id": 1, "name": "CEO", "role": "Chief Executive Officer"}]

    monkeypatch.setattr(registry, "list_agents", fake_list_agents)

    client = TestClient(_make_app())
    resp = client.get("/forgeos/agents")
    assert resp.status_code == 200
    assert resp.json()[0]["name"] == "CEO"


def test_register_agent_forbidden_for_non_admin():
    app = FastAPI()
    app.include_router(forgeos_router)
    app.dependency_overrides[require_user] = lambda: NORMAL_USER

    def _forbidden_superuser():
        from fastapi import HTTPException
        raise HTTPException(403, "Admin access required")

    app.dependency_overrides[get_superuser] = _forbidden_superuser

    client = TestClient(app)
    resp = client.post("/forgeos/agents", json={"name": "CEO", "role": "Chief Executive Officer"})
    assert resp.status_code == 403


def test_register_agent_allowed_for_admin(monkeypatch):
    async def fake_register_agent(name, role, description="", capabilities=None, model=""):
        return {"id": 1, "name": name, "role": role, "status": "active"}

    monkeypatch.setattr(registry, "register_agent", fake_register_agent)

    client = TestClient(_make_app(as_admin=True))
    resp = client.post("/forgeos/agents", json={"name": "CEO", "role": "Chief Executive Officer"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "CEO"


def test_create_mission_returns_400_on_value_error(monkeypatch):
    async def fake_create_mission(**kwargs):
        raise ValueError("Unknown agent 'Nope'")

    monkeypatch.setattr(missions, "create_mission", fake_create_mission)

    client = TestClient(_make_app())
    resp = client.post("/forgeos/missions", json={"title": "Do a thing", "agent_name": "Nope"})
    assert resp.status_code == 400


def test_create_mission_success(monkeypatch):
    async def fake_create_mission(**kwargs):
        return {"id": 1, "title": kwargs["title"], "status": "assigned"}

    monkeypatch.setattr(missions, "create_mission", fake_create_mission)

    client = TestClient(_make_app())
    resp = client.post("/forgeos/missions", json={"title": "Do a thing"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "assigned"


def test_get_mission_status_404_when_missing(monkeypatch):
    async def fake_get_mission(mission_id):
        return None

    monkeypatch.setattr(missions, "get_mission", fake_get_mission)

    client = TestClient(_make_app())
    resp = client.get("/forgeos/missions/999")
    assert resp.status_code == 404


def test_publish_event_success(monkeypatch):
    async def fake_publish(topic, payload, source=""):
        return {"id": 1, "topic": topic, "payload": payload, "source": source}

    monkeypatch.setattr(bus, "publish", fake_publish)

    client = TestClient(_make_app())
    resp = client.post("/forgeos/events", json={"topic": "custom.event", "payload": {"x": 1}})
    assert resp.status_code == 200
    assert resp.json()["topic"] == "custom.event"


def test_approvals_list_requires_admin():
    app = FastAPI()
    app.include_router(forgeos_router)
    app.dependency_overrides[require_user] = lambda: NORMAL_USER

    def _forbidden_superuser():
        from fastapi import HTTPException
        raise HTTPException(403, "Admin access required")

    app.dependency_overrides[get_superuser] = _forbidden_superuser

    client = TestClient(app)
    resp = client.get("/forgeos/approvals")
    assert resp.status_code == 403


def test_approve_approval_success(monkeypatch):
    async def fake_approve(approval_id, reviewer_id):
        return {"id": approval_id, "status": "approved", "reviewed_by": reviewer_id}

    monkeypatch.setattr(approvals, "approve", fake_approve)

    client = TestClient(_make_app(as_admin=True))
    resp = client.post("/forgeos/approvals/1/approve")
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


def test_reject_approval_value_error_returns_400(monkeypatch):
    async def fake_reject(approval_id, reviewer_id, reason=""):
        raise ValueError("Approval already approved")

    monkeypatch.setattr(approvals, "reject", fake_reject)

    client = TestClient(_make_app(as_admin=True))
    resp = client.post("/forgeos/approvals/1/reject", json={"reason": "changed my mind"})
    assert resp.status_code == 400


# ── Command Center endpoints ─────────────────────────────────────────────────

def test_dashboard_requires_admin():
    app = FastAPI()
    app.include_router(forgeos_router)
    app.dependency_overrides[require_user] = lambda: NORMAL_USER

    def _forbidden_superuser():
        from fastapi import HTTPException
        raise HTTPException(403, "Admin access required")

    app.dependency_overrides[get_superuser] = _forbidden_superuser

    client = TestClient(app)
    resp = client.get("/forgeos/dashboard")
    assert resp.status_code == 403


def test_dashboard_success(monkeypatch):
    async def fake_snapshot():
        return {"agents": [], "missions": {"active": 0}, "revenue": {"mrr": 0}}

    monkeypatch.setattr(dashboard, "get_dashboard_snapshot", fake_snapshot)

    client = TestClient(_make_app(as_admin=True))
    resp = client.get("/forgeos/dashboard")
    assert resp.status_code == 200
    assert resp.json()["missions"]["active"] == 0


def test_dashboard_500_on_exception(monkeypatch):
    async def fake_snapshot():
        raise RuntimeError("boom")

    monkeypatch.setattr(dashboard, "get_dashboard_snapshot", fake_snapshot)

    client = TestClient(_make_app(as_admin=True))
    resp = client.get("/forgeos/dashboard")
    assert resp.status_code == 500


def _forbidden_app() -> FastAPI:
    app = FastAPI()
    app.include_router(forgeos_router)
    app.dependency_overrides[require_user] = lambda: NORMAL_USER

    def _forbidden_superuser():
        from fastapi import HTTPException
        raise HTTPException(403, "Admin access required")

    app.dependency_overrides[get_superuser] = _forbidden_superuser
    return app


def test_deployments_requires_admin():
    client = TestClient(_forbidden_app())
    resp = client.get("/forgeos/deployments")
    assert resp.status_code == 403


def test_deployments_success(monkeypatch):
    captured = {}

    async def fake_status(force_refresh=False):
        captured["force_refresh"] = force_refresh
        return {"pull_requests": [], "workflow_runs": []}

    monkeypatch.setattr(github, "get_deployment_status", fake_status)

    client = TestClient(_make_app(as_admin=True))
    resp = client.get("/forgeos/deployments?force_refresh=true")
    assert resp.status_code == 200
    assert captured["force_refresh"] is True


def test_audit_log_requires_admin():
    client = TestClient(_forbidden_app())
    resp = client.get("/forgeos/audit-log")
    assert resp.status_code == 403


def test_audit_log_success(monkeypatch):
    captured = {}

    async def fake_list(action=None, target_type=None, limit=100):
        captured.update(action=action, target_type=target_type, limit=limit)
        return [{"id": 1, "action": "mission.created"}]

    monkeypatch.setattr(audit, "list_audit_log", fake_list)

    client = TestClient(_make_app(as_admin=True))
    resp = client.get("/forgeos/audit-log?action=mission.created&limit=10")
    assert resp.status_code == 200
    assert resp.json()[0]["action"] == "mission.created"
    assert captured == {"action": "mission.created", "target_type": None, "limit": 10}


def test_stream_requires_admin():
    client = TestClient(_forbidden_app())
    resp = client.get("/forgeos/stream")
    assert resp.status_code == 403


def test_stream_emits_snapshot_then_live_event(monkeypatch):
    """Drives the SSE generator directly (no real HTTP round-trip) so the
    test can't hang on the endpoint's infinite streaming loop: a fake queue
    pre-seeded with one event resolves the first queue.get() immediately,
    and a fake request reports disconnected right after that to end the
    loop deterministically."""
    async def fake_snapshot():
        return {"agents": [], "missions": {"active": 0}}

    monkeypatch.setattr(dashboard, "get_dashboard_snapshot", fake_snapshot)

    fake_queue = asyncio.Queue()
    fake_queue.put_nowait({"topic": "mission.created", "payload": {"id": 1}})
    monkeypatch.setattr(bus, "subscribe", lambda topic: fake_queue)
    monkeypatch.setattr(bus, "unsubscribe", lambda topic, q: None)

    class FakeRequest:
        def __init__(self):
            self.n = 0

        async def is_disconnected(self):
            self.n += 1
            return self.n > 1

    from forgeos.router import stream_command_center

    async def _run():
        resp = await stream_command_center(FakeRequest(), current_user=ADMIN_USER)
        chunks = []
        async for chunk in resp.body_iterator:
            chunks.append(chunk)
            if len(chunks) >= 2:
                break
        return chunks

    chunks = asyncio.run(_run())
    assert chunks[0].startswith("event: snapshot")
    assert "missions" in chunks[0]
    assert chunks[1].startswith("event: event")
    assert "mission.created" in chunks[1]
