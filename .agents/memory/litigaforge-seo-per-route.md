---
name: LitigaForge per-route SEO
description: How initial-response metadata is generated, including dynamic judgment pages and the sitemap↔route-map sync rule.
---

# Per-route initial-response SEO

LitigaForge's frontend is a React SPA, so by default every route ships the same
`index.html` shell. To give crawlers unique pages, the **api-server** (`artifacts/api-server/src/app.ts`)
intercepts known-bot user-agents on the SPA catch-all and rewrites a static bot
template (`litigaforge-ui/public/index-static.html`, served from the built
`dist/public`) per route:

- A `_ROUTE_SEO` map holds `{title, ogTitle, description, h1, intro, canonicalPath}`
  per bare path; a dynamic `/lawyers/:city` handler covers city pages.
- `_stripCountry` removes a leading country/locale prefix (`/in/ask` → `/ask`) so
  country variants **consolidate onto bare canonical URLs** (`https://litigaforge.com/<path>`).
- Dynamic `/judgments/:court/:year/:slug` routes fetch the case and inject its
  title, description, canonical, OG/Twitter tags, and JSON-LD into the normal
  SPA shell for **every user agent**. Plain curl and unfurlers must see the case;
  do not make this path bot-only.
- The template's `<title>/<meta>/<link canonical>/og:*/twitter:*` and the **first**
  `<h1>` and **first** `<p>` are swapped via regex **function replacers**
  (`.replace(re, () => value)`) — function replacers are mandatory so any `$` in
  copy is never interpreted as a `$1/$&/$$` replacement pattern.
- A separate `_ROUTE_BODY` map (keyed by bare path) holds route-specific
  `<h2>/<p>` body content that is appended right after the rewritten first `<p>`.
  **Why:** swapping only title/h1/intro still left every route sharing the same
  homepage feature-directory body, so pages read as near-duplicates to no-JS
  crawlers. The shared `<nav>`/footer links still follow for crawl depth, but the
  *leading* content of each page is now distinct. `_ROUTE_BODY` is optional per
  route — utility pages (`/privacy`, `/terms`, `/refund-policy`, `/login`,
  `/register`) intentionally have no body entry (unique title/h1/intro suffices).

**Why:** SPA shells produce duplicate title/description/canonical across every
route, which suppresses indexing. Country-prefixed variants split link equity.

## The sync rule (most important, easy to forget)
Every **public** URL in `litigaforge-ui/public/sitemap.xml` MUST have a matching
`_ROUTE_SEO` entry (or dynamic handler), otherwise bots get the **unchanged
homepage HTML** for it → duplicate content. When you add a public route to the
sitemap, add it to `_ROUTE_SEO` in the same change. (This bit us once: `/us-demand-letter`,
`/login`, `/register` were in the sitemap but unmapped.)

**How to apply:**
- Changes take effect only after rebuilding the UI (`PORT=23790 BASE_PATH=/ pnpm --filter @workspace/litigaforge-ui run build`, so dist picks up template/robots/sitemap edits) **and** restarting the `api-server` workflow.
- Verify static routes with Googlebot. Verify judgment routes with plain curl:
  initial HTML must contain case metadata while retaining the React root/scripts.
- The regex rewriting assumes the bot template's first `<h1>`/`<p>` are the hero
  intro — if the template gains an earlier `<p>`/`<h1>`, the wrong node gets rewritten.
- `/subscription` is intentionally bot-indexed as pricing even though the human
  route is auth-gated (redirects to /login): the same pricing is shown publicly on
  the homepage, so the content is legitimate; this is a deliberate decision, not a bug.
