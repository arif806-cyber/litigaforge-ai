"""
ForgeOS REST API — mounted at {BASE_PATH}/forgeos, only when FORGEOS_ENABLED
is true. The entire router is superuser-only: this is an internal ops tool,
not a feature exposed to regular clients/lawyers. Beyond agent registration
and approval decisions (which were always superuser-gated), mission/workflow
creation can trigger real LLM spend and run arbitrary free-text tasks under
ForgeOS's identity, event publishing feeds directly into the admin
dashboard's activity feed and SSE stream, and every GET endpoint here leaks
LLM outputs, agent KPIs, or in-flight task state that a non-admin has no
business seeing. The only consumer is the superuser-only /forgeos frontend
page, so gating every route behind get_superuser costs nothing.

The Command Center dashboard (GET /dashboard, GET /stream, GET /deployments,
GET /audit-log) is superuser-only end to end — it surfaces real revenue and
AI-cost figures that must never leak to a non-admin user.
"""
import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from auth import get_superuser
from logger import get_logger
from rate_limit import limiter
from sanitizer import sanitize_text

from forgeos import registry, missions, workflows, approvals, dashboard, github, audit
from forgeos.events import bus, recent_events

logger = get_logger("litigaforge.forgeos")
router = APIRouter(prefix="/forgeos", tags=["forgeos"])


# ── Models ───────────────────────────────────────────────────────────────────

class RegisterAgentRequest(BaseModel):
    name: str = Field(..., max_length=100)
    role: str = Field(..., max_length=100)
    description: str = Field("", max_length=1000)
    capabilities: list[str] = Field(default_factory=list)
    model: str = Field("", max_length=100)


class CreateMissionRequest(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = Field("", max_length=8000)
    agent_id: Optional[int] = None
    agent_name: Optional[str] = Field(None, max_length=100)
    input: dict = Field(default_factory=dict)
    requires_approval: bool = False


class WorkflowStepRequest(BaseModel):
    name: str = Field(..., max_length=200)
    agent_id: Optional[int] = None
    agent_name: Optional[str] = Field(None, max_length=100)
    input: dict = Field(default_factory=dict)
    requires_approval: bool = False


class CreateWorkflowRequest(BaseModel):
    name: str = Field(..., max_length=200)
    mission_id: Optional[int] = None
    steps: list[WorkflowStepRequest]


class PublishEventRequest(BaseModel):
    topic: str = Field(..., max_length=200)
    payload: dict = Field(default_factory=dict)


class ApprovalDecisionRequest(BaseModel):
    reason: str = Field("", max_length=1000)


# ── Agents (Agent Registry) ───────────────────────────────────────────────────

@router.post("/agents")
@limiter.limit("20/minute")
async def register_agent(req: RegisterAgentRequest, request: Request,
                          current_user: dict = Depends(get_superuser)):
    name = sanitize_text(req.name, max_length=100, field_name="name")
    role = sanitize_text(req.role, max_length=100, field_name="role")
    description = sanitize_text(req.description, max_length=1000, field_name="description")
    try:
        agent = await registry.register_agent(
            name=name, role=role, description=description,
            capabilities=req.capabilities, model=req.model,
        )
        return agent
    except Exception as e:
        logger.error("forgeos: register_agent failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to register agent")


@router.get("/agents")
async def list_agents(status: Optional[str] = None,
                       current_user: dict = Depends(get_superuser)):
    return await registry.list_agents(status=status)


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: int, current_user: dict = Depends(get_superuser)):
    agent = await registry.get_agent(agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent


# ── Missions (Mission Engine) ─────────────────────────────────────────────────

@router.post("/missions")
@limiter.limit("20/minute")
async def create_mission(req: CreateMissionRequest, request: Request,
                          current_user: dict = Depends(get_superuser)):
    title = sanitize_text(req.title, max_length=200, field_name="title")
    description = sanitize_text(req.description, max_length=8000, field_name="description")
    try:
        mission = await missions.create_mission(
            title=title, description=description,
            agent_id=req.agent_id, agent_name=req.agent_name,
            input_data=req.input, requires_approval=req.requires_approval,
            created_by=current_user["id"],
        )
        return mission
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("forgeos: create_mission failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to create mission")


@router.get("/missions")
async def list_missions(status: Optional[str] = None, limit: int = 50,
                         current_user: dict = Depends(get_superuser)):
    return await missions.list_missions(status=status, limit=limit)


@router.get("/missions/{mission_id}")
async def get_mission_status(mission_id: int, current_user: dict = Depends(get_superuser)):
    mission = await missions.get_mission(mission_id)
    if not mission:
        raise HTTPException(404, "Mission not found")
    return mission


# ── Workflows (Workflow Engine) ───────────────────────────────────────────────

@router.post("/workflows")
@limiter.limit("20/minute")
async def create_workflow(req: CreateWorkflowRequest, request: Request,
                           current_user: dict = Depends(get_superuser)):
    try:
        workflow = await workflows.create_workflow(
            mission_id=req.mission_id, name=req.name,
            steps=[s.model_dump() for s in req.steps],
        )
        return workflow
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("forgeos: create_workflow failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to create workflow")


@router.get("/workflows/{workflow_id}")
async def get_workflow_status(workflow_id: int, current_user: dict = Depends(get_superuser)):
    workflow = await workflows.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    return workflow


# ── Events (Event Bus) ────────────────────────────────────────────────────────

@router.post("/events")
@limiter.limit("60/minute")
async def publish_event(req: PublishEventRequest, request: Request,
                         current_user: dict = Depends(get_superuser)):
    topic = sanitize_text(req.topic, max_length=200, field_name="topic")
    try:
        return await bus.publish(topic, req.payload, source=f"user:{current_user['id']}")
    except Exception as e:
        logger.error("forgeos: publish_event failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to publish event")


@router.get("/events")
async def list_events(topic: Optional[str] = None, limit: int = 50,
                       current_user: dict = Depends(get_superuser)):
    return await recent_events(topic=topic, limit=limit)


# ── Approvals (Approval Engine) ───────────────────────────────────────────────

@router.get("/approvals")
async def list_approvals(status: Optional[str] = None,
                          current_user: dict = Depends(get_superuser)):
    return await approvals.list_approvals(status=status)


@router.post("/approvals/{approval_id}/approve")
@limiter.limit("30/minute")
async def approve_approval(approval_id: int, request: Request,
                            current_user: dict = Depends(get_superuser)):
    try:
        return await approvals.approve(approval_id, reviewer_id=current_user["id"])
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("forgeos: approve failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to approve")


@router.post("/approvals/{approval_id}/reject")
@limiter.limit("30/minute")
async def reject_approval(approval_id: int, req: ApprovalDecisionRequest, request: Request,
                           current_user: dict = Depends(get_superuser)):
    try:
        return await approvals.reject(approval_id, reviewer_id=current_user["id"], reason=req.reason)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("forgeos: reject failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to reject")


# ── Command Center (dashboard, deployments, audit log, live stream) ──────────
# All superuser-only: real revenue + AI-cost figures must never reach a
# non-admin user, and the SSE stream re-broadcasts that same snapshot data.

@router.get("/dashboard")
async def get_dashboard(current_user: dict = Depends(get_superuser)):
    try:
        return await dashboard.get_dashboard_snapshot()
    except Exception as e:
        logger.error("forgeos: get_dashboard_snapshot failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to load dashboard")


@router.get("/deployments")
async def get_deployments(force_refresh: bool = False,
                           current_user: dict = Depends(get_superuser)):
    try:
        return await github.get_deployment_status(force_refresh=force_refresh)
    except Exception as e:
        logger.error("forgeos: get_deployment_status failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to load deployment status")


@router.get("/audit-log")
async def get_audit_log(action: Optional[str] = None, target_type: Optional[str] = None,
                         limit: int = 100, current_user: dict = Depends(get_superuser)):
    try:
        return await audit.list_audit_log(action=action, target_type=target_type, limit=limit)
    except Exception as e:
        logger.error("forgeos: list_audit_log failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to load audit log")


# SSE snapshot refresh cadence — keeps Revenue/AI-Cost/Deployments widgets
# fresh even during quiet periods with no discrete mission/workflow events.
_STREAM_SNAPSHOT_INTERVAL_SECONDS = 20
_STREAM_HEARTBEAT_SECONDS = 15


@router.get("/stream")
async def stream_command_center(request: Request, current_user: dict = Depends(get_superuser)):
    """Server-Sent Events feed for the /forgeos Command Center: emits a full
    dashboard snapshot immediately, then a live event for every ForgeOS
    mission/workflow event as it happens, plus a periodic snapshot refresh so
    widgets fed by slower-moving sources (revenue, AI cost, deployments)
    don't go stale between discrete events. Browser EventSource must be
    created with {withCredentials: true} so the httpOnly auth cookie rides
    along (this app is cookie-first auth)."""
    queue = bus.subscribe("*")

    async def generate():
        def sse(event_type: str, data: dict) -> str:
            return f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"

        try:
            snapshot = await dashboard.get_dashboard_snapshot()
            yield sse("snapshot", snapshot)
        except Exception as e:
            logger.error("forgeos: initial stream snapshot failed: %s", e, exc_info=True)

        last_snapshot_at = asyncio.get_running_loop().time()
        try:
            while True:
                if await request.is_disconnected():
                    break
                timeout = max(0.1, _STREAM_HEARTBEAT_SECONDS)
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=timeout)
                    yield sse("event", event)
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"

                now = asyncio.get_running_loop().time()
                if now - last_snapshot_at >= _STREAM_SNAPSHOT_INTERVAL_SECONDS:
                    last_snapshot_at = now
                    try:
                        snapshot = await dashboard.get_dashboard_snapshot()
                        yield sse("snapshot", snapshot)
                    except Exception as e:
                        logger.error("forgeos: periodic stream snapshot failed: %s", e, exc_info=True)
        finally:
            bus.unsubscribe("*", queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
