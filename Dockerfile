# ==============================================================================
# Stage 1: Builder
# ==============================================================================
#
# Dulu ada stage `deps` terpisah yang hanya menjalankan `npm ci`, lalu builder
# menyalin hasilnya dengan `COPY --from=deps /app/node_modules`. Salinan itu
# memindahkan ~1,8 GB antar stage dan memakan 115 detik pada build produksi —
# tanpa manfaat: `deps` tidak dipakai stage lain, dan `npm ci` di sini
# ter-cache oleh layer yang sama persis (package.json + package-lock.json).
#
# `node_modules` ada di .dockerignore, jadi `COPY . .` di bawah tidak menimpa
# hasil instalasi ini.
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./

# Cache mount mempercepat pemasangan ulang saat package-lock.json berubah.
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci --legacy-peer-deps --no-audit --prefer-offline --ignore-scripts

COPY . .

# Generate Prisma and Build
# Use ARG instead of ENV for build-time only configuration
ARG NEXT_TELEMETRY_DISABLED=1
# 4GB cukup untuk next build di CI; jangan 8GB — host OOM (build #228).
# package.json "build" tidak hardcode heap supaya ENV ini dihormati.
ARG NODE_OPTIONS="--no-deprecation --max-old-space-size=4096"
# Default konservatif ada DI SINI, bukan di next.config.ts. Alasannya: build
# Docker selalu berjalan di runner/host yang lebih kecil daripada mesin
# pengembang, dan tiap worker menambah pemakaian heap sendiri (lihat NODE_OPTIONS
# di atas — host pernah OOM di build #228). Pipeline tetap mengirim
# `--build-arg NEXT_BUILD_CPUS=1`; nilai di sini menjaga `docker build` manual
# yang lupa mengirimnya.
#
# Di luar Docker, `next.config.ts` sengaja TIDAK memaksa nilai apa pun sehingga
# mesin pengembang memakai default Next dari jumlah core-nya sendiri.
ARG NEXT_BUILD_CPUS="1"
# Flag tambahan untuk `next build`, mis. --webpack. Kosong = default Next.
ARG NEXT_BUILD_FLAGS=""
# Diagnosis: matikan minifikasi agar jejak tumpukan menyebut nama asli.
ARG NEXT_DISABLE_MINIFY=""
ARG NEXTAUTH_URL="http://localhost:3000"
ARG APP_URL="http://localhost:3000"
ARG IMAGE_REVISION="unknown"
ARG NEXT_PUBLIC_FIREBASE_API_KEY=""
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
ARG NEXT_PUBLIC_FIREBASE_DATABASE_URL=""
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
ARG NEXT_PUBLIC_FIREBASE_APP_ID=""
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""

# Skip TypeScript check during build (typecheck already runs in the CI
# quality job). Saves ~2.5 min. Set via build-arg SKIP_TS_CHECK=true di
# .github/workflows/build-image.yml.
ARG SKIP_TS_CHECK="false"

# DATABASE and other non-sensitive build configs
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ARG DATABASE_URL_BILLING="postgresql://user:pass@localhost:5432/billing"
ARG DATABASE_URL_MITRA="postgresql://user:pass@localhost:5432/mitra"
ARG RADIUS_DATABASE_URL="postgresql://user:pass@localhost:5432/radius"
ARG REDIS_URL="redis://localhost:6379"

ENV NEXT_TELEMETRY_DISABLED=$NEXT_TELEMETRY_DISABLED
ENV NODE_OPTIONS=$NODE_OPTIONS
ENV NEXT_BUILD_CPUS=$NEXT_BUILD_CPUS
ENV NEXT_DISABLE_MINIFY=$NEXT_DISABLE_MINIFY
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV APP_URL=$APP_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_DATABASE_URL=$NEXT_PUBLIC_FIREBASE_DATABASE_URL
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV DATABASE_URL=$DATABASE_URL
ENV DATABASE_URL_BILLING=$DATABASE_URL_BILLING
ENV DATABASE_URL_MITRA=$DATABASE_URL_MITRA
ENV RADIUS_DATABASE_URL=$RADIUS_DATABASE_URL
ENV REDIS_URL=$REDIS_URL
ENV SKIP_TS_CHECK=$SKIP_TS_CHECK

RUN npm run prisma:generate

# Use BuildKit secrets to securely pass sensitive data during build
# and cache mount for Next.js build cache to speed up subsequent builds.
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked \
    --mount=type=secret,id=NEXTAUTH_SECRET \
    --mount=type=secret,id=AUTH_SECRET \
    --mount=type=secret,id=OAUTH_ENCRYPTION_KEY \
    export NEXTAUTH_SECRET=$(cat /run/secrets/NEXTAUTH_SECRET) && \
    export AUTH_SECRET=$(cat /run/secrets/AUTH_SECRET) && \
    export OAUTH_ENCRYPTION_KEY=$(cat /run/secrets/OAUTH_ENCRYPTION_KEY) && \
    npm run build ${NEXT_BUILD_FLAGS:+-- ${NEXT_BUILD_FLAGS}}

# ==============================================================================
# Stage 2: Production Dependencies
# ==============================================================================
# Dulu tahap ini `npm prune --omit=dev` di builder, dan itu memakan 9,6 menit
# dari 31 menit build karena prune menghitung ulang seluruh pohon dependensi.
# Memasang ulang secara bersih jauh lebih murah, dan karena stage ini tidak
# bergantung pada builder, BuildKit menjalankannya paralel dengan kompilasi.
#
# `prisma` dan `@prisma/client` ada di dependencies, jadi client-nya bisa
# di-generate di sini. Config berformat TypeScript tetap terbaca tanpa paket
# `typescript` karena @prisma/config memuatnya lewat c12/jiti.
FROM node:24-alpine AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci --omit=dev --legacy-peer-deps --no-audit --prefer-offline --ignore-scripts

COPY prisma ./prisma
COPY prisma.config.ts prisma.radius.config.ts prisma.billing.config.ts prisma.mitra.config.ts ./

# Config Prisma berformat TypeScript membaca URL database saat dimuat, jadi
# nilainya harus ada meski generate tidak menyentuh database sama sekali.
# Nilai dummy ini tidak bocor ke image akhir: runner hanya menyalin
# node_modules dari stage ini, bukan ENV-nya.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV DATABASE_URL_BILLING="postgresql://user:pass@localhost:5432/billing"
ENV DATABASE_URL_MITRA="postgresql://user:pass@localhost:5432/mitra"
ENV RADIUS_DATABASE_URL="postgresql://user:pass@localhost:5432/radius"

RUN npm run prisma:generate

# Dirampingkan DI SINI, bukan di runner: stage ini berjalan paralel dengan
# kompilasi builder, jadi ongkosnya tidak menambah jalur kritis. Membuang
# berkas lebih dulu juga berarti COPY ke runner memindahkan jauh lebih sedikit
# berkas.
# Trim node_modules: remove files not needed at runtime to reduce image size.
# This is safe because these files are never imported/required at runtime.
# Estimated savings: ~50-80MB
RUN find node_modules \( \
      -name "*.d.ts" -o -name "*.d.mts" -o -name "*.d.cts" \
      -o -name "*.map" \
      -o -name "README.md" -o -name "README" -o -name "readme.md" \
      -o -name "CHANGELOG.md" -o -name "CHANGELOG" -o -name "HISTORY.md" \
      -o -name "LICENSE" -o -name "LICENSE.md" -o -name "LICENSE.txt" -o -name "license" \
      -o -name ".editorconfig" -o -name ".npmignore" \
      -o -name "tsconfig.json" -o -name "tsconfig.*.json" \
      -o -name ".eslintrc*" -o -name ".prettierrc*" \
    \) -type f -delete 2>/dev/null; \
    find node_modules \( \
      -name "test" -o -name "tests" -o -name "__tests__" \
      -o -name "docs" -o -name ".github" \
      -o -name "example" -o -name "examples" \
    \) -type d -exec rm -rf {} + 2>/dev/null; \
    echo "node_modules trimmed successfully"

# SENGAJA TIDAK ADA `chown -R` DI SINI.
#
# Pernah ada, dengan alasan bahwa stage ini berjalan paralel dengan kompilasi
# sehingga ongkosnya "gratis". Alasan itu salah dan terukur salah: pada run #88
# langkah `RUN chown -R 1001:1001 /app/node_modules` memakan **4276 detik**,
# sementara kompilasi webpack yang berjalan di sebelahnya hanya 1608 detik.
# Build lalu menunggu 44 menit setelah webpack selesai, hanya untuk chown.
# `RUN` membuat layer baru, dan mengubah metadata setiap berkas memaksa
# overlayfs menyalin-naik seluruh ~1,8 GB node_modules.
#
# Kepemilikan itu memang tidak pernah dibutuhkan: `npm ci` menulis berkas
# dengan mode 644 dan direktori 755 — terbaca dan tertelusuri oleh user mana
# pun — dan tidak ada kode runtime yang menulis ke dalam node_modules. User
# `nextjs` (uid 1001) cukup membacanya.
#
# `COPY --from=prod-deps` tanpa `--chown` di runner memakan 29,7 detik
# (run #88), dibanding 773 detik ketika `--chown` masih dipakai (run #84).


# ==============================================================================
# Stage 3: Production Runner
# ==============================================================================
FROM node:24-alpine AS runner
WORKDIR /app

ARG IMAGE_REVISION="unknown"
LABEL org.opencontainers.image.revision=$IMAGE_REVISION

# Install postgresql-client for pg_dump and psql (used by backup feature)
# and tzdata for setting correct TZ behavior
RUN apk add --no-cache postgresql-client tzdata

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Jakarta
# Add node_modules/.bin to PATH so we can run prisma, tsx, etc. directly
ENV PATH="/app/node_modules/.bin:$PATH"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set correct ownership for public and uploads
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set up standalone output
# Automatically leverages output: 'standalone' from next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy FULL production node_modules (already pruned in builder stage).
# This replaces the fragile per-module COPY approach that caused missing
# sub-dependency errors (e.g. pure-rand, ioredis, socket.io, etc.)
# The standalone node_modules is overwritten with the complete set.
# Tanpa `--chown`. Menulis ulang kepemilikan di sini berarti menyentuh ratusan
# ribu berkas SATU PER SATU pada jalur kritis — terukur 773 detik pada run #84,
# lebih lama daripada kompilasi webpack-nya sendiri (432 detik). Tanpa itu,
# langkah yang sama memakan 29,7 detik pada run #88.
#
# Berkasnya mendarat sebagai milik root, dan itu memang tidak masalah: mode
# bawaan `npm ci` adalah 644/755, sehingga user `nextjs` bisa membaca dan
# menelusurinya, dan tidak ada kode runtime yang menulis ke node_modules.
# Lihat catatan panjang di stage `prod-deps` soal mengapa `chown -R` di sana
# justru menjadi jalur kritis yang lebih mahal.
COPY --from=prod-deps /app/node_modules ./node_modules

# `COPY --from` mempertahankan kepemilikan ISI direktori, tetapi direktori
# tujuannya sendiri dibuat sebagai root. Satu chown non-rekursif menutup
# celah itu — ongkosnya satu inode, bukan ratusan ribu seperti `--chown`.
RUN chown 1001:1001 node_modules

# Copy necessary files for the custom server and background tasks
# These files are needed by server.ts and are not automatically bundled in standalone
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/worker.ts ./worker.ts
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
