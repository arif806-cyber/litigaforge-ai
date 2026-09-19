"""Cancellable daily subscription-expiry scheduler."""
from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

from logger import get_logger

logger = get_logger("litigaforge.subscription_scheduler")


def start_scheduler(expire_fn: Callable[[], Awaitable[int]], interval: float = 86400.0) -> asyncio.Task:
    async def _run() -> None:
        try:
            while True:
                try:
                    expired = await expire_fn()
                    if expired:
                        logger.info("subscription expiry sweep downgraded %d account(s)", expired)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("subscription expiry sweep failed")
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            logger.info("subscription expiry scheduler stopped")
            raise

    return asyncio.create_task(_run(), name="subscription-expiry")