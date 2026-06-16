# LitigaForge AI

Client–Lawyer matching platform + legal AI for Telangana & AP. Clients post case requirements, AI matches them with verified lawyers (scored 0–100), and they collaborate via chat. Also: multi-AI legal strategy synthesis, legal Q&A, document analyzer, judgment finder, and free legal-aid finder.

## Run & operate

- **Backend** — workflow `artifacts/api-server: LitigaForge AI`: `cd artifacts/litigaforge-ai && BASE_PATH=/litigaforge PORT=5000 python main.py`
- **Frontend** — workflow `artifacts/litigaforge-ui: web`: `pnpm --filter @workspace/litigaforge-ui run dev`
- **Prod build** — `PORT=23790 BASE_PATH=/ pnpm --filter @workspace/litigaforge-ui run build`
- `BASE_PATH=/litigaforge` and `PORT=5000` are **shared Replit env vars** — all workflows inherit them; do NOT add them inline to workflow commands.
- GitHub: repo `arif806-cyber/litigaforge-ai`, branch `feature/arifbase`.
- The deployed app builds from the **Replit workspace, not GitHub** — several features only go live **after a republish** (flagged per-feature below).

## Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query, wouter
- **Backend**: Python 3.12, FastAPI, Uvicorn, LangGraph, LangChain
- **AI**: Claude Sonnet 4-6 + Gemini 2.5 Flash + GPT-5 via Replit AI Integrations (all free, no key needed). Portable LiteLLM layer (`artifacts/litigaforge-ai/llm/`) is switchable via `LLM_MODEL` (default `anthropic/claude-sonnet-4-6`); it's the primary path for judgment summarization + `/ask`, with the `ai_brain.py` cascade as fallback.
- **Database**: PostgreSQL (Replit-managed)
- **Auth**: bcrypt password hashing + JWT (python-jose), 30-day tokens
- **Mobile**: Expo / React Native / NativeWind — in `deployable/mobile/`
- **Fonts**: Space Grotesk + JetBrains Mono (Google Fonts)

## Architecture decisions

- `BASE_PATH=/litigaforge`: backend mounts all routes at this prefix; the proxy routes `/litigaforge/*` → port 5000.
- AI fallback chain: Claude → Gemini → GPT-5 → smart regex + data-driven templates (never generic output). No user API keys needed — all via Replit's proxy.
- LiteLLM layer (`llm/config.py` + `llm/legal_llm.py`): auto-wires the free Replit proxy creds; switch provider with `LLM_MODEL` alone (override with `LLM_API_BASE`/`LLM_API_KEY`). `LLM_TIMEOUT` ≥60s. Lazy-imported; pinned in `requirements.txt` (install with `pip`, not the `uv` packager). Health: `GET /litigaforge/llm/health` (`?probe=true` = cached live test); also reverse-proxied at `/api/llm/*`.
- Tailwind v4, light/white UI (no dark mode).
- Mobile layout: sidebar hidden, replaced by hamburger drawer + fixed bottom tab bar (`pb-16 md:pb-0`).
- Code splitting in `vite.config.ts` (react-vendor, motion, query, ui chunks).

## Blog & SEO infrastructure

The blog is a **Cloudflare Worker** (static Astro assets, NOT Pages), live at `https://litigaforge-blog.arif-806.workers.dev/blog/` (custom domain `blog.litigaforge.com` pending DNS). Pipeline `.github/workflows/pipeline.yml`: generate articles → commit via GitHub API → `astro build` → `wrangler deploy`. Public repo = free unlimited Actions; `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` are GitHub repo secrets (no expiry).

- **Reliable trigger** — GitHub's free cron silently drops most scheduled runs, so the dependable trigger is baked into the always-on `api-server` process (`src/lib/blogScheduler.ts`, started from `src/index.ts`): fires a GitHub `workflow_dispatch` (authenticated with the no-expiry PAT `GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE`) every 2h at :15 IST, prod-only (`NODE_ENV==="production"`), per-run cap 2 articles. **Takes effect after a republish.** GitHub `schedule:` cron + `scripts/trigger-blog.sh` remain as harmless fallbacks (pipeline has a `content-pipeline` concurrency group).
- **Pause/resume (no code change)** — `pipeline.py` is FAIL-CLOSED on the blog repo's Actions variable `GENERATION_ENABLED` (`"true"` = live; anything else = paused). Flip it in `arif806-cyber/litigaforge-blog` — no republish needed.
- **Content engine** — per-country daily quota (~7/day: India 2, US/UK/UAE/Germany 1, +1 rotating AU/CA/SG), 10-category rotation, slug ≤70 chars, min word count w/ one retry, and a daily-target gate (today's count ≥ `DAILY_TARGET` 7 → publishes **0 by design**). Old slugs **301-redirect** to canonical via the Worker's `public/_redirects` and at the apex via `src/lib/blogRedirects.ts` (both `/blog/<old>` and `/blog/<old>/` forms).
- **Apex `litigaforge.com/blog`** — domain is on GoDaddy (not Cloudflare), so the Express `api-server` reverse-proxies `/blog`, `/blog/*`, `/_astro/*` to the Worker; the litigaforge-ui PWA service worker denylists `/blog` + `/_astro`. **Takes effect after a republish.**
- **Dynamic `/sitemap.xml`** — `api-server` serves a sitemap merging static app URLs + live blog articles (crawled from the Worker, cached 1h, static fallback). **After republish, resubmit in Google Search Console.**

## Where things live

### Frontend (`artifacts/litigaforge-ui/src/`)

Pages (`pages/`), route in parens:
- `login.tsx` (`/login`), `register.tsx` (`/register`) — JWT auth (localStorage `lf_token`), Client vs Lawyer tabs
- `client-dashboard.tsx` (`/client-dashboard`) — assigned cases, stage timeline, match proposals, AI explanations, lawyer contact, doc upload, NALSA helpline; navy sidebar
- `lawyer-dashboard` (`/lawyer-dashboard`) — lawyer landing
- `documents.tsx` (`/documents`) — all client docs: search, download, share (Web Share + WhatsApp), delete, upload
- `post-case.tsx` (`/post-case`) — post a case (anonymous option, 9 types, budget range)
- `my-cases.tsx` (`/my-cases`) — track posted cases + match proposals (accept/decline)
- `matches.tsx` (`/matches`) — AI match scores (0–100), AI explanations, accept/decline
- `legal-chat.tsx` (`/legal-chat`) — AI drafting assistant, 4 templates, live chat
- `ask.tsx` (`/ask`) — Legal Q&A, AI answers instantly + community knowledge base
- `review.tsx` (`/review`) — document analyzer: risk scoring, missing clauses, recommendations
- `judgments.tsx` (`/judgments`) + `judgment-detail.tsx` — judgment digest/finder + IndianKanoon links
- `lawyers.tsx` (`/lawyers`) — advocate directory (verification badges, ratings, hourly rates)
- `legal-aid.tsx` (`/legal-aid`) — NALSA/TSLSA eligibility wizard + helplines
- `free-documents.tsx` (`/free-documents`) + `document-template.tsx` — 10 AI doc templates + dynamic fill form
- `subscription.tsx` (`/subscription`) — plan comparison & upgrade/downgrade
- `about.tsx`, `contact.tsx`, `privacy.tsx` (alias `/privacy-policy`), `terms.tsx` — AdSense-required public pages, all ending in shared `LegalDisclaimerFooter` (contact email `legal@litigaforge.com`); `contact.tsx` posts to `POST /contact`; `privacy.tsx` has Cookies + AdSense sections
- `use-cases.tsx` — redirects to `/ask`

All main routes are protected via `ProtectedRoute` (`AuthProvider` in `lib/auth-context.tsx`).

Components/utils:
- `components/layout.tsx` — sidebar ("Match & Connect" + "Legal Tools"); navy (#1a2744) for clients, white for lawyers; mobile fixed bottom tabs
- `components/legal-disclaimer.tsx` — footer disclaimer + FirstVisitDisclaimer modal
- `components/graphics/` — ParticleCanvas, ScalesHero, EmptyStateArt
- `lib/api.ts` — `apiFetch` (auto-attaches Bearer); BASE `/litigaforge`
- `lib/auth-context.tsx` — AuthProvider, useAuth, TIER_LABELS, TIER_LIMITS

### Backend (`artifacts/litigaforge-ai/`)

- `main.py` — FastAPI app: lifespan, CORS, rate limits, table init, includes 10 routers
- `routers/` — `auth`, `subscription` (Razorpay), `matching`, `chat`, `community` (Q&A, analyzer, judgment finder, directory, legal aid), `watch`, `alerts` (WhatsApp/reminders), `admin` (lawyer verification, user mgmt), `lawyer` (lawyer + client case CRUD), `judgments`
- `database.py` — asyncpg pool (fetch/fetchrow/execute/executemany)
- `auth.py` — bcrypt + JWT (cookie-first, Bearer fallback); `payments.py` — Razorpay; `rate_limit.py` — slowapi; `ai_brain.py` — multi-AI cascade; `alerts/whatsapp.py` — Twilio

## Database schema (PostgreSQL)

| Table | Purpose |
|---|---|
| `users` | id, email, name, password_hash, subscription_tier, cases_this_month, month_reset_date, is_superuser, created_at |
| `subscriptions` | id, user_id FK, tier, started_at, expires_at, status, payment_ref |
| `legal_questions` | id, user_id FK nullable, question, category, ai_answer, upvotes, created_at |
| `lawyers` | id, user_id FK, name, email, phone, bar_number, district, practice_areas[], languages[], experience_years, rating, bio, hourly_rate, availability, verification_status, verified, created_at |
| `case_requirements` | id, user_id FK, title, case_type, description, location, budget_range, is_anonymous, status, created_at |
| `matches` | id, case_requirement_id FK, lawyer_id FK, client_id FK, status, match_score, ai_explanation, client_message, lawyer_message, created_at |
| `lawyer_cases` | id, lawyer_id FK, client_id FK, title, case_type, description, client_name, court_name, cnr_number, hearing_date, case_stage, status, created_at |
| `lawyer_documents` | id, lawyer_id FK, case_id FK, filename, file_type, file_url, content_text, ai_summary, notes, created_at |
| `client_documents` | id, case_id FK, client_id FK, filename, file_type, file_size, file_path, file_url, created_at |
| `chat_threads` | id, match_id FK, title, created_at |
| `chat_messages` | id, thread_id FK, sender_id FK, sender_role, content, created_at |
| `contact_messages` | id, name, email, subject, message, created_at — public Contact Us submissions |

## API reference

### Auth & subscription

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | None | Create account, return JWT |
| `POST /auth/login` | None | Verify bcrypt hash, return JWT |
| `GET /auth/me` | Bearer | Current user info |
| `GET /subscription/plans` | None | Free / Professional (₹999) / Advocate Pro (₹2,499) |
| `POST /subscription/create-order` | Cookie / Bearer | Create Razorpay order for upgrade |
| `POST /subscription/verify` | Cookie / Bearer | Verify Razorpay payment, activate tier |
| `POST /subscription/upgrade` | — | **Deprecated** — returns 410 Gone |

### Client dashboard

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /client/cases` | Bearer | List all cases assigned to the client (with lawyer info) |
| `GET /client/cases/{id}` | Bearer | Get single case with attached documents |
| `PATCH /client/cases/{id}` | Bearer | Edit case description and hearing date |
| `POST /client/cases/{id}/documents` | Bearer | Upload a document for a case |
| `GET /client/cases/{id}/documents` | Bearer | List documents for a case |
| `GET /client/documents` | Bearer | List ALL documents across all cases |
| `DELETE /client/documents/{id}` | Bearer | Delete a client's document |

### Community services

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /contact` | None | Submit Contact Us message → `contact_messages` (rate-limited 5/min, validated) |
| `POST /ask` / `GET /ask` | None | Ask legal question (AI answers) / browse past Q&As (`?category=`) |
| `POST /document/analyze` | None | Document risk score, missing clauses, recommendations |
| `POST /judgments/search` | None | Search case law — AI returns 5 precedents |
| `GET /lawyers` / `POST /lawyers/register` | None / Bearer | Search directory / register as advocate |
| `GET /legal-aid/contacts` | None | NALSA helpline + all 8 TSLSA DLSA contacts |
| `POST /cases/requirements` / `GET /cases/requirements` / `GET /cases/requirements/mine` | Bearer / None / Bearer | Post / browse / own case requirements |
| `POST /match/find-lawyers` | Bearer | AI match: top 10 scored lawyers |
| `GET /matches/client` / `GET /matches/lawyer` | Bearer | Client / lawyer match proposals |
| `POST /matches/{id}/accept` / `POST /matches/{id}/decline` | Bearer | Accept / decline a match |
| `POST /ai-legal-chat` | Bearer | AI legal drafting chat with disclaimer |
| `GET /chat/threads` / `POST /chat/threads` | Bearer | List / create chat threads |
| `GET /chat/messages/{id}` / `POST /chat/messages/{id}` | Bearer | Get / send thread messages |

## Environment variables & secrets

Shared (set in Replit):

| Variable | Value | Notes |
|---|---|---|
| `BASE_PATH` | `/litigaforge` | Backend route prefix |
| `PORT` | `5000` | Backend port |
| `DATABASE_URL` | (auto-set) | PostgreSQL connection string |
| `SESSION_SECRET` | (Secret) | JWT signing |

Optional secrets (enable extra features):

| Secret | Enables |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (`whatsapp:+14155238886`), `ADVOCATE_WHATSAPP` | WhatsApp alerts |
| `SMTP_HOST`, `SMTP_PORT` (587/465), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email notifications (defaults: port 587, FROM = SMTP_USER) |

## User preferences

- Full mobile compatibility (Android + iOS)
- Light/white UI with amber/gold accents and subtle particle animations
- Save all work to GitHub: repo `arif806-cyber/litigaforge-ai`, branch `feature/arifbase`

## Gotchas

- Never nest `<Link>` inside `<a>` — wouter's Link renders as `<a>`.
- `BASE_PATH`/`PORT` are shared env vars — never inline them in workflow commands.
- Preserve `data-testid` on all interactive elements.
- pnpm workspaces: build/dev with `--filter @workspace/<name>`, never `pnpm dev` at root.
- WhatsApp sandbox number `whatsapp:+14155238886`; advocate must send the join message first.
- **Judgment slugs are NEVER renamed.** Stale / truncated / wrong-court links 301-redirect to canonical (unique-match only) via FastAPI `GET /judgments/resolve/{court}/{year}/{slug}` + api-server `_judgmentRedirectTarget` (real 301, 10-min cache) + a client-side net in `judgment-detail.tsx`. New ingests get clean `party1-v-party2` slugs (`_case_slug`). Curated landmark judgments are upserted on **every** backend startup (`_ensure_sample_judgments`, `ON CONFLICT DO NOTHING`), so additions reach already-populated dev + **prod** DBs on republish.
- **The main agent cannot run local git writes** (`git add`/`commit`/`push` are blocked). To push to GitHub, create a **background Project Task** (Plan mode) running `git push origin feature/arifbase` (clean fast-forward, non-force). PAT secret `GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE` (scopes `repo`+`workflow`, no expiry) — read its value via the **bash tool env**, NOT the code_execution sandbox; REST API uses `Authorization: Bearer`, git-over-HTTPS uses Basic auth (token as password). The blog pipeline uses the Actions built-in `GITHUB_TOKEN`, so user-PAT expiry never breaks it.

## Pointers

- Root `README.md` — full project docs (all env vars, API reference)
- `deployable/README.md` — Docker deploy + mobile store submission guide
- `pnpm-workspace` skill — workspace structure details
