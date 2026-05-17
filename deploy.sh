#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# LitigaForge AI — One-Click AWS EC2 Deploy Script
#
# Usage (run as ubuntu/ec2-user on a fresh EC2 instance):
#   curl -fsSL https://raw.githubusercontent.com/arif806-cyber/litigaforge-ai/feature/replit-ai-integrations/deploy.sh | bash
#
# Or clone the repo and run:
#   bash deploy.sh
#
# Supports: Ubuntu 22.04/24.04, Amazon Linux 2023
# Recommended EC2: t3.medium (2 vCPU, 4 GB RAM) or larger
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

REPO_URL="https://github.com/arif806-cyber/litigaforge-ai.git"
REPO_BRANCH="feature/replit-ai-integrations"
APP_DIR="$HOME/litigaforge-ai"
COMPOSE_CMD=""

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

banner() {
  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}║  LitigaForge AI — AWS EC2 Deployment         ║${RESET}"
  echo -e "${CYAN}${BOLD}║  Telangana & AP Legal Intelligence Platform   ║${RESET}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════╝${RESET}"
  echo ""
}

log()     { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
err()     { echo -e "${RED}[✗]${RESET} $*" >&2; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }

# ── 1. OS Detection ───────────────────────────────────────────────────────────
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="$ID"
    OS_VERSION="${VERSION_ID:-}"
  else
    OS_ID="unknown"
  fi
}

# ── 2. Install Docker ─────────────────────────────────────────────────────────
install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker already installed ($(docker --version | cut -d' ' -f3))"
    return
  fi

  section "Installing Docker"
  case "$OS_ID" in
    ubuntu|debian)
      sudo apt-get update -qq
      sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
      sudo install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      sudo chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update -qq
      sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
      ;;
    amzn|rhel|centos)
      sudo yum update -y -q
      sudo yum install -y -q docker git
      sudo systemctl enable docker
      sudo systemctl start docker
      # Install docker compose plugin for Amazon Linux
      COMPOSE_VERSION="v2.24.6"
      sudo mkdir -p /usr/local/lib/docker/cli-plugins
      sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
        -o /usr/local/lib/docker/cli-plugins/docker-compose
      sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
      ;;
    *)
      warn "Unknown OS. Attempting generic Docker install..."
      curl -fsSL https://get.docker.com | sudo sh
      ;;
  esac

  sudo usermod -aG docker "$USER" 2>/dev/null || true
  sudo systemctl enable docker 2>/dev/null || true
  sudo systemctl start docker 2>/dev/null || true
  log "Docker installed successfully"
}

# ── 3. Detect docker compose command ─────────────────────────────────────────
detect_compose() {
  if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    err "docker compose plugin not found. Please install Docker Compose v2."
  fi
  log "Using: $COMPOSE_CMD"
}

# ── 4. Install Git ────────────────────────────────────────────────────────────
install_git() {
  if command -v git &>/dev/null; then return; fi
  section "Installing Git"
  case "$OS_ID" in
    ubuntu|debian) sudo apt-get install -y -qq git ;;
    amzn|rhel)     sudo yum install -y -q git ;;
    *)             err "Please install git manually and re-run." ;;
  esac
  log "Git installed"
}

# ── 5. Clone / pull repo ──────────────────────────────────────────────────────
clone_repo() {
  section "Setting up repository"
  if [ -d "$APP_DIR/.git" ]; then
    log "Repository already exists. Pulling latest changes..."
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" reset --hard "origin/$REPO_BRANCH"
  else
    git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
    log "Repository cloned to $APP_DIR"
  fi
}

# ── 6. Configure .env ─────────────────────────────────────────────────────────
configure_env() {
  section "Configuring environment"
  ENV_FILE="$APP_DIR/.env"

  if [ -f "$ENV_FILE" ]; then
    warn ".env already exists. Skipping. Edit $ENV_FILE to change settings."
    return
  fi

  cp "$APP_DIR/.env.example" "$ENV_FILE"

  # Generate secure random values
  DB_PASS=$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
  SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 64)

  sed -i "s|change-this-strong-db-password-here|${DB_PASS}|g" "$ENV_FILE"
  sed -i "s|change-this-to-a-64char-random-hex-string-generated-with-openssl|${SESSION_SECRET}|g" "$ENV_FILE"

  echo ""
  echo -e "${YELLOW}${BOLD}┌─────────────────────────────────────────────────┐${RESET}"
  echo -e "${YELLOW}${BOLD}│  ACTION REQUIRED: Add your AI API keys          │${RESET}"
  echo -e "${YELLOW}${BOLD}└─────────────────────────────────────────────────┘${RESET}"
  echo ""
  echo "  Edit: $ENV_FILE"
  echo ""
  echo "  Required (at least one):"
  echo "    ANTHROPIC_API_KEY  → https://console.anthropic.com/"
  echo "    OPENAI_API_KEY     → https://platform.openai.com/api-keys"
  echo "    GOOGLE_API_KEY     → https://aistudio.google.com/app/apikey"
  echo ""

  read -rp "  Do you want to enter API keys now? [Y/n]: " ANSWER
  ANSWER="${ANSWER:-Y}"
  if [[ "$ANSWER" =~ ^[Yy] ]]; then
    echo ""
    read -rp "  Anthropic API Key (sk-ant-...) or press Enter to skip: " ANT_KEY
    [ -n "$ANT_KEY" ] && sed -i "s|sk-ant-api03-YOUR-KEY-HERE|${ANT_KEY}|g" "$ENV_FILE"

    read -rp "  OpenAI API Key (sk-...) or press Enter to skip: " OAI_KEY
    [ -n "$OAI_KEY" ] && sed -i "s|sk-YOUR-KEY-HERE|${OAI_KEY}|g" "$ENV_FILE"

    read -rp "  Google API Key (AIzaSy...) or press Enter to skip: " GOO_KEY
    [ -n "$GOO_KEY" ] && sed -i "s|AIzaSy-YOUR-KEY-HERE|${GOO_KEY}|g" "$ENV_FILE"
  else
    warn "Skipped. Edit $ENV_FILE before the app will work with AI features."
  fi

  log ".env configured at $ENV_FILE"
}

# ── 7. Build and launch ───────────────────────────────────────────────────────
launch() {
  section "Building and launching LitigaForge AI"
  cd "$APP_DIR"

  # Pull base images first (for better progress visibility)
  sudo $COMPOSE_CMD pull postgres nginx 2>/dev/null || true

  # Build and start
  sudo $COMPOSE_CMD up -d --build

  log "Services started!"
}

# ── 8. Health check ───────────────────────────────────────────────────────────
wait_healthy() {
  section "Waiting for services to be healthy"
  echo -n "  Waiting"
  for i in $(seq 1 60); do
    if curl -sf "http://localhost/litigaforge/healthz" &>/dev/null; then
      echo ""
      log "Backend is healthy!"
      break
    fi
    echo -n "."
    sleep 2
  done
}

# ── 9. Show summary ───────────────────────────────────────────────────────────
show_summary() {
  PUBLIC_IP=$(curl -sf --max-time 3 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || \
              curl -sf --max-time 3 https://checkip.amazonaws.com 2>/dev/null || \
              hostname -I | awk '{print $1}')

  echo ""
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${GREEN}${BOLD}║  LitigaForge AI is LIVE!                                ║${RESET}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "  ${BOLD}App URL:${RESET}     http://${PUBLIC_IP}"
  echo -e "  ${BOLD}API Docs:${RESET}    http://${PUBLIC_IP}/litigaforge/docs"
  echo -e "  ${BOLD}Health:${RESET}      http://${PUBLIC_IP}/litigaforge/healthz"
  echo ""
  echo -e "  ${BOLD}Manage:${RESET}"
  echo -e "    Logs:     sudo docker compose -f $APP_DIR/docker-compose.yml logs -f"
  echo -e "    Stop:     sudo docker compose -f $APP_DIR/docker-compose.yml down"
  echo -e "    Restart:  sudo docker compose -f $APP_DIR/docker-compose.yml restart"
  echo -e "    Update:   cd $APP_DIR && git pull && sudo docker compose up -d --build"
  echo ""
  echo -e "  ${YELLOW}${BOLD}Security reminder:${RESET} Open port 80 in your EC2 Security Group."
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  banner
  detect_os
  install_git
  install_docker
  detect_compose
  clone_repo
  configure_env
  launch
  wait_healthy
  show_summary
}

main "$@"
