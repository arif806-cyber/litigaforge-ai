---
name: LitigaForge judgment slugs & tolerant redirects
description: Why existing judgment slugs are never renamed, how stale links auto-forward, and the startup-ensure convergence rule for curated landmark cases.
---

# Judgment URL slugs & tolerant redirects

## Existing slugs are NEVER renamed
Renaming a slug would break already-indexed Google links AND requires writing prod
(prod DB is read-only out-of-band — only the deployed app writes its own primary).
Instead, stale/truncated/wrong-court links **301-redirect** to the canonical URL.

**Why:** the user explicitly re-chose the tolerant-redirect approach over renaming.
**How to apply:** never change an existing `slug` value; add a redirect path instead.

## Resolve = UNIQUE-match only
`routers/judgments.py` `_resolve_canonical`: exact match first, then tolerant
(same-year preferred, court-agnostic, prefix match) — but only returns a target when
the candidate set collapses to exactly ONE `(court_slug, year, slug)`. An ambiguous
prefix returns nothing (no redirect) rather than guessing wrong.

## Redirect-loop safety
api-server `_judgmentRedirectTarget` (`app.ts`) only 301s when the resolver returns
`exact === false` AND the resolved path differs from the requested bare path. Canonical
URLs return `exact: true` → fall through to 200. Country prefix is preserved. 10-min cache.
Client-side net in `judgment-detail.tsx` (on load error → resolve → setLocation replace).

## Curated landmark judgments: always-upsert on startup
`_ensure_sample_judgments` (`main.py`, called from lifespan) runs on EVERY backend start
(no "table empty" gate) with `ON CONFLICT (court_slug, year, slug) DO NOTHING`. This is how
new curated cases (e.g. Maneka Gandhi) reach already-populated dev **and prod** DBs — they
land via the deployed app's own startup on republish.

**Gotcha — partial unique index on `source_url`:** there is a separate
`CREATE UNIQUE INDEX idx_judgments_source_url ... WHERE source_url IS NOT NULL`. The
`ON CONFLICT` clause only targets the slug tuple, so if prod already has the same case under
a *different* slug with the same `source_url`, the insert raises `UniqueViolationError` that
ON CONFLICT does NOT catch — and an uncaught raise here aborts the whole ensure pass / startup.
**Wrap each curated insert in `try/except UniqueViolationError` (per-row, log+continue).**

## Going-forward slug rule for new ingestion
`judgment_ingest.py` `_case_slug` strips parens/honorifics and folds `v`/`vs`/`versus` → `-v-`
to produce `party1-v-party2` slugs for all NEW ingested judgments. `_insert` still
disambiguates true slug collisions with a short source-id suffix.
