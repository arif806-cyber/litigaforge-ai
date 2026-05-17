# LitigaForge AI

Self-Evolving Legal Intelligence platform for Telangana & Andhra Pradesh advocates. Paste case facts, extract legal entities, run 16 Indian government API chains, and get a Supreme Court-grade legal strategy in seconds.

---

## Run & Operate (Replit)

- **Backend**: `cd /home/runner/workspace/artifacts/litigaforge-ai && PORT=8000 BASE_PATH=/litigaforge python main.py`
- **Frontend**: `pnpm --filter @workspace/litigaforge-ui run dev` (PORT=23790 BASE_PATH=/ set by artifact)
- Workflows: `LitigaForge AI` (backend) and `artifacts/litigaforge-ui: web` (frontend webview)
- Required env (Replit sets automatically): `DATABASE_URL`, `SESSION_SECRET`
- AI providers: Free via Replit AI Integrations — no API keys needed on Replit

---

## AWS EC2 Deployment (One-Click)

### Option A — Fully Automatic (EC2 User Data)
1. Open `ec2-userdata.sh`, fill in your API keys at the top (3 lines)
2. Launch EC2 (Ubuntu 22.04, `t3.medium`, 20 GB gp3)
3. Paste the script into **Advanced Details → User Data**
4. Open port **80** inbound in the Security Group
5. App is live at `http://<EC2-PUBLIC-IP>` after ~8-10 minutes

### Option B — SSH One-Liner
```bash
curl -fsSL https://raw.githubusercontent.com/arif806-cyber/litigaforge-ai/feature/replit-ai-integrations/deploy.sh | bash
```

### CI/CD with GitHub Actions
Every push to `feature/replit-ai-integrations` automatically redeploys to EC2.
Add these three secrets in **GitHub → Settings → Secrets → Actions**:

| Secret | Value |
|--------|-------|
| `EC2_HOST` | Your EC2 public IP or domain |
| `EC2_USER` | SSH username (e.g. `ubuntu`) |
| `EC2_SSH_KEY` | Contents of your `.pem` private key file |

### AI Keys (required on AWS — Replit proxy not available outside Replit)

| Provider | Free? | Get key at |
|---|---|---|
| `ANTHROPIC_API_KEY` | $5 free credits | [console.anthropic.com](https://console.anthropic.com/) |
| `OPENAI_API_KEY` | Pay-as-you-go | [platform.openai.com](https://platform.openai.com/api-keys) |
| `GOOGLE_API_KEY` | Free tier available | [aistudio.google.com](https://aistudio.google.com/app/apikey) |

---

## Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query, wouter
- **Backend**: Python 3.12, FastAPI, Uvicorn
- **AI**: Gemini 2.5 Flash + Claude Sonnet + GPT-4o
  - On Replit: free via Replit AI Integrations proxy
  - On AWS/self-hosted: direct vendor API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`)
- **Database**: PostgreSQL (psycopg2) — users, subscriptions, case memory
- **Auth**: bcrypt password hashing, JWT (python-jose), 30-day tokens
- **Docker**: multi-stage builds, docker-compose orchestration, nginx reverse proxy

---

## Where Things Live

```
litigaforge-ai/
├── artifacts/
│   ├── litigaforge-ai/          Python FastAPI backend
│   │   ├── main.py              All API routes (auth, forge, cases, chains, templates, draft, research)
│   │   ├── database.py          PostgreSQL CRUD (users, cases, subscriptions)
│   │   ├── auth.py              bcrypt hashing, JWT create/decode
│   │   ├── ai_brain.py          Multi-AI cascade (auto-detects Replit proxy vs direct keys)
│   │   ├── litigaforge_engine.py  Forge orchestration
│   │   ├── Dockerfile           AWS container (python:3.12-slim)
│   │   └── api_chains/          16 government API chain modules
│   └── litigaforge-ui/          React + Vite frontend
│       ├── src/
│       │   ├── pages/
│       │   │   ├── forge.tsx            The Forge — main case analysis UI
│       │   │   ├── advocate-dashboard.tsx  Advocate home (stats, quick actions)
│       │   │   ├── templates.tsx        28-template library with search/filter
│       │   │   ├── draft.tsx            AI Legal Drafting (iDraft-style two-panel)
│       │   │   ├── research.tsx         Legal Research (iSearch-style with citations)
│       │   │   ├── cases.tsx            Case history list
│       │   │   ├── case-detail.tsx      Individual case deep-dive
│       │   │   ├── chains.tsx           16 API chain runner
│       │   │   ├── login.tsx            Sign-in page
│       │   │   ├── register.tsx         Role-selector signup (Advocate / Client)
│       │   │   └── subscription.tsx     Tier upgrade page
│       │   ├── lib/
│       │   │   ├── api.ts               apiFetch helper (auto-attaches Bearer token)
│       │   │   └── auth-context.tsx     AuthProvider, useAuth hook, user_type support
│       │   └── components/
│       │       └── layout.tsx           Role-aware sidebar, topbar, mobile nav
│       ├── vite.config.ts         Replit dev config
│       └── vite.config.prod.ts    AWS/production build config (no Replit plugins)
├── nginx/
│   ├── nginx.conf              Reverse proxy: /litigaforge → backend, / → frontend
│   └── Dockerfile              Multi-stage: Vite build → nginx serve
├── docker-compose.yml          Orchestrates postgres + backend + nginx
├── .env.example                Environment variable template
├── deploy.sh                   Interactive one-click deploy script
├── ec2-userdata.sh             EC2 User Data / cloud-init script
└── .github/workflows/
    └── deploy.yml              CI/CD: lint → deploy on every push
```

---

## Architecture Decisions

- Python FastAPI backend — LangGraph/LangChain ecosystem is Python-first
- All AI calls go through `ai_brain.py` which auto-detects deployment mode (Replit proxy vs direct keys)
- React frontend is fully decoupled — communicates via REST at `/litigaforge`
- JWT stored in localStorage (`lf_token`), attached to every request by `apiFetch`
- Role-based access: advocates see full workspace (Dashboard, Forge, Templates, Draft, Research, Cases, Chains); clients see Forge + Cases only
- Docker: nginx handles both static file serving AND reverse proxy in one container (simpler than separate frontend container)

---

## Product

- **Role-Based Login** — Advocates get full AI workspace; Clients get case tracking
- **The Forge** — paste case facts, auto-extract PAN/GSTIN/vehicle numbers/party names, run 16 govt API chains, synthesize Supreme Court-grade legal strategy
- **Advocate Dashboard** — stats, quick actions, recent cases, featured templates, API chain banner
- **AI Legal Drafting** — 28 template forms (Cheque Bounce, Bail Application, Consumer Complaint, Writ Petition, etc.), AI generates court-ready documents instantly
- **Legal Research** — iSearch-style; type any Indian law question, get cited answers with case law (SC/HC) and statute sections
- **Template Library** — 28 legal document templates across 8 categories (Criminal, Civil, Consumer, Family, Corporate, Tax, Property, Other)
- **16 Government API Chains** — GSTIN, PAN, eCourts, VAHAN, SARATHI, DigiLocker, BPCL LPG, MeriPehchaan, Mee Seva TG, Transport TS, NSE India, Stock Exchange, FOREX, MCA Company, IFSC, Pincode
- **3 Subscription Tiers** — Free (5 cases/mo), Professional ₹999/mo (50 cases, Gemini), Advocate Pro ₹2,499/mo (unlimited, multi-AI)
- **Case Memory** — every forged case stored and searchable; AI learns patterns
- **Watch Mode** — background scheduler monitors cases for court date changes
- **WhatsApp Alerts** — hearing reminders via Twilio (optional, set `TWILIO_*` secrets)

---

## User Preferences

- Source of truth is `feature/replit-ai-integrations` branch at https://github.com/arif806-cyber/litigaforge-ai
- GitHub CI/CD pushes to this branch auto-deploy to EC2 (once `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` secrets are set)

---

## Gotchas

- **Replit backend workflow**: Use the manually created `LitigaForge AI` workflow (runs from correct directory). The artifact-managed `artifacts/litigaforge-ai: LitigaForge AI` uses relative paths and will fail.
- **Frontend workflow**: Use `artifacts/litigaforge-ui: web` (PORT=23790). The `LitigaForge UI` workflow on PORT=5000 conflicts with existing processes.
- `langgraph` and `langchain` must be installed via pip (not in pnpm catalog)
- `@workspace/api-client-react` is in litigaforge-ui's package.json but not imported anywhere — safe to ignore
- `DATABASE_URL` is automatically set by Replit managed PostgreSQL
- Tables `users` and `subscriptions` must be created before first use (done via `database.py` SQL on startup)
- On AWS, `BASE_PATH=/litigaforge` must be set as an env var for the backend container
- The `vite.config.prod.ts` is used for Docker/AWS builds (no Replit-specific plugins); `vite.config.ts` is used on Replit
- Frontend Docker build: pnpm workspace stubs are created for non-UI packages so `pnpm install --filter` works without the full monorepo
