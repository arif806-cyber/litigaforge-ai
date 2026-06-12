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
**Real cause = GitHub `schedule` is best-effort:** on a freshly created repo the first cron can be delayed many hours, and runs scheduled at the **top of the hour** (`0 */2`) sit in the most-contended slot and get dropped. **RESOLVED ON ITS OWN:** repo created 2026-06-11 11:39Z; first scheduled run finally fired ~20:40Z (~9h after creation), succeeded, and auto-published 3 articles. Confirms it's pure cold-start latency — no fix was needed, just patience. So when a brand-new repo's cron hasn't fired, **wait up to ~a day before touching anything.** Optional reliability tweaks if it's ever flaky long-term: move cron off `:00` (e.g. `17 */2 * * *`); or external trigger (cron-job.org / Replit Scheduled Deployment) hitting workflow_dispatch.
**CONFIRMED ongoing drops (post-cold-start):** even after the first scheduled run fired, GitHub keeps dropping the `0 */2` runs — observed only **1** scheduled run in the repo's first ~11h (vs ~5 expected). When a run DOES fire it succeeds end-to-end (generate → commit → astro build → wrangler deploy → article live), so the pipeline is healthy; the every-2h cadence problem is *purely* GitHub dropping `:00` scheduled triggers on a low-traffic public repo. So the move-off-`:00` / external-pinger tweak is the actual fix, not just optional. NOTE: applying it edits the **litigaforge-blog** repo, which needs a valid `workflow`-scoped GitHub token (the env `GITHUB_TOKEN` is invalid/401).
NOTE: pipeline.yml lives in the **separate** `litigaforge-blog` repo (not this Replit project; `extract/`+`litigaforge-blog-work/` are stale local copies). Canonical PAT for manual repo edits = secret **`GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE`** (classic, `repo`+`workflow`, **never expires** — verified, no expiration header). Older `GITHUB_PERSONAL_ACCESS_TOKEN1` works too but may expire; original `GITHUB_TOKEN` env var was invalid/401. Editing `.github/workflows/*` REQUIRES the `workflow` scope. Read the value via the **bash tool** env, not code_execution (see replit-sandbox-secrets.md).
IMPORTANT (reassurance): the blog **pipeline itself never needs a user PAT** — pipeline.yml authenticates git commits with the Actions built-in `secrets.GITHUB_TOKEN` (auto-minted per run, can't expire; the name is reserved so it's never a user secret), and CF deploy uses the no-expiry `CLOUDFLARE_API_TOKEN`. So PAT expiry does NOT break auto-publishing; a user PAT is only for *manual* repo edits / project pushes.
**FIX APPLIED — reliable 2-hourly trigger:** GitHub's free `schedule` cron is best-effort and drops most low-traffic runs (~1 of 24 over 2 days), so it cannot be the primary trigger (the `0 */2`→`17 */2` off-`:00` tweak alone was NOT enough). **Primary = an in-process timer inside the always-on production api-server** (Express). It POSTs the blog repo's `workflow_dispatch` every 2h aligned to :15 IST using the no-expiry PAT `GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE`. Gated to `NODE_ENV==="production"` (the api-server artifact.toml sets it in prod; the dev script sets `development`, so dev never fires — verified by the dev log "non-production environment — disabled"). **Zero extra cost — reuses the existing always-running VM; takes effect only after a republish.** GitHub cron + the manual curl script stay as harmless fallbacks (the pipeline's `content-pipeline` concurrency group dedupes any double batch).
**KEY LESSON: trust `getDeploymentInfo()` over assumptions about deploy type** — it reported the prod deploy is `vm` (always-running), NOT the previously-assumed autoscale/cloudrun, which is the whole reason an in-server timer is viable and no separate Scheduled Deployment is needed. (Corollary already noted above: commits made with the Actions built-in `GITHUB_TOKEN` don't re-trigger workflows; a user PAT/`workflow_dispatch` is what drives cadence.)
**RESIDUAL CHECK (not a code bug):** deployment secrets can differ from workspace secrets — after republish, confirm the prod log shows "blog-scheduler: next trigger at …"; if it instead shows the token-missing warning, add `GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE` to the deployment's secrets and republish.

## Dynamic sitemap (blog articles)
The UI's static `sitemap.xml` (built into litigaforge-ui dist) lists only app pages — **never** the auto-published blog articles. Fix lives in **api-server** (`artifacts/api-server/src/app.ts`): a `GET /sitemap.xml` route registered **before** `express.static` reads the static sitemap, crawls the Worker blog index (`BLOG_ORIGIN`, following pagination scheme-agnostically, 50-page cap) for `/blog/<slug>` URLs, merges them in, caches 1h in-memory, and falls back to the static file if the Worker is unreachable. No GitHub token / blog-repo change needed. **Takes effect on litigaforge.com only after a republish.** The blog (Astro) has **no** RSS feed and **no** own sitemap, so the index crawl is the only enumeration source.

## Other confirmed facts (don't re-chase)
- `astro.config.mjs` has **no sitemap** and **no Cloudflare adapter**; the screenshotted "sitemap crash + empty collection" was a STALE older build, not current `main`.
- `index.astro` root redirect previously used `{html}` which Astro escapes → rendered escaped text; fixed to a normal template.
- Verify-deploy trick: change a detectable always-served page (root redirect) and poll the live URL — distinguishes "not deploying" from "source broken."
