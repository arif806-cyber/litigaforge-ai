"""
ForgeOS — modular multi-agent orchestration subsystem for LitigaForge AI.

Entirely gated behind FORGEOS_ENABLED (see forgeos.config). When the flag is
off, main.py never imports this package, so it has zero effect on existing
LitigaForge functionality: no new tables, no new routes, no background
tasks.

Components:
    config       — environment-driven settings
    schema       — CREATE TABLE IF NOT EXISTS DDL for all forgeos_* tables
    seed         — idempotent seed data (initial agents)
    registry     — Agent Registry (CRUD over forgeos_agents)
    memory       — Shared Memory Service (forgeos_memory key/value store)
    events       — Event Bus (in-process pub/sub + forgeos_events audit log)
    approvals    — Approval Engine (human-in-the-loop gates)
    orchestrator — AI Orchestrator (routes agent work to the LLM layer)
    missions     — Mission Engine (single-goal agent tasks + state machine)
    workflows    — Workflow Engine (multi-step, multi-agent sequences)
    scheduler    — recurring/deferred mission triggers
    router       — REST API surface, mounted at {BASE_PATH}/forgeos
"""
from forgeos.config import FORGEOS_ENABLED

__all__ = ["FORGEOS_ENABLED"]
