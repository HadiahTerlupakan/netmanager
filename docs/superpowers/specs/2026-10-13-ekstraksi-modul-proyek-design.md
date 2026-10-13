# Ekstraksi RAB (Proyek) dari Finance menjadi `modules/proyek`

- **Tanggal**: 2026-10-13
- **Status**: Draf untuk ditinjau
- **Lingkup**: web admin saja; tanpa perubahan perilaku; tanpa migration Prisma
- **Menyiapkan**: tautan proyek ↔ Planning OSP (tahap terpisah, §13)

---

## 1. Masalah

Tab **RAB (Proyek)** di `/admin/pengeluaran` bukan lagi fitur pendamping
pengeluaran. Ia sudah menjadi subsistem terbesar kedua di repo ini: 10 model
Prisma, 10 enum, workflow revisi berjenjang, pelacakan realisasi bulanan,
perhitungan BEP, dan bagi hasil investor — total **~20.300 baris** yang hidup
menempel di `modules/finance` dan satu halaman `app/admin/pengeluaran`.

Tiga akibat yang sudah terasa:

1. **`ExpensesClient.tsx` 2.100 baris** memikul dua domain sekaligus — 139 dari
   baris itu RAB, sisanya pengeluaran harian dan kategori. Satu file, dua alasan
   berubah.
2. **`modules/finance` kehilangan fokus.** Public API-nya mengekspor 6 service
   RAB, dan `modules/finance/public-queries.ts` 100% berisi query RAB yang
   dibuat khusus sebagai pintu untuk modul investor.
3. **Tujuan bisnisnya salah rumah.** Proyek ini akan dieskalasikan ke
   perencanaan OSP, sementara `modules/planning` ("Planning OSP") sudah berdiri
   lengkap dan belum dipakai produksi. Selama RAB masih bagian dari finance,
   tautan proyek ↔ OSP berarti menyambungkan planning ke *modul keuangan*,
   bukan ke modul proyek.

## 2. Hasil yang diinginkan

Setelah pekerjaan ini:

1. Ada **`modules/proyek`** sebagai modul mandiri berpola baru, dengan public
   API sendiri; `modules/finance` hanya mengurus pengeluaran, kategori, akun,
   invoice, dan pembayaran.
2. Halaman **`/admin/proyek`** berdiri sendiri di sidebar; `/admin/pengeluaran`
   tinggal dua tab (pengeluaran harian + kategori/COA).
3. Kopling dua arah finance ↔ proyek dan investor ↔ proyek berjalan lewat
   **pintu `public-queries`**, tidak lewat impor lintas-lapisan.
4. **Perilaku tidak berubah sama sekali** — tidak ada fitur baru, tidak ada
   fitur hilang, tidak ada migration Prisma, tidak ada migrasi data role.
5. Ada **ruang pasang** yang jelas untuk tautan ke Planning OSP (§13).

### Bukan lingkup

- **Rename model/tabel Prisma.** `RabProject` tetap `RabProject`, tabel tetap
  `rab_projects`. Alasan di §4 D1.
- **Permission `proyek:*`.** Gate tetap `expense:*` supaya role yang ada langsung
  jalan. Utang tercatat di §13.
- **Mengganti flag `Role.canApproveRab`** menjadi permission normal. Menyentuh
  `modules/roles`, sesi auth, dan UI roles — pekerjaan sendiri.
- **Tautan ke Planning OSP** dan aliran BOQ planning → item RAB.
- **Perbaikan fitur atau code smell di dalam logika RAB.** File pindah apa
  adanya; isi tidak disentuh kecuali jalur impor.

## 3. Keadaan saat ini (terverifikasi)

### 3.1 Ukuran dan sebaran

| Kelompok | File | Baris | Perlakuan |
|---|---|---|---|
| `modules/finance` RAB-murni | 49 | ~5.960 | pindah utuh |
| `app/admin/pengeluaran` RAB-murni | 31 | ~10.132 | pindah utuh |
| `app/api/finance/rab-projects/**` | 13 | ~664 | pindah utuh |
| Test RAB | 30 | ~3.516 | pindah path, isi tetap |
| **Subtotal pindah utuh** | **123** | **~20.272** | |
| File shared (finance + UI) | 11 | — | dibedah |

Model Prisma terkait: `RabProject`, `RabItem`, `RabWbs`, `RabRevision`,
`RabRevisionItem`, `RabRevisionApproval`, `RabApproval`, `RabDisbursement`,
`RabActualAchievement`, `RabInvestor`; plus 10 enum `Rab*`.

FK dari model lain (tidak disentuh): `Expense.rabProjectId/rabItemId`,
`ExpenseCategory.rabItems`, `InvestorProfitShare.rabProjectId`,
`InvestorProfitShareBulan.rabProjectId`, `Sites.rabProjects`,
`User.rabApprovals/rabRevisionApprovals`, 10 back-relation `Tenant`.

### 3.2 Ketergantungan yang ada

- **Nol konsumen RAB** di procurement, inventory, accounting, work-order,
  planning, network, pelanggan, mitra, tax, salary, attendance.
- **`modules/investor` satu-satunya konsumen** (~85 sentuhan di 12 file), lewat
  `modules/finance/public-queries` (5 fungsi) dan `modules/finance/client`
  (rab-tracking).
- **Arah balik**: `RabProjectRouteService` mengimpor
  `modules/investor/public-queries` (`hasActiveInvestorProfitShare`,
  `isRabProjectMonthShared`) — jadi investor ↔ RAB sudah dua arah lewat pintu
  masing-masing.
- **RAB → expense**: `RabProjectRouteService` mengimpor `ExpenseRepository`
  langsung untuk mengambil realisasi, lalu meringkasnya dengan
  `buildItemActualTotals` (`rabProjectRouteSerializers.ts`, dipakai hanya oleh
  service ini).
- **Expense → RAB**: `ExpenseRepository` dan `ExpenseRouteService` hanya memakai
  FK (`connect`) dan join `select { id, name }`. **Tidak ada impor kode RAB.**
- **`FinanceService.getRabProjects/createRabProject`** hanya dipakai oleh
  `app/api/finance/rab-projects/route.ts` sendiri → bisa dicabut bersih
  bersama `FinanceRabFacadeService`.

### 3.3 UI

`ExpensesClient.tsx` (2.100 baris) memegang `activeTab` lokal bernilai
`"daily" | "rab" | "coa"` lewat `useState` — **tanpa query param**, jadi tidak
ada deep-link ke tab RAB yang akan pecah. File shared lain:
`expenses.types.ts` (87 baris; memuat `RabBottleneckMetrics` yang murni RAB,
serta `SiteOption`/`CategoryOption` yang dipakai dua halaman) dan `page.tsx`.

### 3.4 Izin dan infrastruktur ikutan

- Tidak ada permission `rab:*`. Semua route RAB memakai
  `expense:read|create|update|delete`.
- Approval memakai flag kolom `Role.canApproveRab` (bukan permission string),
  menyebar ke `modules/roles` (8 file), `lib/auth/*`, `types/next-auth.d.ts`,
  dan UI roles.
- Satu menu saja: `lib/menu-config.ts` code `FINANCE.EXPENSE` →
  `/admin/pengeluaran`.
- Cron `rab-status-eval` terdaftar di `lib/cron-registry.ts` (harian 01:00).
- Tidak ada event domain RAB. Notifikasi reminder dikirim imperatif.
- Dua test arsitektur meng-hardcode path RAB:
  `tests/architecture/module-public-api.test.ts` (allowlist ukuran file UI dan
  service) dan `tests/architecture/financial-route-authorization.test.ts`
  (peta 4 route RAB → mekanisme otorisasi).

## 4. Keputusan desain

**D1 — Nama Prisma tidak diubah; nol migration.**
Nama "proyek" hidup di nama modul, URL, dan menu. Model dan tabel tetap `Rab*`.
Rename akan menyentuh 10 model plus 8 FK di 7 model lain tanpa menambah nilai
hari ini, dan "RAB" tetap nama bisnis yang benar untuk dokumen anggaran proyek.
Konsekuensi yang diterima: nama simbol di dalam `modules/proyek` tetap `Rab*`,
sehingga diff pemindahan bisa direview baris per baris.

**D2 — Pindah dengan `git mv`, isi file tidak disentuh.**
Yang berubah hanya jalur impor, dengan satu pengecualian yang disebut di §5:
`FinanceRabFacadeService` berganti nama menjadi `ProyekService`. Perbaikan smell
di dalam logika RAB ditunda supaya diff ekstraksi tetap bisa dibaca dan test
existing tetap sah sebagai jaring pengaman.

**D3 — Tanpa shim re-export di finance.**
Alternatifnya (`modules/finance/public-queries` menunjuk ke proyek) akan hidup
selamanya sebagai pintu palsu — persis utang yang sedang dibersihkan.
Importirnya hanya 12 file investor + 5 file UI investor + 1 wrapper di `lib/`,
jadi diupdate langsung.

**D4 — Kopling dua arah diselesaikan dengan pintu `public-queries` di kedua
sisi**, mengikuti pola investor ↔ finance yang sudah ada. Satu pintu baru
ditambahkan: `modules/finance/public-queries.ts` dengan
`getExpensesByRabProject()`, menggantikan impor `ExpenseRepository` di
`RabProjectRouteService`. Modul proyek tidak pernah menyentuh `prisma.expense`
langsung.

**D5 — Join Prisma lintas tabel dibiarkan.**
`ExpenseRepository` tetap melakukan `include { rabProject: { select: {id,name} } }`.
Batas modul ditegakkan pada impor TypeScript, bukan pada join dalam satu schema;
memaksa lookup terpisah di sini hanya menambah query tanpa manfaat.

**D6 — URL API berpindah ke `/api/proyek/**`.**
Ini satu-satunya kontrak yang berubah. Konsumennya hanya UI admin yang
dipindahkan dalam pekerjaan yang sama; nol konsumen mobile atau eksternal, dan
tidak ada deep-link tab (§3.3). Ditandai `Breaking: ✅ Ya` di changelog. Route
lama dihapus, tidak dialiaskan.

**D7 — Permission tidak diganggu; menu baru memetakan ke resource `expense`.**
Role yang ada langsung bisa membuka `/admin/proyek` tanpa migrasi data.

**D8 — Cron tetap di `app/api/cron/rab-status-eval`.**
`lib/cron-registry.ts` menyimpan path, bukan modul; memindahkannya berarti
mengubah jadwal terdaftar tanpa alasan. Service yang dipanggilnya
(`RabStatusEvaluationService`) ikut pindah ke `modules/proyek`, route-nya hanya
mengganti jalur impor.

## 5. Struktur modul target dan pemetaan file

Mengikuti `modules/planning` (pola termatang di repo), dengan pemisahan
`index.ts` server-safe vs `client.ts` client-safe:

```
modules/proyek/
├── domain/
│   ├── entities/RabProjectEntity.ts
│   └── ports/IRabProjectRepository.ts
├── repositories/        (16 file, ~1.825 baris)
│   ├── RabProjectRepository.ts, RabProjectUpdateRepository.ts
│   ├── rabProject.repository-*.ts, rabProject.*-helpers.ts, rabProject.types.ts
│   ├── RabItemRepository.ts, RabWbsRepository.ts,
│   │   RabDisbursementRepository.ts, RabInvestorRepository.ts
│   ├── RabInvestorQueryRepository.ts
│   ├── shared/rabInvestmentCalculator.ts
│   ├── prisma-boundary.ts     (re-export 10 enum Rab* dari @prisma/client)
│   └── index.ts
├── services/            (11 file, ~1.998 baris)
│   ├── RabProjectRouteService.ts, RabRevisionRouteService.ts
│   ├── RabApprovalService.ts, RabRevisionApprovalService.ts
│   ├── RabApprovalReminderRouteService.ts, RabStatusEvaluationService.ts
│   ├── ProyekService.ts        (ex-FinanceRabFacadeService)
│   ├── rabProjectRouteSerializers.ts, rab-project-route.helpers.ts
│   └── rab-revision-*.helpers.ts
├── utils/               (9 file, ~1.004 baris: rab-tracking/*, rabTarget,
│                         rab-revisions, rab-revision-variance,
│                         rab-bottleneck-metrics, rab-approval-reminder)
├── validators/rabProjectSchemas.ts
├── types/rab-revision.types.ts
├── index.ts             (public API server-safe)
├── client.ts            (public API client-safe: rab-tracking + rabTarget)
└── public-queries.ts    (pintu baca untuk modules/investor)
```

`FinanceRabFacadeService` diganti nama menjadi `ProyekService` karena setelah
ekstraksi ia bukan lagi facade milik finance — ini satu-satunya rename simbol
yang dilakukan, dan pemakainya tunggal (route `POST`/`GET` daftar proyek).

### Yang dibedah di `modules/finance`

| File | Tindakan |
|---|---|
| `index.ts` | cabut 6 `export *` service RAB, 3 schema, 6 helper client RAB |
| `client.ts` | sisakan `buildDailyExpenseIndicators` |
| `public-queries.ts` | **isi pindah** ke `modules/proyek/public-queries.ts`; file ini ditulis ulang berisi `getExpensesByRabProject()` untuk dipakai proyek |
| `repositories/index.ts` | cabut 5 barrel repo RAB |
| `services/FinanceService.ts` | cabut `getRabProjects`, `createRabProject`, dan impor 7 enum `Rab*` |
| `services/FinanceExpenseFacadeService.ts` | bersihkan 4 sentuhan RAB |
| `types/invoice.enums.ts` | pindahkan `RabExpenseType`, `RabRevisionStatus`, `RabStatus` lokal ke `modules/proyek` |
| `validation.ts` | barrel 100% RAB → dihapus, digantikan `modules/proyek/validators` |
| `repositories/ExpenseRepository.ts`, `services/ExpenseRouteService.ts` | tidak diubah (hanya FK + join) |

`lib/validations/rab-project.ts` (wrapper 4 baris) diarahkan ke
`@/modules/proyek`.

## 6. Kontrak antar modul

```
                    ┌──────────────────────────────┐
                    │      modules/proyek          │
                    │  (ex-RAB: anggaran, revisi,  │
                    │   realisasi, BEP, investor)  │
                    └──────────────────────────────┘
                      │ ▲                    │ ▲
   proyek/public-queries │                   │ │ investor/public-queries
   (5 fungsi baca)     ▼ │                   ▼ │
          ┌──────────────────┐      ┌──────────────────┐
          │ modules/investor │      │ modules/finance  │
          └──────────────────┘      │ (expense, COA,   │
                                    │  invoice, bayar) │
                                    └──────────────────┘
                                      ▲ finance/public-queries
                                        getExpensesByRabProject()
```

Empat aturan yang dikunci test boundary (§10):

1. `modules/finance` tidak mengimpor apa pun dari `modules/proyek/**` kecuali
   lewat `modules/proyek` (index/client).
2. `modules/proyek` menyentuh data expense **hanya** lewat
   `modules/finance/public-queries`.
3. `modules/investor` menyentuh data RAB **hanya** lewat
   `modules/proyek/public-queries` dan `modules/proyek/client`.
4. `modules/proyek` menyentuh data investor **hanya** lewat
   `modules/investor/public-queries`.

## 7. API dan URL

| Lama | Baru |
|---|---|
| `GET/POST /api/finance/rab-projects` | `GET/POST /api/proyek` |
| `GET /api/finance/rab-projects/dashboard` | `GET /api/proyek/dashboard` |
| `GET/PATCH/DELETE /api/finance/rab-projects/[id]` | `/api/proyek/[id]` |
| `POST .../[id]/approve` `copy` `actuals` `reminder` | `/api/proyek/[id]/…` |
| `GET .../[id]/revision-profit-loss` | `/api/proyek/[id]/revision-profit-loss` |
| `GET/POST .../[id]/revisions` | `/api/proyek/[id]/revisions` |
| `GET/PATCH .../[id]/revisions/[revisionId]` | idem di bawah `/api/proyek` |
| `POST .../[revisionId]/submit` `approve` `reject` | idem di bawah `/api/proyek` |
| `POST /api/cron/rab-status-eval` | **tetap** (D8) |

Guard tiap route tidak berubah (`expense:*`, `canApproveRab`, `CRON_SECRET`).

## 8. UI

```
app/admin/proyek/
├── page.tsx                 (ensurePermission("expense:read"))
├── ProyekClient.tsx         (hasil pecahan cabang activeTab === "rab")
├── RABList.tsx RABForm.tsx RABView.tsx RABCompare.tsx …   (31 file pindah)
├── RABForm/{tabs,hooks,utils}/…
└── rabTypes.ts rab-csv.ts rab-pdf.ts rab-formatters.ts …
```

- `ExpensesClient.tsx`: hapus cabang `activeTab === "rab"`, 139 sentuhan RAB,
  dan impor `RABForm/RABList/RABView/RABRevisionForm/rabTypes`. Tab bar menjadi
  dua tab (`daily`, `coa`). Tombol aksi header tidak lagi bercabang per-tab RAB.
- `expenses.types.ts`: `RabBottleneckMetrics` → `modules/proyek`;
  `ExpenseFormItem.rabProjectId/rabItemId` dan `ExpenseItem.rabProject/rabItem`
  **tetap** (pengeluaran memang boleh ditautkan ke proyek).
- `SiteOption` dan `CategoryOption` dipakai dua halaman → naik ke `types/`
  global, bukan saling impor antar halaman admin.
- `rabTracking.ts` (re-export 7 baris) diarahkan ke `@/modules/proyek/client`.
- Pemanggilan `fetch`/SWR di UI proyek diarahkan ke `/api/proyek/**`.

UI investor yang menyentuh RAB (`app/admin/investors/*` 3 file,
`app/investor/projects/*` 2 file) diupdate jalur impornya.

## 9. Menu dan izin

- `lib/menu-config.ts`: entri baru code `FINANCE.PROYEK`, nama **"Proyek (RAB)"**,
  path `/admin/proyek`, `section` sama dengan `FINANCE.EXPENSE`,
  `featureModule` mengikuti finance.
- `components/layout/admin-sidebar/adminSidebarIcons.tsx`: daftarkan ikonnya.
- `components/layout/admin-sidebar/adminSidebarMenu.ts`: tambah `specialMappings`
  `FINANCE.PROYEK` → resource **`expense`** (tanpa ini, resource jatuh ke
  `proyek` dan menu hilang untuk semua role).
- `lib/financial-write-permissions.ts`: tambahkan catatan gate `/admin/proyek`.
- Tidak ada perubahan `lib/permissions.ts`, `lib/permission-config.ts`,
  `prisma/schema.prisma`, atau data role.

## 10. Pengujian

**Jaring pengaman utama**: 30 test RAB existing (~3.516 baris) ikut pindah path
tanpa ubah isi, kecuali jalur `vi.mock` dan impor:
`tests/api/finance/rab-*` → `tests/api/proyek/`,
`tests/modules/finance/Rab*` → `tests/modules/proyek/`,
`tests/ui/rab-*` → `tests/ui/proyek/`, plus 3 test di `tests/lib/`.

**Diperbarui**:
- `tests/architecture/module-public-api.test.ts` — allowlist path UI
  (`RABForm/RABView/RABList`) dan service (`RabStatusEvaluationService`,
  `RabProjectRouteService`, `RabProjectRepository`).
- `tests/architecture/financial-route-authorization.test.ts` — peta 4 route RAB
  ke jalur `/api/proyek/**`.
- Test investor yang mem-mock `@/modules/finance/public-queries` diarahkan ke
  `@/modules/proyek/public-queries` — minimal `InvestorPortalRepository.test.ts`
  dan `InvestorProfitShareRepository.test.ts`; daftar pastinya dikumpulkan lewat
  grep `vi.mock` saat Fase 1.

**Baru**: satu test boundary di `tests/architecture/` yang mengunci empat aturan
§6 dengan membaca impor statis di `modules/finance`, `modules/proyek`, dan
`modules/investor`.

**Gerbang selesai**, dijalankan berurutan:
`npm run typecheck` → `npm test` → `npm run lint` → `npm run build:quick`.
Ditambah smoke manual: buka `/admin/proyek` (daftar, buat, lihat, revisi,
approve, input realisasi, export CSV/PDF) dan `/admin/pengeluaran` (tab harian
dan kategori, termasuk pengeluaran yang tertaut ke proyek).

## 11. Urutan eksekusi

Empat fase berurutan di branch aktif, satu commit per fase, `npm run typecheck`
hijau di akhir setiap fase.

**Fase 1 — lapisan modul.** `git mv` 49 file ke `modules/proyek`; bentuk
`index.ts`/`client.ts`/`public-queries.ts`; tulis
`modules/finance/public-queries.ts` baru dan ganti impor `ExpenseRepository` di
`RabProjectRouteService`; cabut RAB dari `FinanceService`, `index.ts`,
`client.ts`, barrel repositories, `invoice.enums.ts`; update 12 file investor,
5 UI investor, `lib/validations/rab-project.ts`.

**Fase 2 — API.** `git mv` 13 route ke `app/api/proyek/**`; arahkan impor cron
route; pindahkan dan update test API.

**Fase 3 — UI.** Buat `app/admin/proyek/`; `git mv` 31 file; pecah
`ExpensesClient.tsx` menjadi `ProyekClient.tsx` + `ExpensesClient.tsx` dua tab;
pindahkan `SiteOption`/`CategoryOption` ke `types/`; arahkan fetch ke
`/api/proyek/**`; tambah menu, ikon, `specialMappings`.

**Fase 4 — penutup.** Perbarui dua test arsitektur, tambah test boundary,
pindahkan sisa test UI, tulis entri `docs/CHANGELOG.md`, perbarui
`docs/project-memory/04-modules.md` dan `docs/architecture/clean-architecture.md`
bila menyebut RAB sebagai bagian finance.

## 12. Risiko

| Risiko | Mitigasi |
|---|---|
| **Pemecahan `ExpensesClient.tsx`** (2.100 baris, 139 titik RAB) — paling rawan regresi | Pecah mengikuti batas `activeTab` yang sudah ada, bukan menulis ulang. State yang dipakai dua tab (site, kategori, refreshKey) diidentifikasi dulu lewat daftar, baru dipisah. Test UI existing + smoke manual §10. |
| Siklus impor baru antara finance ↔ proyek | Pintu `public-queries` searah di tiap sisi (§6), dikunci test boundary. Fase 1 diakhiri dengan `typecheck` yang akan menangkap siklus tipe. |
| URL API berubah, ada pemanggil tersembunyi | Grep `rab-projects` di seluruh repo (termasuk `mobile-netmanager`, `scripts/`, `worker/`) sebelum menghapus route lama. |
| Test arsitektur gagal karena path hardcoded | Sudah dipetakan di §3.4; diperbarui di Fase 4 sebagai bagian definisi selesai. |
| Modul proyek tanpa `errors/` dan tanpa service factory (ikut gaya lama finance) | Diterima di tahap ini (D2). Penyelarasan penuh ke gaya `modules/planning` jadi pekerjaan terpisah. |

## 13. Jalan ke OSP dan utang yang ditunda

Urutan yang direkomendasikan setelah ekstraksi ini, masing-masing spec sendiri:

1. **Permission `proyek:*`** — pisahkan dari `expense:*`, lalu ganti flag
   `Role.canApproveRab` menjadi `proyek:approve`. Butuh migrasi data role dan
   menyentuh `modules/roles`, sesi auth, UI roles.
2. **Tautan proyek ↔ Planning OSP** — satu proyek menampung N planning OSP
   (`Planning.proyekId` nullable, tanpa memaksa planning punya proyek).
   Modul planning tidak dipakai produksi (nol baris), jadi skemanya masih bebas
   diubah.
3. **BOQ planning → item RAB** — `PlanningItem` ber-`sourceKey` hasil
   `kebutuhan-material-osp.ts` menyuntik `RabItem`, sehingga kebutuhan material
   teknis mengalir ke anggaran tanpa diketik ulang. Perlu keputusan arah
   kebenaran: estimasi planning vs anggaran RAB yang sudah disetujui.
4. **Penyelarasan pola** — `errors/`, Unit of Work, dan service factory ala
   `modules/planning` untuk `modules/proyek`.
