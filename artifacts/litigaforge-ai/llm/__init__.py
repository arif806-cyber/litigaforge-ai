"""Portable LiteLLM AI layer for LitigaForge.

See llm/config.py for provider selection (one env var: LLM_MODEL) and
llm/legal_llm.py for the thin, provider-agnostic helpers. The existing
ai_brain.py multi-provider cascade remains the fallback everywhere.
"""
