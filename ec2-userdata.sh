#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# LitigaForge AI — EC2 User Data Script (Cloud-Init)
#
# HOW TO USE:
#   1. Launch an EC2 instance (Ubuntu 22.04/24.04 recommended, t3.medium+)
#   2. In "Advanced Details" → "User data", paste this entire script
#   3. IMPORTANT: Edit the variables in the CONFIGURATION section below
#      before pasting into AWS — fill in your API keys
#   4. Launch the instance. Setup runs automatically (~5-10 min on first boot)
#   5. Access your app at: http://<EC2-PUBLIC-IP>
#
# EC2 SECURITY GROUP — open these ports INBOUND:
#   Type: HTTP,  Port: 80,   Source: 0.0.0.0/0
#   Type: HTTPS, Port: 443,  Source: 0.0.0.0/0  (if using SSL)
#   Type: SSH,   Port: 22,   Source: YOUR-IP/32
#
# RECOMMENDED SPECS:
#   Instance type: t3.medium (2 vCPU, 4 GB RAM)
#   Storage:       20 GB gp3 SSD
#   AMI:           Ubuntu Server 22.04 LTS
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  CONFIGURATION — EDIT THESE BEFORE PASTING INTO AWS                        ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# AI Provider API Keys (at least ONE required — get free credits below)
ANTHROPIC_API_KEY="sk-ant-api03-YOUR-KEY-HERE"    # https://console.anthropic.com/
OPENAI_API_KEY="sk-YOUR-KEY-HERE"                  # https://platform.openai.com/api-keys
GOOGLE_API_KEY="AIzaSy-YOUR-KEY-HERE"              # https://aistudio.google.com/app/apikey

# GitHub repo settings (leave as-is unless you've forked)
REPO_URL="https://github.com/arif806-cyber/litigaforge-ai.git"
REPO_BRANCH="feature/replit-ai-integrations"
APP_DIR="/opt/litigaforge-ai"
LOG_FILE="/var/log/litigaforge-install.log"

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  AUTOMATED SETUP — DO NOT EDIT BELOW THIS LINE                             ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

exec > >(tee -a "$LOG_FILE") 2>&1
echo "=== LitigaForge AI Setup Started: $(date) ==="

# ── System Update ─────────────────────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    openssl \
    unzip

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
fi
echo "Docker: $(docker --version)"

# ── Clone repository ──────────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" reset --hard "origin/$REPO_BRANCH"
else
  git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
fi
echo "Repo cloned to $APP_DIR"

# ── Create .env ───────────────────────────────────────────────────────────────
DB_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -hex 32)

cat > "$APP_DIR/.env" <<EOF
DB_PASSWORD=${DB_PASSWORD}
SESSION_SECRET=${SESSION_SECRET}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
GOOGLE_API_KEY=${GOOGLE_API_KEY}
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
EOF
chmod 600 "$APP_DIR/.env"
echo ".env created with generated secrets"

# ── Build and launch ──────────────────────────────────────────────────────────
cd "$APP_DIR"
docker compose pull postgres 2>/dev/null || true
docker compose up -d --build

echo "Docker Compose started"

# ── Wait for backend health ───────────────────────────────────────────────────
echo "Waiting for backend to be healthy..."
for i in $(seq 1 90); do
  if curl -sf http://localhost/litigaforge/healthz &>/dev/null; then
    echo "Backend is healthy after ${i} attempts"
    break
  fi
  sleep 5
done

# ── Write a helpful README to /root ──────────────────────────────────────────
PUBLIC_IP=$(curl -sf --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "unknown")
cat > /root/LITIGAFORGE_README.txt <<EOF
═══════════════════════════════════════════════════════
  LitigaForge AI — Running on this EC2 instance
═══════════════════════════════════════════════════════

App URL:    http://${PUBLIC_IP}
API Docs:   http://${PUBLIC_IP}/litigaforge/docs
Health:     http://${PUBLIC_IP}/litigaforge/healthz
App dir:    ${APP_DIR}
Log file:   ${LOG_FILE}

Management commands (run as root or with sudo):
  View logs:    docker compose -f ${APP_DIR}/docker-compose.yml logs -f
  Stop:         docker compose -f ${APP_DIR}/docker-compose.yml down
  Restart:      docker compose -f ${APP_DIR}/docker-compose.yml restart
  Update code:  cd ${APP_DIR} && git pull && docker compose up -d --build
  DB shell:     docker compose -f ${APP_DIR}/docker-compose.yml exec postgres psql -U litigaforge

Credentials stored in: ${APP_DIR}/.env

═══════════════════════════════════════════════════════
EOF

echo "=== LitigaForge AI Setup Completed: $(date) ==="
echo "App is live at: http://${PUBLIC_IP}"
