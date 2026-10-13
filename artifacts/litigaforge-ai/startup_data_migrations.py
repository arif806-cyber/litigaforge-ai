"""Opt-in, logged one-time cleanup migrations; never discard live embeddings."""
from __future__ import annotations

import logging
import os

logger = logging.getLogger("litigaforge.startup_migrations")


def enabled() -> bool:
    return (os.getenv("RUN_DATA_MIGRATIONS") or "").strip().lower() in {
        "1", "true", "yes", "on",
    }


async def run_duplicate_cleanups(conn) -> None:
    if not enabled():
        logger.info("One-time duplicate cleanups skipped (RUN_DATA_MIGRATIONS is off).")
        return

    count = await conn.fetchval("""
        SELECT COUNT(*) FROM (
          SELECT id, row_number() OVER (PARTITION BY payment_ref ORDER BY id) rn
          FROM subscriptions WHERE payment_ref IS NOT NULL
        ) d WHERE rn > 1
    """)
    if count:
        rows = await conn.fetch("""
            WITH d AS (
              SELECT id,row_number() OVER (PARTITION BY payment_ref ORDER BY id) rn
              FROM subscriptions WHERE payment_ref IS NOT NULL
            )
            UPDATE subscriptions s SET payment_ref=NULL FROM d
            WHERE s.id=d.id AND d.rn>1 RETURNING s.id
        """)
        logger.info("One-time migration nulled %d duplicate subscription payment_ref values.", len(rows))

    count = await conn.fetchval("""
        SELECT COUNT(*) FROM (
          SELECT id,row_number() OVER (PARTITION BY commission_payment_id ORDER BY id) rn
          FROM matches WHERE commission_payment_id IS NOT NULL AND commission_payment_id <> 'DEMO_PAID'
        ) d WHERE rn>1
    """)
    if count:
        rows = await conn.fetch("""
            WITH d AS (
              SELECT id,row_number() OVER (PARTITION BY commission_payment_id ORDER BY id) rn
              FROM matches WHERE commission_payment_id IS NOT NULL AND commission_payment_id <> 'DEMO_PAID'
            )
            UPDATE matches m SET commission_payment_id=NULL FROM d
            WHERE m.id=d.id AND d.rn>1 RETURNING m.id
        """)
        logger.info("One-time migration nulled %d duplicate match commission_payment_id values.", len(rows))

    count = await conn.fetchval("""
        SELECT COUNT(*) FROM (
          SELECT id,row_number() OVER (PARTITION BY match_id ORDER BY id) rn
          FROM chat_threads WHERE match_id IS NOT NULL
        ) d WHERE rn>1
    """)
    if count:
        messages = await conn.fetchval("""
            WITH d AS (
              SELECT id,row_number() OVER (PARTITION BY match_id ORDER BY id) rn
              FROM chat_threads WHERE match_id IS NOT NULL
            )
            SELECT COUNT(*) FROM chat_messages m JOIN d ON d.id=m.thread_id WHERE d.rn>1
        """)
        rows = await conn.fetch("""
            WITH d AS (
              SELECT id,row_number() OVER (PARTITION BY match_id ORDER BY id) rn
              FROM chat_threads WHERE match_id IS NOT NULL
            )
            DELETE FROM chat_threads t USING d WHERE t.id=d.id AND d.rn>1 RETURNING t.id
        """)
        logger.warning("One-time migration deleted %d duplicate chat_threads and cascaded %d chat_messages.",
                       len(rows), messages)

async def ensure_unique_indexes(conn) -> None:
    checks = (
        ("subscriptions", """
            SELECT COUNT(*) FROM (
              SELECT row_number() OVER (PARTITION BY payment_ref) rn
              FROM subscriptions WHERE payment_ref IS NOT NULL
            ) d WHERE rn>1
        """),
        ("matches", """
            SELECT COUNT(*) FROM (
              SELECT row_number() OVER (PARTITION BY commission_payment_id) rn
              FROM matches WHERE commission_payment_id IS NOT NULL AND commission_payment_id <> 'DEMO_PAID'
            ) d WHERE rn>1
        """),
        ("chat_threads", """
            SELECT COUNT(*) FROM (
              SELECT row_number() OVER (PARTITION BY match_id) rn
              FROM chat_threads WHERE match_id IS NOT NULL
            ) d WHERE rn>1
        """),
    )
    dupes = {name: await conn.fetchval(sql) for name, sql in checks}
    if not dupes["subscriptions"]:
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_payment_ref
            ON subscriptions (payment_ref) WHERE payment_ref IS NOT NULL
        """)
    else:
        logger.warning("Skipped subscription payment_ref unique index: %d duplicates remain.", dupes["subscriptions"])
    if not dupes["matches"]:
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_commission_payment_id
            ON matches (commission_payment_id)
            WHERE commission_payment_id IS NOT NULL AND commission_payment_id <> 'DEMO_PAID'
        """)
    else:
        logger.warning("Skipped match commission payment unique index: %d duplicates remain.", dupes["matches"])
    if not dupes["chat_threads"]:
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_threads_match_id ON chat_threads (match_id)
        """)
    else:
        logger.warning("Skipped chat_threads unique index: %d duplicate threads remain.", dupes["chat_threads"])


async def migrate_workspace_embedding(conn, production: bool) -> bool:
    if not enabled():
        return False
    current_type = await conn.fetchval("""
        SELECT format_type(a.atttypid,a.atttypmod)
        FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
        WHERE c.relname='workspace_sessions' AND a.attname='embedding' AND a.attnum>0
    """)
    if current_type == "vector(2048)":
        return False
    populated = await conn.fetchval(
        "SELECT COUNT(*) FROM workspace_sessions WHERE embedding IS NOT NULL"
    )
    if populated:
        logger.error(
            "Embedding type migration skipped: %d non-null vectors would be discarded; "
            "production=%s. No embeddings were changed.",
            populated, production,
        )
        return False
    await conn.execute("DROP INDEX IF EXISTS idx_workspace_sessions_embedding")
    await conn.execute(
        "ALTER TABLE workspace_sessions ALTER COLUMN embedding TYPE vector(2048) USING NULL"
    )
    logger.info("Embedding type migrated to vector(2048); cleared 0 pre-existing vectors.",)
    return True
