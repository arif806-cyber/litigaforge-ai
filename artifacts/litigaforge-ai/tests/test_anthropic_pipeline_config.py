import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from llm.anthropic_pipeline import MODEL_CONFIG, _payload, estimate_cost


def test_requested_feature_model_routing_is_explicit():
    assert MODEL_CONFIG["drafting"] == "claude-fable-5-1"
    assert MODEL_CONFIG["what_if"] == "claude-fable-5-1"
    assert MODEL_CONFIG["workspace_research"] == "claude-opus-5-5"
    assert MODEL_CONFIG["legal_qa"] == "claude-opus-5-5"
    assert MODEL_CONFIG["citation_verification"] == "claude-haiku-5-5"


def test_payload_uses_anthropic_prompt_cache_and_no_sampling_overrides():
    payload = _payload("legal_qa", "cached system", "cached context", 2000)
    assert payload["model"] == "claude-opus-5-5"
    assert payload["max_tokens"] == 2000
    assert payload["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert payload["messages"][0]["content"][0]["cache_control"] == {"type": "ephemeral"}
    assert "temperature" not in payload and "top_p" not in payload


def test_cost_estimate_uses_pricing_file_and_cache_usage():
    assert round(estimate_cost("claude-opus-5-5", 1_000_000, 1_000_000), 2) == 24.0
    assert round(estimate_cost("claude-fable-5-1", 1_000_000, 1_000_000), 2) == 60.0
    assert estimate_cost("unknown", 10, 10) is None
