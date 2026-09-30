import os
import sys
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from public_ai_policy import (  # noqa: E402
    enforce_public_ai_policy,
    reset_policy_state_for_tests,
)


class Request:
    def __init__(self, body=b"{}", ip="198.51.100.2"):
        self.headers = {"content-length": str(len(body))}
        self.client = SimpleNamespace(host="127.0.0.1")
        self._body = body
        self._ip = ip

    async def body(self):
        return self._body

    @property
    def headers(self):
        return self._headers

    @headers.setter
    def headers(self, value):
        self._headers = {
            **value,
            "x-forwarded-for": getattr(self, "_ip", "198.51.100.2"),
        }


@pytest.mark.asyncio
async def test_public_policy_accepts_ip_and_body_once():
    reset_policy_state_for_tests()
    await enforce_public_ai_policy(Request())


@pytest.mark.asyncio
async def test_public_policy_returns_413_before_provider_work(monkeypatch):
    reset_policy_state_for_tests()
    monkeypatch.setenv("PUBLIC_AI_MAX_INPUT_BYTES", "4")
    import public_ai_policy
    monkeypatch.setattr(public_ai_policy, "PUBLIC_AI_MAX_INPUT_BYTES", 4)
    with pytest.raises(HTTPException) as exc:
        await enforce_public_ai_policy(Request(body=b"too-large"))
    assert exc.value.status_code == 413


@pytest.mark.asyncio
async def test_public_policy_returns_429_after_shared_window(monkeypatch):
    reset_policy_state_for_tests()
    monkeypatch.setattr("public_ai_policy.PUBLIC_AI_RATE_LIMIT_PER_MINUTE", 1)
    await enforce_public_ai_policy(Request())
    with pytest.raises(HTTPException) as exc:
        await enforce_public_ai_policy(Request())
    assert exc.value.status_code == 429
    assert exc.value.headers["Retry-After"] == "60"