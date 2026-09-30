import ipaddress

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse


def get_client_ip(request) -> str:
    """Return a validated client IP, trusting proxy headers only from a proxy hop.

    Replit forwards requests through a local/private hop.  Do not let a direct
    public caller spoof an arbitrary X-Forwarded-For value.
    """
    peer = (request.client.host if request.client else "").strip()
    try:
        peer_ip = ipaddress.ip_address(peer)
    except ValueError:
        return "unknown"
    if peer_ip.is_private or peer_ip.is_loopback or peer_ip.is_link_local:
        candidates = [
            (request.headers.get("cf-connecting-ip") or "").strip(),
            (request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip(),
        ]
        for candidate in candidates:
            try:
                ipaddress.ip_address(candidate)
                return candidate
            except ValueError:
                continue
    return peer


limiter = Limiter(key_func=get_client_ip)


def rate_limit_handler(request, exc):
    response = JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait a moment and try again."},
    )
    response.headers["Retry-After"] = "60"
    return response
