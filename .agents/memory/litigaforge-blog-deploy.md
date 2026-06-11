---
name: LitigaForge blog Cloudflare deploy
description: How the blog deploys (tokenless CF Git integration), how to verify CF is actually deploying, and the no-CF-credentials constraint.
---

# LitigaForge blog deploy (Cloudflare)

The blog repo `arif806-cyber/litigaforge-blog` (default branch `main`) is a **pure static Astro site** (no adapter, `output: static`). It deploys via **Cloudflare's native Git integration** — push to `main` → CF auto-builds (`npm run build`) → serves `dist/` at `litigaforge-blog.arif-806.workers.dev`. This is the *tokenless* deploy mechanism and is intentional (user requirement: no tokens for daily operation).

**Why tokenless matters:** the user's hard requirement is no GitHub token needed after setup. The content pipeline (`pipeline.yml`) uses the auto-provided `GITHUB_TOKEN`. The CF deploy uses CF's own Git connection — no secret in the repo. A GitHub-Actions+wrangler deploy would need a `CLOUDFLARE_API_TOKEN` secret, which the user has not opted into; do not add one without asking.

## No Cloudflare credentials in the Replit env
There are **no `CLOUDFLARE_*` / `CF_*` secrets** in this project's env. CF build logs and dashboard config are NOT accessible to the agent. Any CF-side failure (build failing, Git integration disconnected, wrong production branch) **cannot be diagnosed or fixed from here** — it needs the user's CF dashboard access or a one-time CF API token.

## Deploy-signal verification technique (high value)
To tell "CF isn't deploying" apart from "the source build is broken": make a **detectable change to an always-served page** (e.g. `src/pages/index.astro` root redirect), push, then poll the live page for that change. If the live page never changes, CF is not deploying new commits at all — regardless of whether article URLs 404. This isolates the failure to CF's side and avoids endlessly re-pushing speculative source fixes.

**Why:** the source repeatedly built clean locally (all articles in `dist/`) yet the live site stayed on a stale welcome-only build; polling article 404s alone couldn't distinguish a CF deploy outage from a content-collection build error. The root-page signal proved CF was deploying *nothing* new.

## Confirmed-clean source facts (so don't re-chase these)
- `astro.config.mjs` has **no sitemap** and **no Cloudflare adapter** — the screenshotted "sitemap crash + empty collection" failure was a STALE older build, not current `main`.
- `package.json` build is a clean `astro build` (no `rm -rf node_modules/@astrojs/sitemap` hack anymore).
- All 4 article frontmatters validate; `npm install` + `npx astro build` on a fresh clone produces 6 pages incl. every article.
- `.npmrc` disables the lockfile; CF install step succeeds (it's the deploy, not install, that's the problem).
