"""
LiteLLM health / diagnostics router.

GET {BASE_PATH}/llm/health
    -> cheap config status by default (active provider + whether creds resolved).
       No provider call is made, so monitors/bots can poll it freely.
GET {BASE_PATH}/llm/health?probe=true
    -> additionally runs ONE live test completion. The result is cached for
       _PROBE_TTL seconds and the route is rate-limited, so the live probe
       cannot be used to hammer the provider or tie up async workers.

Resilient by design: a provider failure returns status "degraded" with detail
rather than a 500.
"""
import logging
import time

from fastapi import APIRouter, Request

from llm import legal_llm
from llm.config import is_configured, provider_label
from rate_limit import limiter

logger = logging.getLogger("litigaforge.llm")
router = APIRouter(tags=["llm"])

_TEST_QUESTION = (
    "What is Article 21 of the Indian Constitution? Answer in 2-3 sentences."
)
_PROBE_TTL = 300.0  # serve a live-probe result from cache for 5 minutes
_probe_cache: dict = {"at": 0.0, "data": None}


@router.get("/llm/health")
@limiter.limit("6/minute")
async def llm_health(request: Request, probe: bool = False):
    out = {
        "status": "ok",
        "provider": provider_label(),
        "configured": is_configured(),
    }
    if not is_configured():
        out["status"] = "unconfigured"
        out["detail"] = "No provider credentials resolved for the current LLM_MODEL."
        return out
    if not probe:
        return out

    # Live probe — served from cache when fresh to avoid hammering the provider.
    now = time.monotonic()
    cached = _probe_cache["data"]
    if cached and (now - _probe_cache["at"]) < _PROBE_TTL:
        return {**cached, "cached": True}

    try:
        answer = (await legal_llm.aask_legal_question(_TEST_QUESTION) or "").strip()
        if answer:
            out["test_response"] = answer
        else:
            out["status"] = "degraded"
            out["detail"] = "Provider returned an empty response."
    except Exception as e:  # never 500 the health check
        out["status"] = "degraded"
        out["detail"] = f"{type(e).__name__}: {e}"[:300]
        logger.warning("[/llm/health] live probe failed: %s", e)

    _probe_cache["at"] = now
    _probe_cache["data"] = dict(out)
    return {**out, "cached": False}
