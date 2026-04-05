# Netmanager Full Audit — Source of Truth

Tanggal: 2026-04-04
Status: ✅ Selesai (phase-1 stabilisasi + phase-2 god-code hardening)
Owner: Hephaestus (agent execution)

## 1) Tujuan Audit

Melakukan audit menyeluruh terhadap aplikasi `netmanager`, memahami alur fitur nyata sebelum perubahan, memperbaiki error/warning sampai bersih, lalu memverifikasi end-to-end tanpa meninggalkan suppress type/error handling yang tidak aman.

## 2) Arsitektur & Flow Nyata yang Dipakai Sebagai Baseline

Pola utama yang dipertahankan selama perbaikan:

- Modular monolith: UI (App Router) → API route tipis → service → repository → Prisma.
- Komunikasi antar modul tetap melalui service/public API, tidak menembus repository modul lain secara sembarangan.
- Perubahan difokuskan pada koreksi kontrak typing, dependency wiring, dan stabilitas runtime test.

Area flow yang paling terdampak perbaikan:

- Radius sync flow (admin radius routes, pelanggan-ppp routes, hooks radius sync, void invoice side-effect).
- Notification flow (typing repository untuk query/filter/update agar tidak `unknown`).
- Attendance/Leave/Overtime flow (runtime compatibility antara service dan mock test contract).
- Work-order ↔ ticket sync flow (menghilangkan circular initialization).

## 3) Root Cause Utama yang Ditemukan

1. Salah dependency injection untuk `RadiusSyncService` (main Prisma client dipassing ke konstruktor yang tidak memerlukannya).
2. Salah dependency type untuk service notifikasi (`WhatsAppService`, `EmailService`) pada route tertentu.
3. Drift kontrak interface repository (`IUserRepository` vs implementasi nyata).
4. Typing repository notifikasi terlalu longgar (`unknown`) sehingga propagasi error ke route/test.
5. Circular init `WorkOrderRepository` ↔ `WorkOrderSyncService` yang memicu runtime constructor undefined.
6. Interop import `zod` di runtime test (menyebabkan `z.object`/`z.string` undefined pada Vitest environment tertentu).
7. Drift contract di test mocks (Attendance/Leave/Overtime/WorkOrder sync) dibanding method service/repository yang terbaru.

## 4) Perbaikan yang Diterapkan

### 4.1 Static quality (lint/type)

- Bersihkan `no-explicit-any`, `as any`, dan unused vars/import lint warnings pada area terdampak.
- Koreksi metadata typing Next.js di `app/admin/chat/page.tsx` (`Metadata`).
- Tambah implementasi `findManyWithFullDetails(userIds)` di `lib/repositories/UserRepository.ts`.
- Hilangkan cast tidak aman di `lib/repositories/index.ts` untuk `UserRepository`.

### 4.2 Radius, Email, WhatsApp wiring

- Ubah pemanggilan `new RadiusSyncService(prisma)` → `new RadiusSyncService()` pada route/hooks/services yang salah.
- Ubah `new WhatsAppService(prisma)` → `new WhatsAppService()`.
- Ubah `new EmailService(prisma)` → `new EmailService()`.

### 4.3 Notification repository typing hardening

- Kencangkan signature dengan tipe Prisma/`Notifications` untuk `findManyForUser`, `findFirst`, `countWhere`, `updateMany`.

### 4.4 Runtime test repair

- **WorkOrder circular init fix**:
  - Di `WorkOrderRepository.updateStatus`, sync ticket dipanggil via dynamic import agar tidak terjadi circular constructor crash.
- **Zod import normalization**:
  - Normalisasi impor menjadi `import * as z from 'zod'` secara konsisten di codebase yang terdampak.
- **Test contract alignment**:
  - `tests/modules/overtime/OvertimeService.test.ts`: tambah/mock `findActiveRequestByDate`.
  - `tests/modules/work-order/WorkOrderSyncService.test.ts`: sesuaikan ekspektasi update path ke `updateMany` flow.
  - `tests/modules/attendance/LeaveService.test.ts`: sesuaikan mock ke method repository/service terbaru (`findByIdWithUser`, `findWorkScheduleByIdWithTenant`, dll).
  - `tests/modules/attendance/AttendanceService.test.ts`: lengkapi mock `AttendanceRepository` untuk method check-in/out terbaru (`findManyStaleSessions`, `findFirstOpenSession`, `findFirstActiveForCheckout`, dll).

## 5) Bukti Verifikasi Final

Perintah verifikasi yang dijalankan:

1. `npm run test:run`
   - Hasil akhir: **112 passed files, 622 passed tests, 0 failed**.
2. `npm run check`
   - Menjalankan: `lint` + `typecheck` + `test:run` + `build`.
   - Hasil: **semua stage sukses**.
3. LSP diagnostics error scan:
   - `.ts`: 0 error
   - `.tsx`: 0 error

## 6) Dampak dan Risiko Residual

- Dampak positif: stabilitas runtime test kembali, typing lebih ketat, wiring service lebih konsisten dengan kontrak.
- Risiko residual rendah: perubahan besar pada import style `zod` sudah tervalidasi lewat lint/typecheck/test/build hijau.

## 7) Source-of-Truth Decision Log

- Prioritas utama audit ini adalah **kebenaran alur fitur + kebersihan quality gate**, bukan sekadar membuat satu subset test hijau.
- Semua perbaikan dipilih agar:
  1) sesuai pola arsitektur modular monolith,
  2) tidak menggunakan suppress type error,
  3) lolos verifikasi end-to-end.

## 8) Phase-2 God Code Audit (lanjutan 2026-04-04)

Fokus lanjutan: menemukan hotspot “god code” (fungsi/file terlalu gemuk, boundary bocor), lalu menerapkan refactor arsitektural ber-impact tinggi tanpa mengubah behavior bisnis inti.

### 8.1 Temuan prioritas tertinggi

- Hotspot file besar: `modules/work-order/repositories/WorkOrderRepository.ts` (~2817 LOC), `modules/integrations/services/MixRadiusService.ts` (~2525 LOC), `modules/network/repositories/RadiusRepository.ts` (~1117 LOC), `modules/work-order/services/WorkOrderService.ts` (~1102 LOC).
- Hotspot route gemuk:
  - `app/api/webhooks/[provider]/route.ts` (parsing provider, signature, lookup payment, transaksi invoice, side-effect automation dalam satu fungsi).
  - `app/api/finance/rab-projects/[id]/route.ts` PATCH (updateData assembly + nested recreate WBS/items/disbursement + investor recompute dalam route).
- Temuan boundary leakage (hasil review paralel): banyak API masih menyentuh Prisma/repository langsung dan beberapa service lintas modul menembus boundary repository.

### 8.2 Refactor yang diimplementasikan pada fase ini

1. **Thin webhook route (API → service orchestration)**
   - Route `app/api/webhooks/[provider]/route.ts` dipangkas menjadi adaptor tipis (extract params/body, delegasi ke service, return response).
   - Logika berat dipindah ke service baru:
     - `modules/finance/services/payment-gateway/webhook-processing-service.ts`
   - Cakupan logika yang dipusatkan di service:
     - validasi provider + parsing payload (JSON/form-urlencoded)
     - signature extraction per provider
     - early payment lookup + fallback lookup (termasuk jalur MOOTA)
     - update status payment + payment method normalization
     - invoice reconciliation di dalam transaksi
     - post-paid side-effects (`AutomaticBillingService.handleInvoicePaid`)
     - pencatatan unmatched mutation untuk MOOTA

2. **Thin RAB PATCH route (API → repository transaction orchestration)**
   - Orkestrasi transaksi nested dipindah dari route ke repository:
     - method baru: `RabProjectRepository.updateProjectWithRelations(id, input)`
   - Route `app/api/finance/rab-projects/[id]/route.ts` PATCH sekarang fokus pada:
     - auth/permission check
     - validasi schema
     - delegasi ke repository
     - serialisasi response
   - Repository menangani:
     - update field project (termasuk relation update untuk `site`)
     - full replace WBS/items/disbursement ketika payload item diberikan
     - investor reset/recreate + split CAPEX calculation

### 8.3 Verifikasi fase-2

Perintah yang dijalankan setelah refactor:

1. `npm run typecheck` → **pass**
2. `npm run test:run -- tests/api/finance/rab-project-revisions-route.test.ts tests/api/finance/rab-project-revision-detail-route.test.ts tests/api/finance/rab-project-revision-profit-loss-route.test.ts` → **3 files passed, 6 tests passed**
3. `npm run build` → **pass**
4. `npm run lint` → **pass**
5. LSP diagnostics pada file yang diubah → **0 error**

Catatan: instruksi AGENTS menyebut `scripts/setup-test-db.sh`, namun file tersebut tidak ada di repository saat verifikasi fase-2, sehingga test dijalankan langsung via Vitest.

### 8.4 Dampak arsitektural

- API layer lebih tipis dan konsisten dengan prinsip modular monolith (route sebagai adapter, orchestration di service/repository).
- Kompleksitas kognitif route turun signifikan pada dua hotspot high-impact.
- Fondasi refactor lanjutan lebih aman (WorkOrder/MixRadius/Radius hotspot besar bisa dipecah bertahap dengan pola yang sama).

Dokumen ini menjadi baseline audit/repair per 2026-04-04, termasuk hasil hardening god-code phase-2.

## 9) Phase-3 Layer Consistency Hardening (2026-04-04)

Fokus phase-3: menutup kebocoran boundary lintas layer/modul, menambahkan guardrail executable, dan mendokumentasikan backlog refactor prioritas tinggi berdasarkan audit paralel.

### 9.1 Ringkasan audit boundary (evidence-driven)

Hasil audit paralel internal:

- `app/api/**/route.ts` yang import `@/lib/prisma*`: **248 file**.
- `app/api/**/route.ts` yang import `@/modules/.../repositories...`: **35 file**.
- `app/api/**/route.ts` yang deep-import internal module (`@/modules/<name>/...`): **147 file**.
- UI `app/**/*.tsx` yang import service/repository langsung: **6 file**.
- Cross-module deep import di `modules/**`: **43 file**.
- Total deep import offender lintas `app/`, `lib/`, `modules/`: **286**.

Hotspot dominan target module: `attendance`, `network`, `finance`, `integrations`, `work-order`.

### 9.2 Perbaikan yang sudah diterapkan pada phase-3

1. **Public API import compliance (targeted high-impact fixes)**
   - `app/api/admin/sites/route.ts`
     - `@/modules/roles/services/SiteService` → `@/modules/roles`
   - `app/api/customer/auth/login/route.ts`
     - `@/modules/pelanggan/services/CustomerAuthService` → `@/modules/pelanggan`

2. **Cross-module repository leakage reduction**
   - `modules/work-order/services/WorkOrderService.ts`
     - `UserRepository` import diganti ke public API (`@/modules/users`).
     - dependency internal lintas modul yang tidak terpakai (`SettingsRepository`, `CanvasingRepository`) dihapus.

3. **Attendance settings facade untuk akses lintas modul via service**
   - Tambah `modules/attendance/services/AttendanceSettingsService.ts`.
   - Export facade via `modules/attendance/index.ts`.
   - `modules/mitra/services/MitraWithdrawService.ts`
     - stop import repository attendance internal.
     - migrasi ke `AttendanceSettingsService` dari `@/modules/attendance`.

4. **Automated guardrails (warn-mode, non-breaking rollout)**
   - `eslint.config.mjs` diperkuat dengan `no-restricted-imports` untuk:
     - melarang UI import repository/service module internal secara langsung;
     - melarang API route import repository module internal dan deep import `@/modules/*/**`;
     - memberi sinyal pada akses langsung `@/lib/prisma*` dari UI/API.
    - Mode awal: `warn` agar rollout tidak memblokir deployment saat baseline violation masih tinggi.

5. **Targeted deep-import remediation gelombang-2 (high-frequency offenders)**
   - `modules/finance/services/AutomaticBillingService.ts`
     - akses settings dimigrasi ke `AttendanceSettingsService` (public module API), bukan `SettingsRepository` internal attendance.
     - dynamic import `RadiusSyncService` dipindah ke `@/modules/network` (public API).
   - `modules/finance/services/AutomaticIsolationService.ts`
     - akses settings dimigrasi ke `AttendanceSettingsService`.
     - `RadiusSyncService` + `PelangganRepository` impor via public module API.
   - `modules/notification/services/email-service.ts` dan `modules/notification/services/whatsapp/whatsapp-service.ts`
     - dependency settings dimigrasi ke `AttendanceSettingsService`.
   - `modules/notification/services/ExpoPushService.ts`
     - `PelangganRepository` dan `MitraRepository` impor via public module API.
   - `modules/salary/index.ts`
     - expose `SalaryService`/`getSalaryService` lewat public API module.
   - Seluruh route salary admin (`app/api/admin/salary/**`)
     - `getSalaryService` import dipindah dari deep path service ke `@/modules/salary`.
   - Route investor + integrations MixRadius terkait (`app/api/investor/**`, `app/api/integrations/mixradius/**`)
     - import `getMixRadiusService`, `MixRadiusService`, dan tipe terkait dipindah ke `@/modules/integrations`.
   - Route terkait radius sync (`app/api/profileppps/**`, `app/api/bandwidths/[id]/route.ts`, `app/api/pelanggan-ppp/[id]/status/route.ts`, `modules/finance/services/VoidInvoiceService.ts`)
     - dynamic import `RadiusSyncService` dipindah ke `@/modules/network`.

### 9.3 Keputusan arsitektural phase-3

- **Keputusan 1**: penegakan boundary dilakukan bertahap dengan guardrail lint berbasis warning dulu, lalu dinaikkan ke error setelah backlog kritis turun.
- **Keputusan 2**: consumer lintas modul wajib lewat public API module (`@/modules/<module>`), bukan path internal.
- **Keputusan 3**: akses konfigurasi lintas modul dilakukan via service/facade, bukan repository internal modul lain.

### 9.4 Backlog eksekusi lanjutan (prioritas)

1. Refactor route gemuk berisiko tinggi agar benar-benar thin-controller:
   - `app/api/admin/workorders/dashboard/route.ts`
   - `app/api/mobile/leaves/route.ts`
   - `app/api/finance/rab-projects/[id]/route.ts`
2. Kurangi dependency `app/api` ke `@/lib/prisma*` dengan memindahkan orchestration ke service/repository per domain.
3. Perluas module public API untuk use-case lintas modul yang masih memaksa deep import.
4. Setelah violation kritis turun, ubah guardrail ESLint dari `warn` → `error` untuk boundary rules.

### 9.5 Status rollout phase-3 saat ini

- Enforcement rule sudah aktif dan memberi sinyal otomatis pada pelanggaran boundary baru.
- Sejumlah offender frekuensi tinggi sudah dimigrasi ke public API module.
- Baseline violation historis masih besar (terutama direct Prisma di API route), sehingga strategi rollout bertahap `warn -> error` tetap dipertahankan agar aman untuk delivery.

Phase-3 ini menjadi SOT arsitektur boundary saat ini: aturan sudah dieksekusi otomatis, pelanggaran sudah terpetakan kuantitatif, dan remediation path diprioritaskan untuk rollout aman.

## 10) Phase-4 MikroTik UI Modularization (2026-04-05)

Fokus phase-4: mengurangi God Code dan duplikasi di `/admin/network/mikrotik` tanpa mengubah behavior create/edit/list yang sudah berjalan.

### 10.1 Boundary baru yang menjadi source of truth

Untuk area UI MikroTik, boundary yang sekarang dipakai adalah:

- `app/admin/network/mikrotik/new/MikrotikNewClient.tsx`
  - tetap owns create-only behavior: POST submit flow, `testPassed` gating, dan routing setelah save.
- `app/admin/network/mikrotik/[id]/edit/MikrotikEditClient.tsx`
  - tetap owns edit-only behavior: `loadRouter()`, PATCH submit flow, dan reload data setelah test connection sukses.
- `app/admin/network/mikrotik/MikroTikRouterList.tsx`
  - tetap owns list-level modal state dan action orchestration (`delete`, `test connection`, `reconfigure`), tetapi data fetching/search/pagination/socket refresh dipindah ke hook terpisah.

Shared UI/data seams yang sekarang resmi dipakai:

- `app/admin/network/mikrotik/components/mikrotikRouterForm.tsx`
  - presentational form surface untuk create/edit.
- `app/admin/network/mikrotik/components/mikrotikRouterTable.tsx`
  - presentational table, controls, dan pagination untuk list page.
- `app/admin/network/mikrotik/hooks/useMikrotikFormSettings.ts`
  - shared settings loader (`pppConnectionMode`, `radiusDefaults`).
- `app/admin/network/mikrotik/hooks/useMikrotikConnectionTest.ts`
  - shared test-connection modal flow + validation wrapper.
- `app/admin/network/mikrotik/hooks/useMikrotikRouterList.ts`
  - shared list data layer (`fetch`, `debounce`, `pagination`, `socket refresh`).
- `app/admin/network/mikrotik/mikrotikFormShared.ts`
  - tetap menjadi helper network/form contract yang dipakai hook-hook di atas.

### 10.2 Keputusan arsitektural phase-4

- Shared extraction dibatasi pada **presentational form/table** dan **local UI hooks**.
- `POST` create, `PATCH` edit, `testPassed`, `loadRouter`, dan modal ownership tetap lokal di page-level client agar behavior tidak bergeser.
- List page dipecah menjadi **hook data + presentational table**, tetapi delete/test/reconfigure tetap di parent agar orchestration tetap eksplisit.
- Route wrappers (`page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`) tidak diubah karena sudah cukup sebagai permission boundary.

### 10.3 Verifikasi phase-4 MikroTik

Perintah verifikasi yang dijalankan setelah modularization:

1. LSP diagnostics pada file baru/berubah
   - `MikrotikNewClient.tsx` → 0 error
   - `MikrotikEditClient.tsx` → 0 error
   - `MikroTikRouterList.tsx` → 0 error
   - `components/` → 0 error
   - `hooks/` → 0 error
2. `npm run lint` → pass
3. `npm run typecheck` → pass
4. `npm run test:run` → pass
5. `npm run build` → pass

Section ini menjadi SOT untuk boundary UI MikroTik setelah phase-4: shared seams sudah diekstrak, tetapi orchestration penting tetap lokal untuk menjaga parity behavior.

## 11) NetWave-2 Radius Dashboard Local Extraction (2026-04-05)

Fokus wave ini: menurunkan God Code di `/admin/network/radius/RadiusDashboard.tsx` tanpa mengubah endpoint, refresh behavior, ataupun websocket room semantics.

### 11.1 Boundary baru yang menjadi source of truth

Untuk area UI Radius, boundary yang sekarang dipakai adalah:

- `app/admin/network/radius/page.tsx`
  - tetap owns server-side permission + redirect behavior berdasarkan `PPP_CONNECTION_MODE`.
- `app/admin/network/radius/RadiusDashboard.tsx`
  - tetap menjadi shell presentational dashboard dan tetap owns composition terhadap `StatsCards`, `SessionsTable`, dan `SyncControls`, tetapi data/socket orchestration dipindah ke hook lokal.
- `app/admin/network/radius/hooks/useRadiusDashboardData.ts`
  - menjadi seam resmi untuk fetch stats, fetch recent sessions, loading/refreshing state, websocket room join/leave, dan event subscription `radius:stats` / `radius:sessions`.

### 11.2 Keputusan arsitektural NetWave-2

- Extraction dibatasi pada **feature-local hook**; tidak dibuat shared dashboard infra lintas modul.
- `join_room` / `leave_room`, endpoint fetch, dan refresh timing tetap identik dengan perilaku sebelumnya.
- `SyncControls` tetap dibiarkan feature-specific karena owns mutation + reload timing, sehingga tidak dipaksa menjadi abstraction generik.
- Route redirect logic di `page.tsx` sengaja tidak diubah.

### 11.3 Verifikasi NetWave-2 Radius

Perintah verifikasi yang dijalankan setelah extraction:

1. LSP diagnostics pada file baru/berubah
   - `RadiusDashboard.tsx` → 0 error
   - `hooks/useRadiusDashboardData.ts` → 0 error
2. `npm run lint` → pass
3. `npm run typecheck` → pass
4. `npm run test:run` → pass
5. `npm run build` → pass

Section ini menjadi SOT untuk boundary UI Radius setelah NetWave-2: dashboard shell tetap lokal di feature, sementara data/socket orchestration dipusatkan ke hook lokal tanpa mengubah kontrak perilaku.
