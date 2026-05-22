# LitigaForge AI

**Self-Evolving Legal Intelligence for Telangana & Andhra Pradesh Advocates**

LitigaForge AI is a full-stack legal platform that takes a plain-language description of a case, automatically extracts legal entities (PAN, GSTIN, vehicle numbers, party names, DL numbers), runs them through 16 Indian government API chains, and synthesises a Supreme Court-grade legal strategy — all in seconds. Powered by a multi-AI cascade (Claude Sonnet + Gemini 2.5 Flash + GPT-5) with user accounts, subscription tiers, and case memory.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Repo Structure](#repo-structure)
- [Authentication & Subscriptions](#authentication--subscriptions)
- [Environment Variables](#environment-variables)
- [API Chain Status](#api-chain-status)
- [Run Locally (Replit)](#run-locally-replit)
- [Deploy on Your Own Server](#deploy-on-your-own-server-one-command)
- [Deploy on Replit](#deploy-on-replit-one-click)
- [Custom Domain](#custom-domain)
- [Mobile App](#mobile-app--play-store--app-store)
- [Architecture](#architecture)
- [API Reference](#api-reference)

---

## Features

- **The Forge** — paste case facts, get a full legal strategy with entity extraction, chain orchestration, and multi-AI synthesis
- **Legal Q&A with AI** — ask any legal question, Claude/Gemini answers instantly with applicable Indian law, Telangana/AP procedure, and next steps. Community knowledge base of past Q&As
- **Document Analyzer** — paste contract/FIR/sale deed/petition text; AI identifies legal risks, missing clauses, jurisdiction issues, and recommends amendments. Risk score 1–10
- **Judgment Finder** — search Indian case law by keyword/court; AI finds 5 relevant precedents with real citations and plain-language summaries. Direct links to IndianKanoon
- **Lawyer Directory** — searchable directory of Telangana & AP advocates. Filter by district, practice area, language. Verified advocate profiles with contact details. Self-registration for advocates
- **Free Legal Aid Finder** — NALSA/TSLSA eligibility wizard (income + category check). Instant DLSA contact info for all 8 Telangana districts + helplines (15100, 181, 1098)
- **16 Government API Chains** — GSTIN, PAN, eCourts, VAHAN, SARATHI, DigiLocker, BPCL LPG, MeriPehchaan, Mee Seva Telangana, Transport TS, NSE India, Stock Exchange, FOREX, MCA Company, IFSC, and Pincode
- **Multi-AI Cascade** — Claude Sonnet 4-6 (strategy) → Gemini 2.5 Flash (entities) → GPT-5 (fallback) — all free via Replit AI Integrations
- **User Accounts** — register / login with bcrypt-hashed passwords and 30-day JWT sessions
- **Subscription Tiers** — Free (5 cases/month), Professional ₹999/mo (50 cases, Gemini AI), Advocate Pro ₹2,499/mo (unlimited, full Multi-AI)
- **PostgreSQL Database** — persistent user accounts, subscription history, monthly usage tracking, legal questions, and advocate profiles
- **Use Cases** — 7 interactive scenario cards (Property, MACT, GST Fraud, Criminal, Mee Seva, Watch Mode, NPA/DRT)
- **Case Memory** — every forged case is stored and searchable; AI learns patterns over time
- **Watch Mode** — background scheduler monitors cases and parties for court date changes
- **WhatsApp Alerts** — hearing reminders and forge results via Twilio WhatsApp
- **Sandbox Mode** — Mee Seva TG and Transport TS make live calls to `sandbox.api-setu.in` using the public demo key
- **Light / White UI** — clean white backgrounds, amber/gold accent, particle canvas, Framer Motion animations, fully mobile-responsive

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query, wouter |
| Backend | Python 3.12, FastAPI, Uvicorn, LangGraph, LangChain |
| AI | Gemini 2.5 Flash + Claude Sonnet 4-6 + GPT-5 — all free via Replit AI Integrations |
| Database | PostgreSQL (Replit managed) — users, subscriptions, case memory |
| Auth | bcrypt password hashing, JWT (python-jose), 30-day tokens |
| Mobile | Expo (React Native), Expo Router, NativeWind |
| Legal Q&A | Claude Sonnet 4-6 / Gemini 2.5 Flash — instant answers with cited law |
| Doc Analyzer | AI risk scoring, clause extraction, Indian jurisdiction analysis |
| Judgments | AI precedent search + IndianKanoon direct links |
| Lawyer Directory | PostgreSQL + full-text search, verified profiles |
| Free Legal Aid | Eligibility wizard + static TSLSA/NALSA contact data |
| Fonts | Space Grotesk, JetBrains Mono |

---

## Repo Structure

```
litigaforge-ai/
├── artifacts/
│   ├── litigaforge-ui/              # React + Vite web frontend
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── login.tsx        # Sign-in page
│   │       │   ├── register.tsx     # Registration page
│   │       │   ├── subscription.tsx # Plan comparison & upgrade
│   │       │   ├── forge.tsx        # The Forge — main tool
│   │       │   ├── cases.tsx        # Case browser
│   │       │   ├── chains.tsx       # API chain status
│   │       │   ├── case-detail.tsx  # Single case view
│   │       │   ├── use-cases.tsx    # Scenario cards
│   │       │   ├── ask.tsx          # Legal Q&A — ask questions, AI answers, community Q&A
│   │       │   ├── review.tsx       # Document Analyzer — risk scoring, clause analysis
│   │       │   ├── judgments.tsx    # Judgment Finder — precedent search + IndianKanoon links
│   │       │   ├── lawyers.tsx      # Lawyer Directory — advocate profiles + registration
│   │       │   └── legal-aid.tsx    # Free Legal Aid — eligibility wizard + helplines
│   │       ├── components/
│   │       │   ├── layout.tsx       # Sidebar, topbar, mobile nav, user panel
│   │       │   └── graphics/        # ParticleCanvas, ScalesHero, ChainDiagram, EmptyStateArt
│   │       └── lib/
│   │           ├── api.ts           # apiFetch (auto-attaches Bearer token)
│   │           ├── auth-context.tsx # AuthProvider, useAuth hook
│   │           └── utils.ts
│   │
│   └── litigaforge-ai/              # Python FastAPI backend
│       ├── main.py                  # All routes (auth, forge, cases, chains, watch, alerts)
│       ├── extra_routes.py          # Legal Q&A, Doc Analyzer, Judgments, Lawyers, Legal Aid
│       ├── database.py              # PostgreSQL CRUD (psycopg2)
│       ├── auth.py                  # bcrypt hashing, JWT create/decode, FastAPI deps
│       ├── litigaforge_engine.py    # Forge orchestration
│       ├── ai_brain.py              # Multi-AI cascade (Gemini → Claude → GPT-5)
│       ├── requirements.txt
│       ├── api_chains/              # 16 government API chain modules
│       │   ├── gstin.py             # GST Network
│       │   ├── pan.py               # PAN verification
│       │   ├── ecourts.py           # eCourts case lookup
│       │   ├── vahan.py             # Vehicle registration
│       │   ├── sarathi.py           # Driving licence
│       │   ├── digilocker.py        # DigiLocker documents
│       │   ├── bpcl_lpg.py          # BPCL LPG subsidy (API Setu)
│       │   ├── meripehchaan.py      # DigiLocker OAuth2 SSO
│       │   ├── mee_seva_tg.py       # Mee Seva Telangana — LIVE SANDBOX
│       │   ├── transport_ts.py      # Telangana Transport — LIVE SANDBOX
│       │   ├── nse_india.py         # NSE live stock quotes — FREE, no key
│       │   ├── stock_exchange.py    # NSE/BSE financials — RapidAPI
│       │   ├── forex.py             # INR forex rates — ECB free
│       │   ├── mca_company.py       # MCA21 company search
│       │   ├── ifsc.py              # IFSC bank lookup — RBI/Razorpay free
│       │   └── pincode.py           # India Post pincode — free
│       ├── alerts/                  # whatsapp.py — Twilio integration
│       ├── watch_mode/              # Background case watcher scheduler
│       └── forge_memory/            # Case storage & pattern learning
│
└── deployable/                      # Self-contained Docker + mobile package
    ├── README.md
    ├── .env.example
    ├── docker-compose.yml
    ├── web/
    │   ├── backend/                 # Backend Dockerfile
    │   └── frontend/                # Frontend Dockerfile + nginx.conf
    └── mobile/                      # Full Expo React Native app
        ├── app.json
        ├── eas.json
        └── app/
            ├── _layout.tsx
            ├── index.tsx            # Forge screen
            ├── cases.tsx
            ├── chains.tsx
            └── case/[id].tsx
```

---

## Authentication & Subscriptions

### How auth works

- **Register** at `/register` — name, email, password (min 8 chars). Account created in PostgreSQL, returns a 30-day JWT.
- **Login** at `/login` — email + password. Verifies bcrypt hash, returns JWT.
- JWT is stored in `localStorage` (`lf_token`) and automatically attached to every API request.
- All main pages are protected — unauthenticated users are redirected to `/login`.
- The sidebar shows the logged-in user's name, email, tier badge, monthly usage bar, and Sign Out button.

### Subscription tiers

| Tier | Price | Cases / Month | AI Engine |
|---|---|---|---|
| **Free** | ₹0 | 5 | Smart Fallback templates |
| **Professional** | ₹999 / month | 50 | Gemini 2.5 Flash |
| **Advocate Pro** | ₹2,499 / month | Unlimited | Claude Sonnet + Gemini + GPT-5 |

- Monthly counter resets automatically on the first of each month.
- Hitting the limit returns an error asking you to upgrade.
- Upgrade / downgrade is instant via `POST /litigaforge/subscription/upgrade`.

### Database schema

```sql
CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  email             TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  password_hash     TEXT NOT NULL,               -- bcrypt
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  cases_this_month  INTEGER NOT NULL DEFAULT 0,
  month_reset_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier        TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'active',
  payment_ref TEXT
);
```

---

## Environment Variables

Set these in Replit Secrets / shared env vars, or in `.env` for Docker.

### Core

| Variable | Default | Description |
|---|---|---|
| `BASE_PATH` | `/litigaforge` | URL prefix the backend mounts all routes on |
| `PORT` | `5000` | Uvicorn listen port |
| `DATABASE_URL` | (Replit auto-set) | PostgreSQL connection string — set automatically when Replit DB is provisioned |
| `SESSION_SECRET` | (Replit Secret) | JWT signing key — set as a Replit Secret |

### AI (all free via Replit AI Integrations — no keys needed)

| Variable | Set by | Description |
|---|---|---|
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Replit | Gemini 2.5 Flash proxy — entity extraction |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Replit | Claude Sonnet 4-6 proxy — legal strategy synthesis |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit | GPT-5 proxy — fallback AI |

> These are injected automatically by Replit. No API keys are needed for any AI provider.

### API Setu (Government APIs)

| Variable | Default | Description |
|---|---|---|
| `API_SETU_KEY` | `demokey123456ABCD789` | Public sandbox key — already set |
| `API_SETU_CLIENT_ID` | `in.gov.sandbox` | Public sandbox client ID — already set |
| `MEESEVA_USE_PROD` | `false` | Set `true` to switch to `apisetu.gov.in` production |

### Optional API Keys

| Variable | Required | Enables |
|---|---|---|
| `RAPIDAPI_KEY` | No | Vehicle RC (VAHAN), live GSTIN, Stock Exchange (RapidAPI) |
| `MERIPEHCHAAN_CLIENT_ID` | No | Live DigiLocker OAuth2 SSO |
| `MERIPEHCHAAN_CLIENT_SECRET` | No | Live DigiLocker OAuth2 SSO |
| `ECOURTS_API_KEY` | No | Live eCourts case lookup |
| `OPENCORPORATES_API_KEY` | No | MCA company search via OpenCorporates |

### WhatsApp Alerts (Twilio)

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Sender: `whatsapp:+14155238886` (sandbox) |
| `ADVOCATE_WHATSAPP` | Recipient: `whatsapp:+91XXXXXXXXXX` |

> Without any optional keys, all chains return realistic mock data. The app is fully functional with zero secrets except `SESSION_SECRET`.

---

## API Chain Status

| Chain | Data Source | Status |
|---|---|---|
| **NSE India** | NSE public API | Live — free, no key |
| **FOREX** | ECB / Frankfurter | Live — free, no key |
| **IFSC** | RBI via Razorpay | Live — free, no key |
| **Pincode** | India Post | Live — free, no key |
| **Mee Seva TG** | `sandbox.api-setu.in` | Live sandbox — demo key set |
| **Transport TS** | `sandbox.api-setu.in` | Live sandbox — demo key set |
| BPCL LPG | API Setu | Sandbox-ready |
| MeriPehchaan | meripehchaan.gov.in | Mock — needs OAuth credentials |
| GSTIN | GSTN | Mock |
| PAN | Income Tax / NSDL | Mock |
| eCourts | **Live** — `webapi.ecourtsindia.com` | Partner API (Bearer token). CNR lookup, case search, hearing history, orders
| VAHAN | Parivahan | Mock |
| SARATHI | Parivahan | Mock |
| DigiLocker | NIC | Mock |
| Stock Exchange | RapidAPI | Mock — needs `RAPIDAPI_KEY` |
| MCA Company | MCA21 / OpenCorporates | Mock |

To go fully live on API Setu chains, register at [api.setu.in](https://api.setu.in), get approved credentials, replace `API_SETU_KEY`, and set `MEESEVA_USE_PROD=true`.

---

## Run Locally (Replit)

Two workflows start automatically:

| Workflow | Command |
|---|---|
| `LitigaForge AI` | `cd artifacts/litigaforge-ai && PORT=5000 python main.py` |
| `artifacts/litigaforge-ui: web` | `pnpm --filter @workspace/litigaforge-ui run dev` |

`BASE_PATH`, `PORT`, and `DATABASE_URL` are set as shared environment variables — all workflows pick them up automatically.

Open the Replit preview pane. You will be redirected to `/login` — register a free account to start forging cases.

---

## Deploy on Your Own Server (One Command)

### Requirements

- Linux server (Ubuntu 22.04+ recommended)
- Docker + Docker Compose installed

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/arif806-cyber/litigaforge-ai.git
cd litigaforge-ai/deployable

# 2. Configure environment
cp .env.example .env
nano .env   # Set SESSION_SECRET and DATABASE_URL at minimum

# 3. Launch
docker compose up -d --build
```

Open `http://YOUR_SERVER_IP` in your browser. Register an account and start using the Forge.

```bash
docker compose logs -f          # live logs
docker compose down             # stop everything
docker compose up -d --build    # rebuild after code changes
```

---

## Deploy on Replit (One Click)

1. Open the project in Replit
2. Click **Publish** (top right)
3. Choose **Autoscale** deployment
4. Select your preferred **region** in Advanced settings (cannot change later)
5. Click **Publish** — Replit handles building, HTTPS, and health checks

Your app will be live at a `*.replit.app` URL within minutes. The PostgreSQL database is automatically promoted to production.

---

## Custom Domain

After publishing:

1. Go to **Published → Custom Domain**
2. Enter your domain (e.g. `litigaforge.in`)
3. Add the CNAME record shown at your registrar
4. HTTPS is handled automatically

> Custom domains require a Replit **Core** plan or above.

---

## Mobile App — Play Store & App Store

The Expo React Native app has all screens — Forge, Cases, Chains, Case Detail — with login/auth support.

```bash
cd deployable/mobile
cp .env.example .env
# Set EXPO_PUBLIC_API_URL=https://YOUR_DOMAIN.replit.app

npm install
npx expo start   # Scan QR with Expo Go app
```

### Production builds (EAS)

```bash
npm install -g eas-cli
eas init                                          # creates project ID
eas build --platform android --profile production # → .aab for Play Store
eas build --platform ios --profile production     # → .ipa for App Store
eas submit --platform android
eas submit --platform ios
```

Requires an Apple Developer account ($99/year) for iOS and a Google Play Developer account ($25 one-time) for Android.

---

## WhatsApp Alerts (Twilio)

### Sandbox setup (free, 5 minutes)

1. Create a free [Twilio account](https://www.twilio.com/try-twilio)
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. Follow the join instructions (send a WhatsApp to the Twilio sandbox number)
4. Add to Replit Secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (`whatsapp:+14155238886`), `ADVOCATE_WHATSAPP`

### Production WhatsApp Business API

Requires Meta approval (1–3 business days). Apply at [business.whatsapp.com](https://business.whatsapp.com), get a dedicated number from Twilio, replace `TWILIO_FROM_NUMBER`.

---

## Architecture

```
Browser / Mobile App
        │
        ▼
  Reverse Proxy (port 80)
  ├── /             ──▶  React frontend (Vite dev / Nginx static)
  └── /litigaforge  ──▶  FastAPI backend (Uvicorn, port 5000)
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
          PostgreSQL     Auth Layer      Forge Engine
         (users, subs)   (bcrypt/JWT)   (LangGraph)
                                            │
                              ┌─────────────┴─────────────┐
                              ▼                           ▼
                       Gemini 2.5 Flash           Claude Sonnet 4-6
                       (entity extraction)        (legal strategy)
                              │                           │
                              └──────────┬────────────────┘
                                         ▼
                                     GPT-5 mini
                                     (fallback)
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                        16 API Chains          Forge Memory
                    (4 live, 12 sandbox/mock)  (pattern learning)
                              │
                        WhatsApp Alerts
                           (Twilio)
```

---

## API Reference

All backend routes are prefixed with `/litigaforge`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/litigaforge/auth/register` | None | Create account — returns JWT + user |
| `POST` | `/litigaforge/auth/login` | None | Login — returns JWT + user |
| `GET` | `/litigaforge/auth/me` | Bearer | Current user info |

### Subscription

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/litigaforge/subscription/plans` | None | List all plans with features and pricing |
| `POST` | `/litigaforge/subscription/upgrade` | Bearer | Switch to a new tier |

### Forge & Cases

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/litigaforge/forge` | Optional Bearer | Forge a legal strategy. Enforces monthly limits when authenticated. |
| `GET` | `/litigaforge/cases` | None | List recent forged cases |
| `GET` | `/litigaforge/cases/{id}` | None | Get a specific case by ID |
| `GET` | `/litigaforge/chains` | None | List all 16 API chains with status |
| `GET` | `/litigaforge/memory/patterns` | None | Learned forge patterns |
| `GET` | `/litigaforge/memory/stats` | None | Case and pattern counts |

### Community Services

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/litigaforge/ask` | None | Ask a legal question — AI answers instantly |
| `GET` | `/litigaforge/ask` | None | Browse past Q&As (optional `?category=` filter) |
| `POST` | `/litigaforge/document/analyze` | None | Analyze document text — risk score, missing clauses, recommendations |
| `POST` | `/litigaforge/judgments/search` | None | Search case law — AI returns 5 precedents with IndianKanoon links |
| `GET` | `/litigaforge/lawyers` | None | Search advocate directory (district, area, language, text) |
| `POST` | `/litigaforge/lawyers/register` | Bearer | Register as an advocate (login required) |
| `GET` | `/litigaforge/legal-aid/contacts` | None | NALSA helpline + all 8 TSLSA DLSA contacts |

### Watch Mode

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/litigaforge/watch` | Add a case to Watch Mode |
| `GET` | `/litigaforge/watch` | List active watches |
| `DELETE` | `/litigaforge/watch/{id}` | Remove a watch |
| `POST` | `/litigaforge/watch/start` | Start background scheduler |
| `POST` | `/litigaforge/watch/stop` | Stop background scheduler |

### Alerts

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/litigaforge/alert` | Send a WhatsApp alert |
| `POST` | `/litigaforge/alert/hearing` | Send a hearing date reminder |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/litigaforge/healthz` | Returns AI mode and active provider list |
| `GET` | `/litigaforge/sandbox/ping` | Connectivity check for API Setu endpoints |

Interactive Swagger UI: `/litigaforge/docs`

---

## Forge Request Example

```bash
# Register first
curl -X POST https://YOUR_DOMAIN/litigaforge/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Adv. Ramesh Kumar","email":"ramesh@example.com","password":"advocate123"}'

# Use the returned token
TOKEN="eyJ..."

curl -X POST https://YOUR_DOMAIN/litigaforge/forge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "prompt": "My client with PAN ABCDE1234F and GSTIN 36ABCDE1234F1Z5 has a property dispute in Hyderabad. Vehicle TS09EA1234 involved.",
    "notify_whatsapp": false
  }'
```

### Response shape

```json
{
  "status": "success",
  "case_id": "CASE-XXXX-YYYY",
  "chains_executed": ["GSTIN", "PAN", "VAHAN", "IFSC", "NSE_INDIA"],
  "entities_found": {
    "pan": ["ABCDE1234F"],
    "gstin": ["36ABCDE1234F1Z5"],
    "vehicle_numbers": ["TS09EA1234"]
  },
  "api_results": {
    "GSTIN": { "status": "success", "data": { ... } },
    "IFSC": { "status": "success", "data": { "BANK": "STATE BANK OF INDIA", ... } },
    "NSE_INDIA": { "status": "success", "data": { "lastPrice": 245.60, ... } }
  },
  "final_output": "Full Supreme Court-grade legal strategy..."
}
```

---

## Forge Prompt Tips

- Include full party names (e.g. "Ramesh Kumar s/o Suresh Kumar")
- Include every identifier you have: PAN, GSTIN, vehicle number, DL number, IFSC, pincode
- Mention the court ("pending before District Court, Rangareddy")
- Mention the nature of the dispute ("property mutation", "MACT claim", "cheque bounce", "GST fraud")

The entity extractor picks all of these up automatically and selects the right chains to run.

---

*Built for Telangana & Andhra Pradesh advocates. Powered by FastAPI, React, Claude Sonnet, Gemini 2.5 Flash, and 16 Indian government APIs.*
