"""Shared abuse controls for genuinely public AI endpoints.

Authenticated AI endpoints keep their existing per-user quota and global budget
reservation.  This dependency is deliberately only for routes which permit an
anonymous caller (currently ``/ask``).
"""
from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from rate_limit import get_client_ip


def _positive_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


PUBLIC_AI_RATE_LIMIT_PER_MINUTE = _positive_int(
    "PUBLIC_AI_RATE_LIMIT_PER_MINUTE", 10
)
PUBLIC_AI_MAX_INPUT_BYTES = _positive_int(
    "PUBLIC_AI_MAX_INPUT_BYTES", 12000
)

_WINDOW_SECONDS = 60.0
_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = asyncio.Lock()


async def enforce_public_ai_policy(request: Request) -> None:
    """Apply the same IP window and body-size limit before provider work.

    ``Request.body`` is cached by Starlette, so reading it here does not consume
    it for FastAPI/Pydantic.  A missing or malformed client identity fails
    closed rather than collapsing all anonymous callers into one trusted key.
    """
    ip = get_client_ip(request)
    if not ip or ip == "unknown":
        raise HTTPException(
            status_code=429,
            detail="Unable to establish a safe client identity.",
            headers={"Retry-After": "60"},
        )

    declared = request.headers.get("content-length")
    try:
        if declared is not None and int(declared) > PUBLIC_AI_MAX_INPUT_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Request input exceeds the {PUBLIC_AI_MAX_INPUT_BYTES}-byte limit.",
            )
    except ValueError:
        raise HTTPException(status_code=413, detail="Invalid request size.")

    raw = await request.body()
    if len(raw) > PUBLIC_AI_MAX_INPUT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Request input exceeds the {PUBLIC_AI_MAX_INPUT_BYTES}-byte limit.",
        )

    now = time.monotonic()
    async with _lock:
        bucket = _hits[ip]
        cutoff = now - _WINDOW_SECONDS
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= PUBLIC_AI_RATE_LIMIT_PER_MINUTE:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Public AI request limit reached. "
                    "Please wait before trying again."
                ),
                headers={"Retry-After": "60"},
            )
        bucket.append(now)


def reset_policy_state_for_tests() -> None:
    """Clear process-local windows for isolated unit tests."""
    _hits.clear()