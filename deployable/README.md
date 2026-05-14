# LitigaForge AI — Deployable Package

One-click deployment for both the **web app** and **mobile app**.

---

## Web App — Docker (one command)

### Requirements
- Docker + Docker Compose installed
- Optional: OpenAI API key for live AI (works without it in dummy mode)

### Run locally
```bash
cd deployable
cp .env.example .env          # edit .env if you have API keys
docker compose up --build
```

Open http://localhost → the full LitigaForge UI is live.

### Deploy to a VPS / cloud server
```bash
git clone https://github.com/arif806-cyber/litigaforge-ai.git
cd litigaforge-ai/deployable
cp .env.example .env          # fill in your keys
docker compose up -d --build
```

Point your domain's A record to the server IP. Done.

---

## Mobile App — Expo (Play Store + App Store)

### Requirements
- Node.js 18+, pnpm or npm
- Expo CLI: `npm install -g expo-cli`
- For Android builds: EAS CLI (`npm install -g eas-cli`)
- For iOS builds: EAS CLI + Apple Developer account

### Run on your phone (development)
```bash
cd deployable/mobile
npm install
npx expo start
```
Scan the QR code with the **Expo Go** app on Android or iOS.

### Build for Play Store (Android)
```bash
cd deployable/mobile
eas build --platform android --profile production
```

### Build for App Store (iOS)
```bash
cd deployable/mobile
eas build --platform ios --profile production
```

### Submit to stores
```bash
eas submit --platform android   # Play Store
eas submit --platform ios       # App Store
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | No | Enables live AI chains (dummy mode if absent) |
| `API_SETU_KEY` | No | Live government API data (GSTIN, PAN, VAHAN etc.) |
| `TWILIO_ACCOUNT_SID` | No | WhatsApp alerts via Twilio |
| `TWILIO_AUTH_TOKEN` | No | WhatsApp alerts via Twilio |
| `TWILIO_FROM_NUMBER` | No | WhatsApp sender number |

---

## Architecture

```
Browser / Mobile App
        │
        ▼
  Nginx (port 80)
  ├── /            → React frontend (static)
  └── /litigaforge → FastAPI backend (Python)
```
