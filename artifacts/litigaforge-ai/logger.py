"""Structured JSON logging for LitigaForge AI.
Production: single JSON objects per line (parseable by Replit, Datadog, CloudWatch).
Development: readable human format with timestamps.
"""

import logging
import json
import sys
import os
from datetime import datetime, timezone
from typing import Any


class JSONFormatter(logging.Formatter):
    """Outputs every log line as a single JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        log: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level":     record.levelname,
            "logger":    record.name,
            "message":   record.getMessage(),
            "module":    record.module,
            "function":  record.funcName,
            "line":      record.lineno,
        }
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra"):
            log.update(record.extra)
        return json.dumps(log, ensure_ascii=False)


def get_logger(name: str) -> logging.Logger:
    """Get or create a logger with the correct formatter."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    env = os.environ.get("ENVIRONMENT", "development")
    if env == "production":
        handler.setFormatter(JSONFormatter())
        logger.setLevel(logging.INFO)
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        ))
        logger.setLevel(logging.DEBUG)

    logger.addHandler(handler)
    logger.propagate = False
    return logger


# Module-level loggers — import these in route files
forge_logger   = get_logger("litigaforge.forge")
auth_logger    = get_logger("litigaforge.auth")
ai_logger      = get_logger("litigaforge.ai")
db_logger      = get_logger("litigaforge.db")
watch_logger   = get_logger("litigaforge.watch")
payment_logger = get_logger("litigaforge.payment")
