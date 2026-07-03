"""
ForgeOS AI Orchestrator — thin wrapper that routes an agent's task to the
LLM layer. Primary path: llm.legal_llm.acomplete (portable LiteLLM layer,
env-switchable via LLM_MODEL). Fallback: ai_brain.call_llm_async
(Claude → Gemini → Groq cascade), matching the fallback convention already
used elsewhere in this backend (e.g. judgment summarization, /ask).

Both are imported lazily so importing forgeos.orchestrator never pays the
litellm import cost unless a mission actually runs.

This is also the single choke point every LLM call goes through — both
missions.execute_mission() and workflows._run_step() call run_agent_task()
directly — so the daily cost cap is enforced here rather than duplicated in
each caller.
"""
from logger import get_logger
from forgeos.config import FORGEOS_DAILY_COST_LIMIT_USD

logger = get_logger("litigaforge.forgeos")


async def _daily_cost_cap_exceeded() -> float | None:
    """Returns today's metered spend (USD) if it has reached/exceeded the
    configured cap, else None. Uses the exact same query the dashboard's "AI
    Cost > today" widget uses so the cap and what operators see agree.
    Soft/best-effort: a small overshoot is possible when several missions run
    concurrently (bounded by FORGEOS_MAX_CONCURRENT_MISSIONS) — this is a
    spend guard, not a hard billing lock, and only covers the metered LiteLLM
    path (the ai_brain fallback has no per-call usage data to sum)."""
    if FORGEOS_DAILY_COST_LIMIT_USD <= 0:
        return None
    from database import fetch
    rows = await fetch(
        """SELECT COALESCE(SUM(value), 0) AS total FROM forgeos_metrics
           WHERE metric_type = 'llm_cost_usd' AND created_at >= CURRENT_DATE"""
    )
    spent_today = float(rows[0]["total"]) if rows else 0.0
    if spent_today >= FORGEOS_DAILY_COST_LIMIT_USD:
        return spent_today
    return None


_SYSTEM_PROMPT_TEMPLATE = (
    "You are {name}, acting as {role} inside ForgeOS, an internal multi-agent "
    "orchestration system. {description} "
    "Respond concisely and concretely, focused only on the task given. "
    "If the task is ambiguous or you lack information to complete it safely, "
    "say so explicitly instead of guessing."
)


def _build_system_prompt(agent: dict) -> str:
    return _SYSTEM_PROMPT_TEMPLATE.format(
        name=agent.get("name", "Agent"),
        role=agent.get("role", "a general-purpose agent"),
        description=agent.get("description") or "",
    ).strip()


async def run_agent_task(agent: dict, task_input: str) -> dict:
    """Run a single agent task through the LLM layer.

    Returns {"output": str, "model_used": str, "error": str | None,
    "tokens": {"prompt": int, "completion": int, "total": int} | None,
    "cost_usd": float | None}. "tokens"/"cost_usd" are only populated on the
    primary (metered) LiteLLM path — the ai_brain fallback cascade has no
    per-call usage reporting, so those come back None (unknown, not zero).

    Never raises — callers (missions/workflows) rely on the "error" field
    to decide whether the task failed.
    """
    spent_today = await _daily_cost_cap_exceeded()
    if spent_today is not None:
        logger.error(
            "forgeos: daily cost cap reached ($%.4f spent >= $%.2f limit) — refusing to run agent '%s'",
            spent_today, FORGEOS_DAILY_COST_LIMIT_USD, agent.get("name", "?"),
        )
        return {
            "output": "", "model_used": None,
            "error": (f"Daily ForgeOS AI cost cap reached (${spent_today:.4f} spent of "
                      f"${FORGEOS_DAILY_COST_LIMIT_USD:.2f} limit) — mission blocked until it resets "
                      "at midnight UTC or the cap is raised."),
            "tokens": None, "cost_usd": None,
        }

    system_prompt = _build_system_prompt(agent)

    try:
        from llm.legal_llm import acomplete_with_usage
        result = await acomplete_with_usage(system_prompt, task_input)
        if result["text"]:
            return {
                "output": result["text"], "model_used": result["model"], "error": None,
                "tokens": {
                    "prompt": result["prompt_tokens"],
                    "completion": result["completion_tokens"],
                    "total": result["total_tokens"],
                },
                "cost_usd": result["cost_usd"],
            }
        logger.warning("forgeos: primary LLM path returned empty output — falling back")
    except Exception as e:
        logger.warning("forgeos: primary LLM path failed (%s) — falling back", e)

    try:
        from ai_brain import call_llm_async
        output = await call_llm_async(system_prompt, task_input)
        if output and output.strip():
            return {"output": output.strip(), "model_used": "ai_brain_cascade", "error": None,
                    "tokens": None, "cost_usd": None}
        return {"output": "", "model_used": "ai_brain_cascade",
                "error": "All LLM providers returned empty output", "tokens": None, "cost_usd": None}
    except Exception as e:
        logger.error("forgeos: fallback LLM cascade failed: %s", e, exc_info=True)
        return {"output": "", "model_used": None, "error": str(e), "tokens": None, "cost_usd": None}
