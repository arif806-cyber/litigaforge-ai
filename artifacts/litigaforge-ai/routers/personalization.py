"""
Forge Workspace — Self-Improving Personalization Layer

Endpoints (all prefixed with BASE_PATH from main.py):
  POST   /workspace/profile/event          — record a learning event (fire-and-forget)
  GET    /workspace/profile                — get Personal Legal Twin profile
  PUT    /workspace/profile/settings       — toggle learning on/off
  DELETE /workspace/profile/reset          — wipe all learning data
  GET    /workspace/sessions/{id}/cross-matter — cross-matter connection analysis
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from auth import require_user
from database import get_pool

logger = logging.getLogger("litigaforge.personalization")
router = APIRouter(tags=["personalization"])

_ALL_AGENTS = ["research", "strategy", "risk", "drafting", "predictive"]

_AGENT_LABELS = {
    "research":   "Research",
    "strategy":   "Strategy",
    "risk":       "Risk & Counter",
    "drafting":   "Drafting",
    "predictive": "Predictive",
}

_AGENT_EMOJIS = {
    "research":   "🔍",
    "strategy":   "⚡",
    "risk":       "🛡️",
    "drafting":   "✍️",
    "predictive": "🔮",
}

_LEGAL_TERMS = [
    "property", "contract", "criminal", "family", "divorce", "custody",
    "cheque", "dishonour", "injunction", "stay", "appeal", "writ",
    "employment", "labour", "tax", "gst", "land", "eviction", "rent",
    "consumer", "defamation", "copyright", "trademark", "arbitration",
    "bank", "loan", "fraud", "breach", "negligence", "damages",
    "bail", "anticipatory", "contempt", "succession", "partition",
    "tenancy", "mortgage", "insurance", "accident", "compensation",
]

_PATTERN_INSIGHTS = {
    "judgment":  "You rely on precedent — your strongest analytical weapon.",
    "strategy":  "Strategic framing is your signature move.",
    "risk":      "You think like the opposition. That's rare.",
    "argument":  "Your drafting anchors every canvas. Keep it up.",
    "issue":     "You set the narrative early. Courts notice that.",
    "fact":      "You build from evidence up — solid foundation.",
}


# ─── Pydantic schemas ──────────────────────────────────────────────────────────

class LearningEventBody(BaseModel):
    event_type: str = Field(..., max_length=64)
    session_id: Optional[int] = None
    data: dict = Field(default_factory=dict)


class ProfileSettings(BaseModel):
    learning_enabled: bool


# ─── Core computation ─────────────────────────────────────────────────────────

def compute_profile(events: list[dict]) -> dict:
    """Derive preference weights from raw events. Pure function — no DB access."""
    agent_up:   dict[str, int] = {}
    agent_down: dict[str, int] = {}
    suggestion_accepts:  dict[str, int] = {}
    suggestion_dismisses: dict[str, int] = {}
    judgment_courts: dict[str, int] = {}
    node_types:      dict[str, int] = {}

    for ev in events:
        t = ev.get("event_type", "")
        d = ev.get("data") or {}

        if t == "agent_feedback":
            aid  = d.get("agent_id", "")
            vote = d.get("vote", "")
            if aid and vote == "up":
                agent_up[aid] = agent_up.get(aid, 0) + 1
            elif aid and vote == "down":
                agent_down[aid] = agent_down.get(aid, 0) + 1

        elif t == "suggestion_accept":
            st = d.get("suggestion_type", "other")
            suggestion_accepts[st] = suggestion_accepts.get(st, 0) + 1

        elif t == "suggestion_dismiss":
            st = d.get("suggestion_type", "other")
            suggestion_dismisses[st] = suggestion_dismisses.get(st, 0) + 1

        elif t == "judgment_add":
            court = d.get("court") or "Other"
            judgment_courts[court] = judgment_courts.get(court, 0) + 1

        elif t == "node_add":
            nt = d.get("node_type", "")
            if nt:
                node_types[nt] = node_types.get(nt, 0) + 1

    # Agent affinity: base 50, +12 per up-vote, -10 per down-vote, clamped 0-100
    agent_scores: dict[str, int] = {}
    for a in _ALL_AGENTS:
        score = 50 + agent_up.get(a, 0) * 12 - agent_down.get(a, 0) * 10
        agent_scores[a] = max(0, min(100, score))

    top_agent = max(agent_scores, key=lambda a: agent_scores[a]) if agent_scores else "research"

    return {
        "agent_scores":           agent_scores,
        "suggestion_accepts":     suggestion_accepts,
        "suggestion_dismisses":   suggestion_dismisses,
        "judgment_courts":        judgment_courts,
        "node_type_preferences":  node_types,
        "top_agent":              top_agent,
    }


def _twin_score(profile: dict, total_sessions: int, total_events: int, active_days: int) -> int:
    """0-100 twin training score."""
    session_pts = min(35, total_sessions * 5)
    event_pts   = min(40, total_events * 2)
    day_pts     = min(15, active_days * 3)
    variety_pts = min(10, len(profile.get("suggestion_accepts", {})) * 3)
    return min(100, session_pts + event_pts + day_pts + variety_pts)


def _profile_prompt_context(profile: dict) -> str:
    """Build a 1-3 sentence context string to inject into agent prompts."""
    agent_scores = profile.get("agent_scores", {})
    top_agent    = profile.get("top_agent", "research")
    accepts      = profile.get("suggestion_accepts", {})
    courts       = profile.get("judgment_courts", {})

    high_agents = [a for a in _ALL_AGENTS if agent_scores.get(a, 50) >= 65]

    parts = []
    if high_agents:
        label = _AGENT_LABELS.get(top_agent, top_agent.title())
        parts.append(f"User consistently values {label}-style depth — be precise and thorough in that dimension.")
    if accepts:
        top_accept = max(accepts, key=lambda k: accepts[k])
        type_map = {
            "opportunity": "identifying strategic opportunities",
            "risk":        "highlighting risks and counter-arguments",
            "precedent":   "citing specific case precedents",
            "pattern":     "finding argument patterns",
            "warning":     "flagging procedural warnings",
        }
        parts.append(f"User frequently engages with suggestions about {type_map.get(top_accept, top_accept)}.")
    if courts:
        top_court = max(courts, key=lambda k: courts[k])
        parts.append(f"User prefers {top_court} judgments — prioritise this forum's precedents where applicable.")

    return " ".join(parts)


def _generate_summary_insights(profile: dict, session_count: int) -> list[dict]:
    """Return a list of {emoji, text} natural-language insights for display in the Twin panel."""
    agent_scores = profile.get("agent_scores", {})
    top_agent    = profile.get("top_agent", "research")
    accepts      = profile.get("suggestion_accepts", {})
    dismisses    = profile.get("suggestion_dismisses", {})
    courts       = profile.get("judgment_courts", {})
    node_types   = profile.get("node_type_preferences", {})

    insights = []

    # Agent affinity
    high_agents = [a for a in _ALL_AGENTS if agent_scores.get(a, 50) >= 62]
    if high_agents:
        label = _AGENT_LABELS.get(top_agent, top_agent.title())
        emoji = _AGENT_EMOJIS.get(top_agent, "🤖")
        insights.append({
            "emoji": emoji,
            "text": f"You trust {label} analysis most — your ratings consistently favour its outputs.",
        })

    # Suggestion engagement
    total_accepts = sum(accepts.values())
    if total_accepts >= 1:
        top_type = max(accepts, key=lambda k: accepts[k])
        type_labels = {
            "opportunity": "strategic opportunities",
            "risk":        "risk flags",
            "precedent":   "precedent matches",
            "pattern":     "argument patterns",
            "warning":     "procedural warnings",
        }
        insights.append({
            "emoji": "✦",
            "text": (
                f"You've accepted {total_accepts} proactive suggestion"
                f"{'s' if total_accepts != 1 else ''}, favouring "
                f"{type_labels.get(top_type, top_type)} — the system surfaces these first."
            ),
        })

    # Court preference
    if courts:
        top_court = max(courts, key=lambda k: courts[k])
        cnt = courts[top_court]
        insights.append({
            "emoji": "⚖️",
            "text": (
                f"You most frequently work with {top_court} judgments "
                f"({cnt} added) — agents prioritise this forum's precedents."
            ),
        })

    # Canvas style
    if node_types:
        top_node = max(node_types, key=lambda k: node_types[k])
        node_labels = {
            "judgment":  "precedent-based arguments",
            "strategy":  "strategic framing",
            "risk":      "risk mapping",
            "argument":  "legal arguments",
            "issue":     "issue identification",
            "fact":      "evidence-first reasoning",
        }
        insights.append({
            "emoji": "🗺️",
            "text": (
                f"Your canvases are built around {node_labels.get(top_node, top_node + ' nodes')} — "
                "a systematic and precise working style."
            ),
        })

    # Session volume
    if session_count >= 3:
        insights.append({
            "emoji": "📂",
            "text": (
                f"You've worked on {session_count} matter"
                f"{'s' if session_count != 1 else ''} in Forge Workspace. "
                "Cross-matter connections are now active."
            ),
        })

    # Low-engagement nudge (constructive)
    low_agents = [a for a in _ALL_AGENTS if agent_scores.get(a, 50) <= 38]
    if low_agents and not high_agents:
        label = _AGENT_LABELS.get(low_agents[0], low_agents[0].title())
        insights.append({
            "emoji": "💡",
            "text": (
                f"You haven't rated {label} outputs yet. "
                "Try 👍/👎 to help the system calibrate its style."
            ),
        })

    return insights[:6]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/workspace/profile/event", status_code=204)
async def record_event(body: LearningEventBody, user=Depends(require_user)):
    """Fire-and-forget learning event. Returns 204 always."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Respect the user's learning preference
        row = await conn.fetchrow(
            "SELECT learning_enabled FROM user_profile WHERE user_id=$1", user["id"]
        )
        if row and not row["learning_enabled"]:
            return

        await conn.execute(
            """
            INSERT INTO user_learning_events (user_id, session_id, event_type, event_data)
            VALUES ($1, $2, $3, $4)
            """,
            user["id"],
            body.session_id,
            body.event_type,
            json.dumps(body.data),
        )


@router.get("/workspace/profile")
async def get_profile(user=Depends(require_user)):
    """Return the computed Personal Legal Twin profile."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT event_type, event_data, created_at
            FROM user_learning_events
            WHERE user_id=$1
            ORDER BY created_at DESC
            LIMIT 250
            """,
            user["id"],
        )
        events = [
            {
                "event_type": r["event_type"],
                "data": json.loads(r["event_data"]) if r["event_data"] else {},
                "date": r["created_at"].strftime("%Y-%m-%d"),
            }
            for r in rows
        ]

        session_count = (await conn.fetchval(
            "SELECT COUNT(*) FROM workspace_sessions WHERE user_id=$1", user["id"]
        )) or 0

        prof_row = await conn.fetchrow(
            "SELECT learning_enabled FROM user_profile WHERE user_id=$1", user["id"]
        )
        learning_enabled = prof_row["learning_enabled"] if prof_row else True

        computed    = compute_profile(events)
        unique_days = len({e["date"] for e in events[:100]})
        score       = _twin_score(computed, session_count, len(events), unique_days)

        return {
            "twin_score":              score,
            "total_sessions":          session_count,
            "total_events":            len(events),
            "active_days":             unique_days,
            "learning_enabled":        learning_enabled,
            "agent_scores":            computed["agent_scores"],
            "suggestion_accepts":      computed["suggestion_accepts"],
            "suggestion_dismisses":    computed["suggestion_dismisses"],
            "judgment_courts":         computed["judgment_courts"],
            "node_type_preferences":   computed["node_type_preferences"],
            "top_agent":               computed["top_agent"],
        }


@router.put("/workspace/profile/settings", status_code=204)
async def update_settings(body: ProfileSettings, user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO user_profile (user_id, learning_enabled)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET learning_enabled=$2, updated_at=NOW()
            """,
            user["id"],
            body.learning_enabled,
        )


@router.delete("/workspace/profile/reset", status_code=204)
async def reset_profile(user=Depends(require_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM user_learning_events WHERE user_id=$1", user["id"]
        )
        await conn.execute(
            "DELETE FROM user_profile WHERE user_id=$1", user["id"]
        )


@router.get("/workspace/profile/summary")
async def get_profile_summary(user=Depends(require_user)):
    """Return natural-language insight bullets describing what the system has learned."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT event_type, event_data FROM user_learning_events "
            "WHERE user_id=$1 ORDER BY created_at DESC LIMIT 250",
            user["id"],
        )
        session_count = (await conn.fetchval(
            "SELECT COUNT(*) FROM workspace_sessions WHERE user_id=$1", user["id"]
        )) or 0

    events = [
        {
            "event_type": r["event_type"],
            "data": json.loads(r["event_data"]) if r["event_data"] else {},
        }
        for r in rows
    ]

    if not events and session_count < 1:
        return {"insights": []}

    profile  = compute_profile(events)
    insights = _generate_summary_insights(profile, session_count)
    return {"insights": insights}


@router.get("/workspace/sessions/{session_id}/cross-matter")
async def cross_matter(session_id: int, user=Depends(require_user)):
    """Find thematic connections between this session and the user's others."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        current = await conn.fetchrow(
            "SELECT id, title, case_description, nodes_json "
            "FROM workspace_sessions WHERE id=$1 AND user_id=$2",
            session_id, user["id"],
        )
        if not current:
            raise HTTPException(404, "Session not found")

        others = await conn.fetch(
            """
            SELECT id, title, case_description, nodes_json, updated_at
            FROM workspace_sessions
            WHERE user_id=$1 AND id != $2
            ORDER BY updated_at DESC LIMIT 25
            """,
            user["id"], session_id,
        )

        # Judgment court history from learning events
        jdg_rows = await conn.fetch(
            "SELECT event_data FROM user_learning_events "
            "WHERE user_id=$1 AND event_type='judgment_add' ORDER BY created_at DESC LIMIT 50",
            user["id"],
        )

    # Keyword matching
    cur_text  = f"{current['title']} {current['case_description'] or ''}".lower()
    cur_terms = {t for t in _LEGAL_TERMS if t in cur_text}

    if not others:
        return {"connections": [], "patterns": [], "recommendation": None, "judgment_court_context": None}

    connections = []
    for s in others:
        other_text = f"{s['title']} {s['case_description'] or ''}".lower()
        shared = sorted(cur_terms & {t for t in _LEGAL_TERMS if t in other_text})
        if shared:
            connections.append({
                "session_id":    s["id"],
                "title":         s["title"],
                "shared_topics": shared[:4],
                "updated_at":    s["updated_at"].isoformat(),
            })

    # Node-type patterns across all prior sessions
    nt_counts: dict[str, int] = {}
    for s in others:
        nodes = s["nodes_json"] or []
        for n in (nodes if isinstance(nodes, list) else []):
            if isinstance(n, dict):
                nt = n.get("type", "")
                if nt:
                    nt_counts[nt] = nt_counts.get(nt, 0) + 1

    patterns = [
        {
            "node_type": nt,
            "count":     cnt,
            "insight":   _PATTERN_INSIGHTS.get(nt, f"{nt.title()} nodes used across {cnt} matter(s)."),
        }
        for nt, cnt in sorted(nt_counts.items(), key=lambda x: -x[1])
        if cnt >= 2
    ][:4]

    # Judgment court context — which courts the user has previously worked with
    court_counts: dict[str, int] = {}
    for r in jdg_rows:
        try:
            d = json.loads(r["event_data"]) if r["event_data"] else {}
        except Exception:
            d = {}
        court = d.get("court") or "Other"
        court_counts[court] = court_counts.get(court, 0) + 1

    judgment_court_context = None
    if court_counts:
        top_court = max(court_counts, key=lambda k: court_counts[k])
        cnt = court_counts[top_court]
        judgment_court_context = {
            "court":       top_court,
            "count":       cnt,
            "all_courts":  dict(sorted(court_counts.items(), key=lambda x: -x[1])[:4]),
        }

    # Top recommendation
    recommendation = None
    if connections:
        top = connections[0]
        topics = " & ".join(top["shared_topics"][:2])
        recommendation = (
            f'Your matter "{top["title"]}" also covers {topics}. '
            "Consider reviewing its canvas for reusable arguments."
        )
    elif patterns:
        p = patterns[0]
        recommendation = p["insight"]
    elif judgment_court_context:
        court = judgment_court_context["court"]
        cnt   = judgment_court_context["count"]
        recommendation = (
            f"You've added {cnt} judgment{'s' if cnt != 1 else ''} from {court} — "
            "agents will prioritise this forum's precedents in future analyses."
        )

    return {
        "connections":             connections[:5],
        "patterns":                patterns,
        "recommendation":          recommendation,
        "judgment_court_context":  judgment_court_context,
    }
