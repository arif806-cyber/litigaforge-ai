# LitigaForge AI

Client-Lawyer Matching Platform + Legal AI for Telangana & AP. Clients post case requirements, AI matches them with verified lawyers (scored 0-100), and they collaborate via chat. Also includes: multi-AI legal strategy synthesis, legal Q&A, document analyzer, judgment finder, and free legal aid finder.

## Run & Operate

- Backend runs via `artifacts/api-server: LitigaForge AI` workflow: `cd artifacts/litigaforge-ai && BASE_PATH=/litigaforge PORT=5000 python main.py` (the standalone `LitigaForge AI` workflow was removed — it was a port-5000 duplicate of this artifact-managed one)
- Frontend runs via `artifacts/litigaforge-ui: web` workflow: `pnpm --filter @workspace/litigaforge-ui run dev`
- Production build: `PORT=23790 BASE_PATH=/ pnpm --filter @workspace/litigaforge-ui run build`
- GitHub branch: `feature/arifbase` on `arif806-cyber/litigaforge-ai`
- `BASE_PATH=/litigaforge` and `PORT=5000` are set as shared Replit env vars — all workflows pick them up automatically
- **Blog**: live at `https://litigaforge-blog.arif-806.workers.dev/blog/` — a Cloudflare **Worker** (static-assets, NOT Pages). `.github/workflows/pipeline.yml` runs every 2 hrs and is fully autonomous: generates articles → commits via GitHub API → `git reset --hard origin/main` → `astro build` → `wrangler deploy`. Free (public repo = unlimited Actions); `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` stored as GitHub repo secrets (token has no expiry). Custom domain `blog.litigaforge.com` still pending DNS.
  - **Reliable trigger (in-process VM scheduler)**: GitHub's free cron silently drops most scheduled runs (~1 of 24 fired over 2 days). The production deploy is a **`vm` (always-running)** instance (per `getDeploymentInfo`, NOT autoscale), so the dependable trigger is baked into the always-on `api-server` Express process: `src/lib/blogScheduler.ts` (started from `src/index.ts`) fires a GitHub `workflow_dispatch` every 2h aligned to **:15 IST** (00:15, 02:15 … 18:15 … 22:15) using the no-expiry PAT `GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE`. Zero extra cost (uses the existing VM). Self-disables off production via gate `NODE_ENV === "production"` (set by api-server `artifact.toml`; dev never fires). Per-run cap is **2** articles. **Takes effect only after a republish.** GitHub's flaky `schedule:` cron and the manual `bash scripts/trigger-blog.sh` are kept as harmless fallbacks (pipeline has a `content-pipeline` concurrency group, so an occasional extra batch is harmless).
  - **Generation kill-switch (FAIL-CLOSED)**: `pipeline.py` only generates when the blog repo's Actions **variable** `GENERATION_ENABLED == "true"` (currently **true** = live). Unset/anything-else = paused, publishing nothing. To pause/resume publishing, flip that repo variable in `arif806-cyber/litigaforge-blog` — **no code change or republish needed.**
  - **Content engine (quota + dedup)**: `pipeline.py` enforces a per-country daily quota (India 2, USA/UK/UAE/Germany 1 each, + 1 rotating Australia/Canada/Singapore = **~7/day**), 10-category rotation (no >2 consecutive same country/category, best-effort), slug ≤70 chars, min word count with one retry-then-discard, and a **daily-target gate** that counts today's IST-dated article frontmatter — if today's count ≥ `DAILY_TARGET` (7) the run publishes **0 (by design, not a bug)**. Dupes + `welcome.md` were removed; old slugs **301-redirect** to the user-chosen canonical slugs via the Worker's `public/_redirects` (fires before CF's trailing-slash 307) and at the apex via api-server `src/lib/blogRedirects.ts`. `_redirects` lists **both** `/blog/<old>` and `/blog/<old>/` sources (Astro serves articles at trailing-slash URLs, so old indexed links may use either form); the apex map covers both from one Express rule. `[slug].astro` emits FAQPage JSON-LD only when `faq.length > 0`.
  - **Apex `litigaforge.com/blog`**: the domain is NOT on Cloudflare (GoDaddy nameservers, apex A record → Replit deploy), so DNS can't path-route `/blog`. Instead the Express `api-server` (`artifacts/api-server/src/app.ts`) **reverse-proxies** `/blog`, `/blog/*`, `/_astro/*` to the Worker (registered before static + SPA catch-all). The litigaforge-ui PWA service worker denylists `/blog` + `/_astro` (`vite.config.ts` workbox) so it never serves the React shell for blog URLs. **Takes effect on litigaforge.com only after a republish.**
  - **Dynamic `/sitemap.xml`**: `api-server` serves a dynamic sitemap (route registered before `express.static`, so it overrides the on-disk `litigaforge-ui/public/sitemap.xml`). It keeps the static app-page URLs and **auto-merges live blog articles** by crawling the Worker blog index (follows pagination, 50-page cap), cached in-memory 1h, falling back to the static file if the Worker is unreachable. New articles appear automatically — no token or blog-repo change. **Takes effect on litigaforge.com only after a republish; then resubmit the sitemap in Google Search Console.**

## Stack

- Frontend: React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query, wouter
- Backend: Python 3.12, FastAPI, Uvicorn, LangGraph, LangChain
- AI: Claude Sonnet 4-6 + Gemini 2.5 Flash + GPT-5 via Replit AI Integrations (all free, no key needed)
- Database: PostgreSQL (Replit managed) — users, subscriptions, legal_questions, lawyers, case memory
- Auth: bcrypt (direct) password hashing, JWT (python-jose), 30-day tokens
- Mobile: Expo (React Native), Expo Router, NativeWind — in `deployable/mobile/`
- Fonts: Space Grotesk + JetBrains Mono (Google Fonts)

## Where things live

### Frontend pages (`artifacts/litigaforge-ui/src/pages/`)

- `use-cases.tsx` — Redirects to `/ask`
- `login.tsx`, `register.tsx` — Authentication (JWT via localStorage). Role-based: Client vs Lawyer tabs
- `client-dashboard.tsx` — **Client Dashboard**: assigned cases with stage timeline, match proposals, AI explanations, lawyer contact (call/email), case document upload, edit/share/download, NALSA helpline, upgrade banner. Navy sidebar + mobile hamburger drawer
- `documents.tsx` — **Documents Dashboard**: all client documents across cases with search, download, share (Web Share API + WhatsApp fallback), delete, upload
- `subscription.tsx` — Plan comparison & upgrade/downgrade
- `post-case.tsx` — **Post a Case**: client case posting form with anonymous option, 9 case types, budget range
- `my-cases.tsx` — **My Cases**: client tracks posted cases, views match proposals, accept/decline flow
- `matches.tsx` — **AI Matching**: lawyer match scores (0-100), AI explanations, accept/decline proposals
- `legal-chat.tsx` — **AI Legal Chat**: drafting assistant with 4 templates, live chat with Claude/Gemini
- `ask.tsx` — **Legal Q&A with AI**: ask questions, Claude answers instantly, community knowledge base
- `review.tsx` — **Document Analyzer**: risk scoring, missing clauses, recommendations
- `judgments.tsx` — **Judgment Finder**: precedent search + IndianKanoon links
- `lawyers.tsx` — **Lawyer Directory**: searchable advocate profiles with verification badges, ratings, hourly rates
- `legal-aid.tsx` — **Free Legal Aid Finder**: NALSA/TSLSA eligibility wizard + helplines
- `free-documents.tsx` — **Free Legal Documents**: 10 AI-powered document templates with search/filter
- `document-template.tsx` — **Document Template Fill Form**: dynamic form fields, AI generate, download/share/print
- `about.tsx` — **About Us** (AdSense-required): company overview, markets served, features, founder/T-Hub; standalone public route, ends with shared `LegalDisclaimerFooter`
- `contact.tsx` — **Contact Us** (AdSense-required): contact form (name/email/subject/message) → public `POST /contact` (saved to `contact_messages` table); standalone public route, ends with shared `LegalDisclaimerFooter`
- `privacy.tsx` / `terms.tsx` — Privacy Policy / Terms of Service (AdSense-required); both now end with shared `LegalDisclaimerFooter`; contact email aligned to `legal@litigaforge.com`. privacy.tsx includes "Cookies & Tracking" + "Google AdSense & Advertising" sections

### Backend (`artifacts/litigaforge-ai/`)

- `main.py` — FastAPI app: lifespan, CORS, rate limits, table init + includes 10 routers
- `routers/auth.py` — Register, login, logout, me
- `routers/subscription.py` — Plans, Razorpay create-order, verify
- `routers/matching.py` — Post case requirements, AI find-lawyers, match management
- `routers/chat.py` — AI legal drafting chat, match-based messaging threads
- `routers/community.py` — Legal Q&A, Document Analyzer, Judgment Finder, Lawyer Directory, Legal Aid
- `routers/watch.py` — Watch mode start/stop/add/list/remove (in-memory)
- `routers/alerts.py` — WhatsApp alerts, hearing reminders
- `routers/admin.py` — Pending lawyer verification, approve/reject, user management
- `routers/lawyer.py` — Lawyer case/document CRUD + **Client case endpoints**: `GET /client/cases`, `PATCH /client/cases/{id}`, document upload/share/delete, CNR tracking, AI analysis, notes
- `database.py` — PostgreSQL async pool (asyncpg): fetch, fetchrow, execute, executemany
- `auth.py` — bcrypt hashing, JWT create/decode, cookie-first auth with Bearer fallback
- `payments.py` — Razorpay integration: create_order, verify_payment, PLAN_PRICES
- `rate_limit.py` — slowapi limiter + custom 429 exception handler
- `ai_brain.py` — Multi-AI cascade (Claude → Gemini → GPT-5)
- `alerts/whatsapp.py` — Twilio WhatsApp integration

### Components & utilities

- `src/components/layout.tsx` — Sidebar: "Match & Connect" (Dashboard, Post Case, My Cases, Match Proposals, Documents) + "Legal Tools" (AI Chat, Q&A, Analyzer, etc). **Navy (#1a2744) sidebar for clients**, white sidebar for lawyers. Fixed bottom tab bar on mobile
- `src/components/legal-disclaimer.tsx` — Footer disclaimer + FirstVisitDisclaimer modal
- `src/components/graphics/` — ParticleCanvas, ScalesHero, EmptyStateArt
- `src/lib/api.ts` — apiFetch (auto-attaches Bearer token); BASE = "/litigaforge"
- `src/lib/auth-context.tsx` — AuthProvider, useAuth, TIER_LABELS, TIER_LIMITS

## Environment Variables (shared, set in Replit)

| Variable | Current Value | Notes |
|---|---|---|
| `BASE_PATH` | `/litigaforge` | Backend route prefix — shared env var |
| `PORT` | `5000` | Backend port — shared env var |
| `DATABASE_URL` | (Replit auto-set) | PostgreSQL connection string |
| `SESSION_SECRET` | (Replit Secret) | JWT signing |

### Secrets to add for more features

| Secret | Where to get it | Enables |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | twilio.com console | WhatsApp alerts |
| `TWILIO_AUTH_TOKEN` | twilio.com console | WhatsApp alerts |
| `TWILIO_FROM_NUMBER` | Twilio sandbox: `whatsapp:+14155238886` | WhatsApp sender |
| `ADVOCATE_WHATSAPP` | Your number e.g. `whatsapp:+919876543210` | WhatsApp recipient |
| `SMTP_HOST` | e.g. `smtp.gmail.com` | Email notifications (verification/rejection) |
| `SMTP_PORT` | `587` (STARTTLS) or `465` (SSL) | Email port, defaults to 587 |
| `SMTP_USER` | Your email login | SMTP authentication |
| `SMTP_PASSWORD` | App password / SMTP password | SMTP authentication |
| `SMTP_FROM` | Display From address | Defaults to SMTP_USER if not set |

## Architecture decisions

- `BASE_PATH=/litigaforge`: backend router mounts all routes at this prefix; proxy routes `/litigaforge/*` to port 5000
- AI layer: `ai_brain.py` calls all 3 providers (Claude, Gemini, GPT-5) via Replit's proxy. No API keys needed from user
- Fallback chain: Claude → Gemini → GPT-5 → smart regex + data-driven templates. Never generic output
- Tailwind v4, light/white UI — no `@apply dark`
- Mobile layout: sidebar hidden on mobile, replaced by hamburger drawer + fixed bottom tab bar (h-16); main content has `pb-16 md:pb-0`
- Code splitting: vite.config.ts splits react-vendor, motion, query, ui into separate chunks

## Database Schema (PostgreSQL)

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
| `contact_messages` | id, name, email, subject, message, created_at — public Contact Us form submissions |

## Auth & Subscription

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | None | Create account, return JWT |
| `POST /auth/login` | None | Verify bcrypt hash, return JWT |
| `GET /auth/me` | Bearer | Current user info |
| `GET /subscription/plans` | None | Free / Professional (₹999) / Advocate Pro (₹2,499) |
| `POST /subscription/create-order` | Cookie / Bearer | Create Razorpay order for upgrade |
| `POST /subscription/verify` | Cookie / Bearer | Verify Razorpay payment, activate tier |
| `POST /subscription/upgrade` | — | **Deprecated** — returns 410 Gone |

### Client Dashboard (API)

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /client/cases` | Bearer | List all cases assigned to the client (with lawyer info) |
| `GET /client/cases/{id}` | Bearer | Get single case with attached documents |
| `PATCH /client/cases/{id}` | Bearer | Edit case description and hearing date |
| `POST /client/cases/{id}/documents` | Bearer | Upload a document for a case |
| `GET /client/cases/{id}/documents` | Bearer | List documents for a case |
| `GET /client/documents` | Bearer | List ALL documents across all cases |
| `DELETE /client/documents/{id}` | Bearer | Delete a client's document |

JWT stored in `localStorage` key `lf_token`; `AuthProvider` in `src/lib/auth-context.tsx`. All main routes protected via `ProtectedRoute`.

## New Community Services (API)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /contact` | None | Submit Contact Us message — saved to `contact_messages` (rate-limited 5/min, email validated, subject whitelisted) |
| `POST /ask` | None | Ask legal question — AI answers instantly |
| `GET /ask` | None | Browse past Q&As (optional `?category=` filter) |
| `POST /document/analyze` | None | Document risk score, missing clauses, recommendations |
| `POST /judgments/search` | None | Search case law — AI returns 5 precedents |
| `GET /lawyers` | None | Search advocate directory |
| `POST /lawyers/register` | Bearer | Register as an advocate |
| `GET /legal-aid/contacts` | None | NALSA helpline + all 8 TSLSA DLSA contacts |
| `POST /cases/requirements` | Bearer | Post a new case requirement |
| `GET /cases/requirements` | None | Browse all open requirements |
| `GET /cases/requirements/mine` | Bearer | Client's own requirements |
| `POST /match/find-lawyers` | Bearer | AI match: top 10 scored lawyers |
| `GET /matches/client` | Bearer | Client match proposals |
| `GET /matches/lawyer` | Bearer | Lawyer match proposals |
| `POST /matches/{id}/accept` | Bearer | Accept a match |
| `POST /matches/{id}/decline` | Bearer | Decline a match |
| `POST /ai-legal-chat` | Bearer | AI legal drafting chat with disclaimer |
| `GET /chat/threads` | Bearer | List chat threads |
| `POST /chat/threads` | Bearer | Create new chat thread |
| `GET /chat/messages/{id}` | Bearer | Get thread messages |
| `POST /chat/messages/{id}` | Bearer | Send message to thread |

## Product (pages)

- **Login** (`/login`): email + password sign-in
- **Register** (`/register`): name + email + password, starts on Free tier
- **Client Dashboard** (`/client-dashboard`): default landing for clients
- **Lawyer Dashboard** (`/lawyer-dashboard`): default landing for lawyers
- **Post a Case** (`/post-case`): client case posting with anonymous option, 9 case types, budget range
- **My Cases** (`/my-cases`): client tracks posted cases and match proposals
- **Matches** (`/matches`): AI match scores, accept/decline lawyer proposals
- **AI Legal Chat** (`/legal-chat`): interactive drafting assistant with templates
- **Legal Q&A** (`/ask`): ask any question, Claude AI answers instantly
- **Document Analyzer** (`/review`): paste contract/FIR, AI flags risks
- **Judgment Finder** (`/judgments`): search precedents + IndianKanoon links
- **Lawyer Directory** (`/lawyers`): verified TG/AP advocates with badges, ratings, hourly rates
- **Free Legal Aid** (`/legal-aid`): NALSA eligibility wizard + DLSA contacts
- **Subscription** (`/subscription`): plan comparison, upgrade/downgrade
- **About Us** (`/about`): company info, markets, features (AdSense-required)
- **Contact Us** (`/contact`): working contact form saved to DB (AdSense-required)
- **Privacy Policy** (`/privacy`, alias `/privacy-policy`) & **Terms** (`/terms`): AdSense-required legal pages; all four public pages render the shared footer with Company links + copyright line
- **Blog** (`/blog`): redirects to `https://blog.litigaforge.com` — auto-publishes AI legal guides via Reddit pipeline

## User preferences

- Full mobile compatibility (Android + iOS)
- Light/white UI with amber/gold accents and subtle particle animations
- All work should be saved to GitHub: repo `arif806-cyber/litigaforge-ai`, branch `feature/arifbase`

## Gotchas

- Never nest `<Link>` inside `<a>` — wouter's Link renders as `<a>`
- `BASE_PATH` is now a shared env var — do NOT add it inline to workflow commands
- `data-testid` attributes must be preserved on all interactive elements
- pnpm workspaces: run build/dev with `--filter @workspace/<name>`, never `pnpm dev` at root
- WhatsApp sandbox: Twilio sandbox number is `whatsapp:+14155238886`; advocate must first send join message to activate
- GitHub push / repo edits: use the **no-expiry** classic PAT secret `GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE` (scopes `repo`+`workflow`, never expires). Read secret VALUES via the bash tool env, NOT the code_execution sandbox (sandbox has no Replit secrets). The blog auto-publish pipeline does NOT use any user PAT — it uses the GitHub Actions built-in `secrets.GITHUB_TOKEN` (per-run, can't expire), so token expiry never breaks the blog.

## Pointers

- See `README.md` (root) for full project documentation including all env vars, API reference
- See `deployable/README.md` for Docker deployment and mobile store submission guide
- See the `pnpm-workspace` skill for workspace structure details
