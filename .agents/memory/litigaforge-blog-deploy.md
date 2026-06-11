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

## Autonomy gap (open design choice)
Deploying to Cloudflare ALWAYS needs either a CF token (wrangler) or a CF-side Git integration. The user wants autonomous + "tokenless." Two ways to close the gap:
- **GH Action deploy:** add a `deploy.yml` (on push to main: checkout → npm build → wrangler deploy) with `CLOUDFLARE_API_TOKEN` stored as a GitHub repo secret. Fully hands-off but stores a token in GitHub.
- **CF dashboard "Connect to Git" (Workers Build):** truly tokenless (CF pulls from GitHub on push), but requires a one-time dashboard/OAuth step by the user — cannot be set up via API token alone.

## Other confirmed facts (don't re-chase)
- `astro.config.mjs` has **no sitemap** and **no Cloudflare adapter**; the screenshotted "sitemap crash + empty collection" was a STALE older build, not current `main`.
- `index.astro` root redirect previously used `{html}` which Astro escapes → rendered escaped text; fixed to a normal template.
- Verify-deploy trick: change a detectable always-served page (root redirect) and poll the live URL — distinguishes "not deploying" from "source broken."
