"""
ForgeOS PostgreSQL schema — CREATE TABLE IF NOT EXISTS, mirroring the
idempotent pattern used for the rest of LitigaForge's tables (see main.py's
lifespan). Every table is prefixed ``forgeos_`` to avoid any collision with
existing tables — including the unrelated ``forge_memory`` package, which
is a different, pre-existing feature and must not be touched.

init_forgeos_tables() is only ever called when FORGEOS_ENABLED is true.
"""
from database import execute
from logger import get_logger

logger = get_logger("litigaforge.forgeos")


async def init_forgeos_tables() -> None:
    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_agents (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            description TEXT DEFAULT '',
            capabilities JSONB DEFAULT '[]'::jsonb,
            model TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_missions (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            agent_id INTEGER REFERENCES forgeos_agents(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
            input JSONB DEFAULT '{}'::jsonb,
            result JSONB,
            error TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await execute("""
        CREATE INDEX IF NOT EXISTS idx_forgeos_missions_status
            ON forgeos_missions(status)
    """)

    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_workflows (
            id SERIAL PRIMARY KEY,
            mission_id INTEGER REFERENCES forgeos_missions(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_workflow_steps (
            id SERIAL PRIMARY KEY,
            workflow_id INTEGER NOT NULL REFERENCES forgeos_workflows(id) ON DELETE CASCADE,
            step_order INTEGER NOT NULL,
            agent_id INTEGER REFERENCES forgeos_agents(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
            input JSONB DEFAULT '{}'::jsonb,
            output JSONB,
            error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await execute("""
        CREATE INDEX IF NOT EXISTS idx_forgeos_workflow_steps_workflow
            ON forgeos_workflow_steps(workflow_id, step_order)
    """)

    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_events (
            id SERIAL PRIMARY KEY,
            topic TEXT NOT NULL,
            payload JSONB DEFAULT '{}'::jsonb,
            source TEXT DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await execute("""
        CREATE INDEX IF NOT EXISTS idx_forgeos_events_topic_created
            ON forgeos_events(topic, created_at DESC)
    """)

    # Distinct from the unrelated forge_memory/ package (different feature).
    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_memory (
            id SERIAL PRIMARY KEY,
            namespace TEXT NOT NULL,
            key TEXT NOT NULL,
            value JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(namespace, key)
        )
    """)

    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_approvals (
            id SERIAL PRIMARY KEY,
            mission_id INTEGER REFERENCES forgeos_missions(id) ON DELETE CASCADE,
            workflow_step_id INTEGER REFERENCES forgeos_workflow_steps(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'pending',
            requested_by TEXT DEFAULT 'system',
            reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            reason TEXT DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ
        )
    """)
    await execute("""
        CREATE INDEX IF NOT EXISTS idx_forgeos_approvals_status
            ON forgeos_approvals(status)
    """)

    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_schedules (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            mission_template JSONB NOT NULL DEFAULT '{}'::jsonb,
            interval_seconds INTEGER NOT NULL,
            next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_run_at TIMESTAMPTZ,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    logger.info("forgeos: schema ready (8 tables)")
