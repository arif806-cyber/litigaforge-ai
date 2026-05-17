# ═══════════════════════════════════════════════════════
# Stage 1 — Build React frontend with Vite + pnpm
# ═══════════════════════════════════════════════════════
FROM node:20-alpine AS frontend-builder

# Enable corepack (provides pnpm)
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /workspace

# ── Copy workspace manifests first (Docker layer caching) ──
COPY package.json pnpm-workspace.yaml ./
# Copy lockfile if it exists (it may not be named pnpm-lock.yaml in all setups)
COPY pnpm-lock.yaml* ./

# Copy only the UI package manifest (triggers install for this package)
COPY artifacts/litigaforge-ui/package.json ./artifacts/litigaforge-ui/

# Create minimal stub package.json files for other workspace packages
# so pnpm workspace resolution doesn't fail on missing siblings
RUN for pkg in \
      artifacts/api-server \
      artifacts/litigaforge-ai \
      artifacts/mockup-sandbox \
      scripts \
      lib/api-client-react \
      lib/api-spec \
      lib/api-zod \
      lib/db; do \
      mkdir -p "$pkg" && \
      printf '{"name":"@workspace/%s","version":"0.0.0","private":true}' "$(basename $pkg)" \
        > "$pkg/package.json"; \
    done

# Install dependencies for the UI package only
RUN pnpm install --filter @workspace/litigaforge-ui --no-frozen-lockfile

# ── Copy source code ──
COPY artifacts/litigaforge-ui ./artifacts/litigaforge-ui

# ── Build ──
WORKDIR /workspace/artifacts/litigaforge-ui
ENV NODE_ENV=production
ENV PORT=80
ENV BASE_PATH=/

RUN pnpm exec vite build --config vite.config.prod.ts

# ═══════════════════════════════════════════════════════
# Stage 2 — Nginx (serves frontend + reverse-proxies API)
# ═══════════════════════════════════════════════════════
FROM nginx:alpine

# Copy built frontend
COPY --from=frontend-builder /workspace/artifacts/litigaforge-ui/dist/public /usr/share/nginx/html

# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost/index.html > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
