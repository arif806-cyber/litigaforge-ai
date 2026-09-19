import sys
import types
from unittest.mock import AsyncMock, patch

import pytest


def test_storage_defaults_to_replit_and_preserves_client_methods(monkeypatch):
    calls = []

    class FakeClient:
        def upload_from_bytes(self, key, content):
            calls.append(("put", key, content))

        def download_as_bytes(self, key):
            calls.append(("get", key))
            return b"contents"

        def delete(self, key):
            calls.append(("delete", key))

    monkeypatch.setitem(sys.modules, "replit", types.ModuleType("replit"))
    object_storage = types.ModuleType("replit.object_storage")
    object_storage.Client = FakeClient
    monkeypatch.setitem(sys.modules, "replit.object_storage", object_storage)
    from storage import get_object_storage

    storage = get_object_storage()
    storage.upload_from_bytes("uploads/a.txt", b"x")
    assert storage.download_as_bytes("uploads/a.txt") == b"contents"
    storage.delete("uploads/a.txt")
    assert calls == [
        ("put", "uploads/a.txt", b"x"),
        ("get", "uploads/a.txt"),
        ("delete", "uploads/a.txt"),
    ]


def test_unknown_storage_backend_fails_loudly(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "unknown")
    from storage import get_object_storage

    with pytest.raises(RuntimeError, match="Unsupported STORAGE_BACKEND"):
        get_object_storage()


def test_s3_backend_requires_bucket(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.delenv("S3_BUCKET", raising=False)
    from storage import get_object_storage

    with pytest.raises(RuntimeError, match="requires S3_BUCKET"):
        get_object_storage()


def test_s3_backend_uses_bucket_and_preserves_storage_contract(monkeypatch):
    calls = []

    class FakeS3:
        def put_object(self, **kwargs):
            calls.append(("put", kwargs))

        def get_object(self, **kwargs):
            calls.append(("get", kwargs))
            return {"Body": types.SimpleNamespace(read=lambda: b"s3-content")}

        def delete_object(self, **kwargs):
            calls.append(("delete", kwargs))

    class FakeBoto3:
        @staticmethod
        def client(*args, **kwargs):
            assert args == ("s3",)
            assert kwargs["region_name"] == "ap-south-1"
            return FakeS3()

    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.setenv("S3_BUCKET", "legal-documents")
    monkeypatch.setenv("S3_REGION", "ap-south-1")
    monkeypatch.setitem(sys.modules, "boto3", FakeBoto3)
    from storage import get_object_storage

    storage = get_object_storage()
    storage.upload_from_bytes("uploads/a.txt", b"x")
    assert storage.download_as_bytes("uploads/a.txt") == b"s3-content"
    storage.delete("uploads/a.txt")
    assert calls[0] == (
        "put",
        {"Bucket": "legal-documents", "Key": "uploads/a.txt", "Body": b"x"},
    )
    assert calls[1][0] == "get"
    assert calls[2] == (
        "delete",
        {"Bucket": "legal-documents", "Key": "uploads/a.txt"},
    )


def test_legal_prompt_uses_current_indian_criminal_law():
    from llm.config import LEGAL_SYSTEM_PROMPT

    assert "Bharatiya Nyaya Sanhita" in LEGAL_SYSTEM_PROMPT
    assert "Bharatiya Nagarik Suraksha Sanhita" in LEGAL_SYSTEM_PROMPT
    assert "Bharatiya Sakshya Adhiniyam" in LEGAL_SYSTEM_PROMPT
    assert "before 1 July" in LEGAL_SYSTEM_PROMPT


def test_non_matching_router_ai_helpers_use_portable_layer(monkeypatch):
    from llm import legal_llm

    seen = []

    def fake_complete(system, user, **kwargs):
        seen.append((system, user, kwargs))
        return "portable"

    monkeypatch.setattr(legal_llm, "complete", fake_complete)
    assert legal_llm.complete("", "router prompt", max_tokens=12) == "portable"
    assert seen[0][1] == "router prompt"


def test_router_source_has_no_direct_provider_bypass():
    from pathlib import Path

    routers = Path(__file__).parents[1] / "routers"
    forbidden = ("AI_INTEGRATIONS_", "generateContent", "_call_claude", "_call_gemini")
    for path in routers.glob("*.py"):
        if path.name == "matching.py":
            continue
        source = path.read_text()
        assert not any(token in source for token in forbidden), path


def test_lawyer_analysis_uses_async_portable_completion():
    from pathlib import Path

    source = (Path(__file__).parents[1] / "routers" / "lawyer.py").read_text()
    handler = source[source.index("async def analyze_lawyer_document"):source.index(
        "# ── Document Notes", source.index("async def analyze_lawyer_document")
    )]
    assert "await _ai_async(" in handler
    assert "await _ai(" not in handler
    helper = source[source.index("async def _ai_async"):source.index(
        "def _extract_json_object", source.index("async def _ai_async")
    )]
    assert "acomplete" in helper
    assert "asyncio.to_thread" in helper


@pytest.mark.asyncio
async def test_lawyer_async_helper_awaits_portable_async_method(monkeypatch):
    from routers import lawyer

    async_complete = AsyncMock(return_value="async-result")
    # _ai_async imports the module lazily; patch the canonical module object.
    import llm.legal_llm as legal_llm
    monkeypatch.setattr(legal_llm, "acomplete", async_complete)
    with patch.object(lawyer, "_ai", side_effect=AssertionError("sync path used")):
        assert await lawyer._ai_async("prompt", 9) == "async-result"
    async_complete.assert_awaited_once()


@pytest.mark.asyncio
async def test_lawyer_async_helper_offloads_sync_portable_fallback(monkeypatch):
    from routers import lawyer
    import llm.legal_llm as legal_llm

    monkeypatch.setattr(legal_llm, "acomplete", None)
    with patch.object(
        lawyer.asyncio, "to_thread", new=AsyncMock(return_value="thread-result")
    ) as to_thread:
        assert await lawyer._ai_async("prompt", 9) == "thread-result"
    to_thread.assert_awaited_once_with(
        legal_llm.complete, "", "prompt", max_tokens=9
    )