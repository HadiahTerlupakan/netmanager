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

### [2026-05-18] — Phase 3 batch: migrasi 16 file admin client ke `useApi`

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/integrations/mixradius/**`, `app/admin/inventory/gudang/**`, `app/admin/log/**`, `app/admin/network/acs/**`, `app/admin/pengaturan/**`
- **Author**: agent
- **Deskripsi**: Lanjutan Phase 3 dari TanStack adoption roadmap. Migrasi 16 file
  client component dari pola lama (`useEffect + fetch + useState`) ke hook
  `useApi` (TanStack Query). Eliminasi helper `unwrapApiData`/`extractApiData`
  duplikat di banyak file karena `useApi` sudah handle envelope `{ data: ... }`
  via `apiFetcher`. Pattern yang dipakai: state lokal hanya untuk form/derived
  UI, server cache di-handle TanStack Query. Loading state di-derive dari
  `isLoading`. Refresh manual diganti panggil `refetch()` dari `useApi`. Lint
  pass, typecheck pass (0 error). Tidak ada perubahan behavior atau API contract.
- **Files**: `app/admin/integrations/mixradius/accounts/MixRadiusAccountsClient.tsx`,
  `app/admin/integrations/mixradius/expenses/CategoryList.tsx`,
  `app/admin/integrations/mixradius/groups/MixRadiusGroupsClient.tsx`,
  `app/admin/integrations/mixradius/investor-sites/SiteInvestorClient.tsx`,
  `app/admin/inventory/gudang/GudangList.tsx`,
  `app/admin/inventory/gudang/[id]/edit/GudangEditClient.tsx`,
  `app/admin/log/login/LoginLogClient.tsx`,
  `app/admin/log/mobile-errors/MobileErrorLogClient.tsx`,
  `app/admin/network/acs/devices/[id]/DeviceDetailClient.tsx`,
  `app/admin/pengaturan/acs/AcsConfigTab.tsx`,
  `app/admin/pengaturan/acs/VendorConfigTab.tsx`,
  `app/admin/pengaturan/captcha/CaptchaClient.tsx`,
  `app/admin/pengaturan/company-bank-accounts/BankAccountsClient.tsx`,
  `app/admin/pengaturan/email/EmailSettingsClient.tsx`,
  `app/admin/pengaturan/payment-gateway/components/UnmatchedMutationsList.tsx`,
  `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Tambah TanStack Query adoption roadmap

- **Tipe**: [DOCS]
- **Scope**: `docs/guides/tanstack-adoption-roadmap.md`
- **Author**: agent
- **Deskripsi**: Buat roadmap 5-phase untuk maksimalkan adopsi TanStack Query
  setelah foundation terpasang. Setelah migrasi awal sesi ini, baru 37% file
  pakai useApi/useQuery, 0 useMutation, 0 optimistic update — investasi bundle
  ~13KB belum optimal. Roadmap breakdown: Phase 1 useMutation untuk 5 critical
  actions (20j), Phase 2 cross-module invalidation (12j), Phase 3 migrate sisa
  64 file (49j bertahap), Phase 4 replace setInterval dengan refreshInterval
  (8j), Phase 5 useInfiniteQuery untuk list besar (16j). Total ~105 jam
  distributed di ~10 minggu sprint. Plus quick wins yang bisa mulai hari ini
  (pakai useApi untuk fetch baru, pakai DevTools, refreshInterval untuk
  dashboard).
- **Files**: `docs/guides/tanstack-adoption-roadmap.md` (baru)
- **Breaking**: ❌ Tidak

### [2026-05-17] — Adopsi SWR sebagai standar data fetching + dokumentasi pattern

- **Tipe**: [ADDED]
- **Scope**: `lib/hooks/useApi.ts`, `components/providers/session-provider.tsx`, `docs/standards/data-fetching.md`
- **Author**: agent
- **Deskripsi**: Install SWR v2 + tulis hook `useApi` sebagai entry point konvensi (wrapper di atas `fetchWithHandling` yang sudah ada). Pasang `SWRConfig` global di provider tree. Dokumentasikan pattern lengkap di `docs/standards/data-fetching.md` (kapan pakai useApi, pattern A/C/D untuk pengganti useEffect, dos & don'ts). Tujuan: hilangkan pola lama `useEffect + fetch + useState` yang melanggar rule React Compiler 19. Total lint errors project: 195 → 129 (-34%) setelah Phase 1-5 partial. Sisa ~103 file menunggu sweep berikutnya.
- **Files**: `package.json`, `package-lock.json`, `lib/hooks/useApi.ts` (baru), `components/providers/session-provider.tsx`, `docs/standards/data-fetching.md` (baru), `CLAUDE.md`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Migrasi batch ke-2: 8 file TDZ violation ke pola SWR (`useApi`)

- **Tipe**: [FIXED]
- **Scope**: `app/admin/paket/*`, `app/admin/workorders/templates`, `components/admin/settings`, `components/customer`, `components/inventory`, `components/mikrotik`
- **Author**: agent
- **Deskripsi**: Lanjutan migrasi TDZ violation. Hilangkan error lint `Cannot access variable before it is declared` di 8 client components dengan migrasi dari pola `useEffect + fetch + useState` ke hook `useApi` berbasis SWR. Modal-modal detail (Bandwidth/Harga/Profile) pakai conditional fetching (`open && id ? url : null`). `CustomerAuthProvider` (critical untuk auth flow) di-refactor: `customer` derived dari `data` SWR, `refresh()` panggil `mutate()`, `login()/logout()` update cache via `mutate(...)` tanpa revalidate. `BarangTable` pakai 2 instance `useApi` (gudang list + barang list dengan query string memo). `ReconfigureModal` pakai SWR `onSuccess` callback untuk pre-select online routers, dan pola "adjusting state on prop change" untuk reset state saat modal open. `CaptchaSettings` pakai pattern override (form input di-merge dengan data server). Total TDZ violations project-wide turun ke 2 (sisanya di file lain di luar batch ini). Typecheck pass.
- **Files**: `app/admin/paket/bandwidth/BandwidthDetailModal.tsx`, `app/admin/paket/harga/HargaPaketDetailModal.tsx`, `app/admin/paket/profileppp/ProfileDetailModal.tsx`, `app/admin/workorders/templates/TemplatesClient.tsx`, `components/admin/settings/CaptchaSettings.tsx`, `components/customer/CustomerAuthProvider.tsx`, `components/inventory/BarangTable.tsx`, `components/mikrotik/ReconfigureModal.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Migrasi 8 file TDZ violation ke pola SWR (`useApi`)

- **Tipe**: [FIXED]
- **Scope**: `app/(customer)/tagihan`, `app/admin/integrations/mixradius/*`, `app/admin/pengaturan/payment-gateway`, `app/admin/tenants`, `app/admin/workorders/new`
- **Author**: agent
- **Deskripsi**: Hilangkan error lint `Cannot access variable before it is declared` (TDZ violation) di 8 client components dengan migrasi dari pola `useEffect + fetch + useState` ke hook `useApi` berbasis SWR. Mutasi memanggil `mutate()` alih-alih `fetchX()`. Loading state diambil dari `isLoading` SWR. Multi-endpoint dipakai per-call (3 di MixRadiusGroupsClient, 2 di SiteInvestorClient/tagihan). Conditional fetch dipakai di `tagihan/page.tsx` (gating by `isAuthenticated`) dan `WoNewClient.tsx` (gating by `status === "authenticated"`). Business logic & handler tidak diubah.
- **Files**: `app/(customer)/tagihan/page.tsx`, `app/admin/integrations/mixradius/accounts/MixRadiusAccountsClient.tsx`, `app/admin/integrations/mixradius/groups/MixRadiusGroupsClient.tsx`, `app/admin/integrations/mixradius/investor-sites/SiteInvestorClient.tsx`, `app/admin/integrations/mixradius/profit-loss/ProfitLossClient.tsx`, `app/admin/pengaturan/payment-gateway/components/UnmatchedMutationsList.tsx`, `app/admin/tenants/TenantList.tsx`, `app/admin/workorders/new/WoNewClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Bump vitest-mock-extended ke v4

- **Tipe**: [CHANGED]
- **Scope**: `package.json`, `package-lock.json`
- **Author**: agent
- **Deskripsi**: Naikkan `vitest-mock-extended` 3.1.0 → 4.0.0. Investigasi
  release notes mengkonfirmasi v4 hanya berisi tooling internal switch
  (eslint→biome) + bump peer ke `vitest >=4` — tanpa breaking pada API publik.
  Codebase hanya import `mockReset` di `tests/setup.ts`, dan smoke test
  (`tests/lib/realtime/client.test.ts`) lolos. Peer requirement `vitest>=4`
  sudah terpenuhi (project pakai vitest 4.1.6).
- **Files**: `package.json`, `package-lock.json`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Bump major dependencies (low-risk batch)

- **Tipe**: [CHANGED]
- **Scope**: `package.json`, `package-lock.json`
- **Author**: agent
- **Deskripsi**: Naikkan 3 paket major yang sudah dianalisis aman untuk codebase
  ini: `lint-staged` 16 → 17 (Node 24 ✓, config inline JSON di package.json
  jadi tidak butuh `yaml` dep), `axios-cookiejar-support` 6 → 7 (drop Node 20,
  kita pakai Node 24; pemakaian terbatas di `mixradius-service.config.ts`),
  dan `@types/nodemailer` 7 → 8 (sinkron dengan runtime `nodemailer` 8).
  Typecheck dan lint passing tanpa regresi (jumlah lint error tetap 195 yang
  pre-existed). Major lain (TypeScript 6, ESLint 10, vitest-mock-extended 4,
  `@types/pg` 8.20) sengaja ditunda — lihat catatan review sebelumnya.
- **Files**: `package.json`, `package-lock.json`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Bump dependencies (minor/patch) + reduce CVE surface

- **Tipe**: [SECURITY]
- **Scope**: `package.json`, `package-lock.json`
- **Author**: agent
- **Deskripsi**: Eksekusi `npm update` untuk semua paket dalam range semver yang
  diizinkan. Mengurangi vulnerabilities dari 14 (6 high / 8 moderate) menjadi
  hanya 2 moderate (sisanya transitive di `next`/`postcss` yang baru rilis fix
  upstream — tidak di-force karena akan downgrade Next ke v9). Highlights:
  `next` 16.2.4 → 16.2.6 (DoS Server Components fix), `next-auth` 4.24.13 →
  4.24.14, `prisma` + `@prisma/client` 7.7.0 → 7.8.0, `react`/`react-dom`
  19.2.4 → 19.2.6, `hono` 4.12.14 → 4.12.19 (CSS injection fix), `bullmq`
  5.71.1 → 5.76.9, `firebase` 12.11.0 → 12.13.0, `firebase-admin` 13.7.0 →
  13.10.0, `zod` 4.3.6 → 4.4.3, `lucide-react` 1.0.1 → 1.16.0,
  `isomorphic-dompurify` 3.7.1 → 3.13.0. Update major
  (TypeScript 6, ESLint 10, lint-staged 17) sengaja ditunda — perlu review
  manual karena ada breaking changes.
- **Files**: `package.json`, `package-lock.json`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Implement dual update channel: APK notification + OTA fingerprint

- **Tipe**: [ADDED]
- **Scope**: `modules/app-version`, `mobile-netmanager`, `app/admin/app-releases`, `app/admin/pengaturan/app-update`
- **Author**: agent
- **Deskripsi**: Implementasi lengkap dual update channel untuk mobile app:
  (1) OTA via Expo Updates dengan fingerprint policy menggantikan appVersion policy,
  (2) APK update notification dengan modul backend `app-version` baru: schema AppRelease, endpoint mobile check, admin CRUD UI, force/soft update support, minSupportedVersion threshold,
  (3) Mobile dual-check via `useApkVersionCheck` + orchestrator `useVersionCheck` dengan APK-priority,
  (4) UI komponen `UpdateAvailableModal` dan `UpdateRequiredScreen` extended pakai discriminated union (mode: 'apk' | 'ota') dengan tombol Download + Hubungi Admin (configurable per-tenant via TenantSettings.appUpdateContactUrl),
  (5) Force update lock screen tidak bisa di-logout, hanya bisa Download/Hubungi Admin/Cek Ulang.
  Lihat `docs/standards/mobile-update-strategy.md` dan `docs/superpowers/specs/2026-05-17-dual-update-channel-design.md`.
- **Migration**: `20260517000000_add_app_releases`
- **Breaking**: ❌ Tidak (perlu APK rebuild satu kali untuk aktifkan fingerprint policy)

### [2026-05-17] — Tambah field kontak admin untuk update APK di tenant settings UI

- **Tipe**: [ADDED]
- **Scope**: `app/api/admin/app-update/contact-settings`, `app/admin/pengaturan/app-update`, `modules/settings`
- **Author**: agent
- **Deskripsi**: Expose dua field `appUpdateContactUrl` dan `appUpdateContactLabel` dari `TenantSettings` ke API dan UI admin. Tambah endpoint `GET/PUT /api/admin/app-update/contact-settings` untuk baca/tulis pengaturan kontak. Tambah fungsi `updateAppUpdateContact` di service layer. Tambah section form di `AppUpdateClient.tsx` dengan dua input field dan tombol simpan.
- **Files**: `app/api/admin/app-update/contact-settings/route.ts`, `app/admin/pengaturan/app-update/AppUpdateClient.tsx`, `modules/settings/services/tenantSettings.ts`, `modules/settings/index.ts`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Admin UI new + detail/edit AppRelease

- **Tipe**: [ADDED]
- **Scope**: `app/admin/app-releases`
- **Author**: agent
- **Deskripsi**: Tambah dua halaman admin untuk manajemen AppRelease: form create (`/new`) dan halaman detail/edit (`/[id]`). Keduanya menggunakan design system `Button` dari `@/components/ui/Button`, toast notification via `react-hot-toast`, dan pola `useState` + `useEffect` konsisten dengan admin pages lain. Detail page mendukung edit field yang bisa diubah post-release (isActive, isForceUpdate, downloadUrl, releaseNotes, minSupportedVersion, minOsVersion, rolloutPercentage) dan aksi deactivate via DELETE.
- **Files**: `app/admin/app-releases/new/page.tsx`, `app/admin/app-releases/[id]/page.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Admin CRUD endpoints AppRelease + permission registration

- **Tipe**: [ADDED]
- **Scope**: `app/api/admin/app-releases`
- **Author**: agent
- **Deskripsi**: Tambah endpoint admin untuk CRUD AppRelease: GET list (dengan pagination + filter platform), POST create, GET detail, PATCH update, DELETE (deactivate). Permission `app-release:manage` didaftarkan di `lib/permissions.ts` (konstanta `PERMISSIONS.APP_RELEASE.MANAGE`) dan ditambahkan ke group PENGATURAN di `lib/permission-config.ts`. BigInt `apkSizeBytes` dikonversi ke Number sebelum JSON response.
- **Files**: `app/api/admin/app-releases/route.ts`, `app/api/admin/app-releases/[id]/route.ts`, `lib/permissions.ts`, `lib/permission-config.ts`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Tambah endpoint mobile check versi APK

- **Tipe**: [ADDED]
- **Scope**: `app/api/mobile/app-version/check`
- **Author**: agent
- **Deskripsi**: Endpoint `GET /api/mobile/app-version/check` untuk mobile client
  mengecek apakah versi APK perlu update. Auth via `getMobileAuthPayload`, validasi
  query params dengan `versionCheckQuerySchema`, delegasi ke `AppVersionCheckService`.
  Juga mengekspor `getAppUpdateContact` dari public API `@/modules/settings`.
- **Files**: `app/api/mobile/app-version/check/route.ts`, `modules/settings/index.ts`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Tambah AppVersionCheckService dengan TDD

- **Tipe**: [ADDED]
- **Scope**: `modules/app-version/services`
- **Author**: agent
- **Deskripsi**: Implementasi `AppVersionCheckService` sebagai core business logic untuk
  memeriksa apakah versi aplikasi mobile perlu diupdate. Mendukung soft update, force update
  via flag `isForceUpdate`, force update via `minSupportedVersion`, dan lookup kontak admin
  dari tenant settings. Dibangun dengan TDD (7 test case, semua pass).
- **Files**: `modules/app-version/services/AppVersionCheckService.ts`,
  `tests/modules/app-version/AppVersionCheckService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Tambah model AppRelease + extend TenantSettings contact admin

- **Tipe**: [ADDED]
- **Scope**: `prisma/schema.prisma`, `modules/app-version`
- **Author**: agent
- **Deskripsi**: Tambah model `AppRelease` untuk distribusi APK langsung (non-OTA) dengan
  field platform, version, versionCode, rolloutPercentage, architecture, dll. Extend
  `TenantSettings` dengan field `appUpdateContactUrl` dan `appUpdateContactLabel` untuk
  info kontak admin di dialog update. Bagian dari implementasi dual update channel (APK + OTA).
- **Files**: `prisma/schema.prisma`,
  `prisma/migrations/20260517000000_add_app_releases/migration.sql`
- **Migration**: `20260517000000_add_app_releases`
- **Breaking**: ❌ Tidak

### [2026-05-17] — Fix lembur tertahan "belum checkout" saat hari off-day / libur kerja

- **Tipe**: [FIXED]
- **Scope**: `modules/overtime`, `mobile-netmanager`
- **Author**: agent
- **Deskripsi**: Saat hari ini libur kerja (off-day user) atau setelah libur nasional, `AbsenceService` auto-create attendance dengan status `DAY_OFF` dan `checkOut=null`. `OvertimeAttendanceStateService.getTodayAttendanceState` keliru menafsirkan ini sebagai "belum checkout" sehingga `hasCheckedOut=false`, lalu UI mobile blok tombol "Mulai Lembur" dengan pesan "⚠️ Checkout absen dulu sebelum mulai". Perbaikan: backend treat status non-working (`DAY_OFF`, `ABSENT`, `ALPHA`, `SICK`, `PERMIT`) sebagai bukan sesi kerja aktif → return `hasCheckedOut=true`. Sekaligus mobile relax guard `canStartOvertime` agar menerima holiday non-nasional (misal libur kerja per-user) ketika backend sudah konfirmasi.
- **Files**: `modules/overtime/services/OvertimeAttendanceStateService.ts`, `mobile-netmanager/app/(app)/lembur/index.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Fix OTA asset hash format (hex → base64url)

- **Tipe**: [FIXED]
- **Scope**: `modules/app-update`
- **Author**: agent
- **Deskripsi**: Manifest mengirim field `hash` dalam format hex (64 chars) padahal Expo Updates SDK expect base64url (43 chars, no padding) sesuai spec. SDK compare langsung sebagai string → mismatch → throw `Failed to write asset file from ... base64url-encoded SHA-256 did not match expected`. Diperbaiki: tambah helper `hexToBase64Url()` lokal di `app-update-manifest.helpers.ts`, `launchAsset.hash` & `assets[].hash` di-convert ke base64url saat build manifest body. DB tetap simpan hex (untuk lookup di asset endpoint via query `?hash=`). Bug ini bikin OTA download seluruh asset gagal di tahap verifikasi — bersamaan dengan fix double extension sebelumnya, OTA flow sekarang full E2E dari check → download → install → reload.
- **Files**: `modules/app-update/services/app-update-manifest.helpers.ts`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Fix double extension di OTA asset key (manifest builder)

- **Tipe**: [FIXED]
- **Scope**: `modules/app-update`
- **Author**: agent
- **Deskripsi**: `buildAssetEntry` membangun manifest asset dengan `key: "${hash}.${ext}"` padahal Expo Updates SDK menggabungkan `key + fileExtension` saat menulis file → menghasilkan path `hash.png.png` (double extension), `expo-updates` gagal write asset dengan error `AssetsFailedToLoad / Failed to write asset file`. Diperbaiki: `key` sekarang hash murni, `fileExtension` tetap `.${ext}`. Signature dihitung ulang per-request di `signManifestBody()` jadi tidak butuh migrasi data DB. Bug ini bikin OTA download asset PNG gagal silent saat user di Android — verified via release APK + DB commitTime bump untuk simulate update available.
- **Files**: `modules/app-update/services/app-update-manifest.helpers.ts`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Refactor Button override pattern (Group B+C: 20 file)

- **Tipe**: [FIXED]
- **Scope**: `app/admin/`, `app/(customer)/`, `components/`
- **Author**: agent
- **Deskripsi**: Lanjutan migrasi soft-tinted Button — total 42 Button direfactor di 14 file (Group B & C). Pola yang dibersihkan sama dengan Group A: solid bg + text-white → variant default/destructive/success/warning, icon-only → variant ghost + size icon/icon-sm, conditional segmented → variant default vs secondary, Cancel modal → variant outline. Highlights: `MapToolbar.tsx` (9 buttons, hapus helper `toolButtonClass`), `AttendancePageContent.tsx` (5 buttons termasuk submit/absen masuk/keluar), `SalaryDetailClient.tsx` (12 buttons), `NodePopupContent.tsx` (3 buttons Edit/Edit Location/Delete). Beberapa kasus sengaja di-skip karena intentional decorative: badge attachment dengan position absolute rounded-full, button overlay di atas kamera/banner gelap dengan text-white preserved. Setelah ini sebagian besar Button di codebase sudah pakai design system tunggal.
- **Files**: `components/map/MapToolbar.tsx`, `components/map/NodePopupContent.tsx`, `components/attendance/AttendanceCard.tsx`, `components/attendance/AttendancePageContent.tsx`, `components/admin/radius/sync-controls.tsx`, `components/admin/radius/orphan-cleanup-panel.tsx`, `components/karyawan/KaryawanNotificationBell.tsx`, `components/procurement/MarketPriceCheck.tsx`, `components/inventory/DetailKeluarModal.tsx`, `components/inventory/PhotoThumbnail.tsx`, `app/admin/lembur/components/RejectModal.tsx`, `app/admin/announcement/AnnouncementIndexClient.tsx`, `app/admin/finance/manual-payments/ManualPaymentClient.tsx`, `app/admin/registrations/[id]/RegistrationDetailClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Refactor Button override pattern (Group A: 10 file admin)

- **Tipe**: [FIXED]
- **Scope**: `app/admin/`
- **Author**: agent
- **Deskripsi**: Lanjutan migrasi soft-tinted Button — bersihkan className override yang masih menimpa variant di 10 file admin batch A. Pola yang dibersihkan: `bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700` → variant default; `bg-green-600 text-white` & `bg-emerald-600 text-white` → variant success; `bg-red-600 text-white` → variant destructive; border + text-gray + hover:bg-gray Cancel buttons → variant outline; icon-only buttons dengan padding override → variant ghost + size icon/icon-sm; conditional active/inactive segmented buttons → `variant={active ? 'success' : 'secondary'}`. Total ~25 Button direfactor di SalaryDetailClient (12), SalaryUsersClient (5), HolidayClient (4), SupportDetailClient (3), ReportClient (1). 5 file lain (MissedCheckInCorrectionModal, RingtoneSettingsClient, ChatPageClient, ExpensesClient, ClaimReviewModal) sudah pakai variant yang benar — tidak perlu refactor.
- **Files**: `app/admin/salary/[id]/SalaryDetailClient.tsx`, `app/admin/salary/users/SalaryUsersClient.tsx`, `app/admin/kehadiran/holidays/HolidayClient.tsx`, `app/admin/support/[id]/SupportDetailClient.tsx`, `app/admin/kehadiran/laporan/ReportClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Refactor 12+ Button anti-pattern (className override → variant)

- **Tipe**: [FIXED]
- **Scope**: `app/admin/`, `app/(customer)/`, `components/`
- **Author**: agent
- **Deskripsi**: Setelah Button variant default jadi soft-tinted, audit codebase menemukan 12+ tombol pakai pattern lama: `<Button>` dengan `className` override massive (`bg-indigo-600 text-white px-4 py-2`) atau dengan text colored override (`text-indigo-600 hover:underline`) atau icon-only tanpa `variant="ghost"`. Refactor batch supaya semua pakai variant + size yang sesuai: `default` untuk primary CTA, `destructive` untuk delete, `success` untuk approve/upload, `outline` untuk Cancel di modal, `ghost` + `size="icon-sm"` untuk icon-only close, `link` untuk back/text-only navigation, dan `secondary`/`default` conditional untuk segmented toggle. Hasilnya: hapus ~40 baris className override, semua tombol sekarang follow design system tunggal dan otomatis konsisten dark/light mode.
- **Files**: `app/admin/support/[id]/SupportDetailClient.tsx`, `app/admin/salary/users/SalaryUsersClient.tsx`, `app/admin/salary/users/[id]/SalaryUserDetailClient.tsx`, `app/admin/salary/slip/[id]/SlipPrintClient.tsx`, `app/admin/log/login/LoginLogClient.tsx`, `app/admin/notifications/NotificationsClient.tsx`, `app/admin/lembur/components/EditModal.tsx`, `app/admin/finance/manual-payments/ManualPaymentClient.tsx`, `app/(customer)/tagihan/page.tsx`, `app/api/docs/ui/page.tsx`, `components/announcement/AnnouncementBanner.tsx`, `components/map/SettingsTab.tsx`, `components/map/NodeFormModal.tsx`, `components/notifications/WorkOrderBell.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Soft-tinted Button variants di light mode untuk konsistensi dark/light

- **Tipe**: [CHANGED]
- **Scope**: `components/ui/Button.tsx`
- **Author**: agent
- **Deskripsi**: Variant `default`/`destructive`/`success`/`warning` Button sebelumnya solid (`bg-indigo-600 text-white` dst) di light mode tapi sudah di-soften jadi outline halus di dark mode — hasilnya inkonsisten (light loud biru solid, dark classy outline). Refactor light mode ke soft-tinted (`bg-{color}-50 text-{color}-700 border-{color}-200`) supaya match tone dark mode. Tombol primary CTA seperti "Tambah Pengguna" (UserList) & "Bandingkan Kinerja" (ComparisonBar) yang sebelumnya tampil sebagai kotak biru solid sekarang lebih halus dan konsisten dengan tema. Hover state tetap pakai elevation (`hover:-translate-y-px`) untuk affordance.
- **Files**: `components/ui/Button.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Fix tombol icon-only & action button text invisible di light mode

- **Tipe**: [FIXED]
- **Scope**: `components/notifications/PushNotificationManager.tsx`, `components/karyawan/KaryawanPushNotification.tsx`, `components/inventory/PhotoGallery.tsx`, `components/map/NodeListTab.tsx`
- **Author**: agent
- **Deskripsi**: Beberapa tombol di light mode tampil sebagai kotak biru solid tanpa teks/icon terbaca. Penyebab: pakai `<Button>` (variant default = `bg-indigo-600 text-white`) lalu menimpa class custom `text-blue-600`/`text-red-600`/`text-gray-500` di anak — hasilnya warna text jadi mirip warna background biru → invisible. Fix: ganti ke `variant="ghost"` (transparent bg) + `size="icon-sm"` untuk tombol close, dan `variant="ghost" size="sm"` untuk tombol action Edit/Delete di tabel — sekarang warna text custom (blue/red) tampil di atas latar transparan, jelas terbaca.
- **Files**: `components/notifications/PushNotificationManager.tsx`, `components/karyawan/KaryawanPushNotification.tsx`, `components/inventory/PhotoGallery.tsx`, `components/map/NodeListTab.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Fix specificity safety net & soften Button outline di dark mode

- **Tipe**: [FIXED]
- **Scope**: `app/styles/base.css`, `components/ui/Button.tsx`
- **Author**: agent
- **Deskripsi**: Setelah patch sebelumnya, garis terang masih muncul di banner notifikasi & Topology Map. Investigasi build CSS Tailwind v4 menunjukkan utility class digenerate sebagai `.dark\:border-gray-700:is(.dark *)` dengan specificity (0,2,0), sementara safety net pakai `.dark :where(.border-gray-700)` dengan specificity (0,1,0) → safety net **kalah** dari utility Tailwind. Fix: ganti semua border/divide/ring safety net jadi `.dark.dark :is(...)` (specificity 0,3,0) supaya menang. Selector `:where()` dipertahankan untuk teks/background yang memang perlu fleksibel di-override per komponen. Plus: turunkan saturasi outline Button variant default/destructive/success/warning di dark dari `border-{color}-400` (sangat terang) ke `border-{color}-500/40` + hover ke `/60` supaya tombol "Aktifkan Notifikasi", "Nanti saja", X lebih halus tapi tetap terbaca. Outline & secondary variant juga diganti ke `border-white/10`, `bg-white/5`, dst untuk konsistensi.
- **Files**: `app/styles/base.css`, `components/ui/Button.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Soften colored alert borders & per-banner fix di dark mode

- **Tipe**: [FIXED]
- **Scope**: `app/styles/base.css`, `components/notifications/PushNotificationManager.tsx`, `components/karyawan/KaryawanPushNotification.tsx`
- **Author**: agent
- **Deskripsi**: Banner notifikasi seperti "Aktifkan Notifikasi" tampil dengan border ungu/biru yang menyala terang di dark mode. Penyebab: pattern umum `border-{color}-700/800` (mis. `dark:border-indigo-800` #3730a3) di atas bg `dark:bg-{color}-900/20` yang sangat tipis bikin border-warna terlihat seperti neon. Solusi sistemik: tambah safety net di `base.css` yang otomatis menurunkan opacity colored border alert (indigo/blue/cyan/emerald/green/amber/orange/yellow/red/pink/purple/rose/violet/teal/sky di intensitas 700/800/900) ke `rgb(<hue> / 0.25)` — masih punya nuansa warna alert tapi tidak menyala. Plus fix langsung 2 banner notifikasi (PushNotificationManager admin & KaryawanPushNotification) supaya tetap konsisten meski cache CSS belum invalidated.
- **Files**: `app/styles/base.css`, `components/notifications/PushNotificationManager.tsx`, `components/karyawan/KaryawanPushNotification.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Fix border terlalu terang di dark mode (theme safety net)

- **Tipe**: [FIXED]
- **Scope**: `app/styles/base.css`
- **Author**: agent
- **Deskripsi**: Border card & divider terlihat sangat terang ("garis putih") di banyak halaman dark mode (Dashboard, Update OTA, Sidebar, Modal, dll). Dua bug ditemukan: (1) safety net dark mode pakai `border-color: rgb(var(--color-border))`, padahal `--color-border` di dark sudah berformat `rgba(255,255,255,0.1)` lengkap → CSS jadi `rgb(rgba(...))` yang invalid → property di-ignore → fallback ke nilai Tailwind asli (terlalu terang). Diperbaiki jadi `border-color: var(--color-border)` langsung. (2) Safety net hanya cover `border-gray-100/200/300` & `divide-gray-100/200`, tidak cover `dark:border-gray-500/600/700/800/900`, custom `dark:border-gray-750`, directional borders (`border-l/r/t/b-*-700/800`), divides dengan opacity (`divide-gray-700/50`), maupun `ring-gray-600/700/800`. Selector `:where(...)` ditambah komprehensif untuk semua palette (gray/slate/zinc/neutral/stone) dengan specificity 0 — komponen tetap bisa override pakai `dark:border-*` per kebutuhan. Berlaku global tanpa modifikasi per file.
- **Files**: `app/styles/base.css`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Perbaiki garis pembatas tabel di dark mode (ResponsiveTable)

- **Tipe**: [FIXED]
- **Scope**: `components/ui/ResponsiveTable.tsx`
- **Author**: agent
- **Deskripsi**: Garis pembatas baris terlihat sangat terang ("putih") di dark mode pada halaman seperti Update Aplikasi (Expo OTA). Penyebab: (1) `dark:divide-gray-700` (#374151) terlalu kontras di atas `bg-gray-900` (#111827); (2) duplikasi `divide-y` di `<table>` dan `<tbody>` membuat border antar header→row dan row→row dirender ganda. Fix: hapus `divide-y` dari `<table>` (cukup di `<tbody>`), ganti `dark:divide-gray-700` ke `dark:divide-white/5` (rgba(255,255,255,0.05)) yang konsisten dengan token `--color-border` dark. Turunkan opacity `<thead>` dari `bg-slate-800/80` ke `bg-slate-800/60` agar selaras. Tiga state (loading/empty/data) semua di-update.
- **Files**: `components/ui/ResponsiveTable.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-16] — Migrasi OTA dari APK upload ke Expo Updates self-hosted

- **Tipe**: [CHANGED]
- **Scope**: `modules/app-update`, `app/api/admin/app-update`, `app/api/mobile/app-update`, `app/admin/pengaturan/app-update`, `lib/mobile-auth.ts`, `modules/users/services/MobileAuthVersionService.ts`, `prisma/schema.prisma`, `mobile-netmanager` (consumer)
- **Author**: agent
- **Deskripsi**: Ganti total flow OTA dari upload APK custom ke self-hosted Expo Updates protocol v1. Server jadi authoritative manifest source untuk JS bundle update; APK release tetap manual via Play Store. Hapus modul `app-version` lama (route admin/mobile, FE upload modal, R2 direct-upload, hash compute APK). Tambah modul `app-update` baru dengan: (a) schema `AppUpdate { manifestId, channel staging|production, runtimeVersion, platform, bundleHash, bundlePath, bundleSize, assets JSON, signature, signatureKeyId, releaseNotes, commitTime, isActive }`; (b) endpoint admin `POST /api/admin/app-update` (multipart bundle+manifest+assets), `GET/PATCH/DELETE /api/admin/app-update/[id]`; (c) endpoint public `GET /api/mobile/app-update/manifest` (Expo Updates protocol headers expo-runtime-version + expo-platform + expo-channel-name) dan `GET /api/mobile/app-update/asset` (stream bundle/asset by hash); (d) RSA-SHA256 code signing dengan env `APP_UPDATE_SIGNING_KEY_ID` + `APP_UPDATE_SIGNING_PRIVATE_KEY`; (e) admin UI baru di `/admin/pengaturan/app-update` dengan list + filter + toggle active + delete; (f) gating versi native pindah ke env `MOBILE_MIN_NATIVE_VERSION_CODE` (server tidak lagi gating berdasarkan tabel app_versions). Mobile (`mobile-netmanager`): install `expo-updates`, configure `app.json` updates URL + `runtimeVersion: { policy: "appVersion" }` + `codeSigningCertificate`, rewrite `useAppVersion`/`useVersionCheck` ke pakai `Updates.checkForUpdateAsync` + `fetchUpdateAsync` + `reloadAsync`, hapus `AppVersionService` legacy yang download APK manual + native install.
- **Files**: `prisma/schema.prisma`, `prisma/migrations/20260516000000_archive_legacy_app_versions/`, `prisma/migrations/20260516001000_add_app_updates/`, `modules/app-update/**`, `app/api/admin/app-update/**`, `app/api/mobile/app-update/**`, `app/admin/pengaturan/app-update/**`, `lib/menu-config.ts`, `lib/mobile-auth.ts`, `lib/mobile-api-auth.ts`, `lib/api/handler.ts`, `app/api/mobile/auth/refresh/route.ts`, `modules/users/services/MobileAuthVersionService.ts`, `server.ts`, `tests/**`, `mobile-netmanager/{app.json,src/hooks/useAppVersion.ts,src/hooks/useVersionCheck.ts,src/components/molecules/UpdateAvailableModal.tsx,src/components/templates/UpdateRequiredScreen.tsx}`
- **Migration**: `20260516000000_archive_legacy_app_versions` (rename `app_versions` → `app_versions_legacy`, drop FK, tambah `apkHash`), `20260516001000_add_app_updates` (CREATE TABLE `app_updates`)
- **Breaking**: ✅ Ya — endpoint `/api/admin/app-version`, `/api/mobile/app-version/*` dihapus total. App lama (≤ 1.0.4) yang sudah di-install akan dapat 404 saat hit endpoint lama; rilis APK 1.0.5 dengan expo-updates di Play Store akan ambil alih flow update. Set ENV produksi: `APP_UPDATE_SIGNING_KEY_ID`, `APP_UPDATE_SIGNING_PRIVATE_KEY` (PEM), opsional `APP_UPDATE_BASE_URL`, dan `MOBILE_MIN_NATIVE_VERSION_CODE` (default 0 = disabled).

### [2026-05-15] — APK 500MB: stream-to-disk + naikkan memory pod app

- **Tipe**: [INFRA]
- **Scope**: `lib/utils/r2-client.ts`, `modules/app-version/services/*`, `k8s/staging/app-deployment.yaml`, `k8s/production/app-deployment.yaml`
- **Author**: agent
- **Deskripsi**: Mendukung APK build berukuran ~300–500MB tanpa risiko OOM di pod app. (1) Tambah helper `streamR2ObjectToFile(key, dest)` di `r2-client.ts` yang stream R2 object langsung ke disk via `pipeline` (tanpa buffer in-memory). (2) Refactor `AppVersionUploadService` & `AppVersionService.parseUploadedApk` agar pakai temp-file alih-alih `apkBuffer` — `loadUploadedApkDetails` sekarang return `apkPath` + `cleanup` callback, dengan unlink di `finally`. (3) Naikkan memory pod app: staging `1152Mi → 2Gi` (request `384Mi → 512Mi`), production `1536Mi → 3Gi` (request `512Mi → 768Mi`) untuk memberi headroom Node.js + parsing APK ZIP. (4) Update tests untuk mock `streamR2ObjectToFile` ganti `getR2ObjectBuffer`. Tidak ada perubahan ingress (Traefik tidak punya body limit default).
- **Files**: `lib/utils/r2-client.ts`, `modules/app-version/services/{AppVersionService.ts,AppVersionUploadService.ts,app-version-storage.helpers.ts}`, `k8s/{staging,production}/app-deployment.yaml`, `tests/modules/app-version/AppVersionService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Naikkan limit APK ke 500MB & auto-detect versi setelah upload

- **Tipe**: [CHANGED]
- **Scope**: `modules/app-version`, `app/api/admin/app-version`, `app/admin/pengaturan/app-version`
- **Author**: agent
- **Deskripsi**: APK build sekarang bisa mencapai ~300MB; limit 100MB ditolak di endpoint `upload-url`. Naikkan `APP_VERSION_MAX_APK_BYTES` ke 500MB di backend dan FE (`AppVersionClient.tsx`). Tambah endpoint `POST /api/admin/app-version/parse` + method `AppVersionService.parseUploadedApk(uploadedKey)` yang membaca metadata APK dari direct-upload R2. UI upload modal di-refactor: saat user pilih file → langsung upload ke R2 (progress bar tetap), lalu panggil `/parse` untuk auto-fill field Versi/Build/Code. Saat metadata terdeteksi, ditampilkan label "Auto-detected" dan field di-disable; sebelum terdeteksi user tetap bisa edit manual. Submit final hanya kirim metadata + `uploadedKey` (tidak upload ulang). Mode `forceLocal` tetap pakai jalur lama (parsing server-side saat submit).
- **Files**: `modules/app-version/{validators/index.ts,services/AppVersionService.ts}`, `app/api/admin/app-version/{parse/route.ts,upload-url/route.ts}`, `app/admin/pengaturan/app-version/AppVersionClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Review modul app-version: hapus dead code, typed errors, dan stream APK download

- **Tipe**: [CHANGED]
- **Scope**: `modules/app-version`, `app/api/admin/app-version`, `app/api/mobile/app-version`
- **Author**: agent
- **Deskripsi**: Review menyeluruh modul Versi Aplikasi. (1) Hapus dead/duplikat: folder `factories/`, `mappers/`, `dto/`, `types/`, `utils/`, dan helper duplikat `app-version-storage-helpers.ts` + `app-version-upload-helpers.ts` (zero usage). (2) Tambah typed errors `AppVersionValidationError`, `AppVersionConflictError`, `AppVersionNotFoundError` di `modules/app-version/errors.ts` agar route bisa map ke status code yang tepat tanpa string-matching pada `error.message`. (3) Fix urutan delete: `repository.delete` dijalankan sebelum cleanup APK fisik supaya state tidak inconsistent saat DB delete gagal. (4) Stream APK pada endpoint download mobile alih-alih buffering full file ke memori (potensi OOM untuk APK 100MB ketika banyak request). (5) Standarisasi error handler routes mobile (`check`, `report`, `download`) memakai `apiError`/`ErrorCodes` ganti `NextResponse.json({ error })`. (6) Tambah Zod schema `reportMobileVersionSchema` & `checkVersionQuerySchema` agar validasi input mobile terpusat. (7) Hapus dead helper `buildUpdatePayload` (Prisma sudah skip undefined). (8) Konsisten konstanta `APP_VERSION_MAX_APK_BYTES`.
- **Files**: `modules/app-version/{errors.ts,index.ts,validators/index.ts,services/*}`, `app/api/admin/app-version/{route.ts,upload-url/route.ts,[id]/route.ts}`, `app/api/mobile/app-version/{check,report,download/[id]}/route.ts`, `tests/modules/app-version/AppVersionService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-15] — Revert P1-5 storageClassName eksplisit (StatefulSet immutable)

- **Tipe**: [FIXED]
- **Scope**: `k8s/staging/db-statefulset.yaml`, `k8s/production/db-statefulset.yaml`, `k8s/staging/pvc.yaml`, `k8s/production/pvc.yaml`
- **Author**: agent
- **Deskripsi**: Build #619 fail di stage Database Migration karena `kubectl apply` ke 4 StatefulSet `db-*` ditolak dengan error `StatefulSet.apps "db-..." is invalid: spec: Forbidden: updates to statefulset spec for fields other than 'replicas', 'ordinals', 'template', 'updateStrategy', 'revisionHistoryLimit', 'persistentVolumeClaimRetentionPolicy' and 'minReadySeconds' are forbidden`. K8s API tidak mengizinkan update `volumeClaimTemplates.spec.storageClassName` di StatefulSet existing. Sama untuk PVC existing. Revert P1-5 (commit `71515820b`) untuk 4 file: db-statefulset (prod & staging) dan pvc (prod & staging). P1-6 tujuan masih valid (eksplisit storageClassName mencegah silent data loss saat default StorageClass berubah), tapi hanya bisa di-apply saat **fresh cluster atau StatefulSet recreate** — bukan in-place update. Catat sebagai known limitation untuk migrasi cluster di masa depan. Other P1 fixes (probes, race condition fix, branch routing, backup-db.sh, migration imagePullPolicy) tidak terpengaruh — tetap valid.
- **Files**: `k8s/{staging,production}/db-statefulset.yaml`, `k8s/{staging,production}/pvc.yaml`
- **Breaking**: ❌ Tidak

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
