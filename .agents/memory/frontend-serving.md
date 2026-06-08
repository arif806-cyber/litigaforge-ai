---
name: Frontend serving & rebuild cycle
description: How the litigaforge-ui SPA is actually served and which workflow to restart after a frontend build.
---

# Frontend is served by the api-server, not the vite dev server

The litigaforge-ui SPA at `/` (and all country routes like `/in`, `/us/ask`) is served
as a **static built bundle from `artifacts/litigaforge-ui/dist/public`**, served by the
**`artifacts/api-server: API Server`** workflow — NOT by the `artifacts/litigaforge-ui: web`
vite dev workflow. The served `index.html` references hashed `/assets/index-*.js|css`
(production build output), confirming it is not vite dev (which would reference `/src/main.tsx`).

**How to apply:** after editing frontend code you must:
1. `pnpm --filter @workspace/litigaforge-ui run build` (with `PORT=23790 BASE_PATH=/`)
2. restart **`artifacts/api-server: API Server`** to pick up the new dist.

Restarting `artifacts/litigaforge-ui: web` does nothing for what the user sees.

**Why:** symptom of forgetting step 2 is a blank page with a CSS MIME error
("Refused to apply style ... MIME type 'text/html'") because the served stale
`index.html` references asset hashes that no longer exist on disk → SPA fallback
returns `index.html` (text/html) for the missing asset.
