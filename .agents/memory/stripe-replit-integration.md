---
name: Stripe + stripe-replit-sync on Replit (Node/esbuild)
description: Two non-obvious gotchas wiring stripe-replit-sync into an esbuild-bundled Node api-server on Replit.
---

# stripe-replit-sync gotchas (esbuild + Replit connector)

## 1. Externalize `stripe-replit-sync` in esbuild — migrations silently no-op when bundled
`runMigrations()` resolves its migration `.sql` files relative to its own `dist/`
via `import.meta.url`. When esbuild bundles the library into the app's
`dist/index.mjs`, that path resolves to the *app's* dist, the `migrations/`
folder isn't there, and `connectAndMigrate` logs "Migrations directory … not
found, skipping" and applies **zero** migrations — with NO error thrown.
Result: "schema ready" logs fine but `stripe.*` tables never get created and
reads fail with `relation "stripe.prices" does not exist`.

**Fix:** add `"stripe-replit-sync"` to the `external` array in `build.mjs`, and
declare `stripe` + `stripe-replit-sync` as the artifact's own deps so they
resolve from `node_modules` at runtime.
**How to apply:** any esbuild-bundled artifact using stripe-replit-sync.

## 2. Replit Stripe connector secret field is `secret`, not `secret_key`
The connection settings JSON (both `listConnections('stripe').settings` and the
REST `/api/v2/connection?include_secrets=true&connector_names=stripe` →
`items[0].settings`) uses keys `secret`, `publishable`, `webhook_secret`,
`account_id`. The Replit `stripe` SKILL code-template reads `settings.secret_key`
which is WRONG — it returns undefined and you get
"Stripe integration not connected or missing secret key" even though it IS
connected. Read `settings.secret` and `settings.webhook_secret`.
**Why:** skill template is stale vs the actual connector schema (the `toonSchema`
on the live connection is the source of truth).

## 3. Seeding products from bash fails; use code_execution
Fetching connector creds needs `REPL_IDENTITY`/`REPLIT_CONNECTORS_HOSTNAME`,
which are present in the workflow runtime but NOT in the agent's bash shell. Run
seed/admin scripts via the `code_execution` sandbox with
`listConnections('stripe').settings.secret` instead.

## 4. `syncBackfill()` (no args) does not backfill catalog products/prices
Catalog (products/prices) normally arrives via webhooks on create. If you create
products via the API *before* the managed webhook exists, they won't be in the
`stripe.*` schema. Keep a fallback in read endpoints that lists from the Stripe
API when the synced schema returns 0 rows; treat the Stripe API as source of
truth for reconcile.
