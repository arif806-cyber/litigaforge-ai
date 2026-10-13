"""Optional privacy-safe background-job heartbeats."""
import os
from urllib.parse import urlsplit, urlunsplit

import httpx


async def heartbeat(env_name: str, *, failed: bool = False) -> None:
    url = os.getenv(env_name)
    if not url:
        return
    parts = urlsplit(url)
    path = parts.path.rstrip("/") + ("/fail" if failed else "")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(urlunsplit((parts.scheme, parts.netloc, path, parts.query, parts.fragment)))
            response.raise_for_status()
    except Exception:
        # Monitoring must never alter job completion or failure behavior.
        pass
