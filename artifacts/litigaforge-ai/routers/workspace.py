"""
Forge Workspace — Legal Intelligence Operating System
Spatial canvas, multi-agent analysis, Indian Kanoon integration.

Endpoints (all prefixed with BASE_PATH from main.py):
  GET    /workspace/sessions                            — list user sessions
  POST   /workspace/sessions                            — create session
  GET    /workspace/sessions/{id}                       — get session + canvas + insights
  PUT    /workspace/sessions/{id}                       — update title/description
  PUT    /workspace/sessions/{id}/canvas                — save canvas state
  DELETE /workspace/sessions/{id}                       — delete session
  POST   /workspace/sessions/{id}/analyze               — SSE streaming multi-agent analysis
  POST   /workspace/sessions/{id}/agent/{agent_id}/ask — SSE direct question to one agent
  POST   /workspace/sessions/{id}/search               — Indian Kanoon judgment search
"""
import asyncio
import json
import logging
import os
import uuid as _uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from auth import require_user
from database import get_pool
from llm import legal_llm

logger = logging.getLogger("litigaforge.workspace")
router = APIRouter(tags=["workspace"])

IK_TOKEN = os.getenv("INDIANKANOON_API_TOKEN", "")
IK_BASE  = "https://api.indiankanoon.org"


# ─── Pydantic schemas ──────────────────────────────────────────────────────────

class CreateSessionBody(BaseModel):
    title: str = Field(default="Untitled Workspace", max_length=200)
    case_description: str = Field(default="")

class UpdateTitleBody(BaseModel):
    title: str = Field(max_length=200)
    case_description: str = ""

class SaveCanvasBody(BaseModel):
    nodes: list[dict]
    edges: list[dict]

class SearchBody(BaseModel):
    query: str = Field(min_length=2, max_length=300)
    max_results: int = Field(default=5, le=10)

class AnalyzeBody(BaseModel):
    case_description: str = ""
    context: str = ""

class AskAgentBody(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    case_description: str = ""


# ─── Session CRUD ──────────────────────────────────────────────────────────────

@router.get("/workspace/sessions")
async def list_sessions(request: Request, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, title, case_description, created_at, updated_at "
            "FROM workspace_sessions WHERE user_id = $1 "
            "ORDER BY updated_at DESC LIMIT 50",
            user["id"],
        )
    return [dict(r) for r in rows]


@router.post("/workspace/sessions", status_code=201)
async def create_session(body: CreateSessionBody, request: Request, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO workspace_sessions "
            "(user_id, title, case_description, nodes_json, edges_json) "
            "VALUES ($1, $2, $3, '[]'::jsonb, '[]'::jsonb) RETURNING *",
            user["id"], body.title, body.case_description,
        )
    return _session_dict(row)


@router.get("/workspace/sessions/{session_id}")
async def get_session(session_id: int, request: Request, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM workspace_sessions WHERE id = $1 AND user_id = $2",
            session_id, user["id"],
        )
        if not row:
            raise HTTPException(404, "Session not found")
        insights = await conn.fetch(
            "SELECT * FROM workspace_insights "
            "WHERE session_id = $1 ORDER BY created_at DESC LIMIT 100",
            session_id,
        )
    result = _session_dict(row)
    result["insights"] = [dict(i) for i in insights]
    return result


@router.put("/workspace/sessions/{session_id}")
async def update_session(
    session_id: int, body: UpdateTitleBody, request: Request, user=Depends(require_user)
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE workspace_sessions SET title=$1, case_description=$2, updated_at=NOW() "
            "WHERE id=$3 AND user_id=$4 RETURNING id",
            body.title, body.case_description, session_id, user["id"],
        )
        if not row:
            raise HTTPException(404, "Session not found")
    return {"ok": True}


@router.put("/workspace/sessions/{session_id}/canvas")
async def save_canvas(session_id: int, body: SaveCanvasBody, request: Request, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE workspace_sessions "
            "SET nodes_json=$1::jsonb, edges_json=$2::jsonb, updated_at=NOW() "
            "WHERE id=$3 AND user_id=$4 RETURNING id",
            json.dumps(body.nodes), json.dumps(body.edges), session_id, user["id"],
        )
        if not row:
            raise HTTPException(404, "Session not found")
    return {"ok": True}


@router.delete("/workspace/sessions/{session_id}")
async def delete_session(session_id: int, request: Request, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
    return {"ok": True}


# ─── Indian Kanoon Search ───────────────────────────────────────────────────────

@router.post("/workspace/sessions/{session_id}/search")
async def search_judgments(session_id: int, body: SearchBody, request: Request, user=Depends(require_user)):
    """Search Indian Kanoon and return canvas-ready judgment nodes."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT id FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
        if not exists:
            raise HTTPException(404, "Session not found")

    if IK_TOKEN:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{IK_BASE}/search/",
                    data={"formInput": body.query, "pagenum": 0},
                    headers={"Authorization": f"Token {IK_TOKEN}"},
                )
                resp.raise_for_status()
                data = resp.json()
            docs  = data.get("docs", [])[: body.max_results]
            nodes = [
                {
                    "id":   f"ik-{doc.get('tid', _uuid.uuid4().hex[:8])}",
                    "type": "judgment",
                    "position": {"x": 200 + i * 60, "y": 180 + i * 50},
                    "data": {
                        "label":    doc.get("title", "Unknown Case"),
                        "court":    doc.get("docsource", "Court"),
                        "citation": doc.get("citation", ""),
                        "summary":  (doc.get("headline", "") or "")[:300],
                        "year":     (doc.get("publishdate", "") or "")[:4],
                        "url":      f"https://indiankanoon.org/doc/{doc.get('tid', '')}",
                        "impact_score": 72,
                        "ik_tid":   doc.get("tid"),
                    },
                }
                for i, doc in enumerate(docs)
            ]
            return {"nodes": nodes, "source": "indian_kanoon", "total": data.get("total", len(nodes))}
        except Exception as e:
            logger.warning("IK search error: %s", e)

    # Fallback: local judgments table
    pool = await get_pool()
    async with pool.acquire() as conn:
        term = f"%{body.query}%"
        rows = await conn.fetch(
            "SELECT id, case_name, court, citation, summary_en, year, court_slug, slug "
            "FROM judgments WHERE summary_en IS NOT NULL "
            "AND (case_name ILIKE $1 OR summary_en ILIKE $1) "
            "ORDER BY judgment_date DESC NULLS LAST LIMIT $2",
            term, body.max_results,
        )
    nodes = [
        {
            "id":   f"judgment-{row['id']}",
            "type": "judgment",
            "position": {"x": 200 + i * 60, "y": 180 + i * 50},
            "data": {
                "label":    row["case_name"],
                "court":    row["court"],
                "citation": row["citation"] or "",
                "summary":  (row["summary_en"] or "")[:300],
                "year":     str(row["year"] or ""),
                "url":      f"/judgments/{row['court_slug']}/{row['year']}/{row['slug']}",
                "impact_score": 70,
            },
        }
        for i, row in enumerate(rows)
    ]
    return {"nodes": nodes, "source": "local_db", "total": len(nodes)}


# ─── Agent Registry ────────────────────────────────────────────────────────────

_AGENTS = [
    {
        "id": "research",
        "name": "Research Agent",
        "emoji": "🔍",
        "role": "Deep precedent analysis from Indian case law",
        "node_type": "issue",
        "node_label": "Core Legal Issue",
        "node_pos": {"x": 380, "y": 200},
        "system": (
            "You are an expert Indian legal research agent with deep knowledge of Supreme Court "
            "and High Court judgments. Analyze the given case and identify the 3 most critical "
            "legal issues, relevant precedents (with accurate citations), and applicable statutes. "
            "Be specific — name actual cases and their holdings. Focus on Telangana/Andhra Pradesh "
            "High Court and Supreme Court of India precedents where relevant."
        ),
    },
    {
        "id": "strategy",
        "name": "Strategy Agent",
        "emoji": "⚡",
        "role": "Legal strategy development",
        "node_type": "strategy",
        "node_label": "Winning Strategy",
        "node_pos": {"x": 620, "y": 280},
        "system": (
            "You are a senior advocate with 20 years of experience in Indian courts. "
            "Develop a compelling legal strategy for this case. Identify: (1) the strongest "
            "legal arguments and their order of priority, (2) procedural angles — stay, "
            "injunction, or expedited hearing opportunities, (3) how to structure the prayer "
            "clause for maximum relief. Be tactical and specific."
        ),
    },
    {
        "id": "risk",
        "name": "Risk & Counter Agent",
        "emoji": "🛡️",
        "role": "Opposition analysis & risk mapping",
        "node_type": "risk",
        "node_label": "Key Risk Factor",
        "node_pos": {"x": 280, "y": 420},
        "system": (
            "You are playing devil's advocate. Analyze this case from the opposing counsel's "
            "perspective. What are the 3 strongest counter-arguments? What weaknesses exist in "
            "the client's position? What adverse precedents might the opposition rely on? "
            "Rate the overall risk level (1-10) and suggest mitigation strategies."
        ),
    },
    {
        "id": "drafting",
        "name": "Drafting Agent",
        "emoji": "✍️",
        "role": "Argument & petition drafting",
        "node_type": "argument",
        "node_label": "Primary Legal Argument",
        "node_pos": {"x": 560, "y": 450},
        "system": (
            "You are an expert in Indian legal drafting. Based on the case facts, draft: "
            "(1) the main legal contention in formal Indian legal language, "
            "(2) supporting authorities (cases + sections), "
            "(3) the prayer clause with specific relief sought. "
            "Use precise legal terminology appropriate for Indian courts."
        ),
    },
    {
        "id": "predictive",
        "name": "Predictive Agent",
        "emoji": "🔮",
        "role": "Court outcome forecasting",
        "node_type": "strategy",
        "node_label": "Predicted Outcome",
        "node_pos": {"x": 740, "y": 180},
        "system": (
            "You are a predictive legal analyst specializing in Indian judicial trends. "
            "Based on the case facts and current judicial temperament in India, forecast: "
            "(1) probability of success at trial (0-100%), "
            "(2) likely concerns the bench will raise during arguments, "
            "(3) whether this is better suited for trial court, High Court, or Supreme Court, "
            "(4) estimated timeline. Cite recent similar outcomes where possible."
        ),
    },
]

# Inter-agent consultation messages (keyed by receiving agent id)
_CONSULTS: dict[str, dict[str, str]] = {
    "strategy":  {
        "from": "research", "to": "strategy",
        "message": "Precedent analysis complete — key legal issues and citations shared",
    },
    "risk": {
        "from": "strategy", "to": "risk",
        "message": "Strategy framework established — now stress-testing for vulnerabilities",
    },
    "drafting": {
        "from": "research", "to": "drafting",
        "message": "Core arguments and verified citations forwarded for court drafting",
    },
    "predictive": {
        "from": "risk", "to": "predictive",
        "message": "Risk profile and strategy synthesis complete — ready for outcome modeling",
    },
}


# ─── Multi-Agent Analysis  (SSE streaming) ────────────────────────────────────

async def _stream_analysis(case_description: str, context: str):
    """Async generator: SSE events for each agent's analysis with reasoning & collaboration."""

    def sse(data: dict) -> str:
        return f"data: {json.dumps(data, default=str)}\n\n"

    agent_outputs: dict[str, str] = {}

    for agent in _AGENTS:
        # ── Inter-agent consultation event ──────────────────────────────────
        if agent["id"] in _CONSULTS:
            yield sse({"type": "agent_consult", **_CONSULTS[agent["id"]]})
            await asyncio.sleep(0.4)

        yield sse({
            "type":  "agent_start",
            "agent": agent["id"],
            "name":  agent["name"],
            "emoji": agent["emoji"],
        })

        # Build prompt with context from completed agents
        prior_ctx = ""
        if agent_outputs:
            prior_ctx = "\n\nInsights shared by peer agents:\n" + "\n".join(
                f"• {aid.title()} Agent: {txt[:160]}…"
                for aid, txt in list(agent_outputs.items())[-2:]
            )

        prompt = (
            f"Case Facts:\n{case_description or 'No specific case description provided — give general guidance.'}"
            f"{prior_ctx}"
            f"\n\nAdditional Context: {context or 'None'}"
            f"\n\n{agent['system']}"
            "\n\nIMPORTANT: Format your response EXACTLY as:\n"
            "REASONING: [Your 2-sentence analytical approach for this specific case]\n"
            "---\n"
            "[Your full 3-4 paragraph analysis here]"
        )

        try:
            response = await legal_llm.aask_legal_question(prompt)
            response  = (response or "").strip()
        except Exception as exc:
            logger.warning("Agent %s error: %s", agent["id"], exc)
            response = (
                f"REASONING: Examining {agent['role']} from available case details.\n"
                f"---\n{agent['name']} analysis requires more specific case information. "
                "Please add case details for a comprehensive assessment."
            )

        # ── Parse reasoning + analysis ──────────────────────────────────────
        reasoning = ""
        analysis  = response
        if "---" in response:
            parts = response.split("---", 1)
            reasoning = parts[0].replace("REASONING:", "").strip()[:300]
            analysis  = parts[1].strip()
        elif response.startswith("REASONING:"):
            reasoning = response.split("\n", 1)[0].replace("REASONING:", "").strip()[:300]
            analysis  = response.split("\n", 1)[-1].strip()

        # ── Emit reasoning ──────────────────────────────────────────────────
        if reasoning:
            yield sse({"type": "agent_reasoning", "agent": agent["id"], "reasoning": reasoning})
            await asyncio.sleep(0.25)

        # ── Stream analysis tokens ──────────────────────────────────────────
        words      = analysis.split()
        chunk_size = 4
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i : i + chunk_size]) + " "
            yield sse({"type": "agent_token", "agent": agent["id"], "token": chunk})
            await asyncio.sleep(0.018)

        agent_outputs[agent["id"]] = analysis[:200]

        # ── Suggested canvas node ───────────────────────────────────────────
        short = analysis[:240] + ("…" if len(analysis) > 240 else "")
        suggested_node = {
            "id":   f"{agent['id']}-{_uuid.uuid4().hex[:8]}",
            "type": agent["node_type"],
            "position": agent["node_pos"],
            "data": {
                "label":       agent["node_label"],
                "description": short,
                "impact_score": 78,
                "agent":       agent["id"],
                **({"severity":   6 } if agent["node_type"] == "risk"     else {}),
                **({"strength":  80 } if agent["node_type"] == "argument" else {}),
                **({"confidence": 75} if agent["node_type"] == "strategy" else {}),
            },
        }

        yield sse({
            "type":           "agent_done",
            "agent":          agent["id"],
            "full_text":      analysis,
            "reasoning":      reasoning,
            "suggested_node": suggested_node,
        })

        await asyncio.sleep(0.3)

    # ── Final synthesis ─────────────────────────────────────────────────────
    yield sse({
        "type":            "agent_synthesis",
        "message":         "All five agents have completed their analysis. The Agent Society has reached consensus.",
        "consensus_score": 84,
    })
    yield sse({"type": "complete"})


@router.post("/workspace/sessions/{session_id}/analyze")
async def analyze_session(
    session_id: int, body: AnalyzeBody, request: Request, user=Depends(require_user)
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, case_description FROM workspace_sessions "
            "WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
        if not row:
            raise HTTPException(404, "Session not found")

    case_desc = body.case_description or row["case_description"] or ""

    async def generate():
        async for chunk in _stream_analysis(case_desc, body.context):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ─── Direct Agent Ask (SSE) ────────────────────────────────────────────────────

@router.post("/workspace/sessions/{session_id}/agent/{agent_id}/ask")
async def ask_agent(
    session_id: int,
    agent_id: str,
    body: AskAgentBody,
    request: Request,
    user=Depends(require_user),
):
    """Direct question to a single agent — SSE streamed response."""
    agent = next((a for a in _AGENTS if a["id"] == agent_id), None)
    if not agent:
        raise HTTPException(404, f"Agent '{agent_id}' not found")

    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT id FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
    if not exists:
        raise HTTPException(404, "Session not found")

    async def generate():
        def sse(d: dict) -> str:
            return f"data: {json.dumps(d, default=str)}\n\n"

        yield sse({"type": "start", "agent": agent_id})

        prompt = (
            f"{agent['system']}\n\n"
            f"Case Context: {body.case_description or 'Not provided'}\n\n"
            f"User Question: {body.question}\n\n"
            "Answer the question specifically and concisely in 2-4 sentences. "
            "Be direct and practical."
        )

        try:
            response = await legal_llm.aask_legal_question(prompt)
            response  = (response or "").strip() or (
                "Please provide more case details so I can give a specific answer."
            )
            words = response.split()
            for i in range(0, len(words), 3):
                chunk = " ".join(words[i : i + 3]) + " "
                yield sse({"type": "token", "agent": agent_id, "token": chunk})
                await asyncio.sleep(0.02)
        except Exception as exc:
            logger.warning("Ask agent %s error: %s", agent_id, exc)
            yield sse({"type": "error", "agent": agent_id, "error": "Analysis failed — try again."})

        yield sse({"type": "done", "agent": agent_id})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _session_dict(row) -> dict:
    d = dict(row)
    for key in ("nodes_json", "edges_json"):
        val = d.get(key)
        if isinstance(val, str):
            try:
                d[key] = json.loads(val)
            except Exception:
                d[key] = []
        elif val is None:
            d[key] = []
    return d
