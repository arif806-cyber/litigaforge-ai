"""Idempotent daily reconciliation for payment refunds and file erasure."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from database import execute, fetch, get_pool
from logger import get_logger
from payments import refund_match_payment

logger = get_logger("litigaforge.maintenance")
LOCK_KEY = 726514


async def reconcile_match_refunds(limit: int = 50) -> int:
    """Retry provider refunds without allowing concurrent duplicate work."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            got_lock = await conn.fetchval("SELECT pg_try_advisory_xact_lock($1)", LOCK_KEY)
            if not got_lock:
                return 0
            rows = await conn.fetch(
                """SELECT r.match_id, r.payment_id, r.amount_paise
                   FROM match_refund_retries r
                   JOIN matches m ON m.id = r.match_id
                   WHERE r.next_attempt_at <= CURRENT_TIMESTAMP
                     AND (r.status = 'pending'
                          OR (r.status = 'processing' AND r.locked_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes'))
                   ORDER BY r.next_attempt_at
                   FOR UPDATE OF r SKIP LOCKED LIMIT $1""", limit)
            ids = [row["match_id"] for row in rows]
            if ids:
                await conn.execute(
                    """UPDATE match_refund_retries SET status='processing', locked_at=CURRENT_TIMESTAMP
                       WHERE match_id = ANY($1::int[])""", ids)
    processed = 0
    for row in rows:
        try:
            await _refund(row["payment_id"], row["amount_paise"])
            await execute(
                """UPDATE matches SET payment_status='refunded', updated_at=CURRENT_TIMESTAMP
                   WHERE id=$1 AND payment_status='paid'""", row["match_id"])
            await execute("DELETE FROM match_refund_retries WHERE match_id=$1", row["match_id"])
            processed += 1
        except Exception as exc:
            await execute(
                """UPDATE match_refund_retries
                   SET status='pending', attempts=attempts+1, last_error=$2,
                       next_attempt_at=CURRENT_TIMESTAMP + LEAST(
                         INTERVAL '24 hours', INTERVAL '5 minutes' * power(2, LEAST(attempts, 8))),
                       locked_at=NULL
                   WHERE match_id=$1""", row["match_id"], str(exc)[:500])
            logger.warning("refund reconciliation failed for match %s", row["match_id"])
    return processed


async def _refund(payment_id: str, amount_paise: int) -> dict:
    # Keep provider SDK work out of the event loop.
    import asyncio
    return await asyncio.to_thread(refund_match_payment, payment_id, amount_paise)


async def retry_account_file_deletions(limit: int = 100) -> int:
    """Delete queued files after erasure; failure is retried with backoff."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            got_lock = await conn.fetchval("SELECT pg_try_advisory_xact_lock($1)", LOCK_KEY + 1)
            if not got_lock:
                return 0
            rows = await conn.fetch(
                """SELECT id, file_path FROM account_file_deletion_retries
                   WHERE next_attempt_at <= CURRENT_TIMESTAMP
                     AND (status='pending' OR (status='processing' AND locked_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes'))
                   ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT $1""", limit)
            if rows:
                await conn.execute(
                    """UPDATE account_file_deletion_retries SET status='processing', locked_at=CURRENT_TIMESTAMP
                       WHERE id = ANY($1::bigint[])""", [r["id"] for r in rows])
    processed = 0
    for row in rows:
        try:
            await _delete_path(row["file_path"])
            await execute("DELETE FROM account_file_deletion_retries WHERE id=$1", row["id"])
            processed += 1
        except Exception as exc:
            await execute(
                """UPDATE account_file_deletion_retries
                   SET status='pending', attempts=attempts+1, last_error=$2,
                       next_attempt_at=CURRENT_TIMESTAMP + LEAST(
                         INTERVAL '24 hours', INTERVAL '5 minutes' * power(2, LEAST(attempts, 8))),
                       locked_at=NULL WHERE id=$1""", row["id"], str(exc)[:500])
    return processed


async def _delete_path(file_path: str) -> None:
    import asyncio
    import os
    from pathlib import Path
    if file_path.startswith("/"):
        path = Path(file_path)
        if path.is_file():
            await asyncio.to_thread(os.remove, path)
        return
    from storage import get_object_storage
    storage = get_object_storage()
    if storage is None:
        raise RuntimeError("configured object storage is unavailable")
    await asyncio.to_thread(storage.delete, file_path)


async def run_daily_reconciliation() -> int:
    return (await reconcile_match_refunds()) + (await retry_account_file_deletions())