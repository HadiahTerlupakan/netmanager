# Changelog — Source of Truth

Semua perubahan signifikan pada project ini dicatat di sini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Setiap entry ditulis oleh agent atau developer yang mengerjakan perubahan tersebut.

---

## Tipe Perubahan

| Label | Keterangan |
|-------|-----------|
| `[ADDED]` | Fitur baru, modul baru, endpoint baru |
| `[CHANGED]` | Perubahan pada fitur/modul yang sudah ada (refactor, migrasi pola, update logika) |
| `[FIXED]` | Perbaikan bug atau code smell |
| `[REMOVED]` | Penghapusan fitur, modul, file, atau fungsi |
| `[DEPRECATED]` | Fitur yang ditandai akan dihapus di iterasi berikutnya |
| `[SECURITY]` | Perbaikan celah keamanan |
| `[INFRA]` | Perubahan infrastruktur, CI/CD, Docker, Kubernetes, konfigurasi |
| `[DOCS]` | Perubahan dokumentasi saja |
| `[MIGRATION]` | Migrasi database (Prisma) — wajib mencantumkan nama migration file |

---

## Format Entry

```
### [YYYY-MM-DD] — Judul singkat perubahan

- **Tipe**: [ADDED|CHANGED|FIXED|REMOVED|...]
- **Scope**: `modules/<nama>` | `app/api/<path>` | `lib/` | `infra/` | `docs/`
- **Author**: agent | @<github-username>
- **Deskripsi**: Penjelasan singkat apa yang berubah dan mengapa.
- **Files**: Daftar file utama yang berubah (opsional, untuk perubahan besar)
- **Migration**: Nama file migration Prisma (hanya jika ada perubahan DB)
- **Breaking**: ✅ Ya / ❌ Tidak — apakah ada breaking change
```

---

## [Unreleased]

> Perubahan yang sudah dikerjakan tapi belum di-tag sebagai release.

<!-- Entry baru ditambah DI SINI, di bawah [Unreleased] -->

### [2026-05-15] — Audit P1 batch: race condition, probes, branch routing, storage explicitness

- **Tipe**: [FIXED] [INFRA]
- **Scope**: `Jenkinsfile`, `k8s/staging/`, `k8s/production/`, `k8s/migration-job.yaml`
- **Author**: agent
- **Deskripsi**: Eksekusi 7 P1 issues dari audit komprehensif sebelumnya. Build #618 sudah verified pass setelah P0 fix; P1 ini menutup gap yang tidak menyebabkan hang/security tapi merupakan pre-requisite untuk multi-node migration & supaya error tidak silent.
  - **P1-1 (RACE)**: `sleep 20` setelah apply DB statefulset diganti `kubectl rollout status statefulset/<sts>` untuk 4 DB + redis deployment dengan timeout 180s/120s. Mencegah migration job start sebelum DB ready (silent failure: connection refused yang terlihat seperti migration error).
  - **P1-2 (RELIABILITY)**: `migration-job.yaml` `imagePullPolicy: IfNotPresent` → `Always`. Migration adalah operasi sekali-jalan; harus pakai image yang benar bukan cache lama dari node.
  - **P1-4 (PROBES)**: Tambah `readinessProbe` ke worker (cek `pgrep tsx worker.ts`) & cron (cek `pgrep crond` + `[ -s /etc/crontabs/root ]`) di prod & staging. Sebelumnya pod dianggap ready begitu container start, padahal koneksi DB/Redis mungkin belum established. Worker juga ditambah `livenessProbe`.
  - **P1-5 (STORAGE EXPLICITNESS)**: Semua `volumeClaimTemplates` (4 StatefulSet × 2 env = 8) dan PVC (`netmanager-uploads`, `redis-pvc` × 2 env = 4) ditambah `storageClassName: local-path` eksplisit. Sebelumnya bergantung pada default StorageClass — silent data loss risk kalau cluster di-migrate atau default berubah.
  - **P1-6 (DEDUP)**: Branch routing logic 3-OR (`env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main'`) yang diulang 3 kali di environment block dikonsolidasi ke `env.IS_PRODUCTION` boolean string. Lebih maintainable, single source of truth untuk routing decision.
  - **P1-7 (BACKUP)**: `backup-db.sh` staging diperbaiki: pod name `netmanager-db-0` → `db-netmanager-0` (sebelumnya selalu gagal NotFound), dan loop semua 4 database (netmanager, billing, mitra, radius) bukan cuma 1. `set -euo pipefail` + per-DB error handling agar partial failure tetap report yang gagal tanpa abort.
  - **SKIP P1-3** (pgbouncer image): investigasi menunjukkan `bitnamilegacy/pgbouncer` adalah namespace baru Bitnami untuk FOSS images (bukan deprecated dalam arti broken). Test contract di `tests/ci/pgbouncer-image-safety.test.ts` sengaja pin ke namespace ini. Audit awal saya salah → tidak ada upgrade target valid, biarkan apa adanya.
- **Files**: `Jenkinsfile`, `k8s/migration-job.yaml`, `k8s/staging/{cron,worker,db-statefulset,pvc,backup-db.sh}`, `k8s/production/{cron,worker,db-statefulset,pvc}`
- **Breaking**: ❌ Tidak (semua perubahan backwards-compatible)

### [2026-05-15] — Fix GitHub webhook 401 setelah Jenkins BasicAuth aktif

- **Tipe**: [FIXED]
- **Scope**: `k8s/staging/jenkins-ingress.yaml`
- **Author**: agent
- **Deskripsi**: Setelah `jenkins-auth` middleware di-chain ke ingress utama (P0-2 sebelumnya), GitHub webhook ke `/github-webhook/` mulai gagal dengan `401 Invalid HTTP Response` — push ke staging tidak lagi auto-trigger build. Root cause: BasicAuth juga proteksi endpoint webhook. Solusi: tambah `Ingress` terpisah `jenkins-webhook-ingress` khusus path `/github-webhook/` (lebih specific dari `/`, Traefik prioritize), hanya attach `jenkins-proxy-headers` middleware (no auth). Verified: webhook re-delivery `status: OK, status_code: 200, duration: 1.09s` (sebelumnya 401), root path `/` tetap require auth.
- **Files**: `k8s/staging/jenkins-ingress.yaml`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Audit & perbaikan CI/CD + K8s (P0 batch)

- **Tipe**: [SECURITY] [INFRA] [FIXED]
- **Scope**: `Jenkinsfile`, `k8s/production/`, `k8s/staging/`
- **Author**: agent
- **Deskripsi**: Audit menyeluruh terhadap Jenkinsfile dan K8s manifests setelah build #615 ABORTED akibat hang 53 menit di stage Build Image. Audit mengungkap 8 P0 (security/data-loss) + 14 P1 issues. Eksekusi batch P0 yang aman:
  - **P0-1 (SECURITY)**: `CRON_SECRET` real ter-commit di `secrets.yaml` (prod & staging) — diganti placeholder. **Wajib rotate secret di cluster** karena nilai sudah ter-expose di git history (`aVq3q1c/...` prod, `9z/24ZPhy...` staging).
  - **P0-2 (SECURITY)**: Jenkins ingress hanya pakai `jenkins-proxy-headers` middleware (tidak ada auth). Chain `jenkins-auth` (BasicAuth) sebelum `jenkins-proxy-headers`. Jenkins UI di `jenkins.radpro.id` sekarang ter-protect Traefik BasicAuth.
  - **P0-3 (PERFORMANCE)**: Redis production `cpu limit == request (100m)` → throttling pasti saat spike. Naikkan limit ke 500m untuk burst headroom (konsisten dgn pattern staging).
  - **P0-4 (HANG FIX)**: Stage `Build Image` ditambah `options { timeout(time: 30, unit: 'MINUTES') }`. Mencegah hang 53 menit terulang seperti #615.
  - **P0-5 (HANG FIX)**: Migrasi 3x `docker build` → `docker buildx build --load --progress=plain` + per-invocation `timeout` (1500s/600s/900s). Buildx native BuildKit lebih reliable dari legacy CLI yang rentan session desync.
  - **P0-6 (RESILIENCE)**: `rollout_workload()` di stage Deploy ditambah `kubectl rollout undo` otomatis saat `rollout status` gagal/timeout. Mencegah deployment stuck partial state. Fallback diagnostic (`describe`, `get pods`) untuk manual intervention bila rollback juga gagal.
  - **P0-7 (HYGIENE)**: `.secrets/` cleanup pakai `trap 'rm -rf .secrets' EXIT` di shell block (sebelumnya hanya `rm` di akhir, skip kalau build fail/abort).
  - **P0-8 (RESILIENCE)**: Stage Deploy ditambah `timeout(time: 45, unit: 'MINUTES')`. 4 deployment × rollout status 600s = max 40 menit; 45m adalah upper bound aman.
  - **P0-9 (DEBUGGABILITY)**: Auto-rollback bisa di-skip via env var `DISABLE_AUTO_ROLLBACK=true` saat trigger build. Berguna saat engineer ingin debug pod state setelah deploy gagal.
- **Files**: `Jenkinsfile`, `k8s/production/redis-deployment.yaml`, `k8s/production/secrets.yaml`, `k8s/staging/secrets.yaml`, `k8s/staging/jenkins-ingress.yaml`
- **Breaking**: ❌ Tidak (hanya backwards-compatible fixes)
- **Catatan tindakan manual yang masih diperlukan**:
  - Rotate `CRON_SECRET` di kedua cluster: `kubectl create secret generic netmanager-secrets --from-literal=CRON_SECRET=$(openssl rand -base64 32) --dry-run=client -o yaml | kubectl apply -f -`
  - Apply ulang `jenkins-ingress.yaml` di staging cluster: `kubectl apply -f k8s/staging/jenkins-ingress.yaml -n netmanager-staging`
  - Apply ulang Redis prod deployment + restart: `kubectl rollout restart deployment/netmanager-redis -n netmanager-production`
  - Audit history git untuk secret lain: `git log -S "REPLACE_WITH_REAL_SECRET" --all`
  - **Belum diselesaikan (butuh keputusan strategis)**: P0-RBAC (Jenkins agent permissions), P0-backup (pg_dump ke object storage), 14 P1 issues (race condition `sleep 20`, branch routing, pgbouncer image deprecated, dll).

### [2026-05-15] — Audit & perbaikan dark/light mode (P0 + P1)

- **Tipe**: [FIXED]
- **Scope**: `app/styles/`, `components/ui/`, `components/map/`, `app/403/`, `app/mitra-id/`
- **Author**: agent
- **Deskripsi**: Audit menyeluruh implementasi dark/light mode menemukan beberapa masalah kritis dan menengah, lalu diperbaiki:
  - **P0-1 (kritis)**: Variabel CSS `--color-light-text-secondary`, `--color-light-text-tertiary`, `--color-light-text-placeholder` di-reference oleh 7 selektor di `app/styles/base.css` (opacity helpers, `.text-secondary`, `.text-tertiary`, `bg-opacity-20`) tetapi **tidak pernah didefinisikan** di `variables.css`. Akibatnya `rgb()` resolve ke nilai invalid → fallback ke `currentColor`/`inherit` saat light mode. Tiga variabel ditambahkan di scope `:root` (default) dan `.light` agar tersedia baik saat SSR maupun setelah class theme aktif.
  - **P0-2 (kritis)**: `components/ui/select.tsx` & `components/ui/badge.tsx` hardcode `bg-white`, `text-gray-900`, `border-gray-300`, `bg-blue-50` tanpa pasangan `dark:`. Khusus `border` dan `bg-blue-*` tidak ter-cover oleh CSS safety net, jadi tampak rusak di dark mode. Dimigrasi ke design tokens (`bg-surface`, `text-neutral-text-strong`, `border-border`, `bg-primary/10`) plus dark variants eksplisit untuk badge variants (success/warning/error).
  - **P1-1**: `app/403/page.tsx` belum punya `dark:` variant — ditambahkan untuk container, card, heading, dan body text.
  - **P1-2**: `components/map/NetworkMap.tsx` legend pakai `bg-white text-black` literal → diganti pasangan light/dark token.
  - **P2-1**: 9 file masih punya `bg-white` tanpa `dark:` counterpart, namun semua sudah ter-cover oleh CSS safety net di `base.css:325` (re-route `bg-white` → `--color-bg-surface` saat `.dark`). `app/mitra-id/layout.tsx` di-fix manual karena pakai `bg-gray-50` di container utama. Sisanya intentional (translucent overlay, switch thumb, modal di backdrop berwarna).
  - **P2-2**: Worktree `.claude/worktrees/agent-a020ac873868856a7/` ditemukan memuat 5 commit ahead + 9 file uncommitted. **Tidak dihapus** — perlu konfirmasi user untuk menghindari kehilangan kerja in-progress.
- **Files**: `app/styles/variables.css`, `components/ui/select.tsx`, `components/ui/badge.tsx`, `app/403/page.tsx`, `components/map/NetworkMap.tsx`, `app/mitra-id/layout.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Fix Jenkins stage "Backup Previous Env Image" timeout 10 menit

- **Tipe**: [INFRA]
- **Scope**: `infra/` (`Jenkinsfile`)
- **Author**: agent
- **Deskripsi**: Stage `Backup Previous Env Image` ABORTED karena melampaui stage timeout 10 menit saat tag `:staging`/`:production` belum ada di registry. Implementasi lama melakukan `docker pull → docker tag → docker push` dengan 3× retry × `timeout 120` per image × 3 image (app/cron/radius) = worst case 18 menit, jelas melebihi batas. Diganti menjadi: probe via `docker manifest inspect` (timeout 30s, fetch manifest kecil saja) untuk cek keberadaan tag, lalu retag server-side via `docker buildx imagetools create --tag <prev> <env>` (timeout 60s, tidak men-download/upload layer apapun). Jika manifest tidak ada → log "backup skipped" dan lanjut ke image berikutnya tanpa membuang waktu. Stage timeout juga dikecilkan dari 10 menit → 5 menit karena operasi server-side jauh lebih cepat. Fix root cause, bukan symptom: menghilangkan layer pull/push yang memang tidak diperlukan untuk operasi retag.
- **Files**: `Jenkinsfile`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Fix dark mode inconsistency & light mode invisible text

- **Tipe**: [FIXED]
- **Scope**: `app/styles/base.css`
- **Author**: agent
- **Deskripsi**: Perbaikan masalah tema yang menyebabkan: (1) di dark mode banyak komponen lama tetap tampil dengan card putih (`bg-white`, `bg-gray-50`) dan border terang (`border-gray-200`) karena dipakai tanpa varian `dark:`; (2) di light mode teks `text-gray-300/400` nyaris invisible di atas `bg-white` karena kontrasnya rendah. Daripada memodifikasi 387+ file, ditambahkan **theme safety net** di `base.css` yang me-route kelas Tailwind palette mentah ke design token via CSS variable saat `.dark` aktif, dan menaikkan kontras teks pucat saat `.light` aktif. Selektor menggunakan `:where()` agar specificity tetap 0,1,0 sehingga `dark:bg-*`/`dark:text-*` di komponen tetap menang. Cakupan: `bg-white/gray-50/100/200`, `border-gray-100..300`, `text-gray-500..900` (dark remap), `text-gray-100..400` (light boost), beserta varian `hover:` dan `divide-`.
- **Files**: `app/styles/base.css`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Fix npm run check: module boundary, build error, test fixtures

- **Tipe**: [FIXED]
- **Scope**: `modules/integrations`, `modules/finance`, `modules/investor`, `tests/`
- **Author**: agent
- **Deskripsi**: Tutup semua warning/error dari `npm run check` ke akar masalah. (1) Architecture test menolak `modules/investor` deep-import `@/modules/finance/repositories/PaymentRepository` — solusi: buat `InvestorPaymentBridgeService` di `modules/finance/services` (legitimate cross-module bridge via public API), update `InvestorPayoutAdminService` & `InvestorPortalPayoutService` consume bridge bukan repository langsung. (2) Hapus repository exports dari `modules/investor/index.ts` (architecture rule "no repo in public API"). (3) **Build error pre-existing**: `modules/integrations/client.ts` re-export `DUITKU_DEFAULT_FEES` dari `@/modules/finance` (root) — load chain ke `BillingScheduleService → bullmq → fs/dgram` di client bundle. Solusi: pakai `./constants/DuitkuDefaults` lokal yang sudah ada di module integrations. (4) Update test mock paths setelah module split (`@/modules/finance/services/InvestorAdminService` → `@/modules/investor`) di `tests/api/admin-investors-route.test.ts` & `admin-investors-id-route.test.ts`. (5) Update assertions untuk extra `actorId` argument di `createInvestor/updateInvestorById/toggleInvestorActive/deleteInvestorById`. (6) Update architecture baseline (`dependencyInversionBaseline`) ke path baru `modules/investor/**`.
- **Files**: `modules/finance/services/InvestorPaymentBridgeService.ts`, `modules/finance/index.ts`, `modules/investor/services/InvestorPayoutAdminService.ts`, `modules/investor/services/InvestorPortalPayoutService.ts`, `modules/investor/index.ts`, `modules/integrations/client.ts`, `tests/architecture/module-public-api.test.ts`, `tests/api/admin-investors-route.test.ts`, `tests/api/admin-investors-id-route.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Module split: extract modules/investor/ + share RouteServiceError

- **Tipe**: [CHANGED]
- **Scope**: `modules/investor/`, `modules/finance/`, `lib/api/`, `app/api/investor/`, `app/api/admin/investors/`
- **Author**: agent
- **Deskripsi**: Pisah domain investor dari `modules/finance/` jadi modul tersendiri. Buat `modules/investor/` dengan struktur lengkap (services, repositories, index public API). Pindahkan 5 service (`InvestorAdminService`, `InvestorPortalAuthService`, `InvestorPortalDashboardService`, `InvestorPortalProjectService`, `InvestorPortalPayoutService`) + 3 helper (`investor-portal-customer-metrics`, `-dashboard`, `-project`) + 2 repository (`InvestorRepository`, `InvestorPortalRepository`). Tambah `InvestorPayoutAdminService` baru yang absorb tiga method investor-related (`getInvestorPayouts`/`createInvestorPayout`/`getInvestorDetail`) dari `ManualPaymentAdminRouteService` — service finance sekarang kembali fokus ke pelanggan/payment. Pindahkan `RouteServiceError` ke `lib/api/route-service-error.ts` (cross-cutting infra) dengan re-export shim di lokasi lama untuk kompatibilitas internal finance. Update 11 consumer file ke `@/modules/investor`. `RabInvestorRepository` tetap di finance karena merepresentasikan relasi RAB project, bukan entity investor.
- **Files**: `modules/investor/index.ts`, `modules/investor/services/{InvestorAdminService,InvestorPortalAuthService,InvestorPortalDashboardService,InvestorPortalProjectService,InvestorPortalPayoutService,InvestorPayoutAdminService,investor-portal-customer-metrics.helpers,investor-portal-dashboard.helpers,investor-portal-project.helpers}.ts`, `modules/investor/repositories/{InvestorRepository,InvestorPortalRepository}.ts`, `lib/api/route-service-error.ts`, `modules/finance/index.ts`, `modules/finance/repositories/index.ts`, `modules/finance/services/ManualPaymentAdminRouteService.ts`, `modules/finance/services/RouteServiceError.ts` (jadi shim), `modules/integrations/services/MixRadiusInvestorSiteService.ts`, `app/api/admin/investors/route.ts`, `app/api/admin/investors/[id]/{route,detail/route,payouts/route}.ts`, `app/api/investor/{auth/login,dashboard,projects/route,projects/[id]/route,payouts/route}.ts`, `app/api/integrations/mixradius/investor-sites/[id]/route.ts`
- **Breaking**: ❌ Tidak (consumer route sudah di-update, file lama dihapus, RouteServiceError shim mempertahankan import internal)

### [2026-05-15] — Optimisasi investor portal & cleanup site lookup mitra

- **Tipe**: [CHANGED]
- **Scope**: `modules/integrations`, `modules/finance`, `modules/mitra`, `modules/roles`
- **Author**: agent
- **Deskripsi**: (1) Tambah inflight dedup di `MixRadiusService.fetchCustomersPPP` agar concurrent call (mis. dashboard + projects investor saat first paint) tidak fetch dua kali sebelum cache 15 menit warm. (2) Tambah snapshot memoization 60 detik di `investor-portal-customer-metrics.helpers.fetchMixRadiusCustomers` untuk shared snapshot lintas kompiler dashboard/projects/payout dalam jendela request yang sama. (3) Pindahkan `findSiteNameById` dari `mitra.stats.helpers` ke `SiteService.getSiteNameById` di `modules/roles` + tambah `findNameById` di `ISiteRepository` & `SiteRepository` (lookup ringan tanpa `_count` join). Hapus query `prisma.sites.findUnique` langsung dari modul mitra — sesuai aturan modul boundary.
- **Files**: `modules/integrations/services/MixRadiusService.ts`, `modules/finance/services/investor-portal-customer-metrics.helpers.ts`, `modules/roles/domain/ports/ISiteRepository.ts`, `modules/roles/repositories/SiteRepository.ts`, `modules/roles/services/SiteService.ts`, `modules/mitra/repositories/MitraRepository.stats.helpers.ts`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Sprint 2-3 review fitur mitra & investor (consistency + cleanup)

- **Tipe**: [CHANGED]
- **Scope**: `app/api/admin/mitra/`, `app/api/mobile/mitra/`, `modules/mitra/`, `modules/finance/`, `lib/validations/`, `app/admin/mitra/`
- **Author**: agent
- **Deskripsi**: Lima perbaikan MEDIUM/LOW dari hasil review. (1) Buat `lib/validations/mitra.ts` — schema Zod terpusat (`createMitraSchema`, `updateMitraSchema`, `withdrawRequestSchema`, `syncCommissionSchema`, `rejectWithdrawSchema`, `walletAdjustmentSchema`). (2) Migrasi 6 route admin mitra (`route.ts`, `[id]/route.ts`, `[id]/wallet/route.ts`, `[id]/face-verifications/route.ts`, `withdrawals/route.ts`, `withdrawals/[id]/route.ts`, `sync-commissions/route.ts`) dan tambah Zod validation di `mobile/mitra/withdraw` agar pola handler konsisten dengan investor (auth + permissions + schema otomatis via `createHandler`). (3) Tambah audit log `logActivitySafe()` di `InvestorAdminService.{createInvestor, updateInvestorById, toggleInvestorActive, deleteInvestorById}`; routes investor admin meneruskan `actorId` dari session. (4) Hapus `app/api/admin/mitra/[id]/route.helpers.ts` — proxy wrapper sudah tidak dipakai setelah migrasi. (5) Refactor `MitraDTO` jadi sub-DTO komposisi (`MitraIdentityFields`, `MitraEmploymentFields`, `MitraCommissionFields`, `MitraBankFields`, `MitraKycFields`). (6) Align permission UI mitra: `users:create/update/delete` → `mitra:create/update/delete` di `MitraListClient.tsx`, `users:update` → `withdrawals:update` di `WithdrawalsClient.tsx`. Bonus fix: `MitraFilters.employeeType` salah ditipe sebagai Prisma `EmployeeType` (yang hanya berisi `KARYAWAN`) — diganti ke `MitraType`.
- **Files**: `lib/validations/mitra.ts`, `app/api/admin/mitra/route.ts`, `app/api/admin/mitra/[id]/route.ts`, `app/api/admin/mitra/[id]/wallet/route.ts`, `app/api/admin/mitra/[id]/face-verifications/route.ts`, `app/api/admin/mitra/withdrawals/route.ts`, `app/api/admin/mitra/withdrawals/[id]/route.ts`, `app/api/admin/mitra/sync-commissions/route.ts`, `app/api/mobile/mitra/withdraw/route.ts`, `app/api/admin/investors/route.ts`, `app/api/admin/investors/[id]/route.ts`, `modules/finance/services/InvestorAdminService.ts`, `modules/mitra/dto/MitraDTO.ts`, `app/admin/mitra/MitraListClient.tsx`, `app/admin/mitra/withdrawals/WithdrawalsClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Sprint 1 review fitur mitra & investor (Security + Performance)

- **Tipe**: [SECURITY]
- **Scope**: `modules/finance`, `modules/mitra`, `app/api/investor/`, `app/api/admin/mitra/`, `lib/auth/`
- **Author**: agent
- **Deskripsi**: Tiga perbaikan HIGH severity hasil review fitur mitra & investor. (1) Konsolidasi JWT auth investor: buat `lib/auth/investor-auth.ts` (`getInvestorAuth`, `requireInvestorAuth`) dan refactor 5 route handler (`app/api/investor/{auth/session,dashboard,projects,projects/[id],payouts}/route.ts`) yang sebelumnya mengulang `jwtVerify` + `getSecret()` manual — business logic auth kini terpusat dan type-safe. (2) Tenant isolation defense-in-depth: `InvestorPortalRepository` + `InvestorPortalDashboardService` + `InvestorPortalProjectService` sekarang menerima `tenantId` dari token investor dan memfilter `rabInvestor.investor.tenantId` di tiga query (dashboard, list, detail). (3) Performance fix scope check withdrawal: tambah `IMitraWithdrawRepository.isWithdrawInScope` (single-row indexed lookup) dan ganti brute-force fetch 1000 baris di `app/api/admin/mitra/withdrawals/[id]/route.ts` yang sebelumnya loop di memory.
- **Files**: `lib/auth/investor-auth.ts`, `app/api/investor/auth/session/route.ts`, `app/api/investor/dashboard/route.ts`, `app/api/investor/projects/route.ts`, `app/api/investor/projects/[id]/route.ts`, `app/api/investor/payouts/route.ts`, `modules/finance/repositories/InvestorPortalRepository.ts`, `modules/finance/services/InvestorPortalDashboardService.ts`, `modules/finance/services/InvestorPortalProjectService.ts`, `modules/mitra/domain/ports/IMitraWithdrawRepository.ts`, `modules/mitra/repositories/MitraWithdrawRepository.ts`, `modules/mitra/services/MitraWithdrawService.ts`, `app/api/admin/mitra/withdrawals/[id]/route.ts`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Fix 22+6 bug fungsionalitas modul Integrasi

- **Tipe**: [FIXED]
- **Scope**: `modules/integrations`, `app/api/integrations/`, `app/admin/integrations/`
- **Author**: agent
- **Deskripsi**: Fix total 28 bugs across 3 phases. Phase 1: 5 CRITICAL (account create broken, profit-loss render kosong, ROI tracking 0, RAB double-approve, expense data tidak loaded). Phase 1.5: 5 HIGH (isDefault/isActive mapping, numeric sort, redundant fetch, double-fetch invoice counts, siteId ignored). Phase 2: 12 MEDIUM (double-deduction fee, date filter, permission mismatch, invoice status, tenant isolation, isolir filter, groups isActive, PUT validation). Phase 3: 6 remaining (clearCache re-fetch, monthly breakdown date filter, accounts PUT/DELETE validation, tooltip formula, RABView stale state).
- **Breaking**: ❌ Tidak

### [2026-05-15] — Security & architecture review modul Integrasi

- **Tipe**: [SECURITY]
- **Scope**: `modules/integrations`, `app/api/integrations/`, `app/admin/integrations/`
- **Author**: agent
- **Deskripsi**: Full review dan perbaikan modul Integrasi (8 menu). Fix 5 CRITICAL security issues (missing auth di profit-loss page, hardcoded credentials di test route, unauthenticated market-price endpoint, direct Prisma access di 2 service). Fix 6 HIGH architecture issues (inconsistent auth pattern, cross-module coupling, misplaced Duitku constants, dependency rule violation di mapper, DRY violations). Fix MEDIUM issues (Zod validation, dead code removal, file consolidation).
- **Files**: `app/admin/integrations/mixradius/profit-loss/page.tsx`, `app/admin/integrations/mixradius/profit-loss/ProfitLossClient.tsx`, `app/api/integrations/mixradius/test/route.ts`, `app/api/integrations/market-price/route-handlers-impl.ts`, `modules/integrations/services/MixRadiusPageService.ts`, `modules/integrations/services/MixRadiusFeeSettingsService.ts`, `modules/integrations/repositories/SettingsRepository.ts`, `modules/integrations/domain/ports/ISettingsRepository.ts`, `modules/integrations/mappers/IntegrationMapper.ts`, `modules/integrations/services/mixradius-customer-errors.ts`, `modules/integrations/services/mixradius-topology-client.ts`, `modules/integrations/services/mixradius-sync-helpers.ts`, `modules/integrations/validators/MixRadiusConfigValidator.ts`, `modules/finance/constants/DuitkuDefaults.ts`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Fix tenant isolation gaps di raw SQL queries & marketing module

- **Tipe**: [SECURITY]
- **Scope**: `modules/pelanggan`, `modules/work-order`, `modules/finance`, `modules/marketing`
- **Author**: agent
- **Deskripsi**: Audit dan fix tenant isolation pada raw SQL queries yang bypass Prisma Extension.
  - **CRITICAL**: `findEligibleForBilling` (pelanggan) — tambah optional `tenantId` filter dan include `tenantId` di SELECT output
  - **MEDIUM**: `appendUsedMaterialsToWorkOrder` (work-order) — tambah `AND "tenantId"` di WHERE clause
  - **MEDIUM**: `appendReturnedMaterials` (work-order) — tambah `AND "tenantId"` di WHERE clause
  - **MEDIUM**: `consumeSaldoKredit` (finance) — tambah tenant filter di SELECT FOR UPDATE
  - **MEDIUM**: `getTechnicalDepartmentId` (marketing) — hapus fallback tanpa tenant filter, return undefined jika siteId/tenantId tidak tersedia
  - **LOW**: Hapus dead code `canAccessCanvasingMobile` dari CanvasingAccessService
- **Files**: `modules/pelanggan/repositories/pelanggan-repository-automation.helpers.ts`,
  `modules/pelanggan/repositories/PelangganFinanceRepository.ts`,
  `modules/work-order/repositories/work-order-material.helpers.ts`,
  `modules/work-order/services/work-order-mobile-material-return.ts`,
  `modules/finance/services/FinanceRepositoryFacade.ts`,
  `modules/marketing/services/canvasing.service.helpers.ts`,
  `modules/marketing/services/CanvasingAccessService.ts`
- **Breaking**: ❌ Tidak

### [2026-05-14] — Refactor arsitektur modul Kehadiran (Phase 1-7)

- **Tipe**: [CHANGED]
- **Scope**: `modules/attendance/services`, `modules/attendance/repositories`
- **Author**: agent
- **Deskripsi**: Refactor 7 architectural issues tersisa dari deep review:
  - **Phase 1**: Replace mutable singletons dengan IIFE lazy getter (LeaveService, MobileCheckInRouteService)
  - **Phase 2**: Drop interface intersection `IRepo & ConcreteRepo` di LeaveService/LeaveLifecycleService
  - **Phase 3**: Split AttendanceQueryService.ts (4 class) ke 4 file terpisah (SRP)
  - **Phase 4**: Decouple MobileLeaveRequestService dari NextResponse — return typed result objects
  - **Phase 5**: Extract AdminScopeResolver utility, refactor 5 service hapus auth logic dari service layer
  - **Phase 6**: Pindah direct Prisma ke repository layer (groupByStatus, NoCheckoutRepair, LeaveReminder, MobileHistory)
  - **Phase 7**: Type `IAttendanceRepository` port — hapus `any`, gunakan proper Prisma types
- **Files**: 20+ files di modules/attendance/services, repositories, dan domain/ports
- **Breaking**: ❌ Tidak

### [2026-05-14] — Tambah AdminScopeResolver dan refactor 5 service

- **Tipe**: [CHANGED]
- **Scope**: `modules/attendance/services`
- **Author**: agent
- **Deskripsi**: Ekstrak pola resolusi scope admin (site/department restriction) ke utility
  `AdminScopeResolver.resolveAdminScope`. Refactor 5 service untuk menggunakan utility ini:
  `AdminAttendanceFilterService`, `AdminAttendanceDetailRouteService`,
  `AdminAttendanceRouteService`, `AdminLocationRouteService`, `AdminLeaveRouteService`.
  Hapus direct `prisma.user.findUnique` dari service layer, ganti dengan `UserLookupService`
  via resolver. Tidak ada perubahan behavior.
- **Files**: `modules/attendance/services/AdminScopeResolver.ts` (baru),
  `modules/attendance/services/AdminAttendanceFilterService.ts`,
  `modules/attendance/services/AdminAttendanceDetailRouteService.ts`,
  `modules/attendance/services/AdminAttendanceRouteService.ts`,
  `modules/attendance/services/AdminLocationRouteService.ts`,
  `modules/attendance/services/AdminLeaveRouteService.ts`
- **Breaking**: ❌ Tidak

### [2026-05-14] — Deep review & fix 34 issues modul Kehadiran

- **Tipe**: [FIXED] / [SECURITY] / [CHANGED]
- **Scope**: `modules/attendance`, `modules/shift`, `modules/overtime`, `app/api/cron/`
- **Author**: agent
- **Deskripsi**: Review mendalam seluruh modul Kehadiran (43+ fitur). Perbaikan mencakup:
  - **SECURITY**: Fix CRON_SECRET bypass di 2 cron routes, tambah auth check di attendance settings
  - **CRITICAL**: Tambah tenant isolation di reminder queries, fix timezone bug (server local → tenant TZ)
  - **HIGH**: Fix race condition auto-reject (transaction), fix orchestrator parallel race (sequential),
    fix N+1 query (tenant settings cache), fix geofence bypass (user not found), safety limit pagination
  - **MEDIUM**: Tambah cron lock di 3 routes, fix orchestrator timezone, hapus sync-on-read,
    pindah direct Prisma ke repository, fix error message leak, fix location data loss
  - **LOW**: Hapus dead code (3 services), hapus empty stubs (shift module), fix silent error swallow,
    fix dead ternary, fix magic string sentinel
- **Files**: 20+ files across attendance/shift/overtime modules dan cron routes
- **Breaking**: ❌ Tidak

### [2026-05-14] — Fix 12 MINOR issues (M1-M12)

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`, `modules/notification`, `lib/event-bus`, `app/admin`
- **Author**: agent
- **Deskripsi**: Batch fix 9 MINOR issues + 3 yang sebelumnya di-skip: (M2) Date.now() consistency di ProrateRepository; (M3) test assert error.code typed; (M4) komentar INVOICE_PAID 3 handler; (M6) findUnresolved terima tenantId filter; (M7) ganti alert() dengan error banner; (M8) INVOICE_PAID metadata priority CRITICAL; (M9) EventBus singleton persist di production; (M10) formatDateId manual tanpa locale dependency; (M11) fetch error ditampilkan ke admin; (M1) consumeSaldoKredit pindah ke FinanceRepositoryFacade; (M5) EmailService hapus dep ke AttendanceSettingsService, query settings langsung; (M12) komentar eksplisit handler best-effort.
- **Breaking**: ❌ Tidak

### [2026-05-14] — Fix 13 IMPORTANT issues dari comprehensive review

- **Tipe**: [FIXED]
- **Scope**: `modules/network`, `modules/notification`, `modules/payment-gateway`, `lib/event-bus`, `app/admin`
- **Author**: agent
- **Deskripsi**: Batch fix 13 IMPORTANT issues (I1-I14 minus I4 yang sudah fix di B9). Termasuk: (I13) wrap updateSyncStatus di .catch supaya error asli tidak hilang; (I2) tenantId required di CUSTOMER_DELETED handler; (I12) hapus double setPagination di goToPage; (I14) pass dedupeKey saat retry DLQ; (I1) CUSTOMER_UPDATED persistent supaya masuk outbox; (I5) hapus PaymentStatusUpdater dead code; (I10) PROFILE_PPP_UPDATED partial fail tidak throw seluruh batch; (I6) markAsProcessed pindah ke dalam transaction; (I7) PACKAGE_CHANGED notification handler + template; (I8) PushRetryQueue detect DeviceNotRegistered; (I9) retention policy cron cleanup; (I11) prorate log endpoint; (I3) test handleInvoicePaid handlers.
- **Files**: 15+ file di modules/network, modules/notification, modules/payment-gateway, lib/event-bus, app/admin, app/api/cron, tests/
- **Breaking**: ❌ Tidak

### [2026-05-14] — Apply timingSafeCompare ke 6 production provider + hapus legacy [B9]

- **Tipe**: [SECURITY]
- **Scope**: `modules/payment-gateway`
- **Author**: agent
- **Deskripsi**: CRITICAL FIX — commit 7b6e2bc74 sebelumnya apply timing-safe ke folder legacy yang masih ada (modules/finance/services/payment-gateway/providers/). Production providers di modules/payment-gateway/services/providers/ tetap pakai === untuk signature comparison. Fix: buat signature-compare.helpers.ts di production path (SHA-256 normalize supaya length mismatch tidak bocor), apply timingSafeCompare ke BRI/DANA/Midtrans/Duitku/Moota/Tripay. Hapus seluruh folder legacy (24 file dead code). Hapus dead field isProduction di MootaProvider.
- **Files**: `modules/payment-gateway/services/providers/signature-compare.helpers.ts` (new), 6 provider files, `modules/finance/services/payment-gateway/` (deleted)
- **Breaking**: ❌ Tidak

### [2026-05-14] — Propagate tenantId ke EmailDeliveryLog [B10]

- **Tipe**: [FIXED]
- **Scope**: `modules/notification`
- **Author**: agent
- **Deskripsi**: CRITICAL FIX — EmailDeliveryLog selalu tersimpan dengan tenantId=null karena EmailService.sendEmail tidak menerima tenantId. Multi-tenant data leak: admin tenant A bisa lihat email tenant B. Fix: tambah tenantId ke SendEmailParams, propagate dari NotificationDispatcher via contact.tenantId.
- **Files**: `modules/notification/services/email-service.ts`, `modules/notification/services/NotificationDispatcher.ts`
- **Breaking**: ❌ Tidak

### [2026-05-14] — Guard prorateOption di NEXT_CYCLE + UI disable [B11]

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`, `app/admin/pelanggan`
- **Author**: agent
- **Deskripsi**: CRITICAL FIX — handleNextCycle abaikan prorateOption (admin pilih PRORATE_CHARGE + NEXT_CYCLE → tidak ada invoice prorate, silent revenue loss). Fix: log warning eksplisit + UI disable dropdown prorate saat NEXT_CYCLE dipilih.
- **Files**: `modules/finance/services/InvoiceProrateService.ts`, `app/admin/pelanggan/ppp/components/package/PppClientPackageChangeSection.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-14] — Atomic consumeSaldoKredit via SELECT FOR UPDATE [B12]

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: CRITICAL FIX — consumeSaldoKredit pakai read-then-write (TOCTOU) yang rentan race condition. Dua billing job paralel bisa baca saldo sama lalu keduanya berhasil decrement. Fix: interactive $transaction + SELECT FOR UPDATE — row lock cegah concurrent read.
- **Files**: `modules/finance/services/BillingInvoiceCreationService.ts`
- **Breaking**: ❌ Tidak

### [2026-05-14] — missing-package outcome harus throw [B13]

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: CRITICAL FIX — PendingPackageApplier return "missing-package" (silent) setelah DB update berhasil → MikroTik tidak tahu paket berubah. Fix: throw Error supaya BullMQ retry. Pelanggan yang bayar paket baru sekarang dijamin eventually sync ke router.
- **Files**: `modules/finance/services/PendingPackageApplierService.ts`
- **Breaking**: ❌ Tidak

### [2026-05-14] — Comprehensive review 43 commit + dokumentasi temuan

- **Tipe**: [DOCS]
- **Scope**: `docs/reports/`
- **Author**: agent
- **Deskripsi**: Review menyeluruh 43 commit (B1-B8 + Phase 1-9) via 4 paralel reviewer (1 internal + 3 subagent). Hasil: 5 CRITICAL verified (security fix di-apply ke folder legacy, EmailDeliveryLog tanpa tenantId, NEXT_CYCLE abaikan prorate, TOCTOU saldoKredit, missing-package silent partial failure), 14 IMPORTANT, 12 MINOR, 2 dismissed false positive. Output sebagai SOT untuk action plan B9-B13.
- **Files**: `docs/reports/COMPREHENSIVE_REVIEW_43_COMMITS_2026-05-14.md`
- **Breaking**: ❌ Tidak

### [2026-05-14] — InvoiceProrateService depend on IProrateRepository port [B8/A2]

- **Tipe**: [CHANGED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: Refactor InvoiceProrateService supaya patuh Clean Architecture dependency rule — service depend on abstraction (IProrateRepository), bukan Prisma client langsung. Buat port baru di `domain/ports/` + ProrateRepository implementasi default di `repositories/`. Constructor terima IProrateRepository (default new ProrateRepository) untuk dependency injection. Test diperbarui: mock repository alih-alih mock dua Prisma client. Membereskan A2 dari review komprehensif yang sebelumnya di-defer di B3.
- **Files**: `modules/finance/domain/ports/IProrateRepository.ts` (new), `modules/finance/repositories/ProrateRepository.ts` (new), `modules/finance/services/InvoiceProrateService.ts`, `tests/modules/finance/services/InvoiceProrateService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-14] — Idempotency NotificationDispatcher via Redis SETNX [B7]

- **Tipe**: [ADDED]
- **Scope**: `modules/notification`
- **Author**: agent
- **Deskripsi**: Cegah double-send notifikasi saat BullMQ retry job sama. NotificationDispatchInput tambah field opsional `dedupeKey`. Sebelum dispatch, SETNX di Redis dengan key `notif-dedupe:<dedupeKey>` TTL 600 detik. Fail-open kalau Redis error supaya outage Redis tidak block notifikasi. Handler customer-notification + invoice-notification pass `dedupeKey: ${eventName}:${job.id}` — BullMQ pertahankan job.id stabil antar retry.
- **Files**: `modules/notification/services/NotificationDispatcher.ts`, `modules/notification/services/event-handlers/customer-notification.handler.ts`, `modules/notification/services/event-handlers/invoice-notification.handler.ts`
- **Breaking**: ❌ Tidak

### [2026-05-14] — Extract shared table footer + state rows untuk admin notifikasi [B6]

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/notifications`
- **Author**: agent
- **Deskripsi**: Dedup duplikasi struktur tabel di DeadLetterClient + EmailLogsClient. Pindahkan footer pagination, loading row, dan empty state row ke `_components/` kolokal. Komponen baru: TablePaginationFooter, TableLoadingRow, TableEmptyRow. Pagination state interface diunifikasi via type alias PaginationState.
- **Files**: `app/admin/notifications/_components/TablePaginationFooter.tsx` (new), `app/admin/notifications/_components/TableStateRows.tsx` (new), `app/admin/notifications/dead-letter/DeadLetterClient.tsx`, `app/admin/notifications/email-logs/EmailLogsClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-14] — UI bug fixes admin notifikasi + edit pelanggan [B5]

- **Tipe**: [FIXED]
- **Scope**: `app/admin`
- **Author**: agent
- **Deskripsi**: Tiga UI bug fix: (C3) NotificationHistoryClient tambah AbortController + manual refresh + lastFetchedAt timestamp; (C6) DeadLetterClient re-fetch full state setelah retry/resolve (race-safe) + AbortController via useRef + Fragment dengan key; (C7) PppEditClient computeIsDowngrade kembalikan null saat hargaPakets belum dimuat, parent render guard tampilkan badge loading alih-alih "Upgrade" salah.
- **Files**: `app/admin/pelanggan/ppp/[id]/notification-history/NotificationHistoryClient.tsx`, `app/admin/notifications/dead-letter/DeadLetterClient.tsx`, `app/admin/pelanggan/ppp/[id]/edit/PppEditClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-14] — Clean module boundaries event-bus + dedup requireString [B4]

- **Tipe**: [CHANGED]
- **Scope**: `lib/event-bus`, `modules/finance`, `modules/network`, `modules/notification`, `modules/pelanggan`
- **Author**: agent
- **Deskripsi**: Tiga refactor terkait event handler. (A1) Pisah inline INVOICE_PAID handler di lib/event-bus/event-handlers.ts ke 2 module owner: invoice-paid-billing.handler di finance + invoice-paid-activation.handler di pelanggan. (A3) Hilangkan cross-module direct repo access — network handler pakai getPelangganService().updateSyncStatus() via public API; pelanggan handler pakai FinanceRepositoryFacade.countUnpaidInvoicesForPelanggan() (method baru). PelangganService tambah method updateSyncStatus delegasi ke repository. (Q1) Dedup requireString jadi requirePayloadString di lib/event-bus/payload-helpers.ts. Architectural test module-public-api kembali pass 33/33.
- **Files**: `lib/event-bus/event-handlers.ts`, `lib/event-bus/payload-helpers.ts` (new), `modules/finance/services/event-handlers/invoice-paid-billing.handler.ts` (new), `modules/pelanggan/services/event-handlers/invoice-paid-activation.handler.ts` (new), 6 handler refactor pakai requirePayloadString, public API index.ts setiap module
- **Breaking**: ❌ Tidak

### [2026-05-14] — InvoiceProrateService refactor + saldoKredit consume [B3]

- **Tipe**: [CHANGED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: Refactor InvoiceProrateService: konstanta MS_PER_DAY/PRORATE_INVOICE_DUE_DAYS/DEFAULT_PPN_PERCENTAGE menggantikan magic number, InvoiceProrateError dengan typed code (PELANGGAN_NOT_FOUND/PACKAGE_NOT_FOUND), extract calculateProratedAmount sebagai pure function. BillingInvoiceCreationService: konsumsi saldoKreditRupiah saat invoice baru dibuat (sebelumnya silently grew tanpa pernah dipakai), optimistic decrement via updateMany WHERE >= apply (race-safe), apply ke discountAmount, compensating action increment kembali bila invoice gagal dibuat.
- **Files**: `modules/finance/services/InvoiceProrateService.ts`, `modules/finance/services/BillingInvoiceCreationService.ts`, `tests/modules/finance/services/BillingInvoiceCreationService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-14] — Atomic optimistic update PendingPackageApplier [B2]

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: Cegah TOCTOU race antara findMany dan update yang bisa mengakibatkan emit PACKAGE_CHANGED dengan oldPackageId salah atau override IMMEDIATE upgrade dari admin. Pakai prisma.pelanggan.updateMany dengan WHERE strict (id + hargaPaketId snapshot + pendingPackageId snapshot + applyAt window). Kalau count===0 → state berubah konkuren, skip sebagai 'stale' bukan 'failed'. Fetch package context setelah update sukses; oldPackageId valid karena updateMany match exactly nilai di DB. Tambah parameter optional applyAtBefore (default new Date()) untuk testability.
- **Files**: `modules/finance/services/PendingPackageApplierService.ts`, `tests/modules/finance/services/PendingPackageApplierService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-14] — Tenant isolation + permission + IDOR guard 5 endpoint admin notifikasi [B1]

- **Tipe**: [SECURITY]
- **Scope**: `app/api/admin/notifications`, `app/api/admin/pelanggan`
- **Author**: agent
- **Deskripsi**: Hardening 5 endpoint admin notifikasi yang sebelumnya rawan cross-tenant data exposure dan IDOR. Semua endpoint migrasi ke createHandler dengan permission notifications:read atau notifications:manage. Filter tenantId di WHERE clause untuk non-super admin (super admin bypass). Untuk retry/resolve: tenant ownership check entry vs session (cegah IDOR). Validasi search max 255 char + status/channel whitelist + templateKey via BILLING_TEMPLATES. Pelanggan notification-history pakai findFirst dengan tenant filter + defense in depth di setiap query inAppNotifs/emailLogs/deadLetters/whatsappMessages.
- **Files**: `app/api/admin/notifications/dead-letter/route.ts`, `app/api/admin/notifications/dead-letter/[id]/retry/route.ts`, `app/api/admin/notifications/dead-letter/[id]/resolve/route.ts`, `app/api/admin/notifications/email-logs/route.ts`, `app/api/admin/pelanggan/[id]/notification-history/route.ts`
- **Breaking**: ❌ Tidak

---

## Riwayat Perubahan

<!-- File ini akan dipindahkan ke "Riwayat Perubahan" setelah release tag dibuat. -->

---

*File ini adalah living document. Setiap perubahan kode wajib disertai entry di sini.*
*Maintained by: Agent + Development Team*
