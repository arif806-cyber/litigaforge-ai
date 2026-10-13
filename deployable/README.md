# LitigaForge AI — Deployable Package

One-click deployment for both the **web app** and **mobile app**.

---

## Cloud-neutral web stack — Docker Compose

### Requirements
- Docker + Docker Compose installed
- Docker Compose v2
- A domain name for automatic HTTPS (or use `localhost` for local testing)
- An `age` recipient key for encrypted database backups

### Run locally
```bash
cd deployable
cp .env.example .env
# Set unique passwords, provider keys, and SITE_ADDRESS in .env
docker compose up --build
```

Open http://localhost (or your configured domain). Services include PostgreSQL
16 + pgvector, Redis, MinIO, the FastAPI backend, the Node API server, static
React UI, and Caddy for HTTPS routing. In production, set `SITE_ADDRESS` to a
DNS name resolving to this host. Caddy obtains and renews certificates.

### Deploy to a VPS / cloud server
```bash
git clone https://github.com/arif806-cyber/litigaforge-cloud.git
cd litigaforge-cloud/deployable
cp .env.example .env
# Configure every required password/key and SITE_ADDRESS
docker compose up -d --build
```

Point the domain's A/AAAA records at the server. Replit remains the default:
leave `APP_ENV` unset there; its deployment markers, managed PostgreSQL,
object storage, and AI integration base URLs continue to work. Portable hosts
set `APP_ENV=production`, `DATABASE_URL`, `STORAGE_BACKEND=s3`, and their own
provider credentials.

### Jobs and scheduler control

Background schedulers are controlled by `SCHEDULER_ENABLED`. The Compose
default is `false`, so run jobs through an external scheduler when desired:

```bash
docker compose exec ai python run_job.py digest
docker compose exec ai python run_job.py judgment-ingest
docker compose exec ai python run_job.py court-refresh
```

Set `SCHEDULER_ENABLED=true` only when one backend instance should own the
schedules. Avoid enabling it on multiple replicas.

### Encrypted database backups

Install `age` and `pg_dump`/`pg_restore`, then configure `BACKUP_AGE_RECIPIENT`
with a public age recipient and the backup bucket credentials. The private
identity belongs in a secret manager and is only needed for restore.

```bash
python scripts/backup_db.py
BACKUP_S3_KEY=path/to/file.dump.age python scripts/restore_db.py --confirm
```

Only the age-encrypted stream is uploaded; the dump is never written as
plaintext to disk or retained in Git. For a full destructive rebuild, review
the volume warning and explicitly run
`scripts/restore-from-scratch.sh --confirm-destroy-volumes`.

`scripts/copy_object.py` copies encrypted objects between S3-compatible stores
and Replit Object Storage. Its positional form is:
`copy_object.py SOURCE_BACKEND SOURCE_BUCKET SOURCE_KEY DESTINATION_BACKEND`;
set destination bucket/endpoint environment variables for S3.

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
