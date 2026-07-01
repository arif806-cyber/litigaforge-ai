# LitigaForge AI

**Client-Lawyer Matching Platform + Legal Intelligence for Telangana & Andhra Pradesh**

LitigaForge AI connects clients with verified lawyers through AI-powered matching, while providing a complete legal toolkit: live eCourts case tracking, AI legal strategy synthesis, RAG-powered case companion, judgment search, document analysis, and free legal aid — all in one platform. Powered by a multi-AI cascade (Claude Sonnet 4-6 + Gemini 2.5 Flash + GPT-5) with user accounts, subscription tiers, and live case intelligence.

---

## Table of Contents

- [Features](#features)
- [eCourtsIndia Live Case Intelligence](#ecourtsindia-live-case-intelligence)
- [Forge Workspace](#forge-workspace)
- [Tech Stack](#tech-stack)
- [Repo Structure](#repo-structure)
- [Authentication & Subscriptions](#authentication--subscriptions)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Run Locally (Replit)](#run-locally-replit)
- [Deploy on Your Own Server](#deploy-on-your-own-server)
- [Deploy on Replit](#deploy-on-replit)
- [Mobile App](#mobile-app)
- [Architecture](#architecture)

---

## Features

- **Role-Based Access** — register as Client or Lawyer; each gets its own dashboard and workflow
- **Client Dashboard** — assigned cases with stage timeline, AI match proposals, document upload, NALSA helpline
- **Lawyer Dashboard** — full case management: create/edit cases, upload & AI-analyze documents, CNR tracking, status pipeline
- **AI Matching** — clients post case requirements; AI scores lawyers 0–100 on practice area, location, experience, and rating with plain-language explanations
- **eCourtsIndia Live Case Intelligence** — track any CNR number live; nightly diff engine detects hearing changes, new orders, and status updates; RAG case companion answers questions grounded in real court orders; opponent intelligence graph; predictive next-hearing dates (see [section below](#ecourtsindia-live-case-intelligence))
- **Forge Workspace** — spatial argument-map canvas for lawyers; 5 parallel AI specialist agents (Litigator, Researcher, Risk Analyst, Drafter, Strategist); Personal Legal Twin; Indian Kanoon search; what-if simulation; proactive insights; auto-save to PostgreSQL
- **Legal Q&A** — ask any question; AI answers instantly with applicable Indian law and next steps; community knowledge base
- **Document Analyzer** — paste contract/FIR/sale deed; AI returns risk score, missing clauses, and amendment recommendations
- **Judgment Finder** — keyword search returns 5 precedents with IndianKanoon links; daily digest email (opt-in)
- **Lawyer Directory** — searchable Telangana & AP advocate profiles; verification badges; self-registration
- **Free Legal Documents** — 10 AI-generated fill-in templates (rent agreement, legal notice, PoA, affidavit, NDA, will, consumer complaint, etc.)
- **Free Legal Aid** — NALSA / TSLSA eligibility wizard and all 8 DLSA contact numbers
- **Blog / Legal Guides** — Astro static site deployed to Cloudflare Workers; auto-generated SEO articles (per-country quota, 10-category rotation); apex `/blog` reverse-proxied by the API server; dynamic sitemap
- **Subscription Tiers** — Free · Professional ₹999/mo · Advocate Pro ₹2,499/mo; Razorpay checkout; live plan-change enforcement (no re-login needed)
- **Multi-AI Cascade** — Claude Sonnet 4-6 → Gemini 2.5 Flash → GPT-5 — all free via Replit AI Integrations; LiteLLM layer makes the provider env-switchable (`LLM_MODEL`)
- **AI Safety** — prompt injection detection, Pydantic v2 field validators, unoverridable legal system prompt wrapper, mandatory "not legal advice" disclaimer on every AI response
- **Mobile App** — Expo / React Native / NativeWind in `deployable/mobile/`
- **WhatsApp Alerts** — hearing reminders via Twilio
- **16 Government API Chains** — GSTIN, PAN, eCourts, VAHAN, SARATHI, DigiLocker, BPCL LPG, MeriPehchaan, Mee Seva TG, Transport TS, NSE India, Stock Exchange, FOREX, MCA Company, IFSC, Pincode

---

## eCourtsIndia Live Case Intelligence

Track any CNR number in real time. Data is fetched from `webapi.ecourtsindia.com` using a rotating dual-key pool (`ECOURTSINDIA_API_KEY` / `ECOURTSINDIA_API_KEY_2`).

### Phase 1 — Diff Engine & Alerts

- Add a CNR with `POST /court-intel/track`; an immediate refresh fires in the background
- Nightly scheduler (00:30 IST, production) compares each new snapshot with the previous one and creates structured `case_events` for hearing-date changes, status changes, and new court orders
- Event notifications stored in `case_tracking_notifications`; retry loop re-sends failed emails
- `GET /court-intel/{id}/timeline` — free users see current status + next hearing; LiveTrack users see full snapshot history and event feed

### Phase 2 — RAG Case Companion

- New court orders are automatically chunked and embedded (NIM `nvidia/nv-embedqa-e5-v5`, 1024-dim) via `case_order_embeddings` (pgvector)
- `POST /court-intel/{id}/ask` — answer a question grounded only in this case's real court orders; mandatory `WHERE tracked_case_id = {id}` scope filter prevents cross-case leakage
- LiteLLM layer (Claude → ai_brain cascade fallback) generates the final answer

### Phase 3 — Opponent Intelligence + Predictive Timeline

| Feature | Endpoint | Description |
|---|---|---|
| Opponent scan | `POST /court-intel/{id}/opponent-scan` | Searches eCourts for all cases involving the named opponent; builds court-breakdown + case-type breakdown + adjournment rate (when ≥ 3 hearings in API response) |
| Opponent profile | `GET /court-intel/{id}/opponent` | Returns cached profile; 404 if not yet scanned |
| Predictive timeline | `GET /court-intel/{id}/prediction` | Heuristic: groups all tracked cases by `(case_type, court_name)`, computes median interval between consecutive hearing dates for groups with ≥ 3 data points, applies to each case's last known hearing date |

**Gating** — Phase 2 and Phase 3 endpoints require **LiveTrack** (Professional or Advocate Pro). Every gated request queries the `subscriptions` table live — not the cached `users.subscription_tier` field — so plan changes take effect immediately without re-login. Free-tier requests return:

```json
HTTP 402
{
  "error": "upgrade_required",
  "message": "This feature requires LiveTrack (Professional or Advocate Pro).",
  "upgrade_url": "/subscription"
}
```

### Court Intelligence Endpoints

All at `/litigaforge/court-intel/*` — Bearer auth required.

| Method | Path | Tier | Description |
|---|---|---|---|
| `POST` | `/track` | Free | Add CNR; triggers immediate refresh |
| `GET` | `/my-cases` | Free | List tracked cases with latest snapshot |
| `GET` | `/{id}/timeline` | Free / LiveTrack | Status + events (reduced for free, full for paid) |
| `GET` | `/{id}/events` | LiveTrack | Full event feed (max 200) |
| `POST` | `/{id}/ask` | LiveTrack | RAG: answer question from real court orders |
| `POST` | `/{id}/opponent-scan` | LiveTrack | Build opponent intelligence profile |
| `GET` | `/{id}/opponent` | LiveTrack | Return cached opponent profile |
| `GET` | `/{id}/prediction` | LiveTrack | Predicted next hearing date |
| `DELETE` | `/{id}` | Free | Stop tracking a CNR |
| `POST` | `/worker/run` | Superuser | Manual nightly refresh trigger |

---

## Forge Workspace

**Forge Workspace** (`/workspace`) is the advanced legal strategy environment for lawyers and law students — a spatial canvas where you build argument maps, run multi-agent AI analysis, simulate what-if scenarios, and search 50M+ Indian judgments.

| Feature | Detail |
|---|---|
| **Spatial Canvas** | Drag to pan, scroll to zoom. Six node types: Fact, Issue, Argument, Risk, Strategy, Judgment. Connect nodes to build argument chains. |
| **5-Agent AI Analysis** | Litigator · Researcher · Risk Analyst · Drafter · Strategist — run in parallel, stream reasoning live via SSE. Thumb up/down teaches your Personal Twin. |
| **Personal Legal Twin** | Self-learning advocate profile from your history: argument-structure echo detection, cross-matter judgment alerts, suggestion downgrading, draft-style tracking, learning toggle. |
| **Indian Kanoon Search** | Search 50M+ judgments; drop results directly onto the canvas as connected nodes. |
| **What-If Simulation** | Change a key fact, re-run agents, see before/after risk scores without touching the main canvas. |
| **Proactive Insights** | Auto-refreshes after each analysis; accept a suggestion to add it as a canvas node. |
| **Auto-Save** | Canvas persists to PostgreSQL 2 s after every change. |
| **Demo Matter** | First visit: choose a blank canvas or a pre-built 9-node Family Pension argument map (D.S. Nakara 1983 + Jitendra Kumar Srivastava 2013). |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query, wouter |
| Backend | Python 3.12, FastAPI, Uvicorn, asyncpg, LangGraph, LangChain, slowapi |
| AI (primary) | Claude Sonnet 4-6 + Gemini 2.5 Flash + GPT-5 — all free via Replit AI Integrations |
| AI (LLM layer) | LiteLLM (`llm/`) — env-switchable via `LLM_MODEL`; default `anthropic/claude-sonnet-4-6` |
| Embeddings | NIM `nvidia/nv-embedqa-e5-v5` (1024-dim) via `NIM_API_KEY`; pgvector ivfflat index |
| Database | PostgreSQL (Replit-managed) + pgvector extension |
| Auth | bcrypt, JWT (python-jose), 15-min access token, 7-day refresh token, httpOnly cookie + Bearer fallback |
| Payments | Razorpay (create-order + verify) |
| Blog | Astro → Cloudflare Workers static; auto-generation pipeline via GitHub Actions |
| Mobile | Expo, React Native, NativeWind |
| Alerts | Twilio WhatsApp + SMTP (Gmail app-password) |
| Fonts | Space Grotesk, JetBrains Mono |

---

## Repo Structure

```
litigaforge-ai/
├── artifacts/
│   ├── litigaforge-ui/              # React + Vite web frontend
│   │   └── src/
│   │       ├── pages/               # All route pages
│   │       │   ├── workspace.tsx      # Forge Workspace
│   │       │   ├── login.tsx / register.tsx
│   │       │   ├── client-dashboard.tsx / lawyer-dashboard.tsx
│   │       │   ├── post-case.tsx / my-cases.tsx / matches.tsx
│   │       │   ├── legal-chat.tsx / ask.tsx / review.tsx
│   │       │   ├── judgments.tsx / judgment-detail.tsx
│   │       │   ├── lawyers.tsx / legal-aid.tsx
│   │       │   ├── free-documents.tsx / document-template.tsx
│   │       │   ├── documents.tsx      # All-cases document hub
│   │       │   ├── subscription.tsx
│   │       │   ├── about.tsx / contact.tsx / privacy.tsx / terms.tsx
│   │       │   └── admin.tsx
│   │       ├── components/
│   │       │   ├── workspace/         # 12 Forge Workspace components
│   │       │   │   ├── AgentPanel.tsx / ForgeCanvas.tsx / NodeTypes.tsx
│   │       │   │   ├── EdgeTypes.tsx / SearchPanel.tsx / SimulationPanel.tsx
│   │       │   │   ├── ProactivePanel.tsx / PersonalTwinPanel.tsx
│   │       │   │   ├── ForgeWelcome.tsx / ForgeTour.tsx
│   │       │   │   ├── ForgeToast.tsx / WorkspaceLang.tsx
│   │       │   ├── layout.tsx         # Sidebar, mobile drawer, 6-item tab bar
│   │       │   ├── PageHeader.tsx     # Mobile top-bar (shared)
│   │       │   └── legal-disclaimer.tsx
│   │       └── lib/
│   │           ├── api.ts             # apiFetch with auto Bearer
│   │           └── auth-context.tsx   # AuthProvider + useAuth
│   │
│   └── litigaforge-ai/              # Python FastAPI backend
│       ├── main.py                  # App lifespan, CORS, rate limits, router registration
│       ├── database.py              # asyncpg pool: fetch / fetchrow / execute / fetchval
│       ├── auth.py                  # bcrypt + JWT; require_user dependency
│       ├── payments.py              # Razorpay create_order + verify_payment
│       ├── rate_limit.py            # slowapi + custom 429 handler
│       ├── ai_brain.py              # Multi-AI cascade (Claude → Gemini → GPT-5)
│       ├── sanitizer.py             # Prompt injection detection, text sanitization
│       ├── ai_safety.py             # System prompt wrapper + disclaimer injection
│       ├── models.py                # Pydantic v2 request validators
│       ├── logger.py                # Structured logging
│       ├── requirements.txt
│       ├── routers/
│       │   ├── auth.py              # Register, login, refresh, logout, me; passkeys; push
│       │   ├── subscription.py      # Plans, Razorpay create-order + verify
│       │   ├── matching.py          # Post requirements, AI find-lawyers, match accept/decline
│       │   ├── chat.py              # AI legal chat; match-based message threads
│       │   ├── community.py         # Ask, Document Analyzer, Judgments, Lawyers, Legal Aid
│       │   ├── lawyer.py            # Lawyer case + document CRUD; CNR; AI analysis
│       │   ├── documents.py         # Client document upload / list / delete
│       │   ├── workspace.py         # Forge Workspace sessions, canvas, SSE agents, simulation
│       │   ├── personalization.py   # Personal Legal Twin — learning events + profile
│       │   ├── court_intelligence.py # eCourtsIndia Live Case Intelligence (Phase 1+2+3)
│       │   ├── judgments.py         # Judgment CRUD, IndianKanoon ingestion, digest
│       │   ├── admin.py             # Lawyer verification, user management
│       │   ├── alerts.py            # WhatsApp + email alerts; notification retry
│       │   ├── watch.py             # Watch mode scheduler
│       │   └── llm.py              # LLM health probe (/llm/health)
│       ├── services/
│       │   └── court_data_client.py # eCourtsIndia API: get_case_by_cnr, get_case_orders,
│       │                            #   get_order_text, search_litigant, bulk_refresh
│       ├── workers/
│       │   └── case_refresh_worker.py # Nightly diff engine: snapshots, events, embeddings,
│       │                              #   email notifications, predictive timeline
│       ├── llm/
│       │   ├── config.py            # LiteLLM provider config (env-switchable)
│       │   ├── legal_llm.py         # acomplete() — primary LLM call
│       │   └── nim_embed.py         # NIM embedding: aembed_passages / aembed_query
│       ├── alerts/
│       │   ├── whatsapp.py          # Twilio WhatsApp
│       │   └── email.py             # SMTP: case event emails + judgment digest
│       ├── api_chains/              # 16 government API chain modules
│       │   ├── gstin.py / pan.py / ecourts.py / vahan.py / sarathi.py
│       │   ├── digilocker.py / bpcl_lpg.py / meripehchaan.py
│       │   ├── mee_seva_tg.py / transport_ts.py
│       │   ├── nse_india.py / stock_exchange.py / forex.py
│       │   ├── mca_company.py / ifsc.py / pincode.py
│       └── forge_memory/            # Case storage and pattern learning
│
└── deployable/                      # Self-contained Docker + mobile package
    ├── README.md
    ├── .env.example
    ├── docker-compose.yml
    ├── web/
    │   ├── backend/                 # Backend Dockerfile
    │   └── frontend/                # Frontend Dockerfile + nginx.conf
    └── mobile/                      # Expo React Native app
        ├── app.json / eas.json
        └── app/
            ├── _layout.tsx / index.tsx
            ├── cases.tsx / chains.tsx
            └── case/[id].tsx
```

---

## Authentication & Subscriptions

### How auth works

- **Register** at `/register` — name, email, password, role (Client or Lawyer). Returns access token + sets httpOnly cookie.
- **Login** at `/login` — verifies bcrypt hash; returns 15-min JWT access token + 7-day refresh token (httpOnly cookie).
- **Token refresh** — `POST /auth/refresh` with the refresh cookie; transparent to the frontend.
- **Role redirect** — lawyers → `/lawyer-dashboard`, clients → `/client-dashboard`.
- All main pages protected by `ProtectedRoute`; unauthenticated users redirected to `/login` with a `returnTo` saved in sessionStorage.

### Subscription tiers

| Tier | Price | Cases / Month | Features |
|---|---|---|---|
| **Free** | ₹0 | 5 | Basic tools; `/timeline` (reduced) |
| **Professional** | ₹999 / mo | 50 | LiveTrack — full court intel, RAG, opponent intelligence, predictions |
| **Advocate Pro** | ₹2,499 / mo | Unlimited | All Professional features + full Multi-AI |

**LiveTrack gating is enforced server-side via a live subscription check on every request** — not a cached flag. Changing your plan takes effect immediately.

Razorpay payment flow:
1. `POST /subscription/create-order` → Razorpay order
2. Razorpay checkout modal opens
3. `POST /subscription/verify` → signature verified, tier activated

---

## Database Schema

### Core tables

```sql
CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  email             TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  subscription_tier TEXT DEFAULT 'free',
  cases_this_month  INTEGER DEFAULT 0,
  month_reset_date  DATE DEFAULT CURRENT_DATE,
  is_superuser      BOOLEAN DEFAULT FALSE,
  role              TEXT DEFAULT 'client',
  case_tracking_emails BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tier        TEXT NOT NULL,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  status      TEXT DEFAULT 'active',
  payment_ref TEXT
);

CREATE TABLE lawyers (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  email               TEXT, phone TEXT, bar_number TEXT, district TEXT,
  practice_areas      TEXT[], languages TEXT[],
  experience_years    INTEGER, rating NUMERIC(3,2) DEFAULT 0,
  bio TEXT, hourly_rate INTEGER, availability TEXT DEFAULT 'available',
  verification_status TEXT DEFAULT 'pending', verified BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE case_requirements (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT, case_type TEXT, description TEXT, location TEXT,
  budget_range TEXT, budget_min INTEGER, budget_max INTEGER,
  is_anonymous BOOLEAN DEFAULT FALSE, status TEXT DEFAULT 'open',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE matches (
  id                  SERIAL PRIMARY KEY,
  case_requirement_id INTEGER REFERENCES case_requirements(id) ON DELETE CASCADE,
  lawyer_id           INTEGER REFERENCES lawyers(id) ON DELETE CASCADE,
  client_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', match_score INTEGER DEFAULT 0,
  ai_explanation TEXT, client_message TEXT, lawyer_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lawyer_cases (
  id           SERIAL PRIMARY KEY,
  lawyer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT, case_type TEXT, description TEXT, client_name TEXT,
  court_name TEXT, cnr_number TEXT, hearing_date TEXT,
  case_stage TEXT DEFAULT 'filed', status TEXT DEFAULT 'active',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE client_documents (
  id           SERIAL PRIMARY KEY,
  case_id      INTEGER REFERENCES lawyer_cases(id) ON DELETE CASCADE,
  client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT, file_type TEXT, file_size INTEGER,
  file_path TEXT, file_url TEXT,
  case_requirement_id INTEGER REFERENCES case_requirements(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contact_messages (
  id      SERIAL PRIMARY KEY,
  name TEXT, email TEXT, subject TEXT, message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### eCourtsIndia Live Case Intelligence tables (Phase 1 + 2 + 3)

```sql
CREATE TABLE tracked_cases (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cnr                    TEXT NOT NULL,
  case_type              TEXT,
  court_name             TEXT,
  added_at               TIMESTAMPTZ DEFAULT NOW(),
  last_refreshed         TIMESTAMPTZ,
  is_active              BOOLEAN DEFAULT TRUE,
  tier_gated             BOOLEAN DEFAULT TRUE,
  predicted_next_hearing DATE,           -- Phase 3: heuristic (NULL = not enough data)
  UNIQUE(user_id, cnr)
);

CREATE TABLE case_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE CASCADE,
  case_status     TEXT,
  next_hearing_date DATE,
  order_count     INTEGER DEFAULT 0,
  raw_payload     JSONB,
  fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE case_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,    -- hearing_date_changed | status_changed | new_order | case_disposed
  summary         TEXT,
  detected_at     TIMESTAMPTZ DEFAULT NOW(),
  notified        BOOLEAN DEFAULT FALSE
);

CREATE TABLE case_tracking_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE CASCADE,
  case_event_id   UUID REFERENCES case_events(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel         TEXT DEFAULT 'email',
  status          TEXT DEFAULT 'pending',   -- pending | sent | failed
  attempts        INTEGER DEFAULT 0,
  last_attempted  TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ
);

-- Phase 2: pgvector court order embeddings (NIM e5-v5, 1024-dim)
CREATE TABLE case_order_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE CASCADE,
  order_date      DATE,
  order_text      TEXT,
  embedding       vector(1024),
  embedded_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_case_order_emb_vec ON case_order_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Phase 3: opponent intelligence cache
CREATE TABLE opponent_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE CASCADE,
  opponent_name   TEXT NOT NULL,
  total_cases_found INT DEFAULT 0,
  profile_json    JSONB,
  last_built_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tracked_case_id)
);
```

### Other tables

```sql
-- Forge Workspace
CREATE TABLE workspace_sessions (
  id UUID PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT, nodes JSONB, edges JSONB, description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personal Legal Twin
CREATE TABLE learning_events (
  id UUID PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT, payload JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile JSONB, learning_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Judgments
CREATE TABLE judgments (
  id UUID PRIMARY KEY, court_slug TEXT, year INTEGER,
  party1 TEXT, party2 TEXT, slug TEXT, source_url TEXT,
  summary TEXT, full_text TEXT, citation TEXT, date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(court_slug, year, slug)
);
CREATE TABLE digest_subscribers (
  id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL, country TEXT DEFAULT 'in',
  verified BOOLEAN DEFAULT FALSE, unsubscribed BOOLEAN DEFAULT FALSE,
  token TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat
CREATE TABLE chat_threads (
  id SERIAL PRIMARY KEY, match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  title TEXT, last_message_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY, thread_id INTEGER REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_role TEXT DEFAULT 'user', content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Environment Variables

### Core (set as Replit shared env vars)

| Variable | Value | Notes |
|---|---|---|
| `BASE_PATH` | `/litigaforge` | Backend route prefix |
| `PORT` | `5000` | Uvicorn listen port |
| `DATABASE_URL` | auto | Replit-managed PostgreSQL |
| `SESSION_SECRET` | Secret | JWT signing key |

### AI (auto-injected by Replit — no keys needed)

| Variable | Provider |
|---|---|
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Claude Sonnet 4-6 |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Gemini 2.5 Flash |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | GPT-5 |

Override provider with `LLM_MODEL` (e.g. `gemini/gemini-2.5-flash`). Override base with `LLM_API_BASE` + `LLM_API_KEY`. Set `LLM_TIMEOUT` ≥ 60s.

### eCourtsIndia

| Variable | Description |
|---|---|
| `ECOURTSINDIA_API_KEY` | Primary key — rotated automatically |
| `ECOURTSINDIA_API_KEY_2` | Secondary key (dual-key rotation on 429) |

### NIM Embeddings

| Variable | Description |
|---|---|
| `NIM_API_KEY` | NVIDIA NIM API key for `nv-embedqa-e5-v5` embeddings |

### Razorpay

| Variable | Description |
|---|---|
| `RAZORPAY_KEY_ID` | e.g. `rzp_test_xxx` (use test keys in dev) |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |

### Email (SMTP)

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | — | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | `587` | TLS port |
| `SMTP_USER` | — | Sender address |
| `SMTP_PASSWORD` | Secret | App-password for Gmail |
| `SMTP_FROM` | `SMTP_USER` | From address (optional override) |

### WhatsApp (Twilio)

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | `whatsapp:+14155238886` (sandbox) |
| `ADVOCATE_WHATSAPP` | Recipient: `whatsapp:+91XXXXXXXXXX` |

### Blog Pipeline

| Variable | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | CF API token for `wrangler deploy` |
| `GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE` | PAT (repo + workflow scopes) for GitHub dispatch |

> The app is fully functional with only `SESSION_SECRET` and `DATABASE_URL`. All other secrets enable optional features.

---

## API Reference

All backend routes are prefixed with `/litigaforge`. Interactive docs: `/litigaforge/docs`

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Create account; returns token + sets cookie |
| `POST` | `/auth/login` | None | Login; returns token + sets cookie |
| `POST` | `/auth/refresh` | Cookie | Exchange refresh token for new access token |
| `GET` | `/auth/me` | Cookie / Bearer | Current user info |
| `POST` | `/auth/logout` | Cookie / Bearer | Clear cookies |

### Subscription

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/subscription/plans` | None | List all plans |
| `POST` | `/subscription/create-order` | Bearer | Create Razorpay order |
| `POST` | `/subscription/verify` | Bearer | Verify payment; activate tier |

### eCourtsIndia Live Case Intelligence

See [eCourtsIndia section above](#ecourtsindia-live-case-intelligence) for full table.

### Matching

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/cases/requirements` | Bearer | Post a case requirement |
| `GET` | `/cases/requirements` | None | Browse open requirements |
| `GET` | `/cases/requirements/mine` | Bearer | Client's own requirements |
| `POST` | `/match/find-lawyers` | Bearer | AI match: top 10 scored lawyers |
| `GET` | `/matches/client` | Bearer | Client's match proposals |
| `GET` | `/matches/lawyer` | Bearer | Lawyer's match proposals |
| `POST` | `/matches/{id}/accept` | Bearer | Accept a match |
| `POST` | `/matches/{id}/decline` | Bearer | Decline a match |

### Lawyer Dashboard

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/lawyer/cases` | Bearer | Create case |
| `GET` | `/lawyer/cases` | Bearer | List cases (`?status=`) |
| `PATCH` | `/lawyer/cases/{id}` | Bearer | Edit case |
| `DELETE` | `/lawyer/cases/{id}` | Bearer | Delete case |
| `POST` | `/lawyer/documents` | Bearer | Upload document |
| `POST` | `/lawyer/documents/{id}/analyze` | Bearer | AI analyze document |
| `GET` | `/lawyer/stats` | Bearer | Active/pending/closed + document counts |

### Client Dashboard

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/client/cases` | Bearer | All assigned cases |
| `GET` | `/client/cases/{id}` | Bearer | Single case + documents |
| `PATCH` | `/client/cases/{id}` | Bearer | Edit description / hearing date |
| `POST` | `/client/cases/{id}/documents` | Bearer | Upload document |
| `GET` | `/client/documents` | Bearer | All documents across all cases |
| `DELETE` | `/client/documents/{id}` | Bearer | Delete document |

### Community Services

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/ask` | None | Ask legal question — AI answers |
| `GET` | `/ask` | None | Browse past Q&As |
| `POST` | `/document/analyze` | None | Document risk score + clause analysis |
| `POST` | `/judgments/search` | None | Search case law — 5 precedents |
| `GET` | `/lawyers` | None | Search advocate directory |
| `POST` | `/lawyers/register` | Bearer | Register as advocate |
| `GET` | `/legal-aid/contacts` | None | NALSA + all 8 TSLSA DLSA contacts |
| `POST` | `/contact` | None | Submit Contact Us message |

### AI Legal Chat

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/ai-legal-chat` | Bearer | AI drafting chat |
| `GET` | `/chat/threads` | Bearer | List threads |
| `POST` | `/chat/threads` | Bearer | Create thread |
| `GET` | `/chat/messages/{id}` | Bearer | Get messages |
| `POST` | `/chat/messages/{id}` | Bearer | Send message |

### Health & LLM

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthz` | Service health |
| `GET` | `/llm/health` | LLM provider status (`?probe=true` for live test) |

---

## Run Locally (Replit)

Two workflows start automatically:

| Workflow | Command |
|---|---|
| `LitigaForge AI` | `cd artifacts/litigaforge-ai && PORT=5000 python main.py` |
| `litigaforge-ui: web` | `pnpm --filter @workspace/litigaforge-ui run dev` |

`BASE_PATH`, `PORT`, and `DATABASE_URL` are set as shared Replit env vars — all workflows inherit them automatically. Do **not** inline them in workflow commands.

Open the Replit preview — you'll be redirected to `/login`. Register a free account to get started.

---

## Deploy on Your Own Server

```bash
git clone https://github.com/arif806-cyber/litigaforge-ai.git
cd litigaforge-ai/deployable
cp .env.example .env
# Set SESSION_SECRET and DATABASE_URL at minimum
docker compose up -d --build
```

```bash
docker compose logs -f          # live logs
docker compose down             # stop
docker compose up -d --build    # rebuild after changes
```

---

## Deploy on Replit

1. Open the project in Replit
2. Click **Publish** → **Autoscale**
3. Choose a region in Advanced settings (cannot change after publish)
4. Click **Publish** — Replit handles TLS, health checks, and PostgreSQL promotion

Your app is live at a `*.replit.app` URL within minutes.

---

## Mobile App

```bash
cd deployable/mobile
cp .env.example .env
# Set EXPO_PUBLIC_API_URL=https://YOUR_DOMAIN.replit.app
npm install
npx expo start   # Scan QR with Expo Go
```

**Production builds (EAS):**

```bash
npm install -g eas-cli
eas build --platform android --profile production  # → .aab
eas build --platform ios --profile production      # → .ipa
eas submit --platform android
eas submit --platform ios
```

Requires Apple Developer ($99/yr) + Google Play Developer ($25 one-time) accounts.

---

## Architecture

```
Browser / Mobile App
        │
        ▼
  Replit Shared Proxy (port 80)
  ├── /              ──▶  Node.js api-server (port 8080)
  │                        serves React dist/ with per-route meta injection
  └── /litigaforge   ──▶  FastAPI + Uvicorn (port 5000)
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
          PostgreSQL      Auth Layer    Multi-AI Cascade
         + pgvector       bcrypt/JWT    Claude → Gemini → GPT-5
               │                            │
               │                       LiteLLM Layer
               │                     (env-switchable)
               │
        ┌──────┴──────────────────────────┐
        ▼                                 ▼
  eCourtsIndia API              Forge Workspace
  (dual-key rotation)           (5-agent SSE + canvas)
        │
  Nightly Diff Worker
  ├── case_snapshots
  ├── case_events
  ├── NIM embeddings (pgvector)
  ├── email notifications
  └── predictive timeline
```

**AI Safety Layer:**
```
Input → sanitizer.py (injection detection)
      → ai_safety.py (unoverridable system prompt)
      → AI Provider
      → ai_safety.py (output validation + "not legal advice" disclaimer)
      → Response
```

---

*Built for Telangana & Andhra Pradesh. Powered by FastAPI, React 19, Claude Sonnet 4-6, Gemini 2.5 Flash, pgvector, and eCourtsIndia Live API.*
