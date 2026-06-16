---
name: LitigaForge IndianKanoon ingestion
description: How the judgment_ingest pipeline pulls case law, and the dev-vs-prod operational model for activating it.
---

# IndianKanoon judgment ingestion

`artifacts/litigaforge-ai/judgment_ingest.py` populates the `judgments` table from
IndianKanoon's **official paid API** (`api.indiankanoon.org`), gated on the
`INDIANKANOON_API_TOKEN` secret. It NEVER scrapes the website and NEVER fabricates
data — fail-closed: no token = benign no-op; token set + API failure = raises loud.

**As of 2026-06-16 the token IS configured** (a valid 40-char token), so ingestion
is live.

## Operational model (the non-obvious part)
- **Daily scheduler is PRODUCTION-ONLY.** `start_scheduler()` is gated on `_is_prod()`
  and fires at 06:00 IST (00:30 UTC). The dev workspace NEVER auto-ingests, even with
  the token set — this is by design, not a bug.
- **Manual run works anywhere** (no prod gate inside `run_ingestion`): call
  `run_ingestion(max_docs=N, trigger="manual")`, or hit the superuser endpoint
  `POST {BASE_PATH}/admin/judgments/ingest/run`. A standalone python one-shot works
  because `get_pool()` lazily creates the asyncpg pool from `DATABASE_URL`.
- **Dev and prod have SEPARATE databases.** A manual test run in the dev workspace
  populates the DEV db only. To get fresh judgments into the LIVE app you must
  **republish** (then the prod 06:00 IST scheduler runs) or trigger the admin
  "run now" endpoint against production.

## Triggering prod ingestion over HTTP — ONE doc per request
The admin endpoint `POST {BASE_PATH}/admin/judgments/ingest/run?max_docs=N` runs
`run_ingestion` **synchronously** inside the request. Each doc's AI summary takes
~30-47s, and the prod gateway cuts the client connection at ~60s; FastAPI then
cancels the request coroutine on client-disconnect, so the whole pass aborts and
inserts **0**. **Symptom:** `curl -s` returns an empty body, prod count unchanged,
and NO `[manual]: starting` line ever reaches the deployment logs (the request died
before/at the cut). **Fix:** call with `max_docs=1` (finishes in one summary, ~30-47s,
under the gateway limit) and repeat sequentially — the advisory lock serializes them
and dedup (`skipped_existing`) walks through the query's result set, 1 new row per
call. Larger batches only work for the in-process **daily cron**, which has no
gateway timeout. To auth: log in as the `ADMIN_EMAILS` account (password = the
`ADMIN_RESET_PASSWORD` secret applied on the last deploy) via `POST /auth/login`
→ `{token}`, then `Authorization: Bearer`. Secrets live in the **bash** tool env,
not the code_execution sandbox, so do the login+curl from bash. **Why:** prod is a
separate DB from dev and is read-only via executeSql, so the admin HTTP endpoint is
the only way to write judgments into prod out-of-band (besides republish + cron).

## Gotchas observed
- AI summary cascade: Claude and OpenAI frequently time out at 15s and fall through
  to Gemini, so each doc takes ~30s. `skipped_no_summary` stays 0 when a fallback
  succeeds; a non-zero value means a doc was discarded for lacking a summary.
- The default `"Supreme Court of India"` query can return 0 docs on a given day
  (date-window dependent), so manual seeding may yield only High Court cases — a
  specific SC case is NOT guaranteed to appear just by triggering ingestion.
- Queries are free-text (e.g. `"Telangana High Court sortby: mostrecent"`), so the
  API returns related courts too — inserted judgments may span other High Courts
  (saw Bombay/Chhattisgarh results under the Telangana query). Not a bug.
