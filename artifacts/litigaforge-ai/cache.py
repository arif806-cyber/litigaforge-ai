"""Redis async caching layer for LitigaForge AI.
Graceful degradation: if Redis is unavailable, every read returns None
and every write is silently ignored. The app continues to work normally.
"""

import os
import json
from typing import Any

_redis: Any | None = None


async def get_redis() -> Any:
    """Lazy-initialise the Redis connection."""
    global _redis
    if _redis is None:
        try:
            import redis.asyncio as aioredis
            _redis = aioredis.from_url(
                os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
                encoding="utf-8",
                decode_responses=True,
            )
        except Exception:
            _redis = None
    return _redis


async def cache_get(key: str) -> Any | None:
    """Get a value from cache. Returns None on miss or error."""
    try:
        r = await get_redis()
        if r is None:
            return None
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """Set a value in cache with TTL (seconds). Non-fatal on error."""
    try:
        r = await get_redis()
        if r is None:
            return
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    """Delete a key from cache. Non-fatal on error."""
    try:
        r = await get_redis()
        if r is None:
            return
        await r.delete(key)
    except Exception:
        pass
