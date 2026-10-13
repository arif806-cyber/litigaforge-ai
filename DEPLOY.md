# Cloud-neutral deployment

This stack runs the LitigaForge web app with Docker Compose, PostgreSQL 16 +
pgvector, Redis, MinIO-compatible object storage, and Caddy TLS termination.
It does not publish or deploy anything automatically.

## Start

1. Install Docker Engine and the Compose v2 plugin.
2. Copy `.env.example` to `.env`; set unique passwords, `SESSION_SECRET`,
   provider credentials, `ALLOWED_ORIGINS`, and `SITE_ADDRESS`.
3. For a public deployment, point the domain at this host and set
   `SITE_ADDRESS` to that hostname. Keep `SCHEDULER_ENABLED=false` unless one
   backend instance is explicitly designated as the scheduler owner.
4. Start with `docker compose up -d --build`.

Caddy handles HTTP/HTTPS. The frontend is served at the domain root; API
requests are reverse-proxied through `/litigaforge`. Database, Redis, and
MinIO are not exposed on public host ports.

## Configuration

Replit AI integrations remain the fallback when provider-specific
`AI_INTEGRATIONS_*` variables are configured. Portable deployments can instead
set `LLM_API_BASE`, `LLM_API_KEY`, and `LLM_MODEL`.

`STORAGE_BACKEND=s3` uses `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT_URL`,
`S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`; Compose defaults the endpoint
to its private MinIO service. `STORAGE_BACKEND=local` uses
`LOCAL_STORAGE_DIR`. Do not point multiple replicas at local disk.

## Scheduled jobs

Keep the web scheduler disabled when using an external scheduler, and invoke
each job on its schedule with `docker compose exec -T ai python run_job.py JOB`.
Run `python run_job.py --help` for the current job list. Avoid running the same
job from multiple schedulers.

## Encrypted database backup and restore

Install `age`, `pg_dump`, and `pg_restore`. Configure `BACKUP_AGE_RECIPIENT`,
`BACKUP_S3_BUCKET`, and S3-compatible backup credentials, then run
`python deployable/scripts/backup_db.py`. Dumps are streamed through age
encryption and are never written as plaintext files.

Restore requires `BACKUP_AGE_IDENTITY_FILE`, `BACKUP_S3_KEY`, and the
destination `DATABASE_URL`; run
`python deployable/scripts/restore_db.py --confirm`. Restore overwrites
matching database objects. Read and verify the destination before confirming.
The separately named `restore-from-scratch.sh` removes volumes and is
destructive; it requires its own explicit confirmation flag.

## Images and CI

`.github/workflows/cloud-ci.yml` runs type checks and backend tests on pull
requests and the configured branches. It builds and pushes backend, API server,
and UI images to GitHub Container Registry on pushes to the configured branches.
No live-app deployment step is part of this workflow.
