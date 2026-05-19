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

### [2026-05-20] — Design doc modul akuntansi (double-entry GL)

- **Tipe**: [DOCS]
- **Scope**: `docs/superpowers/specs/`
- **Author**: agent
- **Deskripsi**: Spec design untuk modul `accounting` baru — double-entry GL dengan auto-journal dari `finance` via outbox pattern. Mencakup Chart of Accounts, JournalEntry/Line, AccountingPeriod, recurring journal, bank reconciliation, dan 4 laporan inti (Buku Kas & Bank, Laba Rugi, Neraca, Arus Kas). Migration plan production-safe (8 file, additive, reversible) + roadmap pasca-v1.
- **Files**: `docs/superpowers/specs/2026-05-20-accounting-module-design.md`
- **Breaking**: ❌ Tidak

### [2026-05-19] — Fix page-level vs API-level permission mismatch

- **Tipe**: [FIXED]
- **Scope**: `app/admin/finance`, `app/admin/mitra`, `app/admin/pelanggan`, `app/admin/registrations`, `app/admin/workorders`, `app/admin/users`, `app/admin/inventory`, `lib/permission-config.ts`
- **Author**: agent
- **Deskripsi**: Audit lanjutan menemukan 13+ kasus serupa bug whatsapp 403: page-level `ensurePermission` mengecek resource X, tapi API yang dipanggil halaman cek resource Y, atau client-side `hasPermission()` pakai resource yang tidak ada di catalog. Akibatnya: page bisa render tapi API 403, atau UI section/tombol dead karena tidak pernah lulus check.
- **Files**:
  - `app/admin/finance/manual-payments/page.tsx` — `finance:read` → `ensureAnyPermission(['manual_payments:read', 'finance:read'])`
  - `app/admin/mitra/page.tsx`, `mitra/[id]/page.tsx` — `users:read` → `mitra:read`
  - `app/admin/mitra/withdrawals/page.tsx` — `users:read` → `withdrawals:read`
  - `app/admin/pelanggan/ppp/[id]/notification-history/page.tsx` — `pelanggan:read` → `ensureAnyPermission(['notifications:read', 'pelanggan:read'])`
  - `app/admin/registrations/[id]/page.tsx` — `registrations:read` (plural invalid) → `registration:read`
  - `app/admin/workorders/templates/page.tsx`, `templates/new/page.tsx` — `workorder_templates:*` (resource invalid) → `wo_template:*`
  - `app/admin/users/new/UsersNewClient.tsx`, `users/[id]/UsersDetailClient.tsx` — `payroll:read` (resource invalid) → `salary:read`
  - `app/admin/inventory/page.tsx` — hapus `stock:read` (invalid), tambah `inventory:read`
  - `lib/permission-config.ts` — tambah resource `tenants` untuk `tenants:read` di UsersDetailView/Client/New
- **Breaking**: ❌ Tidak

### [2026-05-19] — Fix permission tidak match catalog (whatsapp 403, dll)

- **Tipe**: [FIXED]
- **Scope**: `lib/permission-config.ts`, `app/api/admin/whatsapp`, `app/api/settings`, `app/api/admin/invoices`, `app/api/admin/reports/presence`, `app/api/invoices`, `modules/roles/factories/RoleFactory.ts`
- **Author**: agent
- **Deskripsi**: User pakai role custom dengan permission `whatsapp:read` aktif tapi tetap dapat 403 di `/api/admin/whatsapp/accounts`. Akar masalah: endpoint cek `settings:read`/`settings:write` — resource `settings` dan action `write` tidak ada di catalog, sehingga mustahil tersedia di role manapun (kecuali super admin wildcard). Audit komprehensif menemukan 36+ permission strings serupa yang tidak match catalog.
- **Files**:
  - `lib/permission-config.ts` — tambah resource `invoices`, `payments`, `tickets`, `bank_accounts`, `notifications`, `wo_escalation`, `wo_sla`, `wo_template`; tambah action `manage`
  - `app/api/admin/whatsapp/**/*.ts` — ganti `settings:read`/`settings:write` ke `whatsapp:read`/`whatsapp:create`/`whatsapp:update`/`whatsapp:delete` sesuai operasi
  - `app/api/settings/general/route.ts`, `app/api/settings/api/route.ts` — hapus duplikat `settings:*`, ganti `settings:update` ke `umum:update`
  - `app/api/admin/invoices/[id]/void/route.ts` — `finance:void-invoice` → `finance:update:void` (granular yang sudah ada)
  - `app/api/admin/reports/presence/route.ts` — `attendance:report:view` → `report:read`
  - `app/api/invoices/route.ts`, `app/api/invoices/[id]/route.ts` — `invoice:site_only` → `invoices:site_only` (konsisten dengan catalog plural)
  - `modules/roles/factories/RoleFactory.ts` — fix permission template (sebelumnya banyak permission tidak valid: `tickets:assign`, `packages:read`, `attendance:checkin/checkout`, `reports:finance`, `reports:sales`, `workorders:assign`, `attendance:approve`, `settings:*`)
- **Breaking**: ❌ Tidak (resource baru ditambah ke catalog; tidak ada permission valid yang dihapus)

### [2026-05-19] — Tambah cursor pagination di GET /api/marketing/canvasing

- **Tipe**: [ADDED]
- **Scope**: `app/api/marketing/canvasing`, `modules/marketing`
- **Author**: agent
- **Deskripsi**: Endpoint list canvasing kini mendukung cursor-based pagination (`?cursor=<lastId>&limit=N`) selain page-based existing (`?page=&limit=`). Mobile pakai `useInfiniteQuery` dan butuh `nextCursor` untuk infinite scroll; sebelumnya request `?cursor=...` dari mobile diabaikan (default `page=1`) sehingga list mentok di 10 record terbaru. Repository `findAll()` extend dengan opsi cursor + tie-breaker `id` desc supaya ordering deterministik. Response shape ditambah field `nextCursor` (null saat page-based atau halaman terakhir). Admin web tetap pakai page-based, fully backwards-compatible.
- **Files**: `app/api/marketing/canvasing/route.ts`, `modules/marketing/domain/ports/ICanvasingRepository.ts`, `modules/marketing/repositories/CanvasingRepository.ts`, `modules/marketing/services/CanvasingService.ts`, `tests/modules/marketing/CanvasingRepository.test.ts`, `tests/modules/marketing/CanvasingService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-19] — Update label data-fetching standard di CLAUDE.md (SWR → TanStack Query)

- **Tipe**: [DOCS]
- **Scope**: `CLAUDE.md`
- **Author**: agent
- **Deskripsi**: Daftar Detailed Documentation di `CLAUDE.md` masih menyebut `Data Fetching (SWR)` padahal project sejak Phase 1-5 sudah full pakai TanStack Query v5 (`@tanstack/react-query ^5.100.10`, 18 file source, 0 import `swr`, dependency `swr` tidak ada di `package.json`). Isi `docs/standards/data-fetching.md` sendiri sudah benar TanStack Query — yang outdated hanya label pointer-nya. Referensi SWR di `docs/CHANGELOG.md` dan `docs/reports/*` historical tidak diubah karena memang catatan kondisi saat itu.
- **Files**: `CLAUDE.md`
- **Breaking**: ❌ Tidak

### [2026-05-19] — Deep scan fix unwrap envelope dropdown 5 lokasi

- **Tipe**: [FIXED]
- **Scope**: `app/admin/investors`, `app/(customer)/tagihan`, `components/attendance`,
  `app/admin/integrations/mixradius/expenses`, `app/admin/workorders/new`
- **Author**: agent
- **Deskripsi**: Deep scan menemukan 5 lokasi tambahan dengan bug unwrap
  envelope identik (klien akses `data?.data` atau check `obj.success`
  padahal `useApi`/`fetchWithHandling` sudah me-unwrap envelope):
  1. `InvestorsClient.tsx:114` — list investor kosong
     (`useApi<{ data?: Investor[] }>` → akses `.data` undefined).
  2. `tagihan/page.tsx:185` — payment methods customer kosong
     (`useApi<{ success?, data? }>` → akses `.data` undefined).
  3. `AttendancePageContent.tsx:115,126` — status absensi tidak ter-set
     (block `obj.success && obj.data` selalu skip).
  4. `RABView.tsx:102,113` — modal revisions & summary kosong
     (`useApi<{ data: ... }>` → akses `.data` undefined).
  5. `WoNewClient.tsx:141` — auto-fill data tiket support saat user
     buka URL `?ticketId=` tidak jalan (raw fetch akses `data.ticket`
     padahal envelope `{ success, data: ticketEntity }`).

  Semua dikoreksi: type generic ke shape data langsung, akses `.data`
  dihapus, untuk raw fetch akses `response.data` (envelope-aware).
- **Files**:
  `app/admin/investors/InvestorsClient.tsx`,
  `app/(customer)/tagihan/page.tsx`,
  `components/attendance/AttendancePageContent.tsx`,
  `app/admin/integrations/mixradius/expenses/RABView.tsx`,
  `app/admin/workorders/new/WoNewClient.tsx`
- **Breaking**: ❌ Tidak
### [2026-05-19] — Fix dropdown Site/Owner/Group kosong di mixradius pages

- **Tipe**: [FIXED]
- **Scope**: `app/admin/integrations/mixradius`
- **Author**: agent
- **Deskripsi**: Dropdown Site/Owner/Group dan filter Mitra/Payout di
  halaman `/admin/integrations/mixradius`, `/admin/integrations/mixradius/isolir`,
  dan `/admin/integrations/mixradius/income-period` selalu kosong padahal
  API mengembalikan list valid. Akar masalah identik dengan bug yang baru
  saja di-fix di workorder/new dan announcement: klien hydrasi state via
  `obj.success && Array.isArray(obj.data)` — tapi `useApi` (lewat
  `fetchWithHandling`) sudah me-unwrap envelope `{ success, data }`,
  sehingga `obj` langsung berisi array (`obj.success` = `undefined`,
  `obj.data` = `undefined`). Seluruh blok hydrasi skipped → state lokal
  tetap kosong → dropdown kosong.
  Dikoreksi: type generic `useApi` diset langsung ke shape data dari
  payload, akses ke `.success` & `.data` dihapus. `MixRadiusClient`
  dipindah ke pattern derived state via `useMemo` (single source of
  truth). Config error MixRadius (status 400 dengan
  `details.isConfigError`) dipropagasi via `FetchError` dari `useApi.error`,
  bukan via fake `data.error`.
- **Files**:
  `app/admin/integrations/mixradius/MixRadiusClient.tsx`,
  `app/admin/integrations/mixradius/income-period/hooks/useIncomePeriodData.ts`
- **Breaking**: ❌ Tidak
### [2026-05-19] — Fix submit gagal di workorder/new (pelangganId null)

- **Tipe**: [FIXED]
- **Scope**: `app/admin/workorders/new`, `tests/app/admin/workorders`
- **Author**: agent
- **Deskripsi**: Submit form di `/admin/workorders/new` gagal diam-diam
  saat user pilih WO Internal atau Customer dengan mode Guest. Akar
  masalah: payload mengirim `pelangganId: null` ke API, padahal Zod
  schema `workOrderCreateSchema` mendeklarasi field sebagai
  `z.string().trim().optional()` yang berarti `string | undefined` —
  `null` ditolak validasi, request kena 400. Dikoreksi: klien sekarang
  mengirim `undefined` (yang ter-strip dari JSON.stringify) untuk
  kasus INTERNAL/Guest/empty string, sehingga schema cocok dan submit
  diteruskan ke service.
  Logic build payload diekstrak ke pure function `buildWorkOrderPayload`
  di `work-order-payload.ts` agar testable. Tambah 22 unit test yang
  menutup semua kombinasi (INTERNAL/CUSTOMER × Guest/Customer-by-id ×
  field opsional kosong/terisi) plus 5 integration test memastikan
  payload dari `buildWorkOrderPayload` lolos validasi
  `workOrderCreateSchema`. Termasuk regression test eksplisit yang
  mengunci behavior: `pelangganId: null` ditolak Zod (akar bug).
- **Files**:
  `app/admin/workorders/new/WoNewClient.tsx`,
  `app/admin/workorders/new/work-order-payload.ts`,
  `tests/app/admin/workorders/work-order-payload.test.ts`
- **Breaking**: ❌ Tidak
### [2026-05-19] — Fix dropdown Site/Area & Department kosong di workorder/new

- **Tipe**: [FIXED]
- **Scope**: `app/admin/workorders/new`, `app/admin/integrations/mixradius/expenses`
- **Author**: agent
- **Deskripsi**: Dropdown "Site / Area" dan "Department" di
  `/admin/workorders/new` tidak menampilkan data padahal API
  `/api/admin/sites` dan `/api/admin/departments` mengembalikan list
  yang valid. Akar masalah: klien menggunakan `useApi<{ data?: Site[] }>`
  dan akses `sitesRaw?.data` — tapi `useApi` (lewat `fetchWithHandling`)
  sudah me-unwrap envelope `{ success, data }`, sehingga `sitesRaw`
  langsung berisi array. Akses `.data` mengembalikan `undefined` →
  array kosong → dropdown kosong. Type generic dikoreksi langsung ke
  `Site[]` / `Department[]` dan akses `.data` dihapus.
  Saat investigasi, ditemukan bug identik di
  `mixradius/expenses/ExpensesClient.tsx` — 7 dropdown rusak (sites,
  investorSites, internalSites, filterCategories, categories modal,
  rabProjects, rabMetrics). Semua dikoreksi: type generic ke shape
  data langsung, akses `.data` dihapus.
- **Files**:
  `app/admin/workorders/new/WoNewClient.tsx`,
  `app/admin/integrations/mixradius/expenses/ExpensesClient.tsx`
- **Breaking**: ❌ Tidak
### [2026-05-19] — Hardening admin/log/activity (Zod + UX refactor)

- **Tipe**: [SECURITY]
- **Scope**: `app/api/admin/system-logs`, `modules/admin/validators`,
  `app/admin/log/activity`, `app/admin/log/loading.tsx`
- **Author**: agent
- **Deskripsi**: Endpoint `GET /api/admin/system-logs` sebelumnya parse
  `page`/`limit` dengan `parseInt` tanpa guard NaN dan tanpa cap upper
  bound — caller bisa kirim `?page=abc` (NaN propagate ke Prisma `skip`)
  atau `?limit=10000` (DoS vector). Sekarang seluruh query params
  divalidasi via `systemLogQuerySchema` (Zod): page/limit fallback ke
  default saat NaN, limit di-cap maksimal 100, search dibatasi 200
  karakter, siteId divalidasi UUID, type harus enum `LogType`.
  Anti-pattern setState sentinel di body render (`prevSiteId`/`prevSearch`
  comparator) diganti single state object dengan `patchFilters` setter
  yang reset page ke 1 — menghindari warning Next 16 "Can't perform a
  React state update on a component that hasn't mounted yet".
  Modal detail JSON sekarang me-redact field sensitif (password, token,
  secret, api_key, otp, dst.) dengan regex pattern sebelum render
  agar PII tidak bocor ke admin panel. Format JSON dipindah ke
  `useMemo` agar tidak re-compute setiap render.
  Search input dibatasi `maxLength={200}` untuk mencegah paste payload
  raksasa.
  Komponen `ClientComponent` di-rename `ActivityLogClient`. Magic
  numbers `20`/`500` diekstrak ke `PAGE_SIZE`/`SEARCH_DEBOUNCE_MS`.
  Color logic action diekstrak ke `ACTION_BADGE_CLASS` Record.
  Inline `Button` style override panjang diganti `variant="outline"`.
  Skeleton tab nav misleading dihapus dari `loading.tsx` karena tab
  di-render layout dan tidak ikut loading.
- **Files**:
  `app/api/admin/system-logs/route.ts`,
  `modules/admin/validators/system-log.ts`,
  `modules/admin/validators/index.ts`,
  `modules/admin/index.ts`,
  `app/admin/log/activity/ActivityLogClient.tsx`,
  `app/admin/log/activity/page.tsx`,
  `app/admin/log/loading.tsx`
- **Breaking**: ❌ Tidak
### [2026-05-19] — Hardening permission API admin/support

- **Tipe**: [SECURITY]
- **Scope**: `app/api/admin/support-tickets`
- **Author**: agent
- **Deskripsi**: Endpoint `POST /api/admin/support-tickets/[id]/reply` dan
  `GET /api/admin/support-tickets/unread-count` sebelumnya hanya cek
  `requireAuth` tanpa permission check — siapapun yang login bisa balas
  tiket atas nama admin atau melihat jumlah tiket. Sekarang reply enforce
  `support:update` dan unread-count enforce `support:read` (dual-layer:
  service-side check tetap ada untuk site restriction).
- **Files**:
  `app/api/admin/support-tickets/[id]/reply/route.ts`,
  `app/api/admin/support-tickets/unread-count/route.ts`
- **Breaking**: ❌ Tidak

### [2026-05-19] — Refactor admin/support UI

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/support`
- **Author**: agent
- **Deskripsi**: List page (`SupportContent`) direfactor dari raw `fetch` +
  `setTimeout(..., 0)` workaround ke `useApi` (TanStack Query) + `useDebounce`
  (400ms) untuk search. Filter sekarang otomatis reset ke halaman 1 via
  single state object. Function name typo `SupportContext` diperbaiki jadi
  `SupportContent`. State `_total` unused dipakai untuk tampilan total tiket
  di pagination.
  Detail page (`SupportDetailClient`) dipecah dari god-component 770 baris
  menjadi 5 sub-component + 2 hook (`TicketHeader`, `MessagesList`,
  `ReplyComposer`, `CustomerInfoSidebar`, `CloseTicketModal`,
  `useFileUpload`, `useTicketActions`). Side-effect setState di body render
  diganti dengan derived state + `key={id}` di Page untuk reset state saat
  navigasi antar tiket.
  Bug fungsional fix: klien sebelumnya kirim field `closingNote` saat
  menutup tiket, padahal Zod schema mengharapkan `resolution` — catatan
  penutup tidak pernah tersimpan. Sekarang field disesuaikan dengan schema.
  Optimistic update reply diperbaiki: `fetchWithHandling` mengunwrap
  envelope `{ success, data }` agar `data.reply` selalu valid; gagal kirim
  menampilkan toast spesifik dan restore input.
  4× `alert()` browser native diganti `useToast` untuk feedback upload.
  Magic number 5MB diekstrak jadi `MAX_UPLOAD_BYTES` constant. Komponen
  `ClientComponent` di-rename `SupportDetailClient`. Rating extraction
  via emoji counting di-refactor ke regex anchored `/(⭐{1,5})/` untuk
  deterministik.
- **Files**:
  `app/admin/support/SupportContent.tsx`,
  `app/admin/support/[id]/page.tsx`,
  `app/admin/support/[id]/SupportDetailClient.tsx`,
  `app/admin/support/[id]/_components/{TicketHeader,MessagesList,ReplyComposer,CustomerInfoSidebar,CloseTicketModal,useFileUpload,useTicketActions,types}.{tsx,ts}`
- **Breaking**: ❌ Tidak
### [2026-05-19] — Hardening security admin/announcement (RBAC + Zod)

- **Tipe**: [SECURITY]
- **Scope**: `app/api/announcements`, `modules/notification`, `lib/role-templates.ts`
- **Author**: agent
- **Deskripsi**: Endpoint `/api/announcements` (GET/POST) dan
  `/api/announcements/[id]` (PUT/DELETE) sebelumnya hanya cek `requireAuth`
  tanpa permission check — siapapun yang login (customer/karyawan biasa)
  bisa membuat/mengubah/menghapus pengumuman global. Sekarang setiap
  endpoint enforce permission spesifik (`announcement:create`,
  `announcement:update`, `announcement:delete`). GET tetap bisa diakses
  tanpa permission khusus bila ada parameter `portal` (digunakan oleh
  Banner customer/karyawan), namun bila tanpa portal wajib
  `announcement:read`. Body request divalidasi Zod schema
  (`createAnnouncementSchema`, `updateAnnouncementSchema`) dengan rule
  panjang field, audience enum, dan `endDate > startDate`. Error
  internal tidak lagi bocor ke client (`String(error)` diganti
  `ApiErrors.internalError(...)` + `logger.error`). Permission baru
  `announcement:delete` ditambahkan ke role template Admin.
- **Files**:
  `app/api/announcements/route.ts`,
  `app/api/announcements/[id]/route.ts`,
  `modules/notification/validators/announcementValidator.ts`,
  `modules/notification/index.ts`,
  `lib/role-templates.ts`,
  `tests/api/announcements-route.test.ts`
- **Note**: Status code POST `/api/announcements` berubah dari 200 → 201
  (REST convention untuk create). FE existing memakai `res.ok`/`res.success`
  yang true untuk keduanya, sehingga tidak ada perubahan UX.
- **Breaking**: ❌ Tidak

### [2026-05-19] — Refactor admin/announcement UI

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/announcement`, `components/announcement`
- **Author**: agent
- **Deskripsi**: List, form, banner, dan popup announcement direfactor:
  `confirm()`/`alert()` native diganti `ConfirmDialog` + `useToast`,
  raw `fetch` diganti `fetchWithHandling` agar envelope ter-unwrap dan
  error spesifik tampil. Validasi `endDate > startDate` ditambahkan di
  client. Dead-code comment dihapus dari Banner. `AnnouncementPopup`
  membungkus akses `localStorage` dengan helper try/catch agar tidak
  crash bila storage corrupt. Bahasa UI distandardisasi ke Bahasa
  Indonesia. Magic class duplicate (`dark:bg-blue-500 dark:bg-blue-400`)
  dibersihkan dengan memakai `Button` component. Komponen `ClientComponent`
  generic di-rename: `EditAnnouncementContent` (server data loader),
  `AnnouncementCreateClient`, `AnnouncementIndexClient` agar nama
  mencerminkan peran sebenarnya.
- **Files**:
  `app/admin/announcement/AnnouncementIndexClient.tsx`,
  `app/admin/announcement/page.tsx`,
  `app/admin/announcement/_components/AnnouncementForm.tsx`,
  `app/admin/announcement/create/AnnouncementCreateClient.tsx`,
  `app/admin/announcement/create/page.tsx`,
  `app/admin/announcement/[id]/EditAnnouncementContent.tsx`,
  `app/admin/announcement/[id]/page.tsx`,
  `components/announcement/AnnouncementBanner.tsx`,
  `components/announcement/AnnouncementPopup.tsx`
- **Breaking**: ❌ Tidak
### [2026-05-19] — Fix anti-pattern setState di render body (12 file)

- **Tipe**: [FIXED]
- **Scope**: `app/admin`, `components`, `lib/websocket/hooks`
- **Author**: agent
- **Deskripsi**: Pola `if (!hasFetched) { setHasFetched(true); void fetchX(); }`
  di body render menyebabkan warning Next 16: "Can't perform a React state
  update on a component that hasn't mounted yet" — fungsi async lalu mencoba
  setState setelah komponen mungkin sudah unmount. Dimigrasikan ke
  `useRef(false) + useEffect` yang merupakan idiom React standar untuk
  "run-once on mount" tanpa memicu rerender atau warning ESLint
  `react-hooks/set-state-in-effect`. Sekaligus wrap `fetchStats`,
  `fetchExpenses`, `fetchMetadata` dengan `useCallback` agar dependency
  `useEffect` stabil (warning `react-hooks/exhaustive-deps`).
- **Files**:
  `app/admin/inventory/transfer/TransferList.tsx`,
  `app/admin/network/mikrotik/[id]/edit/MikrotikEditClient.tsx`,
  `app/admin/kehadiran/izin/IzinClient.tsx`,
  `app/admin/inventory/restock/useRestockPage.ts`,
  `app/admin/finance/pengeluaran/ExpenseClient.tsx`,
  `app/admin/notifications/email-logs/EmailLogsClient.tsx`,
  `components/inventory/StatsCards.tsx`,
  `components/inventory/assets/AssetTable.tsx`,
  `components/map/useMapData.ts`,
  `lib/websocket/hooks/useRealtimePaymentApprovals.ts`,
  `lib/websocket/hooks/useRealtimeNotifications.ts`,
  `lib/websocket/hooks/useCustomerNotifications.ts`
- **Breaking**: ❌ Tidak

### [2026-05-19] — Hindari double validate gudang access di create opname

- **Tipe**: [FIXED]
- **Scope**: `modules/inventory/services`
- **Author**: agent
- **Deskripsi**: Saat refactor `createInventoryOpname` untuk mendukung batch
  processor, `validateOpnameGudangAccess` ter-call dua kali (di entry dan di
  dalam transaksi) yang menyebabkan call ekstra ke `gudang.findUnique` per
  invocation. Dipusatkan ke `createOpnameInTransaction` saja agar 1× call
  validate per item, sekaligus memperbaiki test legacy yang gagal akibat
  mock `gudang.findUnique` habis di-`mockResolvedValueOnce`.
- **Files**: `modules/inventory/services/inventory-opname-create.helpers.ts`
- **Breaking**: ❌ Tidak
### [2026-05-19] — Hapus dead code EnhancedOpnameForm

- **Tipe**: [REMOVED]
- **Scope**: `components/inventory`
- **Author**: agent
- **Deskripsi**: Komponen `EnhancedOpnameForm.tsx` (700 baris) tidak digunakan
  di mana pun di codebase. Komponen ini punya bug serupa dengan `StockOpnameRecorder`
  lama (raw fetch tanpa unwrap envelope) dan menambah maintenance surface tanpa
  manfaat. Dihapus untuk mengurangi noise dan menghindari kebingungan.
- **Files**: `components/inventory/EnhancedOpnameForm.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-19] — Refactor OpnameForm modal Edit

- **Tipe**: [CHANGED]
- **Scope**: `components/inventory`
- **Author**: agent
- **Deskripsi**: Komponen `OpnameForm.tsx` (modal Edit di tab Riwayat Opname)
  direfactor dari pola lama (manual `getWithAuth/postWithAuth` + side-effect di
  render body) ke pola baru (`useApi` untuk fetch + `fetchWithHandling` untuk
  mutation). Side-effect auto-distribute kondisi dipindah ke event handler
  via reducer murni `syncDerivedFormFields` sehingga tidak ada lagi setState
  di body render. Form fields dipecah menjadi sub-components reusable
  (`SelectField`, `TextField`, `NumberField`, `DateField`, `TextareaField`,
  `ConditionBreakdown`, `StockInfo`) untuk SRP.
- **Files**: `components/inventory/OpnameForm.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-19] — Unit test mapping movement opname & validator

- **Tipe**: [ADDED]
- **Scope**: `modules/inventory`, `tests/modules/inventory`
- **Author**: agent
- **Deskripsi**: Ekstrak helper pure `inventory-opname-movement-mapping.helpers.ts`
  (`isAdministrativeAdjustment`, `resolvePositiveMovementCondition`,
  `resolveNegativeMovementCondition`) dari `inventory-opname-create.helpers.ts`
  agar testable tanpa mock DB. Tambah 28 unit test (16 untuk mapping helper,
  12 untuk Zod validator) yang menjaga behavior klasifikasi mutasi opname dan
  rule validasi payload tidak regresi.
- **Files**:
  `modules/inventory/services/inventory-opname-movement-mapping.helpers.ts`,
  `tests/modules/inventory/inventory-opname-movement-mapping.helpers.test.ts`,
  `tests/modules/inventory/opnameValidator.test.ts`
- **Breaking**: ❌ Tidak
### [2026-05-19] — Hardening tab Input Stock Opname

- **Tipe**: [FIXED]
- **Scope**: `components/inventory`, `modules/inventory`, `app/api/inventory/opname`
- **Author**: agent
- **Deskripsi**: Perbaikan bug blocker pada tab "Input Stock Opname" (admin/inventory/opname).
  Klien sebelumnya tidak melakukan unwrap envelope `{ success, data }`, sehingga
  `calculatedData` selalu kosong dan tabel input tidak pernah tampil. Side-effect
  `fetch` dilakukan di body render (anti-pattern) dan handler input Baik/Rusak/Bekas
  punya race condition karena membaca closure stale. Submit memakai N×POST tanpa
  atomicity sehingga gagal sebagian membuat partial commit. Sekarang seluruh
  request via `fetchWithHandling`, fetch trigger lewat `useApi` (TanStack Query),
  state edits memakai functional updater + overlay map, dan submit memakai
  endpoint baru `POST /api/inventory/opname/batch` yang dieksekusi dalam satu
  `prisma.$transaction`.
- **Files**:
  `components/inventory/StockOpnameRecorder.tsx`,
  `components/inventory/opname/useOpnameCalculation.ts`,
  `components/inventory/opname/useSubmitOpname.ts`,
  `components/inventory/opname/OpnameItemRow.tsx`,
  `components/inventory/opname/OpnameItemsTable.tsx`,
  `components/inventory/opname/OpnameSummaryCards.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-19] — Endpoint batch opname atomic + Zod validator

- **Tipe**: [ADDED]
- **Scope**: `app/api/inventory/opname/batch`, `modules/inventory`
- **Author**: agent
- **Deskripsi**: Tambah endpoint `POST /api/inventory/opname/batch` untuk mencatat
  banyak item opname dalam satu transaksi atomic. Tambah Zod validator
  `opnameItemSchema` & `opnameBatchSchema` di `modules/inventory/validators/opnameValidator.ts`
  sesuai standar security project (semua API input wajib divalidasi Zod). Service
  `InventoryOpnameService` mendapat method baru `createOpnameBatch` yang menjalankan
  semua item dalam `prisma.$transaction`. `InventoryOpnameRouteService` direfactor
  agar memakai Zod safeParse sebagai gerbang validasi tunggal dan memetakan
  `ZodError` ke `details` pada response 400.
- **Files**:
  `app/api/inventory/opname/batch/route.ts`,
  `modules/inventory/validators/opnameValidator.ts`,
  `modules/inventory/services/InventoryOpnameService.ts`,
  `modules/inventory/services/InventoryOpnameRouteService.ts`,
  `modules/inventory/services/inventory-opname-create.helpers.ts`
- **Breaking**: ❌ Tidak

### [2026-05-19] — Domain mapping movement opname diperbaiki

- **Tipe**: [CHANGED]
- **Scope**: `modules/inventory/services`
- **Author**: agent
- **Deskripsi**: Mutasi stok hasil opname tidak lagi selalu memakai kondisi `BARU`.
  Selisih positif mengikuti breakdown kondisi yang diinput (mayoritas Baik/Rusak/Bekas).
  Selisih negatif mengikuti `alasanSelisih` (`rusak`→RUSAK, `expired`→BEKAS, lainnya→BARU).
  Alasan administratif (`revisi`, `salah_input`) tidak menghasilkan record
  `BarangMasuk`/`BarangKeluar` lagi karena tidak merepresentasikan pergerakan fisik
  — hanya menyesuaikan stok di `BarangGudang`. Hal ini menghindari distorsi
  laporan mutasi barang.
- **Files**: `modules/inventory/services/inventory-opname-create.helpers.ts`
- **Breaking**: ❌ Tidak
### [2026-05-18] — Privacy Policy mobile app untuk Play Store

- **Tipe**: [ADDED]
- **Scope**: `app/kebijakan-privasi-aplikasi/`
- **Author**: agent
- **Deskripsi**: Buat halaman privacy policy publik khusus aplikasi mobile RADPRO
  (`com.netmanager.mobile`) untuk memenuhi persyaratan Play Console submission.
  Halaman terpisah dari `/kebijakan-privasi` (yang berisi privacy policy ISP
  SBLNET.ID) karena audience + content beda. Mencakup 11 section sesuai Play
  Store policy: data identity/biometric/location/media/teknis, izin perangkat
  + rationale background location, third-party sharing (Firebase + Sentry),
  retensi data, hak pengguna, prosedur penghapusan akun, statement anak di
  bawah umur, kontak. URL yang dipakai di Play Console: `https://radpro.id/kebijakan-privasi-aplikasi`.
- **Files**: `app/kebijakan-privasi-aplikasi/page.tsx`,
  `app/kebijakan-privasi-aplikasi/PrivacyPolicyMobileClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-18] — Sprint 6: Tutup remaining Medium + Low severity dari deep review

- **Tipe**: [CHANGED]
- **Scope**: `mobile-netmanager/src/`, `docs/standards/api-versioning.md`
- **Author**: agent
- **Deskripsi**: Final cleanup remaining Medium + Low finding:
  - **L-1** — `signOut()` sekarang `await fcmService.syncFCMTokenToBackend('remove')` dengan timeout 3s race (sebelumnya fire-and-forget — server-side tetap kirim notif ke device user lama selama beberapa detik setelah logout). Dependencies callback dibersihkan (`syncFcmToken` tidak lagi dipanggil dari signOut).
  - **L-2** — `RefreshTokenService.doRefresh` retry 5xx + network error max 2 attempt dengan backoff 1-2s. 401/403/426 tetap final (tidak retry). Tanpa retry, transient backend hiccup → user dipikir kena logout walau hanya server glitch sesaat.
  - **L-4.4** — FCM permission gating dipisah: `hasUserPermission()` cek tanpa request dialog, `requestUserPermission()` panggil dialog. `syncFCMTokenToBackend(action, { requestPermissionIfNeeded: false })` default tidak prompt — onboarding screen explicit yang trigger via `fcmService.requestUserPermission()`. Dialog Android 13+ POST_NOTIFICATIONS tidak lagi muncul tanpa konteks saat first sign-in.
  - **L-7.2** — `useNotificationSetup` tidak lagi pakai `eventManager.addListener('root_notifications', ...)`; cleanup function disimpan per-instance di `useRef`. Sebelumnya namespace string global "root_notifications" rentan tabrakan dengan listener module lain yang kebetulan pakai key sama.
  - **Sync §4.3+4.7** — `SyncService.processQueueItem` sekarang explicit handle 401 mid-batch: refresh token via `RefreshTokenService`, override token closure, retry item. Sebelumnya 401 transient → diretry dengan token mati → loop forever sampai user re-login manual.
  - **API versioning strategy** — dokumen baru `docs/standards/api-versioning.md` mendefinisikan policy additive default + path `/api/mobile/v2/*` untuk breaking change + force-update fallback via `MOBILE_MIN_NATIVE_VERSION_CODE`.
  - **M-3.6 / L-4** — Verified sudah ter-handle di Sprint 1-2 (FCM cache reset di signOut, multi-tenant disabled jadi tenant prefix tidak relevan). No-op confirmation.
- **Files**: `mobile-netmanager/src/context/AuthContext.tsx`, `src/services/RefreshTokenService.ts`, `src/services/FirebaseMessagingService.ts`, `src/hooks/useNotificationSetup.ts`, `docs/standards/api-versioning.md` (new)
- **Breaking**: ❌ Tidak (semua perubahan additive — `syncFCMTokenToBackend` parameter baru optional, default behavior unchanged untuk caller existing kecuali tidak lagi prompt permission Android 13+ kalau caller tidak set `requestPermissionIfNeeded: true`)

### [2026-05-18] — Sprint 5: Tutup remaining backlog dari deep review

- **Tipe**: [CHANGED]
- **Scope**: `mobile-netmanager/src/services/`, `mobile-netmanager/scripts/`, `docs/reports/mobile-deep-review-2026-05-18/`
- **Author**: agent
- **Deskripsi**: Selesaikan backlog yang tersisa dari deep review (item yang Sprint 1-4 lewatkan):
  - **Sync §4.6+4.7** — `SyncService.processQueue` sekarang refresh access token via `RefreshTokenService.refreshAccessToken()` saat token kosong/expired, sebelumnya skip total → queue stuck sampai user re-login manual.
  - **Sync §4.2** — Global retry budget `MAX_GLOBAL_RETRY_COUNT = 10`. Item dengan 5xx berkepanjangan auto-`markAsFailed` + cleanup foto + telemetry `permanent_failed` + notify user, mencegah loop forever (in-attempt retry 3x → markAsRetry → next batch retry 3x lagi → ...).
  - **Sync §5** — Reconciliation event `DeviceEventEmitter.emit('sync:succeeded', { endpoint, method, requestId })` setelah sukses sync; hooks bisa listen untuk auto-invalidate cache, mencegah UI stale walau backend sudah punya data terbaru.
  - **Realtime §2.4** — `RealtimeService.disconnect()` broadcast event `__realtime:disconnected`; `subscribeToScope` listen broadcast dan auto-cancel listener tanpa screen perlu unmount manual. Tutup celah cross-account leak: listener owner-screen tidak lagi hidup pakai sesi auth user lama setelah signOut.
  - **Infra §6.5+6.2** — Script `scripts/ota-rollback.sh` baru: list update aktif di channel, deactivate current head, activate previous via `/api/admin/app-update/[id]` PATCH endpoint. Workflow: `./scripts/ota-rollback.sh staging` interactif konfirmasi sebelum rollback. Memenuhi gap Sprint 1 audit yang flag tidak ada strategi rollback OTA.
  - **Infra §6.1** — Dokumentasi multi-environment Firebase di `docs/reports/mobile-deep-review-2026-05-18/Infra-firebase-multi-env-guide.md` (3 Firebase project terpisah dev/staging/prod + EAS secrets). Fix actual butuh provisioning manual via Firebase Console — guide lengkap dengan steps + estimasi.
  - **Skipped (non-actionable)**: Auth L-3 (slim JWT claim) — `accessAdminPanel`/`isSuperAdmin` dipakai oleh mobile UI menu admin, hapus akan break feature; Infra §6.3 (APK cleanup) — `*.apk` sudah di .gitignore, file tidak tracked git, hanya housekeeping dev folder.
- **Files**: `mobile-netmanager/src/services/SyncService.ts`, `mobile-netmanager/src/services/RealtimeService.ts`, `mobile-netmanager/scripts/ota-rollback.sh` (new), `docs/reports/mobile-deep-review-2026-05-18/Infra-firebase-multi-env-guide.md` (new)
- **Breaking**: ❌ Tidak

### [2026-05-18] — Sprint 4: Selesaikan 3 follow-up Critical (Sentry + expo-sqlite + Mitra migration)

- **Tipe**: [INFRA]
- **Scope**: `mobile-netmanager/src/services/`, `mobile-netmanager/index.js`, `mobile-netmanager/.env.example`, `mobile-netmanager/package.json`, `prisma/mitra_migrations/`, database `mitra`
- **Author**: agent
- **Deskripsi**: Tutup 3 follow-up dari Sprint 1-3:
  - **Sentry RN install** — `@sentry/react-native@^8.11.1` ditambahkan, `SentryService.ts` baru sebagai initializer terpusat (init dari `EXPO_PUBLIC_SENTRY_DSN`, no-op bila kosong; PII filter strip Authorization/Cookie/password/token sebelum kirim). Integrasi: `index.js` panggil `initializeSentry()` paling awal, `TelemetryService.trackEvent` pipe ke `Sentry.addBreadcrumb`, `TelemetryService.trackError` panggil `Sentry.captureException`/`captureMessage`, `ErrorReportingService.captureException` juga kirim ke Sentry. `.env.example` dapat key `EXPO_PUBLIC_SENTRY_DSN` + `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
  - **expo-sqlite full migration** — `expo-sqlite` ditambahkan via `npx expo install`. `DatabaseService.ts` di-rewrite total dari AsyncStorage envelope ke SQLite: tabel `sync_queue` dengan PRIMARY KEY + index `(status, createdAt)`, migration runner via `PRAGMA user_version` (mudah extend untuk schema change masa depan), one-shot legacy migration import dari `Storage[NETMANAGER_SYNC_QUEUE]` ke SQLite di first init (idempotent + atomic via transaction). API publik `DatabaseService` DIPERTAHANKAN identik — caller (`SyncService`, `useApiMutation`) tidak perlu refactor. Benefit: row-level atomic update (tidak rewrite seluruh blob per status change), real query `WHERE status IN`/`ORDER BY`, tidak terikat limit ~6MB AsyncStorage Android.
  - **Mitra tokenVersion migration apply** — `prisma migrate deploy --config=prisma.mitra.config.ts` dijalankan ke database `mitra` (postgresql://localhost:5435/mitra). Kolom `tokenVersion INTEGER NOT NULL DEFAULT 0` confirmed di `\d Mitra`. Sekarang Sprint 2 fix H4 (`getMobileTokenVersion` Mitra read DB + logout endpoint increment Mitra) fully functional di runtime.
- **Files**: `mobile-netmanager/package.json`, `mobile-netmanager/.env.example`, `mobile-netmanager/index.js`, `mobile-netmanager/src/services/SentryService.ts` (new), `mobile-netmanager/src/services/DatabaseService.ts` (rewrite), `mobile-netmanager/src/services/TelemetryService.ts`, `mobile-netmanager/src/services/ErrorReportingService.ts`, `mobile-netmanager/app.json` (expo-sqlite plugin auto-added)
- **Migration applied**: `20260518_add_mitra_token_version` — sudah diaplikasikan ke DB Mitra dev. Untuk staging/prod jalankan `npm run prisma:migrate-deploy` atau langsung `npx prisma migrate deploy --config=prisma.mitra.config.ts`.
- **Breaking**: ❌ Tidak (DatabaseService API kompatibel, migration legacy data otomatis, Sentry no-op tanpa DSN, Mitra migration additive default 0)

### [2026-05-18] — Sprint 3 hardening: 20 Medium issue + Critical follow-ups dari deep review

- **Tipe**: [SECURITY]
- **Scope**: `lib/api/`, `lib/geofencePolicy.ts`, `lib/mobile-auth.ts`, `app/api/mobile/inventory/`, `app/api/mobile/leaves/`, `app/api/mobile/overtime/`, `app/api/mobile/auth/firebase-token/`, `modules/users/`, `modules/attendance/`, `mobile-netmanager/src/`
- **Author**: agent
- **Deskripsi**: Apply fix untuk 20 Medium finding + Critical follow-up:
  - **M-Correlation** — `lib/api/request-id.ts` dengan `getOrCreateRequestId` + mobile axios interceptor inject `X-Request-Id` (UUID) untuk korelasi log mobile↔backend.
  - **M1** — Login 401 selalu clear stored credentials (termasuk path biometric saveCreds=false), pesan disesuaikan.
  - **M2** — Access token expiry diturunkan ke 15m untuk semua role (Customer + Employee/Mitra). Refresh token tetap 30d.
  - **M3** — JWT audience+issuer set ke `netmanager` / `netmanager-mobile`, verify dengan options. Graceful migration: token legacy tanpa claim aud/iss tetap valid hingga refresh cycle selesai.
  - **M4** — Customer plaintext password fallback default DISABLED; aktifkan via `LEGACY_PLAINTEXT_AUTH_ENABLED=true`. Plaintext berhasil → auto-migrate ke bcrypt + clear `password` field.
  - **M5** — `NetworkStateService` default `true` (sudah benar), api.ts hanya reject saat eksplisit `false`.
  - **M-Loc** — Location timeout naikkan ke 15s (dari 5s) di `getCurrentLocation` & `useLocationWithTimeout` — 5s terlalu pendek untuk GPS first fix outdoor.
  - **M-Toast** — Toast 5xx pindah ke setelah retry decision; bila request sukses via retry, toast tidak muncul mis-leading.
  - **M-Geo** — Konsolidasi `AttendanceGeofencePolicy` ke single source `lib/geofencePolicy.ts` (sebelumnya didefinisikan ulang di 3+ file backend + mobile).
  - **M-DL** — Replace `setTimeout(500ms)` di killed-state deeplink dengan `useSegments` router-ready gate; deeplink fire saat segments populated, robust di Android Go/device lambat.
  - **M-iOS** — `presentForegroundNotification` support iOS via `notifee.displayNotification` + `foregroundPresentationOptions: { alert, badge, sound }`. iOS user tidak lagi miss high-priority alert.
  - **M-RT BG** — Background FCM handler render data-only message via notifee (sebelumnya hanya `console.log` dead code). OS sudah handle `notification` field; data-only payload sekarang tidak lost.
  - **M-RT AppState** — RealtimeProvider re-validate Firebase auth saat AppState `background→active`, fix data frozen setelah long background.
  - **M-RT Rate** — `/api/mobile/auth/firebase-token` rate limit 10 mints/menit per user via `advancedRateLimit` — cegah single user DoS Firebase project quota.
  - **M-PS** — `useProfileSync` realtime listener jadi module-scoped singleton dengan ref counting; multi-component yang panggil hook tidak bikin N listener Firestore.
  - **C1 mobile** — Generic `createRequestId(scope)` di `src/utils/requestId.ts` pakai `expo-crypto.randomUUID()` (cegah clock-rollback collision); `attendanceIdempotency` jadi wrapper backward-compat.
  - **C1 apply** — Apply idempotency middleware ke `/api/mobile/inventory/masuk`, `/inventory/keluar`, `/leaves`, `/overtime` (action: request). Helper `executeMobileInventoryWithIdempotency` di `route-utils` agar tidak duplicate boilerplate. Replay yang ditolak via `Idempotency-Key` header sekarang ter-handle dengan response cached, mencegah duplicate stock movement / cuti / lembur.
  - **L** — Low severity hygiene: hapus dead imports, verify clean diagnostics. Sisa Low non-actionable atau sudah covered di Sprint 1-2.
- **Files**: backend: `lib/api/request-id.ts` (new), `lib/api/index.ts`, `lib/geofencePolicy.ts` (new), `lib/mobile-auth.ts`, `modules/users/services/MobileCustomerAuthService.ts`, `modules/users/services/UserService.helpers.ts`, `modules/attendance/services/attendance-service-helpers.ts`, `modules/attendance/services/GeofenceService.ts`, `app/api/mobile/inventory/route-utils.ts`, `app/api/mobile/inventory/masuk/route.ts`, `app/api/mobile/inventory/keluar/route.ts`, `app/api/mobile/leaves/route.ts`, `app/api/mobile/overtime/route.ts`, `app/api/mobile/auth/firebase-token/route.ts`. Mobile: `src/utils/requestId.ts` (new), `src/utils/attendanceIdempotency.ts`, `src/utils/useLocationWithTimeout.ts`, `src/services/api.ts`, `src/services/RefreshTokenService.ts`, `src/services/ForegroundNotificationService.ts`, `src/hooks/queries/useApiMutation.ts`, `src/hooks/useNotificationSetup.ts`, `src/hooks/useProfileSync.ts`, `src/context/RealtimeProvider.tsx`, `app/(auth)/login.tsx`, `index.js`.
- **Breaking**: ❌ Tidak (backwards-compatible — JWT verify graceful migration, idempotency optional via header, helper opt-in)

### [2026-05-18] — Sprint 2 hardening: 17 High issue dari deep review mobile↔backend

- **Tipe**: [SECURITY]
- **Scope**: `lib/firebase/`, `lib/mobile-auth.ts`, `lib/mobile-api-auth.ts`, `modules/notification/repositories/`, `prisma/mitra.prisma`, `prisma/mitra_migrations/20260518_add_mitra_token_version/`, `app/api/mobile/auth/`, `mobile-netmanager/src/`
- **Author**: agent
- **Deskripsi**: Apply fix untuk 17 High finding dari laporan deep review mobile integration:
  - **H1** Throttle `Events.AUTH_UNAUTHORIZED` emit (1s coalesce window) untuk cegah 5 paralel 401 trigger 5x signOut → blank screen.
  - **H2** RefreshTokenService konsisten pakai `SecureStorage` wrapper (bukan SecureStore raw) — fix web fallback prefix mismatch.
  - **H3** `verifyMobileToken` route query berdasarkan claim `role` (1 query alih-alih fallback chain 2-3 query) — extract `verifyCustomerToken` & `verifyMitraToken` helper.
  - **H4** Tambah kolom `tokenVersion Int @default(0)` ke schema `Mitra` + migration SQL `20260518_add_mitra_token_version`. Logout endpoint sekarang increment Mitra tokenVersion.
  - **H5** Drop `chat` scope realtime dari mobile (commented dengan TODO) — backend tidak publish ke `chats/{id}/events` dan Firestore rules tidak ada match. Chat tetap fungsional via REST.
  - **H6** `seenDocIds` di `subscribeToScope` di-scope outside subscribe closure dengan size cap 500 (FIFO eviction) — fix duplicate/lost event saat retry + memory leak long-lived listener.
  - **H7** Mobile `signOut()` panggil `messaging.deleteToken()` + reset `lastSyncedToken` cache — cegah cross-account FCM leak di shared device.
  - **H8** Backend `/api/mobile/auth/firebase-token` panggil `setCustomUserClaims` saat mint custom token — fix stale claims (privilege escalation window saat role demosi).
  - **H9** Generic `TelemetryService` dengan namespace per modul (attendance/wo/inventory/chat/payment/sync/auth/realtime/fcm/upload/app); axios interceptor track sukses & gagal lintas modul; SyncService track non-attendance. Sentry setup guide di `docs/reports/mobile-deep-review-2026-05-18/H9-sentry-setup-guide.md`.
  - **H10** Konstanta `HTTP_TIMEOUTS` (short/standard/long/sync/refresh) di `src/constants/httpTimeouts.ts`; api.ts/useApiMutation/SyncService/RefreshTokenService/UploadService/ErrorReportingService konsisten pakai konstanta.
  - **H11** SyncService TTL expiry sekarang notifikasi user (bukan silent discard); photo URL di-cache ke `baseMeta` setelah upload sukses agar retry skip re-upload (cegah orphan files S3 + bandwidth wasted).
  - **H12** RefreshTokenService deteksi 426 explicit dan emit `Events.APP_VERSION_UNSUPPORTED` — sebelumnya null path → user dipikir kena logout padahal butuh update.
  - **H13** `connectPromise` cache invalidation di `subscribeToScope` error handler (auth error → reset auth + re-mint).
  - **H14** `RealtimeService.disconnect()` panggil `firebaseSignOut(auth)` — cegah listener cross-account leak setelah logout.
  - **H15** `getAdminTokens(tenantId)` filter cross-tenant + `sendFCMNotification` null-check messaging admin SDK + reap stale token (`messaging/registration-token-not-registered`); `appendOwnerToken` repository pakai transaksi atomic dedup (cegah duplicate fcmTokens dari race login + tokenRefresh listener).
  - **H16** Hapus `presentInfoMessage`/`presentSuccessMessage` duplikat di `useAttendanceSubmission` — `useApiMutation` sudah handle via `successMessage` config.
  - **H17** `resolveVersionCode` trust hanya `payload.appVersionCode` (signed JWT) untuk gating; header `X-App-Version-Code` hanya allowed sebagai upper-bound override (≤ token claim) untuk cegah spoof bypass version gating.
- **Files**: backend: `lib/firebase/messaging.ts`, `lib/mobile-auth.ts`, `lib/mobile-api-auth.ts`, `modules/notification/repositories/PushTokenRepository.ts`, `app/api/mobile/auth/logout/route.ts`, `app/api/mobile/auth/firebase-token/route.ts`, `prisma/mitra.prisma`, `prisma/mitra_migrations/20260518_add_mitra_token_version/migration.sql`. Mobile: `src/constants/httpTimeouts.ts` (new), `src/services/TelemetryService.ts` (new), `src/services/api.ts`, `RefreshTokenService.ts`, `RealtimeService.ts`, `FirebaseMessagingService.ts`, `SyncService.ts`, `UploadService.ts`, `ErrorReportingService.ts`, `CredentialStorageService.ts`, `BiometricService.ts`, `src/hooks/queries/useApiMutation.ts`, `src/hooks/useAttendanceSubmission.ts`, `src/context/AuthContext.tsx`, `app/(app)/chat/[conversationId].tsx`. Docs: `docs/reports/mobile-deep-review-2026-05-18/H9-sentry-setup-guide.md`.
- **Migration**: `20260518_add_mitra_token_version` — wajib di-apply (`prisma migrate deploy --schema prisma/mitra.prisma`) sebelum mobile build berikutnya.
- **Breaking**: ❌ Tidak (backwards-compatible — schema migration additive, axios behavior unchanged untuk caller existing)

### [2026-05-18] — Sprint 1 hardening: 11 Critical issue dari deep review mobile↔backend

- **Tipe**: [SECURITY]
- **Scope**: `lib/firebase/`, `lib/api/`, `modules/attendance/`, `modules/notification/`, `modules/pelanggan/`, `app/api/mobile/auth/logout/`, `mobile-netmanager/src/`
- **Author**: agent
- **Deskripsi**: Apply fix untuk 11 Critical finding dari laporan deep review mobile integration:
  - **C1** Generic idempotency middleware di `lib/api/idempotency.ts` (mirror pattern attendance) + apply guide untuk work-order/inventory/leave (`docs/reports/mobile-deep-review-2026-05-18/C1-idempotency-apply-guide.md`).
  - **C2** Cross-tenant FCM leak ditutup — `getAdminTokens(tenantId)` wajib filter tenant; caller `notifyAdmins` & `notifyAdminsAboutReceiptUpload` propagasi `tenantId`.
  - **C3** Custom token Firestore refresh — cek `getIdToken()` expiry sebelum reuse, branch on `permission-denied`/`unauthenticated` untuk re-mint sebelum retry.
  - **C4** Endpoint `POST /api/mobile/auth/logout` baru — increment `tokenVersion` Customer & Employee untuk revoke refresh token; mobile `signOut()` panggil endpoint best-effort. Mitra TODO (butuh schema migration).
  - **C5(B)** Biometric storage stop-gap — `requireAuthentication: true` + `WHEN_UNLOCKED_THIS_DEVICE_ONLY` untuk password di SecureStore; `disableBiometric()` panggil `clearCredentials()`.
  - **C6** Geofence bypass ditutup — backend `assertCoordinatesProvidedForStrict` reject 422 untuk policy STRICT + null coords; ErrorCode `COORDINATES_REQUIRED` baru.
  - **C7** DatabaseService stop-gap — schema versioning envelope + quarantine bucket untuk corrupted blob (mencegah silent data loss saat deploy ubah `SyncQueueItem`); `clearSessionData` tidak lagi wipe queue saat logout. Migrasi penuh ke expo-sqlite tetap pending.
  - **C8** Photo cleanup wired di `SyncService` — panggil `cleanupOfflinePhotos` di success/TTL/permanent-failure path; helper `cleanupOfflinePhotos` & `sweepOrphanOfflinePhotos`.
  - **C9** Double/triple toast — `useApiMutation` set `skipErrorToast: true` di axios request; interceptor toast hanya jadi fallback untuk read endpoint.
  - **C10** UploadService timeout watchdog — 60s hard timeout + 30s no-progress watchdog; selalu pakai `createUploadTask` agar bisa di-cancel.
  - **C11** Firestore rules deploy — rename `firestore-rules-update.txt` → `firestore.rules`, tambah pointer di `firebase.json`, tambah rule untuk `departments/{deptId}/events/{eventId}`, tambah explicit `allow write: if false` di event collections.
- **Files**: `netmanager/lib/firebase/messaging.ts`, `lib/api/idempotency.ts`, `lib/api/index.ts`, `lib/api-response.ts`, `modules/attendance/services/AttendanceMutationGeofenceService.ts`, `modules/attendance/services/MobileAttendanceCheckInRouteService.ts`, `modules/attendance/services/MobileAttendanceCheckoutRouteService.ts`, `modules/notification/services/NotificationService.delivery.ts`, `modules/pelanggan/services/CustomerPaymentReceiptService.ts`, `app/api/mobile/auth/logout/route.ts`, `tests/lib/firebase/messaging-admin-tokens.test.ts`, `tests/modules/notification/NotificationService.test.ts`, `mobile-netmanager/src/services/api.ts`, `UploadService.ts`, `SyncService.ts`, `RealtimeService.ts`, `CredentialStorageService.ts`, `BiometricService.ts`, `DatabaseService.ts`, `src/utils/persistPhoto.ts`, `src/hooks/queries/useApiMutation.ts`, `src/context/AuthContext.tsx`, `firestore.rules`, `firebase.json`
- **Breaking**: ❌ Tidak (backwards-compatible — endpoint baru, middleware opt-in, schema versioning auto-migrate dari legacy plain array)

### [2026-05-18] — Deep review integrasi mobile ↔ backend

- **Tipe**: [DOCS]
- **Scope**: `docs/reports/`
- **Author**: agent
- **Deskripsi**: Tambah laporan deep review integrasi `mobile-netmanager` ↔ `netmanager` backend di 4 area (auth & token flow, offline sync & idempotency, real-time & FCM, cross-cutting concerns). Total 78 finding (11 Critical, 27 High, 30 Medium, 10 Low). Highlight: idempotency tidak konsisten antar endpoint, cross-tenant FCM leak, custom token Firestore tidak refresh, password plaintext di SecureStore, geofence bypass via null coords, schema-less queue di DatabaseService, disk leak photo offline, double toast spam.
- **Files**: `docs/reports/MOBILE_INTEGRATION_DEEP_REVIEW_2026-05-18.md` (executive summary), `docs/reports/mobile-deep-review-2026-05-18/01-auth-token-flow.md`, `02-offline-sync-idempotency.md`, `03-realtime-fcm.md`, `04-cross-cutting.md`
- **Breaking**: ❌ Tidak

### [2026-05-18] — Fix test fixtures pasca migrasi TanStack adoption

- **Tipe**: [FIXED]
- **Scope**: `tests/`, `components/attendance/AttendancePageContent.tsx`
- **Author**: agent
- **Deskripsi**: 12 test gagal pasca migrasi useApi/useMutation/useQuery
  karena: (1) komponen baru pakai `useQueryClient` butuh
  `QueryClientProvider` wrapper, (2) urutan `useState` berubah karena
  state lokal diganti useApi, (3) source data berbeda (state lokal →
  hook data). Akar masalah:

  - **`tests/app/admin-users-new-client-reference-data.test.tsx`** —
    `createRoot.render` direct tanpa wrapper. Tambah helper
    `renderWithQueryClient` dengan `QueryClient` retry-disabled. Test
    debounce email check switch ke real timer agar TanStack Query
    Promise resolution chain selesai.
  - **`tests/app/admin/live-map-client.test.tsx`** — `mockUseState`
    sequence tidak sinkron dengan urutan baru. Tambah mock `useApi`
    explicit untuk return locations + tenantId.
  - **`tests/components/inventory/TransferForm.stock-caption.test.tsx`** —
    Mock react-query hilangkan `useQueryClient` (dipakai
    `useInvalidateInventoryRelated`). Tambah mock `useApi` untuk
    barang+gudang. Sequence `mockUseState` di-rapikan reflect order
    baru. Tambah type `MockUseApiResult` untuk fix
    `noImplicitAny`.
  - **`tests/lib/realtime/realtime-page-clients.test.ts`** — `tenantId`
    sekarang dari useApi data bukan useState. Override mock `useApi`
    return data berisi tenantId.
  - **`tests/ui/rab-revision-form.test.ts`** — Tambah
    `QueryClientProvider` wrapper untuk render.
  - **`components/attendance/AttendancePageContent.tsx`** — Rename
    variable `innerData` jadi `currentStatus` untuk pertahankan
    convention yang dicek oleh test
    `current-status-consumer.test.ts`.

  Hasil `npm run check` final: lint pass, typecheck pass (0 error),
  test pass (2751/2758, 7 skipped pre-existing), build pass.
- **Files**: `tests/app/admin-users-new-client-reference-data.test.tsx`,
  `tests/app/admin/live-map-client.test.tsx`,
  `tests/components/inventory/TransferForm.stock-caption.test.tsx`,
  `tests/lib/realtime/realtime-page-clients.test.ts`,
  `tests/ui/rab-revision-form.test.ts`,
  `components/attendance/AttendancePageContent.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-18] — Phase 3 final closure: migrate 4 file out-of-scope ke TanStack

- **Tipe**: [CHANGED]
- **Scope**: `components/common/MapPicker.tsx`,
  `app/admin/integrations/mixradius/expenses/RABRevisionForm.tsx`,
  `app/admin/users/compare/UsersCompareClient.tsx`,
  `app/admin/users/new/UsersNewClient.tsx`
- **Author**: agent
- **Deskripsi**: Re-evaluasi 4 file yang sebelumnya di-defer dari Phase 3
  ternyata bisa di-migrate dengan TanStack pattern yang berbeda dari
  pure `useApi`. Tutup gap untuk konsistensi 100%:

  - **`UsersNewClient`** — email check debounce + AbortController →
    `useApi` dengan dynamic key (`?email=${debouncedEmail}`) dan
    `enabled: isEmailValid`. TanStack Query auto-cancel saat key
    berubah, jadi AbortController manual tidak diperlukan. Debounce
    pakai `useState` + `setTimeout` untuk hold value sebelum jadi
    query key.
  - **`RABRevisionForm`** — fetch revisions list + auto-create POST
    saat tidak ada DRAFT → `useApi` untuk fetch (conditional saat modal
    open) + `useMutation` untuk auto-create. Render-time comparator
    untuk reset hydrate flag saat modal close (hindari setState-in-effect).
  - **`UsersCompareClient`** — multi-id Promise.all loop → `useQuery`
    dengan dynamic queryKey `[ids, period, dateRange]` dan `queryFn`
    yang execute parallel fetch ke semua ID. State error/loading
    derive dari query state.
  - **`MapPicker`** — geocode search handler → `useMutation` untuk
    konsisten loading state via `isPending`. Auto-handle race
    condition saat user trigger search berkali-kali.

  Semua 4 file sekarang pakai TanStack pattern. Hasil audit final:
  **0 file** masih pakai pola lama `useEffect+fetch` tanpa TanStack hook.

  Phase 3 status: 100% (128 file pakai TanStack pattern).

  Lint pass, typecheck pass (0 error). Tidak ada perubahan kontrak API.
- **Files**: `components/common/MapPicker.tsx`,
  `app/admin/integrations/mixradius/expenses/RABRevisionForm.tsx`,
  `app/admin/users/compare/UsersCompareClient.tsx`,
  `app/admin/users/new/UsersNewClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-18] — Phase 5 selesai: useInfiniteApi hook + reference implementation

- **Tipe**: [ADDED]
- **Scope**: `lib/hooks/useInfiniteApi.ts`, `components/ui/InfiniteScrollSentinel.tsx`, `app/(customer)/tagihan/page.tsx`
- **Author**: agent
- **Deskripsi**: Tutup Phase 5 TanStack adoption roadmap (`useInfiniteQuery`
  untuk list besar). Buat 2 module foundation + 1 reference
  implementation:

  **Foundation (`lib/hooks/useInfiniteApi.ts`):**
  - Wrapper TanStack `useInfiniteQuery` untuk endpoint paginated standar
    `{ data, page, limit, total }`.
  - Auto-handle page key, total counting, flat list aggregation.
  - Custom `mapResponse` opsi untuk endpoint dengan response shape
    non-standar (mis. `{ invoices, pagination: { ... } }`).
  - `getNextPageParam` derive dari `Math.ceil(total/limit)` —
    konsisten dengan `apiPaginated()` di `lib/api-response.ts`.

  **Komponen UI (`components/ui/InfiniteScrollSentinel.tsx`):**
  - Intersection Observer trigger fetchNextPage saat sentinel masuk
    viewport (rootMargin default 200px untuk pre-fetch sebelum visible).
  - Built-in spinner saat fetching dan label "akhir daftar" saat
    hasNextPage=false.

  **Reference implementation (`app/(customer)/tagihan/page.tsx`):**
  - Customer invoice list ganti `useApi<{ invoices }>` → `useInfiniteApi<Invoice>`
    dengan `mapResponse` untuk handle response shape `{ invoices, pagination }`.
  - `InfiniteScrollSentinel` di akhir list → auto-load page berikutnya saat
    user scroll ke bawah.

  **List besar lain di-defer dengan justifikasi:**
  - PppList, WoListClient, ActivityLogClient — sudah pakai page-based
    UI dengan tombol prev/next yang di-render via `ResponsiveTable`.
    Migrate ke infinite scroll mengubah UX existing dan butuh ganti
    seluruh PaginationFooter component. Investasi tidak proporsional
    dengan benefit untuk admin tool (admin lebih familiar dengan
    pagination klasik untuk navigate ke page tertentu).
  - Notification feed (`KaryawanNotificationBell`,
    `CustomerSupportBell`) — pakai `useRealtimeNotifications` custom
    hook dengan integrasi WebSocket, di luar pattern infinite scroll.

  Pattern useInfiniteApi siap dipakai saat ada list baru yang fit, atau
  saat ada keputusan UX migrate dari page-based ke infinite scroll.

  Phase 5 status: SELESAI (foundation + 1 reference implementation).

  Lint pass, typecheck pass (0 error). Tidak ada perubahan kontrak API.
- **Files**: `lib/hooks/useInfiniteApi.ts` (baru),
  `components/ui/InfiniteScrollSentinel.tsx` (baru),
  `app/(customer)/tagihan/page.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-18] — Phase 2 selesai: cross-module invalidation helpers + wiring

- **Tipe**: [ADDED]
- **Scope**: `lib/hooks/useInvalidate.ts`, `app/admin/finance/manual-payments/`, `app/admin/workorders/list/`, `app/admin/attendance/`, `app/admin/pelanggan/ppp/`, `components/inventory/`
- **Author**: agent
- **Deskripsi**: Tutup Phase 2 TanStack adoption roadmap. Buat
  `lib/hooks/useInvalidate.ts` dengan 5 helper hook untuk cross-module
  cache invalidation:
  - `useInvalidateCustomerRelated` — dashboard, billing, customer list
  - `useInvalidateInvoicePaymentRelated` — customer detail, finance
    stats, payment gateway, manual payments
  - `useInvalidateWorkOrderRelated` — dashboard, WO list, inventory,
    salary
  - `useInvalidateAttendanceRelated` — live map, attendance status,
    payroll preview, dashboard
  - `useInvalidateInventoryRelated` — inventory stats, barang, gudang,
    opname, work-order materials

  Wire ke 5 critical mutation Phase 1 di `onSettled`:
  - `ManualPaymentClient` (verify payment) → invoice payment helper
  - `WoListClient` (verify WO) → work-order helper
  - `AttendanceClient` (bulk delete) → attendance helper
  - `TransferForm` (stock transfer) → inventory helper
  - `PppList` (delete + status update) → customer helper

  Setelah mutation selesai, helper trigger `invalidateQueries` untuk
  query keys cross-module sehingga UI module lain auto-refresh tanpa
  user perlu reload halaman.

  Phase 2 status: SELESAI (5/5 cross-module invalidation flow + helper
  hook centralized).

  Lint pass, typecheck pass (0 error). Tidak ada perubahan kontrak API.
- **Files**: `lib/hooks/useInvalidate.ts` (baru),
  `app/admin/finance/manual-payments/ManualPaymentClient.tsx`,
  `app/admin/workorders/list/WoListClient.tsx`,
  `app/admin/attendance/AttendanceClient.tsx`,
  `app/admin/pelanggan/ppp/PppList.tsx`,
  `components/inventory/TransferForm.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-18] — Phase 1 fully complete: optimistic update TransferForm + migrate ke useApi

- **Tipe**: [CHANGED]
- **Scope**: `components/inventory/TransferForm.tsx`
- **Author**: agent
- **Deskripsi**: Audit ulang Phase 1 menemukan TransferForm masih
  punya `useMutation` tanpa `onMutate` optimistic update. Tutup gap:
  - Migrate barang + gudang fetch dari `getWithAuth` ke `useApi` agar
    TanStack-cached (prerequisite optimistic update).
  - `submitTransferMutation.onMutate`: snapshot data + optimistic patch
    `stockPerGudang` (kurangi sumber, tambah tujuan) via
    `mutateBarangs(updater, { revalidate: false })`.
  - `onError`: rollback ke snapshot pre-mutation.
  - `onSettled`: revalidate untuk get fresh data dari server (sukses
    atau gagal).
  - Error handling derive dari `useApi` error tanpa `setState` di
    useEffect (mematuhi rule react-hooks/set-state-in-effect).

  Phase 1 status final: SELESAI 5/5 critical mutations dengan optimistic
  update + rollback (finance approve/reject, attendance bulk delete,
  work-order status, inventory transfer, pelanggan action menu).

  Lint pass, typecheck pass (0 error). Tidak ada perubahan kontrak API.
- **Files**: `components/inventory/TransferForm.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-18] — Phase 1 closing: optimistic update PppList action menu

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/pelanggan/ppp/PppList.tsx`
- **Author**: agent
- **Deskripsi**: Tutup target Phase 1 TanStack adoption roadmap (5 critical
  mutations dengan optimistic update). Action menu PPP customer (delete +
  status update AKTIF/ISOLIR/CUTI) sekarang pakai pattern lengkap:
  `onMutate` snapshot data + optimistic patch via `mutatePelanggan(updater,
  { revalidate: false })`, `onError` rollback ke snapshot sebelum mutasi,
  `onSettled` revalidate untuk get fresh data dari server.

  UI sekarang berubah instan saat user klik delete/isolir tanpa menunggu
  server. Loading state per-action via `mutation.isPending` tetap. Toast
  feedback success/error tetap muncul.

  Phase 1 status: SELESAI (5/5 critical mutations dengan optimistic
  update — finance approve/reject, attendance bulk delete, work-order
  status, inventory transfer, pelanggan action menu).

  Lint pass, typecheck pass (0 error). Tidak ada perubahan kontrak API.
- **Files**: `app/admin/pelanggan/ppp/PppList.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-18] — Phase 4 selesai: polling optimization via `refreshInterval`

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/kehadiran/live-map/LiveMapClient.tsx`
- **Author**: agent
- **Deskripsi**: Tutup Phase 4 TanStack adoption roadmap. `LiveMapClient`
  ganti `setInterval` 15s manual jadi `useApi({ refreshInterval })`
  conditional — polling auto disable saat WebSocket connected, auto enable
  saat disconnected. Dapat benefit auto-pause saat tab tidak active
  (TanStack Query default behavior) yang sebelumnya tidak ada di pattern
  manual.

  File polling lain di project sudah pada pola yang benar:
  - `useDevicesPolling.ts` — sudah pakai `refreshInterval: 300_000`
  - `app/(customer)/tagihan/page.tsx` — sudah pakai pattern Phase 4 bonus
    (SSE listener trigger `mutateInvoices()` untuk refresh cache useApi)

  setInterval lain di project (`useGeneralSettings`, `AttendancePageContent`,
  `ServerClock`, `CountdownTimer`, `AttendanceStatusIndicator`,
  `PhotoUpload`, `error/page`) adalah clock tick / countdown / upload
  progress — bukan polling endpoint, di luar scope Phase 4.

  Lint pass, typecheck pass (0 error). Tidak ada perubahan kontrak API.
- **Files**: `app/admin/kehadiran/live-map/LiveMapClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-18] — Phase 3 final push: migrate 24 file complex/detail ke `useApi`

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/**`, `components/**`, `app/(customer)/**`,
  `app/api/docs/**`, `app/register/**`, `app/investor/**`
- **Author**: agent
- **Deskripsi**: Final batch (7-19) Phase 3 TanStack adoption. Migrate
  24 file tambahan ke `useApi`, mencakup pattern detail page, edit form,
  multi-fetch parallel, dan complex orchestration:
  - Detail/edit pages: `BarangEditClient`, `BarangDetailClient`,
    `DeptEditClient`, `SitesEditClient`, `SiteDetailClient`,
    `NotificationHistoryClient`, `UserPerformanceStats`,
    `app-releases/[id]/page`, `investor/projects/[id]/page`,
    `SalaryUserDetailClient`, `WorkingHoursSettings`,
    `RegistrationDetailClient`, `SupportDetailClient`, `WoDetailClient`,
    `RolesDetailClient`, `PppPrintClient`
  - List/form complex: `LiveMapClient` (realtime patch via
    `mutate(updater)`), `AttendanceCard`, `RingtoneSettingsClient`,
    `dukungan/page`, `DeadLetterClient`, `register/page`, `api/docs/ui/page`,
    `useGeneralSettings`, `useInventoryFilters`, `ReportClient`,
    `useDevicesPolling` (5min refreshInterval), `useMikrotikRouterList`,
    `usePaymentGatewayConfigs`, `useManualTransferAccounts`,
    `CreateAssetForm`, `MyProfileClient`
  - Multi-fetch paralel: `useIncomePeriodData` (5 fetch),
    `MixRadiusClient` (owners + groups), `SalaryUsersClient`
    (users + components), `AttendancePageContent` (status + history),
    `PppRenewClient` (4 fetch dengan didHydrate), `PppEditClient`,
    `PppNewClient` (dynamic siteId query key)
  - Inventory forms: `AmbilBarangForm`, `MasukForm`, `KeluarForm`,
    `EnhancedOpnameForm`, `StockOpnameRecorder`, `StockReport`,
    `RestockSettingsForm`, `RABForm/useRABExternalData`
  Pattern utama: `didHydrate` flag untuk hydrate state lokal sekali tanpa
  `setState` di useEffect (mematuhi rule react-hooks/set-state-in-effect),
  `mutate(updater)` untuk in-place cache update saat ada response dari
  PATCH/POST sehingga hindari double-fetch, conditional fetching dengan
  `useApi(condition ? url : null)` untuk dependent queries.

  4 file out-of-scope di-defer karena pattern non-fit pure useApi:
  `MapPicker.tsx` (search-on-demand handler user),
  `RABRevisionForm.tsx` (auto-create POST jika tidak ada DRAFT),
  `UsersCompareClient.tsx` (multi-id loop Promise.all dynamic),
  `UsersNewClient.tsx` (email check debounce + AbortController unik).
- **Files**: 24 file di 13 commit terpisah (batch 7-19)
- **Breaking**: ❌ Tidak

### [2026-05-18] — Phase 3 final batch: migrate 16 file tambahan ke `useApi`

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/**`, `app/(customer)/**`, `app/api/docs/**`, `app/register/**`, `components/**`
- **Author**: agent
- **Deskripsi**: Lanjutan Phase 3 batch 7-10 dari TanStack adoption roadmap.
  Total tambahan 16 file migrate ke hook `useApi`, distribusi per batch:
  - Batch 7 (4 file): `useGeneralSettings`, `LiveMapClient`, `AttendanceCard`,
    `register/page` — masing-masing pakai pola yang menyesuaikan: hydrate ke
    state lokal saat data muncul (settings, attendance), realtime patch via
    `mutate(updater)` untuk LiveMapClient.
  - Batch 8 (4 file): `dukungan/page` (customer), `DeadLetterClient`,
    `RingtoneSettingsClient`, `api/docs/ui/page`.
  - Batch 9 (5 file inventory forms): `AmbilBarangForm`, `MasukForm`,
    `KeluarForm`, `EnhancedOpnameForm`, `StockOpnameRecorder`. KeluarForm
    pakai `useState` initializer dari `initialData` props (hindari
    `setState` di useEffect).
  - Batch 10 (2 file): `useInventoryFilters` (drop `getWithAuth` dependency),
    `ReportClient` (options via useApi, report tetap manual karena pakai
    AbortController + retryAfter handling).
  Lint pass per batch (eslint --fix di pre-commit hook). Typecheck pass
  (0 error project). Tidak ada perubahan kontrak API.
- **Files**: 16 file (lihat per-batch commit)
- **Breaking**: ❌ Tidak

### [2026-05-18] — Phase 3 lanjutan: migrate 39 file admin/components ke `useApi`

- **Tipe**: [CHANGED]
- **Scope**: `app/investor/**`, `app/admin/**`, `components/**`
- **Author**: agent
- **Deskripsi**: Lanjutan Phase 3 batch 2-6 dari TanStack adoption roadmap.
  Total 39 file migrate dari pola `useEffect + fetch + useState` ke hook
  `useApi` (TanStack Query), tersebar di 6 commit terpisah agar reviewable.
  Pattern: state lokal disisakan untuk form/derived UI, server cache di-handle
  TanStack Query. Loading/error derived dari `isLoading`/`error`. Refresh
  manual diganti `refetch()` atau `mutate()`. Eliminasi banyak helper
  `unwrapApiData/extractAccounts/extractConfigs` duplikat. Custom polling
  setInterval diganti `refreshInterval` (mis. `useDevicesPolling` 5min).
  Fix lint `react-hooks/set-state-in-effect` dengan derive nilai langsung
  tanpa setState di useEffect. Beberapa file complex (>1000 baris atau
  multi-fetch chained calculation seperti `useRoiTracking`,
  `useIncomePeriodData`, `LemburClient`, `useGeneralSettings`,
  `SalaryUsersClient`, `MixRadiusClient`, `UsersNewClient`) tetap pakai
  pola lama karena trade-off rewrite vs nilai migrasinya tidak optimal.
- **Files (per batch)**:
  - Batch 2 (13 file): investor portal (4), finance reports (2), paket
    hooks (3), workorders (2), settings (2)
  - Batch 3 (10 file): pelanggan PPP (2), shared components (8 — banner,
    inventory stats, attendance analytics, site filter, notification bell,
    gudang selector, NPL summary, server clock)
  - Batch 4 (3 file): RAB external data, StockReport, RestockSettingsForm
  - Batch 5 (5 file): useDevicesPolling, useMikrotikRouterList,
    usePaymentGatewayConfigs, useManualTransferAccounts, CreateAssetForm
  - Batch 6 (1 file): MyProfileClient
- **Breaking**: ❌ Tidak

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
