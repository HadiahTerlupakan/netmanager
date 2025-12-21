# ==============================================================================
# Stage 1: Dependencies
# ==============================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# ==============================================================================
# Stage 2: Builder
# ==============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma and Build
# Environment variables required for build-time validation are set here as dummies
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_SECRET="build-time-secret-will-be-replaced"
ENV AUTH_SECRET="build-time-secret-will-be-replaced"
ENV AUTH_URL="http://localhost:3000"
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV REDIS_URL="redis://localhost:6379"
ENV OAUTH_ENCRYPTION_KEY="build-time-key-will-be-replaced-at-runtime"

RUN npx prisma generate
RUN npm run build

# ==============================================================================
# Stage 3: Production Runner
# ==============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
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

# Copy lib folder (required by server.ts for websocket, etc.)
COPY --from=builder /app/lib ./lib

# Copy modules folder (required by server.ts for RadiusMonitor, etc.)
COPY --from=builder /app/modules ./modules

# Copy proxy.ts (required by server.ts/middleware)
COPY --from=builder /app/proxy.ts ./proxy.ts

# Copy tsconfig for path resolution
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000
ENV PORT=3000

# Start the application using the custom server script defined in package.json
# "start": "NODE_ENV=production tsx server.ts"
CMD ["npm", "start"]
