"""
ForgeOS configuration — all settings sourced from environment variables.

FORGEOS_ENABLED gates the entire subsystem: when unset/false (the default),
main.py never imports anything under forgeos/, so no tables are created, no
routes are mounted, and no background scheduler runs. ForgeOS is fully inert
until an operator explicitly sets FORGEOS_ENABLED=true.
"""
import os


def _bool_env(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


FORGEOS_ENABLED = _bool_env("FORGEOS_ENABLED", False)

# Model override for the AI Orchestrator. Empty string = use whatever
# llm.legal_llm / ai_brain already default to.
FORGEOS_DEFAULT_MODEL = os.getenv("FORGEOS_DEFAULT_MODEL", "")

# Max number of missions/workflow steps executed concurrently in-process
# (this is a single-VM, single-process subsystem — no separate worker pool).
FORGEOS_MAX_CONCURRENT_MISSIONS = int(os.getenv("FORGEOS_MAX_CONCURRENT_MISSIONS", "2"))

# How often (seconds) the scheduler polls forgeos_schedules for due runs.
FORGEOS_SCHEDULER_POLL_SECONDS = int(os.getenv("FORGEOS_SCHEDULER_POLL_SECONDS", "60"))

# Max characters accepted for mission / workflow-step free-text inputs.
FORGEOS_MAX_INPUT_CHARS = int(os.getenv("FORGEOS_MAX_INPUT_CHARS", "8000"))

# Max characters accepted for event payload (stringified) — guards forgeos_events.
FORGEOS_MAX_EVENT_PAYLOAD_CHARS = int(os.getenv("FORGEOS_MAX_EVENT_PAYLOAD_CHARS", "20000"))

# A mission stuck in "running" past this long (seconds) is almost always an
# orphan — its process died mid-call before it could ever reach a terminal
# state — so the scheduler treats it as blocked and reassigns it.
FORGEOS_STUCK_RUNNING_SECONDS = int(os.getenv("FORGEOS_STUCK_RUNNING_SECONDS", "600"))

# A mission stuck in "waiting" (pending human approval) past this long is
# surfaced as blocked so a founder alert fires — it isn't reassigned since a
# human decision is what's actually missing, not agent capacity.
FORGEOS_STUCK_WAITING_SECONDS = int(os.getenv("FORGEOS_STUCK_WAITING_SECONDS", "1800"))

# A mission stuck in "assigned" past this long never even got its
# execute_mission() task to run (e.g. the process restarted between
# create_mission()'s asyncio.create_task and the task actually executing) —
# it's just re-launched, no reassignment needed since no agent ever started it.
FORGEOS_STUCK_ASSIGNED_SECONDS = int(os.getenv("FORGEOS_STUCK_ASSIGNED_SECONDS", "120"))

# Soft daily spend cap (USD) on *metered* LLM calls (forgeos_metrics
# metric_type='llm_cost_usd' — the same rows the Command Center's "AI Cost"
# widget sums for "today"). 0 or unset = no cap (backward compatible default).
# This is a soft/best-effort limit, not a hard guarantee: a small overshoot is
# possible when several missions are mid-flight concurrently (bounded by
# FORGEOS_MAX_CONCURRENT_MISSIONS), and it only bounds calls that went through
# the metered LiteLLM path — the unmetered ai_brain fallback cascade has no
# per-call usage reporting, so it isn't counted at all (see dashboard.py).
FORGEOS_DAILY_COST_LIMIT_USD = float(os.getenv("FORGEOS_DAILY_COST_LIMIT_USD", "0"))

# Per-mission ceiling on LLM *output* tokens (passed straight through as the
# `max_tokens` param on the metered LiteLLM call). 0 or unset = unbounded
# (backward compatible default). This bounds the worst-case cost of any single
# mission/workflow-step call — unlike the daily cap above, it's enforced by
# the LLM API itself (it can't overshoot), not by a read-then-check query.
# It does NOT apply to the unmetered ai_brain fallback cascade, which has no
# token-limit knob of its own.
FORGEOS_MAX_TOKENS_PER_MISSION = int(os.getenv("FORGEOS_MAX_TOKENS_PER_MISSION", "0"))

# Percent of FORGEOS_DAILY_COST_LIMIT_USD at which to start logging a
# warning (spend is "approaching" the cap) instead of only finding out when
# the hard block kicks in at 100%. Only meaningful when the daily cap is
# enabled (> 0); ignored otherwise. Warning-only — never blocks a mission.
FORGEOS_COST_WARN_THRESHOLD_PCT = float(os.getenv("FORGEOS_COST_WARN_THRESHOLD_PCT", "80"))
