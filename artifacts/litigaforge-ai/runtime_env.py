"""Central APP_ENV and scheduler policy with backward-compatible Replit detection."""
from __future__ import annotations

import os


def app_env() -> str:
    explicit = (os.getenv("APP_ENV") or "").strip().lower()
    if explicit:
        return explicit
    if (os.getenv("REPLIT_DEPLOYMENT") or "").strip():
        return "production"
    legacy = (os.getenv("NODE_ENV") or os.getenv("ENVIRONMENT") or "").strip().lower()
    return "production" if legacy in {"production", "prod"} else (legacy or "development")


def is_production() -> bool:
    return app_env() in {"production", "prod"}


def schedulers_enabled() -> bool:
    value = (os.getenv("SCHEDULER_ENABLED") or "").strip().lower()
    if value:
        return value in {"1", "true", "yes", "on"}
    # Preserve the historical Replit production-only schedule behavior.
    return is_production()
