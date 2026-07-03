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

- **`tests/test_endpoints.py` is a live-server integration suite** (real `httpx` calls to `localhost:5000`, with real `time.sleep(20)` rate-limit retries) — running it (or the full `pytest tests/`) under a short tool timeout silently kills the run with no output. It is unrelated to forgeos and any other unit-tested module.
  **Why:** wasted a `timeout`-guarded `pytest tests/` attempt before realizing the hang was this file, not a regression.
  **How to apply:** for "run the full suite" checks, run unit-test files explicitly (excluding `test_endpoints.py`) instead of a bare `pytest tests/ -q`, or only run it separately against a live workflow with a long timeout.

- **Monkeypatching a function that a module imported via `from X import fn`** must target the *importing* module's local name (`importing_module.fn`), not the origin module (`X.fn`) — the importing module already holds its own reference from import time, so patching the source has no effect. Hit this in `forgeos/dashboard.py`'s `_activity_feed` (which does `from forgeos.audit import list_audit_log`) specifically.
  **Why:** cost a debugging round-trip — tests patched `forgeos.audit.list_audit_log` and still hit the real (failing) DB call inside `dashboard._activity_feed`.
  **How to apply:** when unit-testing a function, check how it imported its dependencies; if imported by name (not `import module` + `module.fn()` call-sites), patch on the caller's module object.

- **Cost/token safeguard**: `FORGEOS_DAILY_COST_LIMIT_USD` (0/unset = no cap) is enforced once, inside `orchestrator.run_agent_task()` — the single choke point both `missions.execute_mission()` and `workflows._run_step()` call — by summing today's `forgeos_metrics` rows (`metric_type='llm_cost_usd'`, same rows the dashboard's "AI Cost" widget totals) before dispatch.
  **Why:** it's a soft/best-effort cap (concurrent in-flight missions can overshoot slightly) and only bounds the metered LiteLLM path — the unmetered `ai_brain` cascade fallback has no per-call usage reporting, so spend routed through it is invisible to both the cap and the dashboard.
  **How to apply:** don't treat this as a hard billing guarantee; if a hard guarantee is ever needed, it requires a distributed lock/reservation, not a read-then-check.

- **Observability convention**: mission/workflow/approval lifecycle transitions (creation, execution start, completion w/ model+tokens+cost, workflow step halt-for-approval, approve/reject decisions) each log one `logger.info` line via the shared `litigaforge.forgeos` logger — no new logger names, no per-call payload dumps (payloads can be large/PII-bearing).
  **Why:** lets an operator reconstruct "what happened and what did it cost" from workflow logs alone, without a DB query, while keeping the always-on dashboard/audit-log tables as the source of truth for anything queryable.
  **How to apply:** when adding a new lifecycle transition, follow the existing one-line `logger.info(...)` pattern at the same call sites (not inside tight loops), and never log full LLM prompts/outputs.

- **FORGEOS_ENABLED can be legitimately `true` in this dev workspace** (was observed enabled after an unrelated restart, subsystem logs "tables ready, agents seeded, scheduler started" with zero errors) — this reflects the operator's own choice, not a task-agent action; never flip it off silently to "restore the default," since the user may be actively using/testing it.
  **Why:** an earlier assumption that dev should always be reset to disabled after E2E testing is not a standing invariant — respect the flag's current state as intentional unless the user asks to change it.
  **How to apply:** treat `FORGEOS_ENABLED`'s live value as user-owned config; only change it if explicitly asked, and always verify via startup logs (not by inference from a stale memory note) whether it's currently on.
