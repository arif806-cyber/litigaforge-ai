FROM node:22.13.1-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/ ./artifacts/
COPY lib/ ./lib/
COPY shared-plan-prices.json ./
RUN pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build

FROM node:22.13.1-bookworm-slim
ENV NODE_ENV=production PORT=8080
RUN groupadd --system app && useradd --system --gid app --home-dir /app app
WORKDIR /app
COPY --from=build --chown=app:app /workspace/artifacts/api-server/dist ./dist
COPY --from=build --chown=app:app /workspace/node_modules ./node_modules
COPY --from=build --chown=app:app /workspace/artifacts/api-server/package.json ./package.json
USER app
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
