# ForgeOS — Multi-Agent Orchestration Subsystem

Internal ops tool for running/reviewing autonomous "agent" tasks (missions and
multi-step workflows) against the LLM stack already used elsewhere in
LitigaForge. It is **disabled by default** and fully inert until an operator
opts in.

## Enabling it

Set the secret `FORGEOS_ENABLED=true`. Nothing else needs to change.

- **Unset/false (default):** `main.py` never imports anything under
  `forgeos/`. No tables are created, no routes are mounted at
  `{BASE_PATH}/forgeos`, no scheduler runs, and the `/forgeos` page in
  litigaforge-ui shows a graceful "failed to load" message (backend 404s).
- **true:** on the next startup, ForgeOS creates its tables
  (`forgeos_schema.py`), seeds 10 default agents, mounts the router, and
  starts the background scheduler.

This flag is intentionally left untouched by any automated work — flipping it
is an explicit operator decision (see `replit.md`).

## Access control

Every route under `/forgeos/*` requires `is_superuser` — this is an internal
tool, not a feature exposed to clients/lawyers. This includes read-only GETs
(agents, missions, dashboard, audit log): they leak LLM outputs, agent KPIs,
and real revenue/cost figures that must never reach a non-admin. The `/forgeos`
sidebar link and page in litigaforge-ui are separately gated client-side by
`is_superuser`, but that's a UI convenience only — the backend gate is what
actually matters.

## Mission lifecycle

```
planned → waiting → assigned → running → reviewing → completed / failed / cancelled
```

`waiting` means the mission needs human approval before it can proceed
(`requires_approval=true` at creation); approving via
`POST /forgeos/approvals/{id}/approve` moves it to `assigned` and launches it.

## Scheduler — stuck-mission recovery

Because ForgeOS is a **single-process, single-VM subsystem** (mission
execution is tracked via an in-memory `_active_tasks` map, not a distributed
job queue), a process restart mid-mission can orphan a mission in a
non-terminal state forever. The scheduler polls periodically
(`FORGEOS_SCHEDULER_POLL_SECONDS`, default 60s) and reconciles:

| Status | Threshold | Behavior |
|---|---|---|
| `assigned` | `FORGEOS_STUCK_ASSIGNED_SECONDS` (120s) | If not in `_active_tasks`, re-launch — its `execute_mission()` task never got to run. |
| `running` | `FORGEOS_STUCK_RUNNING_SECONDS` (600s) | If not in `_active_tasks`, reassign to a replacement agent and relaunch; if none available, mark `failed` + fire a founder alert. |
| `waiting` | `FORGEOS_STUCK_WAITING_SECONDS` (1800s) | Never touched/reassigned (a human decision is what's missing, not agent capacity) — fires a **deduplicated** founder alert instead. |

The "is it still active" check (`_active_tasks`) is what stops the scheduler
from misflagging a mission that's genuinely mid-flight in the *same* process
as stuck — only orphans (no task/coroutine tracking them) are reconciled.

`forgeos_schedules` (recurring schedule definitions) exists as a DB table and
`_run_due_schedules` executes due rows, but there is **no CRUD API** to create
schedules — that's out of scope for this pass. The table is schema-only /
seed-only for now.

## Cost & token safeguards

`FORGEOS_DAILY_COST_LIMIT_USD` (default `0` = no cap) sets a **soft, best-effort**
daily spend ceiling. Before dispatching a mission's LLM call,
`orchestrator.run_agent_task()` sums today's `forgeos_metrics` rows where
`metric_type='llm_cost_usd'` (the same rows the Command Center's "AI Cost"
widget totals) and, if the cap is already exceeded, short-circuits with a
clean error field instead of making the call — logged via `logger.error`, not
a silent skip.

Caveats (accept these, don't try to "fix" them without discussion):

- **Soft, not hard.** With `FORGEOS_MAX_CONCURRENT_MISSIONS` missions in
  flight at once, a small overshoot past the cap is possible — the check
  happens per-mission-start, not with a distributed lock.
- **Only the metered path is counted.** LiteLLM calls report per-call
  usage into `forgeos_metrics`; the `ai_brain.py` cascade fallback (used
  elsewhere in LitigaForge, and reachable as a fallback here too) has no
  per-call usage reporting, so any spend routed through it is invisible to
  both this cap and the dashboard's "AI Cost" widget.

## Command Center UI

`/forgeos` (superuser-only) — Overview (KPI row, agent grid, missions panel,
activity feed), Approvals, Deployments (live GitHub PR/workflow-run queue),
Audit Log. Live-updates via SSE (`GET /forgeos/stream`).

The **"Create Test Mission"** button (Overview header, superuser-only) posts a
one-off smoke-test mission (`POST /forgeos/missions`, no approval required,
routed to the first `active` seeded agent) so an operator can verify the
pipeline end-to-end without needing `curl`/Postman. It's a manual trigger only
— no recurring schedule is wired to it.

## Testing

All ForgeOS unit tests run against a **mocked DB layer** (no live Postgres
required) — `database.fetch`/`execute`/`fetchrow` and module-level functions
are monkeypatched directly:

- `tests/test_forgeos_orchestrator.py` — primary/fallback model routing,
  both-fail handling, daily cost-cap enforcement + bypass-when-unset.
- `tests/test_forgeos_scheduler.py` — stuck detection for each status
  (skip-when-still-active vs. relaunch/reassign-when-orphaned), replacement
  agent selection, no-replacement → fail + alert, alert de-dup,
  `_run_due_schedules` success and failure-still-advances-next-run.
- `tests/test_forgeos_workflows.py` — workflow creation validation
  (agent-by-id/by-name, oversized input), step ordering, halt-on-approval,
  halt-on-failure, resume-after-approval (continue/fail), step rejection.
- `tests/test_forgeos_dashboard.py` — mission-count rollups, revenue/MRR math
  from subscription tiers, AI-cost aggregation (incl. unmetered-call count),
  merged/sorted activity feed, full dashboard snapshot assembly.
- `tests/test_forgeos_missions.py`, `test_forgeos_registry.py`,
  `test_forgeos_router.py`, `test_forgeos_approvals.py`,
  `test_forgeos_events.py`, `test_forgeos_memory.py` — pre-existing coverage
  (agent registry, mission CRUD, router auth gating, approvals, event bus,
  agent memory).

Run just ForgeOS tests: `cd artifacts/litigaforge-ai && python3 -m pytest tests/test_forgeos_*.py -q`

Note: `tests/test_endpoints.py` is a live-server integration suite (real HTTP
calls to a running backend, with real `time.sleep()` rate-limit retries) — it
is unrelated to ForgeOS and not meant to run under a short timeout; run it
separately against a live workflow if needed. `tests/test_auth.py` has 4
pre-existing failures unrelated to ForgeOS (require a live Postgres
connection / differ on `healthz`+`root` response shape).

## Replit Deployment

ForgeOS ships **disabled** and stays disabled through a normal deploy — enabling
it in production is a deliberate, separate step.

**Recommended way to enable (Replit Secrets, not `.env`):**

1. Open the Secrets pane (padlock icon) in the Replit workspace.
2. Add `FORGEOS_ENABLED` = `true`. Optionally tune these alongside it (all
   have safe defaults if omitted — see `forgeos/config.py`):
   - `FORGEOS_MAX_CONCURRENT_MISSIONS` (default `2`)
   - `FORGEOS_SCHEDULER_POLL_SECONDS` (default `60`)
   - `FORGEOS_DAILY_COST_LIMIT_USD` (default `0` = no cap — set a real number,
     e.g. `5`, before any production use)
3. Set these as **shared** secrets so both dev and prod see the same value,
   unless you specifically want ForgeOS on in dev only.
4. **Republish/redeploy** — the deployed app builds a separate production
   process from the workspace, so a new secret only takes effect after a
   restart of that process (dev workflow restarts pick it up immediately).

**Pre-flight checklist before flipping `FORGEOS_ENABLED=true` in production:**

- [ ] At least one real user account has `is_superuser = true` — every
      `/forgeos/*` route (including read-only GETs) 403s for everyone else.
- [ ] `FORGEOS_DAILY_COST_LIMIT_USD` is set to a number you're comfortable
      losing in the worst case (remember: it's a *soft* cap — see caveats
      below — and it doesn't cover the `ai_brain` fallback path).
- [ ] `FORGEOS_MAX_CONCURRENT_MISSIONS` matches your app's spare event-loop
      capacity — ForgeOS runs in-process alongside the rest of the API.
- [ ] You've reviewed the mission lifecycle and scheduler thresholds below so
      an alert or a `failed` mission isn't a surprise.
- [ ] You know how to turn it back off: unset `FORGEOS_ENABLED` (or set it to
      `false`) and republish — this is fully reversible and destroys nothing
      (tables and history are left in place, just unreachable).
- [ ] After enabling, log into `/forgeos` as a superuser and click **"Create
      Test Mission"** to confirm the pipeline runs end-to-end before relying
      on it for anything real.
- [ ] Watch the Command Center's Overview (AI Cost, mission counts) and the
      Audit Log for the first real missions before turning on any heavier
      usage.

## Where things live

```
forgeos/
  config.py        env-var settings, FORGEOS_ENABLED gate
  schema.py        table DDL (forgeos_agents, forgeos_missions,
                    forgeos_workflows, forgeos_workflow_steps,
                    forgeos_events, forgeos_metrics, forgeos_approvals,
                    forgeos_audit_log, forgeos_schedules)
  seed.py          default 10-agent roster
  registry.py      agent CRUD
  missions.py      mission CRUD + status transitions
  orchestrator.py  run_agent_task() — LLM dispatch, primary/fallback model,
                   daily cost-cap check
  workflows.py     multi-step workflow engine (sequential, per-step approval)
  scheduler.py     stuck-mission reconciliation + due-schedule runner
  approvals.py     approval CRUD + resume/cancel on decide
  events.py        in-process pub/sub bus
  audit.py         audit log CRUD
  dashboard.py     Command Center snapshot aggregation (missions, revenue,
                    AI cost, activity feed)
  github.py        live GitHub PR/workflow-run queue for Deployments tab
  router.py        FastAPI routes, all superuser-gated
```
