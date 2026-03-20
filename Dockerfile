# ==============================================================================
# Stage 1: Dependencies
# ==============================================================================
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (Optimized for CI/Build stability)
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && (npm ci --legacy-peer-deps --no-audit --prefer-offline || npm install --legacy-peer-deps --registry=https://registry.npmmirror.com --no-audit)

# ==============================================================================
# Stage 2: Builder
# ==============================================================================
FROM node:24-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma and Build
# Use ARG instead of ENV for build-time only configuration
# This prevents sensitive keys from being baked into the image metadata
ARG NEXT_TELEMETRY_DISABLED=1
ARG NODE_OPTIONS="--max-old-space-size=4096"
ARG NEXTAUTH_URL="http://localhost:3000"
ARG NEXTAUTH_SECRET="build-time-dummy-secret-32-chars-long"
ARG AUTH_SECRET="build-time-dummy-secret-32-chars-long"
ARG AUTH_URL="http://localhost:3000"
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ARG DATABASE_URL_BILLING="postgresql://user:pass@localhost:5432/billing"
ARG DATABASE_URL_MITRA="postgresql://user:pass@localhost:5432/mitra"
ARG RADIUS_DATABASE_URL="postgresql://user:pass@localhost:5432/radius"
ARG REDIS_URL="redis://localhost:6379"
ARG OAUTH_ENCRYPTION_KEY="build-time-dummy-secret-32-chars-long"

# Re-export as ENV only within the builder stage if needed by 'npm run build'
ENV NEXT_TELEMETRY_DISABLED=$NEXT_TELEMETRY_DISABLED
ENV NODE_OPTIONS=$NODE_OPTIONS
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV AUTH_SECRET=$AUTH_SECRET
ENV AUTH_URL=$AUTH_URL
ENV DATABASE_URL=$DATABASE_URL
ENV DATABASE_URL_BILLING=$DATABASE_URL_BILLING
ENV DATABASE_URL_MITRA=$DATABASE_URL_MITRA
ENV RADIUS_DATABASE_URL=$RADIUS_DATABASE_URL
ENV REDIS_URL=$REDIS_URL
ENV OAUTH_ENCRYPTION_KEY=$OAUTH_ENCRYPTION_KEY

RUN npm run prisma:generate
RUN npm run build

# ==============================================================================
# Stage 3: Production Runner
# ==============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Install postgresql-client for pg_dump and psql (used by backup feature)
# and tzdata for setting correct TZ behavior
RUN apk add --no-cache postgresql-client tzdata

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Jakarta
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files - with correct ownership for uploads
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy node_modules (Complete copy since we are not using standalone)
# Optimization: In a stricter setup we would prune devDependencies, but ensuring 'tsx' 
# and other runtime deps are present is priority for the Custom Server setup.
COPY --from=builder /app/node_modules ./node_modules

# Copy application artifacts and logic
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma.radius.config.ts ./prisma.radius.config.ts
COPY --from=builder /app/prisma.billing.config.ts ./prisma.billing.config.ts
COPY --from=builder /app/prisma.mitra.config.ts ./prisma.mitra.config.ts

# Copy lib folder (required by server.ts for websocket, etc.)
COPY --from=builder /app/lib ./lib

# Copy modules folder (required by server.ts for RadiusMonitor, etc.)
COPY --from=builder /app/modules ./modules

# Copy scripts folder (required by K8s migration job for backfill/migration scripts)
COPY --from=builder /app/scripts ./scripts

# proxy.ts is merged into middleware.ts, so we don't copy it anymore
# middleware.ts is handled by default next build or root copy? 
# Check if we need to copy middleware.ts explicitly for custom server...
# Custom server doesn't run middleware, Next.js internal server does.
# But since we use 'tsx server.ts' which wraps 'next start' or similar?
# server.ts uses app.getRequestHandler() which uses middleware internally.
# So middleware.ts needs to be in root.
# builder stage COPY . . so middleware.ts is in /app/middleware.ts in builder.
# runner stage needs to copy it if it's not in .next/standalone (we use complete copy).
# However, we copy .next and server.ts.
# Copy proxy.ts (Next.js 16+ replacement for middleware.ts)
COPY --from=builder /app/proxy.ts ./proxy.ts

# Copy tsconfig for path resolution
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create uploads directories with correct permissions BEFORE switching to nextjs user
RUN mkdir -p /app/public/uploads/attendance \
    && mkdir -p /app/public/uploads/inventory \
    && mkdir -p /app/public/uploads/work-orders \
    && mkdir -p /app/public/uploads/profiles \
    && mkdir -p /app/public/uploads/ktp \
    && mkdir -p /app/public/uploads/apk \
    && chown -R nextjs:nodejs /app/public/uploads

USER nextjs


EXPOSE 3000
ENV PORT=3000

# Start the application using the custom server script defined in package.json
# "start": "NODE_ENV=production tsx server.ts"
CMD ["npm", "start"]
