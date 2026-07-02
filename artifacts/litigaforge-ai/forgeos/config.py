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
