"""Single-provider Anthropic path for the gated grounded legal pipeline.

No provider/model fallback is permitted here. Production callers remain on the
legacy path until the comparative evaluation gate explicitly passes.
"""
from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import AsyncIterator

import httpx

logger = logging.getLogger("litigaforge.anthropic_pipeline")
_CONFIG = json.loads((Path(__file__).with_name("model_config.json")).read_text())
MODEL_CONFIG = _CONFIG["models"]
PRICES = _CONFIG["pricing_usd_per_million_tokens"]
PUBLIC_RETRY_ERROR = "Couldn't complete, try again."


class AnthropicPipelineError(RuntimeError):
    """Safe-to-surface provider failure after the one permitted retry."""


def model_for(feature: str) -> str:
    try:
        return MODEL_CONFIG[feature]
    except KeyError as exc:
        raise ValueError(f"Unknown legal AI feature: {feature}") from exc


def _endpoint() -> tuple[str, str]:
    base = (os.getenv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL") or "").rstrip("/")
    key = (os.getenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY") or "").strip()
    if not base or not key:
        raise AnthropicPipelineError(PUBLIC_RETRY_ERROR)
    return (base if base.endswith("/v1") else base + "/v1") + "/messages", key


def estimate_cost(model: str, input_tokens: int, output_tokens: int,
                  cache_read_tokens: int = 0, cache_write_tokens: int = 0) -> float | None:
    price = PRICES.get(model)
    if not price:
        return None
    return (
        input_tokens * price["input"]
        + output_tokens * price["output"]
        + cache_read_tokens * price["cache_read"]
        + cache_write_tokens * price["cache_write_5m"]
    ) / 1_000_000


def _payload(feature: str, system: str, prompt: str, max_tokens: int) -> dict:
    model = model_for(feature)
    return {
        "model": model,
        "max_tokens": max(1, min(8192, int(max_tokens))),
        "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        "messages": [{
            "role": "user",
            "content": [{"type": "text", "text": prompt, "cache_control": {"type": "ephemeral"}}],
        }],
    }


async def complete(feature: str, system: str, prompt: str, max_tokens: int = 8192) -> dict:
    """Complete on the configured Anthropic model; retry once, never downgrade."""
    url, key = _endpoint()
    payload = _payload(feature, system, prompt, max_tokens)
    started = time.perf_counter()
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
                response = await client.post(
                    url, json=payload,
                    headers={
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                )
                response.raise_for_status()
                data = response.json()
            text = "".join(
                block.get("text", "") for block in data.get("content", [])
                if block.get("type") == "text"
            ).strip()
            if not text:
                raise ValueError("Anthropic returned no text content")
            usage = data.get("usage") or {}
            model = data.get("model") or model_for(feature)
            result = {
                "text": text,
                "model": model,
                "latency_ms": round((time.perf_counter() - started) * 1000),
                "input_tokens": int(usage.get("input_tokens", 0)),
                "output_tokens": int(usage.get("output_tokens", 0)),
                "cache_read_tokens": int(usage.get("cache_read_input_tokens", 0)),
                "cache_write_tokens": int(usage.get("cache_creation_input_tokens", 0)),
            }
            result["cost_usd"] = estimate_cost(
                model, result["input_tokens"], result["output_tokens"],
                result["cache_read_tokens"], result["cache_write_tokens"],
            )
            return result
        except Exception as exc:
            last_error = exc
            logger.warning("Anthropic feature=%s attempt=%s failed: %s",
                           feature, attempt + 1, type(exc).__name__)
    raise AnthropicPipelineError(PUBLIC_RETRY_ERROR) from last_error


async def stream(feature: str, system: str, prompt: str,
                 max_tokens: int = 8192) -> AsyncIterator[str]:
    """Stream text deltas; a retry is attempted only before any answer is emitted."""
    url, key = _endpoint()
    payload = _payload(feature, system, prompt, max_tokens)
    payload["stream"] = True
    for attempt in range(2):
        emitted = False
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
                async with client.stream(
                    "POST", url, json=payload,
                    headers={
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        event = json.loads(line[6:])
                        if event.get("type") == "content_block_delta":
                            delta = event.get("delta") or {}
                            if delta.get("type") == "text_delta" and delta.get("text"):
                                emitted = True
                                yield delta["text"]
            return
        except Exception as exc:
            logger.warning("Anthropic stream feature=%s attempt=%s failed: %s",
                           feature, attempt + 1, type(exc).__name__)
            if emitted or attempt:
                raise AnthropicPipelineError(PUBLIC_RETRY_ERROR) from exc
    raise AnthropicPipelineError(PUBLIC_RETRY_ERROR)
