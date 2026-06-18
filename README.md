# LitigaForge AI

**Client-Lawyer Matching Platform + Legal Intelligence for Telangana & Andhra Pradesh**

LitigaForge AI is a full-stack legal platform that connects clients with verified lawyers through AI-powered matching, while also providing a complete legal toolkit: entity extraction from case facts, 16 Indian government API chains, and multi-AI legal strategy synthesis. Clients post case requirements, get matched with the best advocates based on practice area, location, and experience, then chat and collaborate — all in one platform. Powered by a multi-AI cascade (Claude Sonnet + Gemini 2.5 Flash + GPT-5) with user accounts, subscription tiers, and case memory.

---

## Recent Changes — June 2026

| Date | Change |
|---|---|
| Jun 17 | **Forge Workspace — shareable & complete** — Personal Legal Twin (🧬 self-learning advocate profile personalises all 5 AI agents from your case history; cross-matter connection analysis); auth `returnTo` redirect (visiting `/workspace` while logged out saves the destination, login/Google/Apple/passkey all redirect back instead of to the dashboard); user avatar + Sign Out in workspace toolbar; no-session welcome screen with **Create Your First Workspace** vs **⚖️ Try Demo: Family Pension Matter** (9-node pre-built canvas: 2 facts, 1 issue, 2 arguments, 1 risk, 1 strategy, 2 Supreme Court judgments — D.S. Nakara 1983 + Jitendra Kumar Srivastava 2013); multilingual demo button (EN / Telugu / Hindi); demo matter persisted to PostgreSQL on creation |

## Recent Changes — May 2026

| Date | Change |
|---|---|
| May 28 | **Legal Guides / Blog** — 5 long-form SEO articles at `/blog` targeting high-intent legal keywords (how to find a lawyer in Hyderabad, free legal aid NALSA guide, consumer forum eDaakhil, RERA AP, eCourts case status). Each article has breadcrumb, legal disclaimer banner, JSON-LD BlogPosting schema, category badges, keyword tags, and a dual CTA (post case / ask AI). "Legal Guides" added to sidebar nav and footer |
| May 28 | **SEO pass** — per-page `<SEOHelmet>` with title, description, canonical, keywords, and JSON-LD structured data on every public page. `sitemap.xml` now includes all 20+ pages including all blog article slugs. Node.js injects correct Open Graph meta tags at request time (no stale CDN cache) |
| May 28 | **Node.js meta injection** — `api-server` reads `dist/public/index.html` at startup, injects per-route title + description + OG tags, serves the SPA for all non-API paths. Express 5 wildcard fixed (`*` → `/{*splat}`). Frontend built with `BASE_PATH=/` for correct asset resolution via Node.js |
| May 28 | **Consistent mobile tab bar** — all authenticated pages (client-dashboard, lawyer-dashboard, and all Layout pages) now show the same 6-item bottom tab bar. client-dashboard moved inside shared `<Layout>` |
| May 28 | **Shared PageHeader component** — standardized mobile top-bar (logo + role badge + dark-mode toggle + hamburger) across all pages via `src/components/PageHeader.tsx` |
| May 28 | **client-dashboard layout polish** — stat cards now 2×2 grid on mobile, quick-action buttons restyled to match app card system (rounded-2xl border bg-card shadow-sm), consistent px-4 padding |
| May 27 | **Advocate verification notifications** — admin approve/reject triggers email (SMTP) + WhatsApp (Twilio) automatically. Lawyer dashboard polls and shows a verification wall until approved |
| May 27 | **UI/UX Audit** — all 16 pages: skeleton loading states, retry buttons, empty states with illustrations, autoFocus + Enter key submission on AI inputs, 44px min touch targets on mobile |
| May 27 | **Shared UI components** — `SkeletonCard`, `CopyButton`, `RetryButton`, `TrustBadge`, `StructuredResult` added to `src/components/` for consistent AI result display |
| May 26 | **Free Legal Documents** — 10 AI-generated document templates at `/free-documents` with fill-in form, AI draft, download/copy/share/print |
| May 26 | **New navigation routes** — `/cases`, `/use-cases`, `/free-documents`, `/free-documents/:slug`, `/document-template/:slug` all added to sidebar and routing |

---

## Table of Contents

- [Forge Workspace](#forge-workspace)
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

## Forge Workspace

**Forge Workspace** (`/workspace`) is LitigaForge AI's advanced legal strategy environment — a spatial canvas where lawyers and law students can build argument maps, run multi-agent AI analysis, simulate what-if scenarios, and search 50M+ Indian judgments, all in one place.

### Key capabilities

| Feature | How to use |
|---|---|
| **Spatial Canvas** | Drag to pan, scroll to zoom. Right-click any node to edit or delete. Connect nodes by dragging from a handle to build argument chains. Six node types: Fact, Issue, Argument, Risk, Strategy, Judgment. |
| **5-Agent AI Analysis** | Click **⚡ Analyze** to run five specialist AI agents in parallel: Litigator, Researcher, Risk Analyst, Drafter, and Strategist. Each streams its reasoning live. Thumb up/down to teach your Personal Twin. |
| **Personal Legal Twin** | Opens in the **Twin** tab. Self-learning advocate profile built from your session history — which agents you trust, which nodes you add, which suggestions you accept. Personalises all 5 agents over time. |
| **Indian Kanoon Search** | Open the **Search** tab. Type any legal query; matching judgments from 50M+ cases drop directly onto the canvas as connected nodes. |
| **What-If Simulation** | Open the **Simulate** tab. Pick a preset (or type your own scenario), click **Run**. See before/after risk scores, per-node impact deltas, and a streamed AI analysis — without touching your main canvas. |
| **Proactive Insights** | The **Insights** tab auto-refreshes after every analysis and simulation. Accept a suggestion to add it as a canvas node; dismiss to teach the system your preferences. |
| **Collaboration Timeline** | Agent Society panel shows a live feed of agent steps so you can follow the reasoning as it unfolds. |
| **Undo / Redo** | Ctrl+Z / Ctrl+Y (up to 50 steps). Every node add, delete, and connection is captured. |
| **Auto-Save** | Canvas saves to PostgreSQL 2 seconds after each change. Manual save button available in the toolbar. |

### Getting started

1. **Log in** at `/login` (or register a new account).
2. Navigate to **⚡ Workspace** in the sidebar.
3. On first visit: choose **Create Your First Workspace** (blank canvas) or **⚖️ Try Demo** (9-node Family Pension argument map with two pre-loaded Supreme Court judgments).
4. Describe your case in the text area (top of Agent panel), then click **⚡ Analyze**.
5. Open **Search** to pull relevant Indian Kanoon judgments onto the canvas.
6. Open **Simulate** to stress-test your argument map with what-if scenarios.

### Environment requirements for Workspace

All workspace API routes are mounted at `/litigaforge/workspace/*`. The following env vars must be set (already configured in Replit):

| Variable | Value |
|---|---|
| `BASE_PATH` | `/litigaforge` |
| `PORT` | `5000` |
| `DATABASE_URL` | Replit-managed PostgreSQL |
| `SESSION_SECRET` | JWT signing secret |
| `GEMINI_API_KEY` *(optional)* | Falls back to Replit AI proxy if unset |

---

## Features

- **Role-Based Access** — register as Client or Lawyer. Each role gets its own dedicated dashboard with role-specific tools and workflows
- **Lawyer Dashboard** (`/lawyer-dashboard`) — full case management for advocates: create/edit/delete cases, upload and analyze client documents, track case status (active/pending/closed), add CNR numbers, write notes, and view match proposals
- **Client Dashboard** (`/client-dashboard`) — central hub for clients: view assigned cases with case stage timeline (filed → arguments → reserved → judgment), browse AI match proposals with accept/decline, message connected lawyers, quick access to legal tools, NALSA helpline, and upgrade banner
- **Client-Lawyer AI Matching** — clients post case requirements; AI scores and ranks lawyers (0-100) based on practice area overlap, location proximity, experience, and rating. Personalized AI explanations for each match
- **Post a Case** — clients post legal needs with case type, location, budget range, and anonymous option. Lawyer proposals arrive with match scores
- **My Cases** — clients track their posted cases, view match proposals, accept or decline lawyer connections
- **Case Documents Dashboard** (`/documents`) — unified view of all uploaded case documents across every case. Search by filename or case name, download, share to WhatsApp/Instagram via Web Share API, and delete. Upload new documents directly from any case detail page
- **Case Detail — Edit, Share, Download** — inside every case detail modal, clients can edit description and hearing date, share a case summary to any app (WhatsApp fallback), or download a text summary file with all case details
- **Client Case Timeline** — visual 4-stage pipeline (Filed → Arguments → Reserved → Judgment) with progress dots on every case card
- **CNR Tracking** — lawyers can attach Case Number Reference (CNR) numbers to every case for eCourts lookup and government record linkage
- **AI Legal Chat** — interactive chat with Claude/Gemini for legal drafting. Templates: legal notice, agreement, court petition, reply to notice. Full chat history persists
- **The Forge** — paste case facts, get a full legal strategy with entity extraction, chain orchestration, and multi-AI synthesis
- **Forge Workspace** (`/workspace`) — professional AI-powered legal matter workspace for advocates and power users. A spatial canvas (React Flow) where you drag, connect, and annotate legal nodes (facts, arguments, risks, strategies, judgments). Powered by five parallel AI specialist agents (Litigator, Researcher, Risk Analyst, Drafter, Strategist) with live SSE streaming and per-agent thumbs up/down feedback. Seven integrated panels: **Sessions** (save/restore named matters), **Indian Kanoon Search** (add 50M+ judgments directly to canvas), **Proactive Intelligence** (AI-surfaced risks and opportunities), **What-If Simulation** (scenario-test key fact changes before filing), **🧬 Personal Legal Twin** (self-learning profile that personalises agent prompts from your history), and **Keyboard Shortcuts**. Multi-language UI (English / Telugu / Hindi) with per-session persistence in PostgreSQL. First-visit guided tour with 5 interactive steps. Subscription-gated: Professional and Advocate Pro tiers.
- **Legal Q&A with AI** — ask any legal question, Claude/Gemini answers instantly with applicable Indian law, Telangana/AP procedure, and next steps. Community knowledge base of past Q&As
- **Document Analyzer** — paste contract/FIR/sale deed/petition text; AI identifies legal risks, missing clauses, jurisdiction issues, and recommends amendments. Risk score 1–10
- **Judgment Finder** — search Indian case law by keyword/court; AI finds 5 relevant precedents with real citations and plain-language summaries. Direct links to IndianKanoon
- **Lawyer Directory** — searchable directory of Telangana & AP advocates. Filter by district, practice area, language. Verified advocate profiles with contact details, hourly rates, and availability status. Self-registration for advocates
- **Legal Guides / Blog** — 5 long-form SEO articles at `/blog` targeting high-intent search queries: how to find a lawyer in Hyderabad, free legal aid in Telangana (NALSA), filing consumer forum complaints via eDaakhil, RERA rights for AP property buyers, and eCourts case status tracking. Each article has breadcrumb nav, a legal disclaimer banner, JSON-LD `BlogPosting` structured data, keyword tags, reading time, and a "Find a Lawyer / Ask AI" CTA. "Legal Guides" link added to sidebar nav and page footer
- **SEO & Social Sharing** — per-page `<SEOHelmet>` with title, description, canonical URL, Open Graph + Twitter Card meta, and JSON-LD structured data (WebSite, LegalService, BlogPosting). `sitemap.xml` includes all public pages + all article slugs. Node.js API server injects correct meta tags at request time so crawlers and link-preview bots (WhatsApp, Twitter, Telegram) always see page-specific content
- **Free Legal Documents** — 10 AI-generated fill-in legal document templates (rent agreement, legal notice, power of attorney, affidavit, NDA, will, consumer complaint, termination letter, promissory note, commercial lease). Fill the form, AI drafts a complete document via Claude/GPT-5/Gemini cascade, download as .txt, copy, share, or print. No lawyer fees for standard templates
- **16 Government API Chains** — GSTIN, PAN, eCourts, VAHAN, SARATHI, DigiLocker, BPCL LPG, MeriPehchaan, Mee Seva Telangana, Transport TS, NSE India, Stock Exchange, FOREX, MCA Company, IFSC, and Pincode
- **Multi-AI Cascade** — Claude Sonnet 4-6 (strategy) → Gemini 2.5 Flash (entities) → GPT-5 (fallback) — all free via Replit AI Integrations
- **User Accounts** — register / login with bcrypt-hashed passwords and 30-day JWT sessions
- **Subscription Tiers** — Free (5 cases/month), Professional ₹999/mo (50 cases, Gemini AI), Advocate Pro ₹2,499/mo (unlimited, full Multi-AI)
- **PostgreSQL Database** — persistent user accounts, subscription history, monthly usage tracking, legal questions, advocate profiles, case requirements, lawyer matches, and chat threads
- **Use Cases** — 7 interactive scenario cards (Property, MACT, GST Fraud, Criminal, Mee Seva, Watch Mode, NPA/DRT)
- **Case Memory** — every forged case is stored and searchable; AI learns patterns over time
- **Watch Mode** — background scheduler monitors cases and parties for court date changes
- **WhatsApp Alerts** — hearing reminders and forge results via Twilio WhatsApp
- **Sandbox Mode** — Mee Seva TG and Transport TS make live calls to `sandbox.api-setu.in` using the public demo key
- **Unified Design System** — both Client and Advocate roles share the same sidebar design via CSS design tokens (`bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-primary`, etc.) with a subtle role badge (CLIENT / LAWYER) instead of full color change. All non-dashboard pages use a `PageShell` wrapper for consistent title, subtitle, icon, and action-slot headers
- **Light / White UI** — clean white backgrounds, amber/gold accent, particle canvas, Framer Motion animations, fully mobile-responsive
- **Mobile-First Navigation** — hamburger drawer with animated slide-in sidebar on mobile. Shared `PageHeader` component (logo + role badge + dark-mode toggle + hamburger) on every page. Fixed 6-item bottom tab bar (Dashboard · Post a Case · My Cases · Match Proposals · Documents · More) on **all** authenticated pages including the standalone dashboards
- **AI Safety Guardrails** — prompt injection detection (15 attack patterns), input sanitization on every route, Pydantic v2 field validators, unoverridable legal system prompt wrapper, automatic "not legal advice" disclaimer on every AI response, AI output validation against jailbreak red flags
- **Platform Disclaimer** — mandatory first-visit acknowledgment and persistent footer: "This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice."

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query, wouter |
| Backend | Python 3.12, FastAPI, Uvicorn, asyncpg, LangGraph, LangChain, slowapi (rate limiting), razorpay |
| AI | Gemini 2.5 Flash + Claude Sonnet 4-6 + GPT-5 — all free via Replit AI Integrations |
| AI Safety | `sanitizer.py` (injection detection), `ai_safety.py` (system prompt wrapper + disclaimer + output validation), `models.py` (Pydantic v2 field validators) |
| Database | PostgreSQL (Replit managed) — users, subscriptions, case memory |
| Auth | bcrypt password hashing, JWT (python-jose), 30-day tokens, httpOnly cookies + Bearer fallback |
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
│   │       │   ├── workspace.tsx      # Forge Workspace — spatial AI canvas, 5-agent SSE, sessions, What-If, Personal Twin
│   │       │   ├── login.tsx          # Sign-in page
│   │       │   ├── register.tsx       # Registration page
│   │       │   ├── subscription.tsx   # Plan comparison & upgrade
│   │       │   ├── forge.tsx          # The Forge — main tool
│   │       │   ├── cases.tsx          # Case browser
│   │       │   ├── chains.tsx         # API chain status
│   │       │   ├── case-detail.tsx    # Single case view
│   │       │   ├── use-cases.tsx      # Scenario cards
│   │       │   ├── post-case.tsx      # Post a Case — client case requirements form
│   │       │   ├── my-cases.tsx       # My Cases — client case tracking & proposals
│   │       │   ├── matches.tsx        # AI Matching — lawyer match scores & accept/decline
│   │       │   ├── legal-chat.tsx     # AI Legal Chat — drafting assistant with templates
│   │       │   ├── ask.tsx            # Legal Q&A — ask questions, AI answers, community Q&A
│   │       │   ├── review.tsx         # Document Analyzer — risk scoring, clause analysis
│   │       │   ├── judgments.tsx      # Judgment Finder — precedent search + IndianKanoon links
│   │       │   ├── lawyers.tsx        # Lawyer Directory — advocate profiles + registration
│   │       │   ├── legal-aid.tsx      # Free Legal Aid — eligibility wizard + helplines
│   │       │   ├── free-documents.tsx   # Free Legal Documents — 10 AI-powered document template cards
│   │       │   ├── document-template.tsx # Document Template Fill Form — dynamic fields, AI generate, download/share/print
│   │       │   ├── blog.tsx             # Legal Guides listing — 5 SEO articles with category, read time, keyword tags
│   │       │   ├── blog-post.tsx        # Article page — breadcrumb, disclaimer, JSON-LD BlogPosting, CTA
│   │       │   ├── lawyer-dashboard.tsx # Lawyer Dashboard — case management, documents, status tracking
│   │       │   ├── client-dashboard.tsx # Client Dashboard — cases, matches, messages, quick actions
│   │       │   └── admin.tsx          # Admin panel — lawyer verification, user management
│   │       ├── components/
│   │       │   ├── workspace/            # Forge Workspace UI (11 components)
│   │       │   │   ├── AgentPanel.tsx    # 5 AI agent cards with SSE streaming + thumbs feedback
│   │       │   │   ├── ForgeCanvas.tsx   # React Flow canvas — drag, connect, zoom, minimap
│   │       │   │   ├── NodeTypes.tsx     # 6 custom node renderers (fact/issue/argument/risk/strategy/judgment)
│   │       │   │   ├── EdgeTypes.tsx     # Relationship-typed edges (supports/opposes/cites/contradicts/qualifies)
│   │       │   │   ├── SearchPanel.tsx   # Indian Kanoon search → add judgment nodes to canvas
│   │       │   │   ├── SimulationPanel.tsx # What-If simulation (change a key fact, re-run agents)
│   │       │   │   ├── ProactivePanel.tsx  # AI-surfaced risks & opportunities
│   │       │   │   ├── PersonalTwinPanel.tsx # 🧬 Legal Twin — learning profile + cross-matter analysis
│   │       │   │   ├── ForgeWelcome.tsx  # No-session welcome (Create Matter / Try Demo), empty-canvas guide
│   │       │   │   ├── ForgeTour.tsx     # 5-step interactive first-visit tour
│   │       │   │   ├── ForgeToast.tsx    # Dark-theme toast notifications
│   │       │   │   └── WorkspaceLang.tsx # EN / Telugu / Hindi string map + LangToggle component
│   │       │   ├── layout.tsx            # Sidebar, topbar, mobile drawer, 6-item tab bar, user panel
│   │       │   ├── PageHeader.tsx        # Shared mobile top-bar (logo + role badge + theme toggle + hamburger)
│   │       │   ├── legal-disclaimer.tsx  # Footer disclaimer on every page
│   │       │   ├── graphics/             # ParticleCanvas, ScalesHero, ChainDiagram, EmptyStateArt
│   │       │   ├── ui/SkeletonCard.tsx   # Pulse-shimmer skeleton loader (React.memo)
│   │       │   ├── CopyButton.tsx        # Copy-to-clipboard with tick animation (React.memo)
│   │       │   ├── RetryButton.tsx       # Retry CTA for failed API calls (React.memo)
│   │       │   ├── TrustBadge.tsx        # AI / Live API / Fallback / Community source labels (React.memo)
│   │       │   ├── StructuredResult.tsx  # Consistent AI response card with badge + copy + disclaimer
│   │       │   ├── OnboardingModal.tsx   # First-visit walkthrough modal
│   │       │   ├── ErrorBoundary.tsx     # Per-route error isolation
│   │       │   ├── LoadingSpinner.tsx    # Full-screen spinner with message overlay
│   │       │   ├── EmptyState.tsx        # Illustrated empty state with action button
│   │       │   └── ErrorMessage.tsx      # Styled inline error banner with retry CTA
│   │       ├── data/
│   │       │   └── articles.ts          # 5 long-form SEO articles (ContentBlock[] structure for clean rendering)
│   │       └── lib/
│   │           ├── api.ts                # apiFetch (auto-attaches Bearer token); improved error parsing
│   │           ├── auth-context.tsx      # AuthProvider, useAuth hook; navigateAfterAuth (honours sessionStorage returnTo); cookie-first + Bearer fallback
│   │           └── utils.ts
│   │
│   └── litigaforge-ai/              # Python FastAPI backend
│       ├── main.py                  # FastAPI app: lifespan, CORS, rate limits, request logging middleware, mounts 9 routers
│       ├── database.py              # PostgreSQL async pool (asyncpg): fetch, fetchrow, execute
│       ├── auth.py                  # bcrypt hashing, JWT create/decode, cookie-first auth + Bearer fallback
│       ├── payments.py              # Razorpay integration: create_order, verify_payment
│       ├── rate_limit.py            # slowapi limiter + custom 429 exception handler
│       ├── litigaforge_engine.py    # Forge orchestration
│       ├── ai_brain.py              # Multi-AI cascade (Claude → Gemini → GPT-5) + safety wrapper + matching engine
│       ├── sanitizer.py             # Prompt injection detection, text sanitization, identifier validation
│       ├── ai_safety.py             # System prompt wrapper, disclaimer injection, AI output validation
│       ├── models.py                # Pydantic v2 request validators with field-level injection checks
│       ├── logger.py                # Structured JSON logging (production) + readable format (dev)
│       ├── requirements.txt
│       ├── routers/                 # 12 modular FastAPI routers
│       │   ├── auth.py              # Register, login, logout, me — bcrypt + JWT; Google/Apple/passkey
│       │   ├── forge.py             # The Forge, cases, memory, chains, healthz
│       │   ├── subscription.py      # Plans, Razorpay create-order, verify
│       │   ├── matching.py          # Post requirements, AI find-lawyers, match management
│       │   ├── chat.py              # AI legal drafting chat, match-based messaging threads
│       │   ├── community.py         # Legal Q&A, Doc Analyzer, Judgments, Lawyers, Legal Aid
│       │   ├── watch.py             # Watch mode start/stop/add/list/remove
│       │   ├── alerts.py            # WhatsApp alerts, hearing reminders
│       │   ├── admin.py             # Pending lawyer verification, approve/reject, user management
│       │   ├── lawyer.py            # Lawyer case/document CRUD, CNR tracking, AI analysis, notes
│       │   ├── workspace.py         # Forge Workspace: sessions CRUD, canvas PUT, SSE analyze, What-If, Proactive Intel, IKanoon search
│       │   └── personalization.py   # Personal Legal Twin: learning events, profile GET/PUT/DELETE, cross-matter analysis
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

- **Register** at `/register` — name, email, password, and **role** (Client or Lawyer). Account created in PostgreSQL, returns a 30-day JWT.
- **Login** at `/login` — email + password. Verifies bcrypt hash, returns JWT with role info.
- **Role-based redirect** — after login/registration, lawyers are sent to `/lawyer-dashboard` and clients to `/client-dashboard`
- JWT is stored in `localStorage` (`lf_token`) and automatically attached to every API request via `apiFetch`.
- All main pages are protected — unauthenticated users are redirected to `/login`.
- Auth state has a loading spinner to prevent the login page from flashing during initial token verification.
- The sidebar shows the logged-in user's name, email, tier badge, monthly usage bar, role indicator, and Sign Out button.

### Subscription tiers

| Tier | Price | Cases / Month | AI Engine |
|---|---|---|---|
| **Free** | ₹0 | 5 | Smart Fallback templates |
| **Professional** | ₹999 / month | 50 | Gemini 2.5 Flash |
| **Advocate Pro** | ₹2,499 / month | Unlimited | Claude Sonnet + Gemini + GPT-5 |

- Monthly counter resets automatically on the first of each month.
- Hitting the limit returns an error asking you to upgrade.
- **Upgrades require real payment** via Razorpay:
  1. `POST /subscription/create-order` — creates a Razorpay order
  2. Razorpay checkout modal opens in the browser
  3. `POST /subscription/verify` — verifies signature, activates tier
- The old `POST /subscription/upgrade` endpoint is disabled (410 Gone).

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
  is_superuser      BOOLEAN DEFAULT FALSE,
  role              TEXT NOT NULL DEFAULT 'client',  -- 'client' or 'lawyer'
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

CREATE TABLE lawyers (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  bar_number          TEXT,
  district            TEXT,
  practice_areas      TEXT[],
  languages           TEXT[],
  experience_years    INTEGER,
  rating              NUMERIC(3,2) DEFAULT 0,
  bio                 TEXT,
  hourly_rate         INTEGER,
  availability        TEXT DEFAULT 'available',
  verification_status TEXT DEFAULT 'pending',
  verified            BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE case_requirements (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  case_type     TEXT NOT NULL,
  description   TEXT,
  location      TEXT,
  budget_range  TEXT,
  is_anonymous  BOOLEAN DEFAULT FALSE,
  status        TEXT DEFAULT 'open',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE matches (
  id                    SERIAL PRIMARY KEY,
  case_requirement_id   INTEGER REFERENCES case_requirements(id) ON DELETE CASCADE,
  lawyer_id             INTEGER REFERENCES lawyers(id) ON DELETE CASCADE,
  client_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status                TEXT DEFAULT 'pending',
  match_score           INTEGER DEFAULT 0,
  ai_explanation        TEXT,
  client_message        TEXT,
  lawyer_message        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_threads (
  id          SERIAL PRIMARY KEY,
  match_id    INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id          SERIAL PRIMARY KEY,
  thread_id   INTEGER REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_role TEXT DEFAULT 'user',
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lawyer case management (Lawyer Dashboard)
CREATE TABLE lawyer_cases (
  id            SERIAL PRIMARY KEY,
  lawyer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  case_type     TEXT NOT NULL,
  description   TEXT,
  client_name   TEXT,
  court_name    TEXT,
  cnr_number    TEXT,                          -- Case Number Reference for eCourts linkage
  hearing_date  TEXT,                          -- Next hearing date
  case_stage    TEXT DEFAULT 'filed',          -- filed / arguments / reserved / judgment
  status        TEXT DEFAULT 'active',         -- active / pending / closed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lawyer_documents (
  id            SERIAL PRIMARY KEY,
  lawyer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id       INTEGER REFERENCES lawyer_cases(id) ON DELETE SET NULL,
  filename      TEXT NOT NULL,
  file_type     TEXT NOT NULL,
  file_url      TEXT,
  content_text  TEXT,
  ai_summary    TEXT,                          -- AI-generated document analysis
  notes         TEXT,                          -- Lawyer-written notes per document
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Client case document uploads (Client Portal)
CREATE TABLE client_documents (
  id            SERIAL PRIMARY KEY,
  case_id       INTEGER REFERENCES lawyer_cases(id) ON DELETE CASCADE,
  client_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  file_type     TEXT NOT NULL,
  file_size     INTEGER,
  file_path     TEXT,
  file_url      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

### Razorpay (Payments)

| Variable | Required | Description |
|---|---|---|
| `RAZORPAY_KEY_ID` | Yes (for paid upgrades) | Razorpay key (e.g. `rzp_test_xxx`) |
| `RAZORPAY_KEY_SECRET` | Yes (for paid upgrades) | Razorpay secret |

> Use Razorpay **test keys** during development — no real money is charged. Switch to live keys (`rzp_live_xxx`) before production.

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
                       (entity extraction)        (legal strategy + matching)
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
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                    AI Matching Engine          Chat Threads
               (case → lawyer scoring)        (client-lawyer chat)
                              │
                        PostgreSQL
             (users, subs, cases, lawyers,
                  matches, chat_messages)
```

**AI Safety Layer** — every AI call is wrapped before and after:
```
User Input → sanitizer.py (injection detection + text cleaning)
            → ai_safety.py (unoverridable system prompt wrapper)
            → AI Provider (Claude / Gemini / GPT-5)
            → ai_safety.py (output validation + disclaimer injection)
            → Router response
```
- `sanitizer.py` — detects 15 prompt injection patterns, strips control characters, enforces max lengths, validates identifiers (PAN, GSTIN, bar number)
- `ai_safety.py` — injects legal system prompt that cannot be overridden, appends "not legal advice" disclaimer to every response, validates output for jailbreak red flags
- `models.py` — Pydantic v2 `field_validator` injection checks on all request models (Forge, Ask, Document, Chat, Judgment, Lawyer)
- Applied across all 6 routers: `forge.py`, `community.py`, `chat.py`, `matching.py`, `auth.py`, `admin.py`

---

## API Reference

All backend routes are prefixed with `/litigaforge`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/litigaforge/auth/register` | None | Create account — accepts `role` (client/lawyer), sets httpOnly cookie + returns JWT |
| `POST` | `/litigaforge/auth/login` | None | Login — sets httpOnly cookie + returns JWT with role |
| `GET` | `/litigaforge/auth/me` | Cookie / Bearer | Current user info (includes `role`) |
| `POST` | `/litigaforge/auth/logout` | Cookie / Bearer | Clear auth cookie |

### Subscription

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/litigaforge/subscription/plans` | None | List all plans with features and pricing |
| `POST` | `/litigaforge/subscription/create-order` | Cookie / Bearer | Create Razorpay order for chosen tier |
| `POST` | `/litigaforge/subscription/verify` | Cookie / Bearer | Verify Razorpay payment and activate tier |
| `POST` | `/litigaforge/subscription/upgrade` | — | **Deprecated** — returns 410 Gone |

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

### Lawyer Dashboard (Case & Document Management)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/litigaforge/lawyer/cases` | Bearer | Create a new case (title, type, client, court, CNR, status) |
| `GET` | `/litigaforge/lawyer/cases` | Bearer | List all cases for the logged-in lawyer (optional `?status=` filter) |
| `GET` | `/litigaforge/lawyer/cases/{id}` | Bearer | Get a single case with attached documents |
| `PATCH` | `/litigaforge/lawyer/cases/{id}` | Bearer | Edit case details (title, type, client, court, CNR, status) |
| `DELETE` | `/litigaforge/lawyer/cases/{id}` | Bearer | Delete a case and its documents |
| `PATCH` | `/litigaforge/lawyer/cases/{id}/status` | Bearer | Quick status change (active → pending → closed) |
| `POST` | `/litigaforge/lawyer/documents` | Bearer | Upload a document (plain text or AI-analyzed) |
| `GET` | `/litigaforge/lawyer/documents` | Bearer | List all documents for the lawyer |
| `POST` | `/litigaforge/lawyer/documents/{id}/analyze` | Bearer | AI analyze a document (generates risk summary) |
| `POST` | `/litigaforge/lawyer/documents/{id}/notes` | Bearer | Save lawyer notes on a document |
| `GET` | `/litigaforge/lawyer/stats` | Bearer | Quick stats: active/pending/closed counts + document count |

### Client Dashboard (Case & Document Management)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/litigaforge/client/cases` | Bearer | List all cases assigned to the client (with lawyer info attached) |
| `GET` | `/litigaforge/client/cases/{id}` | Bearer | Get a single case with attached documents |
| `PATCH` | `/litigaforge/client/cases/{id}` | Bearer | Edit case description and hearing date (client-owned) |
| `POST` | `/litigaforge/client/cases/{case_id}/documents` | Bearer | Upload a document for a specific case |
| `GET` | `/litigaforge/client/cases/{case_id}/documents` | Bearer | List documents for a specific case |
| `GET` | `/litigaforge/client/documents` | Bearer | List ALL documents across all cases for the client |
| `DELETE` | `/litigaforge/client/documents/{id}` | Bearer | Delete a client's document |

### Client-Lawyer Matching

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/litigaforge/cases/requirements` | Bearer | Post a new case requirement (client) |
| `GET` | `/litigaforge/cases/requirements` | None | Browse all open case requirements |
| `GET` | `/litigaforge/cases/requirements/mine` | Bearer | Client's own case requirements |
| `POST` | `/litigaforge/match/find-lawyers` | Bearer | AI match: find best lawyers for a case (returns scored top 10) |
| `GET` | `/litigaforge/matches/client` | Bearer | Client view: all match proposals for their cases |
| `GET` | `/litigaforge/matches/lawyer` | Bearer | Lawyer view: all match proposals they've received |
| `POST` | `/litigaforge/matches/{id}/accept` | Bearer | Accept a match proposal |
| `POST` | `/litigaforge/matches/{id}/decline` | Bearer | Decline a match proposal |

### AI Legal Chat

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/litigaforge/ai-legal-chat` | Bearer | AI legal drafting chat — send message, get AI response with disclaimer |
| `GET` | `/litigaforge/chat/threads` | Bearer | List chat threads for current user |
| `POST` | `/litigaforge/chat/threads` | Bearer | Create a new chat thread |
| `GET` | `/litigaforge/chat/messages/{thread_id}` | Bearer | Get messages in a thread |
| `POST` | `/litigaforge/chat/messages/{thread_id}` | Bearer | Send a message to a thread |

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
# Register
curl -X POST https://YOUR_DOMAIN/litigaforge/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","email":"you@example.com","password":"securepass123","role":"client"}'

# Login
curl -X POST https://YOUR_DOMAIN/litigaforge/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"securepass123"}'

# Use the returned token
TOKEN="eyJ..."

curl -X POST https://YOUR_DOMAIN/litigaforge/forge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt":"Property dispute in Hyderabad with PAN and vehicle details"}'
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
