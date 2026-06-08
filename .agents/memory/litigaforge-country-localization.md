---
name: LitigaForge country localization
description: How per-country content/localization works for post-login pages, and the dev loop to see changes.
---

# Per-country pages (LitigaForge)

- Country comes from the URL path prefix (e.g. `/ae`, `/de`). `getCountryFromPath()` in `src/lib/country.ts` returns a lowercase code or null; `VALID_COUNTRIES = in,us,gb,ae,au,ca,sg,de`; aliases like `/uae` map to `ae`. Default fallback is `in`.
- Default UI language is country-driven via `COUNTRY_DEFAULT_LANG` in `src/hooks/useLanguage.ts` (AE→ar with RTL, DE→de, others en) with a switcher to English.
- **i18n only covers nav + landing keys** (~25 per country/lang). Page *bodies* stay English by design — this is an accepted scope boundary, not a bug. Do not try to "fix" it without an explicit request.
- Backend per-country data lives in router endpoints keyed by uppercase country code, e.g. `LEGAL_AID` dict in `routers/community.py` (8 countries). Endpoints take a `country` query param and must canonicalize unknown codes back to a supported one before echoing `country` in the response.
- Lawyers are filtered by a `country` column (backfilled to `in`). When a country has no lawyers, the directory renders a clean "expanding to your region" empty state instead of India data.

**Why:** non-India paths previously showed India-only content (NALSA, BCI, INR). Content must key off the path country, never hardcode India.

# Dev loop (critical)

- The **live UI is the built dist served by the Node api-server at `/`**, NOT the vite dev server. After editing `litigaforge-ui`, you MUST rebuild dist and restart the api-server, or changes won't appear:
  `BASE_PATH=/ PORT=23790 NODE_ENV=production pnpm --filter @workspace/litigaforge-ui run build`
- Python backend (`LitigaForge AI` workflow) must be restarted to pick up router/migration changes.
- Duplicate workflows (`artifacts/api-server: LitigaForge AI`, `artifacts/litigaforge-ui: web`) stay "failed" due to port collisions (EADDRINUSE) — the canonical `LitigaForge AI` + `artifacts/api-server: API Server` serve the app. This failed state is expected, not a regression.
- Verify via the shared proxy: `curl localhost:80/litigaforge/<endpoint>` and `curl localhost:80/<country>`.

# asyncpg placeholder numbering

- When building dynamic WHERE clauses with asyncpg, the first positional param must be `$1` (`len(params)+1`), not `$2`. A latent off-by-one only surfaces once a filter is always applied.
