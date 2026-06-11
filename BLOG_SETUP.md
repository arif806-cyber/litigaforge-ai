# LitigaForge Blog — Complete Setup Guide

## What's Done

| Item | Status | Details |
|------|--------|---------|
| Blog deployed | LIVE | https://litigaforge-blog.arif-806.workers.dev/blog/ |
| Welcome article | LIVE | https://litigaforge-blog.arif-806.workers.dev/blog/welcome/ |
| Blog page | Renders | 200 OK, full SEO, Open Graph, JSON-LD schema |
| Main app redirects | WORKING | /blog and /blog/:slug redirect to workers.dev blog |
| GitHub Actions config | IN REPO | arif806-cyber/litigaforge-blog (old domain still) |
| Pipeline code | UPDATED | Local files ready for push (blog.litigaforge.com domain) |
| IndexNow key | LIVE | 5a4662dfa9b58713797b87f6d724876f.txt accessible |
| SEO schema | PRESENT | Article + FAQPage JSON-LD on every article |

---

## What You Need to Do (15 minutes)

### Step 1: Generate a GitHub Personal Access Token with `repo` scope

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Select scope: **repo** (full control of private repositories)
4. Name it "LitigaForge Blog Deploy"
5. Copy the token (it starts with `ghp_`)

### Step 2: Push the updated blog files

```bash
# In Replit, run this:
cd /tmp/litigaforge-blog-push
git remote set-url origin https://YOUR_NEW_TOKEN@github.com/arif806-cyber/litigaforge-blog.git
git push origin main
```

This pushes all 8 updated files with the new `blog.litigaforge.com` domain:
- `astro.config.mjs` — site URL
- `pipeline.py` — BLOG_DOMAIN default + path fix
- `.github/workflows/pipeline.yml` — fallback domain
- `src/content/blog/welcome.md` — canonical URL
- `src/pages/index.astro` — redirect canonical
- `src/pages/blog/index.astro` — listing canonical
- `src/pages/blog/[slug].astro` — article canonical
- `README.md` — documentation

### Step 3: Add GitHub Secrets (CRITICAL)

Go to https://github.com/arif806-cyber/litigaforge-blog/settings/secrets/actions

Add these **4 Repository Secrets**:

| Secret | Value | Where to get |
|--------|-------|--------------|
| `GEMINI_API_KEY` | `AIza...` | https://aistudio.google.com |
| `GROQ_API_KEY` | `gsk_...` | https://console.groq.com |
| `INDEXNOW_KEY` | `5a4662dfa9b58713797b87f6d724876f` | (already provided) |
| `BLOG_DOMAIN` | `blog.litigaforge.com` | (already provided) |

### Step 4: Add Cloudflare Pages Custom Domain

1. Go to https://dash.cloudflare.com → Pages → litigaforge-blog
2. Click **Custom Domains** → Add Custom Domain
3. Enter: `blog.litigaforge.com`
4. Cloudflare auto-adds the CNAME record if your DNS is on Cloudflare

If DNS is elsewhere, manually add:
- Type: `CNAME`
- Name: `blog`
- Target: `litigaforge-blog.pages.dev`

### Step 5: Trigger a test run

1. Go to https://github.com/arif806-cyber/litigaforge-blog/actions
2. Click **LitigaForge Content Pipeline**
3. Click **Run workflow**
4. Set `max_articles` to `1`
5. Click **Run workflow**

---

## Pipeline Architecture

```
Every 2 hours (GitHub Actions cron):

1. Reddit JSON API  →  fetch hot posts from 8 legal subreddits
2. Gemini 1.5 Flash  →  write 2000-word article (1,500 req/day free)
3. Groq Llama 3.3    →  fallback if Gemini fails (14,400 req/day free)
4. GitHub API         →  commit .md file to repo
5. Cloudflare Pages   →  auto-deploys in ~45 seconds
6. IndexNow API       →  submit URL to Bing + Yandex instantly
7. Google Search      →  discovers via sitemap in 24-48 hrs
```

**Cost: $0/month** — all services use free tiers

---

## Files in this workspace

| File | Purpose |
|------|---------|
| `litigaforge-blog-work/` | Blog source files (Astro + pipeline) |
| `setup_blog_domain.sh` | Automated setup script (run with new PAT) |
| `push_blog_domain.py` | GitHub API push script (requires `repo` scope PAT) |
| `BLOG_SETUP.md` | This guide |

---

## Verified Working

- Blog: https://litigaforge-blog.arif-806.workers.dev/blog/ 200 OK
- Article: https://litigaforge-blog.arif-806.workers.dev/blog/welcome/ 200 OK
- IndexNow: https://litigaforge-blog.arif-806.workers.dev/5a4662dfa9b58713797b87f6d724876f.txt 200 OK
- Main app redirects: built and verified in dist chunks
