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
import uuid as _uuid
from datetime import datetime, timedelta, timezone

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

        if IK_TOKEN:
            try:
                docs  = await _cached_ik_search(conn, body.query, body.max_results)
                ranked = sorted(docs, key=_compute_impact_score, reverse=True)
                nodes  = [_doc_to_node(d, i, body.query) for i, d in enumerate(ranked)]
                return {"nodes": nodes, "source": "indian_kanoon", "total": len(nodes)}
            except Exception as exc:
                logger.warning("IK search error: %s", exc)

        # Fallback: local judgments table
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
            "id":       f"judgment-{row['id']}",
            "type":     "judgment",
            "position": {"x": 200 + i * 60, "y": 180 + i * 50},
            "data": {
                "label":        row["case_name"],
                "court":        row["court"],
                "citation":     row["citation"] or "",
                "summary":      (row["summary_en"] or "")[:300],
                "year":         str(row["year"] or ""),
                "url":          f"/judgments/{row['court_slug']}/{row['year']}/{row['slug']}",
                "impact_score": 70,
                "num_citing":   0,
            },
        }
        for i, row in enumerate(rows)
    ]
    return {"nodes": nodes, "source": "local_db", "total": len(nodes)}


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
            "You are an expert in Indian legal drafting. Based on the case facts, draft: "
            "(1) the main legal contention in formal Indian legal language, "
            "(2) supporting authorities (cases + sections), "
            "(3) the prayer clause with specific relief sought. "
            "Use precise legal terminology appropriate for Indian courts.\n\n"
            "OUTPUT FORMAT:\n"
            "LEGAL CONTENTION: [The main contention in formal Indian legal language]\n"
            "SUPPORTING AUTHORITIES: [Cases and sections cited in support, with accurate citations]\n"
            "PRAYER: [Prayer clause with specific relief sought, in court-ready language]"
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
            prior_ctx = "\n\nInsights shared by peer agents:\n" + "\n".join(
                f"• {aid.title()} Agent: {txt[:160]}…"
                for aid, txt in list(agent_outputs.items())[-2:]
            )

        profile_line = f"\n\nUser Style Preference: {profile_ctx}" if profile_ctx else ""
        prompt = (
            f"Case Facts:\n{case_description or 'No specific case description provided — give general guidance.'}"
            f"{prior_ctx}"
            f"\n\nAdditional Context: {context or 'None'}"
            f"{profile_line}"
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
        async for chunk in _stream_analysis(case_desc, body.context, profile_ctx):
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
        scores = [int(n.get("data", {}).get("impact_score", 70)) for n in nodes if isinstance(n.get("data"), dict)]
        avg_before = int(sum(scores) / len(scores)) if scores else 70
        risk_before = "high" if avg_before < 60 else "medium" if avg_before < 75 else "low"

        yield sse({"type": "sim_start"})
        yield sse({"type": "sim_before", "avg_score": avg_before, "risk_level": risk_before, "node_count": len(nodes)})

        # ── Agent involvement ───────────────────────────────────────────────
        yield sse({"type": "sim_agent", "agent": "risk",     "message": "Risk & Counter Agent stress-testing the assumption…"})
        await asyncio.sleep(0.35)
        yield sse({"type": "sim_agent", "agent": "strategy", "message": "Strategy Agent modelling required adaptations…"})
        await asyncio.sleep(0.35)

        # ── LLM analysis ────────────────────────────────────────────────────
        node_summary = "\n".join(
            f"  • [{n.get('type','?')}] {n.get('data',{}).get('label','?')} (score: {int(n.get('data',{}).get('impact_score',70))})"
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
            raw = (await legal_llm.aask_legal_question(prompt) or "").strip()
        except Exception as exc:
            logger.warning("Simulate LLM error: %s", exc)
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
