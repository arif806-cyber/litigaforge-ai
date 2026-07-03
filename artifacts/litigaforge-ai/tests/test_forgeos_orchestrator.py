"""
ForgeOS AI Orchestrator — unit tests with mocked LLM calls (no live litellm
call, no live Postgres). Covers the primary/fallback routing in
run_agent_task() and the daily cost-cap guard.
"""
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")

from forgeos import orchestrator

_AGENT = {"id": 5, "name": "Backend Engineer", "role": "Backend Engineer", "description": "Ships code."}


def _no_cap(monkeypatch):
    """Cost cap disabled — the default, and what most routing tests want."""
    monkeypatch.setattr(orchestrator, "FORGEOS_DAILY_COST_LIMIT_USD", 0)


@pytest.mark.asyncio
async def test_run_agent_task_uses_primary_path_on_success(monkeypatch):
    _no_cap(monkeypatch)

    async def fake_acomplete_with_usage(system_prompt, task_input, max_tokens=None):
        return {
            "text": "Here is the draft.", "model": "anthropic/claude-sonnet-4-6",
            "prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150,
            "cost_usd": 0.002,
        }

    import llm.legal_llm as legal_llm
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)

    result = await orchestrator.run_agent_task(_AGENT, "Draft the onboarding doc")
    assert result["error"] is None
    assert result["output"] == "Here is the draft."
    assert result["model_used"] == "anthropic/claude-sonnet-4-6"
    assert result["tokens"] == {"prompt": 100, "completion": 50, "total": 150}
    assert result["cost_usd"] == 0.002


@pytest.mark.asyncio
async def test_run_agent_task_falls_back_when_primary_returns_empty(monkeypatch):
    _no_cap(monkeypatch)

    async def fake_acomplete_with_usage(system_prompt, task_input, max_tokens=None):
        return {"text": "", "model": "", "prompt_tokens": 0, "completion_tokens": 0,
                "total_tokens": 0, "cost_usd": 0.0}

    async def fake_call_llm_async(system_prompt, task_input):
        return "Fallback output from the cascade."

    import llm.legal_llm as legal_llm
    import ai_brain
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)
    monkeypatch.setattr(ai_brain, "call_llm_async", fake_call_llm_async)

    result = await orchestrator.run_agent_task(_AGENT, "Draft the onboarding doc")
    assert result["error"] is None
    assert result["output"] == "Fallback output from the cascade."
    assert result["model_used"] == "ai_brain_cascade"
    assert result["tokens"] is None
    assert result["cost_usd"] is None


@pytest.mark.asyncio
async def test_run_agent_task_falls_back_when_primary_raises(monkeypatch):
    _no_cap(monkeypatch)

    async def fake_acomplete_with_usage(system_prompt, task_input, max_tokens=None):
        raise RuntimeError("litellm proxy unreachable")

    async def fake_call_llm_async(system_prompt, task_input):
        return "Fallback saved the day."

    import llm.legal_llm as legal_llm
    import ai_brain
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)
    monkeypatch.setattr(ai_brain, "call_llm_async", fake_call_llm_async)

    result = await orchestrator.run_agent_task(_AGENT, "task")
    assert result["error"] is None
    assert result["output"] == "Fallback saved the day."
    assert result["model_used"] == "ai_brain_cascade"


@pytest.mark.asyncio
async def test_run_agent_task_returns_error_when_both_paths_fail(monkeypatch):
    _no_cap(monkeypatch)

    async def fake_acomplete_with_usage(system_prompt, task_input, max_tokens=None):
        raise RuntimeError("litellm proxy unreachable")

    async def fake_call_llm_async(system_prompt, task_input):
        raise RuntimeError("all providers down")

    import llm.legal_llm as legal_llm
    import ai_brain
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)
    monkeypatch.setattr(ai_brain, "call_llm_async", fake_call_llm_async)

    result = await orchestrator.run_agent_task(_AGENT, "task")
    assert result["error"] == "all providers down"
    assert result["output"] == ""
    assert result["model_used"] is None


@pytest.mark.asyncio
async def test_run_agent_task_returns_error_when_fallback_returns_empty(monkeypatch):
    _no_cap(monkeypatch)

    async def fake_acomplete_with_usage(system_prompt, task_input, max_tokens=None):
        return {"text": "", "model": "", "prompt_tokens": 0, "completion_tokens": 0,
                "total_tokens": 0, "cost_usd": 0.0}

    async def fake_call_llm_async(system_prompt, task_input):
        return ""

    import llm.legal_llm as legal_llm
    import ai_brain
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)
    monkeypatch.setattr(ai_brain, "call_llm_async", fake_call_llm_async)

    result = await orchestrator.run_agent_task(_AGENT, "task")
    assert result["error"] == "All LLM providers returned empty output"
    assert result["model_used"] == "ai_brain_cascade"


@pytest.mark.asyncio
async def test_daily_cost_cap_disabled_by_default_skips_db_check(monkeypatch):
    """FORGEOS_DAILY_COST_LIMIT_USD <= 0 (the default) must short-circuit
    before ever touching the database."""
    monkeypatch.setattr(orchestrator, "FORGEOS_DAILY_COST_LIMIT_USD", 0)

    called = []

    async def fake_fetch(query, *args):
        called.append(query)
        return [{"total": 999}]

    import database
    monkeypatch.setattr(database, "fetch", fake_fetch)

    result = await orchestrator._daily_cost_cap_exceeded()
    assert result is None
    assert called == []


@pytest.mark.asyncio
async def test_run_agent_task_blocked_when_daily_cost_cap_reached(monkeypatch):
    monkeypatch.setattr(orchestrator, "FORGEOS_DAILY_COST_LIMIT_USD", 5.0)

    async def fake_fetch(query, *args):
        assert "llm_cost_usd" in query
        assert "CURRENT_DATE" in query
        return [{"total": 5.5}]

    import database
    monkeypatch.setattr(database, "fetch", fake_fetch)

    llm_called = []

    async def fake_acomplete_with_usage(system_prompt, task_input):
        llm_called.append(True)
        return {"text": "should never get here", "model": "x", "prompt_tokens": 1,
                "completion_tokens": 1, "total_tokens": 2, "cost_usd": 0.01}

    import llm.legal_llm as legal_llm
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)

    result = await orchestrator.run_agent_task(_AGENT, "task")
    assert result["error"] is not None
    assert "cost cap" in result["error"].lower()
    assert result["output"] == ""
    assert llm_called == []  # never even attempted the LLM call


@pytest.mark.asyncio
async def test_run_agent_task_allowed_when_under_daily_cost_cap(monkeypatch):
    monkeypatch.setattr(orchestrator, "FORGEOS_DAILY_COST_LIMIT_USD", 5.0)

    async def fake_fetch(query, *args):
        return [{"total": 1.0}]

    import database
    monkeypatch.setattr(database, "fetch", fake_fetch)

    async def fake_acomplete_with_usage(system_prompt, task_input, max_tokens=None):
        return {"text": "under budget", "model": "x", "prompt_tokens": 1,
                "completion_tokens": 1, "total_tokens": 2, "cost_usd": 0.01}

    import llm.legal_llm as legal_llm
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)

    result = await orchestrator.run_agent_task(_AGENT, "task")
    assert result["error"] is None
    assert result["output"] == "under budget"


@pytest.mark.asyncio
async def test_run_agent_task_warns_when_approaching_daily_cap_but_does_not_block(monkeypatch, caplog):
    """80% default threshold: $4 of a $5 cap should warn but still run."""
    monkeypatch.setattr(orchestrator, "FORGEOS_DAILY_COST_LIMIT_USD", 5.0)
    monkeypatch.setattr(orchestrator, "FORGEOS_COST_WARN_THRESHOLD_PCT", 80)

    async def fake_fetch(query, *args):
        return [{"total": 4.0}]

    import database
    monkeypatch.setattr(database, "fetch", fake_fetch)

    llm_called = []

    async def fake_acomplete_with_usage(system_prompt, task_input, max_tokens=None):
        llm_called.append(True)
        return {"text": "still ran", "model": "x", "prompt_tokens": 1,
                "completion_tokens": 1, "total_tokens": 2, "cost_usd": 0.01}

    import llm.legal_llm as legal_llm
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)

    # orchestrator.logger has propagate=False (see logger.py), so caplog's
    # root-logger handler never sees its records unless we propagate here.
    monkeypatch.setattr(orchestrator.logger, "propagate", True)
    with caplog.at_level("WARNING", logger="litigaforge.forgeos"):
        result = await orchestrator.run_agent_task(_AGENT, "task")

    assert result["error"] is None
    assert result["output"] == "still ran"
    assert llm_called == [True]
    assert any("approaching daily cost cap" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_run_agent_task_no_warning_when_well_under_threshold(monkeypatch, caplog):
    monkeypatch.setattr(orchestrator, "FORGEOS_DAILY_COST_LIMIT_USD", 5.0)
    monkeypatch.setattr(orchestrator, "FORGEOS_COST_WARN_THRESHOLD_PCT", 80)

    async def fake_fetch(query, *args):
        return [{"total": 1.0}]

    import database
    monkeypatch.setattr(database, "fetch", fake_fetch)

    async def fake_acomplete_with_usage(system_prompt, task_input, max_tokens=None):
        return {"text": "fine", "model": "x", "prompt_tokens": 1,
                "completion_tokens": 1, "total_tokens": 2, "cost_usd": 0.01}

    import llm.legal_llm as legal_llm
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)

    monkeypatch.setattr(orchestrator.logger, "propagate", True)
    with caplog.at_level("WARNING", logger="litigaforge.forgeos"):
        result = await orchestrator.run_agent_task(_AGENT, "task")

    assert result["error"] is None
    assert not any("approaching daily cost cap" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_warn_helper_skips_db_check_when_cap_disabled(monkeypatch):
    monkeypatch.setattr(orchestrator, "FORGEOS_DAILY_COST_LIMIT_USD", 0)

    called = []

    async def fake_fetch(query, *args):
        called.append(query)
        return [{"total": 999}]

    import database
    monkeypatch.setattr(database, "fetch", fake_fetch)

    await orchestrator._warn_if_approaching_daily_cap()
    assert called == []


@pytest.mark.asyncio
async def test_run_agent_task_passes_max_tokens_per_mission_when_set(monkeypatch):
    _no_cap(monkeypatch)
    monkeypatch.setattr(orchestrator, "FORGEOS_MAX_TOKENS_PER_MISSION", 500)

    captured = {}

    async def fake_acomplete_with_usage(system_prompt, task_input, max_tokens=None):
        captured["max_tokens"] = max_tokens
        return {"text": "capped", "model": "x", "prompt_tokens": 1,
                "completion_tokens": 1, "total_tokens": 2, "cost_usd": 0.01}

    import llm.legal_llm as legal_llm
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)

    result = await orchestrator.run_agent_task(_AGENT, "task")
    assert result["error"] is None
    assert captured["max_tokens"] == 500


@pytest.mark.asyncio
async def test_run_agent_task_passes_none_max_tokens_when_unbounded(monkeypatch):
    _no_cap(monkeypatch)
    monkeypatch.setattr(orchestrator, "FORGEOS_MAX_TOKENS_PER_MISSION", 0)

    captured = {}

    async def fake_acomplete_with_usage(system_prompt, task_input, max_tokens=None):
        captured["max_tokens"] = max_tokens
        return {"text": "unbounded", "model": "x", "prompt_tokens": 1,
                "completion_tokens": 1, "total_tokens": 2, "cost_usd": 0.01}

    import llm.legal_llm as legal_llm
    monkeypatch.setattr(legal_llm, "acomplete_with_usage", fake_acomplete_with_usage)

    result = await orchestrator.run_agent_task(_AGENT, "task")
    assert result["error"] is None
    assert captured["max_tokens"] is None
