"""
LitigaForge — portable LiteLLM helpers.

Thin, provider-agnostic wrappers around litellm. Used as the PRIMARY path for:
  • judgment summarisation  (judgment_ingest._summarize)
  • the public legal Q&A endpoint  (/ask)

The multi-provider cascade in ai_brain.py stays as the fallback: whenever these
helpers raise or return empty, callers fall through to that cascade.

litellm is imported lazily (it is a heavy import) so backend startup stays fast;
the first call pays the import cost.
"""
import logging
import os

from llm.config import (
    LLM_MODEL, LLM_MAX_TOKENS, LLM_TEMPERATURE, LLM_TIMEOUT,
    LLM_API_BASE, LLM_API_KEY, LEGAL_SYSTEM_PROMPT,
    is_configured, provider_label,
)

logger = logging.getLogger("litigaforge.legal_llm")

# Re-export so callers only need `from llm import legal_llm`.
__all__ = [
    "complete", "acomplete", "ask_legal_question", "aask_legal_question",
    "is_configured", "provider_label",
]

_litellm = None


def _lib():
    """Lazy-import and configure litellm exactly once."""
    global _litellm
    if _litellm is None:
        os.environ.setdefault("LITELLM_LOG", "ERROR")
        import litellm  # heavy import — kept out of module scope on purpose
        litellm.suppress_debug_info = True
        litellm.telemetry = False
        litellm.drop_params = True
        _litellm = litellm
    return _litellm


def _messages(system, user):
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": user})
    return msgs


def _kwargs(max_tokens, temperature):
    kw = {
        "model": LLM_MODEL,
        "max_tokens": int(max_tokens or LLM_MAX_TOKENS),
        "temperature": LLM_TEMPERATURE if temperature is None else float(temperature),
        "timeout": LLM_TIMEOUT,
        "num_retries": 0,
    }
    if LLM_API_BASE:
        kw["api_base"] = LLM_API_BASE
    if LLM_API_KEY:
        kw["api_key"] = LLM_API_KEY
    return kw


def _text(resp) -> str:
    try:
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return ""


def complete(system: str, user: str, temperature=None, max_tokens=None) -> str:
    """Synchronous completion. Raises on transport/provider error."""
    resp = _lib().completion(messages=_messages(system, user),
                             **_kwargs(max_tokens, temperature))
    return _text(resp)


async def acomplete(system: str, user: str, temperature=None, max_tokens=None) -> str:
    """Async completion — preferred inside FastAPI handlers. Raises on error.

    The signature mirrors ai_brain's ``*_async`` callers
    ``(system, user, temperature, max_tokens)`` so this can be slotted straight
    into their cascade tuples as the primary provider.
    """
    resp = await _lib().acompletion(messages=_messages(system, user),
                                    **_kwargs(max_tokens, temperature))
    return _text(resp)


# ── Convenience helpers ────────────────────────────────────────────────────────
def ask_legal_question(question: str, context: str = "", language: str = "en") -> str:
    """Synchronous legal Q&A using the shared legal system prompt."""
    system = LEGAL_SYSTEM_PROMPT
    if context:
        system = f"{system}\n\nRelevant context:\n{context}"
    return complete(system, question)


async def aask_legal_question(question: str, context: str = "", language: str = "en") -> str:
    """Async variant of :func:`ask_legal_question` for FastAPI handlers."""
    system = LEGAL_SYSTEM_PROMPT
    if context:
        system = f"{system}\n\nRelevant context:\n{context}"
    return await acomplete(system, question)
