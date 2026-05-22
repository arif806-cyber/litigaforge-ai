# LitigaForge AI

Legal AI platform for Telangana & AP advocates — extracts entities from case facts, runs 16 government API chains, and synthesises a data-driven legal strategy. Now with 5 community legal services: Legal Q&A, Document Analyzer, Judgment Finder, Lawyer Directory, and Free Legal Aid Finder.

## Run & Operate

- Backend runs via `LitigaForge AI` workflow: `cd artifacts/litigaforge-ai && PORT=5000 python main.py`
- Frontend runs via `artifacts/litigaforge-ui: web` workflow: `pnpm --filter @workspace/litigaforge-ui run dev`
- Production build: `PORT=23790 BASE_PATH=/ pnpm --filter @workspace/litigaforge-ui run build`
- GitHub branch: `feature/arifbase` on `arif806-cyber/litigaforge-ai`
- `BASE_PATH=/litigaforge` and `PORT=5000` are set as shared Replit env vars — all workflows pick them up automatically

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

- `forge.tsx` — The Forge: case facts → entities → API chains → legal strategy
- `cases.tsx` — Browse all previously forged cases
- `chains.tsx` — View all 16 API chains with live/sandbox/mock status
- `case-detail.tsx` — Full chain results, strategy, entities for a single case
- `use-cases.tsx` — 7 interactive scenario cards with "Try in Forge" button
- `login.tsx`, `register.tsx` — Authentication (JWT via localStorage)
- `subscription.tsx` — Plan comparison & upgrade/downgrade
- `ask.tsx` — **Legal Q&A with AI**: ask questions, Claude answers instantly, community knowledge base
- `review.tsx` — **Document Analyzer**: risk scoring, missing clauses, recommendations
- `judgments.tsx` — **Judgment Finder**: precedent search + IndianKanoon links
- `lawyers.tsx` — **Lawyer Directory**: 12 seeded TG/AP advocate profiles + self-registration
- `legal-aid.tsx` — **Free Legal Aid Finder**: NALSA/TSLSA eligibility wizard + helplines

### Backend (`artifacts/litigaforge-ai/`)

- `main.py` — FastAPI app: auth, forge, cases, chains, watch, alerts + mounts `extra_routes`
- `extra_routes.py` — Legal Q&A, Document Analyzer, Judgment Finder, Lawyers, Legal Aid
- `database.py` — PostgreSQL CRUD (psycopg2)
- `auth.py` — bcrypt hashing, JWT create/decode, FastAPI deps
- `litigaforge_engine.py` — Forge orchestration
- `ai_brain.py` — Multi-AI cascade (Claude → Gemini → GPT-5)
- `api_chains/` — 16 government API chain modules
- `alerts/whatsapp.py` — Twilio WhatsApp integration
- `watch_mode/` — Background case watcher scheduler
- `forge_memory/` — Case storage and pattern learning

### Components & utilities

- `src/components/layout.tsx` — Sidebar (Tools + Services sections), topbar, mobile drawer, user panel
- `src/components/graphics/` — ParticleCanvas, ScalesHero, ChainDiagram, EmptyStateArt
- `src/lib/api.ts` — apiFetch (auto-attaches Bearer token); BASE = "/litigaforge"
- `src/lib/auth-context.tsx` — AuthProvider, useAuth, TIER_LABELS, TIER_LIMITS

## Environment Variables (shared, set in Replit)

| Variable | Current Value | Notes |
|---|---|---|
| `BASE_PATH` | `/litigaforge` | Backend route prefix — shared env var |
| `PORT` | `5000` | Backend port — shared env var |
| `DATABASE_URL` | (Replit auto-set) | PostgreSQL connection string |
| `SESSION_SECRET` | (Replit Secret) | JWT signing |
| `API_SETU_KEY` | `demokey123456ABCD789` | Public sandbox key for API Setu |
| `API_SETU_CLIENT_ID` | `in.gov.sandbox` | Public sandbox client ID |
| `MEESEVA_USE_PROD` | `false` | Set `true` + real key for production |

### Secrets to add for more features

| Secret | Where to get it | Enables |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | twilio.com console | WhatsApp alerts |
| `TWILIO_AUTH_TOKEN` | twilio.com console | WhatsApp alerts |
| `TWILIO_FROM_NUMBER` | Twilio sandbox: `whatsapp:+14155238886` | WhatsApp sender |
| `ADVOCATE_WHATSAPP` | Your number e.g. `whatsapp:+919876543210` | WhatsApp recipient |
| `MERIPEHCHAAN_CLIENT_ID` | meripehchaan.gov.in | Live DigiLocker OAuth |
| `MERIPEHCHAAN_CLIENT_SECRET` | meripehchaan.gov.in | Live DigiLocker OAuth |
| `ECOURTS_API_KEY` | webapi.ecourtsindia.com/dashboard/settings?activate=partner | Live eCourts case lookup (CNR, search, orders)

## API Chain Status

| Chain | Status | Data Source |
|---|---|---|
| Mee Seva TG | **Live sandbox** | `sandbox.api-setu.in` |
| Transport TS | **Live sandbox** | `sandbox.api-setu.in` |
| NSE India | **Live sandbox** | `sandbox.api-setu.in` |
| FOREX | **Live sandbox** | `sandbox.api-setu.in` |
| BPCL LPG | Sandbox-ready | Needs `API_SETU_KEY` |
| MeriPehchaan | Mock | Needs OAuth client credentials |
| eCourts | **Live** | `webapi.ecourtsindia.com` — CNR lookup, case search, orders |
| GSTIN, PAN, VAHAN, SARATHI, DigiLocker, MCA Company, IFSC, Pincode | Mock | Realistic fake data |

To go live on all API Setu chains: register at api.setu.in, get approved credentials, replace `API_SETU_KEY`, set `MEESEVA_USE_PROD=true`.

## Architecture decisions

- `BASE_PATH=/litigaforge`: backend router mounts all routes at this prefix; proxy routes `/litigaforge/*` to port 5000
- AI layer: `ai_brain.py` calls all 3 providers (Claude, Gemini, GPT-5) via Replit's proxy. No API keys needed from user
- Fallback chain: Claude → Gemini → GPT-5 → smart regex + data-driven templates. Never generic output
- Sandbox mode: Mee Seva TG, Transport TS, NSE India, FOREX call `sandbox.api-setu.in` with the demo key
- Tailwind v4, light/white UI — no `@apply dark`
- Mobile layout: sidebar hidden on mobile, replaced by hamburger drawer + fixed bottom tab bar (h-16); main content has `pb-16 md:pb-0`
- Code splitting: vite.config.ts splits react-vendor, motion, query, ui into separate chunks

## Database Schema (PostgreSQL)

| Table | Purpose |
|---|---|
| `users` | id, email, name, password_hash, subscription_tier, cases_this_month, month_reset_date, created_at |
| `subscriptions` | id, user_id FK, tier, started_at, expires_at, status, payment_ref |
| `legal_questions` | id, user_id FK nullable, question, category, ai_answer, upvotes, created_at |
| `lawyers` | id, name, email, phone, bar_number, district, practice_areas[], languages[], experience_years, rating, bio, verified, created_at |

## Auth & Subscription

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | None | Create account, return JWT |
| `POST /auth/login` | None | Verify bcrypt hash, return JWT |
| `GET /auth/me` | Bearer | Current user info |
| `GET /subscription/plans` | None | Free / Professional (₹999) / Advocate Pro (₹2,499) |
| `POST /subscription/upgrade` | Bearer | Switch tier instantly |

JWT stored in `localStorage` key `lf_token`; `AuthProvider` in `src/lib/auth-context.tsx`. All main routes protected via `ProtectedRoute`.

## New Community Services (API)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /ask` | None | Ask legal question — AI answers instantly |
| `GET /ask` | None | Browse past Q&As (optional `?category=` filter) |
| `POST /document/analyze` | None | Document risk score, missing clauses, recommendations |
| `POST /judgments/search` | None | Search case law — AI returns 5 precedents |
| `GET /lawyers` | None | Search advocate directory |
| `POST /lawyers/register` | Bearer | Register as an advocate |
| `GET /legal-aid/contacts` | None | NALSA helpline + all 8 TSLSA DLSA contacts |

## Product (pages)

- **Login** (`/login`): email + password sign-in
- **Register** (`/register`): name + email + password, starts on Free tier
- **The Forge** (`/`): case facts → entities → chains → legal strategy
- **Cases** (`/cases`): browse all previously forged cases
- **Chains** (`/chains`): 16 API chains with live/sandbox/mock status
- **Case Detail** (`/cases/:id`): full chain results, strategy, entities
- **Use Cases** (`/use-cases`): 7 interactive scenario cards
- **Legal Q&A** (`/ask`): ask any question, Claude AI answers instantly
- **Document Analyzer** (`/review`): paste contract/FIR, AI flags risks
- **Judgment Finder** (`/judgments`): search precedents + IndianKanoon links
- **Lawyer Directory** (`/lawyers`): 12 verified TG/AP advocates, filter by district/area
- **Free Legal Aid** (`/legal-aid`): NALSA eligibility wizard + DLSA contacts
- **Subscription** (`/subscription`): plan comparison, upgrade/downgrade

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
- GitHub push: requires valid `GITHUB_TOKEN` secret. If pushing fails, regenerate token at github.com/settings/tokens with `repo` scope

## Pointers

- See `README.md` (root) for full project documentation including all env vars, chain status table, API reference, forge tips
- See `deployable/README.md` for Docker deployment and mobile store submission guide
- See the `pnpm-workspace` skill for workspace structure details
