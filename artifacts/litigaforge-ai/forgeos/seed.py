"""
ForgeOS initial seed data — idempotent (ON CONFLICT DO UPDATE on metadata only),
safe to run on every startup while FORGEOS_ENABLED is true. Runtime-managed
fields (status, kpis, progress, current_mission_id, last_activity_at) are never
touched here — only identity/metadata (role, description, capabilities, avatar)
is kept in sync, matching the "curated data always-upserts" pattern used
elsewhere in this backend (e.g. landmark judgments).
"""
import json

from database import execute
from logger import get_logger

logger = get_logger("litigaforge.forgeos")

INITIAL_AGENTS = [
    {
        "name": "CEO",
        "role": "Chief Executive Officer",
        "description": "Sets mission priorities, reviews outcomes, makes high-level calls.",
        "capabilities": ["planning", "prioritization", "decision-making"],
        "avatar": "\U0001F9D1\u200D\U0001F4BC",
    },
    {
        "name": "CTO",
        "role": "Chief Technology Officer",
        "description": "Owns technical direction, architecture reviews, and engineering risk calls.",
        "capabilities": ["architecture", "technical-review", "risk-assessment"],
        "avatar": "\U0001F9E9",
    },
    {
        "name": "Backend Engineer",
        "role": "Backend Engineer",
        "description": "Implements and reviews backend/API/data-layer work.",
        "capabilities": ["coding", "api-design", "database"],
        "avatar": "\u2699\uFE0F",
    },
    {
        "name": "QA Engineer",
        "role": "QA Engineer",
        "description": "Writes and runs tests, verifies acceptance criteria, flags regressions.",
        "capabilities": ["testing", "verification", "regression-analysis"],
        "avatar": "\U0001F9EA",
    },
    {
        "name": "Frontend Engineer",
        "role": "Frontend Engineer",
        "description": "Builds and maintains user-facing interfaces and client-side experience.",
        "capabilities": ["ui-development", "react", "accessibility"],
        "avatar": "\U0001F3A8",
    },
    {
        "name": "DevOps Engineer",
        "role": "DevOps Engineer",
        "description": "Manages CI/CD, deployments, infrastructure health, and release pipelines.",
        "capabilities": ["deployment", "infrastructure", "monitoring"],
        "avatar": "\U0001F680",
    },
    {
        "name": "Security Engineer",
        "role": "Security Engineer",
        "description": "Reviews code and infrastructure for vulnerabilities, enforces security best practices.",
        "capabilities": ["security-review", "threat-modeling", "vulnerability-scanning"],
        "avatar": "\U0001F6E1\uFE0F",
    },
    {
        "name": "Product Manager",
        "role": "Product Manager",
        "description": "Defines requirements, prioritizes the roadmap, and translates business goals into actionable missions.",
        "capabilities": ["requirements", "roadmap-planning", "prioritization"],
        "avatar": "\U0001F4CB",
    },
    {
        "name": "Legal Research Agent",
        "role": "Legal Research Agent",
        "description": "Researches case law, statutes, and legal precedent to support LitigaForge's legal content and features.",
        "capabilities": ["legal-research", "case-law-analysis", "citation-verification"],
        "avatar": "\u2696\uFE0F",
    },
    {
        "name": "Customer Support Agent",
        "role": "Customer Support Agent",
        "description": "Handles user inquiries, triages support issues, and drafts responses for review.",
        "capabilities": ["customer-support", "triage", "communication"],
        "avatar": "\U0001F4AC",
    },
]


async def seed_agents() -> None:
    for agent in INITIAL_AGENTS:
        await execute(
            """INSERT INTO forgeos_agents (name, role, description, capabilities, avatar)
               VALUES ($1, $2, $3, $4::jsonb, $5)
               ON CONFLICT (name) DO UPDATE SET
                   role = EXCLUDED.role,
                   description = EXCLUDED.description,
                   capabilities = EXCLUDED.capabilities,
                   avatar = EXCLUDED.avatar""",
            agent["name"], agent["role"], agent["description"],
            json.dumps(agent["capabilities"]), agent["avatar"],
        )
    logger.info("forgeos: seed agents ensured (%d)", len(INITIAL_AGENTS))


# Recurring mission templates for forgeos_schedules. Inserted ON CONFLICT (name)
# DO NOTHING (not DO UPDATE) so a founder can freely disable/retune
# interval_seconds from the DB/dashboard afterward without a restart silently
# reverting their change.
#
# "Growth & Competitive Intelligence Program" (8 rows below business_pulse):
# each `stagger_hours` offsets the FIRST next_run_at only (NOW() + N hours at
# insert time) so all 8 don't fire in the same poll tick right after deploy —
# subsequent runs then follow their own interval_seconds cadence as usual.
_DAY = 24 * 3600
INITIAL_SCHEDULES = [
    {
        "name": "business_pulse",
        "interval_seconds": 6 * 3600,  # every 6 hours = 4 runs/day
        "mission_template": {
            "builder": "business_pulse",
            "agent_name": "CEO",
            "requires_approval": False,
        },
    },
    {
        "name": "growth_content_drafting",
        "interval_seconds": 7 * _DAY,
        "stagger_hours": 1,
        "mission_template": {
            "builder": "growth_content_drafting",
            "agent_name": "Legal Research Agent",
            "requires_approval": False,
        },
    },
    {
        "name": "growth_content_structure",
        "interval_seconds": 30 * _DAY,
        "stagger_hours": 2,
        "mission_template": {
            "builder": "growth_content_structure",
            "agent_name": "Product Manager",
            "requires_approval": False,
        },
    },
    {
        "name": "growth_seo_audit",
        "interval_seconds": 7 * _DAY,
        "stagger_hours": 3,
        "mission_template": {
            "builder": "growth_seo_audit",
            "agent_name": "Backend Engineer",
            "requires_approval": False,
        },
    },
    {
        "name": "growth_onboarding_flow",
        "interval_seconds": 30 * _DAY,
        "stagger_hours": 4,
        "mission_template": {
            "builder": "growth_onboarding_flow",
            "agent_name": "Product Manager",
            "requires_approval": False,
        },
    },
    {
        "name": "growth_bar_verification",
        "interval_seconds": 14 * _DAY,
        "stagger_hours": 5,
        "mission_template": {
            "builder": "growth_bar_verification",
            "agent_name": "Backend Engineer",
            "requires_approval": False,
        },
    },
    {
        "name": "growth_competitor_watchlist",
        "interval_seconds": 7 * _DAY,
        "stagger_hours": 6,
        "mission_template": {
            "builder": "growth_competitor_watchlist",
            "agent_name": "Product Manager",
            "requires_approval": False,
        },
    },
    {
        "name": "growth_content_gap",
        "interval_seconds": 14 * _DAY,
        "stagger_hours": 7,
        "mission_template": {
            "builder": "growth_content_gap",
            "agent_name": "Legal Research Agent",
            "requires_approval": False,
        },
    },
    {
        "name": "growth_launch_plan",
        "interval_seconds": 30 * _DAY,
        "stagger_hours": 8,
        "mission_template": {
            "builder": "growth_launch_plan",
            "agent_name": "Product Manager",
            "requires_approval": False,
        },
    },
]


async def seed_schedules() -> None:
    for sched in INITIAL_SCHEDULES:
        stagger_hours = sched.get("stagger_hours", 0)
        await execute(
            f"""INSERT INTO forgeos_schedules (name, mission_template, interval_seconds, next_run_at)
               VALUES ($1, $2::jsonb, $3, NOW() + interval '{int(stagger_hours)} hours')
               ON CONFLICT (name) DO NOTHING""",
            sched["name"], json.dumps(sched["mission_template"]), sched["interval_seconds"],
        )
    logger.info("forgeos: seed schedules ensured (%d)", len(INITIAL_SCHEDULES))
