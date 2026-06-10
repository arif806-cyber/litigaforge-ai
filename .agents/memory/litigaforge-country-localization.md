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

# ai_brain.py India-hardcoded prompts are dead code over HTTP

- `ai_brain.py`'s `STRATEGY_SYSTEM` / `EXTRACT_SYSTEM` / `REFINE_SYSTEM` (and the PAN/GST/CIN/pincode `re.search` extractors via `smart_extract_entities`/`smart_legal_strategy`/`smart_refine_section`) are hardcoded "Indian advocate / Telangana / IndianKanoon" — but **no router imports those `smart_*` functions**; routers only import the raw `_call_*` + `get_active_providers`. So they are not a live India leak; do NOT spend effort "localizing" them.
- The reachable free-document generator is `routers/documents_free.py`. Its `ai_prompt_template` strings are India-worded, BUT `generate_document` already prepends a per-country `directive` + `sys_msg` (built from `get_config(country)`) that explicitly says "treat the template as a guide only — adapt every legal reference to {country}". So the live output is already country-adaptive; the India wording in the templates is overridden at runtime.

**Why:** an architect review flagged these as India leaks, but tracing imports showed the `smart_*` paths are unreachable and the document flow is already wrapped. Localizing dead code is wasted effort and violates "targeted leak-fixing, not rebuild".

# emergency_legal → tel: link extraction

- To turn `activeConfig.emergency_legal` (e.g. US "Legal Aid: 1-800-398-4529") into a `tel:` href, use `.replace(/[^\d+]/g, "")`, NOT `.match(/\d+/)?.[0]` — the latter returns only the first digit run (→ `tel:1`). When the result is empty, render a non-anchor element instead of a broken `tel:`; never fall back to an India number like `15100`.

# Modals/overlays must be portalled to escape the mobile bottom nav

- In `layout.tsx`, `<main>` has `relative z-0` (a stacking context) and the mobile bottom tab `<nav>` is a sibling at `fixed bottom-0 z-30`. So ANY overlay/modal rendered *inside a page* (inside `<main>`) is trapped in main's z-0 layer and paints UNDER the z-30 bottom nav — even with `z-50`. On mobile this hid the ClarifyDialog footer (Skip / Get Answer buttons) behind the tab bar.
- Fix/convention: render full-screen modals via `createPortal(..., document.body)` (same pattern the mobile drawer already uses) and give them `z-[100]`. Do NOT rely on a high z-index alone — the stacking context, not the z value, is the trap.
- SECOND, distinct trap (same fix): `backdrop-filter` (e.g. `backdrop-blur` on the sticky `<header>` in `CountryLanding.tsx`), `filter`, `transform`, `perspective`, or `will-change` on ANY ancestor establishes a **containing block** for `position: fixed` descendants. A `fixed inset-0` overlay then anchors to that ancestor (e.g. the ~64px header), NOT the viewport — so a mobile bottom sheet renders pinned near the top, cut off. Symptom: the `CountrySwitcher` sheet appeared at the top under the browser bar. Portalling the sheet to `document.body` escapes it.

**Why:** two independent mechanisms break in-page `fixed`/`z-index` overlays on mobile — (1) z-index only competes within the same stacking context (`z-50` inside `main(z-0)` loses to a `z-30` sibling); (2) a `transform`/`filter`/`backdrop-filter` ancestor re-roots `position: fixed` to itself. Both are fixed the same way: portal the overlay to `document.body`. Check for both before adding any in-page modal/sheet.

# asyncpg placeholder numbering

- When building dynamic WHERE clauses with asyncpg, the first positional param must be `$1` (`len(params)+1`), not `$2`. A latent off-by-one only surfaces once a filter is always applied.

# Globalization scope: what to strip vs. KEEP

- The product is global (IN, US, GB, AE, AU, CA, SG, DE). On **global-facing/default surfaces** (`index.html`, `public/index-static.html`, `src/pages/landing.tsx` `/landing`, SEOHelmet defaults) strip India-only branding: "Telangana & Andhra Pradesh", Hyderabad, IPC/FIR/RERA/MeeSeva/MACT, ₹, State-of-TG examples, `en_IN` as default `og:locale` (use `en_US`).
- **Deliberately KEEP — do NOT "globalize" these:** (1) India deep-SEO assets — `src/pages/city.tsx`, `src/data/articles.ts`, the "Find Lawyers by City" nav + city links, and city URLs in `sitemap.xml`/`index-static.html`; (2) INR/Razorpay pricing in `subscription.tsx`/`PaymentModal.tsx` + ₹ in JSON-LD offers (pricing change is deferred — changing currency in structured data before the pricing page creates a worse mismatch); (3) the multi-region `hreflang` block in `index.html` including `en-IN` (legit multi-region targeting); (4) `en-IN` `toLocaleDateString` in blog (date format only); (5) "English, Hindi & Telugu" language mentions (factual supported langs).
- **Legit, not a leak:** enumerations like "India, the US, UK, UAE and beyond" are genuine multi-country claims — leave them.
- **Verification gotcha:** a leak sweep must include `\bIndia\b`, not just Telangana/Andhra/Hyderabad/₹/IPC — a headline "Built Different. For India." survived a narrow sweep once. After editing, rebuild dist + restart `artifacts/api-server: API Server`, then `curl localhost:80/` and grep for `telangana|andhra|en_IN|For India\.` (expect 0) and validate JSON-LD blocks parse.

**Why:** the goal is targeted leak-fixing on global surfaces while preserving India geo-SEO value and deferred pricing — over-globalizing destroys SEO assets or desyncs structured data from the live pricing page.

# Performance: which layer serves what, and keep detection off first paint

- HTTP **compression and static-asset cache headers belong on the Node api-server** (`artifacts/api-server/src/app.ts`), NOT FastAPI — the Node Express server serves the built UI (HTML/JS/CSS); FastAPI only serves `/litigaforge` API JSON. Adding `GZipMiddleware` to FastAPI does nothing for the render-critical 196 KiB Tailwind CSS bundle. The fix that matters: `app.use(compression())` + `express.static(dist, { setHeaders })` sending `Cache-Control: public, max-age=31536000, immutable` for hashed `/assets/*`. (Verify through the proxy: `curl -s -D - -H 'Accept-Encoding: br,gzip' localhost:80/assets/<hash>.css` → expect `Content-Encoding: br` + immutable.)
- **Country detection must never gate first paint.** The old `CountryGate` rendered a full-screen "Detecting your location…" blocker awaiting `/litigaforge/api/country-detect` (~4s) → killed LCP. Pattern that works: resolve a country *synchronously* (URL → alias → manual `country_override` → fresh <24h cached detection (`country_detected`) → `in` default), render immediately, rewrite the URL prefix synchronously, then run IP detection in a **post-paint effect** only for ambiguous bare-root visits, cache 24h, and swap silently only if the user hasn't picked since mount. Detection caches under `country_detected`, a SEPARATE key from `country_override`, so a manual choice always wins.
- Gotcha: read `getCountryAliasFromPath()` BEFORE `replaceState` — the rewrite canonicalizes `/uae` → `/ae`, after which the alias getter returns null (alias-persistence becomes dead code).
- Tailwind v4 emits ONE global CSS file; `cssCodeSplit` won't shrink it. The real win is compression (196 KiB → ~25 KiB br). Non-Latin webfonts (Telugu/Devanagari/Arabic) are loaded on demand by `useLanguage`'s `ensureScriptFont(lang)` so the default English payload stays small; only Space Grotesk + JetBrains Mono ship in `index.html`.

**Why:** assets are served by Node, so server-side perf fixes only land if applied there; and any awaited network call placed before the first render directly becomes the LCP floor.

- **framer-motion was bloating the homepage via a single eager import.** `App.tsx` statically imported `{ Layout }` from `components/layout`, and `layout.tsx` is the only critical-path framer-motion consumer (mobile drawer `motion`/`AnimatePresence`). Even though the homepage (`/` → `CountryRoot` → `CountryLanding`) never renders `Layout` (it has its own header, no motion), that one static import forced the `motion` manualChunk into the entry/modulepreload on EVERY page. Fix: `const Layout = lazy(() => import("@/components/layout").then(m => ({ default: m.Layout })))` — Layout is only used inside the catch-all `<Route>`, already under the Router `<Suspense>`. Result: entry chunk's top-level static imports drop to query/vendor/icons; motion goes lazy-only (~40 KiB gz off first paint). Verify in the BUILD, not source: `head -c4000 dist/public/assets/index-*.js | grep 'import.*from"./'` and check `dist/public/index.html` modulepreloads exclude the motion chunk (a substring match for the chunk name in the entry is NOT proof — Vite writes all lazy-chunk names into the entry dep-map).
- **GA is GA4 gtag.js, not a GTM container.** The id is `G-DHTR1SECG4` (GA4 measurement id) → must load `googletagmanager.com/gtag/js?id=G-…`. Do NOT switch to `gtm.js?id=G-…` (gtm.js expects a `GTM-…` container id and silently fails). The inline snippet in `index.html` is the SINGLE loader: it defines the global `gtag()` stub synchronously in `<head>`, runs `gtag('config', …, { send_page_view: false })`, and defers the heavy script to `window load` → `setTimeout 3000` → `requestIdleCallback`. NEVER also load/config gtag from React (e.g. a second `initGA()` that injects `gtag/js`) — that double-loads and undoes the deferral.
- **SPA page_view tracking pattern (wired up).** `send_page_view:false` in the inline config suppresses only the INITIAL auto pageview; `src/lib/analytics.ts` `trackPageView()` then sends a manual `page_view` (with `page_location: window.location.href`) through the global `gtag` stub on every wouter route change (`useEffect` keyed on `location`, fires on mount too). Stub-queued events replay when the deferred script loads, so nothing is lost. `GA_ID` defaults to `G-DHTR1SECG4` (env `VITE_GA4_ID` overrides). Send `page_location` (full URL) not just `page_path` — wouter `location` is relative to the country base (`/ask` under `/in`), and GA4 derives the path from `page_location`.
- **GA4 admin caveat (cannot fix in code):** if Enhanced Measurement → Page views → "Page changes based on browser history events" is ON (the default), gtag.js ALSO auto-sends pageviews on pushState/popstate once loaded → DOUBLE-COUNTS SPA navigations on top of the manual ones. Must be disabled in GA4 Admin (Data Stream → Enhanced measurement → advanced).

**Why (perf):** PageSpeed TBT was dominated by GA blocking the main thread + unused JS; the two levers are (1) defer GA entirely off the interactive window and (2) keep framer-motion out of the entry by never eagerly importing any module that pulls it.
