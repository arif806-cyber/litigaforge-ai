# LitigaForge AI

**Self-Evolving Legal Intelligence for Telangana & Andhra Pradesh Advocates**

LitigaForge AI is a full-stack legal tool that takes a plain-language description of a case, automatically extracts legal entities (PAN, GSTIN, vehicle numbers, party names, DL numbers), runs them through a network of 10 Indian government API chains (eCourts, VAHAN, GSTIN, PAN, SARATHI, DigiLocker, Mee Seva, and more), and synthesises a Supreme Court-grade legal strategy — all in seconds.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Repo Structure](#repo-structure)
- [Environment Variables](#environment-variables)
- [Run Locally (Replit)](#run-locally-replit)
- [Deploy on Your Own Server](#deploy-on-your-own-server-one-command)
- [Deploy on Replit (one click)](#deploy-on-replit-one-click)
- [Custom Domain](#custom-domain)
- [Mobile App — Play Store & App Store](#mobile-app--play-store--app-store)
- [Architecture](#architecture)
- [API Reference](#api-reference)

---

## Features

- **The Forge** — paste case facts, get a full legal strategy with entity extraction, chain orchestration, and AI synthesis
- **10 Government API Chains** — GSTIN, PAN, eCourts, VAHAN, SARATHI, DigiLocker, BPCL LPG, MeriPehchaan, Mee Seva Telangana, Telangana Transport
- **Case Memory** — every forged case is stored and searchable; learn patterns over time
- **Watch Mode** — background scheduler that monitors cases and parties for court date changes
- **WhatsApp Alerts** — hearing reminders and forge results delivered via Twilio WhatsApp
- **Dummy Mode** — works without any API keys; returns realistic mock data for all chains
- **Mobile App** — full Expo (React Native) app for Android and iOS
- **Dark Navy / Amber / Gold UI** — glassmorphism cards, particle canvas, framer-motion animations, fully mobile-responsive

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query |
| Backend | Python 3.12, FastAPI, LangGraph, LangChain, OpenAI |
| Mobile | Expo (React Native), Expo Router, NativeWind |
| Deployment | Docker, Nginx, Uvicorn |
| Fonts | Space Grotesk, JetBrains Mono |

---

## Repo Structure

```
litigaforge-ai/
├── artifacts/
│   ├── litigaforge-ui/          # React + Vite web frontend
│   │   └── src/
│   │       ├── pages/           # forge.tsx, cases.tsx, chains.tsx, case-detail.tsx
│   │       ├── components/      # layout.tsx, graphics/, ui/
│   │       └── lib/             # api.ts, utils.ts
│   ├── litigaforge-ai/          # Python FastAPI backend
│   │   ├── main.py              # FastAPI app with all routes
│   │   ├── litigaforge_engine.py
│   │   ├── api_chains/          # 10 government API chain modules
│   │   ├── alerts/              # WhatsApp via Twilio
│   │   ├── watch_mode/          # background case watcher
│   │   ├── forge_memory/        # case storage & pattern learning
│   │   └── requirements.txt
│   └── api-server/              # Node.js Express API server
│
└── deployable/                  # Self-contained deployable package
    ├── README.md
    ├── .env.example
    ├── docker-compose.yml        # one-command web deployment
    ├── web/
    │   ├── backend/             # backend source + Dockerfile
    │   └── frontend/            # frontend source + Dockerfile + nginx.conf
    └── mobile/                  # full Expo mobile app
        ├── app.json
        ├── eas.json
        ├── package.json
        └── app/
            ├── _layout.tsx      # bottom tab navigation
            ├── index.tsx        # Forge screen
            ├── cases.tsx        # Cases list
            ├── chains.tsx       # API chains
            └── case/[id].tsx    # Case detail
```

---

## Environment Variables

Create a `.env` file (copy from `.env.example`):

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | No | Enables live LangGraph AI chains. App runs in dummy mode without it. |
| `API_SETU_KEY` | No | Live government API data — GSTIN, PAN, VAHAN, DigiLocker, Mee Seva, etc. |
| `TWILIO_ACCOUNT_SID` | No | WhatsApp alerts via Twilio |
| `TWILIO_AUTH_TOKEN` | No | WhatsApp alerts via Twilio |
| `TWILIO_FROM_NUMBER` | No | Twilio WhatsApp sender (e.g. `whatsapp:+14155238886`) |
| `SESSION_SECRET` | No | Session signing secret |

> Without any keys, all 10 chains return realistic mock data. The app is fully functional in dummy mode.

---

## Run Locally (Replit)

The project runs on Replit out of the box. Two workflows start automatically:

| Workflow | Command | Purpose |
|---|---|---|
| `LitigaForge AI` | `python main.py` | Backend on port 5000 |
| `artifacts/litigaforge-ui: web` | `pnpm --filter @workspace/litigaforge-ui run dev` | Frontend dev server |

Open the Replit preview pane — the UI is live at `/`.

---

## Deploy on Your Own Server (One Command)

### Requirements
- A Linux server (Ubuntu 22.04+ recommended)
- Docker + Docker Compose installed

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/arif806-cyber/litigaforge-ai.git
cd litigaforge-ai/deployable

# 2. Set up environment variables
cp .env.example .env
nano .env              # add your API keys (optional — works without them)

# 3. Launch everything
docker compose up -d --build
```

That's it. Open `http://YOUR_SERVER_IP` in your browser — the full app is running.

To add your domain, point an **A record** to your server IP, then set up Nginx or Caddy as a reverse proxy with SSL in front of the container.

### Useful Docker commands

```bash
docker compose logs -f          # live logs
docker compose down             # stop everything
docker compose up -d --build    # rebuild after code changes
docker compose ps               # check container status
```

---

## Deploy on Replit (One Click)

1. Open this project in Replit
2. Click the **Publish** button (top right)
3. Choose deployment type: **Autoscale** (recommended)
4. In Advanced settings, pick your preferred **region** before clicking Publish — this cannot be changed later
5. Click **Publish** — Replit handles building, HTTPS, and health checks automatically

Your app will be live at a `*.replit.app` URL within a few minutes.

---

## Custom Domain

After publishing on Replit:

1. Go to the **Published** settings panel
2. Enter your domain in the **Custom Domain** field (e.g. `litigaforge.in`)
3. Replit shows a **CNAME** record to add at your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
4. Add the DNS record — propagation takes a few minutes to an hour
5. HTTPS is handled automatically — no extra setup needed

> Custom domains require a Replit **Core** plan or above.

---

## Mobile App — Play Store & App Store

The mobile app is a full Expo (React Native) application with all four screens — Forge, Cases, Chains, and Case Detail — matching the web app's dark navy / amber design.

### Requirements

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI (for store builds): `npm install -g eas-cli`
- Apple Developer account ($99/year) for iOS builds
- Google Play Developer account ($25 one-time) for Android builds

### Step 1 — Set your API URL

```bash
cd deployable/mobile
cp .env.example .env
```

Edit `.env` and set:
```
EXPO_PUBLIC_API_URL=https://YOUR_PUBLISHED_DOMAIN.replit.app
```

### Step 2 — Run on your phone (development)

```bash
cd deployable/mobile
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app (available free on Play Store and App Store).

### Step 3 — Create an EAS project

```bash
eas init
```

This gives you a project ID — paste it into `deployable/mobile/app.json` under `extra.eas.projectId`.

### Step 4 — Build for Android (Play Store)

```bash
cd deployable/mobile
eas build --platform android --profile production
```

This produces an `.aab` file ready for upload to the Play Store.

### Step 5 — Build for iOS (App Store)

```bash
cd deployable/mobile
eas build --platform ios --profile production
```

This produces an `.ipa` file ready for upload to App Store Connect.

### Step 6 — Submit to stores

```bash
eas submit --platform android   # submits to Play Store
eas submit --platform ios       # submits to App Store
```

Fill in your Google Play service account key and Apple credentials in `deployable/mobile/eas.json` before submitting.

---

## Architecture

```
Browser or Mobile App
         │
         ▼
   Nginx (port 80)
   ├── /              ──▶  React frontend (static files, served by Nginx)
   └── /litigaforge   ──▶  FastAPI backend (Uvicorn, port 5000)
                                │
                         LangGraph Engine
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             NLP Chain                 Router Chain
         (entity extract)          (chain selection)
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
       GSTIN       PAN      eCourts
      VAHAN      SARATHI  DigiLocker
     Mee Seva  Transport  MeriPehchaan
                    │
              Forge Memory
           (pattern learning)
```

---

## API Reference

All backend routes are prefixed with `/litigaforge`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/litigaforge/healthz` | Health check |
| `POST` | `/litigaforge/forge` | Forge a legal strategy from case facts |
| `GET` | `/litigaforge/cases` | List recent forged cases |
| `GET` | `/litigaforge/cases/{id}` | Get a specific case by ID |
| `GET` | `/litigaforge/chains` | List all available API chains |
| `GET` | `/litigaforge/memory/patterns` | View learned forge patterns |
| `GET` | `/litigaforge/memory/stats` | Memory statistics |
| `POST` | `/litigaforge/watch` | Add a case to Watch Mode |
| `GET` | `/litigaforge/watch` | List active watches |
| `DELETE` | `/litigaforge/watch/{id}` | Remove a watch |
| `POST` | `/litigaforge/watch/start` | Start Watch Mode scheduler |
| `POST` | `/litigaforge/watch/stop` | Stop Watch Mode scheduler |
| `POST` | `/litigaforge/alert` | Send a WhatsApp alert |
| `POST` | `/litigaforge/alert/hearing` | Send a hearing reminder |

Interactive API docs available at `/litigaforge/docs` when the backend is running.

---

## Forge Request Example

```bash
curl -X POST https://YOUR_DOMAIN/litigaforge/forge \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "My client Ramesh Kumar with PAN ABCDE1234F and GSTIN 36ABCDE1234F1Z5 has a property dispute in Hyderabad. Vehicle TS09EA1234 involved.",
    "notify_whatsapp": false
  }'
```

---

*Built for Telangana & Andhra Pradesh advocates. Powered by LangGraph, FastAPI, and React.*
