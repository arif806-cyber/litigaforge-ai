FROM node:20-slim AS builder

ARG BASE_PATH=/

WORKDIR /app

RUN npm install -g pnpm

COPY package*.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || npm install

COPY . .

ENV BASE_PATH=${BASE_PATH}
ENV PORT=3000
ENV NODE_ENV=production

RUN pnpm run build 2>/dev/null || npm run build

FROM nginx:alpine

COPY --from=builder /app/dist/public /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
