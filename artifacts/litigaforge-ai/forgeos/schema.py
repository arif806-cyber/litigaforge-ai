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
            status TEXT NOT NULL DEFAULT 'planned',
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
    # Existing installs may still have the pre-rename default — idempotent, harmless to rerun.
    await execute("""
        ALTER TABLE forgeos_missions ALTER COLUMN status SET DEFAULT 'planned'
    """)

    # ForgeOS Mission 001 additions — dashboard-facing agent fields. Added via
    # idempotent ALTER (mirrors main.py's migration pattern) rather than a
    # destructive rebuild, since forgeos_agents may already have rows.
    await execute("ALTER TABLE forgeos_agents ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT ''")
    await execute("ALTER TABLE forgeos_agents ADD COLUMN IF NOT EXISTS kpis JSONB DEFAULT '{}'::jsonb")
    await execute("""
        ALTER TABLE forgeos_agents ADD COLUMN IF NOT EXISTS current_mission_id
            INTEGER REFERENCES forgeos_missions(id) ON DELETE SET NULL
    """)
    await execute("ALTER TABLE forgeos_agents ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0")
    await execute("ALTER TABLE forgeos_agents ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ")

    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_mission_tasks (
            id SERIAL PRIMARY KEY,
            mission_id INTEGER NOT NULL REFERENCES forgeos_missions(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            agent_id INTEGER REFERENCES forgeos_agents(id) ON DELETE SET NULL,
            order_index INTEGER NOT NULL DEFAULT 0,
            output TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await execute("""
        CREATE INDEX IF NOT EXISTS idx_forgeos_mission_tasks_mission
            ON forgeos_mission_tasks(mission_id, order_index)
    """)

    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_metrics (
            id SERIAL PRIMARY KEY,
            metric_type TEXT NOT NULL,
            agent_id INTEGER REFERENCES forgeos_agents(id) ON DELETE SET NULL,
            mission_id INTEGER REFERENCES forgeos_missions(id) ON DELETE SET NULL,
            value NUMERIC NOT NULL DEFAULT 0,
            unit TEXT DEFAULT '',
            meta JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await execute("""
        CREATE INDEX IF NOT EXISTS idx_forgeos_metrics_type_created
            ON forgeos_metrics(metric_type, created_at DESC)
    """)

    await execute("""
        CREATE TABLE IF NOT EXISTS forgeos_audit_log (
            id SERIAL PRIMARY KEY,
            actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            target_type TEXT DEFAULT '',
            target_id TEXT DEFAULT '',
            detail JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    await execute("""
        CREATE INDEX IF NOT EXISTS idx_forgeos_audit_log_created
            ON forgeos_audit_log(created_at DESC)
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

    logger.info("forgeos: schema ready (11 tables)")
