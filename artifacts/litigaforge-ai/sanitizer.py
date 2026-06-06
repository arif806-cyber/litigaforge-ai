"""Input sanitization layer: injection detection, text cleaning, and identifier validation."""

import re
from typing import Any

# Patterns that indicate prompt injection attempts
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"disregard\s+(all\s+)?previous",
    r"forget\s+(all\s+)?instructions",
    r"you\s+are\s+now\s+a",
    r"act\s+as\s+(if\s+you\s+are|a)",
    r"new\s+instructions?\s*:",
    r"system\s*:\s*you",
    r"<\s*system\s*>",
    r"\[INST\]",
    r"###\s*instruction",
    r"jailbreak",
    r"dan\s+mode",
    r"developer\s+mode",
    r"ignore\s+all\s+ethical",
    r"pretend\s+you\s+(are|have\s+no)",
]

COMPILED_PATTERNS = [
    re.compile(p, re.IGNORECASE | re.MULTILINE)
    for p in INJECTION_PATTERNS
]


def detect_injection(text: str) -> bool:
    """Returns True if prompt injection is detected."""
    if not text:
        return False
    for pattern in COMPILED_PATTERNS:
        if pattern.search(text):
            return True
    return False


def sanitize_text(
    text: str,
    max_length: int = 5000,
    field_name: str = "input"
) -> str:
    """
    Sanitize user text input:
    - Strip leading/trailing whitespace
    - Enforce maximum length
    - Remove null bytes and non-printable control chars
    - Detect and block prompt injection attempts
    """
    if not isinstance(text, str):
        raise ValueError(f"{field_name} must be a string")

    # Strip whitespace
    text = text.strip()

    # Remove null bytes and control characters except
    # newline (\n), carriage return (\r), and tab (\t)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Strip HTML/script tags — prevents stored XSS when content
    # is ever rendered in non-React contexts or email templates
    text = re.sub(r"<[^>]+>", "", text)

    # Enforce length
    if len(text) > max_length:
        raise ValueError(
            f"{field_name} exceeds maximum length of "
            f"{max_length} characters"
        )

    # Detect injection
    if detect_injection(text):
        raise ValueError(
            f"{field_name} contains disallowed content. "
            f"Please rephrase your input."
        )

    return text


def sanitize_dict(
    data: dict,
    field_limits: dict[str, int]
) -> dict:
    """
    Sanitize multiple fields at once.
    field_limits = {"prompt": 5000, "title": 200, ...}
    """
    result = {}
    for key, value in data.items():
        if key in field_limits and isinstance(value, str):
            result[key] = sanitize_text(
                value,
                max_length=field_limits[key],
                field_name=key
            )
        else:
            result[key] = value
    return result


def sanitize_identifier(value: str, field_name: str) -> str:
    """
    For fields like bar_number, PAN, GSTIN, vehicle number.
    Only allow alphanumeric characters, hyphens, and slashes.
    """
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string")
    value = value.strip().upper()
    if not re.match(r'^[A-Z0-9\-/]{1,50}$', value):
        raise ValueError(
            f"{field_name} contains invalid characters"
        )
    return value
