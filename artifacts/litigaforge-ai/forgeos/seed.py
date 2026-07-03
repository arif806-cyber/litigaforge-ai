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
