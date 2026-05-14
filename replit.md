# LitigaForge AI

Legal AI tool for Telangana & AP advocates — extracts entities from case facts, runs 10 government API chains, and synthesises a legal strategy.

## Run & Operate

- Backend runs via `LitigaForge AI` workflow: `cd artifacts/litigaforge-ai && PORT=5000 python main.py`
- Frontend runs via `artifacts/litigaforge-ui: web` workflow: `pnpm --filter @workspace/litigaforge-ui run dev`
- Production build: `PORT=23790 BASE_PATH=/ pnpm --filter @workspace/litigaforge-ui run build`
- GitHub branch: `feature/arifbase` on `arif806-cyber/litigaforge-ai`
- `BASE_PATH=/litigaforge` and `PORT=5000` are set as shared Replit env vars — all workflows pick them up automatically

## Stack

- Frontend: React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query, wouter
- Backend: Python 3.12, FastAPI, LangGraph, LangChain, Uvicorn
- Mobile: Expo (React Native), Expo Router, NativeWind — in `deployable/mobile/`
- Fonts: Space Grotesk + JetBrains Mono (Google Fonts)

## Where things live

- `artifacts/litigaforge-ui/src/pages/` — forge.tsx, cases.tsx, chains.tsx, case-detail.tsx, use-cases.tsx
- `artifacts/litigaforge-ui/src/components/` — layout.tsx, graphics/ (ParticleCanvas, ScalesHero, ChainDiagram, EmptyStateArt)
- `artifacts/litigaforge-ui/src/lib/api.ts` — all API calls; BASE = "/litigaforge"
- `artifacts/litigaforge-ai/main.py` — FastAPI app, all routes, router mounted at BASE_PATH
- `artifacts/litigaforge-ai/api_chains/` — 10 government API chain modules
- `artifacts/litigaforge-ai/alerts/whatsapp.py` — Twilio WhatsApp integration
- `artifacts/litigaforge-ai/watch_mode/` — background case watcher scheduler
- `artifacts/litigaforge-ai/forge_memory/` — case storage and pattern learning
- `deployable/` — self-contained Docker + mobile package for production deployment

## Environment Variables (shared, set in Replit)

| Variable | Current Value | Notes |
|---|---|---|
| `BASE_PATH` | `/litigaforge` | Backend route prefix — set as shared env var |
| `PORT` | `5000` | Backend port — set as shared env var |
| `API_SETU_KEY` | `demokey123456ABCD789` | Public sandbox key from API Setu YAML specs |
| `API_SETU_CLIENT_ID` | `in.gov.sandbox` | Public sandbox client ID |
| `MEESEVA_USE_PROD` | `false` | Set to `true` + real key to use `apisetu.gov.in` production |
| `SESSION_SECRET` | (Replit Secret) | Cookie session signing |

### Secrets to add for more features

| Secret | Where to get it | Enables |
|---|---|---|
| `OPENAI_API_KEY` | platform.openai.com | Live LangGraph AI synthesis (without it: pre-built strategies) |
| `TWILIO_ACCOUNT_SID` | twilio.com console | WhatsApp alerts |
| `TWILIO_AUTH_TOKEN` | twilio.com console | WhatsApp alerts |
| `TWILIO_FROM_NUMBER` | Twilio sandbox: `whatsapp:+14155238886` | WhatsApp sender |
| `ADVOCATE_WHATSAPP` | Your number e.g. `whatsapp:+919876543210` | WhatsApp recipient |
| `MERIPEHCHAAN_CLIENT_ID` | meripehchaan.gov.in app registration | Live DigiLocker OAuth |
| `MERIPEHCHAAN_CLIENT_SECRET` | meripehchaan.gov.in app registration | Live DigiLocker OAuth |
| `ECOURTS_API_KEY` | api.ecourts.gov.in | Live eCourts case lookup |

## API Chain Status

| Chain | Status | Data Source |
|---|---|---|
| Mee Seva TG | **Live sandbox** | `sandbox.api-setu.in` |
| Transport TS | **Live sandbox** | `sandbox.api-setu.in` |
| BPCL LPG | Sandbox-ready | Needs `API_SETU_KEY` (already set) |
| MeriPehchaan | Mock | Needs OAuth client credentials |
| GSTIN, PAN, eCourts, VAHAN, SARATHI, DigiLocker | Mock | Realistic fake data |

To go live on all API Setu chains: register at api.setu.in, get approved credentials, replace `API_SETU_KEY`, set `MEESEVA_USE_PROD=true`.

## Architecture decisions

- `BASE_PATH=/litigaforge`: backend router mounts all routes at this prefix; proxy routes `/litigaforge/*` to port 5000; now set via shared env var, not inline workflow command
- Dummy mode for AI: all 10 chains return realistic mock data when `OPENAI_API_KEY` is absent; chains themselves use `API_SETU_KEY` independently
- Sandbox mode: Mee Seva TG and Transport TS call `sandbox.api-setu.in` when `API_SETU_KEY` is set (even the demo key)
- Tailwind v4: NEVER use `@apply dark` — use `document.documentElement.classList.add("dark")` in main.tsx
- Mobile layout: sidebar hidden on mobile, replaced by hamburger drawer + fixed bottom tab bar (h-16); main content has `pb-16 md:pb-0`
- Code splitting: vite.config.ts splits react-vendor, motion, query, ui into separate chunks

## Product (pages)

- **The Forge** (`/`): input case facts → extract entities → run government API chains → get legal strategy
- **Cases** (`/cases`): browse all previously forged cases, drill into full chain results
- **Chains** (`/chains`): view all 10 API chains with live/sandbox/mock status
- **Case Detail** (`/cases/:id`): full chain results, strategy, entities for a single case
- **Use Cases** (`/use-cases`): 7 interactive scenario cards — Property, MACT, GST Fraud, Criminal, Mee Seva, Watch Mode, NPA/DRT — each with a "Try in Forge" button that pre-fills the Forge via sessionStorage

## User preferences

- Stunning advanced UI with graphics — dark navy (#0a0f1e) / amber / gold theme, glassmorphism, particles
- Full mobile compatibility (Android + iOS)
- All work saved to GitHub: repo `arif806-cyber/litigaforge-ai`, branch `feature/arifbase`

## Gotchas

- Never nest `<Link>` inside `<a>` — wouter's Link renders as `<a>`
- ScalesHero is `hidden lg:block` — only shows on large screens
- `BASE_PATH` is now a shared env var — do NOT add it inline to workflow commands
- `data-testid` attributes must be preserved on all interactive elements
- pnpm workspaces: run build/dev with `--filter @workspace/<name>`, never `pnpm dev` at root
- `/litigaforge/chains` note field: conditionally shows sandbox vs dummy status based on whether `API_SETU_KEY` is set
- WhatsApp sandbox: Twilio sandbox number is `whatsapp:+14155238886`; advocate must first send join message to activate

## Pointers

- See `deployable/README.md` for Docker deployment and mobile store submission guide
- See `README.md` (root) for full project documentation including all env vars, chain status table, API reference, forge tips
- See the `pnpm-workspace` skill for workspace structure details
