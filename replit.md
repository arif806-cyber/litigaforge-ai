# LitigaForge AI

Legal AI tool for Telangana & AP advocates — extracts entities from case facts, runs 10 government API chains, and synthesises a legal strategy.

## Run & Operate

- Backend runs via `LitigaForge AI` workflow: `cd artifacts/litigaforge-ai && PORT=5000 python main.py`
- Frontend runs via `artifacts/litigaforge-ui: web` workflow: `pnpm --filter @workspace/litigaforge-ui run dev`
- Production build: `PORT=23790 BASE_PATH=/ pnpm --filter @workspace/litigaforge-ui run build`
- GitHub branch: `feature/arifbase` on `arif806-cyber/litigaforge-ai`

## Stack

- Frontend: React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query, wouter
- Backend: Python 3.12, FastAPI, LangGraph, LangChain, Uvicorn
- Mobile: Expo (React Native), Expo Router, NativeWind — in `deployable/mobile/`
- Fonts: Space Grotesk + JetBrains Mono (Google Fonts)

## Where things live

- `artifacts/litigaforge-ui/src/pages/` — forge.tsx, cases.tsx, chains.tsx, case-detail.tsx
- `artifacts/litigaforge-ui/src/components/` — layout.tsx, graphics/ (ParticleCanvas, ScalesHero, ChainDiagram, EmptyStateArt)
- `artifacts/litigaforge-ui/src/lib/api.ts` — all API calls; BASE = "/litigaforge"
- `artifacts/litigaforge-ai/main.py` — FastAPI app, all routes, router mounted at BASE_PATH
- `artifacts/litigaforge-ai/api_chains/` — 10 government API chain modules
- `deployable/` — self-contained Docker + mobile package for production deployment

## Architecture decisions

- BASE_PATH=/litigaforge: backend router mounts all routes at this prefix; proxy routes /litigaforge/* to port 5000
- Dummy mode: all 10 chains return realistic mock data when OPENAI_API_KEY is absent
- Tailwind v4: NEVER use `@apply dark` — use `document.documentElement.classList.add("dark")` in main.tsx
- Mobile layout: sidebar hidden on mobile, replaced by hamburger drawer + fixed bottom tab bar (h-16); main content has `pb-16 md:pb-0`
- Code splitting: vite.config.ts splits react-vendor, motion, query, ui into separate chunks

## Product

- The Forge: input case facts → extract entities → run government API chains → get legal strategy
- Cases: browse all previously forged cases, drill into full chain results
- Chains: view all 10 API chains (GSTIN, PAN, eCourts, VAHAN, SARATHI, DigiLocker, BPCL LPG, MeriPehchaan, Mee Seva TG, Transport TS)
- Watch Mode: background scheduler monitors cases for court date changes
- WhatsApp alerts: hearing reminders via Twilio

## User preferences

- Stunning advanced UI with graphics — dark navy (#0a0f1e) / amber / gold theme, glassmorphism, particles
- Full mobile compatibility (Android + iOS)
- All work saved to GitHub: repo `arif806-cyber/litigaforge-ai`, branch `feature/arifbase`

## Gotchas

- Never nest `<Link>` inside `<a>` — wouter's Link renders as `<a>`
- ScalesHero is `hidden lg:block` — only shows on large screens
- The standalone `LitigaForge AI` workflow runs without BASE_PATH; production uses BASE_PATH=/litigaforge
- `data-testid` attributes must be preserved on all interactive elements
- pnpm workspaces: run build/dev with `--filter @workspace/<name>`, never `pnpm dev` at root

## Pointers

- See `deployable/README.md` for Docker deployment and mobile store submission guide
- See `README.md` (root) for full project documentation
- See the `pnpm-workspace` skill for workspace structure details
