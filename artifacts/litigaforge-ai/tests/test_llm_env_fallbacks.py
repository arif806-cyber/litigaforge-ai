from llm import config


def test_direct_provider_keys_take_precedence_over_replit_integrations(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "direct-anthropic")
    monkeypatch.setenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY", "replit-anthropic")
    monkeypatch.setenv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "https://replit.example/v1")
    monkeypatch.setenv("OPENAI_API_KEY", "direct-openai")
    monkeypatch.setenv("AI_INTEGRATIONS_OPENAI_API_KEY", "replit-openai")
    monkeypatch.setenv("AI_INTEGRATIONS_OPENAI_BASE_URL", "https://replit.example/v1")
    monkeypatch.setenv("GEMINI_API_KEY", "direct-gemini")
    monkeypatch.setenv("AI_INTEGRATIONS_GEMINI_API_KEY", "replit-gemini")
    monkeypatch.setenv("AI_INTEGRATIONS_GEMINI_BASE_URL", "https://replit.example/v1")

    assert config._resolve_creds("anthropic/claude-sonnet-4-6") == (None, "direct-anthropic")
    assert config._resolve_creds("gpt-4o-mini") == (None, "direct-openai")
    assert config._resolve_creds("gemini/gemini-2.5-flash") == (None, "direct-gemini")


def test_replit_integrations_remain_fallback_for_all_standard_providers(monkeypatch):
    for name in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "https://replit.example/anthropic")
    monkeypatch.setenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY", "replit-anthropic")
    monkeypatch.setenv("AI_INTEGRATIONS_OPENAI_BASE_URL", "https://replit.example/openai")
    monkeypatch.setenv("AI_INTEGRATIONS_OPENAI_API_KEY", "replit-openai")
    monkeypatch.setenv("AI_INTEGRATIONS_GEMINI_BASE_URL", "https://replit.example/gemini")
    monkeypatch.setenv("AI_INTEGRATIONS_GEMINI_API_KEY", "replit-gemini")

    assert config._resolve_creds("anthropic/claude-sonnet-4-6") == (
        "https://replit.example/anthropic", "replit-anthropic")
    assert config._resolve_creds("openai/gpt-4o-mini") == (
        "https://replit.example/openai", "replit-openai")
    assert config._resolve_creds("gemini/gemini-2.5-flash") == (
        "https://replit.example/gemini", "replit-gemini")
