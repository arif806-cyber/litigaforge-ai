"""Central APP_ENV and scheduler policy with backward-compatible Replit detection."""
from __future__ import annotations

import os
from urllib.parse import urlparse


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


def is_production_or_deployed() -> bool:
    return (
        is_production()
        or bool((os.getenv("REPLIT_DEPLOYMENT") or "").strip())
        or (os.getenv("ENVIRONMENT") or "").strip().lower() in {"production", "prod"}
    )


def is_production_database() -> bool:
    """Fail closed for the production database even in a dev-labelled process."""
    databases = {(os.getenv("PGDATABASE") or "").strip().lower()}
    dsn = (os.getenv("DATABASE_URL") or "").strip()
    if dsn:
        try:
            databases.add(urlparse(dsn).path.lstrip("/").split("/", 1)[0].split("?", 1)[0].lower())
        except ValueError:
            return True
    return "neondb" in databases


def assert_development_database() -> None:
    if is_production_or_deployed() or is_production_database():
        raise RuntimeError("Refusing test or seed operation; development-only guard detected a production environment/database.")


def is_test_account_email(email: str) -> bool:
    normalized = (email or "").strip().lower()
    domain = normalized.rsplit("@", 1)[-1] if "@" in normalized else ""
    return (
        domain == "litigaforge.test"
        or domain.endswith(".litigaforge.local")
        or (domain == "test.com" and normalized.startswith("jane_"))
        or normalized in {"support@litigaforge.com", "demo@litigaforge.com"}
        or normalized == (os.getenv("DEMO_ADVOCATE_EMAIL") or "").strip().lower()
    )


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
