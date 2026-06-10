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

# Country pain-point cards → /ask deep-link invariant

- Country landing "What is your legal problem?" cards come from `src/data/countryPainPoints.ts`; each has a `category`/`href`/`prompt`. `painPointHref(p)` builds `/ask?category=X&q=<encoded prompt>` (or uses `href` for tool routes like `/free-documents`).
- `/ask` (`src/pages/ask.tsx`) builds its category chips from `src/data/askCategories.ts` via `getAskCategories(activeCode)` and validates an incoming `?category=` against that list, else falls back to `general`.
- **Invariant:** every `category` id used in `countryPainPoints` (for a country) MUST exist in that same country's `askCategories` list, or the deep-linked category silently won't pre-select. When adding/renaming a category, update both files together. Also add the id to `CAT_COLORS` in `ask.tsx` (has a `?? general` fallback but unstyled otherwise).
- DE labels are localized: `askCategoryLabel` uses `label_de`, `allCategoryLabel` returns "Alle"; DE pain-point prompts are intentionally German.

**Why:** the landing→/ask flow relies on category ids matching across two static data files; a mismatch fails silently (no error, just no pre-selected chip).

# asyncpg placeholder numbering

- When building dynamic WHERE clauses with asyncpg, the first positional param must be `$1` (`len(params)+1`), not `$2`. A latent off-by-one only surfaces once a filter is always applied.
