"""
ForgeOS initial seed data — idempotent (ON CONFLICT DO NOTHING), safe to run
on every startup while FORGEOS_ENABLED is true.
"""
from database import execute
from logger import get_logger

logger = get_logger("litigaforge.forgeos")

INITIAL_AGENTS = [
    {
        "name": "CEO",
        "role": "Chief Executive Officer",
        "description": "Sets mission priorities, reviews outcomes, makes high-level calls.",
        "capabilities": ["planning", "prioritization", "decision-making"],
    },
    {
        "name": "CTO",
        "role": "Chief Technology Officer",
        "description": "Owns technical direction, architecture reviews, and engineering risk calls.",
        "capabilities": ["architecture", "technical-review", "risk-assessment"],
    },
    {
        "name": "Backend Engineer",
        "role": "Backend Engineer",
        "description": "Implements and reviews backend/API/data-layer work.",
        "capabilities": ["coding", "api-design", "database"],
    },
    {
        "name": "QA Engineer",
        "role": "QA Engineer",
        "description": "Writes and runs tests, verifies acceptance criteria, flags regressions.",
        "capabilities": ["testing", "verification", "regression-analysis"],
    },
]


async def seed_agents() -> None:
    for agent in INITIAL_AGENTS:
        await execute(
            """INSERT INTO forgeos_agents (name, role, description, capabilities)
               VALUES ($1, $2, $3, $4::jsonb)
               ON CONFLICT (name) DO NOTHING""",
            agent["name"], agent["role"], agent["description"],
            __import__("json").dumps(agent["capabilities"]),
        )
    logger.info("forgeos: seed agents ensured (%d)", len(INITIAL_AGENTS))
