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
ARG NEXT_TELEMETRY_DISABLED=1
ARG NODE_OPTIONS="--max-old-space-size=4096"
ARG NEXTAUTH_URL="http://localhost:3000"
ARG AUTH_URL="http://localhost:3000"

# DATABASE and other non-sensitive build configs
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ARG DATABASE_URL_BILLING="postgresql://user:pass@localhost:5432/billing"
ARG DATABASE_URL_MITRA="postgresql://user:pass@localhost:5432/mitra"
ARG RADIUS_DATABASE_URL="postgresql://user:pass@localhost:5432/radius"
ARG REDIS_URL="redis://localhost:6379"

ENV NEXT_TELEMETRY_DISABLED=$NEXT_TELEMETRY_DISABLED
ENV NODE_OPTIONS=$NODE_OPTIONS
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV AUTH_URL=$AUTH_URL
ENV DATABASE_URL=$DATABASE_URL
ENV DATABASE_URL_BILLING=$DATABASE_URL_BILLING
ENV DATABASE_URL_MITRA=$DATABASE_URL_MITRA
ENV RADIUS_DATABASE_URL=$RADIUS_DATABASE_URL
ENV REDIS_URL=$REDIS_URL

RUN npm run prisma:generate

# Use BuildKit secrets to securely pass sensitive data during build
# These will NOT be baked into the image layers.
RUN --mount=type=secret,id=NEXTAUTH_SECRET \
    --mount=type=secret,id=AUTH_SECRET \
    --mount=type=secret,id=OAUTH_ENCRYPTION_KEY \
    export NEXTAUTH_SECRET=$(cat /run/secrets/NEXTAUTH_SECRET) && \
    export AUTH_SECRET=$(cat /run/secrets/AUTH_SECRET) && \
    export OAUTH_ENCRYPTION_KEY=$(cat /run/secrets/OAUTH_ENCRYPTION_KEY) && \
    npm run build


# ==============================================================================
# Stage 3: Production Runner
# ==============================================================================
FROM node:24-alpine AS runner
WORKDIR /app

# Install postgresql-client for pg_dump and psql (used by backup feature)
# and tzdata for setting correct TZ behavior
RUN apk add --no-cache postgresql-client tzdata

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Jakarta
# Add node_modules/.bin to PATH so we can run prisma, tsx, etc. directly
ENV PATH /app/node_modules/.bin:$PATH

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set correct ownership for public and uploads
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set up standalone output
# Automatically leverages output: 'standalone' from next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Robust fix for Prisma CLI in standalone:
# Next.js standalone tracing prunes too many internal Prisma dependencies.
# We explicitly copy the CLI, the engines, and the necessary sub-dependencies.
# Added missing modules for Prisma 7.x (valibot, pathe, remeda, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/valibot ./node_modules/valibot
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pathe ./node_modules/pathe
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/remeda ./node_modules/remeda
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/std-env ./node_modules/std-env
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/zeptomatch ./node_modules/zeptomatch
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/hono ./node_modules/hono
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@hono ./node_modules/@hono
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/foreground-child ./node_modules/foreground-child
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/get-port-please ./node_modules/get-port-please
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/http-status-codes ./node_modules/http-status-codes
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/proper-lockfile ./node_modules/proper-lockfile
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@mrleebo ./node_modules/@mrleebo
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@electric-sql ./node_modules/@electric-sql
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/undici ./node_modules/undici

# Copy necessary files for the custom server and background tasks
# These files are needed by server.ts and are not automatically bundled in standalone
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/modules ./modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma.radius.config.ts ./prisma.radius.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma.billing.config.ts ./prisma.billing.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma.mitra.config.ts ./prisma.mitra.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/proxy.ts ./proxy.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

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

# Start the application using tsx to run our custom server.ts
# standalone/node_modules already contains 'tsx' and other production dependencies
CMD ["node", "node_modules/.bin/tsx", "server.ts"]
