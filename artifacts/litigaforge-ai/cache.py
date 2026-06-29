"""Redis + in-process TTL cache for LitigaForge AI.

Two-layer design:
  1. Redis (async) — shared across workers, used when REDIS_URL is set.
  2. In-process dict (monotonic TTL) — always available; used as primary
     when Redis is absent and as a fast L1 in front of Redis when present.

Graceful degradation: if Redis is unavailable every call falls back to the
in-process dict. The app never errors because of cache failures.
"""

import json
import os
import time
from typing import Any

# ── L1: in-process TTL store ──────────────────────────────────────────────────

_L1: dict[str, tuple[float, Any]] = {}


def _l1_get(key: str) -> Any | None:
    entry = _L1.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if time.monotonic() > expires_at:
        del _L1[key]
        return None
    return value


def _l1_set(key: str, value: Any, ttl: int) -> None:
    _L1[key] = (time.monotonic() + ttl, value)


def _l1_del(key: str) -> None:
    _L1.pop(key, None)


# ── L2: Redis (optional) ───────────────────────────────────────────────────────

_redis: Any | None = None


async def get_redis() -> Any:
    global _redis
    if _redis is None:
        redis_url = os.environ.get("REDIS_URL", "")
        if not redis_url:
            return None
        try:
            import redis.asyncio as aioredis
            _redis = aioredis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        except Exception:
            _redis = None
    return _redis


# ── Public API ─────────────────────────────────────────────────────────────────

async def cache_get(key: str) -> Any | None:
    """Get a value. Checks L1 first, then Redis."""
    hit = _l1_get(key)
    if hit is not None:
        return hit
    try:
        r = await get_redis()
        if r is None:
            return None
        val = await r.get(key)
        if val is None:
            return None
        parsed = json.loads(val)
        _l1_set(key, parsed, 60)
        return parsed
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """Set a value in L1 and Redis (if available)."""
    _l1_set(key, value, ttl)
    try:
        r = await get_redis()
        if r is None:
            return
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    """Delete from L1 and Redis."""
    _l1_del(key)
    try:
        r = await get_redis()
        if r is None:
            return
        await r.delete(key)
    except Exception:
        pass


async def cache_delete_prefix(prefix: str) -> None:
    """Delete all L1 keys with this prefix (Redis prefix scan is expensive — skip for now)."""
    to_del = [k for k in list(_L1) if k.startswith(prefix)]
    for k in to_del:
        _l1_del(k)


def cache_key(*parts: Any) -> str:
    return ":".join(str(p) for p in parts)
