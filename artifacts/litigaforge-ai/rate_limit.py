from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse


def get_client_ip(request) -> str:
    """Return the original client IP supplied by Replit/Cloudflare proxies."""
    cloudflare_ip = (request.headers.get("cf-connecting-ip") or "").strip()
    if cloudflare_ip:
        return cloudflare_ip
    forwarded_for = (request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
    if forwarded_for:
        return forwarded_for
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=get_client_ip)


def rate_limit_handler(request, exc):
    response = JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait a moment and try again."},
    )
    response.headers["Retry-After"] = "60"
    return response
