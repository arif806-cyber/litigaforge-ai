---
name: LitigaForge portable LiteLLM layer
description: How the env-switchable LiteLLM AI layer works, why it defaults to the free Replit Claude proxy, and the non-obvious constraints (timeout, health endpoint, uv packager).
---

# Portable LiteLLM layer (artifacts/litigaforge-ai/llm/)

A provider-agnostic wrapper around `litellm`, switchable with the single env var
`LLM_MODEL`. Default `anthropic/claude-sonnet-4-6` routes through Replit's FREE
AI Integrations proxy. Migrated gradually onto it: judgment summarization +
public `/ask`. The `ai_brain.py` multi-provider cascade stays as the fallback.

## Non-obvious facts (worth keeping)

- **litellm reaches the FREE Replit proxy directly.** Use provider-prefixed model
  `anthropic/claude-sonnet-4-6` with `api_base=AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
  and `api_key=AI_INTEGRATIONS_ANTHROPIC_API_KEY`. The Replit base URLs have **no
  `/v1`**, and litellm's anthropic provider works against them as-is — empirically
  confirmed (returns real completions). No own ANTHROPIC_API_KEY exists / is needed.
  **Why:** lets the platform get free Claude through litellm's portable interface.
- **One-env-var provider switch.** `config._resolve_creds()` auto-wires the Replit
  proxy creds ONLY for `anthropic/*` and `openai/*` model prefixes; every other
  provider (groq/, gemini/, bedrock/, gpt-…) gets `api_base/api_key=None` so litellm
  uses that provider's own ambient env keys. Explicit `LLM_API_BASE`/`LLM_API_KEY`
  always override. `is_configured()` requires base+key for the two proxied prefixes.

## Gotchas

- **`LLM_TIMEOUT` must be ≥ 60s.** A full `/ask` legal answer (~1800 tokens) takes
  ~45-50s. A 30s default caused litellm.Timeout at exactly 30.0s, which then fell
  back to the cascade (correct, but slow + looks hung). Legacy `_claude` used 60s.
- **litellm import is heavy** — lazy-import it inside the call path, never at module
  scope, or backend startup slows; first call pays the cost. Disable telemetry.
- **A health/diagnostic endpoint that makes a live LLM call must be gated.** Default
  `/llm/health` returns cheap config status (no call); the live test is opt-in via
  `?probe=true`, cached 5 min, and rate-limited. **Why:** an unauthed live-LLM probe
  is a resource-exhaustion vector (monitors/bots tie up async workers for the whole
  timeout). Flagged as a must-fix in review.
- **Two backends, two prefixes — easy to confuse.** The Python (litigaforge-ai)
  FastAPI service is at `/litigaforge` (BASE_PATH); the Node api-server (Express) is
  at `/api` + `/`. The LLM route is Python, so its canonical URL is
  `/litigaforge/llm/health`. `/api/llm/health` only works because the api-server
  reverse-proxies `/api/llm/*` → `localhost:5000/litigaforge/llm/*` (mirrors the
  `/blog` proxy; server-to-service uses `LITIGAFORGE_API_ORIGIN`, default
  `http://localhost:5000`, reached directly not via the shared proxy). **Why:** users
  expect `/api/...`; the convenience proxy keeps both URLs working.
- **`uv` packager fails on Replit** (read-only nix store permission error) and as a
  side effect `uv init` drops a stray root `main.py` + `pyproject.toml`
  (`name = repl-nix-workspace`). Install Python deps with `pip install` directly
  (lands in `.pythonlibs`), pin them into the artifact's `requirements.txt`, and
  delete the stray root stubs.

## Integration shape

- `legal_llm.acomplete(system, user, temperature, max_tokens)` deliberately mirrors
  `ai_brain`'s `*_async` caller signature, so it slots straight into the
  `_summarize` cascade tuple as the primary entry.
- `/ask` passes `system=None` to mirror the legacy `_ai` (single user message); the
  endpoint prompt already embeds jurisdiction/instructions, so `LEGAL_SYSTEM_PROMPT`
  intentionally does NOT govern `/ask` (it governs the `ask_legal_question` helper +
  `/llm/health` probe).
