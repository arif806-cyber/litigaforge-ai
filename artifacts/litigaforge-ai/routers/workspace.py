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
import hashlib
import json
import logging
import os
import re as _re
import time
import uuid as _uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import ai_brain as _ai_brain

from auth import require_user
from database import get_pool
from llm import legal_llm
from llm.config import LEGAL_SYSTEM_PROMPT as _LEGAL_SYSTEM_PROMPT
from case_law_search import search_case_law

logger = logging.getLogger("litigaforge.workspace")
router = APIRouter(tags=["workspace"])
_FIRST_PROVIDER_WAIT_SECONDS = 8
_SSE_HEARTBEAT_SECONDS = 5

IK_TOKEN = os.getenv("INDIANKANOON_API_TOKEN", "")
IK_BASE  = "https://api.indiankanoon.org"


async def _await_provider_with_heartbeats(awaitable):
    """Yield heartbeats while awaiting one bounded provider response."""
    task = asyncio.create_task(awaitable)
    loop = asyncio.get_running_loop()
    deadline = loop.time() + _FIRST_PROVIDER_WAIT_SECONDS
    try:
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise asyncio.TimeoutError("provider first-token timeout")
            try:
                result = await asyncio.wait_for(
                    asyncio.shield(task),
                    timeout=min(_SSE_HEARTBEAT_SECONDS, remaining),
                )
                yield "result", result
                return
            except asyncio.TimeoutError:
                if loop.time() >= deadline:
                    raise
                yield "heartbeat", None
    finally:
        if not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


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

class SmartSearchBody(BaseModel):
    case_description: str = ""
    nodes: list[dict] = Field(default_factory=list)
    query: str = ""          # optional explicit override; empty = LLM extracts

class AnalyzeBody(BaseModel):
    case_description: str = ""
    context: str = ""

class AskAgentBody(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    case_description: str = ""

class CreateFolderBody(BaseModel):
    folder_name: str = Field(default="New Case Folder", max_length=300)
    case_description: str = ""
    session_id: int | None = None

class RenameFolderBody(BaseModel):
    folder_name: str = Field(min_length=1, max_length=300)

class SuggestFeeBody(BaseModel):
    case_description: str = ""
    case_type: str = ""


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


# ─── Indian Kanoon — Ranking helpers ──────────────────────────────────────────

_COURT_AUTHORITY: dict[str, int] = {
    "supreme court of india": 100,
    "supreme court":          100,
    "high court":              72,
    "national commission":     58,
    "state commission":        46,
    "tribunal":                48,
    "district court":          32,
    "consumer court":          36,
}


def _court_authority_score(doc: dict) -> int:
    src = (doc.get("docsource") or "").lower()
    for key, val in _COURT_AUTHORITY.items():
        if key in src:
            return val
    return 40


def _recency_score(doc: dict) -> int:
    date_str = ((doc.get("publishdate") or doc.get("date") or ""))[:4]
    try:
        age = datetime.now(timezone.utc).year - int(date_str)
        if age <= 1:  return 20
        if age <= 3:  return 15
        if age <= 5:  return 10
        if age <= 10: return 5
        if age > 40:  return -5
        return 2
    except ValueError:
        return 0


def _citation_score(doc: dict) -> int:
    n = int(doc.get("numciting") or 0)
    if n > 1000: return 20
    if n > 500:  return 15
    if n > 100:  return 10
    if n > 20:   return 5
    return 0


def _compute_impact_score(doc: dict) -> int:
    authority = _court_authority_score(doc)
    authority_delta = (authority - 40) // 3        # 0-20
    score = 50 + authority_delta + _recency_score(doc) + _citation_score(doc)
    return max(30, min(98, score))


async def _cached_ik_search(conn, query: str, max_results: int = 8) -> list[dict]:
    """Search IK API with 24 h DB caching keyed by normalised query hash."""
    qhash = hashlib.md5(query.lower().strip().encode()).hexdigest()

    # Cache hit?
    row = await conn.fetchrow(
        "SELECT results_json, fetched_at FROM ikanoon_search_cache WHERE query_hash=$1",
        qhash,
    )
    if row:
        age = datetime.now(timezone.utc) - row["fetched_at"]
        if age < timedelta(hours=24):
            await conn.execute(
                "UPDATE ikanoon_search_cache SET hit_count = hit_count + 1 WHERE query_hash=$1",
                qhash,
            )
            return list(row["results_json"])[:max_results]

    if not IK_TOKEN:
        return []

    # Live fetch
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{IK_BASE}/search/",
                data={"formInput": query, "pagenum": 0},
                headers={"Authorization": f"Token {IK_TOKEN}"},
            )
            resp.raise_for_status()
            docs: list[dict] = resp.json().get("docs", [])[:10]
    except Exception as exc:
        logger.warning("IK API error for %r: %s", query, exc)
        return []

    # Upsert cache
    try:
        await conn.execute(
            """
            INSERT INTO ikanoon_search_cache (query_hash, query_text, results_json)
            VALUES ($1, $2, $3::jsonb)
            ON CONFLICT (query_hash) DO UPDATE
                SET results_json = EXCLUDED.results_json,
                    fetched_at   = NOW(),
                    hit_count    = 0
            """,
            qhash, query, json.dumps(docs),
        )
    except Exception as exc:
        logger.warning("IK cache write: %s", exc)

    return docs[:max_results]


def _doc_to_node(doc: dict, idx: int = 0, query: str = "") -> dict:
    """Convert IK search result dict to canvas-ready judgment node."""
    tid      = doc.get("tid") or doc.get("docid") or _uuid.uuid4().hex[:8]
    score    = _compute_impact_score(doc)
    date_str = (doc.get("publishdate") or doc.get("date") or "")
    year     = date_str[:4] if date_str else ""
    headline = _re.sub(r"<[^>]+>", "", doc.get("headline") or "")[:300]
    return {
        "id":       f"ik-{tid}",
        "type":     "judgment",
        "position": {"x": 200 + idx * 60, "y": 180 + idx * 50},
        "data": {
            "label":        (doc.get("title") or "Unknown Case")[:90],
            "court":        doc.get("docsource") or "Court",
            "citation":     doc.get("citation") or "",
            "summary":      headline,
            "year":         year,
            "url":          f"https://indiankanoon.org/doc/{tid}/",
            "impact_score": score,
            "ik_tid":       tid,
            "num_citing":   int(doc.get("numciting") or 0),
            "search_query": query[:60] if query else "",
        },
    }


# ─── Indian Kanoon — Manual Search ────────────────────────────────────────────

@router.post("/workspace/sessions/{session_id}/search")
async def search_judgments(
    session_id: int, body: SearchBody, request: Request, user=Depends(require_user)
):
    """Search Indian Kanoon with caching + intelligent ranking."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT id FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
        if not exists:
            raise HTTPException(404, "Session not found")

        search = await search_case_law(conn, body.query, limit=body.max_results)
    nodes = [
        {
            "id":       f"judgment-{row['id']}",
            "type":     "judgment",
            "position": {"x": 200 + i * 60, "y": 180 + i * 50},
            "data": {
                "label":        row["case_name"],
                "court":        row["court"],
                "citation":     row["citation"] or "",
                "summary":      (row["summary_en"] or "")[:300],
                "year":         str(row["year"] or ""),
                "url":          row["url"],
                "impact_score": 70,
                "num_citing":   row.get("num_citing", 0),
                "source":       row["source"],
            },
        }
        for i, row in enumerate(search["results"])
    ]
    return {"nodes": nodes, "source": search["source"], "total": len(nodes)}


# ─── Indian Kanoon — Smart Search (SSE) ───────────────────────────────────────

@router.post("/workspace/sessions/{session_id}/smart-search")
async def workspace_smart_search(
    session_id: int, body: SmartSearchBody, request: Request, user=Depends(require_user)
):
    """SSE streaming smart search — LLM extracts queries from canvas + ranks by authority/recency/citations."""
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

        # ── Step 1: Determine search queries ────────────────────────────────
        if body.query.strip():
            queries = [body.query.strip()]
            yield sse({"type": "ss_queries", "queries": queries})
        else:
            yield sse({"type": "ss_phase", "message": "Extracting key legal issues from your canvas…"})

            node_labels = [
                n.get("data", {}).get("label", "")
                for n in body.nodes[:8] if isinstance(n.get("data"), dict)
            ]
            node_types  = list({n.get("type", "") for n in body.nodes[:8]})
            canvas_text = ", ".join(filter(None, node_labels)) or "not specified"

            prompt = (
                f"Case: {body.case_description or 'Not specified'}\n"
                f"Canvas node types: {', '.join(node_types)}\n"
                f"Canvas items: {canvas_text}\n\n"
                "Generate exactly 2 targeted Indian Kanoon search queries for this legal matter.\n"
                "Rules:\n"
                "- One query per line, no numbering or punctuation\n"
                "- Each query targets a different legal dimension (e.g. one for precedents, one for specific issue)\n"
                "- Include court name when relevant (Supreme Court / High Court + state)\n"
                "- Use precise legal terminology from Indian law\n"
                "- Keep each query under 10 words\n"
                "Examples:\n"
                "Article 21 personal liberty arbitrary detention Supreme Court\n"
                "property adverse possession title dispute Telangana High Court"
            )
            try:
                raw     = (await legal_llm.aask_legal_question(prompt) or "").strip()
                queries = [l.strip() for l in raw.splitlines() if l.strip()][:3]
            except Exception:
                queries = []

            if not queries:
                queries = [l for l in node_labels[:2] if l] or [
                    (body.case_description or "Indian law Supreme Court")[:80]
                ]

            yield sse({"type": "ss_queries", "queries": queries})

        # ── Step 2: Execute each query (cached) ─────────────────────────────
        all_docs: list[dict] = []
        seen_tids: set[str]  = set()

        pool2 = await get_pool()
        for q_idx, query in enumerate(queries):
            yield sse({
                "type":        "ss_searching",
                "message":     f"Searching Indian Kanoon — '{query[:55]}'…",
                "query_index": q_idx,
                "query_total": len(queries),
            })

            async with pool2.acquire() as conn:
                docs = await _cached_ik_search(conn, query, max_results=8)

            new_docs = []
            for doc in docs:
                tid = str(doc.get("tid") or doc.get("docid") or "")
                if tid and tid not in seen_tids:
                    seen_tids.add(tid)
                    doc["_query"] = query
                    new_docs.append(doc)

            all_docs.extend(new_docs)

            # Stream these results immediately so UI can show them as they arrive
            nodes_chunk = [_doc_to_node(d, i, d.get("_query", "")) for i, d in enumerate(new_docs)]
            if nodes_chunk:
                yield sse({"type": "ss_results", "nodes": nodes_chunk, "query": query})
            await asyncio.sleep(0.05)

        # ── Step 3: Re-rank all collected results ────────────────────────────
        yield sse({"type": "ss_phase",
                   "message": f"Ranking {len(all_docs)} judgments by authority, recency & citation count…"})

        ranked  = sorted(all_docs, key=_compute_impact_score, reverse=True)
        final   = [_doc_to_node(d, i, d.get("_query", "")) for i, d in enumerate(ranked[:10])]

        yield sse({"type": "ss_complete", "nodes": final, "total": len(final)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Agent Registry ────────────────────────────────────────────────────────────

_AGENTS = [
    {
        "id": "research",
        "name": "Research Agent",
        "emoji": "🔍",
        "role": "Deep precedent analysis from Indian case law",
        "node_type": "issue",
        "node_label": "Core Legal Issue",
        "node_pos": {"x": 150, "y": 200},
        "system": (
            "You are an expert Indian legal research specialist with 25 years of experience "
            "in Supreme Court, High Court, and District Court practice. Give SPECIFIC, ACTIONABLE "
            "research — not generic guidance. This is for a real lawyer with a real case.\n\n"
            "STEP 1 — CASE CLASSIFICATION: Identify the PRIMARY legal category "
            "(motor accident / criminal / property / family / service / consumer / labour / "
            "commercial / constitutional / other) and the main applicable statute.\n\n"
            "STEP 2 — LEGAL FRAMEWORK: Break the case into parallel legal tracks. "
            "Example for motor accident: (a) Criminal — FIR + s.279/304A IPC; "
            "(b) Compensation — MACT claim u/s 166 Motor Vehicles Act; "
            "(c) Insurance — compulsory third-party policy claim. "
            "Adapt to the actual case type — name each track and its governing statute.\n\n"
            "STEP 3 — KEY JUDGMENTS: Cite 3 to 5 REAL Supreme Court or High Court "
            "judgments directly relevant to these specific facts. For each: "
            "Case Name v. Party (Year, Court) — one sentence on what it held and why "
            "it DIRECTLY helps THIS case. Use well-known binding Indian precedents.\n\n"
            "STEP 4 — FIRST STEPS: Numbered list of 3 to 5 immediate actions the lawyer "
            "must take RIGHT NOW. Each step must cite a specific statute or section. "
            "Example: '1. File MACT petition u/s 166 Motor Vehicles Act at District "
            "Motor Accidents Claims Tribunal within 3 years of accident date.'\n\n"
            "OUTPUT FORMAT (use EXACTLY these labels):\n"
            "CASE TYPE: [Identified category and primary applicable statute]\n"
            "LEGAL FRAMEWORK: [Track 1 — Statute / Track 2 — Statute / Track 3 — Statute]\n"
            "KEY JUDGMENTS: [Case Name (Year, Court) — one-line holding relevant to this case]\n"
            "FIRST STEPS: [1. Specific action with statute  2. Next step  3. Next step]"
        ),
    },
    {
        "id": "strategy",
        "name": "Strategy Agent",
        "emoji": "⚡",
        "role": "Legal strategy development",
        "node_type": "strategy",
        "node_label": "Winning Strategy",
        "node_pos": {"x": 560, "y": 120},
        "system": (
            "You are a senior advocate with 20 years of experience in Indian courts. "
            "Develop a compelling legal strategy for this case. Identify: (1) the strongest "
            "legal arguments and their order of priority, (2) procedural angles — stay, "
            "injunction, or expedited hearing opportunities, (3) how to structure the prayer "
            "clause for maximum relief. Be tactical and specific.\n\n"
            "OUTPUT FORMAT:\n"
            "PRIMARY ARGUMENT: [The single strongest legal argument, its priority, and why it wins]\n"
            "PROCEDURAL ANGLE: [Stay / injunction / expedited hearing opportunities and how to seek them]\n"
            "PRAYER CLAUSE: [Specific relief sought, in formal Indian court language]"
        ),
    },
    {
        "id": "risk",
        "name": "Risk & Counter Agent",
        "emoji": "🛡️",
        "role": "Opposition analysis & risk mapping",
        "node_type": "risk",
        "node_label": "Key Risk Factor",
        "node_pos": {"x": 150, "y": 460},
        "system": (
            "You are playing devil's advocate. Analyze this case from the opposing counsel's "
            "perspective. What are the 3 strongest counter-arguments? What weaknesses exist in "
            "the client's position? What adverse precedents might the opposition rely on? "
            "Rate the overall risk level (1-10) and suggest mitigation strategies.\n\n"
            "OUTPUT FORMAT:\n"
            "RISK LEVEL: [1-10, where 10 is maximum risk]\n"
            "COUNTER-ARGUMENTS: [The 3 strongest arguments the opposing counsel will raise]\n"
            "ADVERSE PRECEDENTS: [Specific cases and holdings the opposition is likely to cite]"
        ),
    },
    {
        "id": "drafting",
        "name": "Drafting Agent",
        "emoji": "✍️",
        "role": "Argument & petition drafting",
        "node_type": "argument",
        "node_label": "Primary Legal Argument",
        "node_pos": {"x": 560, "y": 370},
        "system": (
            "You are an expert Indian legal drafting specialist creating a complete LAWYER PACKAGE "
            "for a practicing advocate in Telangana/Andhra Pradesh. The Research, Strategy, and "
            "Risk agents have already analysed this case — their outputs are provided as context. "
            "Build directly on their specific findings. Apply BNS 2023, BNSS 2023, Motor Vehicles "
            "Act (as amended), and current Telangana/AP court procedures.\n\n"
            "Generate the following 5 package sections:\n\n"
            "EXECUTIVE SUMMARY: Case classification (category + primary forum); primary legal "
            "strategy with clear reasoning; parallel legal tracks where applicable (e.g., Criminal "
            "+ MACT + Insurance); governing statutes and limitation periods; overall risk level and "
            "main counter-arguments from the Risk Agent; top 5 immediate priority actions for the lawyer\n\n"
            "CLIENT ADVISORY: One plain-language paragraph (no legalese, max 150 words). "
            "Explain what happened legally in simple terms, what the lawyer will do, what documents "
            "the client must provide with deadlines, and the expected timeline. "
            "Write as a note from the lawyer to the client.\n\n"
            "DOCUMENT CHECKLIST: All required documents organized by forum — "
            "(a) Police Station: [document | who provides | how to obtain]; "
            "(b) Court/Tribunal: [document | who provides | how to obtain]; "
            "(c) Government Office/Others: [document | who provides | how to obtain]. "
            "Mark [PRIORITY] on any document urgently required.\n\n"
            "ACTION PLAN: Phase-by-phase roadmap with deadlines — "
            "Phase 1 (0-48 hrs) emergency steps; "
            "Phase 2 (Day 1-7) investigation and collection; "
            "Phase 3 (Day 7-30) pre-filing preparation; "
            "Phase 4 (Filing) petition and accompanying docs; "
            "Phase 5 (Post-filing) appearance and hearing preparation. "
            "Each action MUST cite a specific statute or section and include any limitation period.\n\n"
            "DRAFT PETITION: Complete court-ready draft of the main petition/application with: "
            "proper cause title (court name + parties), factual background, legal submissions citing "
            "specific sections, prayer clause with all reliefs sought, verification/affidavit block. "
            "Use [PLACEHOLDER] for case-specific details to be filled in. "
            "Note stamp duty and court fee requirements under relevant state rules.\n\n"
            "FEE RECOMMENDATION: Based on this case type and complexity, suggest 3 fee tiers "
            "for a Hyderabad/Telangana advocate (2024-25 market rates). Each tier on one line: "
            "Conservative (Rs. X): [what this covers, e.g., statutory MACT scheme only] | "
            "Standard (Rs. Y): [recommended for this complexity level] | "
            "Premium (Rs. Z): [full contested senior-advocate representation]. "
            "Be case-specific -- not generic. Use realistic Hyderabad bar rates.\n\n"
            "OUTPUT FORMAT — use EXACTLY these 6 section headings:\n"
            "EXECUTIVE SUMMARY: [...]\n"
            "CLIENT ADVISORY: [...]\n"
            "DOCUMENT CHECKLIST: [...]\n"
            "ACTION PLAN: [...]\n"
            "DRAFT PETITION: [...]\n"
            "FEE RECOMMENDATION: [...]"
        ),
    },
    {
        "id": "predictive",
        "name": "Predictive Agent",
        "emoji": "🔮",
        "role": "Court outcome forecasting",
        "node_type": "strategy",
        "node_label": "Predicted Outcome",
        "node_pos": {"x": 920, "y": 200},
        "system": (
            "You are a predictive legal analyst specializing in Indian judicial trends. "
            "Based on the case facts and current judicial temperament in India, forecast: "
            "(1) probability of success at trial (0-100%), "
            "(2) likely concerns the bench will raise during arguments, "
            "(3) whether this is better suited for trial court, High Court, or Supreme Court, "
            "(4) estimated timeline. Cite recent similar outcomes where possible.\n\n"
            "OUTPUT FORMAT:\n"
            "SUCCESS PROBABILITY: [0-100]%\n"
            "BENCH CONCERNS: [Specific concerns the bench is likely to raise during arguments]\n"
            "FORUM: [Most appropriate forum — Trial Court / High Court / Supreme Court — and why]\n"
            "TIMELINE: [Realistic estimated duration to resolution at the recommended forum]"
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


# ─── IK prompt helpers ────────────────────────────────────────────────────────

def _build_ik_query(case_description: str) -> str:
    """Build a compact IndianKanoon search query from the case description.
    Pure function — no LLM call, no async.
    """
    words = (case_description or "").split()[:10]
    base  = " ".join(words)
    suffix = "Telangana OR Andhra Pradesh OR Supreme Court"
    return (f"{base} {suffix}")[:100].strip()


def _format_ik_for_prompt(docs: list[dict]) -> str:
    """Format IK search results as an injected prompt block for the Research Agent."""
    lines = [
        "=== Live Indian Kanoon Results (real judgments fetched via API — "
        "cite these in KEY JUDGMENTS) ===",
    ]
    for i, doc in enumerate(docs, 1):
        title    = (doc.get("title") or "Unknown Case")[:90]
        court    = doc.get("docsource") or "Court"
        date_str = doc.get("publishdate") or doc.get("date") or ""
        year     = date_str[:4] if date_str else ""
        tid      = doc.get("tid") or doc.get("docid") or ""
        headline = _re.sub(r"<[^>]+>", "", doc.get("headline") or "")[:200]
        year_part = f" | {year}" if year else ""
        tid_part  = f" | ID: {tid}" if tid else ""
        lines.append(f"{i}. {title} | {court}{year_part}{tid_part}")
        if headline:
            lines.append(f"   Summary: {headline}")
    lines.append(
        "Use ONLY the cases above for the KEY JUDGMENTS section. Do not invent citations."
    )
    return "\n".join(lines)


# ─── Case Folder — auto-create after analysis ─────────────────────────────────

async def _auto_create_case_folder(
    user_id: int,
    session_id: int,
    case_desc: str,
    drafting_text: str,
    agent_outputs: dict | None = None,
) -> dict | None:
    """Create a case folder and auto-save all lawyer docs after analysis completes."""
    import sys as _sys
    safe = _re.sub(r"[^A-Za-z0-9\s]", "", case_desc or "Untitled Case")
    slug = "_".join(safe.split()[:5]) or "Untitled_Case"
    date_tag    = datetime.now(timezone.utc).strftime("%Y%m%d")
    folder_name = f"{slug}_{date_tag}"[:120]

    ai_dir = os.path.dirname(os.path.dirname(__file__))

    pool = await get_pool()
    async with pool.acquire() as conn:
        folder_row = await conn.fetchrow(
            "INSERT INTO case_folders (user_id, session_id, folder_name, case_description) "
            "VALUES ($1, $2, $3, $4) RETURNING id, folder_name",
            user_id, session_id, folder_name, (case_desc or "")[:1000],
        )
        folder_id  = folder_row["id"]
        base_dir   = os.path.dirname(os.path.dirname(__file__))
        folder_dir = os.path.join(base_dir, "uploads", "folders", str(folder_id))
        os.makedirs(folder_dir, exist_ok=True)

        if ai_dir not in _sys.path:
            _sys.path.insert(0, ai_dir)

        file_count = 0

        # ── 1. Lawyer Package PDF (from Drafting Agent) ───────────────────
        if drafting_text:
            try:
                from pdf_generator import generate_lawyer_package_pdf
                pdf_bytes = generate_lawyer_package_pdf(
                    case_description=case_desc,
                    drafting_text=drafting_text,
                )
                pdf_fn   = f"Lawyer_Package_{date_tag}.pdf"
                pdf_path = os.path.join(folder_dir, pdf_fn)
                with open(pdf_path, "wb") as fh:
                    fh.write(pdf_bytes)
                await conn.execute(
                    "INSERT INTO folder_documents "
                    "(folder_id, filename, doc_type, file_path, file_size_bytes) "
                    "VALUES ($1, $2, $3, $4, $5)",
                    folder_id, pdf_fn, "lawyer_package", pdf_path, len(pdf_bytes),
                )
                file_count += 1
            except Exception as _pe:
                logger.warning("Auto-save Lawyer Package PDF failed: %s", _pe)

        # ── 2. Full Analysis Report PDF (all 5 agents) ────────────────────
        outputs = agent_outputs or {}
        if outputs:
            try:
                from pdf_generator import generate_analysis_report_pdf
                rpt_bytes = generate_analysis_report_pdf(
                    case_description=case_desc,
                    agent_outputs=outputs,
                )
                rpt_fn   = f"Analysis_Report_{date_tag}.pdf"
                rpt_path = os.path.join(folder_dir, rpt_fn)
                with open(rpt_path, "wb") as fh:
                    fh.write(rpt_bytes)
                await conn.execute(
                    "INSERT INTO folder_documents "
                    "(folder_id, filename, doc_type, file_path, file_size_bytes) "
                    "VALUES ($1, $2, $3, $4, $5)",
                    folder_id, rpt_fn, "analysis_report", rpt_path, len(rpt_bytes),
                )
                file_count += 1
            except Exception as _re2:
                logger.warning("Auto-save Analysis Report PDF failed: %s", _re2)

        # ── 3. Vakalatnama PDF ─────────────────────────────────────────────
        try:
            from pdf_generator import generate_vakalatnama_pdf
            vak_bytes = generate_vakalatnama_pdf(case_description=case_desc)
            vak_fn    = f"Vakalatnama_{date_tag}.pdf"
            vak_path  = os.path.join(folder_dir, vak_fn)
            with open(vak_path, "wb") as fh:
                fh.write(vak_bytes)
            await conn.execute(
                "INSERT INTO folder_documents "
                "(folder_id, filename, doc_type, file_path, file_size_bytes) "
                "VALUES ($1, $2, $3, $4, $5)",
                folder_id, vak_fn, "vakalatnama", vak_path, len(vak_bytes),
            )
            file_count += 1
        except Exception as _ve:
            logger.warning("Auto-save Vakalatnama PDF failed: %s", _ve)

    return {"id": folder_id, "name": folder_name, "file_count": file_count}


# ─── Multi-Agent Analysis  (SSE streaming) ────────────────────────────────────

async def _stream_analysis(case_description: str, context: str, profile_ctx: str = ""):
    """Async generator: SSE events for each agent's analysis with reasoning & collaboration."""

    def sse(data: dict) -> str:
        return f"data: {json.dumps(data, default=str)}\n\n"

    agent_outputs: dict[str, str] = {}
    agent_outputs_full: dict[str, str] = {}

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
            if agent["id"] == "drafting" and agent_outputs_full:
                # Drafting (Lawyer Package) gets full outputs from ALL previous agents
                prior_ctx = "\n\n=== Previous Agent Outputs (incorporate into Lawyer Package) ===\n" + "\n\n".join(
                    f"--- {aid.upper()} AGENT ---\n{txt[:600]}"
                    for aid, txt in agent_outputs_full.items()
                )
            else:
                prior_ctx = "\n\nInsights shared by peer agents:\n" + "\n".join(
                    f"• {aid.title()} Agent: {txt[:160]}…"
                    for aid, txt in list(agent_outputs.items())[-2:]
                )

        profile_line = f"\n\nUser Style Preference: {profile_ctx}" if profile_ctx else ""
        if agent["id"] == "drafting":
            format_instruction = (
                "\n\nIMPORTANT: Format your response EXACTLY as:\n"
                "REASONING: [2-sentence summary of your package drafting approach for this case]\n"
                "---\n"
                "[Full Lawyer Package: all 6 sections — EXECUTIVE SUMMARY, CLIENT ADVISORY, "
                "DOCUMENT CHECKLIST, ACTION PLAN, DRAFT PETITION, FEE RECOMMENDATION — as specified in the system prompt]"
            )
        else:
            format_instruction = (
                "\n\nIMPORTANT: Format your response EXACTLY as:\n"
                "REASONING: [Your 2-sentence analytical approach for this specific case]\n"
                "---\n"
                "[Your full 3-4 paragraph analysis here]"
            )
        prompt = (
            f"Case Facts:\n{case_description or 'No specific case description provided — give general guidance.'}"
            f"{prior_ctx}"
            f"\n\nAdditional Context: {context or 'None'}"
            f"{profile_line}"
            f"\n\n{agent['system']}"
            f"{format_instruction}"
        )

        # ── IK pre-fetch: inject real live judgments for Research Agent ──────
        if agent["id"] == "research" and IK_TOKEN:
            ik_query = _build_ik_query(case_description)
            try:
                _pool_ik = await get_pool()
                async with _pool_ik.acquire() as _conn:
                    ik_docs = await _cached_ik_search(_conn, ik_query, max_results=5)
                if ik_docs:
                    ik_block = _format_ik_for_prompt(ik_docs)
                    prompt = ik_block + "\n\n" + prompt
                    yield sse({"type": "ik_fetched", "count": len(ik_docs), "query": ik_query})
                    logger.info(
                        "IK pre-fetch: %d judgments injected into Research Agent prompt (query: %s)",
                        len(ik_docs), ik_query[:60],
                    )
            except Exception as _ik_exc:
                logger.warning("IK pre-fetch for Research Agent failed: %s", _ik_exc)

        try:
            response = ""
            async for event, value in _await_provider_with_heartbeats(
                legal_llm.aask_legal_question(prompt)
            ):
                if event == "heartbeat":
                    yield ": heartbeat\n\n"
                else:
                    response = (value or "").strip()
        except Exception as _primary_exc:
            logger.warning(
                "Agent %s — LiteLLM error (%s: %s); trying ai_brain cascade",
                agent["id"], type(_primary_exc).__name__, _primary_exc,
            )
            yield sse({"type": "provider_error", "agent": agent["id"],
                       "error": "Primary analysis provider was unavailable; trying fallback."})
            # ── Fallback: ai_brain Claude → Gemini → Groq cascade ────────────
            try:
                async for event, value in _await_provider_with_heartbeats(
                    _ai_brain.call_llm_async(
                        _LEGAL_SYSTEM_PROMPT, prompt, temperature=0.3, max_tokens=2000,
                    )
                ):
                    if event == "heartbeat":
                        yield ": heartbeat\n\n"
                    else:
                        response = (value or "").strip()
            except Exception as _fallback_exc:
                logger.warning("Agent %s — ai_brain cascade also failed: %s", agent["id"], _fallback_exc)
                response = ""
        if not response:
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
        agent_outputs_full[agent["id"]] = analysis

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

    # ── Agree/Disagree detection ────────────────────────────────────────────
    risk_level: int | None   = None
    success_prob: int | None = None

    for line in agent_outputs_full.get("risk", "").splitlines():
        m = _re.match(r"RISK LEVEL:\s*(\d+)", line.strip())
        if m:
            risk_level = int(m.group(1))
            break

    for line in agent_outputs_full.get("predictive", "").splitlines():
        m = _re.match(r"SUCCESS PROBABILITY:\s*(\d+)", line.strip())
        if m:
            success_prob = int(m.group(1))
            break

    if risk_level is not None and success_prob is not None:
        if risk_level <= 4 and success_prob >= 65:
            yield sse({"type": "agent_agree", "a": "risk", "b": "predictive", "label": "Aligned on outcome"})
        elif risk_level >= 7 and success_prob >= 65:
            yield sse({"type": "agent_disagree", "a": "risk", "b": "predictive", "label": "Risk vs. Optimism conflict"})

    # Text overlap check: shared case references between research and drafting
    _CASE_PATTERN = _re.compile(r'[A-Z][A-Za-z .]{3,20}v\.?\s+[A-Z][A-Za-z .]{3,20}')
    research_cases = {m.group().strip().lower() for m in _CASE_PATTERN.finditer(agent_outputs_full.get("research", ""))}
    drafting_cases  = {m.group().strip().lower() for m in _CASE_PATTERN.finditer(agent_outputs_full.get("drafting",  ""))}
    if research_cases & drafting_cases:
        yield sse({"type": "agent_agree", "a": "research", "b": "drafting", "label": "Shared precedent basis"})

    # ── Final synthesis — dynamic consensus score ────────────────────────────
    total_chars = sum(len(txt) for txt in agent_outputs.values())
    completeness = min(1.0, total_chars / (180 * max(1, len(_AGENTS))))
    case_bonus   = min(10, len(case_description) // 25) if case_description else 0
    consensus_score = min(97, max(62, round(72 + completeness * 20 + case_bonus)))
    yield sse({
        "type":            "agent_synthesis",
        "message":         "All five agents have completed their analysis. The Agent Society has reached consensus.",
        "consensus_score": consensus_score,
    })


@router.post("/workspace/sessions/{session_id}/analyze")
async def analyze_session(
    session_id: int, body: AnalyzeBody, request: Request, user=Depends(require_user)
):
    request_started = time.perf_counter()
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

    # Fetch personalization profile — only applied when learning is enabled (Step 1)
    profile_ctx = ""
    try:
        from routers.personalization import compute_profile, _profile_prompt_context
        async with pool.acquire() as pconn:
            prof_row = await pconn.fetchrow(
                "SELECT learning_enabled FROM user_profile WHERE user_id=$1", user["id"]
            )
            learning_enabled = prof_row["learning_enabled"] if prof_row else True
            if learning_enabled:
                evt_rows = await pconn.fetch(
                    "SELECT event_type, event_data FROM user_learning_events "
                    "WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
                    user["id"],
                )
                # Reverse DESC rows → chronological for compute_profile()
                events = [
                    {
                        "event_type": r["event_type"],
                        "data": json.loads(r["event_data"]) if r["event_data"] else {},
                    }
                    for r in reversed(evt_rows)
                ]
                if events:
                    computed    = compute_profile(events)
                    profile_ctx = _profile_prompt_context(computed)
    except Exception as _pe:
        logger.debug("Profile context skipped: %s", _pe)

    async def generate():
        def _sse(d: dict) -> str:
            return f"data: {json.dumps(d, default=str)}\n\n"

        # Emit before any provider work so reverse proxies and clients have a
        # prompt first byte. The heartbeat also keeps idle buffering at bay.
        logger.info(
            "workspace analyze first-byte session=%s user=%s ms=%d",
            session_id, user["id"], round((time.perf_counter() - request_started) * 1000),
        )
        yield _sse({"type": "start"})
        yield ": heartbeat\n\n"
        agent_outputs_all: dict[str, str] = {}
        try:
            async for chunk in _stream_analysis(case_desc, body.context, profile_ctx):
                yield chunk
                if '"agent_done"' in chunk:
                    try:
                        payload = json.loads(chunk.split("data: ", 1)[1])
                        if payload.get("type") == "agent_done" and payload.get("full_text"):
                            agent_outputs_all[payload.get("agent", "")] = payload["full_text"]
                    except Exception:
                        pass
            try:
                folder_info = await _auto_create_case_folder(
                    user_id=user["id"], session_id=session_id, case_desc=case_desc,
                    drafting_text=agent_outputs_all.get("drafting", ""), agent_outputs=agent_outputs_all,
                )
                if folder_info:
                    yield _sse({"type": "folder_created", "folder_id": folder_info["id"],
                                "folder_name": folder_info["name"], "file_count": folder_info["file_count"]})
            except Exception as _fe:
                logger.warning("Auto-folder creation failed: %s", _fe)
        except Exception as exc:
            logger.exception("Workspace analysis stream failed: %s", exc)
            yield _sse({"type": "error", "error": "Analysis ended unexpectedly."})
        finally:
            yield _sse({"type": "complete"})

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


# ─── Proactive Intelligence ───────────────────────────────────────────────────

class InsightsBody(BaseModel):
    case_description: str = ""
    nodes: list[dict] = Field(default_factory=list)
    context: str = ""


_INSIGHT_FALLBACKS = [
    {"id": "f1", "type": "step",      "emoji": "⚡",
     "text": "Add case facts as Fact nodes, then click ⚡ Analyze for specific AI guidance.",
     "detail": "Describe: FIR status, parties, date of incident, injuries, court, and relief sought. More facts = more specific output."},
    {"id": "f2", "type": "framework", "emoji": "🏛️",
     "text": "Break your matter into legal tracks: Criminal + Civil + Regulatory.",
     "detail": "Most Indian cases have parallel proceedings (e.g., criminal FIR + MACT compensation + insurance claim). Identify each track before building your argument map."},
    {"id": "f3", "type": "precedent", "emoji": "⚖️",
     "text": "Search Indian Kanoon for judgments matching your case facts.",
     "detail": "Open the Search tab and type key terms (e.g., 'MACT compensation unknown vehicle' or 'property partition Hindu law'). Drop matching judgments onto the canvas."},
    {"id": "f4", "type": "warning",   "emoji": "⚠️",
     "text": "Add your case description so AI can give case-specific guidance.",
     "detail": "Type the case description above (FIR details, parties, date, court, and what relief is sought). Without this, agents give only generic output."},
]


@router.post("/workspace/sessions/{session_id}/insights")
async def get_proactive_insights(
    session_id: int, body: InsightsBody, request: Request, user=Depends(require_user)
):
    """Generate proactive AI suggestions based on current canvas state."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT id FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
    if not exists:
        raise HTTPException(404, "Session not found")

    nodes = body.nodes[:12]
    if not nodes and not body.case_description:
        return {"suggestions": _INSIGHT_FALLBACKS}

    # Step 4: Compute suppressed suggestion types via compute_profile() so suggestion_reactivate
    # events are properly honoured (dismiss count reset to 0 on undo).
    suppressed_types: set[str] = set()
    try:
        from routers.personalization import compute_profile as _cp_supp
        async with pool.acquire() as sup_conn:
            sup_rows = await sup_conn.fetch(
                "SELECT event_type, event_data FROM user_learning_events "
                "WHERE user_id=$1 AND event_type IN ('suggestion_dismiss','suggestion_reactivate') "
                "ORDER BY created_at DESC LIMIT 300",
                user["id"],
            )
        # Reverse DESC rows → chronological for compute_profile() (reactivate resets properly)
        sup_events = [
            {
                "event_type": r["event_type"],
                "data": json.loads(r["event_data"]) if r["event_data"] else {},
            }
            for r in reversed(sup_rows)
        ]
        if sup_events:
            sup_computed = _cp_supp(sup_events)
            suppressed_types = {
                k for k, v in sup_computed.get("suggestion_dismisses", {}).items() if v >= 3
            }
    except Exception as _se:
        logger.debug("Suppression fetch skipped: %s", _se)

    node_summaries = "\n".join(
        f"  • [{n.get('type','node')}] {n.get('data',{}).get('label','Untitled')} — score {n.get('data',{}).get('impact_score',70)}"
        for n in nodes
    ) or "  (empty canvas)"

    context_line = f"Recent context: {body.context}\n" if body.context else ""
    case_words   = len((body.case_description or "").split())
    vague_hint   = (
        "\nNOTE: Case description is very short. Include 1 'warning' insight asking "
        "for specific missing facts (FIR number, injuries, vehicle details, parties, dates)."
        if case_words < 20 else ""
    )

    prompt = (
        f"Case: {body.case_description or 'Not specified'}\n"
        f"Canvas ({len(nodes)} nodes):\n{node_summaries}\n"
        f"{context_line}"
        f"{vague_hint}\n\n"
        "You are an expert Indian legal AI for real court practice (Telangana/AP focus).\n"
        "Generate exactly 4 ACTIONABLE suggestions for this specific case.\n"
        "Each suggestion must be SPECIFIC — cite statute sections, real case names, or numbered steps.\n\n"
        "OUTPUT FORMAT — output ONLY 4 pipe-separated lines:\n"
        "TYPE|EMOJI|SHORT_TEXT (<=100 chars)|DETAIL_TEXT (<=250 chars)\n\n"
        "TYPE options:\n"
        "  step      = a specific action the lawyer must take RIGHT NOW (cite the statute section)\n"
        "  framework = breakdown of the case into legal tracks (criminal+civil+insurance etc.)\n"
        "  precedent = a specific named Indian judgment supporting a key argument\n"
        "  warning   = a risk, limitation deadline, or missing fact the lawyer must not ignore\n"
        "  agent_rec = recommend a specific workspace agent; EMOJI = agent_emoji + space + agent_id\n"
        "              Agent IDs: research, strategy, risk, drafting, predictive\n\n"
        "RULES:\n"
        "- Always include at least 1 'step' with a specific statute section number\n"
        "- Always include at least 1 'precedent' with a real case name and year\n"
        "- For 'step': start with a verb (File, Apply, Obtain, Draft, Serve, Appear)\n"
        "- For 'precedent': cite the actual case name, year, and court\n"
        "- For 'framework': name each parallel legal track with its governing statute\n"
        "- If canvas has fewer than 2 nodes: first suggestion should be 'step' to add facts\n\n"
        "EXAMPLES:\n"
        "step|⚡|File MACT petition u/s 166 Motor Vehicles Act at District Tribunal|"
        "File within 3 years of accident. Claim from insurer + owner. FIR not required for s.166 MVA civil claim.\n"
        "framework|🏛️|3 tracks: Criminal (s.304A IPC) + MACT Compensation + Insurance Claim|"
        "Criminal: FIR to chargesheet to trial u/s 279 and 304A IPC. MACT: compensation u/s 166 MVA. Insurance: claim against compulsory motor policy.\n"
        "precedent|⚖️|Sarla Verma v. DTC (2009 SC) — structured MACT compensation formula|"
        "Supreme Court laid down standard multiplier method for motor accident compensation. Binding on all MACT courts in India.\n"
        "warning|⚠️|Limitation: MACT claim must be filed within 3 years of accident date|"
        "Under s.166(3) MVA, no time limit for filing — but courts have upheld 3-year guideline. File immediately to preserve all reliefs."
    )

    try:
        raw = (await legal_llm.aask_legal_question(prompt) or "").strip()
        suggestions = []
        for line in raw.splitlines():
            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 3:
                continue
            stype = parts[0].lower()
            if stype not in ("opportunity", "risk", "precedent", "pattern", "warning", "agent_rec", "step", "framework"):
                stype = "step"
            suggestions.append({
                "id":     _uuid.uuid4().hex[:8],
                "type":   stype,
                "emoji":  parts[1] or "💡",
                "text":   parts[2][:130],
                "detail": parts[3][:260] if len(parts) > 3 else "",
            })
            if len(suggestions) >= 4:
                break
        # Step 4: Downgrade suppressed types (not remove) — demote to end, cap at 1 slot
        if suppressed_types:
            normal  = [s for s in suggestions if s["type"] not in suppressed_types]
            demoted = [s for s in suggestions if s["type"] in suppressed_types]
            # Allow at most 1 demoted suggestion only when there is room (fewer than 3 normal)
            cap = 1 if len(normal) < 3 else 0
            suggestions = normal + demoted[:cap]
        return {"suggestions": suggestions or _INSIGHT_FALLBACKS}
    except Exception as exc:
        logger.warning("Insights error: %s", exc)
        return {"suggestions": _INSIGHT_FALLBACKS}


# ─── What-If Simulation (SSE) ─────────────────────────────────────────────────

class SimulateBody(BaseModel):
    assumption: str = Field(min_length=1, max_length=500)
    case_description: str = ""
    nodes: list[dict] = Field(default_factory=list)


@router.post("/workspace/sessions/{session_id}/simulate")
async def simulate_what_if(
    session_id: int, body: SimulateBody, request: Request, user=Depends(require_user)
):
    """SSE streaming What-If simulation with structured before/after comparison."""
    request_started = time.perf_counter()
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT id FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
    if not exists:
        raise HTTPException(404, "Session not found")

    nodes = body.nodes[:12]

    async def generate():
        def sse(d: dict) -> str:
            return f"data: {json.dumps(d, default=str)}\n\n"

        # ── Before state ────────────────────────────────────────────────────
        def score(node: dict) -> int:
            try:
                return int(node.get("data", {}).get("impact_score", 70))
            except (TypeError, ValueError):
                return 70

        scores = [score(n) for n in nodes if isinstance(n.get("data"), dict)]
        avg_before = int(sum(scores) / len(scores)) if scores else 70
        risk_before = "high" if avg_before < 60 else "medium" if avg_before < 75 else "low"

        logger.info(
            "workspace simulate first-byte session=%s user=%s ms=%d",
            session_id, user["id"], round((time.perf_counter() - request_started) * 1000),
        )
        yield sse({"type": "sim_start"})
        yield ": heartbeat\n\n"
        yield sse({"type": "sim_before", "avg_score": avg_before, "risk_level": risk_before, "node_count": len(nodes)})

        # ── Agent involvement ───────────────────────────────────────────────
        yield sse({"type": "sim_agent", "agent": "risk",     "message": "Risk & Counter Agent stress-testing the assumption…"})
        await asyncio.sleep(0.35)
        yield sse({"type": "sim_agent", "agent": "strategy", "message": "Strategy Agent modelling required adaptations…"})
        await asyncio.sleep(0.35)

        # ── LLM analysis ────────────────────────────────────────────────────
        node_summary = "\n".join(
            f"  • [{n.get('type','?')}] {n.get('data',{}).get('label','?')} (score: {score(n)})"
            for n in nodes
        ) or "  (no nodes on canvas)"

        prompt = (
            f"Case: {body.case_description or 'Legal case — no description provided'}\n"
            f"Canvas ({len(nodes)} nodes, avg score {avg_before}, risk {risk_before}):\n{node_summary}\n\n"
            f"WHAT-IF SCENARIO: {body.assumption}\n\n"
            "Analyze this hypothetical as Risk & Counter Agent + Strategy Agent.\n"
            "Respond EXACTLY in this format:\n"
            "SUMMARY: [2-3 sentence impact summary]\n"
            "RISK: high|medium|low\n"
            "SCORE_CHANGE: [-30 to +20, integer only, e.g. -12 or +8]\n"
            "RECOMMENDATION: [1-2 sentences — concrete next steps]\n"
            "NODE_CHANGES:\n"
            "- [exact node label]: [old_score]→[new_score] | [≤12 word reason]\n"
            "(up to 4 most impacted nodes)\n\n"
            "Be specific and proportional to scenario severity."
        )

        try:
            raw = ""
            async for event, value in _await_provider_with_heartbeats(
                legal_llm.aask_legal_question(prompt)
            ):
                if event == "heartbeat":
                    yield ": heartbeat\n\n"
                else:
                    raw = (value or "").strip()
        except Exception as exc:
            logger.warning("Simulate LLM error: %s", exc)
            yield sse({"type": "provider_error", "error": "Simulation provider was unavailable."})
            raw = (
                "SUMMARY: This scenario introduces significant uncertainty into the current strategy.\n"
                "RISK: high\nSCORE_CHANGE: -10\n"
                "RECOMMENDATION: Consult the Risk Agent to identify mitigation strategies.\n"
                "NODE_CHANGES:"
            )

        # ── Stream analysis tokens ───────────────────────────────────────────
        words = raw.split()
        for i in range(0, len(words), 5):
            yield sse({"type": "sim_token", "token": " ".join(words[i:i+5]) + " "})
            await asyncio.sleep(0.014)

        # ── Parse structured fields ──────────────────────────────────────────
        summary        = ""
        risk_after     = risk_before
        score_change   = 0
        recommendation = ""
        node_changes: list[dict] = []

        for line in raw.splitlines():
            line = line.strip()
            if line.startswith("SUMMARY:"):
                summary = line[8:].strip()
            elif line.startswith("RISK:"):
                r = line[5:].strip().lower()
                if r in ("high", "medium", "low"):
                    risk_after = r
            elif line.startswith("SCORE_CHANGE:"):
                try:
                    score_change = int(line[13:].strip().lstrip("+"))
                except ValueError:
                    score_change = -8
            elif line.startswith("RECOMMENDATION:"):
                recommendation = line[15:].strip()
            elif line.startswith("-") and "→" in line and "|" in line:
                try:
                    rest = line.lstrip("- ").strip()
                    colon_i = rest.rfind(":")
                    if colon_i == -1:
                        continue
                    label = rest[:colon_i].strip()
                    sp, reason = rest[colon_i+1:].strip().split("|", 1)
                    old_s, new_s = sp.strip().split("→")
                    node_changes.append({
                        "nodeLabel": label,
                        "oldScore":  int(old_s.strip()),
                        "newScore":  int(new_s.strip()),
                        "reason":    reason.strip(),
                    })
                except Exception:
                    continue

        avg_after = max(10, min(100, avg_before + score_change))

        yield sse({"type": "sim_delta", "deltas": node_changes})
        yield sse({
            "type":           "sim_after",
            "avg_score":      avg_after,
            "risk_level":     risk_after,
            "score_change":   score_change,
            "summary":        summary or raw[:300],
            "recommendation": recommendation,
        })
        yield sse({"type": "sim_complete"})
        yield sse({"type": "sim_end"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Agent Feedback ───────────────────────────────────────────────────────────

class FeedbackBody(BaseModel):
    vote: str  # "up" or "down"


@router.post("/workspace/sessions/{session_id}/agent/{agent_id}/feedback", status_code=200)
async def save_agent_feedback(
    session_id: int,
    agent_id: str,
    body: FeedbackBody,
    request: Request,
    user=Depends(require_user),
):
    """UPSERT thumbs-up/down vote for an agent's analysis in a session."""
    if body.vote not in ("up", "down"):
        raise HTTPException(400, "vote must be 'up' or 'down'")
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT id FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
        if not exists:
            raise HTTPException(404, "Session not found")
        await conn.execute(
            """
            INSERT INTO workspace_agent_feedback (session_id, agent_id, vote, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (session_id, agent_id)
            DO UPDATE SET vote = EXCLUDED.vote, updated_at = NOW()
            """,
            session_id, agent_id, body.vote,
        )
    return {"ok": True}


@router.get("/workspace/sessions/{session_id}/feedback")
async def get_session_feedback(
    session_id: int,
    request: Request,
    user=Depends(require_user),
):
    """Return {agent_id: vote} map of all saved feedback for this session."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT id FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
        if not exists:
            raise HTTPException(404, "Session not found")
        rows = await conn.fetch(
            "SELECT agent_id, vote FROM workspace_agent_feedback WHERE session_id=$1",
            session_id,
        )
    return {r["agent_id"]: r["vote"] for r in rows}


# ─── PDF Export ───────────────────────────────────────────────────────────────

class ExportPdfBody(BaseModel):
    drafting_text:    str = ""
    case_description: str = ""
    lawyer_name:      str = ""
    client_name:      str = ""


@router.post("/workspace/sessions/{session_id}/export-pdf")
async def export_lawyer_package_pdf(
    session_id: int, body: ExportPdfBody,
    request: Request, user=Depends(require_user),
):
    """Generate and stream a court-ready Lawyer Package PDF from the Drafting Agent output."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, case_description FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
    if not row:
        raise HTTPException(404, "Session not found")

    case_desc = body.case_description or (row["case_description"] or "")

    try:
        import sys, os as _os
        _ai_dir = _os.path.dirname(_os.path.dirname(__file__))
        if _ai_dir not in sys.path:
            sys.path.insert(0, _ai_dir)
        from pdf_generator import generate_lawyer_package_pdf
        pdf_bytes = generate_lawyer_package_pdf(
            case_description=case_desc,
            drafting_text=body.drafting_text,
            lawyer_name=body.lawyer_name,
            client_name=body.client_name,
        )
    except Exception as exc:
        logger.error("PDF generation error: %s", exc)
        raise HTTPException(500, "PDF generation failed")

    from fastapi.responses import Response as _Resp
    fname = f"LitigaForge_Package_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return _Resp(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


class InvoicePdfBody(BaseModel):
    client_name:        str = ""
    lawyer_name:        str = ""
    lawyer_firm:        str = ""
    lawyer_contact:     str = ""
    case_description:   str = ""
    amount:             float = 0
    payment_mode:       str = ""
    invoice_date:       str = ""
    case_type:          str = ""
    fee_tier:           str = "Standard"
    fee_recommendation: str = ""


@router.post("/workspace/sessions/{session_id}/invoice-pdf")
async def generate_invoice_pdf_endpoint(
    session_id: int, body: InvoicePdfBody,
    request: Request, user=Depends(require_user),
):
    """Generate and stream a 2-page professional invoice PDF."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT id FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
    if not exists:
        raise HTTPException(404, "Session not found")

    try:
        import sys, os as _os
        _ai_dir = _os.path.dirname(_os.path.dirname(__file__))
        if _ai_dir not in sys.path:
            sys.path.insert(0, _ai_dir)
        from pdf_generator import generate_invoice_pdf
        pdf_bytes = generate_invoice_pdf(
            client_name=body.client_name,
            lawyer_name=body.lawyer_name,
            lawyer_firm=body.lawyer_firm,
            lawyer_contact=body.lawyer_contact,
            case_description=body.case_description,
            amount=body.amount,
            payment_mode=body.payment_mode,
            invoice_date=body.invoice_date,
            case_type=body.case_type,
            fee_tier=body.fee_tier,
            fee_recommendation=body.fee_recommendation,
        )
    except Exception as exc:
        logger.error("Invoice PDF error: %s", exc)
        raise HTTPException(500, "Invoice generation failed")

    # ── Auto-save invoice to case folder (non-blocking) ──────────────────────
    try:
        async with pool.acquire() as _fconn:
            _frow = await _fconn.fetchrow(
                "SELECT id FROM case_folders WHERE session_id=$1 AND user_id=$2 "
                "ORDER BY created_at DESC LIMIT 1",
                session_id, user["id"],
            )
        if _frow:
            _fid  = _frow["id"]
            _fdir = os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                "uploads", "folders", str(_fid),
            )
            os.makedirs(_fdir, exist_ok=True)
            _safe_c = (body.client_name or "Client").replace(" ", "_")[:16]
            _inv_fn = f"Invoice_{_safe_c}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.pdf"
            _inv_p  = os.path.join(_fdir, _inv_fn)
            with open(_inv_p, "wb") as _fh:
                _fh.write(pdf_bytes)
            async with pool.acquire() as _fconn2:
                await _fconn2.execute(
                    "INSERT INTO folder_documents "
                    "(folder_id, filename, doc_type, file_path, file_size_bytes) "
                    "VALUES ($1, $2, $3, $4, $5)",
                    _fid, _inv_fn, "invoice", _inv_p, len(pdf_bytes),
                )
    except Exception as _sfe:
        logger.debug("Invoice auto-save to folder skipped: %s", _sfe)

    from fastapi.responses import Response as _Resp
    safe  = (body.client_name or "Client").replace(" ", "_")[:20]
    fname = f"LitigaForge_Invoice_{safe}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return _Resp(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ─── Case Folder CRUD ─────────────────────────────────────────────────────────

@router.get("/workspace/folders")
async def list_folders(
    request: Request,
    user=Depends(require_user),
    q: str = "",
):
    """List all case folders for the current user, optionally filtered by name."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if q:
            rows = await conn.fetch(
                "SELECT cf.id, cf.folder_name, cf.case_description, cf.session_id, "
                "       cf.created_at, cf.updated_at, COUNT(fd.id) AS file_count "
                "FROM case_folders cf "
                "LEFT JOIN folder_documents fd ON fd.folder_id = cf.id "
                "WHERE cf.user_id = $1 AND cf.folder_name ILIKE $2 "
                "GROUP BY cf.id ORDER BY cf.updated_at DESC LIMIT 100",
                user["id"], f"%{q}%",
            )
        else:
            rows = await conn.fetch(
                "SELECT cf.id, cf.folder_name, cf.case_description, cf.session_id, "
                "       cf.created_at, cf.updated_at, COUNT(fd.id) AS file_count "
                "FROM case_folders cf "
                "LEFT JOIN folder_documents fd ON fd.folder_id = cf.id "
                "WHERE cf.user_id = $1 "
                "GROUP BY cf.id ORDER BY cf.updated_at DESC LIMIT 100",
                user["id"],
            )
    return [dict(r) for r in rows]


@router.post("/workspace/folders", status_code=201)
async def create_folder(
    body: CreateFolderBody,
    request: Request,
    user=Depends(require_user),
):
    """Manually create a new case folder."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO case_folders (user_id, session_id, folder_name, case_description) "
            "VALUES ($1, $2, $3, $4) "
            "RETURNING id, folder_name, case_description, session_id, created_at, updated_at",
            user["id"], body.session_id, body.folder_name, body.case_description,
        )
    return {**dict(row), "file_count": 0}


@router.get("/workspace/folders/{folder_id}")
async def get_folder(
    folder_id: int,
    request: Request,
    user=Depends(require_user),
):
    """Get a single folder with all its document metadata."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        folder = await conn.fetchrow(
            "SELECT id, folder_name, case_description, session_id, created_at, updated_at "
            "FROM case_folders WHERE id=$1 AND user_id=$2",
            folder_id, user["id"],
        )
        if not folder:
            raise HTTPException(404, "Folder not found")
        files = await conn.fetch(
            "SELECT id, filename, doc_type, file_size_bytes, notes, created_at "
            "FROM folder_documents WHERE folder_id=$1 ORDER BY created_at DESC",
            folder_id,
        )
    return {**dict(folder), "files": [dict(f) for f in files]}


@router.patch("/workspace/folders/{folder_id}")
async def rename_folder(
    folder_id: int,
    body: RenameFolderBody,
    request: Request,
    user=Depends(require_user),
):
    """Rename a case folder."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE case_folders SET folder_name=$1, updated_at=NOW() "
            "WHERE id=$2 AND user_id=$3 RETURNING id, folder_name",
            body.folder_name, folder_id, user["id"],
        )
    if not row:
        raise HTTPException(404, "Folder not found")
    return {"ok": True, "folder_name": row["folder_name"]}


@router.delete("/workspace/folders/{folder_id}", status_code=200)
async def delete_folder(
    folder_id: int,
    request: Request,
    user=Depends(require_user),
):
    """Delete a case folder and all its files from disk and DB."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        folder = await conn.fetchrow(
            "SELECT id FROM case_folders WHERE id=$1 AND user_id=$2",
            folder_id, user["id"],
        )
        if not folder:
            raise HTTPException(404, "Folder not found")
        files = await conn.fetch(
            "SELECT file_path FROM folder_documents WHERE folder_id=$1", folder_id,
        )
        for f in files:
            try:
                os.remove(f["file_path"])
            except OSError:
                pass
        try:
            import shutil
            shutil.rmtree(
                os.path.join(
                    os.path.dirname(os.path.dirname(__file__)),
                    "uploads", "folders", str(folder_id),
                ),
                ignore_errors=True,
            )
        except Exception:
            pass
        await conn.execute(
            "DELETE FROM case_folders WHERE id=$1 AND user_id=$2", folder_id, user["id"],
        )
    return {"ok": True}


@router.get("/workspace/folders/{folder_id}/files/{file_id}/download")
async def download_folder_file(
    folder_id: int,
    file_id: int,
    request: Request,
    user=Depends(require_user),
):
    """Download a file from a case folder by ID."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        folder_ok = await conn.fetchval(
            "SELECT id FROM case_folders WHERE id=$1 AND user_id=$2", folder_id, user["id"],
        )
        if not folder_ok:
            raise HTTPException(404, "Folder not found")
        file_row = await conn.fetchrow(
            "SELECT filename, file_path FROM folder_documents WHERE id=$1 AND folder_id=$2",
            file_id, folder_id,
        )
    if not file_row:
        raise HTTPException(404, "File not found")
    fpath = file_row["file_path"]
    if not os.path.exists(fpath):
        raise HTTPException(404, "File not found on disk")
    with open(fpath, "rb") as fh:
        content = fh.read()
    from fastapi.responses import Response as _Resp
    media = (
        "application/pdf"
        if file_row["filename"].lower().endswith(".pdf")
        else "application/octet-stream"
    )
    return _Resp(
        content=content,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{file_row["filename"]}"'},
    )


@router.delete("/workspace/folders/{folder_id}/files/{file_id}", status_code=200)
async def delete_folder_file(
    folder_id: int,
    file_id: int,
    request: Request,
    user=Depends(require_user),
):
    """Delete a single file from a case folder."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        folder_ok = await conn.fetchval(
            "SELECT id FROM case_folders WHERE id=$1 AND user_id=$2", folder_id, user["id"],
        )
        if not folder_ok:
            raise HTTPException(404, "Folder not found")
        file_row = await conn.fetchrow(
            "SELECT file_path FROM folder_documents WHERE id=$1 AND folder_id=$2",
            file_id, folder_id,
        )
        if not file_row:
            raise HTTPException(404, "File not found")
        try:
            os.remove(file_row["file_path"])
        except OSError:
            pass
        await conn.execute(
            "DELETE FROM folder_documents WHERE id=$1 AND folder_id=$2", file_id, folder_id,
        )
    return {"ok": True}


# ─── AI Fee Suggestion ────────────────────────────────────────────────────────

@router.post("/workspace/sessions/{session_id}/suggest-fee")
async def suggest_fee(
    session_id: int,
    body: SuggestFeeBody,
    request: Request,
    user=Depends(require_user),
):
    """AI-powered professional fee suggestion based on case type & Hyderabad/Telangana market rates."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, case_description FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
    if not row:
        raise HTTPException(404, "Session not found")

    case_desc = body.case_description or row["case_description"] or ""
    case_type = body.case_type or ""

    prompt = (
        "You are a professional legal fee advisor for Hyderabad/Telangana, India.\n"
        f"Case type: {case_type or 'General civil/criminal matter'}\n"
        f"Case description: {case_desc[:600]}\n\n"
        "Suggest a professional fee range based on Hyderabad/Telangana advocate market rates.\n"
        "Consider: case complexity, appropriate forum (district/HC), retainer + per-hearing structure.\n\n"
        "OUTPUT — use ONLY these exact labels, one per line:\n"
        "COMPLEXITY: [low/medium/high]\n"
        "CONSERVATIVE: Rs. [amount]\n"
        "STANDARD: Rs. [amount]\n"
        "PREMIUM: Rs. [amount]\n"
        "BREAKDOWN: [2-sentence description of fee structure — retainer, per-hearing, success component]\n"
        "RATIONALE: [1-2 sentences explaining why this range fits this specific matter]"
    )

    _FB: dict[str, tuple] = {
        "mact":        ("medium", "25000",  "50000",  "100000"),
        "criminal":    ("medium", "15000",  "35000",   "75000"),
        "civil":       ("medium", "20000",  "40000",   "85000"),
        "consumer":    ("low",     "8000",  "15000",   "30000"),
        "property":    ("high",   "35000",  "75000",  "150000"),
        "matrimonial": ("medium", "25000",  "50000",  "100000"),
        "writ":        ("high",   "40000",  "80000",  "160000"),
        "cheque":      ("low",    "10000",  "20000",   "40000"),
        "labour":      ("medium", "20000",  "40000",   "80000"),
    }
    search_text = (case_type + " " + case_desc[:80]).lower()
    ct_key = next((k for k in _FB if k in search_text), "civil")
    fb = _FB[ct_key]

    try:
        raw = (await legal_llm.aask_legal_question(prompt) or "").strip()
    except Exception as _llm_exc:
        logger.warning("Fee suggestion LLM error: %s", _llm_exc)
        raw = (
            f"COMPLEXITY: {fb[0]}\n"
            f"CONSERVATIVE: Rs. {fb[1]}\n"
            f"STANDARD: Rs. {fb[2]}\n"
            f"PREMIUM: Rs. {fb[3]}\n"
            "BREAKDOWN: Advance retainer on instruction, per-hearing fee, and a final closure fee.\n"
            "RATIONALE: Based on standard Hyderabad district court rates for this case category."
        )

    result: dict = {"raw": raw, "case_type": case_type}
    for line in raw.splitlines():
        ln = line.strip()
        if ln.startswith("COMPLEXITY:"):
            result["complexity"]   = ln[11:].strip()
        elif ln.startswith("CONSERVATIVE:"):
            result["conservative"] = ln[13:].strip()
        elif ln.startswith("STANDARD:"):
            result["standard"]     = ln[9:].strip()
        elif ln.startswith("PREMIUM:"):
            result["premium"]      = ln[8:].strip()
        elif ln.startswith("BREAKDOWN:"):
            result["breakdown"]    = ln[10:].strip()
        elif ln.startswith("RATIONALE:"):
            result["rationale"]    = ln[10:].strip()

    std_line = result.get("standard", f"Rs. {fb[2]}")
    m = _re.search(r"[\d]+", std_line.replace(",", ""))
    try:
        result["suggested_amount"] = float(m.group()) if m else float(fb[2])
    except (ValueError, AttributeError):
        result["suggested_amount"] = float(fb[2])

    return result


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
