# =========================================================
# Multi-Stage Production Dockerfile for CodeCollab Web App
# =========================================================

# --- Stage 1: Build Phase ---
FROM node:20-alpine AS builder

WORKDIR /app

# Arguments for build-time Vite environment variables
ARG VITE_API_BASE_URL=/api
ARG VITE_WS_URL=

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

# Copy monorepo root package manifests & tsconfig base
COPY package.json package-lock.json tsconfig.base.json ./

# Copy shared workspace & web application
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Install dependencies across workspaces
RUN npm ci

# Build shared package first, then build React + Vite web client
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/web

# --- Stage 2: Nginx Web Server ---
FROM nginx:alpine AS runner

# Copy built HTML/JS/CSS static distribution files to Nginx web root
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy custom Nginx configuration with SPA routing & WebSocket proxying
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
