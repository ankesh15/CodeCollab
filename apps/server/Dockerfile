# =========================================================
# Multi-Stage Production Dockerfile for CodeCollab Server
# =========================================================

# --- Stage 1: Build Phase ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL & libc compatibility for Prisma ORM runtime engines
RUN apk add --no-cache openssl libc6-compat

# Copy monorepo root package manifests & tsconfig base
COPY package.json package-lock.json tsconfig.base.json ./

# Copy shared workspace & server package
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Generate Prisma Client & compile shared + server TypeScript
RUN npm run build --workspace=packages/shared
RUN npm run db:generate --workspace=apps/server
RUN npm run build --workspace=apps/server

# Remove devDependencies to shrink node_modules footprint
RUN npm prune --production

# --- Stage 2: Production Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install runtime OpenSSL dependency for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy compiled monorepo workspaces and production dependencies from builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

# Run as non-root user for security hardening
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "apps/server/dist/index.js"]
