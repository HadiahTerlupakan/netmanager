# ==============================================================================
# Stage 1: Dependencies
# ==============================================================================
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (using npm install to handle potential lock file mismatches)
RUN npm install --legacy-peer-deps

# ==============================================================================
# Stage 2: Builder
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Increase Node.js memory limit for build (large projects need more memory)
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build-time dummy environment variables (will be overridden at runtime)
# These are required because Zod validation runs during Next.js build
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_SECRET="build-time-secret-will-be-replaced"
ENV AUTH_SECRET="build-time-secret-will-be-replaced"
ENV AUTH_URL="http://localhost:3000"
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV REDIS_URL="redis://localhost:6379"
ENV OAUTH_ENCRYPTION_KEY="build-time-key-will-be-replaced-at-runtime"

# Build the application
RUN npm run build

# ==============================================================================
# Stage 3: Production Runner
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma client and schema (needed for runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Copy Chart.js modules needed for finance dashboard
COPY --from=builder /app/node_modules/chart.js ./node_modules/chart.js
COPY --from=builder /app/node_modules/react-chartjs-2 ./node_modules/react-chartjs-2

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set hostname
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Start the server
CMD ["node", "server.js"]
