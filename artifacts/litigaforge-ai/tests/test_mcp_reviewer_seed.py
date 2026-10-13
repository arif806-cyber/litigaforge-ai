import importlib.util
from pathlib import Path

import pytest


SPEC = importlib.util.spec_from_file_location(
    "seed_mcp_reviewer_test_module",
    Path(__file__).with_name("seed_dev_mcp_reviewer.py"),
)
seed_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(seed_module)


def test_reviewer_seed_requires_environment_credentials(monkeypatch):
    monkeypatch.delenv("MCP_REVIEWER_EMAIL", raising=False)
    monkeypatch.delenv("MCP_REVIEWER_PASSWORD", raising=False)
    with pytest.raises(RuntimeError, match="MCP_REVIEWER_EMAIL"):
        seed_module.reviewer_credentials()


def test_reviewer_seed_rejects_short_password(monkeypatch):
    monkeypatch.setenv("MCP_REVIEWER_EMAIL", "reviewer@example.test")
    monkeypatch.setenv("MCP_REVIEWER_PASSWORD", "short")
    with pytest.raises(RuntimeError, match="at least 12 characters"):
        seed_module.reviewer_credentials()


def test_reviewer_seed_reads_but_does_not_print_configured_credentials(monkeypatch):
    monkeypatch.setenv("MCP_REVIEWER_EMAIL", "reviewer@example.test")
    monkeypatch.setenv("MCP_REVIEWER_PASSWORD", "test-only-password-123")
    assert seed_module.reviewer_credentials() == (
        "reviewer@example.test",
        "test-only-password-123",
    )
