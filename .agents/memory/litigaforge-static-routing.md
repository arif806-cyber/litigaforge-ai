---
name: LitigaForge production static routing
description: Why server-side meta injection is bypassed in production and the correct build-time fix.
---

## The Problem
`litigaforge-ui` has NO `[services.production.run]` in artifact.toml — only a build step.
Replit serves `dist/public/` as a **static CDN** for the `/` path in production.
The api-server also claims `/` but the static CDN wins for paths where no API route matches.
Result: `/lawyers`, `/ask`, etc. all get `dist/public/index.html` (the SPA fallback),
bypassing `_spaHtmlForPath` in the api-server entirely.
This makes dev and production behave differently:
- Dev: api-server handles all routes → injection works.
- Prod: static CDN serves index.html for all SPA routes → no injection.

## The Fix (build-time injection)
`artifacts/litigaforge-ui/scripts/inject-seo.mjs` — runs after `vite build`:
- Reads `dist/public/index.html` (Vite-built)
- Injects route-specific title, description, canonical, og:url, og:title, og:description,
  og:image, twitter:title, twitter:description, twitter:image
- Writes `dist/public/lawyers/index.html`, `dist/public/ask/index.html`, etc.
- Updates homepage `dist/public/index.html` in place
- 18 static routes covered (all routes in _ROUTE_SEO)
The static CDN finds `dist/public/lawyers/index.html` before falling back to `index.html`.

**Why:** `_spaHtmlForPath` is correct in the api-server and works in dev, but production
routing bypasses it. The build-time approach works regardless of which service handles
the request.

## Keeping In Sync
`scripts/inject-seo.mjs` mirrors `_ROUTE_SEO` in `artifacts/api-server/src/app.ts`.
When adding/changing routes or meta in `_ROUTE_SEO`, also update `inject-seo.mjs`.
The build script in `litigaforge-ui/package.json` now auto-runs it:
`"build": "vite build --config vite.config.ts && node scripts/inject-seo.mjs"`
