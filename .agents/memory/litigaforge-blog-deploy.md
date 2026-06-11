---
name: LitigaForge blog Cloudflare deploy
description: How the blog actually deploys (manual wrangler to a static-assets Worker — NOT a Git integration), how to deploy it, and the autonomy gap.
---

# LitigaForge blog deploy (Cloudflare)

The blog repo `arif806-cyber/litigaforge-blog` (default branch `main`) is a **pure static Astro site** (no adapter, `output: static`). It is hosted on a **Cloudflare Worker** named `litigaforge-blog` (account `9581b3dc96de95c5d2f81129fb2a3670`, subdomain `arif-806`) that serves `dist/` via a static-**assets** binding (`ASSETS`, type `assets`). Live at `https://litigaforge-blog.arif-806.workers.dev`. It is a **Worker, not a Pages project** (`*.pages.dev` does not resolve; no Pages project exists).

## The real deploy mechanism (corrects BLOG_SETUP.md)
Deploys are **manual `wrangler deploy` runs** — the Worker's deployments API shows every deploy as `source: "wrangler"`. There is **NO Cloudflare Git integration / Workers Builds** connected, despite BLOG_SETUP.md claiming "Cloudflare Pages auto-deploys on push ~45s." That claim was never true.

**This is the recurring bug:** the content pipeline (`.github/workflows/pipeline.yml`) generates articles and commits them to the repo via the GitHub API, but has **no deploy step**. So new articles land in git but nothing runs wrangler → they 404 on the live site until someone manually deploys. The last manual deploy predated the article commits, so only `welcome` was live.

## How to deploy manually (needs a Cloudflare API token)
The repo `wrangler.toml` must contain `[assets]\ndirectory = "./dist"` (it was missing this — added). Then:
```
git clone <repo> /tmp/blog-deploy && cd /tmp/blog-deploy
npm install && npx astro build      # produces dist/ with all articles
CLOUDFLARE_ACCOUNT_ID=9581b3dc96de95c5d2f81129fb2a3670 CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy
```
A CF API token needs `Account: Workers Scripts: Edit` + `Account: Account Settings: Read`. (`Workers Builds` is a separate permission the basic token lacks.) Repo commits/pushes use the GitHub PAT/API, unrelated to CF.

## Autonomy — RESOLVED (auto-deploy lives inside pipeline.yml)
Deploying to Cloudflare ALWAYS needs either a CF token (wrangler) or a CF-side Git integration. User chose the token route. The deploy is now part of `.github/workflows/pipeline.yml` itself (NOT a separate workflow) and runs every 2 hrs: pipeline.py commits articles → `git fetch origin main && git reset --hard origin/main` (to pull the API-committed files into the runner) → `npm install` + `npx astro build` → `npx wrangler@4 deploy`. Secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` are stored as GitHub repo secrets.

**Key non-obvious lesson — why deploy MUST live in the same job, not a separate `on: push` workflow:** pipeline.py commits via the GitHub Contents API using the default `GITHUB_TOKEN`. Commits/pushes made with `GITHUB_TOKEN` do **NOT** trigger other workflow runs (GitHub's anti-recursion rule), so a `push`-triggered `deploy.yml` would never fire for pipeline commits. Putting build+deploy as later steps in the same scheduled run sidesteps this entirely. The runner's checkout is stale after the API commits, hence the explicit fetch+reset before building.

**Free + reliable:** repo is **public** → GitHub Actions minutes are unlimited/free. The CF API token has **no expiry** (`expires_on: null`) → won't silently break.

**Alternative not used:** CF dashboard "Connect to Git" (Workers Build) is truly tokenless but needs a one-time dashboard/OAuth step the user didn't want.

## Serving at the apex: litigaforge.com/blog (reverse-proxy, NOT DNS)
`litigaforge.com` is **NOT on Cloudflare** — nameservers are GoDaddy and the apex A record points at the Replit deployment (Express `api-server`). DNS therefore **cannot** path-route `/blog` to the Worker; only a full domain migration to CF or an origin reverse-proxy can. We chose the reverse-proxy.

The api-server (`artifacts/api-server/src/app.ts`) reverse-proxies `/blog`, `/blog/{*splat}`, and `/_astro/{*splat}` to `BLOG_ORIGIN` (the Worker), registered **before** `express.static` + the SPA catch-all. Uses Node global `fetch` with `redirect:"follow"` (the Worker 307-redirects `/blog`→`/blog/`, resolved server-side to one 200), forwards content-type/cache-control/etag/last-modified, returns the body as a Buffer; 502 on fetch error. Main app uses `/assets/` (Vite) so no collision with the blog's `/_astro/`.

**PWA gotcha (critical, cost real debugging):** the litigaforge-ui service worker (VitePWA, scope `/`) has a SPA navigation fallback (`createHandlerBoundToURL("index.html")`). Without a denylist it intercepts `/blog` navigations and serves the React shell → `blog.tsx` redirects to `/blog` → **infinite loop**. Fix = `navigateFallbackDenylist: [/^\/blog/, /^\/_astro/]` in vite.config workbox. **AND** `index.html` MUST be precached (include `html` in `globPatterns`) — otherwise `createHandlerBoundToURL("index.html")` throws `non-precached-url`, the new SW fails to install, and old looping SWs can never be replaced by autoUpdate.

**Takes effect on litigaforge.com only after a republish** — the change is in api-server code; production runs the old build until redeployed.

## Scheduled cron not firing (diagnosed via GitHub public API)
Symptom: "no new article published at the scheduled time." Diagnosis tool (public repo, no auth needed):
`GET api.github.com/repos/arif806-cyber/litigaforge-blog/actions/runs?event=schedule&per_page=1` → check `total_count`. If 0, the cron has **never** fired even though manual `workflow_dispatch` runs succeed and publish fine.
Confirmed NOT the cause: fork (`fork:false`), disabled workflow (`actions/workflows` → `state:"active"`), wrong default branch (`main`, cron present in pipeline.yml on main).
**Real cause = GitHub `schedule` is best-effort:** on a freshly created repo the first cron can be delayed many hours (often up to ~24h), and runs scheduled at the **top of the hour** (`0 */2`) sit in the most-contended slot and get dropped. Fixes: (1) move the cron off `:00` (e.g. `17 */2 * * *`) — GitHub's own docs recommend this; (2) give a new repo ~a day; (3) for guaranteed cadence, trigger via external cron (cron-job.org / Replit Scheduled Deployment) hitting the workflow_dispatch API. NOTE: pipeline.yml lives in the **separate** `litigaforge-blog` repo (not this Replit project; `extract/`+`litigaforge-blog-work/` are stale local copies) — editing it needs a GitHub token with `workflow` scope.

## Other confirmed facts (don't re-chase)
- `astro.config.mjs` has **no sitemap** and **no Cloudflare adapter**; the screenshotted "sitemap crash + empty collection" was a STALE older build, not current `main`.
- `index.astro` root redirect previously used `{html}` which Astro escapes → rendered escaped text; fixed to a normal template.
- Verify-deploy trick: change a detectable always-served page (root redirect) and poll the live URL — distinguishes "not deploying" from "source broken."
