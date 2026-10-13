#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" != "--confirm-destroy-volumes" ]]; then
  echo "This destroys all local Compose database, Redis, MinIO, and Caddy volumes."
  echo "After recreating services it restores the encrypted database dump."
  echo "Run only after copying any needed local files and selecting BACKUP_S3_KEY."
  echo "Usage: $0 --confirm-destroy-volumes"
  exit 2
fi
cd "$(dirname "$0")/.."
set -a
source .env
set +a
docker compose down --volumes
docker compose up -d postgres redis minio
until docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'; do sleep 2; done
python scripts/restore_db.py --confirm
docker compose up -d ai api-server ui caddy
