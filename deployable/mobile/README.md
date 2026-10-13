# LitigaForge Mobile App

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
