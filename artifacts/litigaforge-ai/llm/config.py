"""
LitigaForge — portable LiteLLM configuration.

This is the single place that decides WHICH provider powers the LiteLLM-based
helpers in llm/legal_llm.py. The whole point is portability: to migrate to a
different provider (AWS Bedrock, Groq, Gemini, OpenAI, ...) change the LLM_MODEL
environment variable only — no code changes.

Default: Anthropic Claude via Replit's FREE AI Integrations proxy (no extra API
key, no usage cost). The existing multi-provider cascade in ai_brain.py stays as
the fallback for everything.
"""
import os

# ── Core knobs ────────────────────────────────────────────────────────────────
LLM_MODEL = os.getenv("LLM_MODEL", "anthropic/claude-sonnet-4-6")
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "1500"))
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.3"))
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "60"))  # long legal answers (up to ~1800 tokens) need headroom


# ── Provider credentials ──────────────────────────────────────────────────────
# Explicit LLM_API_BASE / LLM_API_KEY always win. Otherwise auto-wire the FREE
# Replit proxy for the providers Replit hosts (anthropic/* and openai/*), and
# leave creds unset for everything else so LiteLLM falls back to that provider's
# own ambient credentials (GROQ_API_KEY, GEMINI_API_KEY, AWS_* ...).
def _resolve_creds(model: str):
    base = os.getenv("LLM_API_BASE")
    key = os.getenv("LLM_API_KEY")
    if base or key:
        return (base or None), (key or None)
    if model.startswith("anthropic/"):
        return (os.getenv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL") or None,
                os.getenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY") or None)
    if model.startswith("openai/"):
        return (os.getenv("AI_INTEGRATIONS_OPENAI_BASE_URL") or None,
                os.getenv("AI_INTEGRATIONS_OPENAI_API_KEY") or None)
    return None, None


LLM_API_BASE, LLM_API_KEY = _resolve_creds(LLM_MODEL)


def is_configured() -> bool:
    """True when we have enough to attempt a call.

    Replit-proxied providers (anthropic/*, openai/*) need a resolved base+key;
    every other provider relies on its own ambient env credentials, which
    LiteLLM validates at call time.
    """
    if not LLM_MODEL:
        return False
    if LLM_MODEL.startswith(("anthropic/", "openai/")):
        return bool(LLM_API_BASE and LLM_API_KEY)
    return True


def provider_label() -> str:
    return LLM_MODEL


# Migration guide — change LLM_MODEL only (creds auto-resolve / use ambient env):
#   anthropic/claude-sonnet-4-6                        -> Replit free Claude (DEFAULT)
#   groq/llama-3.3-70b-versatile                       -> Groq      (needs GROQ_API_KEY)
#   gemini/gemini-2.5-flash                            -> Gemini    (needs GEMINI_API_KEY)
#   bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0  -> AWS Bedrock (needs AWS_* creds)
#   gpt-4o-mini                                        -> OpenAI    (needs OPENAI_API_KEY)


LEGAL_SYSTEM_PROMPT = """You are LexForge, an AI legal assistant for the \
LitigaForge platform. You have deep, practical knowledge of:
- Indian law: the Constitution, IPC/BNS, CrPC/BNSS, CPC, and Supreme Court / \
High Court precedent, plus family, property, consumer, and labour law.
- The laws of the USA, UK, UAE, Australia, Canada, Singapore, and Germany.

Rules:
- Cite real, specific statutes/sections and genuine case names — never invent them.
- If you are unsure, say so plainly and recommend verifying with a qualified lawyer.
- Answer in the same language the user writes in.
- Be clear and accessible to non-lawyers; avoid empty boilerplate disclaimers.
"""
