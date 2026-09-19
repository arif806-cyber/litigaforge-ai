"""Atomic shared daily budget for public AI requests.

The ledger meters logical requests, rather than individual provider retries. This
keeps a fallback from double-charging while still reserving capacity before a
background job is created.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from database import fetchrow


class AICapReached(Exception):
    """The shared daily AI capacity is exhausted."""


def _positive_float(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return value if value > 0 else default


def daily_call_cap() -> int:
    try:
        value = int(os.getenv("AI_DAILY_CALL_CAP", "1000"))
    except (TypeError, ValueError):
        value = 1000
    return max(value, 1)


def estimated_call_cost_usd() -> float:
    return _positive_float("AI_ESTIMATED_CALL_COST_USD", 0.05)


def daily_spend_cap_usd() -> float:
    return _positive_float("AI_DAILY_SPEND_CAP_USD", 25.0)


def retry_after_seconds() -> int:
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).date()
    next_midnight = datetime.combine(tomorrow, datetime.min.time(), tzinfo=timezone.utc)
    return max(1, int((next_midnight - now).total_seconds()))


def cap_error() -> HTTPException:
    return HTTPException(
        status_code=429,
        detail={
            "code": "AI_DAILY_CAP_REACHED",
            "message": (
                "We've reached today's shared AI capacity, so we're pausing new "
                "AI requests for now. Your saved work is safe—please try again tomorrow."
            ),
        },
        headers={"Retry-After": str(retry_after_seconds())},
    )


async def reserve_global_ai_capacity(*, raise_http: bool = True) -> None:
    """Atomically reserve one logical AI request for the current UTC day."""
    cost = estimated_call_cost_usd()
    row = await fetchrow(
        """INSERT INTO ai_usage_global_daily
               (usage_date, call_count, estimated_spend_usd)
           VALUES (CURRENT_DATE, 1, $1)
           ON CONFLICT (usage_date) DO UPDATE
             SET call_count = ai_usage_global_daily.call_count + 1,
                 estimated_spend_usd =
                   ai_usage_global_daily.estimated_spend_usd + $1,
                 updated_at = NOW()
           WHERE ai_usage_global_daily.call_count < $2
             AND ai_usage_global_daily.estimated_spend_usd + $1 <= $3
           RETURNING call_count""",
        cost,
        daily_call_cap(),
        daily_spend_cap_usd(),
    )
    if row:
        return
    if raise_http:
        raise cap_error()
    raise AICapReached()