---
name: ForgeOS Business Pulse + daily Product Health Check
description: Two ForgeOS-adjacent features built for real-world value — a recurring live-metrics CEO memo, and a deterministic end-to-end product-health verification run.
---

## Business Pulse

A recurring ForgeOS mission (seeded schedule, every 6h, agent "CEO") that computes fresh live metrics each run (signups/cases/matches/pending-verifications/contact-messages today, MRR, AI cost) and asks the LLM to read out only what's actionable in those numbers — no generic advice.

**Why a `builder` hook in the scheduler, not a static mission template:** ForgeOS schedules normally stamp out a fixed `mission_template` verbatim. Business Pulse needs the title/description to contain numbers that are true *at run time*, not at schedule-creation time. The scheduler's `_run_due_schedules()` special-cases `builder == "business_pulse"` to call a builder function and use its (title, description) instead of the template — this is the pattern to extend for any future "computed-content" mission.

**Why it can return `None`:** if `orchestrator._daily_cost_cap_exceeded()`, the builder returns None and the scheduler advances `next_run_at` + logs `pulse.skipped_cost_cap` without creating a mission at all (never a broken/empty mission). Follow this fail-quiet-not-fail-loud pattern for any other cost-gated recurring mission.

## Daily Product Health Check

Deterministic (non-LLM) end-to-end check that the product's core flows actually work — DB, a few key public GETs, and a real login+session round trip via a reserved test account. Lives at `artifacts/litigaforge-ai/health_check.py`, **outside** `forgeos/` and independent of `FORGEOS_ENABLED`, because it must keep running even if the multi-agent subsystem is off — it proves the product works, not the agent tooling.

**Reserved test account, no stored secret:** a well-known email (`healthcheck@litigaforge.test`) gets a freshly random password generated and bcrypt-hashed into the DB on *every* run, used immediately for a real `/auth/login` + `/auth/me` round trip, then discarded. Avoids ever needing a stored credential for an automated login check.

**Two-severity model:** CRITICAL (DB, public reads, login/session) pages the founder via `send_founder_alert` on any failure; DEGRADED (AI-provider connectivity via `/llm/health?probe=true`, which itself never returns non-200 — must check the JSON `status` field) never pages — a flaky LLM call is not "the product is down". Keep this severity split when adding new checks: anything that isn't core-flow-breaking belongs in DEGRADED.

**Verification gotcha:** litigaforge-ui is a Vite app, but the shared proxy's `/` route (what `screenshot`/`runTest`/`curl` hit) is served by **api-server's built dist**, not the Vite dev server (see `litigaforge-proxy-screenshot.md`). Any new frontend surface (like a dashboard card) needs `PORT=23790 BASE_PATH=/ pnpm --filter @workspace/litigaforge-ui run build` + an api-server restart before an e2e test will ever see it — a missing card in a first `runTest` pass is very often a stale-build artifact, not a real bug. Confirm via a second `runTest` run after rebuilding before concluding a real regression exists.

**Full backend test-suite flakiness:** running all of `tests/` together intermittently fails 1-2 unrelated forgeos tests (`test_forgeos_dashboard.py`, `test_forgeos_missions.py`) with asyncpg `InterfaceError`/`RuntimeError: Event loop is closed` — this is cross-file event-loop/pool pollution in the test run, not a real regression. Always re-run the specific failing file(s) in isolation before treating a full-suite failure as real.
