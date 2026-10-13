"""Central APP_ENV and scheduler policy with backward-compatible Replit detection."""
from __future__ import annotations

import os


def app_env() -> str:
    if (os.getenv("REPLIT_DEPLOYMENT") or "").strip():
        return "production"
    if any((os.getenv(key) or "").strip().lower() in {"production", "prod"}
           for key in ("APP_ENV", "ENVIRONMENT", "NODE_ENV")):
        return "production"
    explicit = (os.getenv("APP_ENV") or "").strip().lower()
    if explicit:
        return explicit
    legacy = (os.getenv("NODE_ENV") or os.getenv("ENVIRONMENT") or "").strip().lower()
    return "production" if legacy in {"production", "prod"} else (legacy or "development")


def is_production() -> bool:
    return app_env() in {"production", "prod"}


def is_seed_advocate_email(email: str) -> bool:
    normalized = (email or "").strip().lower()
    if normalized == (os.getenv("DEMO_ADVOCATE_EMAIL") or "").strip().lower() and normalized:
        return True
    domain = normalized.rsplit("@", 1)[-1] if "@" in normalized else ""
    return domain.endswith((".test", ".local")) or domain == "example.com"


def schedulers_enabled() -> bool:
    value = (os.getenv("SCHEDULER_ENABLED") or "").strip().lower()
    if value:
        return value in {"1", "true", "yes", "on"}
    # Preserve the historical Replit production-only schedule behavior.
    return is_production()
