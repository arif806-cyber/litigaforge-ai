---
name: Frontend serving model (litigaforge)
description: Which server actually serves the live UI, and what to do to make source edits visible
---

# The live UI is the built dist, served by api-server — not the vite dev server

`api-server` serves the prebuilt `litigaforge-ui/dist/public` at `/` (and shadows
the vite dev server, which also claims `/`). It reads `index.html` once at startup.

**Rule:** editing `litigaforge-ui` source is NOT enough to see changes in the
preview or on the dev domain. You must rebuild the frontend and restart api-server:
1. build litigaforge-ui (its artifact build env uses `BASE_PATH=/`, `PORT=23790`),
2. restart the api-server workflow so it re-reads `index.html`/assets.

There is also a PWA service worker (`registerType: autoUpdate`); a hard reload may
be needed after a rebuild.

**Why:** source-only edits + a litigaforge-ui dev restart appear to do nothing,
because the served bundle is the stale dist, not the dev modules.

**Path map:** `/` = frontend (api-server, port 8080), `/litigaforge/*` = Python
FastAPI backend (port 5000), `/api/*` = api-server's own API. Country routing lives
at the root, e.g. `/ae`, `/uk` — NOT under `/litigaforge`.
