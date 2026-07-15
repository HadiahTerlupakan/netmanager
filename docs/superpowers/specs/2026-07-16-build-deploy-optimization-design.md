# 2026-07-16 — Optimasi Build Deploy (Percepat dari ~25 mnt → <10 mnt)

**Tanggal:** 2026-07-16  
**Topik:** Optimasi pipeline build production tanpa memisahkan layanan FE/BE  
**Status:** Draft — menunggu review  

---

## 1. Konteks & Akar Masalah

Build deploy lambat (~25 menit). Penyebab **bukan** arsitektur FE/BE yang disatuin — layer sudah terpisah via Clean Architecture (`app/api/` → `modules/*/services/` → `modules/*/repositories/`). Yang lambat adalah 4 bottleneck konkret:

| # | Bottleneck | Bukti | Estimasi Dampak |
|---|---|---|---|
| **B1** | `.next/cache` tidak persist antar Jenkins run | `Dockerfile:77` pakai `--mount=type=cache,target=/app/.next/cache`, tapi Jenkins buildx `--push` pakai ephemeral builder context → cache hilang setiap run | ~15-20 mnt |
| **B2** | Webpack `parallelism = 1` (serial) hardcoded | `next.config.ts:228` paksa `config.parallelism = 1` saat `!dev` untuk hemat memory CI | ~3-5 mnt |
| **B3** | Stage Jenkins: Install+QC → Test → Build berjalan **serial** | Test tidak perlu selesai dulu sebelum Build mulai; keduanya independen | ~5-8 mnt |
| **B4** | Heavy deps tanpa `optimizePackageImports` | `lucide-react`, `ol`, `firebase`, `chart.js`, `react-big-calendar` tidak pakai modular import | ~2-3 mnt + ukuran bundle |

---

## 2. Tujuan & Success Criteria

- **Target**: build deploy production dari ~25 mnt → **<10 mnt** (cache hit), ~15 mnt (cache miss/first run).
- **Non-goal**:
  - Tidak pisah FE/BE ke layanan/repo terpisah.
  - Tidak migrasi Turbopack untuk production build (eksperimental, risk tinggi tanpa staging).
  - Tidak rewrite route handlers ke Hono standalone (`server-api.ts` sudah ada tapi out of scope).
  - Tidak code splitting per-route manual (Next.js handle otomatis).
- **Constraint**: pipeline production-only (branch `main`), tidak ada staging untuk uji coba → semua perubahan harus **reversible** dan **zero risk** untuk aplikasi.

---

## 3. Pendekatan: 2 Fase Bertahap

Dipilih karena dampak terbesar dengan risk terendah. Fase 1 tidak menyentuh logika aplikasi sama sekali.

### Fase 1 — Persist Cache + Paralelisasi Pipeline

**Target**: ~25 mnt → <10 mnt (cache hit)

#### A1: Persist `.next/cache` via BuildKit registry cache

**Masalah**: Dockerfile pakai `--mount=type=cache,target=/app/.next/cache` yang ephemeral per-builder. Jenkins buildx `--push` pakai builder container baru setiap run → cache selalu kosong.

**Solusi**: Tambah `sharing=locked` di cache mount dan pastikan `BUILDKIT_CACHE_REF_APP` dengan `mode=max` sudah menyimpan layer `.next/cache`. Jika `mode=max` belum cukup (karena cache mount tidak selalu di-export sebagai layer), gunakan pendekatan alternatif: **copy `.next/cache` ke dalam image layer** di akhir builder stage, lalu restore dari `--cache-from` di build berikutnya.

```dockerfile
# Dockerfile — builder stage (perubahan)
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked \
    --mount=type=secret,id=NEXTAUTH_SECRET \
    --mount=type=secret,id=AUTH_SECRET \
    --mount=type=secret,id=OAUTH_ENCRYPTION_KEY \
    export NEXTAUTH_SECRET=$(cat /run/secrets/NEXTAUTH_SECRET) && \
    export AUTH_SECRET=$(cat /run/secrets/AUTH_SECRET) && \
    export OAUTH_ENCRYPTION_KEY=$(cat /run/secrets/OAUTH_ENCRYPTION_KEY) && \
    npm run build
```

Jika `sharing=locked` belum cukup, tambah explicit cache warm/restore:

```dockerfile
# Sebelum npm run build — restore cache dari previous build layer
RUN --mount=type=bind,from=build-cache,source=/app/.next/cache,target=/app/.next/cache-prev,rw \
    cp -r /app/.next/cache-prev/. /app/.next/cache/ 2>/dev/null || true
```

**Verifikasi**: bandingkan timestamp stage `Build Image` run pertama vs run kedua. Cache hit harus memangkas >50% waktu build.

#### A2: Webpack `parallelism` adaptif

**Masalah**: `next.config.ts:228` hardcode `config.parallelism = 1` saat `!dev`. Jenkins builder container punya 4-8 CPU tapi hanya menggunakan 1 thread untuk webpack compilation.

**Solusi**: Set parallelism berdasarkan memory tersedia, bukan hardcoded:

```ts
// next.config.ts — webpack callback
if (!dev) {
  // package.json build script pakai --max-old-space-size=8192 (8GB heap).
  // Dockerfile ARG NODE_OPTIONS=4096 tapi di-override oleh package.json saat npm run build.
  // parallelism=2 safe dengan 8GB ceiling; parallelism=4 untuk host >=12GB.
  const os = require('os');
  const memMB = Math.floor(os.totalmem() / 1024 / 1024);
  config.parallelism = memMB >= 12288 ? 4 : memMB >= 6144 ? 2 : 1;
}
```

#### A3: Paralelisasi stage Jenkins (Test ∥ Build)

**Masalah**: `Run Unit Tests` jalan sebelum `Build Image`, padahal keduanya independen.

**Solusi**: Jalankan paralel via Jenkins `parallel {}`, gate di akhir sebelum `Deploy to K8s`.

Pipeline baru:

```
Install & Code Quality Check (lint ∥ typecheck)
        ↓
   parallel {
     ├── Run Unit Tests
     └── Build Image (buildx --push)
   }
        ↓
   [GATE: Kedua sukses?]
        ↓ yes                    ↓ no
   Backup Prev Image          Abort deploy
   Database Migration         (image :production tidak di-update)
   Deploy to K8s
   Cleanup
```

**Catatan penting**: Jika Test gagal setelah Build selesai, image `:<IMAGE_VERSION>` sudah ter-push ke registry tapi tag `:production` **tidak** di-update. Tidak ada yang di-deploy ke cluster. Sampah image diterima (cleanup stage sudah ada). Mekanisme `assert_cluster_image_contract` di Jenkinsfile mencegah drift.

Implementasi di Jenkinsfile:

```groovy
stage('Test and Build') {
    parallel {
        stage('Run Unit Tests') {
            steps {
                container('node') {
                    // ... existing test steps ...
                }
            }
        }
        stage('Build Image') {
            steps {
                container('docker') {
                    // ... existing build steps ...
                }
            }
        }
    }
}
```

---

### Fase 2 — Optimize Package Imports (setelah Fase 1 stabil)

**Target**: tambahan -10-20% dari Fase 1

**Perubahan**: tambah `experimental.optimizePackageImports` di `next.config.ts`:

```ts
experimental: {
  serverActions: { bodySizeLimit: "1gb" },
  proxyClientMaxBodySize: "1gb",
  turbopackFileSystemCacheForDev: true,
  optimizePackageImports: [
    'lucide-react',
    'ol',
    'chart.js',
    'react-big-calendar',
    'date-fns',
    '@tanstack/react-query',
    // Firebase: hanya package utama, bukan sub-path (sudah modular)
    'firebase/app',
  ],
},
```

**Risiko**: `optimizePackageImports` stable di Next 16, tapi bisa break import side-effect pada library yang tidak modular. Mitigasi: jalankan `npm run build` lokal dulu, verifikasi build sukses + smoke test sebelum push ke `main`.

**Catatan**: `@whiskeysockets/baileys` sudah di `serverExternalPackages` — tidak perlu di `optimizePackageImports`.

---

## 4. Komponen yang Diubah

| File | Perubahan | Fase | Risk |
|---|---|---|---|
| `Dockerfile` | `sharing=locked` di cache mount | 1 | Rendah |
| `next.config.ts` | `parallelism` adaptif berdasarkan memory | 1 | Rendah |
| `Jenkinsfile` | Restrukturisasi: Test ∥ Build + gate di akhir | 1 | Sedang |
| `next.config.ts` | `experimental.optimizePackageImports` untuk heavy libs | 2 | Rendah-Sedang |

---

## 5. Data Flow Pipeline Baru

```
[push ke main]
      ↓
Branch Guard
      ↓
Validate Registry Configuration
      ↓
Install & Code Quality Check
  (npm ci → prisma:generate → lint ∥ typecheck)
      ↓
  ┌───────────────────────────────┐
  │          parallel             │
  ├─────────────┬─────────────────┤
  ↓             ↓
Run Unit      Build Image
Tests         (buildx --push
              + persist .next/cache
              + registry cache)
  ↓             ↓
  └──────┬───────┘
         ↓
  [GATE: Test pass AND Build verified?]
     ↓ yes               ↓ no
Backup Prev Image     Abort pipeline
Database Migration    (no deploy)
Deploy to K8s
Cleanup
```

---

## 6. Error Handling & Rollback

| Skenario | Behavior | Action |
|---|---|---|
| Build fail | Stage Build Image gagal → pipeline stop. Tag `:production` tidak berubah. | Cluster tetap jalan dengan image lama. Fix commit, re-push. |
| Test fail setelah Build | Gate blok Deploy. Image `:IMAGE_VERSION` ter-push tapi `:production` tidak di-update. | Tidak ada yang di-deploy. Fix test, re-push. |
| Deploy fail | `rollout undo` otomatis per workload (sudah ada di Jenkinsfile). | Monitor `kubectl rollout status`. |
| `.next/cache` corrupt | Build tetap jalan karena Next.js generate ulang cache jika invalid. | Tidak ada impact fungsional, hanya lebih lambat. |
| `parallelism` terlalu tinggi | OOM di builder container → `npm run build` gagal dengan SIGKILL. | Turunkan threshold di `next.config.ts`, commit fix. |

---

## 7. Verifikasi & Testing

### Pre-deploy (lokal — Fase 1)
- Jalankan `npm run build` lokal setelah ubah `next.config.ts` → verifikasi exit 0.
- Cek output `next build` tidak ada error baru.

### Pre-deploy (lokal — Fase 2)
- Jalankan `npm run build` lokal dengan `optimizePackageImports` aktif.
- Smoke test 3 route kritis di browser lokal (`npm start`): login, dashboard admin, satu halaman dengan chart/map.

### Post-deploy Jenkins
- Bandingkan timestamp stage `Build Image` sebelum vs sesudah (Jenkins build history).
- Target: stage `Build Image` < 8 menit pada cache hit.
- Verifikasi `kubectl rollout status` semua workload (sudah di Jenkinsfile).
- Smoke test production: login, dashboard, satu API module.

---

## 8. Estimasi Waktu Build (Proyeksi)

| Kondisi | Sebelum | Setelah Fase 1 | Setelah Fase 1+2 |
|---|---|---|---|
| Cache miss (first run) | ~25 mnt | ~18 mnt | ~15 mnt |
| Cache hit | ~25 mnt | ~8-10 mnt | ~6-8 mnt |
| Lint+typecheck+test ∥ build | Serial | Paralel | Paralel |

---

## 9. Referensi

- `Dockerfile` — stage builder, cache mount
- `Jenkinsfile` — stage Build Image, Run Unit Tests, deploy flow
- `next.config.ts` — webpack config, experimental features
- `docs/standards/JENKINS_K8S_PIPELINE_STANDARD.md` — pipeline standards
- `docs/CHANGELOG.md` — SOT perubahan

---

*Author: agent*  
*Dibuat: 2026-07-16*
