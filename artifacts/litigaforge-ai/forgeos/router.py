"""
ForgeOS REST API — mounted at {BASE_PATH}/forgeos, only when FORGEOS_ENABLED
is true. Agent registration and approval decisions are superuser-gated
(this is a live production app — an open agent-registration endpoint would
let anyone inject prompts into LLM calls run under ForgeOS's identity).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth import require_user, get_superuser
from logger import get_logger
from rate_limit import limiter
from sanitizer import sanitize_text

from forgeos import registry, missions, workflows, approvals
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
                       current_user: dict = Depends(require_user)):
    return await registry.list_agents(status=status)


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: int, current_user: dict = Depends(require_user)):
    agent = await registry.get_agent(agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent


# ── Missions (Mission Engine) ─────────────────────────────────────────────────

@router.post("/missions")
@limiter.limit("20/minute")
async def create_mission(req: CreateMissionRequest, request: Request,
                          current_user: dict = Depends(require_user)):
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
                         current_user: dict = Depends(require_user)):
    return await missions.list_missions(status=status, limit=limit)


@router.get("/missions/{mission_id}")
async def get_mission_status(mission_id: int, current_user: dict = Depends(require_user)):
    mission = await missions.get_mission(mission_id)
    if not mission:
        raise HTTPException(404, "Mission not found")
    return mission


# ── Workflows (Workflow Engine) ───────────────────────────────────────────────

@router.post("/workflows")
@limiter.limit("20/minute")
async def create_workflow(req: CreateWorkflowRequest, request: Request,
                           current_user: dict = Depends(require_user)):
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
async def get_workflow_status(workflow_id: int, current_user: dict = Depends(require_user)):
    workflow = await workflows.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    return workflow


# ── Events (Event Bus) ────────────────────────────────────────────────────────

@router.post("/events")
@limiter.limit("60/minute")
async def publish_event(req: PublishEventRequest, request: Request,
                         current_user: dict = Depends(require_user)):
    topic = sanitize_text(req.topic, max_length=200, field_name="topic")
    try:
        return await bus.publish(topic, req.payload, source=f"user:{current_user['id']}")
    except Exception as e:
        logger.error("forgeos: publish_event failed: %s", e, exc_info=True)
        raise HTTPException(500, "Failed to publish event")


@router.get("/events")
async def list_events(topic: Optional[str] = None, limit: int = 50,
                       current_user: dict = Depends(require_user)):
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
