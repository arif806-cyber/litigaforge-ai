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

## Gotchas observed
- AI summary cascade: Claude and OpenAI frequently time out at 15s and fall through
  to Gemini, so each doc takes ~30s. `skipped_no_summary` stays 0 when a fallback
  succeeds; a non-zero value means a doc was discarded for lacking a summary.
- Queries are free-text (e.g. `"Telangana High Court sortby: mostrecent"`), so the
  API returns related courts too — inserted judgments may span other High Courts
  (saw Bombay/Chhattisgarh results under the Telangana query). Not a bug.
