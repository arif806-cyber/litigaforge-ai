---
name: ForgeOS multi-agent orchestration subsystem
description: How the ForgeOS module in litigaforge-ai is gated, tested, and wired — read before touching forgeos/* or FORGEOS_ENABLED.
---

ForgeOS (`artifacts/litigaforge-ai/forgeos/`) is a self-contained multi-agent orchestration subsystem (Agent Registry, Orchestrator, Mission/Workflow engines, Shared Memory, Event Bus, Scheduler, Approval Engine) bolted onto the existing FastAPI app.

- **Fail-closed gating**: everything (schema init, agent seed, scheduler task, `/forgeos/*` router include) is wrapped behind a single `FORGEOS_ENABLED` env var read in `forgeos/config.py`. When unset, `main.py` logs `forgeos: FORGEOS_ENABLED not set — subsystem disabled (inert)` and creates zero tables/routes — verified by direct log inspection after restart, not just code reading.
  **Why:** the subsystem was built inside a production app with real users; it must be provably a no-op until explicitly turned on.
  **How to apply:** any new forgeos capability must be added behind the same flag (or a sub-flag under it), never unconditionally imported/executed from `main.py` module scope.

- **Testing strategy**: unit tests for forgeos (`tests/test_forgeos_*.py`) mock DB/LLM entirely — no live Postgres needed, fast and CI-safe. Flag-on E2E (real DB, real LLM calls) was verified manually via curl in dev with `FORGEOS_ENABLED` temporarily set, then all test rows deleted and the flag unset again to restore inert state.
  **Why:** keeps the fast test suite decoupled from live infra while still proving the real path works end-to-end at least once.
  **How to apply:** when extending forgeos, add a mocked unit test first; only use a temporary live flag-on session for one-off E2E confidence, then always clean up DB rows and unset the flag.

- **Pre-existing unrelated test failures**: `tests/test_auth.py::test_healthz`, `test_root`, `test_register_success`, `test_login_success` fail on this codebase even in complete isolation from forgeos changes (stale `ai_mode` health assertion, dev-mode root 404, and a real `store_refresh_token` DB call that isn't mocked, hitting `ConnectionRefusedError` against a fake DATABASE_URL). Confirmed pre-existing by running `test_auth.py` alone with zero forgeos files collected — same 4 failures.
  **Why:** avoids mistakenly attributing legacy test drift to new subsystem work.
  **How to apply:** if these 4 tests resurface as "broken by my change," first check they still fail with forgeos entirely excluded before investigating further.
