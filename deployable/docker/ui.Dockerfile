FROM node:22.13.1-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/ ./artifacts/
COPY lib/ ./lib/
COPY shared-plan-prices.json ./
RUN pnpm install --frozen-lockfile && BASE_PATH=/ pnpm --filter @workspace/litigaforge-ui run build

FROM nginx:1.27.4-alpine
COPY --from=build /workspace/artifacts/litigaforge-ui/dist/public/ /usr/share/nginx/html/
COPY deployable/docker/ui.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
