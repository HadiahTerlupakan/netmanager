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

### [2026-09-02] — Kanban OSP: seret kartu kini benar-benar memindahkan tahap

- **Tipe**: [FIXED]
- **Scope**: `app/admin/planning`, `modules/planning`
- **Author**: agent
- **Deskripsi**: Papan kanban memasang `draggable` dan `onDragStart` pada setiap
  kartu, tetapi **tidak ada satu pun handler `onDrop` atau `onDragOver` di kolom
  mana pun**. Kartu bisa diangkat, berubah transparan, lalu dijatuhkan tanpa efek
  apa pun — antarmuka menjanjikan sesuatu yang tidak ditepatinya. Komentar di
  berkas itu menyebut alasannya: "status change via PATCH/PUT tidak tersedia di
  API". Premis itu sudah tidak berlaku setelah transisi `start`/`complete`
  ditambahkan, sehingga seret kini dijadikan aksi yang sungguh berfungsi.
  Kolom tujuan menyala saat kartu diseret, dan hanya kolom yang benar-benar sah
  yang menerima jatuhan.
- **Keputusan desain**: hanya transisi yang tidak memerlukan masukan tambahan
  yang bisa dilakukan lewat seret — ajukan, ajukan ulang, mulai, selesai.
  **Persetujuan dan penolakan sengaja dikecualikan**: persetujuan adalah
  keputusan kendali atas belanja infrastruktur sehingga satu selip tetikus tidak
  boleh cukup untuk menyetujuinya, dan penolakan wajib disertai alasan yang tidak
  mungkin diisi lewat gestur. Keduanya tetap lewat tombol dan dialog di halaman
  detail.
- **Perbaikan teks**: subtitle sebelumnya berbunyi "drag card untuk lihat detail",
  padahal yang menampilkan detail adalah klik, bukan seret. Diganti sesuai
  perilaku sebenarnya dan menyesuaikan izin pengguna. Judul "Kanban Board" →
  "Papan perencanaan"; kolom kosong tidak lagi berbunyi "Kosong" melainkan
  memberi arahan, dan berubah menjadi "Lepas di sini untuk memindahkan" saat
  menjadi tujuan yang sah.
- **Files**: `modules/planning/domain/planning-kanban-transitions.ts`,
  `modules/planning/client.ts`, `app/admin/planning/PlanningKanbanClient.tsx`
- **Breaking**: ❌ Tidak — gestur yang sebelumnya tidak melakukan apa-apa kini
  melakukan apa yang tampak dijanjikannya

### [2026-09-02] — Tes regresi transisi kanban

- **Tipe**: [ADDED]
- **Scope**: `tests/modules/planning`
- **Author**: agent
- **Deskripsi**: 11 tes untuk `resolveKanbanTransition`, diverifikasi merah lebih
  dulu: transisi sah lewat seret, penolakan persetujuan dan penolakan lewat
  seret, penolakan gerak mundur, penolakan lompatan yang melewati tahap, dan
  penolakan jatuhan ke kolom asalnya sendiri.
- **Files**: `tests/modules/planning/planning-kanban-transitions.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Rencana yang ditolak kini bisa diajukan ulang

- **Tipe**: [FIXED]
- **Scope**: `modules/planning`, `app/admin/planning`
- **Author**: agent
- **Deskripsi**: `canBeSubmitted()` di domain mengizinkan status `BACKLOG` maupun
  `REJECTED`, tetapi halaman detail hanya menampilkan tombol Ajukan saat
  `BACKLOG`. Akibatnya rencana yang ditolak dapat diperbaiki tetapi **tidak
  pernah bisa diajukan ulang** — jalan buntu yang hanya terlihat dari UI, bukan
  dari kode service. Logika gerbang aksi yang sebelumnya inline dan tidak teruji
  dipindah ke `resolvePlanningActions()` di domain, sehingga aturannya tunggal,
  bisa diuji tanpa merender komponen, dan tidak bisa menyimpang lagi dari aturan
  domain. Tombol menyesuaikan konteks: "Ajukan ulang" untuk rencana yang ditolak.
- **Files**: `modules/planning/domain/planning-actions.ts`,
  `modules/planning/client.ts`, `app/admin/planning/[id]/PlanningDetailClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Halaman OSP menampilkan aksi dan angka yang selama ini tersembunyi

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/planning`, `modules/planning`
- **Author**: agent
- **Deskripsi**: Transisi `start`/`complete` sudah punya endpoint tetapi belum
  punya tombol, sehingga alur pelaksanaan tetap tidak terjangkau dari antarmuka.
  Ditambahkan aksi **Mulai pengerjaan** dan **Tandai selesai** pada halaman
  detail. Data turunan yang ditambahkan sebelumnya juga belum pernah tampil:
  kini halaman detail menampilkan **Total item (BOQ)** di samping anggaran
  rencana, peringatan bila keduanya berselisih, serta **Progres milestone**
  berdampingan dengan progres yang dicatat manual — supaya perbedaan keduanya
  terlihat, bukan tersembunyi.
  Label diseragamkan ke Bahasa Indonesia dan istilah yang dikenali petugas
  lapangan: "Approved L1" → "Disetujui tahap 1", "Menunggu Approval" → "Menunggu
  persetujuan", "Backlog" → "Draf", "Pending" (milestone) → "Belum dikerjakan".
  Nama field mengikuti apa yang dikendalikan pengguna: "Estimasi Budget" →
  "Anggaran rencana", "Actual Budget" → "Realisasi".
- **Catatan**: pemolesan dibatasi pada hal yang dapat diverifikasi dari kode —
  struktur aksi, kejelasan label, dan data yang tidak tertampil. Penilaian
  estetika tidak dilakukan karena tidak dapat diverifikasi tanpa melihat render,
  dan modul ini mengikuti sistem desain admin yang sudah ada.
- **Files**: `app/admin/planning/[id]/PlanningDetailClient.tsx`,
  `modules/planning/utils/statusConfig.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Tes regresi gerbang aksi planning

- **Tipe**: [ADDED]
- **Scope**: `tests/modules/planning`
- **Author**: agent
- **Deskripsi**: 14 tes untuk `resolvePlanningActions`, diverifikasi merah lebih
  dulu: pengajuan ulang setelah ditolak, aksi mulai hanya saat disetujui, aksi
  selesai hanya saat berjalan, pencatatan realisasi hanya saat berjalan, dan
  penghormatan terhadap izin pengguna.
- **Files**: `tests/modules/planning/planning-actions.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Tutup alur pelaksanaan OSP yang buntu setelah disetujui

- **Tipe**: [FIXED]
- **Scope**: `modules/planning`, `app/api/planning`
- **Author**: agent
- **Deskripsi**: Alur OSP berhenti di `APPROVED`. Tidak ada endpoint, method
  service, maupun jalur lain yang memindahkan rencana ke `IN_PROGRESS` atau
  `COMPLETED` — `canStartProgress()` bahkan sudah tersedia di entity sejak awal
  tetapi tidak pernah dipanggil. Akibatnya dua kolom Kanban ("In Progress" dan
  "Completed") serta metrik dashboard menampilkan status yang mustahil tercapai.
  Diperparah kontradiksi kedua: `updatePlanningSchema` menerima `actualBudget`,
  `progressPercentage`, dan `startDate`, tetapi `update()` menolak bila status
  bukan `BACKLOG`/`REJECTED` — sehingga realisasi hanya bisa diisi SEBELUM
  disetujui, ketika realisasi itu belum ada, lalu terkunci selamanya.
  Ditambahkan `startProgress()` (APPROVED → IN_PROGRESS, mencatat `startDate`)
  dan `complete()` (IN_PROGRESS → COMPLETED, mencatat `actualCompletionDate` dan
  mengunci progres ke 100), masing-masing dengan endpoint `POST /api/planning/
  [id]/start` dan `/complete`. Jendela perubahan dipisah: `canBeEdited()` tetap
  mengunci field perencanaan setelah disetujui, sementara
  `canRecordExecutionProgress()` yang baru membuka pencatatan realisasi khusus
  saat `IN_PROGRESS`. Perubahan ruang lingkup saat pelaksanaan ditolak eksplisit.
- **[Asumsi]**: tombol Mulai/Selesai memakai permission `planning:update`, sama
  dengan hak mengedit rencana. Bila organisasi memerlukan peran lapangan
  terpisah, permission di kedua route itulah yang perlu diganti.
- **Migration**: tidak ada. `AuditAction` adalah enum Prisma, sehingga transisi
  baru sengaja memakai nilai `STATUS_CHANGED` yang sudah ada alih-alih menambah
  `STARTED`/`COMPLETED` yang akan menuntut migration.
- **Files**: `modules/planning/services/PlanningApprovalService.ts`,
  `modules/planning/services/PlanningService.ts`,
  `modules/planning/domain/entities/PlanningEntity.ts`,
  `modules/planning/domain/ports/IPlanningRepository.ts`,
  `modules/planning/repositories/PlanningRepository.ts`,
  `app/api/planning/[id]/start/route.ts`,
  `app/api/planning/[id]/complete/route.ts`
- **Breaking**: ❌ Tidak — hanya membuka transisi yang sebelumnya mustahil

### [2026-09-02] — Tes regresi alur pelaksanaan OSP

- **Tipe**: [ADDED]
- **Scope**: `tests/modules/planning`
- **Author**: agent
- **Deskripsi**: 20 tes untuk transisi mulai/selesai beserta penolakan dari
  status yang tidak sah, dan untuk pemisahan jendela edit rencana versus
  pencatatan realisasi. Seluruhnya diverifikasi merah lebih dulu; melumpuhkan
  ketiga penegakan sekaligus membuat 12 tes gagal.
- **Files**: `tests/modules/planning/PlanningApprovalService.execution.test.ts`,
  `tests/modules/planning/PlanningEntity.editability.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Perbaikan logika bisnis planning OSP

- **Tipe**: [FIXED]
- **Scope**: `modules/planning`
- **Author**: agent
- **Deskripsi**: Empat cacat logika bisnis pada modul perencanaan OSP.
  **(1) Persetujuan bertingkat tanpa pemisahan wewenang.** Alur `approvalLevel: 2`
  memisahkan `approvedLevel1ById` dan `approvedById` — maksudnya jelas dua orang
  berbeda — tetapi tidak ada satu pun pembandingan. Satu orang dapat membuat,
  mengajukan, lalu menyetujui kedua tingkat sendirian, sehingga persetujuan
  berlapis hanya menambah klik tanpa memberi kendali. Ditambah
  `assertApproverIsDistinct()` yang menolak penyetuju tingkat kedua yang sama
  dengan tingkat pertama.
  **(2) BOQ tidak menggulung ke anggaran.** `PlanningItemEntity.getTotalEstimated()`
  ada tetapi tidak pernah dipanggil di mana pun, sehingga total item dapat berbeda
  jauh dari `estimatedBudget` di header tanpa ada yang memprotes. DTO detail kini
  membawa `itemsTotalEstimatedCost` dan `hasBudgetMismatch`. Nilai header sengaja
  TIDAK ditimpa — ia bisa memuat komponen di luar BOQ, jadi yang dibutuhkan adalah
  selisihnya terlihat, bukan disembunyikan.
  **(3) Progres diketik manual.** `progressPercentage` diisi langsung dari input dan
  tidak terkait milestone, sehingga sebuah rencana dapat menyatakan 90% selesai
  padahal seluruh milestone masih `PENDING`. DTO detail kini membawa
  `milestoneProgressPercentage` yang dihitung dari milestone berstatus `COMPLETED`,
  atau null bila belum ada milestone sebagai dasar.
  **(4) Realisasi anggaran nol ditolak.** Validator memakai `z.number().positive()`
  sehingga `actualBudget: 0` — pekerjaan selesai tanpa biaya, atau realisasi belum
  keluar — tidak dapat disimpan. Diganti `nonnegative()`.
- **Files**: `modules/planning/domain/planning-business-rules.ts`,
  `modules/planning/services/PlanningApprovalService.ts`,
  `modules/planning/mappers/PlanningMapper.ts`,
  `modules/planning/dto/PlanningDTO.ts`,
  `modules/planning/validators/planningSchemas.ts`
- **Migration**: tidak ada perubahan `schema.prisma` — seluruh perbaikan memakai
  kolom yang sudah tersedia dan nilai turunan yang dihitung saat baca
- **Breaking**: ⚠️ Sebagian — penyetuju tingkat kedua yang sama dengan tingkat
  pertama kini ditolak. Itu memang tujuannya.

### [2026-09-02] — Tes regresi aturan bisnis planning OSP

- **Tipe**: [ADDED]
- **Scope**: `tests/modules/planning`
- **Author**: agent
- **Deskripsi**: 22 tes, seluruhnya diverifikasi merah lebih dulu terhadap perilaku
  lama: pemisahan wewenang (aturan murni maupun penegakannya di service), rollup
  BOQ termasuk item tanpa harga, deteksi ketidakcocokan anggaran, dan perhitungan
  progres dari milestone termasuk pembulatan serta kondisi tanpa milestone.
  Tes penegakan di service ditambahkan setelah disadari tes aturan murni saja
  tidak menangkap hilangnya pemanggilan dari service.
- **Catatan**: `modules/planning/__tests__/api-routes-integration.test.ts` yang
  sudah ada TIDAK pernah dijalankan — `vitest.config.ts` hanya memindai
  `tests/**`, sehingga berkas tes di dalam `modules/**` memberi rasa aman palsu.
  Tes baru karena itu ditempatkan di `tests/modules/planning/`.
- **Files**: `tests/modules/planning/planning-business-rules.test.ts`,
  `tests/modules/planning/PlanningMapper.derived.test.ts`,
  `tests/modules/planning/PlanningApprovalService.segregation.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Aktifkan isolasi tenant pada database RADIUS

- **Tipe**: [SECURITY]
- **Scope**: `lib/`
- **Author**: agent
- **Deskripsi**: `lib/prisma-radius.ts` meneruskan SELURUH 9 tabel radius ke
  parameter `ignoreModels` milik `withTenantIsolation()` — lewat variabel bernama
  `tenantScopedModels`, nama yang menyatakan kebalikan dari maksud parameternya.
  Efeknya `prismaRadius` tidak punya isolasi tenant otomatis sama sekali, padahal
  schema-nya jelas dirancang multi-tenant: 22 penyebutan `tenantId` lengkap dengan
  index dan unique constraint seperti `@@unique([username, attribute, tenantId])`.
  Isolasi kini aktif untuk 8 tabel. `radpostauth` sengaja tetap dikecualikan.
  Konstantanya dipindah ke `lib/prisma-radius-isolation.ts` dengan nama yang jujur
  (`RADIUS_ISOLATION_EXEMPT_MODELS`) agar arah maknanya tidak lagi tertukar.
- **Dasar keputusan (diverifikasi di database produksi, bukan asumsi)**:
  `radpostauth` berisi 54.749 baris dan SEMUANYA ber-`tenantId` NULL — FreeRADIUS
  menulisnya langsung dan tabel itu tidak punya trigger pengisi tenant.
  Mengisolasinya akan menyembunyikan seluruh log autentikasi dari aplikasi.
  Sebaliknya `radacct` punya trigger `trg_radacct_set_tenantid` (BEFORE
  INSERT/UPDATE) sehingga 12 barisnya terisi penuh dan aman diisolasi; enam tabel
  lain masih kosong dan ditulis aplikasi.
- **Catatan**: sebelum perubahan ini tidak ada kebocoran aktif — seluruh call site
  radius memfilter `tenantId` manual (306 penyebutan; tiga kandidat "tanpa filter"
  diverifikasi sebagai false positive). Yang hilang adalah pertahanan berlapis:
  satu `where` yang terlupa akan bocor senyap tanpa penahan, berbeda dari billing
  dan DB utama yang punya jaring pengaman.
- **Files**: `lib/prisma-radius.ts`, `lib/prisma-radius-isolation.ts`
- **Breaking**: ⚠️ Perlu pemantauan — query radius dari konteks tanpa tenant dan
  di luar `runAsSystemContext` kini akan ditolak fail-closed. Cron dan monitor
  sudah memakai elevasi eksplisit, route API sudah punya konteks tenant.

### [2026-09-02] — Tes regresi isolasi tenant RADIUS

- **Tipe**: [ADDED]
- **Scope**: `tests/lib`
- **Author**: agent
- **Deskripsi**: 10 tes yang memaku keputusan pengecualian beserta alasannya:
  `radpostauth` wajib dikecualikan, `radacct` dan tujuh tabel lain wajib TIDAK
  dikecualikan, dan hanya satu model yang boleh ada di daftar. Diverifikasi merah
  lebih dulu dengan mengembalikan daftar sembilan tabel yang lama.
- **Files**: `tests/lib/prisma-radius-isolation.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — hasPermission() kini mengenali pemanggil Bearer

- **Tipe**: [SECURITY]
- **Scope**: `lib/`
- **Author**: agent
- **Deskripsi**: `hasPermission()` hanya mencoba `getServerSession`. Untuk pemanggil
  Bearer (token mobile karyawan) sesi itu null sehingga fungsi **selalu**
  mengembalikan `false`. Scan menemukan **271 pemakaian** di dalam route
  `createHandler`, dengan dua akibat berlawanan arah:
  **(a) 13 pembatas cakupan MATI** — `mikrotik:site_only` (7), `expense:site_only`
  (5), `sales:site_only` (1). `false` berarti pembatas tidak berlaku, jadi pemanggil
  Bearer melihat data **lebih luas** dari yang seharusnya. Ini kebocoran data, dan
  defect yang persis sama dengan `canOnlyAccessOwnSite` pada invoice yang sudah
  diperbaiki lebih dulu — waktu itu hanya modul invoice yang disapu.
  **(b) 258 gerbang kapabilitas selalu menolak** — fail-closed, bukan lubang
  keamanan, tapi membuat endpoint tersebut mustahil dipakai dari mobile.
  Diperbaiki di sumbernya, bukan di 271 tempat: `resolveRbacPrincipal()`
  menyelesaikan principal dengan urutan eksplisit → sesi → token Bearer, dan
  dipakai oleh `hasPermission()` serta `hasAnyPermission()`. Seluruh logika lain
  di `hasPermission` memang sudah benar (bypass super admin, wildcard, alias);
  hanya resolusi principal yang cacat.
- **Catatan**: kegagalan resolusi Bearer sengaja tidak dilempar — `hasPermission`
  dipakai di ratusan tempat dan harus tetap fail-closed, bukan meledak.
- **Files**: `lib/rbac-principal.ts`, `lib/rbac.ts`
- **Breaking**: ⚠️ Sebagian — pemanggil Bearer yang selama ini lolos dari pembatas
  `*:site_only` kini benar-benar terbatas pada site-nya. Itu memang maksud
  permission tersebut.

### [2026-09-02] — Tes regresi resolusi principal RBAC

- **Tipe**: [ADDED]
- **Scope**: `tests/lib`
- **Author**: agent
- **Deskripsi**: 6 tes untuk `resolveRbacPrincipal`: prioritas argumen eksplisit,
  sesi, fallback Bearer, kedua sumber kosong, kegagalan resolusi Bearer yang tidak
  boleh melempar, dan jaminan Bearer tidak disentuh saat sesi sudah menjawab.
  Diverifikasi merah lebih dulu dengan mengembalikan perilaku "berhenti di sesi".
- **Files**: `tests/lib/rbac-principal.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Perbaiki pengecekan permission yang menolak super admin

- **Tipe**: [FIXED]
- **Scope**: `lib/`, `modules/users`, `modules/marketing`, `modules/network`,
  `app/api/admin/payments`, `app/api/marketing`
- **Author**: agent
- **Deskripsi**: `GET /api/admin/users/[id]` membalas **403 untuk Super Admin** di
  produksi (terverifikasi dari log pod: `/performance` dan `/sales-performance`
  membalas 200, hanya endpoint ini yang 403). Penyebabnya
  `permissions.includes("users:read")` — pengecekan mentah tanpa cabang wildcard.
  Super admin memegang `["*"]`, sehingga `includes()` bernilai `false` dan super
  admin justru DITOLAK. `createHandler` sudah melakukannya dengan benar
  (`includes(perm) || includes("*")`), tapi lapisan service menulis ulang
  pengecekannya dan menghilangkan cabang wildcard.
  Ditambah helper kanonik `hasCapability()` di `lib/permission-aliases.ts` yang
  menangani wildcard DAN alias, lalu dipakai di 22 pengecekan kapabilitas pada 8
  berkas. Catatan: `hasPermissionWithAlias()` yang sudah ada juga tidak menangani
  wildcard, sehingga tidak ada satu pun helper yang benar untuk dipakai ulang —
  itulah sebabnya pola salah ini menyebar.
- **Sengaja TIDAK diubah**: seluruh pengecekan `*:site_only` dan
  `*:department_only`. Keduanya pembatas CAKUPAN, bukan pemberian kapabilitas —
  di sana `includes()` mentah justru yang benar, karena super admin yang ikut
  cocok malah akan terkurung ke satu site atau departemen.
- **Bukan regresi dari pekerjaan RBAC sebelumnya**: image produksi yang berjalan
  saat gejala muncul adalah `ab6e65f45` (commit tes saja), dan riwayat git pada
  `AdminUserRouteService.ts` tidak memuat satu pun commit dari rangkaian ini.
- **Files**: `lib/permission-aliases.ts`,
  `modules/users/services/AdminUserRouteService.ts`,
  `modules/network/services/ProfilePPPService.ts`,
  `modules/marketing/services/*.ts`,
  `app/api/admin/payments/pending-manual/route.ts`,
  `app/api/marketing/canvasing/[id]/{approve,reject}/route.ts`
- **Breaking**: ❌ Tidak — hanya memulihkan akses yang selama ini keliru ditolak

### [2026-09-02] — Tes regresi untuk wildcard super admin

- **Tipe**: [ADDED]
- **Scope**: `tests/`
- **Author**: agent
- **Deskripsi**: 10 tes baru, diverifikasi merah lebih dulu: perilaku
  `hasCapability()` (wildcard, cocok persis, alias, daftar kosong/undefined) dan
  regresi produksi `getAdminUserById` untuk pemegang `["*"]`. Tes terakhir diuji
  ulang dengan mengembalikan `includes()` mentah untuk memastikan benar-benar
  menangkap bug aslinya.
- **Files**: `tests/lib/has-capability.test.ts`,
  `tests/modules/users/AdminUserRouteService.superadmin.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Tutup dua jalur eskalasi ke super admin

- **Tipe**: [SECURITY]
- **Scope**: `modules/roles`, `modules/users`, `app/api/roles`
- **Author**: agent
- **Deskripsi**: Audit menemukan dua jalur independen bagi pengguna berprivilese
  rendah untuk menjadi super admin, keduanya lewat satu permission rutin.
  **(1) Rename role.** `isSuperAdminRole()` menentukan super admin dari STRING nama
  role (`"SUPER_ADMIN"` / `"Super Admin"`), sementara guard rename hanya mencegah
  role SUPER_ADMIN di-rename KELUAR. Rename role biasa MASUK ke nama itu tidak
  dijaga sama sekali, dan `ensureSuperAdminAllowed` hanya menempel di flag
  `isSuperAdmin` — sehingga jalur nama juga melewati kebijakan tenant. Pemegang
  `roles:update` dari tenant mana pun bisa mengangkat dirinya jadi super admin
  lintas-tenant. Kini `grantsSuperAdmin()` memperhitungkan flag DAN nama, dan
  pemberian status super admin menuntut aktornya sendiri super admin, bukan sekadar
  berada di tenant utama.
  **(2) Assign role.** `users:assign_super_admin` didefinisikan di
  `permission-config.ts` dan ikut di-seed, tapi grep seluruh repo hanya menemukan
  definisi dan komentar seed — nol penegakan; `roleId` mengalir dari body request
  langsung ke `data.roleId`. Ditambah `assertCanAssignRole()` /
  `assertCanAssignRoleId()` yang memeriksa role tujuan dari kedua arah (flag dan
  nama) pada jalur create maupun update user.
- **Files**: `modules/roles/services/RoleService.ts`,
  `modules/roles/services/role-service.types.ts`,
  `modules/users/services/role-assignment-guard.ts`,
  `modules/users/services/admin-user-route.create.ts`,
  `modules/users/services/admin-user-route.update.ts`,
  `app/api/roles/route.ts`, `app/api/roles/[id]/route-handlers-impl.ts`
- **Breaking**: ⚠️ Sebagian — pemegang `roles:update` yang bukan super admin tidak
  lagi bisa membuat/mengubah role super admin, dan pemberian role super admin kini
  menuntut `users:assign_super_admin`. Ini memang tujuannya.

### [2026-09-02] — Pencabutan sesi kini berlaku di jalur withAuth

- **Tipe**: [SECURITY]
- **Scope**: `lib/auth`
- **Author**: agent
- **Deskripsi**: `verifyAuth` — penjaga seluruh route `withAuth`/`withPermission` —
  tidak pernah memeriksa `tokenVersion` (0 kemunculan di `lib/auth/helpers.ts`,
  berbanding 8 di `callbacks.ts` dan 29 di `mobile-auth.ts`). Akibatnya status yang
  dicabut, termasuk super admin, tetap berlaku sampai cookie kedaluwarsa: menaikkan
  `tokenVersion` lewat force-logout pun tidak menolong karena jalur ini tidak
  membacanya. Praktisnya, akses super admin tidak bisa dicabut. Ditambah
  `isTokenRevoked()` yang memeriksa `tokenVersion` dan `isActive`, dipakai di
  `verifyAuth`. Bila lookup gagal, fungsi sengaja memilih TIDAK mencabut —
  gangguan infrastruktur tidak boleh mengunci semua orang.
- **Dampak operasional**: minimal. `tokenVersion` hanya dinaikkan saat force-logout
  dan logout mobile, jadi token pengguna normal selalu sepadan; yang ditolak hanya
  token yang memang sudah seharusnya mati.
- **Files**: `lib/auth/token-freshness.ts`, `lib/auth/helpers.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Elevasi CRON_SECRET menuntut secret benar-benar diset

- **Tipe**: [SECURITY]
- **Scope**: `lib/`
- **Author**: agent
- **Deskripsi**: `lib/tenant-context.ts` membandingkan header dengan
  `` `Bearer ${process.env.CRON_SECRET}` `` tanpa memeriksa keberadaan variabelnya,
  padahal `CRON_SECRET` bertanda `optional()` di `lib/env.ts`. Bila tidak diset,
  string yang dibandingkan menjadi literal `"Bearer undefined"` dan siapa pun yang
  mengirim header itu memperoleh `{ tenantId: null, isSuperAdmin: true }` di lapisan
  Prisma — bypass isolasi tenant tanpa sesi sama sekali. Seluruh route cron sudah
  memakai pola `!cronSecret ||`; hanya tempat ini yang tertinggal.
- **Files**: `lib/tenant-context.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Tes regresi untuk pengerasan super admin

- **Tipe**: [ADDED]
- **Scope**: `tests/`
- **Author**: agent
- **Deskripsi**: 21 tes baru, semuanya diverifikasi merah lebih dulu terhadap
  perilaku lama: penolakan rename ke kedua ejaan nama ajaib, penolakan set flag oleh
  aktor non-super-admin, jalur positif super admin di tenant utama tetap lolos,
  rename biasa tidak terganggu, penegakan `users:assign_super_admin` dari kedua arah
  (flag dan nama), dan predikat pencabutan token termasuk perilaku fail-open saat
  data pembanding tidak tersedia.
- **Files**: `tests/modules/roles/RoleService.superadmin-escalation.test.ts`,
  `tests/api/superadmin-hardening.test.ts`, `tests/api/token-revocation.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Tes otorisasi route finansial: deteksi berbasis perilaku

- **Tipe**: [CHANGED]
- **Scope**: `tests/architecture`
- **Author**: agent
- **Deskripsi**: Versi pertama tes ini mendeteksi route finansial dari **nama path**
  (`finance|invoice|payment|...`), sehingga route yang menyentuh uang tapi namanya
  tidak finansial tidak pernah dipindai — 15 route luput, termasuk
  `admin/company-bank-accounts`, `admin/pelanggan/[id]/prorate-log`,
  `integrations/mixradius/dismantle`, dan `webhooks/[provider]`.
  Deteksi kini ditambah berbasis perilaku: route yang mengimpor `@/modules/finance`,
  memakai `prismaBilling`/`client-billing`, atau menyentuh
  `InvoiceRepository`/`PaymentRepository`/`BillingRepository` ikut dipindai apa pun
  nama path-nya. Cakupan naik dari 84 ke 99 route.
  Ditambah `SERVICE_ENFORCED_AUTHORIZATION`: daftar eksplisit route yang otorisasinya
  ditegakkan di service, masing-masing menyebut simbol penegaknya (webhook lewat
  verifikasi tanda tangan; empat route RAB lewat flag `Role.canApproveRab`). Dua tes
  tambahan menjaga daftar itu tetap jujur — setiap entri wajib punya alasan dan wajib
  menunjuk route yang benar-benar ada.
- **Catatan**: penelusuran impor sempat dicoba sebagai alternatif dan **ditolak** —
  `@/lib/tenant-context` menyebut `CRON_SECRET`, sehingga setiap route yang
  mengimpornya tampak berpagar padahal belum tentu. False positive ke arah "aman"
  lebih berbahaya daripada daftar pengecualian yang bisa direview.
- **Hasil audit**: dari 15 route yang sebelumnya luput, **tidak ada satu pun yang
  benar-benar tanpa otorisasi**. Empat route RAB approve/reject/reminder sempat
  terlihat telanjang, tapi verifikasi menunjukkan semuanya menegakkan
  `assertUserCanApproveRab` / `canUserApproveRab` di lapisan service.
- **Files**: `tests/architecture/financial-route-authorization.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Guard invoice memakai permission invoices:* hasil verifikasi produksi

- **Tipe**: [SECURITY]
- **Scope**: `lib/api`
- **Author**: agent
- **Deskripsi**: Peta role→permission diverifikasi langsung ke database produksi
  (`netmanager-production/db-netmanager-0`), bukan disimpulkan dari
  `lib/role-templates.ts`. Hasilnya mengoreksi asumsi sebelumnya: role `admin` di
  produksi memegang set `invoices:*` lengkap (`read`, `update`, `delete`, `create`,
  `mark_paid`, `cancel`, `verify`), padahal template tidak memuatnya sama sekali.
  `INVOICE_READ_PERMISSIONS` dan `INVOICE_WRITE_PERMISSIONS` karena itu kini memakai
  `invoices:read` / `invoices:update` — permission yang memang ada untuk resource ini —
  alih-alih hanya menumpang permission `pelanggan`/`finance`.
  `pelanggan:update` tetap dipertahankan di set tulis karena role Helpdesk hanya
  memegang `pelanggan:read/update/site_only` dan memakai halaman perpanjangan;
  konsekuensinya Helpdesk juga dapat menulis invoice, dicatat eksplisit di kode
  sebagai keputusan yang perlu ditinjau pemilik produk.
- **Verifikasi**: `pelanggan:update` dipegang Helpdesk, admin, Super Admin — tidak ada
  role sah yang terkunci oleh pengetatan di entry sebelumnya.
- **Files**: `lib/api/financial-permissions.ts`,
  `tests/api/financial-permissions.test.ts`
- **Breaking**: ❌ Tidak — daftar permission bersifat OR, jadi penambahan hanya
  memperluas siapa yang lolos

### [2026-09-02] — Koreksi: pembatas site invoice tidak berdampak ke pengguna mana pun

- **Tipe**: [DOCS]
- **Scope**: `docs/`
- **Author**: agent
- **Deskripsi**: Entry pembatas site sebelumnya memperingatkan bahwa pemakai token
  mobile dengan `invoices:site_only` akan mendadak melihat lebih sedikit data setelah
  perbaikan. Query ke database produksi menunjukkan **tidak ada satu pun role** yang
  memegang `invoices:site_only` (0 baris), sehingga perbaikan itu nol dampak
  operasional hari ini. Nilainya tetap sebagai pertahanan berlapis: begitu permission
  tersebut diberikan ke sebuah role, pembatasnya langsung berlaku untuk kedua jalur
  autentikasi, bukan hanya jalur sesi web.
- **Breaking**: ❌ Tidak

### [2026-09-02] — Pembatas site invoice kini berlaku untuk pemanggil Bearer

- **Tipe**: [SECURITY]
- **Scope**: `app/api/invoices`, `lib/api`
- **Author**: agent
- **Deskripsi**: `canOnlyAccessOwnSite` memanggil `hasPermission("invoices:site_only")`
  tanpa argumen user, sehingga jatuh ke `getServerSession`. Untuk pemanggil Bearer
  (token mobile) sesi itu null, fungsi selalu mengembalikan `false`, dan
  `isRestricted` ikut `false` — pembatas cakupan site justru mati bagi pemanggil
  yang paling tidak dipercaya, sementara pengguna web tetap terbatas. Diganti
  `isInvoiceSiteRestricted()` yang membaca `ctx.permissions`, yang diisi
  `createHandler` untuk kedua jalur autentikasi, dan tetap melewatkan super admin.
  Pengecekan alias dipertahankan lewat `hasPermissionWithAlias`.
- **Files**: `lib/api/financial-permissions.ts`, `app/api/invoices/route.ts`,
  `app/api/invoices/[id]/route.ts`
- **Breaking**: ❌ Tidak — hanya mempersempit data yang terlihat sesuai maksud
  permission `invoices:site_only` yang selama ini diabaikan

### [2026-09-02] — Operasi tulis invoice menuntut permission tingkat ubah

- **Tipe**: [SECURITY]
- **Scope**: `lib/api`
- **Author**: agent
- **Deskripsi**: `INVOICE_WRITE_PERMISSIONS` sebelumnya disamakan dengan set baca
  sebagai langkah sementara agar tidak mengunci siapa pun, sehingga siapa pun yang
  boleh MEMBACA pelanggan juga boleh menulis ulang atau menghapus invoice. Ditelusuri
  bahwa satu-satunya konsumen yang benar-benar menulis invoice adalah halaman
  perpanjangan `app/admin/pelanggan/ppp/[id]/renew`, yang sudah digerbangi
  `ensurePermission('pelanggan:update')`. Set tulis karena itu dipersempit ke
  `finance:update`, `pelanggan:update`, `ppp:update`, `transactions:update` — tetap
  meloloskan alur perpanjangan yang sah, tapi menutup principal yang hanya punya
  akses baca.
- **Files**: `lib/api/financial-permissions.ts`
- **Breaking**: ❌ Tidak — gerbang halaman penulis invoice sudah menuntut
  `pelanggan:update` sejak awal

### [2026-09-02] — Tes untuk pembatas site dan pemisahan permission invoice

- **Tipe**: [ADDED]
- **Scope**: `tests/api`
- **Author**: agent
- **Deskripsi**: `tests/api/financial-permissions.test.ts` memaku dua perilaku:
  pembatas site dihitung dari permission context (bukan sesi NextAuth) dengan
  pengecualian super admin, dan set permission tulis tidak boleh memuat satu pun
  permission `:read` sekaligus wajib memuat `pelanggan:update` agar alur perpanjangan
  tidak terkunci. Keduanya diverifikasi merah lebih dulu terhadap perilaku lama.
  `tests/api/invoices-id-route-site-scope.test.ts` disesuaikan ke kontrak
  `createHandler` yang sebenarnya — ctx membawa `permissions`, bukan mock
  `hasPermission` — dengan intent pengujian yang sama.
- **Files**: `tests/api/financial-permissions.test.ts`,
  `tests/api/invoices-id-route-site-scope.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Tutup celah RBAC pada endpoint finansial

- **Tipe**: [SECURITY]
- **Scope**: `app/api/finance`, `app/api/invoices`, `app/api/payments`, `lib/api`
- **Author**: agent
- **Deskripsi**: Audit lanjutan menemukan perbaikan RBAC sebelumnya hanya menutup
  satu endpoint baca, sementara endpoint finansial yang MEMUTASI uang masih polos.
  `createHandler` tidak pernah memeriksa role maupun `accessAdminPanel`, dan repo ini
  tidak punya `middleware.ts` — sehingga `auth: true` saja hanya membuktikan
  "principal terautentikasi". Token mobile karyawan berprivilese rendah (mis. Teknisi,
  yang hanya punya permission `m_*`) lolos ke setiap route ber-`auth: true`.
  Sepuluh route diberi gerbang kapabilitas: `finance/transfer`, `finance/pay-po`,
  `finance/accounts` (GET+POST), `finance/unmatched-mutations` (GET+POST),
  `finance/rab-projects/[id]/revisions/[revisionId]` (GET+PATCH), `invoices` (GET+POST),
  `invoices/[id]` (GET+PUT+DELETE), `invoices/[id]/send`, `payments/[id]`, dan
  `admin/pelanggan/[id]/invoices`. Tanpa ini, teknisi dapat menandai invoice `PAID`
  tanpa payment, menghapus invoice, memindahkan saldo antar akun, dan menerapkan
  mutasi bank ke tagihan siapa pun.
  Permission dipilih dari gerbang halaman yang sudah memakai endpoint tersebut
  (`/admin/finance/**` → `finance:read`, `/admin/pengaturan/payment-gateway` →
  `payment_gateway:read`, `/admin/pelanggan/**` → `pelanggan:read`/`ppp:read`),
  sehingga tidak ada pengguna yang selama ini sah jadi terkunci.
- **Files**: `lib/api/financial-permissions.ts`, sepuluh route di atas
- **Breaking**: ❌ Tidak — nol pemanggil dari app mobile; seluruh konsumen adalah
  frontend web admin berbasis sesi yang sudah memegang permission tersebut

### [2026-09-02] — Tes arsitektur: setiap route finansial wajib berpagar

- **Tipe**: [ADDED]
- **Scope**: `tests/architecture`
- **Author**: agent
- **Deskripsi**: Menambah `financial-route-authorization.test.ts` yang memindai 84
  route finansial di `app/api/**` dan menggagalkan build bila ada yang hanya
  ber-`auth: true`. Tes mengenali tiga bentuk gerbang yang dipakai repo ini
  (`permissions:` option berupa array maupun konstanta, `hasPermission(...)`, dan
  `ctx.permissions.includes(...)`), dan sengaja TIDAK menghitung `site_only` /
  `department_only` sebagai gerbang karena keduanya membatasi cakupan data, bukan
  kapabilitas — persis kekeliruan yang membuat route invoice tampak terlindungi.
  Diverifikasi merah lebih dulu (10 route), dan diuji ulang dengan menghapus satu
  guard untuk memastikan benar-benar menangkap regresi.
- **Files**: `tests/architecture/financial-route-authorization.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Koreksi: threat model RBAC analytics salah disebut pelanggan

- **Tipe**: [DOCS]
- **Scope**: `docs/`
- **Author**: agent
- **Deskripsi**: Entry `[SECURITY]` sebelumnya menyatakan token mobile PELANGGAN bisa
  membaca omzet tenant lewat `/api/billing/analytics`. Itu keliru — token pelanggan
  diblokir dua lapis: `generatePelangganAccessToken` memakai `audience:
  "pelanggan-portal"` yang divalidasi di `getMobileTokenDetails`, dan
  `verifyCustomerToken` menolaknya karena `Pelanggan.tokenVersion` default `1`
  sedangkan token itu tidak memuat klaim `tokenVersion` sama sekali (`?? 0`).
  Penyerang yang sebenarnya adalah karyawan berprivilese rendah dengan token mobile
  yang sah. Perbaikan `finance:read` tetap benar dan perlu; hanya threat model-nya
  yang dikoreksi.
- **Breaking**: ❌ Tidak

### [2026-09-02] — VOID_AND_CREATE_NEW benar-benar membatalkan tagihan lama

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`, `modules/pelanggan`
- **Author**: agent
- **Deskripsi**: Opsi edit pelanggan berlabel "Batalkan & Buat Tagihan Baru"
  (`VOID_AND_CREATE_NEW`) tidak pernah membatalkan apa pun — `handleInvoiceAction`
  hanya memanggil `generateImmediateInvoice`, sehingga tagihan lama tetap hidup dan
  pelanggan berakhir dengan dua tagihan sekaligus. Ditambahkan
  `cancelOutstandingInvoices` + `replaceOutstandingInvoiceForCustomer`: tagihan
  berstatus DRAFT/SENT/OVERDUE dibatalkan lebih dulu beserta durable schedule-nya,
  baru tagihan pengganti diterbitkan. Invoice yang sudah menyerap pembayaran
  (`paidAmount > 0`, termasuk PARTIAL_PAID) sengaja dilewati supaya payment tidak
  jadi yatim. Pembatalan tidak ditelan: bila gagal, tagihan pengganti tidak dibuat.
  `VoidInvoiceService` sengaja tidak dipakai ulang karena semantiknya berbeda —
  service itu untuk void invoice yang SUDAH dibayar dan ikut memundurkan jatuh tempo
  serta mengisolir pelanggan.
- **Files**: `modules/finance/services/outstanding-invoice.helpers.ts`,
  `modules/finance/services/AutomaticBillingService.ts`,
  `modules/pelanggan/services/PelangganAdminMutationService.ts`
- **Breaking**: ❌ Tidak — melengkapi perilaku yang selama ini setengah jalan

### [2026-09-02] — Window penagihan harian pakai rentang tanggal, bukan tanggal-dalam-bulan

- **Tipe**: [FIXED]
- **Scope**: `modules/pelanggan`, `modules/finance`
- **Author**: agent
- **Deskripsi**: Query kelayakan billing memakai `EXTRACT(DAY FROM p."jatuhTempo") =
  targetDay` tanpa batas bulan/tahun. Dua akibatnya:
  (1) pelanggan dengan jatuh tempo di bulan atau tahun lain bertanggal sama ikut
  terjaring dan ditagih untuk periode yang salah — selama ini hanya tertahan oleh
  pengecekan duplikat, bukan oleh query-nya;
  (2) karena cocoknya harus persis, kohort satu hari hilang permanen bila cron tidak
  jalan hari itu — tidak ada catch-up sama sekali.
  Query diganti rentang `jatuhTempo BETWEEN start AND end`, dengan batas atas =
  tanggal target dan batas bawah 7 hari ke belakang (`BILLING_CATCH_UP_DAYS`) supaya
  hari yang terlewat terkejar tanpa memindai seluruh penunggak sepanjang sejarah.
  Selain itu `dueDate` invoice kini mengikuti jatuh tempo pelanggan sendiri, bukan
  tanggal target global — menyamakan jalur harian dengan jalur realtime yang memang
  sudah benar. Dedupe ikut berubah jadi per (pelanggan, siklus jatuh tempo) supaya
  pelanggan menunggak tidak ditagih ulang setiap hari oleh rentang yang lebih lebar.
  Duplikat mati `PelangganFinanceRepository.findEligibleForBilling` — query yang sama
  dengan bug yang sama, nol pemanggil — dihapus, bukan diperbaiki dua kali.
- **Files**: `modules/pelanggan/repositories/pelanggan-repository-automation.helpers.ts`,
  `modules/pelanggan/repositories/PelangganRepository.ts`,
  `modules/pelanggan/repositories/PelangganFinanceRepository.ts`,
  `modules/pelanggan/services/PelangganBillingBridgeService.ts`,
  `modules/finance/services/AutomaticBillingService.ts`,
  `modules/finance/services/automatic-billing.helpers.ts`,
  `modules/finance/repositories/InvoiceRepository.ts`
- **Breaking**: ❌ Tidak — pada kasus normal `targetDate` dan `jatuhTempo` memang
  jatuh di tanggal yang sama, jadi `dueDate` invoice tidak berubah; yang berubah
  hanya kasus yang selama ini memang salah

### [2026-09-02] — Id pembayaran resolusi mutasi tidak lagi dari timestamp

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: `UnmatchedMutationService.resolve` membentuk primary key pembayaran
  dari `PAY-${Date.now()}`. Dua resolusi dalam milidetik yang sama menghasilkan id
  identik dan menabrak primary key. Diganti `randomUUID()`.
- **Files**: `modules/finance/services/UnmatchedMutationService.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Tes regresi untuk empat perbaikan billing lanjutan

- **Tipe**: [ADDED]
- **Scope**: `tests/modules/finance`, `tests/modules/pelanggan`
- **Author**: agent
- **Deskripsi**: 28 tes baru, dikerjakan test-first — setiap tes diverifikasi merah
  lebih dulu terhadap perilaku lama. Mencakup: keunikan id pembayaran saat jam sistem
  dibekukan, batas atas/bawah window penagihan (masa depan ditolak, hari terlewat
  terkejar), `dueDate` mengikuti jatuh tempo pelanggan, kunci dedupe per siklus,
  bentuk query kelayakan (tidak lagi `EXTRACT(DAY`), pembatalan tagihan hidup,
  perlindungan invoice yang sudah menyerap pembayaran, dan urutan cancel-sebelum-create.
- **Files**: `tests/modules/finance/services/UnmatchedMutationService.test.ts`,
  `tests/modules/finance/services/billing-eligibility-window.test.ts`,
  `tests/modules/finance/services/replace-outstanding-invoice.test.ts`,
  `tests/modules/finance/services/replace-invoice-flow.test.ts`,
  `tests/modules/pelanggan/eligible-billing-query.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Review modul billing: RBAC analytics, satuan nominal, dan ketahanan schedule

- **Tipe**: [SECURITY]
- **Scope**: `app/api/billing/analytics`
- **Author**: agent
- **Deskripsi**: `GET /api/billing/analytics` hanya memakai `auth: true` tanpa RBAC,
  sehingga setiap principal terautentikasi — termasuk token mobile pelanggan yang
  hanya bermodal `customer:read` — bisa membaca omzet tenant, komposisi status
  invoice, tren 12 bulan, dan 10 pelanggan teratas beserta nama dan nominal
  bayarnya. Ditambahkan `permissions: ['finance:read']`, selaras dengan endpoint
  analitik finance lain. Tidak ada konsumen frontend/mobile untuk endpoint ini,
  jadi tidak ada pemakaian sah yang terdampak.
- **Files**: `app/api/billing/analytics/route.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Perbaikan satuan nominal analitik billing

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: `BillingAnalyticsService` membagi setiap nominal dengan 100, sisa
  asumsi lama bahwa uang disimpan dalam sen. `HargaPaket.harga` bertipe `Int` rupiah
  penuh dan `BillingInvoiceCreationService` menulis nilai itu apa adanya, sementara
  `ARAgingService`, `RevenueSnapshotService`, dan `InvoicePaymentStateService`
  membacanya tanpa pembagian. Akibatnya seluruh angka analitik (omzet, terbayar,
  outstanding, rata-rata invoice, tren bulanan, top customer) tampil 100× lebih kecil
  dari nilai sebenarnya. Pembagian dihapus dan konvensi satuan didokumentasikan di
  header service. Log aktivitas create-invoice di `InvoiceCollectionRouteService`
  punya bug yang sama dan ikut diperbaiki.
- **Files**: `modules/finance/services/BillingAnalyticsService.ts`,
  `modules/finance/services/InvoiceCollectionRouteService.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Hardening durable billing schedule

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: Tiga masalah konkurensi pada durable billing schedule.
  (1) `BillingScheduleRepository.upsert` menaikkan `version` lewat read-modify-write,
  sehingga dua reschedule bersamaan menghasilkan versi kembar dan job basi lolos dari
  filter versi; diganti `version: { increment: 1 }` yang atomik.
  (2) `enqueuePersistedSchedule` menulis `queueJobId` dan status `QUEUED` setelah job
  masuk BullMQ. Untuk schedule dengan `runAt` lampau (delay 0 — jalur reconciliation),
  worker bisa menyelesaikan job lebih dulu lalu tulisan `QUEUED` menimpa status
  `COMPLETED`, membuat reconciliation menjadwalkan ulang job yang sudah jalan
  (mis. auto-isolir dobel). Urutan dibalik: status dan job id ditulis lebih dulu dalam
  satu update, baru enqueue.
  (3) Guard versi `if (options?.version && ...)` melewatkan versi 0; diganti pengecekan
  `!== undefined`.
- **Files**: `modules/finance/repositories/BillingScheduleRepository.ts`,
  `modules/finance/services/BillingScheduleService.ts`,
  `modules/finance/domain/ports/IBillingScheduleRepository.ts`
- **Breaking**: ❌ Tidak — `IBillingScheduleRepository` berubah (`attachQueueJobId`
  dihapus, `markQueued` bertambah parameter `queueJobId`, `findForRehydration` tidak
  lagi menerima argumen), tapi port ini internal modul finance dan hanya punya satu
  implementasi di repo

### [2026-09-02] — Guard setting billing/reminder dan batas rentang tanggal

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: `parseBillingWindowDays` dan parsing `GENERAL_REMINDER_OTOMATIS`
  memakai `parseInt` tanpa guard. Setting yang rusak menghasilkan `NaN`, lalu
  `setDate(NaN)` menghasilkan Invalid Date — generate invoice harian dan reminder
  berhenti total tanpa satu pun error di log. Keduanya kini divalidasi dan jatuh ke
  default bila di luar rentang wajar, dan fallback-nya kini menulis `logger.warn` supaya
  setting yang salah tidak ikut senyap seperti bug aslinya. Batas akhir rentang satu hari juga dinaikkan
  dari `23:59:59.000` ke `23:59:59.999` supaya invoice pada sub-detik terakhir tidak
  lolos dari pengecekan duplikat. Ditambahkan pula validasi rentang tanggal kustom di
  analitik agar tanggal tidak valid tidak dikirim ke database.
- **Files**: `modules/finance/services/automatic-billing.helpers.ts`,
  `modules/finance/services/BillingReminderService.ts`,
  `modules/finance/services/BillingAnalyticsService.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Tren bulanan analitik billing jadi satu query

- **Tipe**: [CHANGED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: `getMonthlyTrend` menjalankan 12 query berurutan (satu per bulan) dan
  setiap query menarik baris invoice utuh padahal hanya `totalAmount` yang dipakai.
  Diganti satu query rentang 12 bulan dengan `select` sempit, lalu di-bucket per bulan
  di memori. Perhitungan tren juga dipindah ke `Promise.all` bersama query lain.
  Perbaikan ini sekaligus menutup off-by-one: rentang lama memakai `lt` pada tanggal
  terakhir bulan, sehingga invoice pada HARI TERAKHIR setiap bulan tidak pernah masuk
  hitungan tren. Angka tren bulanan karena itu ikut berubah, bukan hanya jadi lebih cepat.
  `TopCustomerPayment.invoiceCount` juga di-rename jadi `paymentCount` karena nilainya
  memang jumlah transaksi pembayaran, bukan jumlah invoice.
  Repository analitik kini bergantung pada port `IBillingAnalyticsRepository` sesuai
  aturan dependency inversion modul baru.
- **Files**: `modules/finance/services/BillingAnalyticsService.ts`,
  `modules/finance/repositories/BillingAnalyticsRepository.ts`,
  `modules/finance/domain/ports/IBillingAnalyticsRepository.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Kegagalan invoice instan tidak lagi ditelan diam-diam

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: `AutomaticBillingService.generateImmediateInvoice` menangkap semua
  error lalu hanya nge-log, sehingga pelanggan bisa berakhir tanpa tagihan tanpa satu
  pun sinyal ke operator. Service kini melempar ulang setelah nge-log — keputusan
  kebijakan diserahkan ke pemanggil, bukan diputus di service.
  Kedua pemanggil ditangani eksplisit: `triggerCustomerBilling` (registrasi) sudah
  punya try/catch sendiri sehingga tetap non-fatal; `handleInvoiceAction` (update admin)
  kini menangkap, nge-log, dan melaporkan lewat flag `invoiceActionFailed` di response.
  Alasannya: update pelanggan sudah commit dan event sync sudah dipublish sebelum aksi
  invoice dijalankan, jadi melemparkan error keluar akan memetakannya ke HTTP 400
  `VALIDATION_ERROR` lewat `mapMutationError` — admin membaca gangguan billing sementara
  sebagai "input tidak valid", lalu submit ulang dan memicu update serta event sync kedua.
- **Files**: `modules/finance/services/AutomaticBillingService.ts`,
  `modules/pelanggan/services/PelangganAdminMutationService.ts`
- **Breaking**: ❌ Tidak — response sukses tetap sukses, hanya bertambah flag opsional
  `invoiceActionFailed`

### [2026-09-02] — Compare-and-set pada transisi status billing schedule

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: `markQueued` sebelumnya `update` tanpa syarat, sehingga menulis QUEUED
  ke baris apa pun. Reconciliation membaca baris pada T lalu menulis pada T+delta; bila
  worker menyelesaikan job di sela itu, status `COMPLETED` tertimpa kembali jadi `QUEUED`
  dan guard di `executeScheduledJob` tidak lagi menahannya — `CUSTOMER_AUTO_ISOLIR`
  bisa jalan dua kali dan memutus pelanggan yang sudah membayar. `markQueued` diubah
  jadi compare-and-set (`updateMany` dengan `status notIn [COMPLETED, CANCELLED]`) yang
  mengembalikan boolean; `enqueuePersistedSchedule` melewati enqueue saat klaim gagal.
  Ini melengkapi perbaikan urutan enqueue di entry sebelumnya — urutan saja hanya
  mempersempit balapan, tidak menutupnya.
- **Files**: `modules/finance/repositories/BillingScheduleRepository.ts`,
  `modules/finance/services/BillingScheduleService.ts`,
  `modules/finance/domain/ports/IBillingScheduleRepository.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Tes regresi untuk perbaikan billing

- **Tipe**: [ADDED]
- **Scope**: `tests/modules/finance`
- **Author**: agent
- **Deskripsi**: Perbaikan billing sebelumnya tidak punya satu pun tes yang memaku
  perilaku barunya. Ditambahkan 28 tes yang masing-masing sudah diverifikasi gagal
  terhadap kode lama: satuan rupiah pada analitik, bucket tren bulanan termasuk hari
  pertama dan terakhir bulan, validasi rentang tanggal kustom, guard NaN pada parser
  setting, batas milidetik rentang harian, urutan klaim QUEUED sebelum enqueue,
  penolakan enqueue untuk schedule COMPLETED/CANCELLED, dan guard versi 0.
- **Files**: `tests/modules/finance/services/BillingAnalyticsService.test.ts`,
  `tests/modules/finance/services/BillingScheduleService.test.ts`,
  `tests/modules/finance/services/billing-settings-parsers.test.ts`
- **Breaking**: ❌ Tidak

### [2026-09-02] — Bersihkan dead code dan type erasure modul billing

- **Tipe**: [REMOVED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: `BillingRepository` punya 18 method tapi hanya 2 yang dipakai
  (`findInvoiceById`, `createPayment` oleh `UnmatchedMutationService`); 16 sisanya
  duplikat `InvoiceRepository`/`PaymentRepository` dan tidak pernah dipanggil,
  termasuk `createInvoiceWithItems` yang identik dengan `createInvoice` dan
  `transaction()` ber-`as any`. Repository dipersempit ke scope unmatched mutation.
  Selain itu `AutomaticBillingService` membuang tipe hasil query lewat
  `as unknown as Array<Record<string, unknown>>` lalu `as never`, padahal bridge
  pelanggan sudah mengembalikan tipe konkret; cast dihapus dan diganti
  `EligibleBillingRow`. Loop batch harian juga berhenti saat batch tidak penuh,
  bukan menunggu satu query kosong.
- **Files**: `modules/finance/repositories/BillingRepository.ts`,
  `modules/finance/services/AutomaticBillingService.ts`,
  `modules/finance/services/automatic-billing.helpers.ts`
- **Breaking**: ❌ Tidak

### [2026-08-29] — Sinkronisasi antrean offline mobile & status duplikat check-in

- **Tipe**: [FIXED]
- **Scope**: `modules/attendance`, `app/api/attendance/check-in`, `mobile-netmanager`
- **Author**: agent
- **Deskripsi**: Dua celah yang menyebabkan absensi offline terlambat masuk — pemicu asli
  duplikat attendance.
  (1) Di mobile, `SyncService.processQueue()` hanya dipicu transisi state jaringan; tidak
  ada drain saat app start maupun saat app kembali foreground. Bila jaringan sudah stabil
  ketika app dibuka, atau pulih saat app di background, antrean absensi diam sampai
  kebetulan ada perubahan jaringan berikutnya — jeda 30 menit sampai 5 jam pada data
  produksi. Ditambahkan drain saat `startMonitoring` dan listener `AppState` 'active',
  keduanya lewat debounce bersama.
  (2) Backend memetakan `DUPLICATE_ENTRY` ke HTTP 400, sedangkan antrean mobile hanya
  merekonsiliasi 409/422 dan membuang item ber-status 400 sebagai permanent failure —
  absensi hilang diam-diam dengan notifikasi "Gagal Sync Absensi". Status diubah ke 409,
  selaras dengan `ALREADY_CHECKED_IN` di `lib/api-response.ts` yang sudah memakai 409.
- **Files**: `modules/attendance/services/MobileAttendanceCheckInRouteService.ts`,
  `app/api/attendance/check-in/route.ts`, `mobile-netmanager/src/services/SyncService.ts`
- **Breaking**: ❌ Tidak — client memperlakukan 4xx sebagai gagal; 409 justru mengaktifkan
  jalur rekonsiliasi yang sudah ada di mobile.

### [2026-08-29] — Perbaiki attendance duplikat pada hari yang sama

- **Tipe**: [FIXED]
- **Scope**: `modules/attendance`, `prisma/migrations`
- **Author**: agent
- **Deskripsi**: Baris Attendance bisa terduplikasi pada hari yang sama (12 kejadian di
  produksi). Akar masalah: seluruh jalur pembuatan attendance buatan sistem (auto ABSENT,
  DAY_OFF, sinkronisasi cuti, backdate admin) tidak mengisi `checkInDate`, sehingga unique
  index `idx_attendance_user_checkin_date_tenant` tidak pernah aktif untuk baris tersebut —
  Postgres memperlakukan NULL sebagai nilai yang selalu distinct. Pemicunya check-in offline
  yang tersinkron beberapa jam setelah cron auto-ABSENT berjalan.
  Perbaikan: (1) `createWithId` di repository kini mewajibkan `checkInDate` sehingga
  compiler menahan jalur yang lupa mengisinya, dan keenam titik pembuatan diperbaiki;
  (2) check-in memakai `createReplacingSystemGenerated` yang secara atomik melepas
  placeholder harian buatan sistem (ABSENT/ALPHA/DAY_OFF — cuti PERMIT/SICK tidak disentuh)
  sebelum menulis baris kehadiran, sehingga kehadiran nyata menggantikan tebakan sistem
  tanpa menghapus jejak audit; (3) migration mengisi 1.222 baris `checkInDate` NULL dan
  melepas 12 baris duplikat yang sudah terlanjur ada.
- **Files**: `modules/attendance/repositories/AttendanceCrudRepository.ts`,
  `modules/attendance/services/AttendanceMutationService.ts`,
  `modules/attendance/services/AbsenceService.ts`,
  `modules/attendance/services/AttendanceFixedAutoAlphaService.ts`,
  `modules/attendance/services/AbsenceDayOffSyncService.ts`,
  `modules/attendance/services/LeaveAttendanceSyncService.ts`,
  `modules/attendance/services/AdminAttendanceBackdateRouteService.ts`
- **Migration**: `20260829000000_backfill_attendance_checkin_date_and_supersede_duplicates`
- **Breaking**: ❌ Tidak

### [2026-08-29] — Pulihkan implementasi mock $transaction di test setup

- **Tipe**: [FIXED]
- **Scope**: `tests/`
- **Author**: agent
- **Deskripsi**: `mockReset` global menghapus implementasi `$transaction` pada prismaMock,
  sehingga setiap kode yang berjalan di dalam transaksi tidak pernah dieksekusi dan
  mengembalikan `undefined` secara diam-diam. Test yang melewati jalur transaksional
  karenanya lulus tanpa benar-benar menguji isinya. Implementasi kini dipasang ulang di
  `beforeEach`, dan mock yang kurang pada jalur evaluasi attendance dilengkapi.
- **Files**: `tests/setup.ts`, `tests/modules/attendance/AutoCheckoutService.test.ts`,
  `tests/modules/attendance/AttendanceService.checkout-warning.test.ts`
- **Breaking**: ❌ Tidak

### [2026-08-28] — Perbaiki race status sesi Baileys & test flaky di CI

- **Tipe**: [FIXED]
- **Scope**: `modules/notification/services/whatsapp`, `tests/modules/notification`
- **Author**: agent
- **Deskripsi**: Build Jenkins gagal di `baileys-session-manager.test.ts` (2 test) meski hijau di lokal.
  Akar masalah: test menunggu inisialisasi sesi async dengan `setTimeout` tetap 50 ms — di agent CI
  yang terbebani, handler `connection.update` belum terdaftar sehingga handler sesi lama bocor ke
  test berikutnya. Diperparah mock `@/lib/redis` yang tidak menyediakan `brpop`/`lpush`/`expire`,
  membuat cmd loop error-spam tiap detik dan tidak pernah berhenti antar test.
  Perbaikan test: tunggu handler dengan `vi.waitFor` (bukan durasi tetap), lengkapi mock redis
  sesuai kontrak cmd loop, dan hentikan sesi di `afterEach` supaya loop tidak bocor.
  Perbaikan produksi: encode QR berjalan async dan bisa selesai setelah koneksi terbuka —
  hasilnya status sesi mundur dari `connected` ke `qr`/`error`. Sekarang callback QR tidak
  menimpa sesi yang sudah `connected`.
- **Files**: `modules/notification/services/whatsapp/baileys-session-manager.ts`,
  `tests/modules/notification/baileys-session-manager.test.ts`
- **Breaking**: ❌ Tidak

### [2026-08-28] — Anulir barang yang tidak jadi dibelikan saat verifikasi restock

- **Tipe**: [ADDED]
- **Scope**: `modules/inventory`, `modules/procurement`, `app/api/inventory/restock/requests/[id]/receive`, `app/admin/inventory/restock`
- **Author**: agent
- **Deskripsi**: Saat verifikasi kedatangan, sisa pesanan barang yang tidak jadi dibelikan
  sekarang bisa dianulir (short close) beserta alasannya — preset ("Tidak dibelikan",
  "Stok supplier kosong", "Harga tidak sesuai", "Dibatalkan pemesan") atau alasan bebas.
  Alasan disimpan di item PO (`cancelReason`, `cancelledAt`) dan sisa yang ditutup dicatat
  di `cancelledQuantity`; quantity asli PO tidak diubah supaya riwayat pesanan tetap utuh.
  Anulir dijalankan setelah GRN dibuat, dan barang yang dianulir tidak ikut digenapkan
  saat "Tutup Pesanan" dicentang sehingga stok tidak menggelembung. `recomputePoStatus`
  di GRN repository kini menghitung pesanan efektif (`quantity - cancelledQuantity`),
  dan alur restock menutup PO/PR otomatis ketika tidak ada lagi sisa yang menggantung.
  Alasan anulir tampil di modal verifikasi dan modal detail pengajuan. Setiap anulir
  dicatat ke activity log (`CANCEL RestockItem`).
- **Files**:
  - `prisma/schema.prisma` — `PurchaseOrderItem.cancelledQuantity`, `cancelReason`, `cancelledAt`
  - `modules/inventory/services/RestockItemCancellationService.ts` (baru) — aturan anulir
  - `modules/inventory/services/RestockGoodsReceiptService.ts` — integrasi anulir + status settle
  - `modules/inventory/domain/ports/IRestockGoodsReceiptRepository.ts`,
    `modules/inventory/repositories/RestockGoodsReceiptRepository.ts`,
    `modules/inventory/repositories/InventoryPurchaseRequestRepository.ts`
  - `modules/procurement/repositories/GoodsReceiptRepository.ts` — status PO memperhitungkan anulir
  - `app/admin/inventory/restock/RestockCancelReasonField.tsx` (baru),
    `RestockReceiveItemRow.tsx`, `RestockReceiveModal.tsx`, `RestockDetailModal.tsx`,
    `useRestockPage.ts`, `RestockList.tsx`, `utils.ts`, `types.ts`
  - `tests/services/RestockItemCancellationService.test.ts` (baru),
    `tests/api/inventory-restock-request-lifecycle-routes.test.ts`,
    `tests/ui/restock-receive-modal.test.tsx`
- **Migration**: `20260828080751_add_cancelled_quantity_to_purchase_order_items`
- **Breaking**: ❌ Tidak

### [2026-08-28] — Substitusi barang saat verifikasi kedatangan restock

- **Tipe**: [ADDED]
- **Scope**: `modules/inventory`, `app/api/inventory/restock/requests/[id]/receive`, `app/admin/inventory/restock`
- **Author**: agent
- **Deskripsi**: Verifikator sekarang bisa mengganti barang saat modal "Verifikasi Barang Sampai",
  karena barang yang datang bisa berbeda dari yang dipesan (supplier mengirim merek/tipe lain).
  Substitusi memperbarui `PurchaseOrderItem` dan `PurchaseRequestItem` terkait sebelum GRN dibuat,
  sehingga stok, dokumen GRN, dan jurnal `AUTO_GRN_CREATED` mencatat barang yang benar-benar diterima.
  Aturan: item yang sudah pernah diterima sebagian tidak bisa diganti, barang pengganti wajib milik
  tenant yang sama dan belum dipakai item lain di PO tersebut; harga per unit tetap mengikuti PO
  (koreksi harga tetap lewat edit Purchase Order). Setiap substitusi dicatat ke activity log.
  Sekalian memindahkan business logic + query Prisma dari route `receive` ke service/repository
  sesuai Clean Architecture (route jadi thin controller).
- **Files**:
  - `modules/inventory/domain/ports/IRestockGoodsReceiptRepository.ts` (baru) — port akses data
  - `modules/inventory/repositories/RestockGoodsReceiptRepository.ts` (baru) — implementasi port
  - `modules/inventory/factories/RestockGoodsReceiptFactory.ts` (baru) — perakitan dependency
  - `modules/inventory/services/RestockItemSubstitutionService.ts` (baru) — aturan substitusi barang
  - `modules/inventory/services/RestockGoodsReceiptService.ts` (baru) — orkestrasi penerimaan + GRN
  - `app/api/inventory/restock/requests/[id]/receive/route.ts` — thin controller + payload `substitutions`
  - `app/admin/inventory/restock/RestockReceiveItemRow.tsx` (baru), `RestockReceiveModal.tsx`,
    `useRestockPage.ts`, `RestockList.tsx`, `utils.ts`, `types.ts`
  - `tests/services/RestockItemSubstitutionService.test.ts` (baru),
    `tests/api/inventory-restock-request-lifecycle-routes.test.ts`, `tests/ui/restock-receive-modal.test.tsx`
- **Breaking**: ❌ Tidak

### [2026-08-09] — Planning OSP UI implementation + permission alignment

- **Tipe**: [ADDED]
- **Scope**: `app/admin/planning`, `modules/planning/utils`, `lib/menu-config`, `lib/feature-modules`, `lib/permissions`
- **Author**: agent
- **Deskripsi**: Implementasi lengkap UI Planning OSP menggantikan 6 halaman stub. Semua halaman menggunakan pattern existing project: server component wrapper (`ensurePermission` + `force-dynamic`) → client component dengan `useApi` (TanStack Query), `react-hot-toast`, dan component library existing (`Button`, `Card`, `ResponsiveTable`, `StatCard`, `MapPicker`, `EmptyState`, `LoadingSkeleton`). Dashboard menampilkan stat cards, doughnut chart (status distribution via chart.js), bar chart (budget comparison), timeline stats, dan recent planning list. List page menggunakan `ResponsiveTable` dengan debounced search, status filter, dan pagination. Form create/edit terintegrasi dengan `MapPicker` (OpenLayers) dan budget threshold hint (≥500jt → approval 2 level). Detail page memiliki 4 tabs (Overview, Items, Milestones, Documents) dengan approve/reject dialog dan delete action. Kanban board menggunakan native HTML5 Drag & Drop (no @dnd-kit dependency). Template management dengan create modal (dynamic material items) dan apply template flow. Shared utils (`statusConfig.ts`) menyediakan status color maps, `formatBudget`, `formatDateShort` untuk konsistensi visual. Permission strings di-fix dari dot format (`planning.read`) ke colon format (`planning:read`) untuk match dengan RBAC seed pattern. `planning` ditambahkan ke `PERMISSION_GROUPS`, `FEATURE_MODULES`, dan `MENU_CONFIG` sidebar.
- **Files**:
  - `app/admin/planning/page.tsx` + `PlanningDashboardClient.tsx` — Dashboard
  - `app/admin/planning/daftar/page.tsx` + `PlanningListClient.tsx` — List
  - `app/admin/planning/baru/page.tsx` + `PlanningFormClient.tsx` — Create form
  - `app/admin/planning/[id]/page.tsx` + `PlanningDetailClient.tsx` — Detail with tabs
  - `app/admin/planning/[id]/edit/` — Edit form
  - `app/admin/planning/kanban/page.tsx` + `PlanningKanbanClient.tsx` — Kanban
  - `app/admin/planning/templates/page.tsx` + `PlanningTemplatesClient.tsx` — Templates
  - `modules/planning/utils/statusConfig.ts` — Shared status/budget/date utils
  - `lib/permissions.ts`, `lib/permission-config.ts`, `lib/feature-modules.ts`, `lib/menu-config.ts` — RBAC + menu registration
- **Breaking**: ❌ Tidak

### [2026-08-09] — Planning OSP module implementation complete

- **Tipe**: [ADDED]
- **Scope**: `modules/planning`, `app/api/admin/planning`, `app/admin/planning`, `tests/e2e`
- **Author**: agent
- **Deskripsi**: Implementasi lengkap Planning OSP (Outside Plant) module untuk network expansion planning. Backend fully functional dengan 7 tabel database, 7 domain entities, 7 repositories, 6 services, dan 16 API endpoints. Total 51 unit tests passing dengan coverage tinggi. Frontend menggunakan stub approach untuk preserve context - 6 pages created dengan clear TODOs untuk future implementation. Module siap untuk frontend development di session terpisah.
- **Backend Components**:
  - Database: `Planning`, `PlanningTask`, `PlanningMaterial`, `PlanningAttachment`, `PlanningTemplate`, `PlanningApproval`, `PlanningAuditLog`
  - Domain: Entities dengan business rules (status transitions, validation)
  - Repositories: Data access layer dengan Prisma
  - Services: `PlanningService`, `PlanningTemplateService`, `PlanningApprovalService`, `PlanningAuditService`, `PlanningDashboardService`, `PlanningKanbanService`, `PlanningExportService` (stub)
  - API: CRUD endpoints, approval workflow, template management, dashboard stats, kanban view
- **Frontend Components (Stubs)**:
  - `/admin/planning` - Dashboard
  - `/admin/planning/daftar` - List view
  - `/admin/planning/baru` - Create form
  - `/admin/planning/[id]` - Detail view
  - `/admin/planning/kanban` - Kanban board
  - `/admin/planning/templates` - Template management
- **Testing**:
  - 51 unit tests passing (services, repositories, domain logic)
  - E2E test structure created (`tests/e2e/planning.spec.ts`) dengan 10 test scenarios
  - Integration test foundation ready
- **Migration**: `20260809033447_add_planning_osp_tables`
- **Breaking**: ❌ Tidak

### [2026-08-09] — Dokumentasi critical business flows end-to-end

- **Tipe**: [DOCS]
- **Scope**: `docs/project-memory`
- **Author**: agent
- **Deskripsi**: Trace dan dokumentasi lengkap 7 critical business flows dari source code: (1) Customer Registration & Activation, (2) Payment Processing (Webhook), (3) Auto-Isolir (Overdue Billing), (4) Work Order Lifecycle, (5) Invoice Generation (Recurring), (6) Network Provisioning, (7) Attendance Check-in. Setiap flow mencakup entry point, authentication, validation, step-by-step execution (15-20 steps), database operations, external API calls, events emitted, side effects, failure scenarios, performance characteristics, dan testing guidelines. Total 2,512 lines dokumentasi dengan cross-flow dependencies dan common patterns identification.
- **Files**: `docs/project-memory/12-critical-flows.md`
- **Breaking**: ❌ Tidak

### [2026-08-08] — Fix payment gateway environment configuration

- **Tipe**: [FIXED]
- **Scope**: `modules/payment-gateway`, `lib/utils/env`, `k8s/production`
- **Author**: agent
- **Deskripsi**: Fixed critical production bug dimana `NEXT_PUBLIC_APP_URL` tidak terset di Kubernetes ConfigMap, menyebabkan payment gateway callback URLs menjadi `undefined/api/webhooks/*`. Added centralized environment validation helper untuk prevent future issues. All payment providers (Moota, Tripay, Xendit, Duitku, Midtrans, QRIS) now use validated env helper. Server startup validation ensures critical env vars present sebelum accept requests.
- **Files**:
  - `k8s/production/configmap.yaml` - Added NEXT_PUBLIC_APP_URL
  - `lib/utils/env.ts` - New environment validation helper
  - `modules/payment-gateway/services/providers/*` - Migrated to validated env helper
  - `server.ts` - Added startup environment validation
- **Breaking**: ❌ Tidak
- **Deployment**: Requires kubectl apply ConfigMap + rolling restart pods (zero downtime)

### [2026-08-08] — Hapus program trial dari landing page marketing

- **Tipe**: [CHANGED]
- **Scope**: `components/landing/`, `app/page.tsx`
- **Author**: agent
- **Deskripsi**: Menghapus semua mention program "trial 14 hari" dan "coba gratis" dari landing page karena tidak ada program trial yang aktif. Perubahan CTA button dari "Coba gratis", "Mulai gratis 14 hari", "Coba 14 hari gratis" menjadi "Mulai sekarang" dan "Pilih paket Pro". Update hero section title dari "Mulai gratis, scale kapan saja" ke "Pilih paket yang sesuai". Update deskripsi meta dari "Mulai gratis." menjadi netral tanpa mention gratis/trial. Pricing tier "Gratis" untuk Starter package tetap dipertahankan karena itu pricing actual, bukan program trial.
- **Files**: `components/landing/landing-content.ts`, `components/landing/SaasLandingPage.tsx`, `app/page.tsx`
- **Breaking**: ❌ Tidak

### [2026-08-06] — Refactor LoginForm untuk improve code quality

- **Tipe**: [CHANGED]
- **Scope**: `components/auth/`
- **Author**: agent
- **Deskripsi**: Refactor LoginForm.tsx untuk menghilangkan code smell: (1) Extract magic strings ke constants file (PORTAL_PATHS, AUTH_ERROR_CODES, ERROR_MESSAGES, VALIDATION), (2) Extract complex logic ke utility functions (error checking, redirect logic), (3) Simplify onSubmit function dari 107 baris ke 25 baris dengan extract handleLoginError dan handleSuccessfulLogin, (4) Improve readability dan maintainability tanpa mengubah behavior. Semua logic tetap sama, hanya direorganisasi mengikuti clean code principles.
- **Files**: `components/auth/LoginForm.tsx` (refactored), `components/auth/LoginForm.constants.ts` (new), `components/auth/LoginForm.utils.ts` (new)
- **Breaking**: ❌ Tidak

### [2026-08-06] — Implement rate limiting dan security logging untuk auth endpoints

- **Tipe**: [ADDED]
- **Scope**: `lib/rate-limit.ts`, `lib/security-logger.ts`, `app/api/*/auth/login/`
- **Author**: agent
- **Deskripsi**: Tambahkan rate limiting menggunakan LRU Cache (in-memory, 60s TTL) untuk semua login endpoints (customer, mobile, investor). Limit: 5 percobaan per menit per IP. Tambahkan security logging dengan structured JSON ke Kubernetes console untuk monitoring. Track failed login attempts di Redis (TTL 15 menit) dengan auto-block IP setelah 5 kegagalan (block 1 jam). Reset counter saat login berhasil. Security events include: failed_login, rate_limit_exceeded, ip_blocked dengan severity level (low/medium/high/critical).
- **Files**: `lib/rate-limit.ts` (new), `lib/security-logger.ts` (new), `app/api/customer/auth/login/route.ts`, `app/api/mobile/auth/login/route.ts`, `app/api/investor/auth/login/route.ts`, `lib/api-response.ts` (added RATE_LIMIT_EXCEEDED error code)
- **Breaking**: ❌ Tidak

### [2026-08-06] — Fix test timeout di Jenkins CI pipeline

- **Tipe**: [FIXED]
- **Scope**: `tests/api/admin-attendance-bulk-delete-route.test.ts`
- **Author**: agent
- **Deskripsi**: Perbaiki test "returns 400 for malformed JSON before touching persistence" yang timeout di Jenkins build #99. Root cause: syntax timeout berubah dari Vitest 3 ke Vitest 4. Format lama `it(name, fn, { timeout })` deprecated dan menyebabkan timeout tidak terapply. Diupdate ke format baru `it(name, { timeout }, fn)` sesuai Vitest 4 signature. Test sekarang lulus dengan timeout 30s yang cukup untuk environment Jenkins yang lebih lambat dari lokal.
- **Files**: `tests/api/admin-attendance-bulk-delete-route.test.ts`
- **Breaking**: ❌ Tidak

### [2026-08-06] — Implementasi rate limiting dan security logging untuk authentication

- **Tipe**: [SECURITY]
- **Scope**: `lib/`, `app/api/*/auth/login`
- **Author**: agent
- **Deskripsi**: Implementasi rate limiting dan security logging untuk semua authentication endpoints sebagai respons terhadap analisis security threats. Rate limiting menggunakan LRU cache in-memory (60s TTL) dengan limit 5 percobaan login per menit per IP. Security logging menggunakan structured JSON ke console (Kubernetes-native) dan Redis untuk tracking temporary state (failed login counter 15 menit TTL, IP blocking 1 jam TTL). Auto-block IP setelah 5 kali failed login. Zero impact untuk user normal — ini pure additive, tidak mengubah behavior existing login flow.
- **Files**: `lib/rate-limit.ts` (NEW), `lib/security-logger.ts` (NEW), `app/api/customer/auth/login/route.ts`, `app/api/mobile/auth/login/route.ts`, `app/api/investor/auth/login/route.ts`, `lib/api-response.ts`
- **Breaking**: ❌ Tidak
- **Breaking**: ❌ Tidak

### [2026-08-02] — Tambah IP logging untuk announcement creation

- **Tipe**: [ADDED]
- **Scope**: `modules/notification`, `app/api/announcements`, `lib/`
- **Author**: agent
- **Deskripsi**: Implementasi IP logging untuk mencatat alamat IP client sebenarnya (dari header X-Forwarded-For) dan User-Agent saat announcement dibuat. Sebelumnya, activity log hanya mencatat IP internal Kubernetes (10.42.0.1). Helper function `getClientIp()` dan `getUserAgent()` ditambahkan di `lib/request-helpers.ts`. Service layer `AnnouncementService` diupdate untuk menerima metadata (ipAddress, userAgent) dan meneruskan ke logger. Berguna untuk audit trail dan investigasi security incident.
- **Files**: `lib/request-helpers.ts` (new), `app/api/announcements/route.ts`, `modules/notification/services/AnnouncementService.ts`, `modules/notification/services/AnnouncementService.helpers.ts`
- **Breaking**: ❌ Tidak

### [2026-07-25] — Percepat stage Run Unit Tests CI (paralelisme)

- **Tipe**: [INFRA]
- **Scope**: `Jenkinsfile`
- **Author**: agent
- **Deskripsi**: Stage "Run Unit Tests" makan ~19min. Analisis Vitest: `import` mendominasi (1773s cumulative vs 252s tests), dijalankan hanya `--maxWorkers=2` (container node dibatasi cpu 2). Naikkan container node `cpu` limit 2→8 (request 1→3), `memory` limit 6Gi→10Gi (margin 8 fork + peak tsc), dan `--maxWorkers` 2→8 agar 607 file test diparalelkan. Terverifikasi di CI: build #262 (2 worker) 1156s vs #263 (6 worker) 410s; naik ke 8 worker menargetkan ~5min. Opsi `isolate: false` (yang bisa ~3min) sengaja TIDAK dipakai: divalidasi lokal + 3 eksperimen config sentral (clearMocks/restoreMocks) tetap menyisakan ~155 file gagal karena test tidak independen (state module-level/spy bocor antar file) — butuh refactor test-hygiene per-file terpisah. Validasi: `npx vitest run --maxWorkers=8` → 607 file / 3506 test lolos.
- **Files**: `Jenkinsfile`
- **Breaking**: ❌ Tidak

### [2026-07-25] — Ganti tipe FormEvent deprecated ke SubmitEvent (repo-wide)

- **Tipe**: [CHANGED]
- **Scope**: `app/`, `components/`
- **Author**: agent
- **Deskripsi**: `@types/react` 19 menandai `FormEvent` sebagai deprecated ("FormEvent doesn't actually exist"). Sweep 76 file yang memakai `FormEvent`/`React.FormEvent` pada handler submit form (`handleSubmit`, `handleSave`, `handleCreate`, prop `onSubmit`) ke `SubmitEvent` — tipe presisi yang diharapkan `onSubmit` React 19 (`SubmitEventHandler`). Perubahan type-only, tidak mengubah runtime. Verifikasi: `tsc --noEmit` 0 error.
- **Files**: 76 file di `app/**` dan `components/**` (form client & modal)
- **Breaking**: ❌ Tidak

### [2026-07-25] — Konsolidasi definisi general settings ke satu tabel

- **Tipe**: [CHANGED]
- **Scope**: `modules/settings/services/generalSettings.ts`, `app/admin/pengaturan/umum`
- **Author**: agent
- **Deskripsi**: Daftar key general settings sebelumnya diduplikasi di dua tempat — `GENERAL_SETTINGS_KEYS` (jalur read) dan 20 literal `buildGeneralSettingsUpserts` (jalur write) — sehingga rawan drift read/write (akar bug tenant-scope sebelumnya). Dikonsolidasi ke satu tabel `GENERAL_SETTINGS_DEFINITIONS` sebagai single source of truth; key read diturunkan via `.map()`, dan `buildGeneralSettingsUpserts` menurunkan upsert dari tabel yang sama sehingga `tenantId` dijamin ter-stamp pada setiap entry (dari 130 baris repetitif → ~10 baris). Sekaligus samakan default `namaAplikasi` di client ("" → "NetManager") agar konsisten dengan server, dan ganti tipe `FormEvent` yang deprecated (@types/react 19) → `SubmitEvent` pada `handleSubmit`.
- **Files**: `modules/settings/services/generalSettings.ts`, `app/admin/pengaturan/umum/useGeneralSettings.ts`
- **Breaking**: ❌ Tidak

### [2026-07-25] — Naikkan memory headroom Redis cegah OOMKilled

- **Tipe**: [INFRA]
- **Scope**: `k8s/production/redis-deployment.yaml`
- **Author**: agent
- **Deskripsi**: Pod `netmanager-redis` OOMKilled 7x di produksi. Penyebab: `--maxmemory 192mb` dengan `limits.memory: 256Mi` hanya menyisakan ~64Mi headroom, padahal `appendonly yes` memicu fork saat `BGREWRITEAOF` yang melonjakkan RSS via copy-on-write hingga menembus limit → kernel membunuh pod. Eviction policy tetap `noeviction` karena Redis menyimpan job BullMQ, session, dan lock (bukan cache murni). Fix: `requests.memory` 192Mi→256Mi, `limits.memory` 256Mi→512Mi (>= 2x maxmemory).
- **Files**: `k8s/production/redis-deployment.yaml`
- **Breaking**: ❌ Tidak

### [2026-07-24] — Fix general settings save/load tenant scope

- **Tipe**: [FIXED]
- **Scope**: `modules/settings/services/generalSettings.ts`
- **Author**: agent
- **Deskripsi**: GET/POST pengaturan umum sebelumnya mismatch tenant: write lewat Prisma extension mengisi `tenantId` user, read memakai `tenantId = null`, sehingga form selalu menampilkan default kosong setelah simpan. Sekarang read/write memakai tenant aktif dari context (pola sama logo settings).
- **Files**: `modules/settings/services/generalSettings.ts`, `tests/modules/settings/generalSettings.tenant-scope.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-24] — Split baileys-session-manager di bawah 800 LOC

- **Tipe**: [FIXED]
- **Scope**: `modules/notification/services/whatsapp`
- **Author**: agent
- **Deskripsi**: Extract send/restore helpers ke `baileys-session-send.ts` agar file manager ≤800 baris. Memperbaiki gagal deploy Jenkins (`module-public-api` architecture test).
- **Files**: `baileys-session-manager.ts`, `baileys-session-send.ts`
- **Breaking**: ❌ Tidak

### [2026-07-24] — Fix overtime schedule tenant isolation inject

- **Tipe**: [FIXED]
- **Scope**: `lib/prisma.ts`
- **Author**: agent
- **Deskripsi**: `OvertimeAutoCheckoutSchedule` tidak punya kolom `tenantId` tapi kena inject dari `withTenantIsolation` saat `findUnique`/`upsert`, menyebabkan `PrismaClientValidationError` dan gagal schedule/cancel auto-checkout lembur. Ditambahkan ke `ignoreModels` (pola sama `JournalLine`).
- **Files**: `lib/prisma.ts`
- **Breaking**: ❌ Tidak

### [2026-07-24] — Skip WA Baileys account yang belum connected

- **Tipe**: [FIXED]
- **Scope**: `modules/notification`
- **Author**: agent
- **Deskripsi**: Routing WhatsApp sekarang skip akun Baileys yang session-nya tidak `connected` (failover ke akun lain). Pesan error session putus dibedakan `needs_reauth`/`qr` vs disconnected.
- **Files**: `whatsapp-account-routing.service.ts`, `baileys-session-manager.ts`
- **Breaking**: ❌ Tidak

### [2026-07-24] — MixRadius login timeout + retry + circuit

- **Tipe**: [FIXED]
- **Scope**: `modules/integrations`
- **Author**: agent
- **Deskripsi**: Timeout default MixRadius 30s (env `MIXRADIUS_TIMEOUT_MS`), login 25s (`MIXRADIUS_LOGIN_TIMEOUT_MS`), 1 retry pada error transient, circuit-breaker 2 menit setelah timeout berulang.
- **Files**: `mixradius-service.config.ts`, `mixradius-auth-client.ts`
- **Breaking**: ❌ Tidak

### [2026-07-24] — Mobile upload abort log sebagai warn 499

- **Tipe**: [FIXED]
- **Scope**: `app/api/mobile/upload`
- **Author**: agent
- **Deskripsi**: Client abort / ECONNRESET pada upload tidak lagi di-log sebagai ERROR 500; return 499 + warn. `maxDuration = 60` pada route.
- **Files**: `route.ts`, `route-handlers-impl.ts`
- **Breaking**: ❌ Tidak

### [2026-07-23] — Redesign SaaS landing + logo mobile + light/dark

- **Tipe**: [CHANGED]
- **Scope**: `components/landing`, `public/brand`, `docs/DESIGN.md`
- **Author**: agent
- **Deskripsi**: Redesign landing RADPRO.ID (soft structural). Logo resmi dari mobile app (`assets/images/icon.png`) di nav/footer; aksen brand blue `#0a46aa`; dual-theme; hapus section testimoni & klaim social proof palsu (4.9/5, 200+ ISP).
- **Files**: `components/landing/SaasLandingPage.tsx`, `public/brand/radpro-icon.png`, `docs/DESIGN.md`
- **Breaking**: ❌ Tidak

### [2026-07-23] — SEO foundation untuk SaaS landing

- **Tipe**: [ADDED]
- **Scope**: `app/page.tsx`, `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`
- **Author**: agent
- **Deskripsi**: Metadata lengkap (title/description/keywords/canonical/OG/Twitter), JSON-LD Organization+WebSite+SoftwareApplication, `sitemap.xml`, dan `robots.txt` yang block area admin/api/app.
- **Files**: `app/page.tsx`, `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`
- **Breaking**: ❌ Tidak

### [2026-07-23] — Rewrite kebijakan privasi RADPRO SaaS

- **Tipe**: [CHANGED]
- **Scope**: `app/kebijakan-privasi`
- **Author**: agent
- **Deskripsi**: Ganti konten SBL NET / ISP palsu dengan kebijakan privasi jujur untuk SaaS RADPRO.ID (ruang lingkup, data, penggunaan, pembagian, retensi, hak, kontak sales@radpro.id). Hapus klaim alamat/PT/telepon yang bukan milik RADPRO.
- **Files**: `app/kebijakan-privasi/page.tsx`, `app/kebijakan-privasi/PrivacyPolicyPageClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-07-23] — Harden GHCR manifest inspect di Jenkins

- **Tipe**: [INFRA]
- **Scope**: `Jenkinsfile`, `tests/ci/jenkinsfile-build-safety.test.ts`
- **Author**: agent
- **Deskripsi**: `docker manifest inspect` setelah push kadang gagal karena `connection reset by peer` ke GHCR. Ditambah retry 5x dengan backoff; safety test diupdate agar assert wrapper `verify_manifest` (bukan literal inspect langsung).
- **Files**: `Jenkinsfile`, `tests/ci/jenkinsfile-build-safety.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-22] — Perbaiki label PDF restock: Purchase Request (bukan PO)

- **Tipe**: [FIXED]
- **Scope**: `app/admin/inventory/restock`
- **Author**: agent
- **Deskripsi**: PDF di halaman restock/inventory salah dilabeli Purchase Order.
  Diganti ke Purchase Request: judul dokumen, nama file (`PR-…`), toast, tombol
  UI, dan nama fungsi `generatePurchaseRequestPdf`. Nomor PO terkait tetap
  ditampilkan sebagai meta referensi.
- **Files**: `pdf.ts`, `RestockTable.tsx`, `tests/ui/restock-pdf.test.ts`,
  `tests/ui/restock-table.test.tsx`
- **Breaking**: ❌ Tidak

### [2026-07-22] — Download PDF Purchase Order di admin procurement

- **Tipe**: [ADDED]
- **Scope**: `app/admin/procurement/purchase-orders`
- **Author**: agent
- **Deskripsi**: Aksi download PDF di list dan detail Purchase Order. PDF
  client-side (jspdf + autotable) berisi header PO, supplier, item barang/jasa,
  ringkasan PPN & grand total.
- **Files**: `po-pdf.ts`, `PurchaseOrderListClient.tsx`,
  `PurchaseOrderEditClient.tsx`, `tests/ui/procurement-po-pdf.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-21] — Track mobile OTA id + outdated badge di admin users

- **Tipe**: [ADDED] [MIGRATION]
- **Scope**: `modules/users`, `app/admin/users`, `mobile-netmanager`, `prisma`
- **Author**: agent
- **Deskripsi**: Kolom App Version di admin/users menampilkan native
  versionCode/name + OTA updateId (expo-updates). Mobile kirim otaUpdateId
  saat login & refresh. Persist ke User.lastOtaUpdateId + lastLoginAt.
  List users membandingkan lastVersionCode vs latest AppRelease android
  (badge Outdated). Migration: `20260721180000_add_user_last_ota_update_id`.
- **Migration**: `20260721180000_add_user_last_ota_update_id`
- **Breaking**: ❌ Tidak

### [2026-07-21] — Harden force-logout scope + block self-delete

- **Tipe**: [FIXED]
- **Scope**: `modules/users`, `app/api/admin/users`
- **Author**: agent
- **Deskripsi**: Force logout admin enforce site restriction + tenant match
  (sama pola delete). Self-delete user diblok 400. Policy di service layer.
- **Files**: `AdminUserRouteService.ts`,
  `app/api/admin/users/[id]/force-logout/route.ts`
- **Breaking**: ❌ Tidak

### [2026-07-21] — Live-map Refresh force-fetch snapshot check-in + GPS

- **Tipe**: [FIXED]
- **Scope**: `lib/hooks/useApi`, `app/admin/kehadiran/live-map`
- **Author**: agent
- **Deskripsi**: Tombol Refresh live-map memanggil `refetch()` (network force)
  dengan `staleTime: 0` agar selalu ambil ulang daftar karyawan check-in
  hari ini + lokasi GPS terakhir. `useApi.mutate()` tanpa updater juga
  force `refetchQueries` (bukan cuma invalidate). Spinner saat `isFetching`.
- **Breaking**: ❌ Tidak

### [2026-07-21] — Harden live-map history scope + empty map state

- **Tipe**: [FIXED]
- **Scope**: `modules/attendance`, `app/admin/kehadiran/live-map`
- **Author**: agent
- **Deskripsi**: History lokasi admin kini enforce site_only/department_only
  secara ketat (sebelumnya lolos bila flag tidak ada) + cek cross-tenant.
  LiveMapClient: empty/loading state di mode map, hapus log PII koordinat.
- **Files**: `AdminLocationRouteService.ts`, `LiveMapClient.tsx`,
  `tests/modules/attendance/AdminLocationRouteService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-21] — Backfill tenantId null di canvasing & point_claims

- **Tipe**: [FIXED]
- **Scope**: production DB (`canvasing`, `point_claims`)
- **Author**: agent
- **Deskripsi**: 48 canvasing + 43 point_claims punya `tenantId` null
  sehingga ter-exclude isolasi tenant Prisma (filter exact `tenantId`).
  Akibatnya TOTAL POIN mobile Dede 1506 alih-alih 1794. Backfill
  `tenantId` dari `User.salesId` tenant. Create path sudah inject
  tenant via prisma extension; data lama yang null diperbaiki di prod.
- **Breaking**: ❌ Tidak

### [2026-07-21] — Fix audience notifikasi work order (stop spam cross-dept)

- **Tipe**: [FIXED]
- **Scope**: `modules/notification`, `lib/event-bus`, `modules/work-order`
- **Author**: agent
- **Deskripsi**: Penerima notifikasi WO dipisah POOL (WO baru, dept+site ketat
  dengan `department_only` di workorders/m_work_order) vs STAKEHOLDERS (status,
  aksi mobile, assign observer: assignee/creator/assignments + verify/approve).
  Event bus WORK_ORDER_CREATED hanya realtime socket agar tidak double-fire
  "Work Order Baru". Branch Manager cross-dept tidak lagi dapat noise teknisi.
- **Files**: `NotificationService.recipients.ts`,
  `NotificationService.work-order-events.ts`, `event-handlers.ts`,
  `user-lookup.workorder.ts`
- **Breaking**: ❌ Tidak

### [2026-07-21] — Fix scope summary canvasing mobile "Canvasing Saya"

- **Tipe**: [FIXED]
- **Scope**: `app/api/marketing/canvasing/summary`, `mobile-netmanager`
- **Author**: agent
- **Deskripsi**: Endpoint summary selalu personal (salesId = user login).
  Sebelumnya permission `canvasing:read` membuat `canReadAll=true` sehingga
  card "Canvasing Saya" menampilkan approved se-tenant (221) alih-alih milik
  sales (181). Subtitle card mobile diganti dari `woStartedToday` ke
  `completedToday` agar match label "kunjungan selesai hari ini".
- **Files**: `app/api/marketing/canvasing/summary/route.ts`,
  `mobile-netmanager/app/(app)/dashboard.tsx`,
  `tests/api/marketing-canvasing-summary-route.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-21] — Reminder absensi via WhatsApp + flexible no-checkin

- **Tipe**: [ADDED]
- **Scope**: `modules/attendance`, `modules/users`
- **Author**: agent
- **Deskripsi**: Reminder absensi karyawan (cron `attendance-alert`) sekarang
  dual-channel: push notifikasi + WhatsApp via akun INTERNAL. Copy check-in
  menekankan keterlambatan. Offset tetap 30 menit setelah jam masuk/pulang.
  Flexible: (1) 1x/hari jika belum check-in sama sekali (mulai jam 12 lokal),
  (2) tetap reminder checkout setelah melewati target jam kerja. User cukup
  punya pushToken ATAU phone untuk masuk antrean reminder.
- **Files**: `modules/attendance/services/AttendanceReminderDeliveryService.ts`,
  `modules/attendance/services/AttendanceReminderQueryService.ts`,
  `modules/attendance/services/AttendanceAlertService.ts`,
  `modules/attendance/repositories/AttendanceReminderRepository.ts`,
  `modules/users/repositories/user-lookup.attendance.ts`
- **Breaking**: ❌ Tidak

### [2026-07-20] — Nullable userId/senderId chat untuk actor mitra

- **Tipe**: [MIGRATION]
- **Scope**: `prisma/migrations`, `modules/chat`
- **Author**: agent
- **Deskripsi**: Migration `add_chat_actor_columns` menambah actorType/actorId
  tapi belum drop NOT NULL pada `ConversationParticipant.userId` dan
  `Message.senderId`. Insert participant mitra (userId=null) gagal di production
  dengan `null value in column "userId" violates not-null constraint` (P2011)
  di `/api/mobile/chat/global`. Fix: drop NOT NULL + drop unique constraint lama
  `ConversationParticipant_conversationId_userId_key` (nama constraint di DB
  berbeda dari yang di migration #1). FK ke User tetap aktif.
- **Migration**: `20260720123000_make_chat_user_columns_nullable`
- **Breaking**: ❌ Tidak

### [2026-07-20] — Aktifkan chat untuk mitra & pelanggan via actor polymorphism

- **Tipe**: [CHANGED]
- **Scope**: `modules/chat`, `app/api/admin/chat`, `app/api/mobile/chat`
- **Author**: agent
- **Deskripsi**: Chat sebelumnya hard-couple ke `User.id` (FK di
  `ConversationParticipant.userId` & `Message.senderId`), sehingga mitra &
  pelanggan (di DB terpisah `prismaMitra`/`prismaAuth.pelanggan`) tidak bisa
  berpartisipasi — `ensureEmployeeUser` throw 500 dan insert participant
  akan FK violation. Refactor ke pola actor polymorphic (sama seperti
  `SystemLog`/`Notification`): tambah `actorType` + `actorId` di
  `ConversationParticipant` & `Message`, nullable `userId`/`senderId`.
  `ChatService` pakai `resolveChatActor(session)` — mitra → `actorType:"mitra"`,
  pelanggan → `"customer"`, user → `"user"`. Formatters resolve name/image
  cross-DB via `resolveActorSummary`. `sendPushToUsers` sudah actor-aware
  (fallback mitra repo), socket emit `chatMessage(actorId)` ke Firebase path
  `users/{id}/events` yang dipakai mobile mitra. Broadcast & create
  conversation tetap employee-only; mitra bisa join global chat + reply +
  1-on-1 dengan employee.
- **Files**: `prisma/schema.prisma`,
  `modules/chat/domain/entities/ChatEntity.ts`,
  `modules/chat/domain/ports/IChatRepository.ts`,
  `modules/chat/repositories/chat-conversation.repository.ts`,
  `modules/chat/repositories/chat-message.repository.ts`,
  `modules/chat/repositories/ChatRepository.ts`,
  `modules/chat/services/ChatService.ts`,
  `modules/chat/services/ChatBroadcastService.ts`,
  `modules/chat/services/ChatService.types.ts`,
  `modules/chat/services/chat-formatters.ts`,
  `modules/chat/services/chat-notification.service.ts`,
  `modules/chat/services/actor-resolver.ts`,
  `modules/chat/services/resolveChatActor.ts`,
  `modules/chat/index.ts`,
  `app/api/admin/chat/**`, `app/api/mobile/chat/**`,
  `tests/modules/chat/ChatService.test.ts`
- **Migration**: `20260720030000_add_chat_actor_columns` (additive —
  FK ke User tetap aktif sebagai safety net, drop FK akan di migration
  terpisah setelah verifikasi production clean)
- **Breaking**: ❌ Tidak (API DTO tambah field `senderActorType`/
  `senderActorId` tanpa hapus `senderId` yang sudah nullable)

### [2026-07-20] — Aktifkan chat mobile untuk mitra (semua tipe)

- **Tipe**: [FIXED]
- **Scope**: `lib/mobile-auth`
- **Author**: agent
- **Deskripsi**: Mitra tidak bisa akses chat mobile karena
  `getMitraMobileFeatures` tidak mendaftar `m_chat` dan
  `getMitraMobileCapabilities` tidak beri `m_chat:read`/`m_chat:create`.
  Semua endpoint `/api/mobile/chat/*` butuh permission itu, jadi mitra selalu
  403 dan menu chat tidak muncul di mobile. Fix: tambah `m_chat` ke features
  base (semua tipe mitra) dan `m_chat:read` + `m_chat:create` ke permissions
  base di `getMitraMobileCapabilities`.
- **Files**: `lib/mobile-auth.ts`, `tests/lib/mobile-auth.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-20] — Fix 403 mitra di endpoint mobile work-order

- **Tipe**: [FIXED]
- **Scope**: `lib/mobile-auth`
- **Author**: agent
- **Deskripsi**: `verifyMitraToken` mengisi `permissions` pakai
  `getMitraMobileFeatures(mitraType)` yang return feature-level (mis.
  `m_work_order`, `m_barang`) tanpa action. Semua endpoint mobile pakai
  action-level (`m_work_order:read`, `m_work_order:update`, `m_work_order:create`)
  di `createHandler({ permissions: [...] })`, dan `expandPermissionsWithAliases`
  tidak punya alias feature→action. Akibatnya mitra teknisi selalu dapat 403
  saat akses `/api/mobile/work-orders/available` & endpoint work-order lain,
  lalu mobile mengirim error report (loop 403 + error report).
  Fix: ganti ke `getMitraMobileCapabilities(mitraType).permissions` yang sudah
  return action-level, plus tambah `m_work_order:update` dan `m_work_order:create`
  untuk `MITRA_TEKNISI` agar bisa claim, update progress, dan request work-order.
- **Files**: `lib/mobile-auth.ts`, `tests/lib/mobile-auth.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-20] — Fix FK violation SystemLog saat mitra/pelanggan kirim error report

- **Tipe**: [FIXED]
- **Scope**: `modules/notification`
- **Author**: agent
- **Deskripsi**: `MobileErrorReportRepository.createSystemLog` sebelumnya menulis
  `userId` dari token mobile langsung ke `SystemLog`, padahal `SystemLog.userId`
  punya FK ke `User.id` di DB utama. Mitra & pelanggan berada di DB terpisah
  (`prismaMitra`/`prismaAuth`) sehingga id mereka tidak ada di tabel `User` —
  insert gagal dengan `Foreign key constraint violated: SystemLog_userId_fkey`,
  route `/api/mobile/error-report` return 500, dan mobile retry looping.
  Fix: ikuti pola `resolveActor` di `lib/logger.ts` — aktor non-user
  (role `MITRA`/`CUSTOMER`) direpresentasikan via `actorType` + `actorId`
  (kolom tanpa FK), `userId` di-set null. User biasa tetap via `userId`.
  Repository juga pre-check existence `userId` di `User` sebagai safety net
  untuk user legacy yang dihapus (konsisten dengan logger utama). Sekalian
  perbaiki bug pre-existing: field `tenant` di `MobileAuthContext` salah nama
  (payload asli `tenantId`), sehingga `tenantId` tidak pernah terisi di log.
- **Files**: `modules/notification/domain/ports/IMobileErrorReportRepository.ts`,
  `modules/notification/repositories/MobileErrorReportRepository.ts`,
  `modules/notification/services/MobileErrorReportService.ts`
- **Breaking**: ❌ Tidak

### [2026-07-20] — List HR pegawai ikut template UI list Pengguna

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/hr/employees`
- **Author**: agent
- **Deskripsi**: Halaman list pegawai HR di-refresh mengikuti template list Pengguna: header dengan CTA, kartu statistik (UserStats), filter (UserFilters), ResponsiveTable, dan pagination. Reuse `useUserFetch`, `UserStats`, `UserFilters`, `ResponsiveTable`, dan `buttonVariants` dari modul users — tidak ada duplikasi fetch layer. Kolom disesuaikan untuk konteks HR (Pegawai, Departemen, Site, Wajib Absen, Status) dengan aksi "Kelola Kepegawaian" + "Akun".
- **Files**: `app/admin/hr/employees/HrEmployeesListClient.tsx`, `tests/admin/hr-employees-surface.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-20] — Menu HR Data Pegawai

- **Tipe**: [ADDED]
- **Scope**: `app/admin/hr`, `lib/menu-config.ts`
- **Author**: agent
- **Deskripsi**: Menu sidebar HR + landing `/admin/hr` + halaman Data Pegawai (list/detail) untuk kelola departemen, multi-site, jam kerja, dan kuota cuti. Permission di-map ke `users:*`. Reuse API `modules/users` / leave-balance. Tanpa migration.
- **Files**: `lib/menu-config.ts`, `components/layout/admin-sidebar/adminSidebarMenu.ts`, `app/admin/hr/**`
- **Breaking**: ❌ Tidak

### [2026-07-20] — Form Pengguna tanpa section kepegawaian

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/users`
- **Author**: agent
- **Deskripsi**: Edit/view Pengguna fokusus IAM (kredensial, role, status, sales). Section kepegawaian dipindah ke `/admin/hr/employees/[id]`. Create user tetap boleh set dept/site; jam kerja & kuota cuti hanya di HR.
- **Files**: `app/admin/users/[id]/UsersDetailClient.tsx`, `UsersDetailView.tsx`, `app/admin/users/new/UsersNewClient.tsx`
- **Breaking**: ❌ Tidak (path `/admin/users` tetap; field HR di-edit lewat path baru)

### [2026-07-20] — Halaman detail pegawai HR (kepegawaian only)

- **Tipe**: [ADDED]
- **Scope**: `app/admin/hr/employees/[id]`
- **Author**: agent
- **Deskripsi**: Detail pegawai di menu HR: penempatan (dept/site), jam kerja, kuota cuti. PATCH hanya field HR (tanpa password/role/name/email). Header read-only + link ke `/admin/users/[id]`. Reuse komponen shared HR.
- **Files**: `app/admin/hr/employees/[id]/page.tsx`, `app/admin/hr/employees/[id]/HrEmployeeDetailClient.tsx`, `tests/admin/hr-employees-surface.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-20] — Tambah menu HR + specialMappings permission users

- **Tipe**: [ADDED] [CHANGED]
- **Scope**: `lib/menu-config.ts`, `components/layout/admin-sidebar/adminSidebarMenu.ts`, `components/layout/admin-sidebar/adminSidebarIcons.tsx`
- **Author**: agent
- **Deskripsi**: Fase 1 PRD-HR-MENU-SPLIT v2. Tambah parent menu HR (section SDM, no featureModule) dengan child HR.EMPLOYEES (path /admin/hr/employees, featureModule users). Rename USERS display name "Karyawan" → "Pengguna". Tambah specialMappings HR + HR.EMPLOYEES → users di adminSidebarMenu.ts. Register icon HiOutlineIdentification. Dilengkapi 6 unit tests TDD (RED→GREEN).
- **Files**: `lib/menu-config.ts`, `components/layout/admin-sidebar/adminSidebarMenu.ts`, `components/layout/admin-sidebar/adminSidebarIcons.tsx`, `tests/admin/hr-menu-config.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-20] — PRD menu HR: pisah kepegawaian dari Karyawan

- **Tipe**: [DOCS]
- **Scope**: `docs/specifications`
- **Author**: agent
- **Deskripsi**: PRD `PRD-HR-MENU-SPLIT-2026-07-20` v2 — SOT keputusan: tambah menu HR dengan memisahkan fungsi kepegawaian (dept, site, jam kerja, kuota cuti) dari menu Karyawan/Pengguna. v1 (flatten Kehadiran+Gaji) dibatalkan karena tidak sesuai intent. Belum ada perubahan kode aplikasi; belum commit/push.
- **Files**: `docs/specifications/PRD-HR-MENU-SPLIT-2026-07-20.md`
- **Breaking**: ❌ Tidak

### [2026-07-19] — Kembalikan Turbopack build + batasi worker (webpack break Baileys)

- **Tipe**: [FIXED] [INFRA]
- **Scope**: `package.json`, `next.config.ts`
- **Author**: agent
- **Deskripsi**: Build #232 `next build --webpack` compile OK tapi gagal collect page data `/api/admin/whatsapp/accounts` (`TypeError: f.Pc is not a constructor` — Baileys di-bundle webpack salah). Build #231 (Turbopack) justru full success sampai push image, gagal hanya di timeout cache export. Revert ke Turbopack default + `experimental.cpus: 2` agar peak RAM collect page data lebih rendah di host 31Gi.
- **Files**: `package.json`, `next.config.ts`
- **Breaking**: ❌ Tidak

### [2026-07-19] — Naikkan timeout buildx app (build #231 exit 130)

- **Tipe**: [FIXED] [INFRA]
- **Scope**: `Jenkinsfile`
- **Author**: agent
- **Deskripsi**: Build #231 tests lulus, `next build` sukses (~17m), image app sudah di-push ke GHCR, lalu gagal `Canceled: context canceled` / exit 130 karena `timeout 1500` (25m) shell memotong saat cache export. Naikkan shell timeout app ke 2700s (45m) dan stage timeout ke 70m.
- **Files**: `Jenkinsfile`
- **Breaking**: ❌ Tidak

### [2026-07-19] — Pakai webpack untuk next build (Turbopack OOM 26GB di host)

- **Tipe**: [FIXED] [INFRA]
- **Scope**: `package.json`
- **Author**: agent
- **Deskripsi**: Investigasi SSH ke host radpro (single-node k3s 31Gi). dmesg build #230: kernel OOM kill `MainThread` (Turbopack) dengan **anon-rss ~26GB** saat `next build`. Host juga menjalankan production netmanager + Jenkins + Rancher + Lumeris. Next 16 default Turbopack untuk production build terlalu lapar RAM untuk monorepo ini. Fix: `next build --webpack` (flag resmi opt-out). Heap Node tetap 4GB via Dockerfile ENV.
- **Files**: `package.json`
- **Breaking**: ❌ Tidak

### [2026-07-19] — Samakan heap typecheck dengan limit container node

- **Tipe**: [FIXED] [INFRA]
- **Scope**: `Jenkinsfile`
- **Author**: agent
- **Deskripsi**: Build #229 ABORTED di stage QC: container node OOMKilled saat `npm run typecheck`. Penyebab: limit container diturunkan ke 4Gi di #228, tapi `NODE_OPTIONS` typecheck masih 6GB. Fix: limit node kembali 6Gi (request 3Gi), heap typecheck 5GB (margin), vitest heap 3GB, prisma generate sequential (bukan parallel).
- **Files**: `Jenkinsfile`
- **Breaking**: ❌ Tidak

### [2026-07-19] — Fix host OOM di stage Build Image (next build heap 8GB)

- **Tipe**: [FIXED] [INFRA]
- **Scope**: `package.json`, `Dockerfile`, `Jenkinsfile`
- **Author**: agent
- **Deskripsi**: Build #228 ABORTED — tests lulus, lalu `docker buildx` OOMKilled SEMUA container agent. Root cause: `package.json` script `build` hardcode `NODE_OPTIONS=--max-old-space-size=8192` yang meng-override Dockerfile ARG (4GB). Buildx pakai host docker.sock → Node minta heap 8GB di host → host OOM. Fix: (1) hapus hardcode heap dari script build; (2) Dockerfile set 4GB via ENV; (3) turunkan request/limit container node (2Gi/4Gi) dan docker CLI (256Mi/1Gi) agar host punya headroom untuk dockerd/`next build`.
- **Files**: `package.json`, `Dockerfile`, `Jenkinsfile`
- **Breaking**: ❌ Tidak

### [2026-07-19] — Sync indentasi expected buildx di jenkinsfile-build-safety test

- **Tipe**: [FIXED]
- **Scope**: `tests/ci/jenkinsfile-build-safety.test.ts`
- **Author**: agent
- **Deskripsi**: Test `binds runtime image refs through env` gagal di CI karena expected string indentasi `docker buildx build` memakai 40 spasi, sementara Jenkinsfile memakai 32 spasi. Sesuaikan expected agar cocok dengan indentasi aktual.
- **Files**: `tests/ci/jenkinsfile-build-safety.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-19] — Fix Jenkins OOMKilled di container node (deploy ABORTED)

- **Tipe**: [INFRA]
- **Scope**: `Jenkinsfile`
- **Author**: agent
- **Deskripsi**: Build #219–#224 ABORTED (container node OOMKilled). #225 FAIL (JS heap OOM typecheck). #226 ABORTED (host OOM: vitest + docker buildx via host docker.sock jalan parallel → SEMUA container OOMKilled). Patch: (1) resource limits node 3Gi/6Gi; (2) lint/typecheck sequential + heap 6GB; (3) vitest `--maxWorkers=2` + heap 4GB; (4) **serial** stage Test → Build Image (bukan parallel).
- **Files**: `Jenkinsfile`
- **Breaking**: ❌ Tidak

### [2026-07-19] — Status Diterima/Dibaca untuk WA Baileys

- **Tipe**: [ADDED] [MIGRATION]
- **Scope**: `modules/notification`, `app/admin/pengaturan/whatsapp/logs`, `prisma`
- **Author**: agent
- **Deskripsi**: Deteksi status delivery & read receipt untuk akun WhatsApp Baileys. Listener `messages.update` di session manager memetakan `DELIVERY_ACK` → `delivered` dan `READ`/`PLAYED` → `read`, lalu update baris log by `messageId` (Baileys key.id). Status mononton (tidak bisa downgrade). UI log WA menampilkan badge Diterima/Dibaca + kartu stats + filter baru. Catatan: status "Dibaca" hanya muncul jika privacy read receipt penerima mengizinkan; Fonnte/Wablas belum support (butuh webhook terpisah).
- **Files**: `prisma/schema.prisma`, `prisma/migrations/*_whatsapp_message_delivery_status/migration.sql`, `modules/notification/domain/whatsapp-message.entity.ts`, `modules/notification/repositories/whatsapp-message.repository.ts`, `modules/notification/services/whatsapp/baileys-session-manager.ts`, `app/admin/pengaturan/whatsapp/logs/WhatsappLogsClient.tsx`, `app/api/admin/whatsapp/messages/route.ts`
- **Migration**: `*_whatsapp_message_delivery_status` (kolom `deliveredAt`, `readAt` + index `messageId`)
- **Breaking**: ❌ Tidak

### [2026-07-18] — Halaman Log WhatsApp + statistik + detail pesan

- **Tipe**: [ADDED]
- **Scope**: `app/admin/pengaturan/whatsapp/logs`, `app/api/admin/whatsapp/messages`, `app/api/admin/whatsapp/stats`, `modules/notification`
- **Author**: agent
- **Deskripsi**: Halaman baru `/admin/pengaturan/whatsapp/logs` untuk monitoring pengiriman WA. Kartu statistik (total/terkirim/pending/gagal), filter status+tanggal+akun+nomor tujuan, tabel paginated, klik row → modal detail (isi pesan, error, response provider, waktu kirim). API `GET /api/admin/whatsapp/messages` diperluas: filter status/date/account/phone + pagination; tambah `GET /api/admin/whatsapp/messages/[id]` untuk detail. API `GET /api/admin/whatsapp/stats` kini support mode global (tanpa `accountId`) lintas akun tenant. Repo + service dapat `findFiltered`, `findDetail`, `getGlobalStats`. Link "Log Pesan" ditambah di header pengaturan WA + entry menu sidebar. Status yang ditampilkan: pending/sent/failed (data yang sudah ada di DB). Status delivered/read menyusul via webhook provider di iterasi berikutnya.
- **Files**: `app/admin/pengaturan/whatsapp/logs/page.tsx`, `app/admin/pengaturan/whatsapp/logs/WhatsappLogsClient.tsx`, `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`, `app/api/admin/whatsapp/messages/route.ts`, `app/api/admin/whatsapp/messages/[id]/route.ts`, `app/api/admin/whatsapp/stats/route.ts`, `modules/notification/repositories/whatsapp-message.repository.ts`, `modules/notification/services/whatsapp-sender.service.ts`, `lib/menu-config.ts`
- **Breaking**: ❌ Tidak

### [2026-07-17] — Notifikasi WA Work Order baru ke teknisi + deep link ke mobile app

- **Tipe**: [ADDED]
- **Scope**: `modules/work-order`, `modules/users`, `app/w/[id]`, `mobile/src/hooks/useDeepLink.ts`
- **Author**: agent
- **Deskripsi**: Saat WO baru dibuat, sistem kirim WhatsApp (account INTERNAL) ke teknisi aktif di site+department WO yang punya nomor HP. Pesan berisi nomor, judul, tipe, prioritas, dan link HTTPS `https://radpro.id/w/<id>` yang clickable di WA. Link itu redirect ke deep link `netmanager:///work-order-detail/<id>` (path-style, 3 slash — expo-router Android butuh format ini) untuk membuka aplikasi mobile langsung ke detail WO. Teknisi tinggal tap "Ambil Tugas" (fitur claim sudah ada di mobile). Deep link handler di mobile (`useDeepLink`) adalah JS-only — OTA, tanpa rebuild. Scheme `netmanager` sudah ada di build sejak initial commit. Tambah `findManyActiveWithPhoneAndSite` di UserLookup untuk query teknisi ber-HP tanpa syarat push token.
- **Files**: `modules/work-order/services/WorkOrderNotifications.ts`, `modules/users/repositories/user-lookup.notification.ts`, `modules/users/repositories/UserLookupRepository.ts`, `modules/users/services/UserLookupService.ts`, `app/w/[id]/route.ts`, `mobile-netmanager/src/hooks/useDeepLink.ts`, `mobile-netmanager/app/_layout.tsx`
- **Breaking**: ❌ Tidak

### [2026-07-16] — Tambah tab Rilis APK di halaman Update Aplikasi

- **Tipe**: [ADDED]
- **Scope**: `app/admin/pengaturan/app-update`
- **Author**: agent
- **Deskripsi**: Refactor `AppUpdateClient` menjadi 2 tab: OTA (JS Bundle) dan Rilis APK (Play Store). Tab baru `AppReleasesTab` menampilkan daftar rilis APK, form tambah release, dan soft-delete — reuse API `/api/admin/app-releases`. Admin tidak perlu navigasi ke `/admin/app-releases` terpisah.
- **Files**: `app/admin/pengaturan/app-update/AppUpdateClient.tsx`, `AppReleasesTab.tsx`, `OtaUpdatesTab.tsx`
- **Breaking**: ❌ Tidak

### [2026-07-16] — Hapus Serial Number di Node List + fix dark mode popup map

- **Tipe**: [FIXED] [CHANGED]
- **Scope**: `components/map`, `app/styles`
- **Author**: agent
- **Deskripsi**: (1) Kolom Serial Number dihapus dari tabel Node List di `/admin/map` karena tidak diperlukan. (2) Popup detail node di map gelap: teks tidak terbaca di dark mode — tambah `dark:` variants di `NodePopupContent` + CSS override Leaflet popup (background/tip/close button) karena DOM popup di luar React tree.
- **Files**: `components/map/NodeListTab.tsx`, `components/map/NodePopupContent.tsx`, `app/styles/components.css`
- **Breaking**: ❌ Tidak

### [2026-07-16] — Fix statistik map ODC/ODP selalu 0 di admin/map

- **Tipe**: [FIXED]
- **Scope**: `components/map`
- **Author**: agent
- **Deskripsi**: Statistik bar di `/admin/map` menampilkan 0 untuk ODC/ODP padahal data ada (457 nodes: 426 odp, 31 odc). Root cause: API mengembalikan `nodesByType` sebagai `Array<{type,count}>` tapi UI mengakses sebagai `Record<string,number>` (`nodesByType['odp']` → always undefined). Fix: transform array → Record di `mapStatisticsApi.get`.
- **Files**: `components/map/map-api-client.ts`
- **Breaking**: ❌ Tidak

### [2026-07-16] — Izinkan hapus PR/PO dari menu untuk semua status non-RECEIVED

- **Tipe**: [FIXED]
- **Scope**: `app/admin/inventory/restock`, `app/admin/procurement/purchase-orders`, `modules/procurement`, `app/api/inventory/restock/requests`
- **Author**: agent
- **Deskripsi**: Tombol hapus PR hanya muncul untuk status DRAFT — tidak bisa hapus PR berstatus ORDERED/APPROVED dari menu. Fix: `canDeletePurchaseRequest` dilonggarkan ke semua status kecuali RECEIVED. API DELETE PR kini cascade-hapus PO terkait (beserta expense pembayaran + rollback saldo akun keuangan) sebelum hapus PR. `PurchaseOrderService.delete` ganti guard dari `paymentStatus !== UNPAID` ke `status === RECEIVED` (cek GoodsReceipt di repository). Tombol hapus PO di list juga diperbaiki dari kondisi `UNPAID` ke `status !== RECEIVED`.
- **Files**: `app/admin/inventory/restock/utils.ts`, `app/admin/procurement/purchase-orders/PurchaseOrderListClient.tsx`, `modules/procurement/services/PurchaseOrderService.ts`, `modules/procurement/repositories/PurchaseOrderRepository.ts`, `app/api/inventory/restock/requests/[id]/route.ts`, `tests/ui/restock-utils.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-16] — Optimasi pipeline build deploy production

- **Tipe**: [CHANGED]
- **Scope**: `Dockerfile`, `Jenkinsfile`, `next.config.ts`
- **Author**: agent
- **Deskripsi**: Percepat build deploy production dari ~25 mnt menjadi <10 mnt (cache hit).
  (1) Tambah `sharing=locked` di BuildKit cache mount `.next/cache` agar cache persist antar Jenkins run.
  (2) Webpack `parallelism` adaptif berdasarkan RAM host (1/2/4 thread) menggantikan hardcoded 1.
  (3) Stage `Run Unit Tests` dan `Build Image` di Jenkinsfile dijalankan paralel dalam `parallel {}` block.
- **Breaking**: ❌ Tidak

### [2026-07-15] — Fix import CSV map gagal karena nodeId duplikat

- **Tipe**: [FIXED]
- **Scope**: `modules/map`, `components/map`
- **Author**: agent
- **Deskripsi**: Import CSV crash dengan CONFLICT 409 ketika ada dua baris nama berbeda yang menghasilkan nodeId identik (misal `ODP-010-A01-SLW` vs `ODP 010-A01-SLW`). Fix: baris duplikat diganti otomatis dengan suffix angka (`-2`, `-3`, …) di `name` dan `nodeId`, dicatat sebagai warning. Safety `existingIds.add` di repository. Error asli dari API sekarang ditampilkan di UI.
- **Files**: `modules/map/services/MapCsvImportService.ts`, `modules/map/repositories/MappingRepository.ts`, `components/map/useMapData.ts`, `components/map/SettingsTab.tsx`, `components/map/map-api-client.ts`
- **Breaking**: ❌ Tidak

### [2026-07-15] — Site ID support di admin map (filter + assign)

- **Tipe**: [ADDED] [MIGRATION]
- **Scope**: `modules/map`, `app/api/map`, `components/map`, `prisma/`
- **Author**: agent
- **Deskripsi**: `MappingNode` punya `siteId` opsional (FK Sites, onDelete SetNull). API nodes/edges/statistics terima query `?siteId=`. Create/update node terima body `siteId` dengan validasi ownership tenant. UI toolbar filter site + field site di NodeFormModal. Multi-tenant existing tetap utuh. Edge filter OR (source/target node di site).
- **Files**: `prisma/schema.prisma`, `prisma/migrations/20260715120000_add_site_id_to_mapping_nodes/`, `modules/map/**`, `app/api/map/nodes/**`, `app/api/map/edges/route.ts`, `app/api/map/statistics/route.ts`, `components/map/**`, `tests/unit/map-site-filter.test.ts`
- **Migration**: `20260715120000_add_site_id_to_mapping_nodes`
- **Breaking**: ❌ Tidak

### [2026-07-15] — PRD siteId support untuk admin map

- **Tipe**: [DOCS]
- **Scope**: `docs/specifications`
- **Author**: agent
- **Deskripsi**: PRD penambahan `siteId` opsional pada `MappingNode` (filter & assign per site di `/admin/map`), dengan multi-tenant yang sudah ada tetap utuh. Mencakup schema/migration, API query/body, UI filter, acceptance criteria, dan keputusan D1–D7 (nullable, edge filter OR, settings per-site di fase 2). Status: Implemented.
- **Files**: `docs/specifications/PRD-MAP-SITE-ID-2026-07-15.md`
- **Breaking**: ❌ Tidak

### [2026-07-15] — Import CSV map nodes (mode merge)

- **Tipe**: [ADDED]
- **Scope**: `modules/map`, `app/api/map/import/csv`, `components/map`
- **Author**: agent
- **Deskripsi**: Fitur import node map dari file CSV. Mode merge (upsert by nodeId) — data existing tidak dihapus. Tipe node auto-detect dari prefix nama (ODP/ODC/OLT/ONT), default ODP. Kolom area/owner digabung ke notes. Auto-koreksi lat/lon tertukar. UI di Settings tab map: tombol "Import CSV".
- **Files**: `modules/map/services/MapCsvImportService.ts`, `modules/map/repositories/MappingRepository.ts`, `modules/map/domain/ports/IMappingRepository.ts`, `app/api/map/import/csv/route.ts`, `components/map/SettingsTab.tsx`, `components/map/useMapData.ts`, `components/map/map-api-client.ts`, `tests/unit/map-csv-import.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-15] — Fitur hapus restock fix permission + foto verifikasi barang di detail

- **Tipe**: [FIXED] + [ADDED]
- **Scope**: `app/admin/inventory/restock`, `modules/inventory`
- **Author**: agent
- **Deskripsi**:
  1. Fix bug inkonsistensi permission hapus restock: tombol hapus sebelumnya pakai guard `restock:update`, sedangkan API butuh `restock:delete` yang tidak terdaftar di role manapun — semua request hapus selalu 403. Diperbaiki dengan mendaftarkan `restock:delete`, `restock:approve`, `restock:verify` ke role `inventory-staff` di `lib/role-templates.ts`, memisahkan `canDelete` dari `canUpdate` di `RestockTable`/`RestockList`, dan memperbaiki `canDeletePurchaseRequest()` di `utils.ts`.
  2. Tambah tampilan foto bukti penerimaan barang di detail view. Sebelumnya `fotoBukti` dari `GoodsReceipt` tidak di-include di query list maupun detail. Diperbaiki dengan extend include `purchaseOrder.goodsReceipts` di repository dan service, update type `PurchaseOrderSummary`, dan tambah section "Bukti Penerimaan Barang" di `RestockDetailModal`.
- **Files**: `lib/role-templates.ts`, `app/admin/inventory/restock/utils.ts`, `app/admin/inventory/restock/RestockTable.tsx`, `app/admin/inventory/restock/RestockList.tsx`, `app/admin/inventory/restock/types.ts`, `app/admin/inventory/restock/RestockDetailModal.tsx`, `modules/inventory/services/RestockRequestService.ts`, `modules/inventory/repositories/InventoryPurchaseRequestRepository.ts`
- **Breaking**: ❌ Tidak

### [2026-07-14] — Optimasi Docker build: registry cache + --push + npm cache

- **Tipe**: [INFRA]
- **Scope**: `Jenkinsfile`, `Dockerfile`
- **Author**: agent
- **Deskripsi**: (1) Buildx build diganti `--load` → `--push` langsung ke registry, stage "Push Images to Registry" dihapus. (2) Tambah `--cache-from/--cache-to type=registry` (mode=max) per image (app/cron/radius) ke `netmanager-buildcache*` di GHCR supaya cache survive prune/reboot. (3) Dockerfile deps: npm cache mount `/root/.npm` + urutan COPY package-lock dulu sebelum prisma. Parallel cron+radius di-skip dulu (risiko resource contention di single node).
- **Files**: `Jenkinsfile`, `Dockerfile`
- **Breaking**: ❌ Tidak

### [2026-07-14] — Cleanup referensi staging dari docs aktif

- **Tipe**: [DOCS]
- **Scope**: `README.md`, `DEPLOYMENT.md`, `docs/standards/GIT_JENKINS_SECRET_HYGIENE.md`, `k8s/migration-job.yaml`
- **Author**: agent
- **Deskripsi**: Hapus referensi path mati staging dari dokumen aktif: hapus baris `netmanager-staging` di table environment DEPLOYMENT.md, hapus bagian `deploy-prod.sh` di README (script sudah dihapus), hapus secret staging di hygiene doc, rapikan comment template secret di migration-job.yaml. Staging sudah dipensiunkan; deploy hanya via `main` → production.
- **Breaking**: ❌ Tidak

### [2026-07-14] — Fallback harga PO di handler jurnal GRN

- **Tipe**: [FIXED]
- **Scope**: `modules/accounting/services/event-handlers`
- **Author**: agent
- **Deskripsi**: `handleGoodsReceiptCreatedAccounting` sekarang fallback lookup `unitPrice` dari `purchaseOrderItem` di DB bila payload event punya unitPrice 0 (PO auto-generate dari PR tanpa harga). Mencegah jurnal di-skip padahal harga sudah diisi belakangan di PO.
- **Files**: `modules/accounting/services/event-handlers/goods-receipt-created-accounting.handler.ts`
- **Breaking**: ❌ Tidak

### [2026-07-14] — Menu Pengeluaran di sidebar + tenantId pada expense bayar PO

- **Tipe**: [ADDED] [FIXED]
- **Scope**: `lib/menu-config.ts`, `components/layout/admin-sidebar`, `modules/procurement`
- **Author**: agent
- **Deskripsi**: (1) Tambah menu sidebar `FINANCE.PENGELUARAN` → `/admin/finance/pengeluaran` dengan mapping permission `finance:read`. (2) `processPaymentTransaction` sekarang menyimpan `userId`, `tenantId`, dan `accountId` saat membuat Expense dari bayar PO, agar record muncul di halaman Pengeluaran dan lolos tenant isolation.
- **Files**: `lib/menu-config.ts`, `components/layout/admin-sidebar/adminSidebarMenu.ts`, `modules/procurement/repositories/PurchaseOrderRepository.ts`, `modules/procurement/services/PurchaseOrderPaymentService.ts`
- **Breaking**: ❌ Tidak

### [2026-07-14] — Tombol Proses Order di PO + GRN dropdown include DRAFT

- **Tipe**: [ADDED] [CHANGED]
- **Scope**: `modules/procurement`, `app/api/admin/procurement/purchase-orders`, `app/admin/procurement`
- **Author**: agent
- **Deskripsi**: (1) Endpoint `POST /api/admin/procurement/purchase-orders/[id]/process` mengubah PO DRAFT → ORDERED agar muncul di finance/unpaid (untuk alur bayar dulu, barang belakangan). (2) Tombol "Proses Order" + link "Bayar di Tagihan" di detail PO. (3) Dropdown GRN create menampilkan PO DRAFT/ORDERED/PARTIAL (bukan hanya ORDERED) supaya PO hasil auto-generate dari PR bisa dipilih.
- **Files**: `modules/procurement/services/PurchaseOrderService.ts`, `modules/procurement/repositories/PurchaseOrderRepository.ts`, `app/api/admin/procurement/purchase-orders/[id]/process/route.ts`, `app/admin/procurement/purchase-orders/[id]/PurchaseOrderEditClient.tsx`, `app/admin/procurement/goods-receipts/create/GoodsReceiptCreateClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-07-14] — Verifikasi Barang Sampai di restock otomatis buat GRN

- **Tipe**: [CHANGED]
- **Scope**: `app/api/inventory/restock/requests/[id]/receive`
- **Author**: agent
- **Deskripsi**: Endpoint receive restock sekarang memanggil `GoodsReceiptService.create()` sehingga dokumen GRN tercatat di procurement, stok di-update via GRN flow, dan event `GOODS_RECEIPT_CREATED` memicu jurnal `AUTO_GRN_CREATED`. UI "Verifikasi Barang Sampai" di Pre Request tidak lagi update stok lewat path terpisah tanpa GRN.
- **Files**: `app/api/inventory/restock/requests/[id]/receive/route.ts`, `tests/api/inventory-restock-request-lifecycle-routes.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-14] — Perbaikan alur procurement: edit harga/supplier PO + jasa ke PO + menu unpaid

- **Tipe**: [ADDED] [CHANGED] [MIGRATION]
- **Scope**: `modules/procurement`, `app/admin/procurement/purchase-orders`, `lib/menu-config.ts`, `components/layout/admin-sidebar`, `prisma/`
- **Author**: agent
- **Deskripsi**: Implementasi PRD perbaikan procurement. (1) Menu sidebar `FINANCE.UNPAID` + mapping permission ke `finance`. (2) Halaman detail PO bisa edit supplier + unitPrice barang/jasa, total recalculate. (3) Model `PurchaseOrderJasaItem` + generate PO dari PR include jasaItems. (4) Restock jasa tetap tanpa harga.
- **Files**: `lib/menu-config.ts`, `components/layout/admin-sidebar/adminSidebarMenu.ts`, `modules/procurement/**`, `app/admin/procurement/purchase-orders/[id]/PurchaseOrderEditClient.tsx`, `prisma/schema.prisma`
- **Migration**: `20260714084647_add_purchase_order_jasa_items`
- **Breaking**: ❌ Tidak

### [2026-07-14] — Hapus test staging + update test CI/contract

- **Tipe**: [CHANGED] [REMOVED]
- **Scope**: `tests/ci/`, `tests/k8s/`, `tests/contracts/`
- **Author**: agent
- **Deskripsi**: Hapus `deploy-prod-safety.test.ts` dan `deploy-prod-script-safety.test.ts` (script dihapus). Update `jenkinsfile-build-safety.test.ts` — hapus refs staging manifest + sesuaikan expectation echo Cleanup (prune). Hapus staging cases di `app-deployment-cron-config`, `firebase-admin-env-contract`, `postgres-probe-database-safety`, `redis-deployment-safety`, `uploads-pvc-safety`, dan `fcm-build-config-contract`. 28 test pass.
- **Files**: `tests/ci/deploy-prod-safety.test.ts` (removed), `tests/ci/deploy-prod-script-safety.test.ts` (removed), `tests/ci/jenkinsfile-build-safety.test.ts`, `tests/contracts/fcm-build-config-contract.test.ts`, `tests/k8s/*.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-14] — Prune Docker cache agent + GHCR retention + pensiunkan staging

- **Tipe**: [INFRA] [REMOVED]
- **Scope**: `Jenkinsfile`, `.github/workflows/registry-cleanup.yml`, `k8s/staging/`, `deploy-prod.sh`
- **Author**: agent
- **Deskripsi**: (1) Stage `Cleanup` Jenkins: `docker builder prune --keep-storage 5GB` + `docker image prune -f` agar cache agent tidak bengkak. (2) Workflow `registry-cleanup.yml` (cron Mingguan) keep 10 versi GHCR terbaru, preserve tag `production`/`production-prev`. (3) Staging dipensiunkan: pipeline production-only (Branch Guard reject non-main, env fixed ke `netmanager-production` / `k8s/production`), folder `k8s/staging/` dihapus, script `deploy-prod.sh` (promosi staging→main) dihapus. Deploy = push ke `main` saja.
- **Files**: `Jenkinsfile`, `.github/workflows/registry-cleanup.yml`, `k8s/staging/` (removed), `deploy-prod.sh` (removed)
- **Breaking**: ✅ Ya — branch non-main tidak lagi deploy ke staging; namespace `netmanager-staging` di cluster perlu dihapus manual jika masih ada.

### [2026-07-13] — UI halaman Master Jasa + update RestockDetailModal + RestockTable

- **Tipe**: [ADDED] [CHANGED]
- **Scope**: `app/admin/inventory/jasa`, `app/admin/inventory/restock`
- **Author**: agent
- **Deskripsi**: Tambah halaman CRUD master jasa (`page.tsx`, `JasaList.tsx`, `JasaFormModal.tsx`) dengan tabel kode/nama/satuan/supplier/harga/status, search, dan permission guard. Update `RestockDetailModal` untuk render section "Daftar Jasa" (badge JASA violet, status konfirmasi, bukti thumbnail) jika `jasaItems` ada. Update `RestockTable` dengan badge "Jasa: N" (violet) di kolom baru saat PR punya jasa items. Semua 13 test restock-table tetap pass.
- **Files**: `app/admin/inventory/jasa/page.tsx`, `app/admin/inventory/jasa/JasaList.tsx`, `app/admin/inventory/jasa/JasaFormModal.tsx`, `app/admin/inventory/restock/RestockDetailModal.tsx`, `app/admin/inventory/restock/RestockTable.tsx`
- **Breaking**: ❌ Tidak

### [2026-07-14] — Master Jasa + item jasa di pengajuan restock

- **Tipe**: [ADDED] [MIGRATION]
- **Scope**: `modules/inventory`, `app/admin/inventory/jasa`, `app/admin/inventory/restock`, `app/api/inventory/jasa`, `app/api/inventory/restock`
- **Author**: agent
- **Deskripsi**: Fitur jasa (item non-fisik) di inventory restock. Master Jasa terpisah dari Barang (kode, nama, satuan, supplier, hargaEstimasi, kategoriPph). Purchase request bisa berisi barang + jasa. Verifikasi jasa via "Konfirmasi Selesai" + upload bukti (bukan receive stok). Schema: model `Jasa` + `PurchaseRequestJasaItem`.
- **Files**: `modules/inventory/repositories/JasaRepository.ts`, `modules/inventory/services/JasaService.ts`, `modules/inventory/services/RestockJasaConfirmService.ts`, `modules/inventory/services/RestockRequestService.ts`, `app/admin/inventory/jasa/*`, `app/admin/inventory/restock/*`, `app/api/inventory/jasa/*`, `lib/validations/jasa.ts`, `lib/validations/restock.ts`
- **Migration**: `20260713120000_add_jasa_master_and_pr_jasa_items`
- **Breaking**: ❌ Tidak

### [2026-07-13] — Work Order reminder kirim WhatsApp INTERNAL ke teknisi

- **Tipe**: [ADDED]
- **Scope**: `modules/work-order/services/WorkOrderNotifications.ts`, `modules/users/repositories/user-lookup.notification.ts`
- **Author**: agent
- **Deskripsi**: Reminder WO (manual + cron) sekarang juga kirim WhatsApp via akun `accountType=INTERNAL` (Baileys/Wablas) ke nomor HP teknisi, selain push notification. Hanya teknisi/karyawan yang punya field `phone` di user yang dikirimi WA. Pelanggan tetap lewat alur CUSTOMER terpisah.
- **Breaking**: ❌ Tidak

### [2026-07-13] — Baileys: 408 backoff + ENOENT handler + proxy retry

- **Tipe**: [FIXED]
- **Scope**: `modules/notification/services/whatsapp/baileys-session-manager.ts`
- **Author**: agent
- **Deskripsi**: Tiga bug laten dari analisis 80 menit log: (1) Code 408 loop ~2.5-3 menit — keepAliveIntervalMs turun ke 15s + exponential backoff reconnect (5s → 60s max). (2) ENOENT creds.json unhandledRejection — wrap saveCreds dengan safeSaveCreds + global handler suppress ENOENT dari baileys-sessions. (3) Proxy send dari non-owner timeout saat owner reconnect — dispatchRemoteCmd retry 3x dengan backoff.
- **Breaking**: ❌ Tidak

### [2026-07-13] — Baileys: fail-closed lock + Redis command queue ke pod owner

- **Tipe**: [FIXED]
- **Scope**: `modules/notification/services/whatsapp/baileys-session-manager.ts`
- **Author**: agent
- **Deskripsi**: (1) Lock Redis fail-closed saat Redis belum ready (dulu fail-open → 2 pod connect → 440 race ~30s di boot). (2) Send/test di pod non-owner tidak gagal lagi — pesan di-forward via Redis queue ke pod owner (`baileys:cmd:<id>` + result key). (3) Code 440 tidak di-retry (hanya release lock).
- **Breaking**: ❌ Tidak

### [2026-07-13] — Baileys distributed lock: stop 440 multi-pod conflict

- **Tipe**: [FIXED]
- **Scope**: `modules/notification/services/whatsapp/baileys-session-manager.ts`
- **Author**: agent
- **Deskripsi**: Dengan 2 replica pod, keduanya restore session Baileys yang sama → saling kick (code 440 = multidevice conflict). Solusi: Redis distributed lock (`baileys:lock:<id>`, TTL 60s) dengan NX set. Hanya pod yang dapat lock yang menjalankan socket. Pod lain baca status dari Redis (passive). Lock diperbarui tiap 20 detik via heartbeat, dilepas saat disconnect/stop.
- **Breaking**: ❌ Tidak

### [2026-07-13] — Force re-pair Baileys: wipe auth state on 401 / needs_reauth

- **Tipe**: [FIXED]
- **Scope**: `modules/notification/services/whatsapp/baileys-session-manager.ts`, `app/api/admin/whatsapp/accounts/[id]/baileys`
- **Author**: agent
- **Deskripsi**: Setelah logout WhatsApp (code 401), Start hanya return `needs_reauth` sambil tetap load credential lama → QR tidak pernah di-generate. Fix: `clearBaileysAuthState()` hapus folder `.baileys-sessions/<id>`, Start/Restart dengan `forcePairing: true` wipe auth + buka socket fresh agar QR pairing muncul.
- **Breaking**: ❌ Tidak

### [2026-07-13] — Delay Baileys restore sampai DB ready

- **Tipe**: [FIXED]
- **Scope**: `server.ts`
- **Author**: agent
- **Deskripsi**: `restoreAllBaileySessions` dijalankan paralel saat boot dan gagal dengan `Connection terminated due to connection timeout` karena DB belum ready. Dipindah ke chain `waitForDatabaseReady()` (sama dengan RadiusMonitor/MikroTikMonitor) supaya restore hanya jalan setelah DB siap.
- **Breaking**: ❌ Tidak

### [2026-07-13] — full-radius-mode GET tidak butuh umum:read

- **Tipe**: [FIXED]
- **Scope**: `app/api/admin/settings/full-radius-mode/route.ts`
- **Author**: agent
- **Deskripsi**: GET endpoint dipakai Sidebar untuk hide/show menu accel-ppp di semua admin user. Guard `umum:read` membuat role tanpa permission itu dapat 403 spam di log. GET sekarang cukup auth (authenticated), POST tetap butuh `umum:update`.
- **Breaking**: ❌ Tidak

### [2026-07-13] — Fix restoreAllBaileySessions tanpa tenant context + handle 401 NEEDS_REAUTH

- **Tipe**: [FIXED] [SECURITY]
- **Scope**: `modules/notification/services/whatsapp/baileys-session-manager.ts`, `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`
- **Author**: agent
- **Deskripsi**: Dua bug: (1) `restoreAllBaileySessions` query `WhatsAppAccount.findMany` tanpa tenant context → Prisma extension fail-closed throw → sessions tidak auto-restore setelah deploy. Fix: wrap dengan `runAsSystemContext` (pattern sama seperti MikroTikMonitor/RadiusMonitor). (2) Saat Baileys close dengan code 401 (logged out), auto-retry loop spam start/restart. Fix: stop retry, set status `needs_reauth`, dan UI tampilkan tombol "Scan QR Ulang".
- **Breaking**: ❌ Tidak

### [2026-07-13] — Baileys session keep-alive + auto-restore on boot

- **Tipe**: [FIXED]
- **Scope**: `modules/notification/services/whatsapp/baileys-session-manager.ts`, `server.ts`
- **Author**: agent
- **Deskripsi**: Session Baileys terlihat "disconnected" saat tinggalkan halaman karena Redis TTL status hanya 5 menit. Diperbaiki: TTL `connected` 24 jam, refresh TTL tiap 4 menit selama session aktif, dan auto-restore semua akun BAILEYS aktif saat server boot (pakai auth state di disk — tidak perlu scan QR ulang).
- **Breaking**: ❌ Tidak

### [2026-07-13] — PVC Baileys sessions + sticky session Service

- **Tipe**: [INFRA]
- **Scope**: `k8s/production`, `k8s/staging`
- **Author**: agent
- **Deskripsi**: Tambah PVC `netmanager-baileys-sessions` (1Gi RWO) dan volume mount `/app/.baileys-sessions` di app deployment staging/production agar auth state Baileys persist antar restart. Service app juga di-set `sessionAffinity: ClientIP` (3 jam) supaya request sticky ke pod yang memegang socket Baileys.
- **Breaking**: ❌ Tidak

### [2026-07-12] — Provider Baileys (self-hosted WhatsApp)

- **Tipe**: [ADDED]
- **Scope**: `modules/notification/services/whatsapp`, `app/admin/pengaturan/whatsapp`, `app/api/admin/whatsapp/accounts/[id]/baileys`
- **Author**: agent
- **Deskripsi**: Provider WhatsApp baru `BAILEYS` berbasis `@whiskeysockets/baileys` yang berjalan in-process di custom server. Admin bisa start/stop session, scan QR, dan mengirim pesan tanpa gateway pihak ketiga. Session auth disimpan di `.baileys-sessions/` (di-gitignore).
- **Breaking**: ❌ Tidak

### [2026-07-12] — Validasi format token.secret_key di WablasProvider

- **Tipe**: [FIXED]
- **Scope**: `modules/notification/services/whatsapp/providers/wablas-provider.ts`
- **Author**: agent
- **Deskripsi**: Wablas menolak token-only dengan 403. Provider sekarang menolak lebih awal jika API Key tidak berisi titik (format `token.secret_key`), dan memperjelas pesan error 403 agar admin tahu harus isi ulang secret_key saat edit akun.
- **Breaking**: ❌ Tidak

### [2026-07-12] — UI hint format token.secret_key untuk Wablas

- **Tipe**: [DOCS]
- **Scope**: `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`
- **Author**: agent
- **Deskripsi**: Wablas POST memerlukan `Authorization: token.secret_key`. Tanpa secret_key, API membalas 403 "IP not authorized". Field API Key sekarang menampilkan hint format `token.secret_key` untuk provider WABLAS agar admin tahu cara mengisi dengan benar.
- **Breaking**: ❌ Tidak

### [2026-07-12] — Fix auth Wablas: Authorization header + field phone

- **Tipe**: [FIXED]
- **Scope**: `modules/notification/services/whatsapp/providers/wablas-provider.ts`
- **Author**: agent
- **Deskripsi**: Test connection gagal dengan `token is null (status 500)` meski token ada di URL. Wablas POST mengharuskan header `Authorization: {token}` (atau `{token}.{secret_key}`), bukan query `?token=`. Juga ganti field body `number` → `phone` sesuai API Wablas.
- **Breaking**: ❌ Tidak

### [2026-07-12] — Fix list akun WhatsApp kosong di UI pengaturan

- **Tipe**: [FIXED]
- **Scope**: `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`
- **Author**: agent
- **Deskripsi**: Data akun sudah tersimpan di DB tapi UI selalu kosong. Penyebab: double-unwrap — `useApi`/`apiFetcher` sudah mengembalikan `res.data` (array), tapi client masih membaca `.data` lagi sehingga hasilnya selalu `[]`. Diganti ke `rawAccounts ?? []`.
- **Breaking**: ❌ Tidak

### [2026-07-12] — Tambah safe-guard-ack pada migration WhatsApp FK nullable

- **Tipe**: [MIGRATION]
- **Scope**: `prisma/migrations/20260711130000_make_whatsapp_message_account_id_nullable`
- **Author**: agent
- **Deskripsi**: Menambahkan komentar `-- @safe-guard-ack:` di baris pertama migration SQL agar Safe Migration Guard di pipeline produksi tidak memblokir deployment. Migration ini mengubah kolom `accountId` di tabel `WhatsAppMessage` menjadi nullable (FK SetNull) — tidak ada data loss.
- **Migration**: `20260711130000_make_whatsapp_message_account_id_nullable`
- **Breaking**: ❌ Tidak

### [2026-07-11] — WhatsApp bugfix: IDOR stats, testConnection record, dead code

- **Tipe**: [FIXED] [SECURITY]
- **Scope**: `app/api/admin/whatsapp/stats/route.ts`, `modules/notification/services/whatsapp-account.service.ts`, `modules/notification/services/whatsapp/providers/mpwa-provider.ts`, `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`
- **Author**: agent
- **Deskripsi**: Empat perbaikan hasil audit mendalam modul WhatsApp:
  - **[SECURITY]** `stats` route kini validasi kepemilikan `accountId` via `WhatsAppAccountService.findById(id, tenantId)` sebelum query stats — cegah baca statistik lintas tenant (IDOR medium).
  - **[FIXED]** `testConnection` kini buat record `WhatsAppMessage` (status `pending` → `sent`/`failed`) dan increment `dailyCount` jika berhasil — konsisten dengan `sendViaAccount`. Exception saat kirim ditangani: record tetap diupdate ke `failed` via catch block.
  - **[FIXED]** Hapus `MpwaProvider.isSuccessResponse` dead code — duplikat `isSuccessGatewayResponse` dari utils yang tidak pernah dipanggil.
  - **[FIXED]** Hapus `Array.isArray` dead branch di `WhatsappSettingsClient` — API selalu return `{ data: [] }`, branch array langsung tidak pernah tercapai.
- **Tests**: `tests/modules/notification/WhatsAppAccountService.test.ts` (4 test baru untuk `testConnection`: tenant guard, sukses, gagal, exception), `tests/api/admin-whatsapp-stats-route.test.ts` (3 test baru untuk IDOR guard)
- **Files**: `app/api/admin/whatsapp/stats/route.ts`, `modules/notification/services/whatsapp-account.service.ts`, `modules/notification/services/whatsapp/providers/mpwa-provider.ts`, `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-07-11] — Fix Wablas token delivery via query param + FK WhatsAppMessage

- **Tipe**: [FIXED] [MIGRATION]
- **Scope**: `modules/notification/services/whatsapp/providers/wablas-provider.ts`, `prisma/schema.prisma`
- **Author**: agent
- **Deskripsi**: Dua fix dari laporan bug server live:
  - **[FIXED]** WablasProvider mengirim token via field form `api_key`,
    padahal Wablas hanya menerima token via query param `?token=`. Fix:
    pindah token dari form body ke query param di `buildUrl()`. Tanpa ini,
    semua request ke Wablas (send-message, send-document) gagal dengan
    "token invalid" meski token di DB valid dan device connected.
  - **[FIXED]** Hapus akun WhatsApp gagal dengan FK constraint violation
    karena `WhatsAppMessage.accountId` NOT NULL dengan `onDelete:
    Restrict`. Fix: ubah `accountId` jadi nullable + `onDelete: SetNull`
    agar pesan history tetap ada sebagai audit log saat akun dihapus.
- **Migration**: `20260711130000_make_whatsapp_message_account_id_nullable`
- **Files**: `modules/notification/services/whatsapp/providers/wablas-provider.ts`,
  `modules/notification/domain/whatsapp-message.entity.ts`,
  `prisma/schema.prisma`
- **Breaking**: ❌ Tidak

### [2026-07-11] — Konsolidasi sistem WhatsApp menjadi single source of truth

- **Tipe**: [CHANGED] [REMOVED]
- **Scope**: `modules/notification`, `modules/settings`, `modules/pelanggan`, `app/api/admin/settings/whatsapp`
- **Author**: agent
- **Deskripsi**: Konsolidasi dua sistem WhatsApp paralel menjadi satu SOT di
  tabel `WhatsAppAccount`. Semua pengiriman pesan WhatsApp (notifikasi
  billing, reply ticket support, approval, broadcast, test) sekarang lewat
  `WhatsAppSenderService` yang membaca dari `WhatsAppAccount`. Sistem lama
  berbasis `Settings` key-value dihapus sepenuhnya.
  - **[CHANGED]** `NotificationDispatcher.sendWhatsApp()` dan
    `admin-support-ticket-reply.helpers.ts` dipindahkan dari `WhatsAppService`
    ke `WhatsAppSenderService.send()` dengan auto-routing akun default.
  - **[CHANGED]** Script `migrate-whatsapp-settings.ts` di-refactor: hapus
    `as any`, extract helper terpisah (`loadSettingsMap`,
    `createAccountFromSettings`, `normalizeProvider`, `ensureEncrypted`),
    tambah log warning phone placeholder agar admin update via UI.
  - **[REMOVED]** `app/api/admin/settings/whatsapp/route.ts` (endpoint lama).
  - **[REMOVED]** `modules/settings/services/whatsappSettings.ts` (service
    Settings-based).
  - **[REMOVED]** `modules/notification/services/whatsapp/whatsapp-service.ts`
    (`WhatsAppService`).
  - **[REMOVED]** Export `WhatsAppService`, `WhatsAppSettingsUpdatePayload`,
    `getWhatsAppSettings`, `updateWhatsAppSettings`, `testWhatsAppSettings`
    dari public API modul.
- **Files**: `modules/notification/services/NotificationDispatcher.ts`,
  `modules/pelanggan/services/admin-support-ticket-reply.helpers.ts`,
  `scripts/migrate-whatsapp-settings.ts`, `modules/notification/index.ts`,
  `modules/settings/index.ts`
- **Breaking**: ✅ Ya — endpoint `GET/PUT/POST /api/admin/settings/whatsapp`
  dihapus; env var `FONNTE_API_KEY`/`WHATSAPP_PROVIDER` tidak lagi dipakai
  sebagai fallback. Admin wajib setup akun WhatsApp via UI
  `/admin/pengaturan/whatsapp` sebelum upgrade. Jalankan
  `npx tsx scripts/migrate-whatsapp-settings.ts` untuk migrasi data lama.

### [2026-07-11] — Fix testConnection WhatsApp kirim API key terenkripsi

- **Tipe**: [FIXED]
- **Scope**: `modules/notification/services/whatsapp-account.service.ts`
- **Author**: agent
- **Deskripsi**: `WhatsAppAccountService.testConnection()` mengirim
  `account.apiKey` langsung dari DB (masih terenkripsi) ke provider Wablas,
  sehingga Wablas menolak dengan "token is null". Root cause: komentar
  salah "Already decrypted by repository" padahal repository tidak
  mendekripsi. Fix: tambah `decryptApiKey(account.apiKey)` sebelum build
  config, sesuai pattern yang sudah benar di `WhatsAppSenderService.sendViaAccount()`.
- **Files**: `modules/notification/services/whatsapp-account.service.ts`
- **Breaking**: ❌ Tidak

### [2026-07-11] — PRD konsolidasi sistem WhatsApp menjadi single source of truth

- **Tipe**: [DOCS]
- **Scope**: `docs/specifications`
- **Author**: agent
- **Deskripsi**: Pembuatan PRD untuk konsolidasi dua sistem WhatsApp paralel
  (Settings-based legacy vs WhatsAppAccount multi-akun) menjadi satu SOT.
  Mencakup: migrasi caller `WhatsAppService` ke `WhatsAppSenderService`,
  migrasi data dari `Settings` ke `WhatsAppAccount`, penghapusan endpoint
  dan service legacy, acceptance criteria, dan rencana eksekusi 6 fase.
- **Files**: `docs/specifications/PRD-CONSOLIDATE-WHATSAPP-2026-07-11.md`
- **Breaking**: ❌ Tidak (PRD saja, eksekusi terpisah)

### [2026-07-10] — Bug fixes & refactor modul admin/investors

- **Tipe**: [FIXED] [CHANGED] [ADDED]
- **Scope**: `modules/investor`, `app/api/admin/investors`, `app/admin/investors`
- **Author**: agent
- **Deskripsi**: Perbaikan 10 bug & code smell pada modul investor admin:
  1. **[FIXED]** Deposits endpoint hanya kembalikan PENDING — ditambah support filter `?status=` sehingga filter UI (VERIFIED, COMPLETED, REJECTED) berfungsi.
  2. **[FIXED]** N+1 fetch profit shares (1 request per investor) — diganti dengan 1 endpoint global `GET /api/admin/investors/profit-shares`.
  3. **[FIXED]** Auto-fetch profit shares di render body (bukan useEffect) — diperbaiki dengan `useApi` hook yang reactive.
  4. **[FIXED]** Field typo `companies` → `perusahaan` di `ctx.validated` audit trail PUT investor.
  5. **[FIXED]** Email uniqueness tidak dicek saat `createInvestor` — guard ditambah di `InvestorAdminService`.
  6. **[FIXED]** Module-level service instantiation di `payouts/route.ts` dan `detail/route.ts` — diganti ke factory `getInvestorPayoutAdminService()`.
  7. **[FIXED]** Double-calculate profit share periode sama — ditambah guard `existsForInvestorPeriod` di repository + service.
  8. **[CHANGED]** Duplikasi tipe `Investor`/`DetailData` di client — dipindah ke `modules/investor/dto` sebagai `InvestorListItem`, `InvestorDetail`, `InvestorRabProjectItem`, `InvestorPayoutEntry`.
  9. **[CHANGED]** `InvestorsClient.tsx` god component (946 baris, 5 modal) — dipecah jadi `InvestorFormModal`, `InvestorDetailModal`, `PayoutModal`, `ConfirmModal` di `_components/`.
  10. **[CHANGED]** Duplikasi logika format tanggal hari ini — diganti dengan `formatForDateInput(new Date())` dari `lib/utils/datetime`.
  11. **[ADDED]** Endpoint `GET /api/admin/investors/profit-shares` (global list dengan opsional `?status=` filter).
- **Files**:
  - `modules/investor/repositories/InvestorDepositRepository.ts` — tambah `listAll()`
  - `modules/investor/repositories/InvestorProfitShareRepository.ts` — tambah `listAll()`, `existsForInvestorPeriod()`
  - `modules/investor/services/InvestorDepositService.ts` — tambah `listAllByTenant()`
  - `modules/investor/services/InvestorProfitShareService.ts` — tambah `listAllByTenant()`, guard duplikasi kalkulasi
  - `modules/investor/services/InvestorAdminService.ts` — tambah email uniqueness check saat create
  - `modules/investor/dto/index.ts` — tambah tipe `InvestorListItem`, `InvestorDetail`, `InvestorRabProjectItem`, `InvestorPayoutEntry`
  - `app/api/admin/investors/deposits/route.ts` — support `?status=` filter
  - `app/api/admin/investors/profit-shares/route.ts` — endpoint baru (GET global)
  - `app/api/admin/investors/[id]/payouts/route.ts` — factory pattern
  - `app/api/admin/investors/[id]/detail/route.ts` — factory pattern
  - `app/api/admin/investors/[id]/route.ts` — fix typo field audit trail
  - `app/admin/investors/InvestorsClient.tsx` — rewrite lean, gunakan sub-komponen
  - `app/admin/investors/_components/` — 4 file komponen baru
  - `app/admin/investors/deposits/DepositsClient.tsx` — pass `?status=` ke endpoint
  - `app/admin/investors/profit-shares/ProfitSharesClient.tsx` — pakai endpoint global
- **Breaking**: ❌ Tidak

### [2026-07-10] — Hardening & quality fixes admin/support tickets (Phase 1–5 PRD)

- **Tipe**: [SECURITY] [CHANGED] [FIXED] [MIGRATION]
- **Scope**: `app/admin/support`, `app/api/admin/support-tickets`, `modules/pelanggan`, `lib/utils`, `lib/api`, `lib/upload`, `prisma`
- **Author**: agent
- **Deskripsi**: Implementasi PRD `docs/reports/PRD_ADMIN_SUPPORT_FIXES_2026-07-10.md`
  Phase 1–5. Menutup 2 celah security Critical, menstandarkan permission check,
  menambah kolom rating, split file UI besar, dan backfill test coverage.
- **Breaking**: ❌ Tidak

  **Phase 1 — Security Critical**:
  - **[SECURITY]** Fix bypass tenancy di `app/api/admin/support-tickets/[id]/reply/route.ts`:
    `checkSiteRestriction(ctx.session as never, "support")` sebelumnya selalu return
    `isRestricted: false` karena `ctx.session.user` tidak punya `permissions` (disimpan
    terpisah di `ctx.permissions`). Admin dengan `support:site_only` bisa membalas tiket
    pelanggan di luar site-nya. Fix: inject `permissions` via helper baru
    `buildSessionWithPermissions` (`lib/api/build-session-with-permissions.ts`).
  - **[SECURITY]** Sanitasi attachment URL di `MessagesList.tsx` & `ReplyComposer.tsx`
    via `sanitizeAttachmentUrl` (`lib/utils/sanitize-attachment-url.ts`). Menetralisir
    `javascript:`, `data:`, `vbscript:`, `file:` ke `"#"` — cegah XSS via attachment link.
  - **[SECURITY]** Validasi magic-bytes di `SupportTicketUploadService` — sebelumnya
    hanya cek `file.type` (spoofable browser). Kini cek signature byte asli via
    `validateFileSignature` (`lib/utils/file-validation.ts`) yang di-extend untuk
    mendukung `gif` + `webp` (RIFF+WEBP). File EXE yang diklaim `image/png` ditolak
    dengan 400, bukan meledak di sharp.

  **Phase 2 — API Hardening**:
  - **[CHANGED]** 4 route (`route.ts`, `[id]/route.ts`, `[id]/reply/route.ts`,
    `unread-count/route.ts`) distandarkan ke `createHandler({ permissions })` —
    hapus manual `hasPermission()` yang duplikasi fetch permission.
  - **[CHANGED]** Reply route pakai Zod schema `supportTicketReplySchema`
    (`modules/pelanggan/validators/support-ticket.ts`) untuk body validation,
    `idSchema` untuk param, dan `ctx.validated` typed.
  - **[CHANGED]** Helper `buildSessionWithPermissions` di-share via `@/lib/api` export.
  - **[CHANGED]** `unread-count` route tambah `Cache-Control: private, max-age=30`
    untuk polling sidebar.
  - **[CHANGED]** `search` filter dibatasi `.max(200)` di `supportTicketFilterSchema`.

  **Phase 3 — Rating Column**:
  - **[MIGRATION]** `prisma/migrations/20260710120000_add_rating_to_support_ticket`:
    tambah kolom `rating Int?` + composite index `@@index([status, rating])` di
    `SupportTickets`. Applied via `prisma db push` (dev DB ada drift history).
  - **[CHANGED]** Wire `rating` through domain entity → DTO (list/detail) →
    mapper (`toDomain`/`toListItem`/`toDetail`) → repository interface +
    impl + prisma-helpers (`updateCustomerStatus`) → service
    (`SupportTicketService.closeCustomerTicket` persist `input.rating`).
  - **[CHANGED]** `admin-support-ticket-list.helpers.ts`: `calculateAverageRating`
    preferensi DB column `rating`, fallback ke emoji-scrape untuk tiket lama
    (anti double-count).
  - **[CHANGED]** Frontend `SupportContent.tsx`: `extractRating` baca `ticket.rating`
    dulu, fallback emoji.

  **Phase 4 — UX & Code Quality**:
  - **[FIXED]** `MessagesList.tsx`: auto-scroll hanya saat user near-bottom (threshold
    100px) atau first render — tidak lagi paksa jump ke bawah saat user baca history.
  - **[FIXED]** `CloseTicketModal.tsx`: reset state `resolution` saat cancel/confirm,
    tambah `maxLength={2000}`.
  - **[FIXED]** `TicketHeader.tsx`: filter opsi `CLOSED` dari dropdown status —
    close butuh konfirmasi via modal (tombol X), bukan dropdown langsung.
  - **[FIXED]** `CustomerInfoSidebar.tsx`: `encodeURIComponent` untuk `tel:` & `mailto:`;
    work-order draft via `sessionStorage` bukan URL query string (description panjang).
  - **[CHANGED]** `SupportContent.tsx` split dari 518 → 182 baris + 3 sub-komponen
    (`StatCard.tsx`, `FilterBar.tsx`, `TicketTable.tsx`) di `_components/`.
  - **[CHANGED]** Unifikasi dictionary status/priority/category di
    `app/admin/support/[id]/_components/types.ts` — hapus duplikasi antara list & detail.
  - **[FIXED]** `SupportDetailClient.tsx`: hapus `unwrapTicket` dead branch —
    API selalu return `TicketDetail` langsung.
  - **[FIXED]** `SupportContent.tsx`: clamp `page` saat `totalPages` berkurang.
  - **[CHANGED]** `useTicketActions.ts`: magic string `"RESOLVED"`/`"CLOSED"` →
    `TicketStatus` enum; hapus `void ticket` dead code; `sendClosingMessage`
    signature disederhanakan.

  **Phase 5 — Test Coverage**:
  - **[ADDED]** `tests/unit/sanitize-attachment-url.test.ts` (11 tests).
  - **[ADDED]** `tests/lib/file-validation.test.ts` (7 tests: JPEG/PNG/GIF/WEBP
    signatures, spoof rejection, empty allowedTypes).
  - **[ADDED]** `tests/lib/build-session-with-permissions.test.ts` (4 tests).
  - **[CHANGED]** `tests/modules/pelanggan/SupportTicketUploadService.test.ts`:
    tambah scenario spoofed MIME + 5MB limit (5 tests, dari 3).
  - **[ADDED]** `tests/api/admin/support-tickets/reply.test.ts` (6 tests:
    empty body, site_only scope pass, happy path, FORBIDDEN→403,
    VALIDATION_ERROR→400, NOT_FOUND→404).
  - Total: baseline 592 files / 3409 tests → **596 files / 3439 tests pass**,
    zero regression.

### [2026-07-09] — Refactor module admin/users end-to-end sesuai PRD

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/users`, `app/api/admin/users`, `modules/users`, `lib/permission-config.ts`, `modules/roles`
- **Author**: agent
- **Deskripsi**: Implementasi PRD `docs/specifications/admin-users-refactor-prd.md`
  mencakup 8 task logis untuk menghapus anti-pattern React, memperbaiki bug
  type-safety, memindahkan method ke service yang tepat, migrasi fetch ke
  TanStack Query, dan mengekstrak duplikasi UI. Detail per task:
  (1) **[FIXED]** Bug cast `overtimeCalcTypeNational` di `UserRepository.create`
  & `createWithSites` — sebelumnya di-cast ke `overtimeCalcTypeNormal` (copy-paste
  bug lolos compiler karena `as`). Ekstrak helper `mapUserEnumFields` untuk
  cegah duplikasi cast.
  (2) **[CHANGED]** Pindah `forceLogoutUser` dari `AdminUserRouteAdminUserPerformanceRouteService` ke
  `AdminUserRouteService` (correct ownership: force-logout = user-management,
  bukan performance metric). Tambah method `incrementTokenVersion` di
  `IUserRepository` + `UserRepository`. Route `/api/admin/users/[id]/force-logout`
  diupdate ke service yang benar.
  (3) **[SECURITY]** Tambah permission `users:force_logout` sebagai granular
  permission terpisah dari `users:update`. Sebelumnya UI & route memakai
  `users:update` sebagai alias — leak: admin edit user otomatis bisa force-logout.
  Ditambah di `GRANULAR_PERMISSIONS`, `RoleFactory` (default role admin),
  route API, dan UI `UserList.tsx`.
  (4) **[FIXED]** Hapus render-phase `setState` di `useUserList` (pola
  `if (prev !== curr) setState(...)` di render body — melanggar
  `react-hooks/set-state-in-effect`). Dipecah jadi 3 hook terfokus:
  `useUserFetch`, `useUserSelection`, `useUserMutations`. `useUserList` jadi
  orchestrator tipis.
  (5) **[CHANGED]** Migrasi fetch ke TanStack Query `useApi` sesuai
  `docs/standards/data-fetching.md`. `useUserFetch` memakai `useApi` dengan
  URL sebagai key → dedup, cache, dan abort otomatis saat filter berubah.
  `fetchAdminUserDetail` return `UserDetailDTO | null` (bukan `unknown`).
  (6) **[CHANGED]** Hapus type alias `UserData` di `UsersDetailClient.tsx`
  (mempertahankan duplikasi field `department`/`departments` & `site`/`sites`).
  Consumer langsung pakai `UserDetailDTO`.
  (7) **[CHANGED]** Ekstrak `<OrganizationSection>` dan `<StatusAndSalesSection>`
  ke `components/UserFormSections.tsx` — dipakai di `UsersNewClient` &
  `UsersDetailClient` untuk hapus ~200 LOC duplikasi.
  (8) **[FIXED]** `MultiSiteSelect.toggleSite` diubah jadi immutable (sebelumnya
  mutasi object langsung di array hasil filter → potensi bug subtle).
- **Files**:
  `modules/users/repositories/UserRepository.ts`,
  `modules/users/domain/ports/IUserRepository.ts`,
  `modules/users/services/AdminUserRouteService.ts`,
  `modules/users/services/AdminUserPerformanceRouteService.ts`,
  `app/api/admin/users/[id]/force-logout/route.ts`,
  `lib/permission-config.ts`,
  `modules/roles/factories/RoleFactory.ts`,
  `app/admin/users/UserList.tsx`,
  `app/admin/users/lib/useUserList.ts`,
  `app/admin/users/lib/useUserFetch.ts` (baru),
  `app/admin/users/lib/useUserSelection.ts` (baru),
  `app/admin/users/lib/useUserMutations.ts` (baru),
  `app/admin/users/lib/userDetailApi.ts`,
  `app/admin/users/[id]/UsersDetailClient.tsx`,
  `app/admin/users/new/UsersNewClient.tsx`,
  `app/admin/users/components/UserFormSections.tsx` (baru),
  `app/admin/users/components/MultiSiteSelect.tsx`,
  `docs/specifications/admin-users-refactor-prd.md` (baru)
- **Breaking**: ✅ Ya — permission `users:force_logout` terpisah. Admin yang
  sebelumnya hanya punya `users:update` TANPA `users:force_logout` akan
  kehilangan tombol & endpoint force-logout sampai seed permission dijalankan
  (`npm run prisma:seed`). Role admin baru otomatis dapat permission ini via
  `RoleFactory`.

### [2026-07-09] — Perbaiki domain purity dan minWidth kolom restock

- **Tipe**: [FIXED]
- **Scope**: `modules/map/domain`, `modules/map/utils`, `app/admin/inventory/restock`
- **Author**: agent
- **Deskripsi**: Dua kegagalan test diperbaiki: (1) `modules/map/domain/tenantContext.ts`
  melanggar domain purity test karena mengimpor `TenantContextError` dari `@/lib/prisma-extension`.
  Solusi: pindahkan file ke `modules/map/utils/tenantContext.ts` sehingga domain layer tetap
  bersih. Update semua importir (`MappingRepository`, `MappingService`, `MappingAdminService`,
  `IMappingRepository`, `modules/map/index.ts`). (2) Test `restock-table.test.tsx` gagal karena
  kolom "nomor" di `RestockTable` memiliki `minWidth: "14rem"` sedangkan test mengekspektasikan
  `"18rem"`. Diperbaiki dengan mengubah nilai tersebut.
- **Files**: `modules/map/utils/tenantContext.ts` (baru, pindahan dari `domain/`),
  `modules/map/domain/tenantContext.ts` (dihapus),
  `modules/map/domain/ports/IMappingRepository.ts`,
  `modules/map/repositories/MappingRepository.ts`,
  `modules/map/services/MappingService.ts`,
  `modules/map/services/MappingAdminService.ts`,
  `modules/map/index.ts`,
  `app/admin/inventory/restock/RestockTable.tsx`
- **Breaking**: ❌ Tidak

### [2026-07-09] — Tutup celah tenant isolasi menu restock

- **Tipe**: [SECURITY]
- **Scope**: `modules/inventory`, `app/api/inventory/restock`
- **Author**: agent
- **Deskripsi**: Tiga titik akses restock tidak memfilter `tenantId` saat
  mengambil record purchase request berdasarkan `id`, sehingga tenant A bisa
  membaca detail, approve/reject, serta trigger receive/start-shopping pada
  PR milik tenant B cukup dengan menebak ID. Diperbaiki dengan menyuntikkan
  `tenantId` dari session ke dalam query (`findUnique` → `findFirst` dengan
  filter `{ id, tenantId }`) di `getRestockRequestDetail`,
  `getPurchaseRequestForLifecycle`, dan `findPurchaseRequestProcessInfo`.
  Akses cross-tenant sekarang kembali 404.
- **Files**: `modules/inventory/services/RestockRequestService.ts`,
  `modules/inventory/services/RestockRequestLifecycleService.ts`,
  `modules/inventory/repositories/InventoryPurchaseRequestRepository.ts`,
  `modules/inventory/repositories/InventoryApiRepository.ts`,
  `modules/inventory/services/InventoryRouteService.ts`,
  `app/api/inventory/restock/requests/[id]/route.ts`,
  `app/api/inventory/restock/requests/[id]/receive/route.ts`,
  `app/api/inventory/restock/requests/[id]/process/route.ts`,
  `tests/api/inventory-restock-request-lifecycle-routes.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-09] — Refactor admin/map: 10 perbaikan code smell & security

- **Tipe**: [CHANGED]
- **Scope**: `modules/map`, `app/api/map`, `app/admin/map`, `lib/api/handler.ts`, `modules/users/services/UserService.ts`
- **Author**: agent
- **Deskripsi**: Refactor menyeluruh module map mengikuti Clean Architecture. 10 fix + 3 security hardening dari Oracle review:
  1. [SECURITY] Tenant isolation di semua repo reads/mutations (`buildTenantWhere`/`buildTenantContext`). Hardened: non-superadmin tanpa tenantId lempar `TenantContextError` (bukan bypass filter). `deleteNode` cascade edges kini filter tenant. `updateNode`/`updateEdge` kini atomic via `updateMany({ where: { nodeId, tenantId } })` — eliminasi TOCTOU.
  2. Hapus akses `prisma`+`bcrypt` dari `MappingAdminService`, delegasi ke `UserService.verifyUserPassword` via port `UserPasswordVerifier`.
  3. `throw new Error("NODE_NOT_FOUND"...)` → `NotFoundError`/`ValidationError`; hapus string-compare di routes; `AppError`→statusCode di `lib/api/handler.ts`.
  4. Hapus `as MapSettingsDTO` cast via `toSettingsDTORequired`.
  5. Fix N+1 `getNodeById` via `findEdgesByNode` (WHERE source OR target).
  6. Hapus dead code `MapModuleFactory.ts` + `MapServiceSingletons.ts`.
  7. SOT `nodeType.ts` (`CANONICAL_NODE_TYPES`/`SYNC_NODE_TYPES`/`NODE_TYPE_DEFAULTS`/`normalizeSyncType`).
  8. `z.any()` → `z.record(z.string(), z.unknown())` di node create schema.
  9. Import order `app/admin/map/page.tsx`.
  10. `MapSettings.updateSettings` thread `tenantId` dari ctx saat create row baru.
- **Files**: `modules/map/domain/ports/IMappingRepository.ts`, `modules/map/domain/tenantContext.ts` (new), `modules/map/domain/nodeType.ts` (new), `modules/map/repositories/MappingRepository.ts`, `modules/map/repositories/mapping-repository.helpers.ts`, `modules/map/services/MappingService.ts`, `modules/map/services/MappingAdminService.ts`, `modules/map/services/createMappingService.ts`, `modules/map/mappers/MapMapper.ts`, `modules/map/factories/MapFactory.ts`, `modules/map/utils/mapConstants.ts`, `modules/map/index.ts`, `app/api/map/*.ts`, `app/admin/map/page.tsx`, `lib/api/handler.ts`, `modules/users/services/UserService.ts`
- **Breaking**: ✅ Ya — `IMappingRepository` & `MappingService` signatures berubah (semua method butuh `TenantContext`).
- **Migration**: ❌ Tidak ada.

### [2026-07-09] — Perbaiki code smell module restock

- **Tipe**: [FIXED]
- **Scope**: `app/admin/inventory/restock`
- **Author**: agent
- **Deskripsi**: Memperbaiki `isVeryLowStock` yang false-positive saat `minStok` belum diset (0), sehingga badge "Critical Low" muncul tanpa dasar. Menghapus recompute `barangOptions` di dalam `formItems.map` pada `RestockFormModal` dan menggantinya dengan `useMemo` sekali per gudang. Menambahkan kolom/baris catatan di list restock agar konteks PO terlihat langsung, serta mewajibkan `Catatan / Keterangan` saat create/update restock di UI dan API.
- **Files**: `app/admin/inventory/restock/utils.ts`, `app/admin/inventory/restock/RestockFormModal.tsx`, `app/admin/inventory/restock/RestockTable.tsx`, `app/admin/inventory/restock/useRestockPage.ts`, `lib/validations/restock.ts`, `tests/ui/restock-utils.test.ts`, `tests/ui/restock-table.test.tsx`, `tests/ui/restock-form-modal.test.tsx`, `tests/api/inventory-restock-request-lifecycle-routes.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-09] — Perketat otorisasi & error handling announcement

- **Tipe**: [SECURITY]
- **Scope**: `app/api/announcements`, `modules/notification`, `app/admin/announcement`
- **Author**: agent
- **Deskripsi**: Memperketat otorisasi `GET /api/announcements` untuk query `portal=admin` berdasarkan session (sebelumnya mempercayai layout-level guard sehingga user biasa bisa memalsukan `?portal=admin`). Menambahkan 404 handling pada `PUT`/`DELETE /api/announcements/[id]` via existence check di service. Menambah guard `AnnouncementForm` agar mode edit tanpa `initialData.id` gagal jelas. Melokalkan label target di tabel admin ke Bahasa Indonesia tanpa mengubah API contract.
- **Files**: `app/api/announcements/route.ts`, `app/api/announcements/[id]/route.ts`, `modules/notification/services/AnnouncementService.ts`, `app/admin/announcement/_components/AnnouncementForm.tsx`, `app/admin/announcement/AnnouncementIndexClient.tsx`, `tests/api/announcements-route.test.ts`, `tests/api/announcements-get-portal-auth.test.ts`, `tests/modules/notification/AnnouncementService.crud.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-08] — Perbaiki live map kehadiran

- **Tipe**: [FIXED]
- **Scope**: `app/admin/kehadiran/live-map`, `app/api/admin/location/live`, `components/attendance`
- **Author**: agent
- **Deskripsi**: Memperbaiki response error 403 live tracking agar tidak berubah menjadi 500, menghapus log koordinat GPS karyawan dari client logger, dan menyederhanakan refresh realtime tanpa `setTimeout`.
- **Files**: `app/api/admin/location/live/route.ts`, `app/admin/kehadiran/live-map/LiveMapClient.tsx`, `components/attendance/EmployeeLocationMap.tsx`, `tests/api/admin-location-live-route.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-08] — Tambah komisi settlement reseller

- **Tipe**: [MIGRATION]
- **Scope**: `modules/reseller`, `app/api/admin/resellers`, `app/admin/resellers`, `prisma/`
- **Author**: agent
- **Deskripsi**: Menambahkan Phase 3/4 reseller berupa model aturan komisi, ledger komisi, settlement, accrual komisi dari event invoice paid, endpoint pricing/komisi/settlement, serta ringkasan pricing dan komisi di UI admin reseller.
- **Files**: `prisma/schema.prisma`, `modules/reseller`, `app/api/admin/resellers/[id]/package-prices/route.ts`, `app/api/admin/resellers/[id]/commissions/route.ts`, `app/api/admin/resellers/[id]/settlements/route.ts`, `app/admin/resellers/ResellersClient.tsx`, `lib/event-bus/event-handlers.ts`
- **Migration**: `20260708090000_add_reseller_commission_settlement`
- **Breaking**: ❌ Tidak

### [2026-07-08] — Tambah UI admin reseller

- **Tipe**: [ADDED]
- **Scope**: `app/admin/resellers`, `app/admin/pelanggan/ppp`, `lib/menu-config.ts`
- **Author**: agent
- **Deskripsi**: Menambahkan menu dan halaman admin reseller untuk CRUD reseller/outlet, serta assignment reseller/outlet di form create/edit pelanggan PPP agar relasi reseller bisa dikirim ke API.
- **Files**: `app/admin/resellers/page.tsx`, `app/admin/resellers/ResellersClient.tsx`, `app/admin/pelanggan/ppp/components/info/PppClientInfoTabSection.tsx`, `app/admin/pelanggan/ppp/create/PppNewClient.tsx`, `app/admin/pelanggan/ppp/[id]/edit/PppEditClient.tsx`, `app/api/pelanggan-ppp/route.ts`, `app/api/pelanggan-ppp/[id]/route-handlers-impl.ts`, `lib/menu-config.ts`
- **Breaking**: ❌ Tidak

### [2026-07-08] — Tambah fondasi reseller

- **Tipe**: [ADDED]
- **Scope**: `modules/reseller`, `app/api/admin/resellers`, `prisma/`
- **Author**: agent
- **Deskripsi**: Menambahkan fondasi modul reseller Phase 1: schema reseller/outlet/harga reseller, service dan repository Clean Architecture, validasi relasi pelanggan-reseller, API admin CRUD reseller/outlet, permission `reseller`, dan feature flag reseller.
- **Files**: `modules/reseller`, `app/api/admin/resellers`, `modules/pelanggan/services/pelanggan-service.helpers.ts`, `modules/pelanggan/services/PelangganAdminMutationService.ts`, `lib/permission-config.ts`, `lib/feature-modules.ts`, `prisma/schema.prisma`
- **Migration**: `20260708050000_add_reseller_foundation`
- **Breaking**: ❌ Tidak

### [2026-07-07] — Refactor frontend Mitra ke TanStack Query + RHF/Zod

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/mitra`, `lib/validations`
- **Author**: agent
- **Deskripsi**: Migrasi data fetching dari manual `useState + useEffect + fetch` ke TanStack Query (`useQuery`, `keepPreviousData`, `queryClient.invalidateQueries`, `signal` abort) untuk list mitra, sites, dan mixradius owners. Migrasi form add/edit dari manual `useState<MitraFormState>` ke React Hook Form + Zod resolver dengan adapter schema di `lib/validations/mitraFormAdapter.ts`. Seluruh behavior, styling, toast, pagination, filtering, upload gambar, dan kontrak API dipertahankan. Hooks mutasi (`useMitraFormActions`, `useMitraDeleteAction`, `useMitraWalletActions`, face verification) melakukan invalidation melalui `queryClient.invalidateQueries`.
- **Files**: `app/admin/mitra/MitraListClient.tsx`, `app/admin/mitra/hooks/useMitraList.ts`, `app/admin/mitra/hooks/useMitraFormActions.ts`, `app/admin/mitra/components/MitraFormModal.tsx`, `app/admin/mitra/components/MitraFormFields.tsx`, `app/admin/mitra/components/MitraFormIdentitySection.tsx`, `app/admin/mitra/components/MitraFormJobSection.tsx`, `app/admin/mitra/components/MitraFormBankGaransiSection.tsx`, `app/admin/mitra/components/MitraFormShared.tsx`, `lib/validations/mitraFormAdapter.ts`
- **Breaking**: ❌ Tidak

### [2026-07-07] — Fix route aksi withdraw mitra

- **Tipe**: [FIXED]
- **Scope**: `modules/mitra`, `app/api/admin/mitra`
- **Author**: agent
- **Deskripsi**: Menambahkan delegasi aksi withdrawal di service mitra dan merapikan route withdrawals serta sync commissions agar memakai pola Result wrapper tanpa mengubah kontrak API.
- **Files**: `modules/mitra/services/MitraWithdrawService.ts`, `app/api/admin/mitra/withdrawals/[id]/route.ts`, `app/api/admin/mitra/sync-commissions/route.ts`
- **Breaking**: ❌ Tidak

### [2026-07-07] — Extract guard mitra admin

- **Tipe**: [CHANGED]
- **Scope**: `app/api/admin/mitra/[id]`, `lib/api`, `modules/mitra`
- **Author**: agent
- **Deskripsi**: Memindahkan guard scope mitra/site ke helper bersama dan membungkus broadcast refresh profil mitra dalam side-effect service agar route detail mitra tetap tipis tanpa mengubah kontrak API.
- **Files**: `lib/api/guards.ts`, `modules/mitra/services/mitra-side-effects.ts`, `app/api/admin/mitra/[id]/route.ts`
- **Breaking**: ❌ Tidak

### [2026-07-07] — Refactor laporan kehadiran admin

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/kehadiran/laporan`
- **Author**: agent
- **Deskripsi**: Memecah `ReportClient` menjadi komponen filter, summary, chart, breakdown, dan rekap karyawan yang lebih fokus, memindahkan state mutation dari render ke `useEffect`, serta mengganti sorting rekap karyawan dari type assertion ke accessor bertipe aman tanpa mengubah behavior laporan.
- **Files**: `app/admin/kehadiran/laporan/ReportClient.tsx`, `app/admin/kehadiran/laporan/ReportFilters.tsx`, `app/admin/kehadiran/laporan/AttendanceSummaryCards.tsx`, `app/admin/kehadiran/laporan/AttendanceTrendChart.tsx`, `app/admin/kehadiran/laporan/OvertimeTrendChart.tsx`, `app/admin/kehadiran/laporan/PerformanceTable.tsx`, `app/admin/kehadiran/laporan/EmployeeRecapTable.tsx`, `app/admin/kehadiran/laporan/RateLimitWarning.tsx`, `app/admin/kehadiran/laporan/ReportTabNavigation.tsx`, `app/admin/kehadiran/laporan/useReportChartRegistration.ts`, `app/admin/kehadiran/laporan/types.ts`
- **Breaking**: ❌ Tidak

### [2026-07-07] — Normalisasi dan format nomor telepon karyawan

- **Tipe**: [FIXED]
- **Scope**: `lib/utils/phone.ts`, `modules/users/validators/user.ts`, `app/admin/users/`
- **Author**: agent
- **Deskripsi**: Menambahkan normalisasi nomor telepon Indonesia (konversi ke format 62xxxxx) dan format tampilan konsisten (+62 xxx-xxxx-xxxx) untuk menu admin/users. Data lama tidak diubah (aman untuk production).
- **Files**: `lib/utils/phone.ts`, `modules/users/validators/user.ts`, `app/admin/users/lib/userColumns.tsx`, `app/admin/users/[id]/UsersDetailClient.tsx`, `app/admin/users/[id]/UsersDetailView.tsx`, `app/admin/users/new/UsersNewClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-07-07] — Fix test koneksi R2 public URL

- **Tipe**: [FIXED]
- **Scope**: `app/admin/pengaturan/api`
- **Author**: agent
- **Deskripsi**: Memastikan payload test koneksi Cloudflare R2 dari halaman pengaturan API menyertakan `r2PublicUrl`, sesuai kontrak endpoint dan service test R2 yang sudah mendukung public URL.
- **Files**: `app/admin/pengaturan/api/lib/apiSettingsApi.ts`, `app/admin/pengaturan/api/lib/useApiSettings.ts`
- **Breaking**: ❌ Tidak

### [2026-07-07] — Harden email dan WhatsApp settings

- **Tipe**: [FIXED]
- **Scope**: `app/admin/pengaturan`, `app/api/admin/settings/email`, `app/api/admin/whatsapp/accounts`, `modules/notification`
- **Author**: agent
- **Deskripsi**: Memperbaiki keamanan dan UX konfigurasi Email dengan masking password SMTP, feedback inline, input email test tanpa prompt/alert, validasi Zod di API boundary, mencegah payload numeric `NaN` pada form akun WhatsApp, serta memperketat tenant ownership untuk aksi detail akun WhatsApp agar tenant tidak bisa membaca, mengubah, menghapus, set default, atau test akun tenant lain.
- **Files**: `app/admin/pengaturan/email/EmailSettingsClient.tsx`, `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`, `app/api/admin/settings/email/route.ts`, `app/api/admin/whatsapp/accounts/[id]/route.ts`, `app/api/admin/whatsapp/accounts/[id]/test/route.ts`, `modules/notification/services/whatsapp-account.service.ts`, `tests/modules/notification/WhatsAppAccountService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-07] — Fix tenant isolation payment gateway

- **Tipe**: [FIXED]
- **Scope**: `app/api/admin/payment-gateway`, `app/api/customer/payment-methods`, `modules/finance`, `modules/payment-gateway`
- **Author**: agent
- **Deskripsi**: Memperbaiki isolasi tenant untuk konfigurasi payment gateway, pemilihan provider aktif saat create payment, dan daftar metode pembayaran customer agar selalu memakai `tenantId` request, bukan query global lintas tenant.
- **Files**: `app/api/admin/payment-gateway/configs/route.ts`, `app/api/customer/payment-methods/route.ts`, `modules/finance/repositories/PaymentGatewayConfigRepository.ts`, `modules/finance/repositories/CompanyBankAccountRepository.ts`, `modules/finance/services/PaymentGatewayConfigService.ts`, `modules/finance/services/CustomerPaymentMethodService.ts`, `modules/payment-gateway/services/PaymentGatewayService.ts`, `tests/payment-gateway/unit/PaymentGatewayService.test.ts`, `tests/modules/finance/CustomerPaymentMethodService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-07] — Refactor payment gateway settings UI

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/pengaturan/payment-gateway`
- **Author**: agent
- **Deskripsi**: Memecah konfigurasi modal payment gateway dari tab utama agar komponen lebih fokus, lebih mudah direview, dan tetap mempertahankan alur konfigurasi/test koneksi provider.
- **Files**: `app/admin/pengaturan/payment-gateway/components/PaymentGatewayTab.tsx`, `app/admin/pengaturan/payment-gateway/components/PaymentGatewayConfigModal.tsx`, `app/admin/pengaturan/payment-gateway/hooks/usePaymentGatewayConfigs.ts`
- **Breaking**: ❌ Tidak

### [2026-07-07] — Fix robust WhatsApp gateway delivery

- **Tipe**: [FIXED]
- **Scope**: `modules/notification`
- **Author**: agent
- **Deskripsi**: Memperbaiki pengiriman WhatsApp gateway agar nomor tujuan dinormalisasi konsisten, provider tanpa dukungan file tidak menyebabkan runtime crash, daily limit di-reset sebelum account routing, dan response non-JSON dari Fonnte/Wablas/MPWA menghasilkan error detail dengan status serta preview response.
- **Files**: `modules/notification/services/whatsapp-sender.service.ts`, `modules/notification/services/whatsapp-account-routing.service.ts`, `modules/notification/services/whatsapp-provider-send.service.ts`, `modules/notification/services/whatsapp/whatsapp-gateway-utils.ts`, `modules/notification/services/whatsapp/providers/fonnte-provider.ts`, `modules/notification/services/whatsapp/providers/wablas-provider.ts`, `modules/notification/services/whatsapp/providers/mpwa-provider.ts`, `tests/whatsapp-gateway.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-06] — Fix toleransi keterlambatan absensi per tenant

- **Tipe**: [FIXED]
- **Scope**: `modules/attendance`
- **Author**: agent
- **Deskripsi**: Memperbaiki perhitungan status check-in agar `GENERAL_ATTENDANCE_TOLERANCE` dibaca sesuai `tenantId`, bukan selalu memakai setting global/default. Jalur check-in normal sekarang meneruskan tenant ke kalkulasi status sehingga toleransi keterlambatan berbeda per tenant bekerja konsisten.
- **Files**: `modules/attendance/services/AttendanceTimezoneService.ts`, `modules/attendance/services/attendance-service-helpers.ts`, `modules/attendance/services/AttendanceMutationService.ts`, `tests/modules/attendance/AttendanceTimezoneService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-07-06] — Fixed attendance check-in error logging, detail waktu, dan checkInWindow di status endpoint

- **Tipe**: [FIXED]
- **Scope**: `modules/attendance`, `app/api/mobile/attendance`
- **Author**: agent
- **Deskripsi**: 
  1. Memperbaiki error logging check-in — sekarang error throw `AttendanceValidationError` dengan detail lengkap (checkInTime, windowStart, windowEnd) menggantikan `Error(CHECKIN_REJECTED:...)` yang kehilangan konteks.
  2. Menambahkan field `checkInWindow` di response `GET /api/mobile/attendance/status` agar mobile app bisa disable button check-in + tampilkan keterangan saat di luar jam kerja (canCheckIn, windowStart, windowEnd, message).
- **Files**: 
  - `modules/attendance/domain/errors.ts` (NEW)
  - `modules/attendance/services/AttendanceMutationService.ts`
  - `modules/attendance/services/MobileAttendanceCheckInRouteService.ts`
  - `modules/attendance/services/AttendanceValidationService.ts`
  - `modules/attendance/services/MobileAttendanceCheckInTypes.ts`
  - `app/api/mobile/attendance/status/route.ts`
  - `modules/attendance/index.ts`
- **Breaking**: ❌ Tidak

### [2026-07-06] — Fixed mobile work order error logging dan structured error responses

- **Tipe**: [FIXED]
- **Scope**: `modules/work-order`, `app/api/mobile/work-orders/available`
- **Author**: agent
- **Deskripsi**: Memperbaiki logging dan error handling untuk mobile work order claim endpoint yang menyebabkan debugging sangat sulit. Sebelumnya, validation errors tidak ter-log dengan detail dan user tidak mendapat error message yang informatif. Sekarang semua error memiliki error code yang spesifik (ALREADY_CLAIMED, MAX_LIMIT_REACHED, NOT_AVAILABLE, etc.) dan detail context untuk debugging.
- **Files**: 
  - `modules/work-order/domain/errors.ts` (NEW)
  - `modules/work-order/services/MobileAvailableWorkOrderService.ts`
  - `app/api/mobile/work-orders/available/route.ts`
- **Breaking**: ❌ Tidak
- **Details**:
  - Menambahkan custom error class `WorkOrderValidationError` dengan error codes spesifik
  - Menambahkan double-claim detection: user yang sudah claim WO akan dapat error ALREADY_CLAIMED dengan timestamp kapan dia claim
  - Refactor service layer untuk throw errors instead of returning Response objects (clean architecture pattern)
  - Menambahkan detailed error logging di API route dengan context lengkap (userId, workOrderId, error code, timestamp)
  - Structured error response untuk mobile app dengan error code dan details yang bisa di-handle secara spesifik
  - Fixes bug report: "Mobile API Error 400 - Work Order Management" tanggal 2026-07-06

### [2026-07-03] — Hotfix P0: Fitur lembur 500 error + P2: event tanpa handler + P3: FCM cron

- **Tipe**: [FIXED]
- **Scope**: `modules/overtime/repositories`, `lib/event-bus/event-handlers.ts`, `lib/realtime/contracts.ts`, `cron/entrypoint.sh`
- **Author**: agent
- **Deskripsi**: Tiga perbaikan sekaligus:
  1. **P0 (Kritis)**: `prisma.overtime.create()` throw `PrismaClientValidationError` karena `toCreateData()` mengirim payload campuran antara relational form (`user: { connect }`) dan scalar `tenantId` yang disuntik oleh middleware `withTenantIsolation`. Prisma menolak XOR violation ini. Fix: gunakan `OvertimeUncheckedCreateInput` dengan `userId` + `tenantId` sebagai scalar agar konsisten.
  2. **P2 (Medium)**: Event `workorder:updated` dan `attendance:checkout` di-emit tapi tidak ada handler terdaftar. Tambah handler `WORK_ORDER_UPDATED` (socket realtime) dan `ATTENDANCE_CHECKOUT` (Firebase Realtime publish). Tambah type `"attendance.checkout"` ke `RealtimeEventType`.
  3. **P3 (Minor)**: Endpoint `/api/cron/cleanup-stale-fcm-tokens` sudah ada tapi belum dijadwalkan di `cron/entrypoint.sh`. Tambah schedule harian jam 02:00.
- **Files**: `modules/overtime/repositories/OvertimeRepository.helpers.ts`, `lib/event-bus/event-handlers.ts`, `lib/realtime/contracts.ts`, `cron/entrypoint.sh`
- **Breaking**: ❌ Tidak

### [2026-06-27] — Fix deploy-prod.sh selalu gagal di promotion ke-2 (ff-only vs divergent main)

- **Tipe**: [INFRA]
- **Scope**: `deploy-prod.sh`
- **Author**: agent
- **Deskripsi**: Script `deploy-prod.sh:103` pakai `git merge --ff-only
  origin/staging`, padahal history project mengikuti pola merge commit
  (`--no-ff`). Setiap promotion sebelumnya menghasilkan merge commit baru di
  `main` yang tidak ada di `staging` → `main` selalu divergen dari `staging`
  setelah promotion pertama → `--ff-only` PASTI gagal dengan error
  "Not possible to fast-forward, aborting." di promotion ke-2 dan
  seterusnya. Fix: ganti jadi `git merge --no-ff origin/staging` dengan
  pesan commit konsisten dengan history ("chore: merge staging to main
  for production deployment"). Sekarang `./deploy-prod.sh` jalan
  end-to-end tanpa intervensi manual untuk semua promotion berikutnya.
- **Files**: `deploy-prod.sh`
- **Breaking**: ❌ Tidak

### [2026-06-27] — Fix HTTP 500 "Verifikasi Barang Sampai" — purchaseOrder.create reject `tenant: { connect }`

- **Tipe**: [FIXED]
- **Scope**: `lib/prisma-extension.ts`
- **Author**: agent
- **Deskripsi**: PATCH `/api/inventory/restock/requests/{id}/receive` gagal 500
  saat auto-generate PO dari PR. Prisma menolak payload dengan error
  `Unknown argument 'tenant'. Did you mean 'tenantId'?`. Root cause:
  middleware tenant-isolation di `prisma-extension.ts` membungkus payload jadi
  `tenant: { connect: { id } }` ketika `hasRelationPayload(data)` true
  (yaitu ada nested `items.create` / `purchaseRequests.connect`). Bentuk
  relational ini bergantung pada nama relasi `tenant` di Prisma Client
  generated — kalau client di image production di-build sebelum relasi
  tersebut ada di schema (drift), payload ditolak. Padahal `tenantId`
  skalar bekerja di semua versi Prisma Client dan tidak konflik dengan
  nested relations lain. Fix: hapus cabang `hasRelationPayload`, selalu
  pakai `tenantId` skalar pada injeksi `create` dan `upsert.create`.
  Side-effect positif: kode imun terhadap drift Prisma Client di
  build pipeline.
- **Files**: `lib/prisma-extension.ts` (hapus fungsi `hasRelationPayload`;
  sederhanakan `applyTenantToCreateData`, cabang `create` non-isolated, dan
  cabang `upsert.create` non-isolated)
- **Verifikasi**: `tests/lib/prisma-extension-tenant-context-alias.test.ts`
  (5 tests) + `tests/lib/api-handler-mobile-auth.test.ts` (7 tests) PASS;
  `tsc --noEmit` & `eslint` clean.
- **Breaking**: ❌ Tidak

### [2026-06-27] — Fix flaky test admin-attendance-bulk-delete-route (timeout di Jenkins)

- **Tipe**: [FIXED]
- **Scope**: `tests/api/admin-attendance-bulk-delete-route.test.ts`
- **Author**: agent
- **Deskripsi**: Test pertama (`returns 400 for malformed JSON...`) timeout di
  30s di Jenkins build #134, menyebabkan pipeline production deploy GAGAL.
  Root cause: file ini punya 11 `await import("@/app/api/admin/attendance/route")`
  dinamis di dalam test body. Di Jenkins di bawah load tinggi (build #134 total
  import phase 2543s vs #133 1693s), masing-masing dynamic import bisa makan
  >5s untuk transform/eval, melewati budget 30s test pertama. Lokal pass dalam
  4-5s. Fix: naikkan timeout describe block ke 60s, biar masih lewat di Jenkins
  load tinggi tanpa mengendurkan budget global test lain.
- **Files**: `tests/api/admin-attendance-bulk-delete-route.test.ts`
  (tambah `{ timeout: 60000 }` ke describe + komentar penjelas root cause)
- **Breaking**: ❌ Tidak — perubahan test config saja, tidak menyentuh logic.

### [2026-06-27] — Fix backend filter Isolir mencampurkan Disabled-Users (semantik mapping salah)

- **Tipe**: [FIXED]
- **Scope**: `modules/integrations/services/mixradius-customer-filters.ts`,
  `mobile-netmanager/app/(app)/mixradius/isolir.tsx`
- **Author**: agent
- **Deskripsi**: Status MixRadius punya mapping definitif (sesuai dropdown admin):
  Aktif=Enabled-Users, Non-Aktif=Disabled-Users, **Isolir=Expired** (`expired_on < now`
  walaupun `auth_status` masih `Enabled-Users`). Backend `filterByAuthStatus` salah
  menerjemahkan `authStatus=Isolir` jadi `Expired OR Disabled-Users`, mencampurkan
  dua status semantik berbeda. Akibat di mobile: defensive filter
  `!== "Disabled-Users"` di mobile UI membuang sebagian hasil (semua row yang
  auth_status-nya Disabled-Users) yang seharusnya bukan kategori Isolir tapi terlanjur
  ikut keluar. Walaupun pada kasus DEPOK aktual semua 158 row adalah Enabled-Users+Expired
  (tidak terdampak filter mobile), pencampuran ini tetap salah karena untuk group lain
  bisa tampil customer Disabled-Users sebagai "Isolir" di mobile. Fix: backend dibersihkan
  (`Isolir = isExpiredCustomer only`), defensive filter mobile dipertahankan dengan
  komentar penjelas (legacy guard sampai semua client upgrade).
- **Files**: `modules/integrations/services/mixradius-customer-filters.ts`
  (buang `OR Disabled-Users` dari branch Isolir + hapus dead helper
  `isDisabledOrExpiredCustomer`), `mobile-netmanager/app/(app)/mixradius/isolir.tsx`
  (komentar penjelas defensive filter), `mobile-netmanager/__tests__/app/mixradius-isolir-work-order-request.test.tsx`
  (test regression: Disabled-Users tidak boleh muncul di tab Isolir, Expired muncul)
- **Breaking**: ❌ Tidak — semantik di-koreksi ke mapping yang benar; admin UI
  sudah punya label yang konsisten (Isolir = Expired) sehingga klien admin tidak
  terpengaruh perubahan ini.

### [2026-06-27] — Perbaiki UX SearchableSelect di modal Restock (label terpotong + pencarian by kode/ID)

- **Tipe**: [FIXED]
- **Scope**: `components/ui/SearchableSelect`, `app/admin/inventory/restock`
- **Author**: agent
- **Deskripsi**: Tiga perbaikan UX pada modal Buat Pengajuan Restock (`/admin/inventory/restock`):
  1. **Label nama barang terpotong** → hapus class `truncate` pada label utama (trigger & item dropdown), ganti dengan `leading-snug break-words` + `title` attribute → nama wrap multi-baris dengan tooltip hover.
  2. **Dropdown terlalu sempit** → tambah `min-w-[320px]` pada container dropdown agar tetap lebar ketika trigger berada di kolom flex sempit.
  3. **Pencarian by kode/ID barang gak nemu** → akar masalah: filter "Stok Minim" (default ON) menyaring dataset di parent sebelum diserahkan ke `SearchableSelect`, sehingga barang stok normal tidak pernah ada di pool pencarian. Fix: tambah prop `onSearchChange` pada `SearchableSelect`, di parent (`RestockFormModal`) auto-disable filter "Stok Minim" begitu user mulai mengetik query. Bonus: tambah normalisasi alphanumeric pada matcher agar `BRG-653-459399` / `brg 653 459399` tetap match `BRG653459399`.
- **Files**: `components/ui/SearchableSelect.tsx`, `app/admin/inventory/restock/RestockFormModal.tsx`
- **Breaking**: ❌ Tidak — prop baru `onSearchChange` opsional, perilaku eksisting tidak berubah untuk pemakai lain

### [2026-06-27] — Fix FreeRADIUS staging build error dengan fallback ke official Docker Hub image

- **Tipe**: [INFRA]
- **Scope**: `radius/Dockerfile`, `infra/k8s`
- **Author**: agent
- **Deskripsi**: Build Docker image `netmanager-radius` gagal karena base image `ghcr.io/hadiahterlupakan/freeradius-server:3.2.5` tidak ada di registry GHCR. Fix: ganti ke official `freeradius/freeradius-server:3.2.5` dari Docker Hub, tambahkan `postgresql-client` ke dependencies untuk troubleshooting, dan tambahkan `Dockerfile.base` untuk future mirror setup ke GHCR (opsional).
- **Files**: `radius/Dockerfile`, `radius/Dockerfile.base`
- **Breaking**: ❌ Tidak — hanya infra change, tidak ada perubahan runtime behavior

### [2026-06-26] — Fix mobile auth tidak expose siteIds untuk multi-site user

- **Tipe**: [FIXED]
- **Scope**: `lib/mobile-auth`, `lib/api/handler`
- **Author**: agent
- **Deskripsi**: Mobile Bearer token verification hanya query `User.siteId` (legacy singular), tidak query table `userSites`. Akibatnya `getUserSiteIds()` fallback ke array 1 elemen → karyawan dengan 2+ sites hanya bisa melihat data dari 1 site di menu MixRadius Isolir. Fix: query `userSites` di `verifyValidatedMobileToken`, expose `siteIds[]` di `MobileTokenPayload`, dan pass ke `ctx.session.user`. Juga fix web session path di handler yang kehilangan `siteIds`.
- **Files**: `lib/mobile-auth.ts`, `lib/api/handler.ts`, `tests/api/mobile-mixradius-customers-route.test.ts`, `tests/api/mobile-mixradius-groups-route.test.ts`
- **Breaking**: ❌ Tidak

### [2026-06-26] — Tambah kolom shareloc ke Canvasing untuk link lokasi mobile

- **Tipe**: [ADDED]
- **Scope**: `modules/marketing`, `prisma/schema.prisma`
- **Author**: agent
- **Deskripsi**: Mobile app mengirim field `shareloc` (link Google Maps lokasi prospek) saat create canvasing, tapi `createCanvasingSchema` menggunakan `.strict()` sehingga menolak key tersebut dan return error `Unrecognized key: "shareloc"`. Database juga tidak punya kolom ini. Solusi: tambah kolom `shareloc TEXT` ke model Canvasing, extend create/update Zod schema, domain entity, repository input interface, mapper (Prisma→entity dan entity→DTO), dan `CanvasingDetailDTO`.
- **Files**: `prisma/schema.prisma`, `modules/marketing/domain/entities/CanvasingEntity.ts`, `modules/marketing/domain/ports/ICanvasingRepository.ts`, `modules/marketing/validators/canvasingValidation.ts`, `modules/marketing/mappers/marketing-canvasing.mapper.ts`, `modules/marketing/mappers/marketing-canvasing.mapper.dto.ts`, `modules/marketing/dto/MarketingDTO.ts`, `tests/modules/marketing/MarketingMapper.test.ts`
- **Migration**: `20260626000000_add_shareloc_to_canvasing` (`ALTER TABLE "canvasing" ADD COLUMN "shareloc" TEXT`)
- **Breaking**: ❌ Tidak

> Perubahan yang sudah dikerjakan tapi belum di-tag sebagai release.

<!-- Entry baru ditambah DI SINI, di bawah [Unreleased] -->

### [2026-06-26] — Preventif WorkOrder: tenantId NOT NULL, global unique number, dan distributed lock

- **Tipe**: [CHANGED]
- **Scope**: `modules/work-order`, `prisma/schema.prisma`, `lib/distributed-lock.ts`
- **Author**: agent
- **Deskripsi**: Implementasi 3 langkah preventif untuk mencegah insiden orphan WO (tanpa tenantId) dan duplikat workOrderNumber lintas tenant yang terjadi pada 12 April 2026:
  1. **tenantId NOT NULL** — semua 7 tabel WO (`work_orders`, `work_order_assignments`, `work_order_attachments`, `work_order_tasks`, `work_order_updates`, `work_order_materials`, `work_order_material_returns`) kini wajib punya tenantId di level DB. Backfill 306 child records dari parent WO. Relasi Prisma diubah dari `Tenant?` ke `Tenant`.
  2. **Global unique index** — `workOrderNumber` kini unik secara global (bukan per-tenant), mencegah duplikat lintas tenant. Orphan duplikat (24 WO, 14 child records) dibersihkan sebelum constraint ditambahkan.
  3. **Redis distributed lock** — operasi generate workOrderNumber kini dilindungi `acquireLock()` (`lib/distributed-lock.ts`) dengan ownership-based release via Lua script, mencegah race condition pada concurrent creation. Retry pattern tetap dipertahankan sebagai fallback.
- **Files**:
  - `prisma/schema.prisma` — 7 model WO: `tenantId String?` → `tenantId String`, relasi `Tenant?` → `Tenant`, tambah `@@unique([workOrderNumber])`
  - `modules/work-order/repositories/work-order-repository-create.ts` — integrasi distributed lock, `resolvePersistedTenantId` throw jika null, cast ke `UncheckedCreateInput`
  - `lib/distributed-lock.ts` — utility baru: `acquireLock()` dengan SET NX + Lua release
  - `modules/work-order/repositories/work-order-repository-activity.ts` — tambah `tenantId` ke semua create child records
  - `modules/work-order/repositories/MobileAvailableWorkOrderRepository.ts` — tambah `tenantId` ke claim assignment + update
  - `modules/work-order/repositories/WorkOrderActivityRepository.ts` — tambah `tenantId` ke addComment
  - `modules/work-order/repositories/WorkOrderScopedRepository.ts` — tambah `tenantId` ke addComment
  - `modules/work-order/repositories/WorkOrderMaterialRepository.ts` — tambah `tenantId` ke material + pickup update
  - `modules/work-order/services/work-order-mobile-material-return.ts` — `tenantId` required, fallback ke `workOrder.tenantId`
  - `modules/integrations/repositories/MixRadiusDismantleRepository.ts` — query WO untuk tenantId sebelum create tasks
  - `modules/work-order/repositories/WorkOrderSupportRepositories.ts` — tambah `tenantId` ke createManyTasks type
  - `modules/work-order/domain/ports/IWorkOrderAvailabilityRepository.ts` — tambah `tenantId` ke `CreateClaimUpdateData`
- **Migration**: `20260626000001_work_orders_global_unique_number`, `20260626000002_work_orders_tenant_id_not_null`
- **Breaking**: ✅ Ya — `tenantId` kini required di semua Prisma create calls untuk tabel WO

### [2026-06-26] — Mirror FreeRADIUS base image ke GHCR untuk hindari Docker Hub timeout

- **Tipe**: [INFRA]
- **Scope**: `radius`, `scripts`
- **Author**: agent
- **Deskripsi**: Build #720 gagal karena transient TLS handshake timeout saat pull `freeradius/freeradius-server:3.2.5` dari Docker Hub. Mirror base image ke GHCR (`ghcr.io/hadiahterlupakan/freeradius-server:3.2.5`) untuk menghindari Docker Hub rate limits dan network instability.
- **Files**:
  - `radius/Dockerfile`
  - `scripts/mirror-freeradius.sh`
- **Breaking**: ❌ Tidak

### [2026-06-25] — Fix FCM stale token cleanup dan tambah periodic cleanup

- **Tipe**: [FIXED]
- **Scope**: `modules/notification`, `lib/firebase`, `app/api/cron`
- **Author**: agent
- **Deskripsi**: Fix root cause tingkat kegagalan FCM ~75%: `clearPushTokens()` hanya bersihkan legacy `pushToken` tapi tidak menyentuh array `fcmTokens[]` sehingga stale token terus menumpuk. Tambah `clearFcmTokensFromArrays()`, pre-send filtering di `getAdminTokens()`, improved error logging, dan cron endpoint `/api/cron/cleanup-stale-fcm-tokens` untuk periodic cleanup harian.
- **Files**:
  - `modules/notification/repositories/PushTokenRepository.ts`
  - `modules/notification/services/MobileFcmTokenCleanupService.ts`
  - `modules/notification/domain/ports/IPushTokenRepository.ts`
  - `modules/notification/index.ts`
  - `lib/firebase/messaging.ts`
  - `app/api/cron/cleanup-stale-fcm-tokens/route.ts`
- **Breaking**: ❌ Tidak

### [2026-06-25] — Fix multi-site support pada menu isolir mobile

- **Tipe**: [FIXED]
- **Scope**: `app/api/mobile/mixradius`, `modules/integrations/services`
- **Author**: agent
- **Deskripsi**: Endpoint mobile MixRadius (groups & customers) hanya membaca `user.siteId` (single field) sehingga karyawan multi-site hanya bisa melihat pelanggan dari 1 site. Fix: gunakan `getUserSiteIds()` dari `modules/roles` yang query tabel `UserSite` (many-to-many) dengan fallback ke `user.siteId` untuk backward compatibility.
- **Files**:
  - `app/api/mobile/mixradius/groups/route.ts`
  - `app/api/mobile/mixradius/customers/route.ts`
  - `modules/integrations/services/MixRadiusGroupRouteService.ts`
  - `modules/integrations/services/mixradius-customer-filters.ts`
  - `modules/integrations/services/mixradius-types.ts`
- **Breaking**: ❌ Tidak

### [2026-06-25] — Fix BullMQ job ID tidak boleh mengandung karakter :

- **Tipe**: [FIXED]
- **Scope**: `modules/overtime`, `modules/finance`, `modules/attendance`
- **Author**: agent
- **Deskripsi**: Fix error "Custom Id cannot contain :" dari BullMQ saat rehydrate jobs di startup worker. Semua custom job ID yang menggunakan karakter `:` diganti dengan `.` agar sesuai dengan validasi BullMQ. Job ID yang diubah: overtime auto-checkout, billing schedule, dan attendance auto-checkout.
- **Files**: 
  - `modules/overtime/services/OvertimeAutoCheckoutRehydrationService.ts`
  - `modules/finance/services/BillingScheduleService.ts`
  - `modules/attendance/services/auto-checkout.helpers.ts`
- **Breaking**: ❌ Tidak

### [2026-06-25] — Fix tenantId tidak di-propagate ke work order events

- **Tipe**: [FIXED]
- **Scope**: `modules/work-order`, `modules/events`, `lib/event-bus`
- **Author**: agent
- **Deskripsi**: Fix bug dimana `tenantId` tidak di-propagate dari HTTP request context ke work order event payloads. Akibatnya, worker memproses event dalam "System context" dan FCM push ke admin di-skip karena dianggap cross-tenant leak. Semua work order events (created, assigned, updated, completed, activity) sekarang menyertakan `tenantId`.
- **Files**: 
  - `modules/events/dispatchers/WorkOrderEventDispatcher.ts`
  - `modules/work-order/services/work-order-side-effects.ts`
  - `modules/work-order/services/work-order-side-effects.helpers.ts`
  - `modules/work-order/services/work-order-mutation.helpers.ts`
  - `modules/work-order/services/WorkOrderMutationService.ts`
  - `modules/work-order/services/WorkOrderActivityService.ts`
  - `lib/event-bus/event-handlers.ts`
- **Breaking**: ❌ Tidak

### [2026-06-25] — Fix stok inventory bisa minus dari RTV handler

- **Tipe**: [FIXED]
- **Scope**: `modules/inventory`
- **Author**: agent
- **Deskripsi**: Handler `handleGoodsReturnSentInventory` hanya log warning jika stok tidak cukup untuk RTV (Return to Vendor), tapi tetap menjalankan decrement. Ini menyebabkan stok `BarangGudang` bisa minus. Fix: skip decrement dan log error jika stok tidak mencukupi.
- **Files**: `modules/inventory/services/event-handlers/goods-return-inventory.handler.ts`
- **Breaking**: ❌ Tidak

### [2026-06-25] — Fix 403 work order detail untuk teknisi

- **Tipe**: [FIXED]
- **Scope**: `modules/work-order/services/work-order-access.ts`
- **Author**: agent
- **Deskripsi**: Teknisi tidak bisa melihat detail work order berstatus PENDING/REQUESTED karena validasi assignee dilakukan sebelum status check. Fix: skip assignee validation untuk status PENDING/REQUESTED (unclaimed) sehingga semua teknisi di tenant yang sama bisa melihat detail WO yang belum di-assign.
- **Files**: `modules/work-order/services/work-order-access.ts`
- **Breaking**: ❌ Tidak

### [2026-06-24] — Fix PrismaClientValidationError restock create dan BullMQ event name

- **Tipe**: [FIXED]
- **Scope**: `modules/inventory`, `lib/event-bus`
- **Author**: agent
- **Deskripsi**: Fix production error `Unknown argument 'tenant'` saat POST
  `/api/inventory/restock/requests`. Penyebab: Prisma extension `withTenantIsolation`
  mendeteksi nested `items: { create: [...] }` sebagai relation payload dan
  mengganti `tenantId` dengan `tenant: { connect: { id } }`. Fix: pisahkan
  create purchase request dan items menjadi dua operasi terpisah dalam transaction.
  Juga fix BullMQ error `Custom Id cannot contain :` dengan mengganti `:` menjadi
  `.` di job name event.
- **Files**: `modules/inventory/services/RestockRequestService.ts`,
  `modules/inventory/repositories/InventoryPurchaseRequestRepository.ts`,
  `lib/event-bus/queues.ts`
- **Breaking**: ❌ Tidak

### [2026-06-24] — Fix search restock tidak relevan dan dropdown terlalu pendek

- **Tipe**: [FIXED]
- **Scope**: `app/admin/inventory/restock`, `components/ui`
- **Author**: agent
- **Deskripsi**: Perbaikan search restock request agar bisa mencari berdasarkan
  nama gudang, keterangan, dan nama/kode barang (sebelumnya hanya nomor request).
  Search sekarang menggunakan word-start matching supaya pencarian dari tengah
  kata tetap ditemukan. Dropdown SearchableSelect diperbaiki agar trigger lebih
  tinggi dan teks sublabel lebih terbaca.
- **Files**: `app/admin/inventory/restock/utils.ts`, `components/ui/SearchableSelect.tsx`
- **Breaking**: ❌ Tidak

### [2026-06-18] — Fix FCM push admin skip karena tenantId tidak dipropagasi ke delivery

- **Tipe**: [FIXED]
- **Scope**: `modules/notification`
- **Author**: agent
- **Deskripsi**: `createNotification` me-resolve `tenantId` dari tenant context
  (untuk job worker seperti WORK_ORDER yang tidak mengirim `tenantId` eksplisit)
  dan memakainya saat menulis row DB, tetapi meneruskan `data` mentah ke
  `deliverNotification`. Akibatnya `notifyAdmins` melihat `data.tenantId`
  undefined lalu skip push FCM ke admin (log `[FCM Push Admin] Skip`) dan
  notifikasi WORK_ORDER tidak pernah sampai ke admin. Fix: teruskan `tenantId`
  hasil resolve ke `data` yang dikirim ke delivery layer. Proteksi cross-tenant
  tetap terjaga — bila context kosong (system context), `tenantId` tetap null
  sehingga push admin tetap di-skip.
- **Files**: `modules/notification/services/NotificationService.ts`,
  `tests/notification-create-propagates-tenant-context.test.ts`
- **Breaking**: ❌ Tidak

### [2026-06-18] — Acknowledge destructive tax config legacy migration

- **Tipe**: [MIGRATION]
- **Scope**: `prisma/migrations`
- **Author**: agent
- **Deskripsi**: Tambah `-- @safe-guard-ack` pada migration
  `20260525010000_drop_tax_config_legacy_fields` agar Safe Migration Guard
  Jenkins mengizinkan penghapusan kolom legacy `tax_configs`. Field tarif dan
  due day legacy sudah digantikan oleh `tax_rate_configs`; migration memakai
  `DROP COLUMN IF EXISTS` dan catatan SQL sudah menegaskan data pengganti harus
  tersedia via `seed-tax-rate-configs` sebelum apply.
- **Files**: `prisma/migrations/20260525010000_drop_tax_config_legacy_fields/migration.sql`
- **Migration**: `20260525010000_drop_tax_config_legacy_fields`
- **Breaking**: ✅ Ya

### [2026-06-17] — Fix test AutoRejectService time-bomb (tanggal statis)

- **Tipe**: [FIXED]
- **Scope**: `tests/modules/attendance`
- **Author**: agent
- **Deskripsi**: 8 test di `AutoRejectService.test.ts` gagal karena memakai
  tanggal statis (`2026-06-01` dst) yang kini sudah lewat, sehingga aturan
  backdate ter-trigger lebih dulu sebelum aturan yang sedang diuji. Diganti
  dengan helper `futureDate(daysFromNow)` agar tanggal selalu relatif terhadap
  hari ini (tidak menjadi time-bomb). Tidak ada perubahan kode produksi.
- **Files**: `tests/modules/attendance/AutoRejectService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-06-17] — Fix data izin/cuti tidak reload saat ganti filter status

- **Tipe**: [FIXED]
- **Scope**: `app/admin/kehadiran/izin` | `app/api/admin/leaves` | `modules/attendance`
- **Author**: agent
- **Deskripsi**: Halaman Manajemen Izin & Cuti tidak memuat ulang data saat
  user berpindah tab status (Menunggu/Disetujui/Ditolak/Semua). Akar masalah:
  guard `hasFetchedRef` (boolean) di `IzinClient` membuat fetch hanya jalan
  sekali saat mount, sehingga perubahan `filterStatus` tidak memicu refetch —
  semua tab menampilkan data tab default (PENDING). Diganti dengan comparator
  berbasis `filterStatus` (pola filter-key comparator) agar refetch saat mount
  dan setiap filter berubah, tanpa double-fetch di StrictMode. Sekaligus
  memperbaiki truncation: API `GET /api/admin/leaves` default `limit=20` tapi
  route tidak meneruskan `limit`, sehingga tab "Semua" terpotong (mis. 26→20).
  Route kini membaca `page`/`limit` dan client meminta `limit=1000` (konsisten
  dengan `/api/admin/users?limit=1000`) karena halaman belum punya UI pagination.
- **Files**: `app/admin/kehadiran/izin/IzinClient.tsx`,
  `app/api/admin/leaves/route.ts`,
  `modules/attendance/services/AdminLeaveRouteService.ts`,
  `modules/attendance/services/admin-leave-route.types.ts`
- **Breaking**: ❌ Tidak

### [2026-06-17] — Work order list: filter rentang tanggal (createdAt)

- **Tipe**: [ADDED]
- **Scope**: `app/admin/workorders/list` | `modules/work-order`
- **Author**: agent
- **Deskripsi**: Tambah filter rentang tanggal (Tanggal Dari / Sampai) pada
  halaman admin work order list, difilter berdasarkan `createdAt`. Backend
  (`WorkOrderFilters.dateFrom/dateTo` + query builder) sudah mendukung; yang
  ditambahkan: parsing `dateFrom`/`dateTo` di `AdminWorkOrderFilterBuilder`
  (dipatok awal hari / akhir hari inklusif, abaikan tanggal invalid) dan UI
  input tanggal di `WoListClient` (ikut clear-filter, active-filter, reset page).
- **Files**: `modules/work-order/services/AdminWorkOrderFilterBuilder.ts`,
  `app/admin/workorders/list/WoListClient.tsx`,
  `tests/modules/work-order/AdminWorkOrderFilterBuilder.test.ts`
- **Breaking**: ❌ Tidak

### [2026-06-17] — Worker: resolve tenant context dari tenantId top-level job

- **Tipe**: [FIXED]
- **Scope**: `lib/event-bus/workers.ts`
- **Author**: agent
- **Deskripsi**: Wrapper `withTenantContext` di BullMQ worker sebelumnya hanya
  membaca `job.data.payload.tenantId` (bentuk nested untuk event/outbox),
  sehingga job dengan `tenantId` di top-level — seperti `attendance:auto-checkout`
  (`AttendanceAutoCheckoutJobData`) — tidak terdeteksi dan jatuh ke
  `runAsSystemContext` (super admin lintas tenant). Akibatnya auto-checkout
  attendance berjalan tanpa scoping tenant yang benar (fail-closed/throw
  "missing-context" pada build pra-hardening, atau diam-diam super admin pada
  HEAD). Ditambahkan helper `resolveJobTenantId` yang mendukung tenantId
  top-level maupun nested. Test worker diperkuat untuk membuktikan job
  ber-tenantId top-level dijalankan via `runWithRequestTenantContext`
  (`{ tenantId, isSuperAdmin: false }`) dan tidak menyentuh system context.
- **Files**: `lib/event-bus/workers.ts`,
  `tests/lib/event-bus/attendance-auto-checkout-worker.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-27] — Incident: event integration + MTTR analytics dashboard

- **Tipe**: [ADDED]
- **Scope**: `lib/event-bus/types.ts`, `modules/incident`, `app/api/admin/incidents/analytics`, `app/admin/incidents`
- **Author**: agent
- **Deskripsi**: Lanjutan dari incident MVP (commit `12728b306`) yang sebelumnya tag broadcast & MTTR sebagai deferred. (1) Event integration: tambah dua event domain `INCIDENT_CREATED` (priority HIGH) dan `INCIDENT_RESOLVED` (priority NORMAL) dengan category baru "incident" di EVENT_CATEGORIES. Emit otomatis dari `IncidentService.create` dan `addUpdate` saat status RESOLVED — payload `INCIDENT_RESOLVED` mencakup `durationMinutes` (resolvedAt - startedAt) supaya downstream module bisa hitung MTTR atau trigger SLA credit tanpa recompute. (2) MTTR analytics: method `getAnalytics(windowDays=30)` di `IncidentService` aggregat total/active/resolved counts, average resolution time, breakdown by severity (CRITICAL/MAJOR/MINOR), dan top 10 recently resolved. API `GET /api/admin/incidents/analytics?days=<n>` expose ini ke admin. UI: component `IncidentMetricsCards` ditambahkan ke `/admin/incidents` di atas list — 4 metric card (total 30 hari, MTTR rata-rata, jumlah kritis, jumlah besar) plus list "Resolved Terakhir" dengan duration per incident. **Masih deferred:** multi-channel broadcast otomatis ke pelanggan terdampak (WA/Email/Push), SLA credit otomatis ke invoice — keduanya butuh logic targeting yang lebih kompleks dan worth dikerjakan sebagai phase berikut.
- **Files**: `lib/event-bus/types.ts`, `modules/incident/services/IncidentService.ts`, `modules/incident/index.ts`, `app/api/admin/incidents/analytics/route.ts`, `app/admin/incidents/IncidentsListClient.tsx`, `app/admin/incidents/IncidentMetricsCards.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-27] — Registration: customer-facing status tracking page

- **Tipe**: [ADDED]
- **Scope**: `app/registrasi/status/[id]`, `app/api/public/registration-status/[id]`, `app/register/page.tsx`
- **Author**: agent
- **Deskripsi**: Tambah status tracking page untuk customer yang sudah submit pendaftaran supaya bisa pantau progress tanpa hubungi admin. Page `/registrasi/status/[id]` minta verifikasi nomor telepon (cocok dengan yang didaftarkan untuk privacy), lalu tampilkan timeline progress dalam 4 stage (PENDING → VERIFIED → SURVEYED → INSTALLED) dengan visual stepper. State terminal REJECTED/CANCELLED ditampilkan dengan card terpisah berisi alasan. Auto-refresh 60 detik supaya customer tidak perlu reload manual. API publik `/api/public/registration-status/[id]` (no auth) cek match `phone` query param vs registered phone — return 404 kalau salah, jadi tidak leak info pendaftaran lain. Page `/register` di-update: setelah submit sukses, tangkap `registrationId` dari API response dan tampilkan tombol "Cek Status Pendaftaran" yang link ke status page sehingga customer langsung punya entry point.
- **Files**: `app/registrasi/status/[id]/page.tsx`, `app/registrasi/status/[id]/RegistrationStatusClient.tsx`, `app/api/public/registration-status/[id]/route.ts`, `app/register/page.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-27] — Marketing: event integration approval + coupons analytics dashboard

- **Tipe**: [ADDED]
- **Scope**: `lib/event-bus/types.ts`, `modules/marketing/services`, `modules/coupons`, `app/admin/marketing/coupons/analytics`, `app/api/admin/coupons/analytics`, `lib/menu-config.ts`
- **Author**: agent
- **Deskripsi**: Dua peningkatan modul marketing yang sebelumnya backend-heavy tapi belum cross-module event-driven dan tidak punya analytics dashboard. (1) Event bus: tambah dua event domain baru `MARKETING_POINT_CLAIM_APPROVED` dan `MARKETING_CANVASING_APPROVED` (category baru "marketing", priority NORMAL, persistent), emit dari `PointClaimService.approveClaim` dan `CanvasingService.approveRequest` setelah update sukses. Payload mencakup id claim/canvasing, salesId, reviewerId/approverId, pointValue/workOrderNumber. Sekarang downstream module (finance/MRR, mitra commission, analytics) bisa subscribe event ini tanpa coupling langsung ke marketing. (2) Coupons analytics dashboard di `/admin/marketing/coupons/analytics`: 4 summary card (kupon aktif, akan kedaluwarsa 14 hari, pemakaian 30 hari, redemption rate + estimasi total diskon), top 10 kupon by usage dengan progress bar redemption, dan section warning kupon yang akan kedaluwarsa dengan visual urgency (≤3 hari merah, sisanya orange). Service `CouponAnalyticsService` aggregat dari `Coupon.usedCount`, `CouponUsage` events 30 hari, plus estimate diskon berdasarkan `discountType` (PERCENT pakai maxDiscount upper bound, FIXED pakai discountValue). Menu "Coupons Analytics" ditambahkan di group Marketing di sidebar.
- **Files**: `lib/event-bus/types.ts`, `modules/marketing/services/PointClaimService.ts`, `modules/marketing/services/CanvasingService.ts`, `modules/coupons/services/CouponAnalyticsService.ts`, `modules/coupons/index.ts`, `app/api/admin/coupons/analytics/route.ts`, `app/admin/marketing/coupons/analytics/page.tsx`, `app/admin/marketing/coupons/analytics/CouponAnalyticsClient.tsx`, `lib/menu-config.ts`
- **Breaking**: ❌ Tidak

### [2026-05-27] — Settings: app releases + feature flags hub di sidebar

- **Tipe**: [ADDED]
- **Scope**: `app/admin/pengaturan/feature-flags`, `lib/menu-config.ts`
- **Author**: agent
- **Deskripsi**: Tambah dua entry menu di group Pengaturan: (1) "App Releases" link ke `/admin/app-releases` (page existing untuk upload & manage APK release per platform yang sebelumnya tidak terdaftar di sidebar — hanya bisa diakses lewat URL langsung), dan (2) "Feature Flags" hub baru di `/admin/pengaturan/feature-flags` yang list semua tenant dengan search, klik tenant → arahkan ke halaman per-tenant existing `/admin/tenants/[id]/features`. Hub ini meminimalisir duplikasi UI: reuse halaman feature flag per-tenant yang sudah ada, hanya tambah entry point dari sidebar Pengaturan.
- **Files**: `app/admin/pengaturan/feature-flags/page.tsx`, `app/admin/pengaturan/feature-flags/FeatureFlagsHubClient.tsx`, `lib/menu-config.ts`
- **Breaking**: ❌ Tidak

### [2026-05-26] — Incident: outage management + status page publik (MVP)

- **Tipe**: [ADDED]
- **Scope**: `modules/incident`, `app/api/admin/incidents`, `app/api/public/status`, `app/admin/incidents`, `app/status`, `lib/permission-config.ts`, `lib/menu-config.ts`, `prisma/schema.prisma`
- **Author**: agent
- **Deskripsi**: Modul baru `incident` untuk pencatatan & broadcast gangguan layanan ke pelanggan. Schema baru: model `Incident` (title, description, severity CRITICAL/MAJOR/MINOR, status INVESTIGATING/IDENTIFIED/MONITORING/RESOLVED, affectedAreas, startedAt, resolvedAt, isPublic) dan `IncidentUpdate` (timeline status changes per incident, dengan transactional update saat addUpdate sehingga `Incident.status` & `Incident.resolvedAt` selalu sinkron). Service expose CRUD + addUpdate dengan auto-set resolvedAt saat status RESOLVED. API admin di `/api/admin/incidents` (list, create, detail, update, delete) dengan permission `incidents:read/create/update/delete` di catalog baru group INCIDENT. API publik di `/api/public/status` (no auth) return active + 10 recent resolved incidents (publicOnly filter). UI admin: list dengan filter berlangsung/selesai/semua + inline create form, detail dengan timeline updates + form add update. Status page publik di `/status` mirror cloudflarestatus pattern: summary banner (semua normal vs N gangguan berlangsung), section gangguan aktif, riwayat insiden, auto-refresh 60 detik. Menu "Manajemen Insiden" di group Keuangan sidebar. **Deferred (follow-up):** multi-channel broadcast (WA/Email/Push otomatis), MTTR analytics, SLA credit otomatis ke invoice pelanggan terdampak.
- **Migration**: `20260526043850_add_incident_management`
- **Breaking**: ❌ Tidak

### [2026-05-26] — Finance: Customer cohort retention analysis

- **Tipe**: [ADDED]
- **Scope**: `modules/finance`, `app/api/admin/finance/customer-cohort`, `app/api/cron/customer-cohort`, `app/admin/finance/cohort`, `lib/menu-config.ts`, `lib/cron-registry.ts`
- **Author**: agent
- **Deskripsi**: Mengaktifkan model `CustomerCohort` yang sebelumnya kosong di schema. Service `CustomerCohortService` menghitung cohort retention dari `Pelanggan.tanggalAktif` — kelompokkan pelanggan per (cohortYear, cohortMonth), lalu untuk tiap cohort hitung berapa yang masih AKTIF di checkpoint M0/M1/M3/M6/M12 plus total revenue (sum harga paket) per checkpoint. `computeAndSaveAll()` recompute 12 cohort terakhir dengan upsert per (cohortYear, cohortMonth) — re-run aman. Cron `customer-cohort` jalan bulanan tanggal 1 jam 02:00 (TTL 3300s) sudah didaftarkan ke `cron-registry`. API `GET /api/admin/finance/customer-cohort` dengan query `months=<n>` dan `recompute=true`. Dashboard `/admin/finance/cohort` menampilkan retention heatmap (color-coded percentage bar per checkpoint) dan revenue table per cohort. Catatan: MVP pakai snapshot status saat ini (heuristic AKTIF=hidup di semua checkpoint lewat) — akurasi historis penuh perlu trace MRRMovement events, deferred. Menu "Customer Cohort" di group Keuangan.
- **Files**: `modules/finance/services/CustomerCohortService.ts`, `modules/finance/index.ts`, `app/api/admin/finance/customer-cohort/route.ts`, `app/api/cron/customer-cohort/route.ts`, `app/admin/finance/cohort/page.tsx`, `app/admin/finance/cohort/CustomerCohortClient.tsx`, `lib/menu-config.ts`, `lib/cron-registry.ts`
- **Breaking**: ❌ Tidak

### [2026-05-26] — Cron registry: daftarkan SLA monitor, AR aging, revenue snapshot

- **Tipe**: [INFRA]
- **Scope**: `lib/cron-registry.ts`
- **Author**: agent
- **Deskripsi**: Daftarkan 3 cron job yang sebelumnya hanya tersedia sebagai HTTP endpoint manual ke `CronRegistry` (node-cron self-hosted scheduler) supaya jalan otomatis di production: `workOrderSlaMonitor` setiap 10 menit (TTL lock 540s), `arAgingSnapshot` harian jam 23:55 (TTL 3300s), `revenueSnapshot` harian jam 23:58 setelah AR aging (TTL 3300s). Semua pakai pola standar `canRunCronJob()` Redis lock + `runCronTask()` system context elevation, dengan dynamic import service untuk tree-shake.
- **Files**: `lib/cron-registry.ts`
- **Breaking**: ❌ Tidak

### [2026-05-26] — Tax: tambah client-safe entrypoint + perbaikan quality gate

- **Tipe**: [FIXED]
- **Scope**: `modules/tax`, `app/admin/procurement/suppliers`, `app/admin/procurement/purchase-orders/create`, `app/admin/pajak/konfigurasi`, `tests/admin`, `tests/server`
- **Author**: agent
- **Deskripsi**: Menambahkan sub-entrypoint `@/modules/tax/client` yang hanya re-export `PphClassifier` (pure helpers + types) dan tipe `TaxRateConfig` agar client component bisa pakai tanpa menarik service/event-handler server-only (firebase-admin, prisma) ke browser bundle. `SupplierForm`, `SupplierListClient`, dan `PurchaseOrderCreateClient` dipindah dari import dalam (`@/modules/tax/services/PphClassifier`) ke entrypoint client tersebut, menghilangkan pelanggaran `no-restricted-imports`. `TarifPajakFleksibelSection` direfactor pakai TanStack Query (`useQuery` + `useMutation`) untuk menghapus error `react-hooks/set-state-in-effect`. `SupplierForm.handleSubmit` di-typing ulang ke `React.SyntheticEvent<HTMLFormElement>` untuk hindari API React 19 yang sudah deprecated. Test `removed-surfaces` dibersihkan — case "retires the market price page" dihapus karena halaman sudah jadi placeholder aktif (bukan `notFound()`); test `custom-server-bootstrap` disinkronkan dengan script `dev` yang sekarang membawa `--max-old-space-size=8192`.
- **Files**: `modules/tax/client.ts`, `app/admin/procurement/suppliers/SupplierForm.tsx`, `app/admin/procurement/suppliers/SupplierListClient.tsx`, `app/admin/procurement/purchase-orders/create/PurchaseOrderCreateClient.tsx`, `app/admin/pajak/konfigurasi/TarifPajakFleksibelSection.tsx`, `tests/admin/removed-surfaces.test.ts`, `tests/server/custom-server-bootstrap.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-25] — Finance: Revenue snapshot + executive dashboard

- **Tipe**: [ADDED]
- **Scope**: `modules/finance`, `app/api/admin/finance/revenue-snapshot`, `app/api/cron/revenue-snapshot`, `app/admin/finance/executive`, `lib/menu-config.ts`
- **Author**: agent
- **Deskripsi**: Mengaktifkan model `RevenueSnapshot` yang sebelumnya kosong di schema. Service `RevenueSnapshotService` agregat MRR/ARR harian dengan: total MRR = sum(harga paket pelanggan AKTIF), ARR = totalMRR × 12, ARPU = totalMRR / activeCustomers, plus 5 movement bucket (NEW/EXPANSION/CONTRACTION/CHURN/REACTIVATION) bulan berjalan dari `MRRMovementService.getMonthSummary()`. Cron `revenue-snapshot` jalan harian dengan distributed lock (Redis), upsert ke `RevenueSnapshot` per (snapshotDate, snapshotType) — re-run aman, tidak duplikat. API `GET /api/admin/finance/revenue-snapshot` mendukung query `history=<days>` (default 30) dan `recompute=true`. Dashboard executive di `/admin/finance/executive` menampilkan 4 metric card (MRR dengan delta vs sebelumnya, ARR, Active Customers, ARPU), 5 movement card per kategori, dan trend chart 30 hari (MRR + Active Customers bar chart sederhana). Menu "Executive Dashboard" ditambahkan di group Keuangan.
- **Files**: `modules/finance/services/RevenueSnapshotService.ts`, `modules/finance/index.ts`, `app/api/admin/finance/revenue-snapshot/route.ts`, `app/api/cron/revenue-snapshot/route.ts`, `app/admin/finance/executive/page.tsx`, `app/admin/finance/executive/ExecutiveDashboardClient.tsx`, `lib/menu-config.ts`
- **Breaking**: ❌ Tidak

### [2026-05-25] — Finance: MRR movement tracking via event handler

- **Tipe**: [ADDED]
- **Scope**: `modules/finance`, `lib/event-bus/event-handlers.ts`
- **Author**: agent
- **Deskripsi**: Mengaktifkan model `MRRMovement` yang sebelumnya kosong di schema. Service `MRRMovementService` menulis row MRR setiap kali ada lifecycle pelanggan, dengan kategori NEW (aktivasi pertama), EXPANSION (upgrade paket, delta positif), CONTRACTION (downgrade, delta negatif), CHURN (suspended/isolated/deleted, current MRR negatif), atau REACTIVATION (kembali aktif setelah pernah churn). Event handler menangani 5 event existing di event bus: `CUSTOMER_ACTIVATED` (NEW atau REACTIVATION berdasarkan oldStatus), `CUSTOMER_SUSPENDED`/`CUSTOMER_ISOLATED`/`CUSTOMER_DELETED` (CHURN), dan `PACKAGE_CHANGED` (EXPANSION/CONTRACTION dari delta `oldPackagePrice` vs `newPackagePrice`). Handler juga expose `getMonthSummary()` aggregat untuk dipakai cron RevenueSnapshot. Tracking dimulai dari go-live, tidak backfill historis.
- **Files**: `modules/finance/services/MRRMovementService.ts`, `modules/finance/services/event-handlers/mrr-movement-handler.ts`, `modules/finance/index.ts`, `lib/event-bus/event-handlers.ts`
- **Breaking**: ❌ Tidak

### [2026-05-25] — Finance: AR Aging snapshot + report dashboard

- **Tipe**: [ADDED]
- **Scope**: `modules/finance`, `app/api/admin/finance/ar-aging`, `app/api/cron/ar-aging-snapshot`, `app/admin/finance/ar-aging`, `lib/menu-config.ts`
- **Author**: agent
- **Deskripsi**: Mengaktifkan model `ARAgingSnapshot` yang sebelumnya kosong di schema. Service `ARAgingService` menghitung outstanding piutang dari `Invoice` (status NOT IN PAID/CANCELLED, outstanding = totalAmount - paidAmount), dikelompokkan ke 4 bucket aging berdasarkan dueDate: belum jatuh tempo, 1-30 hari, 31-60 hari, dan 60+ hari overdue. Cron `ar-aging-snapshot` jalan harian dengan distributed lock (Redis), simpan snapshot ke `ARAgingSnapshot` table di main DB. API `GET /api/admin/finance/ar-aging` mendukung query `history=<days>` (default 30), `breakdown=true` (drill-down per pelanggan realtime), dan `recompute=true` (skip cache). Dashboard di `/admin/finance/ar-aging` menampilkan 4 bucket card, summary total outstanding & jumlah pelanggan, trend table 30 hari, plus breakdown per pelanggan on-demand. Menu "AR Aging" ditambahkan di group Keuangan di sidebar.
- **Files**: `modules/finance/repositories/ARAgingSnapshotRepository.ts`, `modules/finance/services/ARAgingService.ts`, `modules/finance/index.ts`, `app/api/admin/finance/ar-aging/route.ts`, `app/api/cron/ar-aging-snapshot/route.ts`, `app/admin/finance/ar-aging/page.tsx`, `app/admin/finance/ar-aging/ARAgingClient.tsx`, `lib/menu-config.ts`
- **Breaking**: ❌ Tidak

### [2026-05-25] — Work Order: SLA monitor engine + auto-escalation

- **Tipe**: [ADDED]
- **Scope**: `modules/work-order/services/SlaMonitorService.ts`, `app/api/cron/workorder-sla-monitor`
- **Author**: agent
- **Deskripsi**: Tambah engine monitoring SLA work order yang jalan via cron. Service `SlaMonitorService` query semua WO open (PENDING/ASSIGNED/IN_PROGRESS/ON_HOLD) yang punya `slaId`, lalu klasifikasi tiap WO ke tiga state: OK, AT_RISK (≥80% target), atau BREACHED. Saat breach response time terdeteksi (dan WO belum di-`startedAt`), service tulis audit `WorkOrderUpdates` dengan `updateType=SLA_RESPONSE_BREACH` + kirim push notification ke teknisi. Saat breach resolution time terdeteksi, service trigger semua `WorkOrderEscalations` rule yang match (slaId atau workOrderType+priority+departmentId), urut by `escalationLevel`, masing-masing tulis audit `SLA_ESC_LEVEL_<n>` + notif. Idempotent: setiap (workOrderId, updateType) hanya di-fire sekali — re-run cron tidak duplikat. Cron handler tipis di `app/api/cron/workorder-sla-monitor` mengikuti pola `workorder-reminder` (auth via `CRON_SECRET`).
- **Files**: `modules/work-order/services/SlaMonitorService.ts`, `modules/work-order/index.ts`, `app/api/cron/workorder-sla-monitor/route.ts`
- **Breaking**: ❌ Tidak

### [2026-05-25] — Work Order: UI admin untuk aturan SLA

- **Tipe**: [ADDED]
- **Scope**: `app/admin/workorders/slas`, `lib/menu-config.ts`
- **Author**: agent
- **Deskripsi**: Tambah halaman admin lengkap untuk CRUD aturan SLA work order yang sebelumnya hanya bisa diakses lewat API. Halaman list dengan filter status (aktif/nonaktif) & search by nama, plus form create/edit dengan field workOrderType, priority, departmentId, responseTime (menit), resolutionTime (menit), businessHoursOnly, dan isActive. Form re-use `SlaForm` shared component (pola sama dengan `DepartmentForm`). Menu "Aturan SLA" ditambahkan di group Work Orders di sidebar. Service & API SLA sudah ada sebelumnya di `modules/work-order/services/AdminWorkOrderConfigService.ts` — task ini hanya melengkapi bagian UI yang missing.
- **Files**: `app/admin/workorders/slas/page.tsx`, `app/admin/workorders/slas/SlasIndexClient.tsx`, `app/admin/workorders/slas/components/SlaForm.tsx`, `app/admin/workorders/slas/new/page.tsx`, `app/admin/workorders/slas/new/SlaNewClient.tsx`, `app/admin/workorders/slas/[id]/edit/page.tsx`, `app/admin/workorders/slas/[id]/edit/SlaEditClient.tsx`, `lib/menu-config.ts`
- **Breaking**: ❌ Tidak

### [2026-05-25] — Tax: drop legacy field di TaxConfig + cleanup UI

- **Tipe**: [REMOVED]
- **Scope**: `prisma/schema.prisma`, `modules/tax`, `app/admin/pajak/konfigurasi`, `app/api/admin/tax/config`
- **Author**: agent
- **Deskripsi**: Setelah TaxRateConfig stabil dan semua tenant ter-seed, field tarif & jatuh tempo legacy di-drop dari TaxConfig untuk hilangkan dual-source confusion. Yang di-drop: `ppnRate`, `pph23RateJasa`, `pph23RateSewa`, `pph4Rate`, `bhpRate`, `usoRate`, `ksoRate`, `ppnDueDay`, `pph21DueDay`, `pph23DueDay`, `bhpDueMonth`. TaxConfig sekarang murni identitas pelapor pajak (`npwp`, `companyName`, `isPkp`, `ppnIncluded`). Semua consumer service (`PpnService`, `PpnRateResolver`, `PphService`, `BhpUsoService`, `TaxExportService`, `TaxReminderService`) dimigrasi pakai `TaxRateConfig.findByCode()` direct — fallback ke default standar Indonesia bila row TaxRateConfig kosong (defensive). Section "Tarif Pajak (%)" dan "Tanggal Jatuh Tempo" di tab "Identitas Perusahaan" dihapus karena duplikat dengan tab "Tarif Pajak per Jenis". Validator API config drop field tarif/dueDay dari Zod schema. Helper `FieldNumber` di-drop karena tidak terpakai. Tab Identitas sekarang cuma berisi: NPWP, Nama Perusahaan, status PKP, status PPN included, + tombol Save.
- **Files**: `prisma/schema.prisma`, `prisma/migrations/20260525010000_drop_tax_config_legacy_fields/migration.sql`, `prisma/seed-tax-rate-configs.ts`, `modules/tax/domain/entities/TaxConfig.ts`, `modules/tax/repositories/TaxConfigRepository.ts`, `modules/tax/services/PpnService.ts`, `modules/tax/services/PpnRateResolver.ts`, `modules/tax/services/PphService.ts`, `modules/tax/services/BhpUsoService.ts`, `modules/tax/services/TaxExportService.ts`, `modules/tax/services/TaxReminderService.ts`, `modules/tax/services/TaxConfigService.ts`, `modules/tax/index.ts`, `app/admin/pajak/konfigurasi/KonfigurasiPajakClient.tsx`, `app/api/admin/tax/config/route.ts`
- **Migration**: `20260525010000_drop_tax_config_legacy_fields`
- **Breaking**: ✅ Ya — field legacy di tax_configs dihapus permanen. Tarif & jatuh tempo wajib pakai TaxRateConfig (sumber tunggal). API `PUT /api/admin/tax/config` tidak lagi terima field tarif/dueDay legacy. Frontend yang masih kirim field lama akan error dari Zod validator.

### [2026-05-25] — Hub procurement-akuntansi-pajak: timing & jurnal benar (full sync)

- **Tipe**: [FIXED]
- **Scope**: `modules/accounting/services/event-handlers/coa-resolver.ts`, `modules/tax/services/event-handlers/purchase-order-paid-tax.handler.ts`, `modules/tax/services/event-handlers/goods-receipt-created-tax.handler.ts`, `app/admin/procurement/goods-receipts/create/GoodsReceiptCreateClient.tsx`
- **Author**: agent
- **Deskripsi**: Tiga perbaikan hub yang masih ada gap setelah integrasi event-driven sebelumnya. (1) **Fix double-jurnal Persediaan**: `resolvePurchaseOrderPaidCoa` sebelumnya bikin jurnal `Dr Persediaan / Cr Bank` saat PO bayar, padahal GRN handler juga sudah debit Persediaan → ketika alur normal (PO → GRN → bayar), Persediaan ke-debit 2x. Fix: PO bayar sekarang `Dr Hutang Usaha / Cr Bank` (benar secara akuntansi). (2) **PPN Masukan timing**: dipindah dari `handlePurchaseOrderPaidTax` (saat bayar, bisa beda bulan dengan tanggal faktur) ke `handleGoodsReceiptCreatedTax` (saat barang+faktur diterima). Sesuai praktik DJP. PPh tetap di handler PO_PAID (PPh dipotong saat bayar). `expenseId` di tax_transactions sekarang pakai `goodsReceiptId` (idempotent per GRN). (3) **UI hint faktur pajak**: di form Create GRN, kalau PO punya PPN tapi belum punya `vendorNpwp`/`fakturPajakNo`/`fakturPajakDate` lengkap, muncul warning amber yang mengarahkan operator melengkapi di Edit PO sebelum buat GRN. Kalau lengkap, muncul info hijau dengan ringkasan faktur pajak.
- **Files**: `modules/accounting/services/event-handlers/coa-resolver.ts`, `modules/tax/services/event-handlers/purchase-order-paid-tax.handler.ts`, `modules/tax/services/event-handlers/goods-receipt-created-tax.handler.ts`, `modules/tax/index.ts`, `lib/event-bus/event-handlers.ts`, `app/admin/procurement/goods-receipts/create/GoodsReceiptCreateClient.tsx`
- **Breaking**: ❌ Tidak (PO yang dibayar tanpa GRN flow tetap akan punya jurnal AP, tapi AP-nya kosong → operator perlu jurnal manual penyesuaian. Untuk alur normal yang lewat GRN, jurnal sekarang benar otomatis.)

### [2026-05-25] — Hub procurement-akuntansi-pajak-keuangan: integrasi event-driven full

- **Tipe**: [ADDED]
- **Scope**: `lib/event-bus/types.ts`, `lib/event-bus/event-handlers.ts`, `modules/procurement`, `modules/inventory`, `modules/accounting`, `modules/tax`, `prisma/schema.prisma`
- **Author**: agent
- **Deskripsi**: Sebelumnya integrasi 4 modul cuma satu titik (PO dibayar → accounting + tax). GRN dan RTV tidak punya efek lintas modul → operator harus input stok manual ke modul inventory dan jurnal Persediaan/AP tidak otomatis. Sekarang ada 3 event procurement baru: `GOODS_RECEIPT_CREATED`, `GOODS_RETURN_SENT`, `PURCHASE_REQUEST_APPROVED` dengan payload lengkap (item-level, harga, faktur pajak). Handler yang ter-register: (1) **Inventory**: GRN auto-increment `BarangGudang.stok` & `stokBaru`, RTV auto-decrement. Idempotent via upsert. (2) **Accounting**: GRN bikin jurnal Dr Persediaan / Cr Hutang Usaha, RTV bikin jurnal kebalikan. Pakai COA `UTANG_USAHA` (2-100) yang sudah ada di default mapping. JournalSource enum ditambah `AUTO_GRN_CREATED` & `AUTO_RTV_SENT` (migrasi DB). (3) **Tax**: `PpnService` dan `BhpUsoService` dimigrasi pakai pattern hybrid — prefer `TaxRateConfig.findByCode()`, fallback ke field legacy `TaxConfig.ppnRate`/`bhpRate`/`usoRate`. Ini menyatukan single source of truth tarif: ubah di `/admin/pajak/konfigurasi` tab "Tarif Pajak per Jenis", semua modul (procurement, finance, payroll) ikut. Procurement publish event setelah create di `GoodsReceiptService` dan `GoodsReturnService`. CoaResolver ditambah `resolveGoodsReceiptCreatedCoa` dan `resolveGoodsReturnSentCoa` — resolver lama PO_PAID dibiarkan untuk backward compat (jurnal akan sedikit duplicate sementara, bisa dirapihkan saat migrasi penuh).
- **Files**: `lib/event-bus/types.ts`, `lib/event-bus/event-handlers.ts`, `modules/procurement/services/GoodsReceiptService.ts`, `modules/procurement/services/GoodsReturnService.ts`, `modules/inventory/services/event-handlers/goods-receipt-inventory.handler.ts`, `modules/inventory/services/event-handlers/goods-return-inventory.handler.ts`, `modules/inventory/index.ts`, `modules/accounting/services/event-handlers/goods-receipt-created-accounting.handler.ts`, `modules/accounting/services/event-handlers/goods-return-sent-accounting.handler.ts`, `modules/accounting/services/event-handlers/coa-resolver.ts`, `modules/accounting/domain/entities/JournalEntry.ts`, `modules/accounting/index.ts`, `modules/tax/services/PpnService.ts`, `modules/tax/services/BhpUsoService.ts`, `modules/tax/index.ts`, `prisma/schema.prisma`
- **Migration**: `20260525000000_add_journal_source_grn_rtv`
- **Breaking**: ❌ Tidak

### [2026-05-25] — Konfigurasi pajak: pisah jadi 2 tab (Identitas + Tarif per Jenis)

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/pajak/konfigurasi/KonfigurasiPajakClient.tsx`
- **Author**: agent
- **Deskripsi**: Sebelumnya semua section (Identitas Perusahaan, Tarif legacy, Jatuh Tempo, dan card Tarif per Jenis) ditumpuk vertikal — page jadi panjang dan campur antara identitas pelapor pajak vs konfigurasi tarif. Sekarang dipisah dengan tab: **Tab "Identitas Perusahaan"** berisi NPWP, nama, status PKP + tarif legacy + jatuh tempo (yang masih dipakai service `PpnService`/`BhpUsoService`/`TaxReminderService` selama belum migrasi penuh). **Tab "Tarif Pajak per Jenis"** berisi card per jenis pajak (PPN, PPh21, PPh23 Jasa+Sewa, PPh4(2), BHP, USO) — sumber kebenaran baru untuk konsumen modul lain (procurement, finance, payroll). Tarif legacy dikasih hint kuning yang mengarahkan ke tab kedua.
- **Files**: `app/admin/pajak/konfigurasi/KonfigurasiPajakClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-25] — Tarif pajak: rombak UI ke card per jenis (PPN/PPh21/PPh23/PPh4(2)/BHP/USO)

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/pajak/konfigurasi/TarifPajakFleksibelSection.tsx`
- **Author**: agent
- **Deskripsi**: Versi awal pakai 1 tabel CRUD generic — terlalu generik, user harus pilih kategori/code sendiri saat tambah tarif. Diganti jadi card terpisah per jenis pajak (PPN, PPh 21, PPh 23 dengan dua tarif Jasa+Sewa, PPh 4(2), BHP, USO) dengan field yang sesuai konteks: PPN/PPh pakai jatuh tempo tanggal, BHP/USO pakai jatuh tempo bulan ke- (tahunan). Backend `TaxRateConfig` dan API yang sudah dibuat tetap dipakai — perubahan hanya UI. Kode tarif (`PPN`, `PPH21`, `PPH23_JASA`, dst.) eksplisit ditampilkan di tiap row supaya developer modul lain tahu cara lookup-nya. Inline edit per row, tidak ada modal.
- **Files**: `app/admin/pajak/konfigurasi/TarifPajakFleksibelSection.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Tarif pajak fleksibel: tenant bisa CRUD jenis pajak custom

- **Tipe**: [ADDED]
- **Scope**: `modules/tax`, `app/api/admin/tax/rate-configs`, `app/admin/pajak/konfigurasi`, `prisma/schema.prisma`
- **Author**: agent
- **Deskripsi**: Sebelumnya konfigurasi tarif pajak hardcoded sebagai kolom di `TaxConfig` (ppnRate, pph23RateJasa, pph23RateSewa, pph4Rate, bhpRate, usoRate, ksoRate). Untuk menambah jenis pajak baru (mis. PPh 26 vendor LN, retribusi daerah) harus migration + ubah schema + ubah service. Sekarang ada model baru `TaxRateConfig` (id/code/name/category/rate/dueDay/dueMonth/isActive/description/sortOrder) per-tenant — tenant bebas CRUD via UI di `/admin/pajak/konfigurasi`. **TaxConfig lama tetap ada** untuk backward compatibility selama transisi: `PpnRateResolver` prefer `TaxRateConfig` (code `PPN`) dan fallback ke `TaxConfig.ppnRate` kalau row belum ada. Seed otomatis 7 tarif default (PPN, PPH23_JASA, PPH23_SEWA, PPH4_FINAL, PPH21, BHP, USO) yang nilainya diambil dari `TaxConfig` existing kalau ada — zero data loss.
- **Files**: `prisma/schema.prisma`, `prisma/migrations/20260524140000_add_tax_rate_configs/migration.sql`, `prisma/seed-tax-rate-configs.ts`, `modules/tax/domain/entities/TaxRateConfig.ts`, `modules/tax/domain/ports/ITaxRateConfigRepository.ts`, `modules/tax/repositories/TaxRateConfigRepository.ts`, `modules/tax/services/TaxRateConfigService.ts`, `modules/tax/services/PpnRateResolver.ts`, `modules/tax/index.ts`, `app/api/admin/tax/rate-configs/route.ts`, `app/api/admin/tax/rate-configs/[id]/route.ts`, `app/admin/pajak/konfigurasi/TarifPajakFleksibelSection.tsx`, `app/admin/pajak/konfigurasi/KonfigurasiPajakClient.tsx`
- **Migration**: `20260524140000_add_tax_rate_configs`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: dropdown kategori PPh consume single source dari tax module

- **Tipe**: [CHANGED]
- **Scope**: `modules/tax`, `app/admin/procurement/suppliers/SupplierForm.tsx`, `app/admin/procurement/suppliers/SupplierListClient.tsx`, `app/admin/procurement/purchase-orders/create/PurchaseOrderCreateClient.tsx`
- **Author**: agent
- **Deskripsi**: Sebelumnya list kategori PPh dan label-nya di-hardcode di **3 tempat** (SupplierForm, SupplierListClient, PurchaseOrderCreateClient) dengan format yang sedikit beda — "Jasa (PPh 23)" vs "Jasa (PPh 23 — 2%)". Risiko: kalau ada penambahan kategori baru (mis. PPh 26 vendor luar negeri) atau perubahan tarif, harus update di 3 tempat dan rentan inkonsisten. Tax module sudah punya `PphClassification` type sebagai source kebenaran, tapi belum expose sebagai opsi UI. Refactor: tambah `PPH_OPTIONS` (dengan `value/label/rateLabel`), `PPH_LABEL` (display map), dan helper `getPphLabel()` di `modules/tax/services/PphClassifier.ts` sebagai single source of truth. Export via `@/modules/tax`. Tiga file procurement consume dari sini, hapus konstanta lokal. Tambah kategori baru → cukup edit 1 file di tax, semua dropdown otomatis ikut.
- **Files**: `modules/tax/services/PphClassifier.ts`, `modules/tax/index.ts`, `app/admin/procurement/suppliers/SupplierForm.tsx`, `app/admin/procurement/suppliers/SupplierListClient.tsx`, `app/admin/procurement/purchase-orders/create/PurchaseOrderCreateClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Tambah seed data sample untuk modul Procurement

- **Tipe**: [ADDED]
- **Scope**: `prisma/seed-procurement.ts`
- **Author**: agent
- **Deskripsi**: Database lokal kosong di sisi Procurement (suppliers/GRN/RTV = 0) sehingga UI hanya menampilkan empty state dan tidak bisa diuji ujung-ke-ujung. Tambah seed standalone idempotent yang membuat 5 supplier ISP-relevan (FO cable, network gear, kabel optik, dll. dengan kode `SUP-001..SUP-005`), me-link semua PO yang belum punya supplier ke salah satu supplier baru, membuat 1 GRN dari PO berstatus RECEIVED, dan 1 RTV dari GRN tersebut (alasan DAMAGED). Aman di-run berulang karena cek existence berdasarkan kode unik. Run via `IS_SEEDING=true npx tsx prisma/seed-procurement.ts`.
- **Files**: `prisma/seed-procurement.ts`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: polish border supaya tidak ada "garis hitam" di tabel & form

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/procurement/**`
- **Author**: agent
- **Deskripsi**: Banyak page procurement pakai class `border` plain tanpa color spec — di Tailwind v4 default-nya `currentColor` dan kelihatan seperti garis hitam pekat di card, fieldset, input, button, dan separator. Sweep menyeluruh ganti jadi `border-gray-100/200` (light) + `border-gray-700/800` (dark) sesuai konteks: card/fieldset pakai `border-gray-100` (subtle), input pakai `border-gray-100`, button secondary & pagination pakai `border-gray-200`, separator/divider pakai `border-gray-100 dark:border-gray-800`. Container & section di-upgrade ke `rounded-2xl shadow-sm` agar konsisten dengan `ProcurementListCard` yang sudah ada. Thead tabel diseragamkan ke `bg-gray-50/80 dark:bg-gray-800/60`. Constant `PROCUREMENT_INPUT_CLASS` & `HeaderActionButton` di `_components/ProcurementPageShell.tsx` juga ikut di-soften (border-gray-200 → border-gray-100/border-gray-300 → border-gray-200) supaya semua page yang konsumsi helper ini langsung halus tanpa perubahan tambahan.
- **Files**: `app/admin/procurement/_components/ProcurementPageShell.tsx`, `app/admin/procurement/page.tsx`, `app/admin/procurement/market-price/MarketPriceClient.tsx`, `app/admin/procurement/approval-thresholds/ApprovalThresholdClient.tsx`, `app/admin/procurement/purchase-orders/PurchaseOrderListClient.tsx`, `app/admin/procurement/purchase-orders/create/PurchaseOrderCreateClient.tsx`, `app/admin/procurement/purchase-orders/[id]/PurchaseOrderEditClient.tsx`, `app/admin/procurement/purchase-requests/ProcurementPRListClient.tsx`, `app/admin/procurement/goods-receipts/GoodsReceiptListClient.tsx`, `app/admin/procurement/goods-receipts/create/GoodsReceiptCreateClient.tsx`, `app/admin/procurement/goods-receipts/[id]/GoodsReceiptDetailClient.tsx`, `app/admin/procurement/goods-returns/GoodsReturnListClient.tsx`, `app/admin/procurement/goods-returns/create/GoodsReturnCreateClient.tsx`, `app/admin/procurement/goods-returns/[id]/GoodsReturnDetailClient.tsx`, `app/admin/procurement/suppliers/SupplierListClient.tsx`, `app/admin/procurement/suppliers/SupplierForm.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Fix Next.js 15 sync dynamic API: params Promise di 3 page detail procurement

- **Tipe**: [FIXED]
- **Scope**: `app/admin/procurement/purchase-orders/[id]`, `app/admin/procurement/goods-receipts/[id]`, `app/admin/procurement/goods-returns/[id]`
- **Author**: agent
- **Deskripsi**: Tiga page detail procurement masih pakai pola lama `params: { id: string }` lalu akses langsung `params.id`. Di Next.js 15, `params` adalah Promise dan harus di-`await` dulu — pola lama memicu warning `Route used \`params.id\`. \`params\` is a Promise...` dan request ke API jadi `/.../undefined` (404). Migrasi ke pola Next 15 yang sudah konsisten dipakai di page lain (mis. `suppliers/[id]/page.tsx`): `params: Promise<{ id: string }>` lalu `const { id } = await params;`.
- **Files**: `app/admin/procurement/purchase-orders/[id]/page.tsx`, `app/admin/procurement/goods-receipts/[id]/page.tsx`, `app/admin/procurement/goods-returns/[id]/page.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Fix error /api/acs/devices: graceful degradation saat GenieACS unreachable

- **Tipe**: [FIXED]
- **Scope**: `modules/network/services/AcsDeviceService.ts`, `app/api/acs/devices/route.ts`, `lib/api-response.ts`
- **Author**: agent
- **Deskripsi**: Sebelumnya ketika server GenieACS tidak running atau unreachable, axios throw error yang `error.message`-nya kosong → log cuma menampilkan `[ERROR] Error fetching ACS devices:` tanpa konteks dan response 500 Internal Server Error (padahal ini external service issue). Sekarang `AcsDeviceService.listDevices()` membungkus axios call dengan try/catch dan helper `describeAcsError()` yang menerjemahkan axios error code (`ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, dll.) jadi pesan user-friendly + log struktural berisi `code`, `status`, `url`. Route `/api/acs/devices` disederhanakan: tidak ada try/catch lagi (service sudah return Result), dan response code-nya jadi 502 Bad Gateway lewat helper baru `ApiErrors.badGateway()` (pakai `EXTERNAL_SERVICE_ERROR` code yang sudah ada di `ErrorCodes`).
- **Files**: `modules/network/services/AcsDeviceService.ts`, `app/api/acs/devices/route.ts`, `lib/api-response.ts`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Senyapkan log `System context elevated` di hot loop

- **Tipe**: [CHANGED]
- **Scope**: `lib/tenant-context.ts`, `lib/event-bus/outbox-processor.ts`, `modules/notification/services/PushRetryQueue.ts`
- **Author**: agent
- **Deskripsi**: `runAsSystemContext()` sebelumnya selalu menulis `[INFO] [TENANT_CONTEXT] System context elevated: ...` setiap kali dipanggil. Untuk caller bootstrap (sekali jalan) ini berguna, tapi untuk caller polling (`outbox-processor.poll` tiap 5s, `PushRetryQueue.processRetryQueue` tiap 30s) jadi spam — ~12 baris/menit hanya untuk outbox. Sekarang `runAsSystemContext()` menerima opsi opsional `{ silent?: boolean }`; dua caller polling tersebut diset `silent: true`. Caller bootstrap (RadiusMonitor, MikroTikMonitor, event-bus.initialize.rehydrate, dst.) tetap log seperti biasa untuk audit trail.
- **Files**: `lib/tenant-context.ts`, `lib/event-bus/outbox-processor.ts`, `modules/notification/services/PushRetryQueue.ts`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Fix shared Redis client biar self-heal saat koneksi putus

- **Tipe**: [FIXED]
- **Scope**: `lib/redis.ts`
- **Author**: agent
- **Deskripsi**: Sebelumnya `retryStrategy` give up setelah 3 attempt → kalau Redis sempat putus (mis. dev server crash setengah jalan, container restart), shared client masuk state `end` permanen tanpa self-heal. Akibatnya cron lock tiap menit melempar `Stream isn't writeable and enableOfflineQueue options is false` sampai proses Node di-restart manual. Sekarang `retryStrategy` infinite dengan exponential backoff (cap 5 detik), ditambah `reconnectOnError` untuk `READONLY`/`ECONNRESET`/`ETIMEDOUT`, `keepAlive: 30s`, dan event listener (`error`/`reconnecting`/`ready`) untuk visibility. `maxRetriesPerRequest: 2` dan `enableOfflineQueue: false` tetap dijaga supaya rate limiter & login flow tetap fail-fast saat Redis benar-benar down. Tambahan: `server.ts` sekarang eager-connect shared Redis client setelah bootstrap event bus tapi sebelum `cronRegistry.startAll()` — tanpa ini, cron tick pertama (menit pertama setelah startup) bisa kena race dengan `lazyConnect: true` dan melempar error yang sama walau hanya di first-tick.
- **Files**: `lib/redis.ts`, `server.ts`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: haluskan styling tabel & input filter

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/procurement`
- **Author**: agent
- **Deskripsi**: Tambah komponen `ProcurementListCard` (rounded-2xl + shadow
  lembut) dan konstanta `PROCUREMENT_INPUT_CLASS` (input rounded-xl + ring
  fokus indigo) di `_components/ProcurementPageShell.tsx`. Refactor 6
  halaman list (Supplier, PO, PR, GRN, RTV, Approval Threshold) supaya:
  pakai card pembungkus tabel yang konsisten, ganti `<tbody>` ke
  `divide-y divide-gray-100` (garis baris halus, bukan `border-t` keras),
  ganti input/select filter ke `PROCUREMENT_INPUT_CLASS` (rounded penuh,
  ring fokus indigo, support dark mode). Form Approval Threshold dijadikan
  card dengan style yang sama. Tujuan: tampilan procurement match dengan
  modul Inventory/Restock yang sudah pakai pattern visual modern.
- **Files**: `app/admin/procurement/_components/ProcurementPageShell.tsx`,
  `app/admin/procurement/suppliers/SupplierListClient.tsx`,
  `app/admin/procurement/purchase-orders/PurchaseOrderListClient.tsx`,
  `app/admin/procurement/purchase-requests/ProcurementPRListClient.tsx`,
  `app/admin/procurement/goods-receipts/GoodsReceiptListClient.tsx`,
  `app/admin/procurement/goods-returns/GoodsReturnListClient.tsx`,
  `app/admin/procurement/approval-thresholds/ApprovalThresholdClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: refactor PO pages ke ProcurementPageShell

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/procurement/purchase-orders`
- **Author**: agent
- **Deskripsi**: Refactor 3 halaman Purchase Order (list, create, detail/edit)
  agar pakai `ProcurementPageShell` yang sama dengan halaman procurement
  lain. Sebelumnya PO list tampilannya beda (tidak ada back button, layout
  `p-6` polos, no dark mode), PO create pakai inline header sendiri, PO
  detail punya stack tombol custom di header. Sekarang ketiganya konsisten
  dengan modul Inventory dan halaman procurement lain — header bold,
  subtitle status, back button, slot actions, dark mode aware.
- **Files**:
  `app/admin/procurement/purchase-orders/PurchaseOrderListClient.tsx`,
  `app/admin/procurement/purchase-orders/create/PurchaseOrderCreateClient.tsx`,
  `app/admin/procurement/purchase-orders/[id]/PurchaseOrderEditClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Aktifkan Turbopack filesystem cache untuk dev

- **Tipe**: [CHANGED]
- **Scope**: `next.config.ts`
- **Author**: agent
- **Deskripsi**: Tambah `experimental.turbopackFileSystemCacheForDev: true` agar hasil compile Turbopack di-persist ke disk, bukan in-memory only. Restart dev jadi jauh lebih cepat karena tidak compile dari nol. Catatan: flag `turbopackTreeShaking`, `turbopackRemoveUnusedImports`, dan `turbopackRemoveUnusedExports` sempat dicoba tapi memicu Rust panic "index out of bounds" di Next 16.2.2 (bug upstream Turbopack di `tree_shake/graph.rs:743`) — tidak dipakai, re-evaluasi saat upgrade Next.
- **Files**: `next.config.ts`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Fix dev server lambat & OOM (Turbopack opt-in + heap 8GB)

- **Tipe**: [FIXED]
- **Scope**: `next.config.ts`, `server.ts`, `package.json`
- **Author**: agent
- **Deskripsi**: Dev server `npm run dev` lemot (cold start lama) dan crash OOM saat first compile. Root cause: (1) custom server programmatic Next 16 tidak auto-enable Turbopack — perlu opsi `turbopack: true` eksplisit; (2) `output: "standalone"` + `outputFileTracingIncludes` (40+ pattern) aktif di dev, padahal hanya relevan untuk Docker production build; (3) `webpack.config.parallelism = 1` & `splitChunks` paksa single-thread + chunking di dev; (4) `NODE_OPTIONS` dev tidak punya `--max-old-space-size`, heap default 4GB habis saat compile project 4096 file TS + 4 Prisma client → JavaScript heap OOM. Cache `.next/dev` juga membengkak ke 21GB → dibersihkan. Hasil: cold start 10s, first compile 4.2s, hit kedua 66ms (sebelumnya OOM crash >68s).
- **Files**: `next.config.ts`, `server.ts`, `package.json`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Accel-PPP UI: align ke template MikroTik (dark mode + ResponsiveTable)

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/network/accel-ppp/`
- **Author**: agent
- **Deskripsi**: Rewrite seluruh UI modul accel-ppp agar konsisten dengan
  template halaman lain (MikroTik sebagai reference):
  - **List page**: pakai `ResponsiveTable` (responsive desktop+mobile,
    column priority), heading 2xl bold, info banner biru, status pill
    online/offline, tombol action dengan icon `react-icons/hi2`,
    full dark mode support.
  - **Form**: layout card putih dengan border, section grouping
    (Identitas Server / Kredensial RADIUS / Akses CLI), input style
    konsisten, button cancel+submit di bawah dengan separator.
  - **Detail page**: header dengan back button, status pill di sebelah
    nama, 4 summary card (User Online, Cek Terakhir, Auth Port, Acct
    Port), tab navigation underline-style. Tab Sessions Live pakai
    `ResponsiveTable` dengan kolom username, interface, IP, calling SID,
    type, comp, state pill, uptime, dan action kick.
  - **Disabled page**: card warning amber dengan icon, instruksi
    aktivasi yang jelas, link ke pengaturan.
  - Icon `HiOutlineCpuChip` di-register ke `adminSidebarIconMap` agar
    muncul di sidebar.
- **Files**:
  `app/admin/network/accel-ppp/AccelPppServerList.tsx`,
  `app/admin/network/accel-ppp/AccelPppServerForm.tsx`,
  `app/admin/network/accel-ppp/[id]/AccelPppServerDetail.tsx`,
  `app/admin/network/accel-ppp/disabled/page.tsx`,
  `components/layout/admin-sidebar/adminSidebarIcons.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: fix React warning toast.error during render

- **Tipe**: [FIXED]
- **Scope**: `app/admin/procurement`
- **Author**: agent
- **Deskripsi**: Pindahkan pemanggilan `toast.error()` dari blok render ke
  `useEffect` di 6 list client component (`SupplierListClient`,
  `PurchaseOrderListClient`, `ProcurementPRListClient`,
  `GoodsReceiptListClient`, `GoodsReturnListClient`,
  `ApprovalThresholdClient`). Sebelumnya pola `if (error) toast.error(...)` di
  body komponen memicu warning React "Cannot update a component while
  rendering a different component" karena toaster (`react-hot-toast`)
  dispatch setState saat parent component sedang render.
- **Files**: `app/admin/procurement/suppliers/SupplierListClient.tsx`,
  `app/admin/procurement/purchase-orders/PurchaseOrderListClient.tsx`,
  `app/admin/procurement/purchase-requests/ProcurementPRListClient.tsx`,
  `app/admin/procurement/goods-receipts/GoodsReceiptListClient.tsx`,
  `app/admin/procurement/goods-returns/GoodsReturnListClient.tsx`,
  `app/admin/procurement/approval-thresholds/ApprovalThresholdClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Fix: seed permission accel_ppp + sidebar visibility

- **Tipe**: [FIXED]
- **Scope**: `scripts/seed-accel-ppp-permissions.sql`, `docs/guides/accel-ppp-setup.md`
- **Author**: agent
- **Deskripsi**: Walau resource `accel_ppp` sudah ditambah ke
  `PERMISSION_GROUPS.NETWORK` di `lib/permission-config.ts`, environment
  yang sudah pernah seeded sebelumnya tidak otomatis punya permission
  baru di DB. Akibatnya sidebar tetap menyembunyikan menu Accel-PPP
  walau Full RADIUS Mode sudah ON—`hasMenuPermission` resolve
  `accel_ppp:read` tidak match permission user.
  - **Akar masalah**: dependency dua arah—(1) modul perlu permission
    seeded ke DB, (2) permission user perlu diassign ke role. Tanpa
    re-seed, tidak ada keduanya.
  - **Fix**: tambah script idempotent
    `scripts/seed-accel-ppp-permissions.sql` yang insert 5 permission
    `accel_ppp:*` ke tabel `Permission` per tenant lalu auto-assign ke
    role `isSuperAdmin = true`. Aman dijalankan berkali-kali. Setup
    guide diupdate dengan instruksi pemakaian.
  - **Catatan operasional**: setelah run script, **user harus logout-
    login ulang** karena permission di-cache di session token NextAuth.
- **Files**:
  `scripts/seed-accel-ppp-permissions.sql`,
  `docs/guides/accel-ppp-setup.md`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: standardisasi UI shell + fix Market Price 404

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/procurement`
- **Author**: agent
- **Deskripsi**: Tambah komponen `ProcurementPageShell` reusable di
  `_components/` sebagai template UI standar untuk seluruh halaman
  procurement (max-w-7xl container, header `text-2xl font-bold` dengan
  subtitle, support dark mode, tombol back, slot actions). Refactor 9
  halaman procurement existing (landing, supplier list/form, PR list, PO
  detail link, GRN list/create/detail, RTV list/create/detail, approval
  threshold) supaya konsisten dengan modul Inventory. Halaman Market Price
  yang sebelumnya `notFound()` (404 saat diklik dari sidebar) diganti
  dengan placeholder client component informatif yang memakai shell yang
  sama. Permission `market_price:read` di-enforce sebelum render.
- **Files**: `app/admin/procurement/_components/ProcurementPageShell.tsx`,
  `app/admin/procurement/page.tsx`,
  `app/admin/procurement/market-price/page.tsx`,
  `app/admin/procurement/market-price/MarketPriceClient.tsx`,
  `app/admin/procurement/suppliers/SupplierListClient.tsx`,
  `app/admin/procurement/suppliers/SupplierForm.tsx`,
  `app/admin/procurement/purchase-requests/ProcurementPRListClient.tsx`,
  `app/admin/procurement/goods-receipts/GoodsReceiptListClient.tsx`,
  `app/admin/procurement/goods-receipts/create/GoodsReceiptCreateClient.tsx`,
  `app/admin/procurement/goods-receipts/[id]/GoodsReceiptDetailClient.tsx`,
  `app/admin/procurement/goods-returns/GoodsReturnListClient.tsx`,
  `app/admin/procurement/goods-returns/create/GoodsReturnCreateClient.tsx`,
  `app/admin/procurement/goods-returns/[id]/GoodsReturnDetailClient.tsx`,
  `app/admin/procurement/approval-thresholds/ApprovalThresholdClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Fix kritis: FULL_RADIUS_MODE storage scope (write-vs-read mismatch)

- **Tipe**: [FIXED]
- **Scope**: `modules/settings/services/fullRadiusModeSettings.ts`
- **Author**: agent
- **Deskripsi**: Bug kritis: toggle Full RADIUS Mode di pengaturan tampak
  berhasil di UI tapi `requireFullRadiusMode()` tetap menolak (403) karena
  read & write **tidak konsisten** dalam scope storage.
  - **Akar masalah**: `setFullRadiusMode` lama panggil
    `SettingsRepository.upsertMany` yang hardcoded pakai `prisma`
    (tenant-isolated client). Prisma extension `withTenantIsolation`
    auto-inject `tenantId = user.tenantId` ke `applyTenantToCreateData`,
    sehingga row tersimpan per-tenant — bukan global. Sebaliknya
    `getFullRadiusMode` panggil `findManyByKeys` tanpa tenantId →
    `resolveSettingsClient(undefined)` → `prismaAuth` → query
    `WHERE tenantId IS NULL` → tidak match row tenant-scoped → return
    false selamanya.
  - **Fix**: `setFullRadiusMode` & `getFullRadiusMode` sekarang langsung
    pakai `prismaAuth` (base client tanpa tenant isolation extension),
    eksplisit set/cari `tenantId: null`. Setting ini system-wide; tidak
    tepat di-scope per tenant. JSDoc ditambah supaya developer berikutnya
    paham kenapa repository pattern dilewati di sini.
- **Files**: `modules/settings/services/fullRadiusModeSettings.ts`
- **Breaking**: ❌ Tidak (interface getFullRadiusMode/setFullRadiusMode tidak
  berubah; argument repository legacy dihapus dari signature publik—tapi
  hanya dipakai internal & test, tidak tersentuh konsumen lain).

### [2026-05-24] — Stabilkan quality gate: lint, prisma boundary, dan test sinkronisasi

- **Tipe**: [FIXED]
- **Scope**: `app/admin/procurement/`, `app/api/admin/procurement/purchase-orders/`, `modules/procurement/validators/`, `tests/admin/`
- **Author**: agent
- **Deskripsi**: Perbaiki 5 lint error yang memblokir `npm run check`:
  (1) `react-hooks/set-state-in-effect` di tiga client component procurement —
  reset state dipindah ke handler `onChange` dan `setLoading(true)` dipindah
  ke dalam IIFE async untuk menghindari setState sinkron di body effect;
  (2) larangan import `@/lib/prisma` di route handler `purchase-orders` —
  lookup roleId user dipindah ke `UserLookupService` (boundary Clean
  Architecture); (3) `no-explicit-any` di validator `approval-threshold` —
  ganti `data as any` dengan struct eksplisit. Sinkronkan
  `tests/admin/removed-surfaces.test.ts` dengan kondisi nyata: procurement
  landing page sudah aktif kembali, jadi assertion "retired" untuk
  Procurement dihapus, sementara assertion untuk market-price & assets
  tetap dipertahankan.
- **Files**:
  `app/admin/procurement/goods-receipts/create/GoodsReceiptCreateClient.tsx`,
  `app/admin/procurement/goods-returns/create/GoodsReturnCreateClient.tsx`,
  `app/admin/procurement/goods-returns/[id]/GoodsReturnDetailClient.tsx`,
  `app/api/admin/procurement/purchase-orders/route.ts`,
  `modules/procurement/validators/approval-threshold.ts`,
  `tests/admin/removed-surfaces.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: tambah menu sidebar + register icon

- **Tipe**: [ADDED]
- **Scope**: `lib/menu-config.ts`, `components/layout/admin-sidebar/`
- **Author**: agent
- **Deskripsi**: Tambah parent menu "Procurement" di sidebar admin (section
  "Inventaris", featureModule `inventory`) dengan child: Dashboard, Master
  Supplier, Purchase Request, Purchase Order, Goods Receipt, Retur Vendor,
  Referensi Harga, Approval Threshold. Resolver permission default
  `<resource>:read` cocok dengan permission yang sudah di-register di
  `PERMISSION_GROUPS.PROCUREMENT`. Mapping khusus `PROCUREMENT.APPROVAL_THRESHOLDS`
  → `procurement` ditambah di `getPermissionResource`. Register icon
  `HiOutlineInbox` & `HiOutlineArrowUturnLeft` di `adminSidebarIcons.tsx`.
- **Files**: `lib/menu-config.ts`,
  `components/layout/admin-sidebar/adminSidebarMenu.ts`,
  `components/layout/admin-sidebar/adminSidebarIcons.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: Approval Threshold by Amount (Sprint 5)

- **Tipe**: [ADDED]
- **Scope**: `modules/procurement`, `app/admin/procurement/approval-thresholds`, `app/api/admin/procurement/approval-thresholds`, `app/api/admin/procurement/purchase-orders`, `prisma/schema.prisma`
- **Author**: agent
- **Deskripsi**: Tambah model `ApprovalThreshold` (scope × role × range nominal)
  + service `ApprovalThresholdService.assertCanApprove` yang dipanggil sebagai
  guard saat user create PO. Kalau nominal grand-total melebihi range yang
  cover role user, lempar `ApprovalThresholdExceededError` (HTTP 403).
  `maxAmount = null` artinya unlimited untuk role tertinggi. Kalau tenant
  belum config threshold sama sekali untuk scope, guard no-op (backward compat).
  UI admin di `/admin/procurement/approval-thresholds` untuk CRUD rule:
  pilih scope, role, range nominal, toggle aktif/nonaktif. Schema scope
  saat ini cover PURCHASE_REQUEST + PURCHASE_ORDER; integrasi service-side
  baru aktif untuk PO (PR lifecycle masih di modul inventory/restock).
- **Files**: `modules/procurement/domain/entities/ApprovalThreshold.ts`,
  `modules/procurement/domain/ports/IApprovalThresholdRepository.ts`,
  `modules/procurement/repositories/ApprovalThresholdRepository.ts`,
  `modules/procurement/dto/ApprovalThresholdDTO.ts`,
  `modules/procurement/validators/approval-threshold.ts`,
  `modules/procurement/services/ApprovalThresholdService.ts`,
  `modules/procurement/services/PurchaseOrderService.ts`,
  `app/admin/procurement/approval-thresholds/**`,
  `app/api/admin/procurement/approval-thresholds/**`,
  `app/api/admin/procurement/purchase-orders/route.ts`
- **Migration**: `20260524030000_add_approval_thresholds`
- **Breaking**: ❌ Tidak (no threshold = no gating)

### [2026-05-24] — Procurement: Return to Vendor (RTV) (Sprint 4)

- **Tipe**: [ADDED]
- **Scope**: `modules/procurement`, `app/admin/procurement/goods-returns`, `app/api/admin/procurement/goods-returns`, `lib/permission-config.ts`, `prisma/schema.prisma`
- **Author**: agent
- **Deskripsi**: Tambah modul Return to Vendor (RTV) — retur barang yang
  sudah diterima kembali ke supplier. Model `GoodsReturn` + `GoodsReturnItem`
  dengan referensi ke `GoodsReceipt` (audit trail batch mana yang diretur).
  Reason: `DAMAGED`, `WRONG_SPEC`, `EXCESS`, `OTHER`. Status: `DRAFT`/`SENT`
  → `REFUNDED`/`REPLACED`/`CREDIT_NOTE`/`CANCELLED`. Service `create` jalankan
  transaksi atomic: insert RTV, kurangi stok gudang (DAMAGED → `stokRusak`,
  lainnya → `stokBaru`), insert `barang_keluar` audit. Service `resolve`
  mendukung CANCELLED yang mengembalikan stok. Validasi quantity per item ≤
  qty diterima minus yang sudah pernah diretur sebelumnya. UI: list, halaman
  detail dengan action button Refunded/Replaced/Credit Note/Cancel, halaman
  create dengan GRN selector + per-item return line. Link "Buat Retur"
  ditambahkan di halaman GRN detail. Permission baru `goods_return`.
- **Files**: `modules/procurement/domain/entities/GoodsReturn.ts`,
  `modules/procurement/domain/ports/IGoodsReturnRepository.ts`,
  `modules/procurement/repositories/GoodsReturnRepository.ts`,
  `modules/procurement/dto/GoodsReturnDTO.ts`,
  `modules/procurement/validators/goods-return.ts`,
  `modules/procurement/services/GoodsReturnService.ts`,
  `app/admin/procurement/goods-returns/**`,
  `app/api/admin/procurement/goods-returns/**`
- **Migration**: `20260524020000_add_goods_returns`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: Goods Receipt Note (GRN) sebagai dokumen terpisah (Sprint 3)

- **Tipe**: [ADDED]
- **Scope**: `modules/procurement`, `app/admin/procurement/goods-receipts`, `app/api/admin/procurement/goods-receipts`, `lib/permission-config.ts`, `prisma/schema.prisma`
- **Author**: agent
- **Deskripsi**: Tambah model `GoodsReceipt` + `GoodsReceiptItem` sebagai
  dokumen penerimaan barang per batch (GRN). Satu PO bisa punya banyak GRN
  karena vendor dapat kirim parsial. Service `GoodsReceiptService.create`
  jalankan transaksi atomic: insert GRN, update `purchaseOrderItem.receivedQuantity`,
  upsert `barang_gudang` (stok bertambah), insert `barang_masuk` (audit trail),
  dan re-evaluate status PO ke PARTIAL/RECEIVED. Validasi quantity per item
  ≤ sisa (PO.quantity − receivedQuantity) dengan defense-in-depth: schema Zod +
  service-layer guard. UI: list GRN, form create dengan PO selector + per-item
  receive line, halaman detail. Link "Buat GRN" ditambahkan di halaman PO detail.
  Permission baru `goods_receipt` ditambah ke `PROCUREMENT` group.
- **Files**: `modules/procurement/domain/entities/GoodsReceipt.ts`,
  `modules/procurement/domain/ports/IGoodsReceiptRepository.ts`,
  `modules/procurement/repositories/GoodsReceiptRepository.ts`,
  `modules/procurement/dto/GoodsReceiptDTO.ts`,
  `modules/procurement/validators/goods-receipt.ts`,
  `modules/procurement/services/GoodsReceiptService.ts`,
  `app/admin/procurement/goods-receipts/**`,
  `app/api/admin/procurement/goods-receipts/**`
- **Migration**: `20260524010000_add_goods_receipts`
- **Breaking**: ❌ Tidak (RestockStockReceiptService existing tetap jalan untuk flow lewat inventory/restock; GRN adalah jalur baru parallel)

### [2026-05-24] — Accel-PPP: post-audit fixes (data loss, sidebar, race, UX)

- **Tipe**: [FIXED]
- **Scope**: `modules/network`, `app/admin/network/accel-ppp`,
  `components/layout`, `components/admin/settings`, `lib/menu-config.ts`,
  `lib/hooks`
- **Author**: agent
- **Deskripsi**: Audit menyeluruh terhadap flow modul accel-ppp menemukan 14
  isu (kritis sampai minor). Semuanya diperbaiki dalam batch ini:
  - **#1 Race duplicate IP**: tambah catch `Prisma.PrismaClientKnownRequestError`
    code `P2002` di repository sebagai backstop bila dua request bersamaan
    lolos dari `findFirst`.
  - **#4 Edit form data loss**: pre-fill `nasIdentifier`, `acctPort`, `coaPort`
    yang sebelumnya hilang saat user buka mode edit—update tanpa modifikasi
    field tersebut tidak lagi mereset ke nilai default.
  - **#5 Kolom comp di sessions table**: parser sudah ekstraksi tapi UI tidak
    menampilkannya. Sekarang muncul sebagai kolom tersendiri.
  - **#6 Confirm UX**: pesan delete/kick lebih informatif tentang konsekuensi
    (server side-effect, pengaruh ke pelanggan aktif, risiko force delete).
  - **#7 Warning force delete sesi aktif**: dialog konfirmasi force delete
    eksplisit menyebut bahwa sesi pelanggan tidak ikut terputus secara abrupt
    (CoA Disconnect-Request masih out of scope) dan menyarankan kick manual
    via tab Sessions Live dulu.
  - **#8 Server-side guard pages**: `page.tsx` accel-ppp sekarang panggil
    `getFullRadiusMode()` di server. Bila OFF → redirect ke halaman
    `/admin/network/accel-ppp/disabled` yang menjelaskan cara mengaktifkan.
  - **#9 Sidebar conditional**: tambah field `requiresFullRadiusMode` di
    `MenuConfig`, propagate ke filter sidebar. Menu Accel-PPP otomatis
    hilang saat toggle OFF.
  - **#10 Health check on create**: setelah server berhasil dibuat (atau
    saat user klik Test Connection), service melakukan `show stat` cepat
    dan persist `pingStatus`/`userOnline`/`lastStatusCheck`. Status di list
    page tidak lagi harus menunggu 60-detik cron tick berikutnya.
  - **#11 Permission user existing**: setup guide diberi section khusus
    cara grant permission `accel_ppp:*` ke role yang sudah ada di DB
    (re-seed atau manual via Roles UI / SQL).
  - **#12 shouldResyncNas precision**: ganti perbandingan `after.description
    !== before.description` dengan pendekatan eksplisit `data.* !== undefined`,
    plus menambah `nasIdentifier` ke field-field yang trigger re-sync.
  - **#14 coaPort docs**: tambah JSDoc di entity bahwa `coaPort` placeholder
    untuk fitur CoA Disconnect-Request future.
  - **#15 Sidebar refresh after toggle**: hook baru `useFullRadiusMode`
    + helper `dispatchFullRadiusModeChange()`. Saat user toggle di
    `Pengaturan → Umum`, event `fullRadiusMode:changed` mem-broadcast ke
    seluruh tab/window dan sidebar refresh tanpa F5.
- **Files**:
  `modules/network/repositories/AccelPppServerRepository.ts`,
  `modules/network/services/accel-ppp/AccelPppServerService.ts`,
  `modules/network/domain/entities/AccelPppServerEntity.ts`,
  `app/admin/network/accel-ppp/AccelPppServerForm.tsx`,
  `app/admin/network/accel-ppp/AccelPppServerList.tsx`,
  `app/admin/network/accel-ppp/[id]/AccelPppServerDetail.tsx`,
  `app/admin/network/accel-ppp/[id]/page.tsx`,
  `app/admin/network/accel-ppp/page.tsx`,
  `app/admin/network/accel-ppp/new/page.tsx`,
  `app/admin/network/accel-ppp/disabled/page.tsx`,
  `app/admin/network/accel-ppp/hooks.ts`,
  `components/layout/Sidebar.tsx`,
  `components/layout/admin-sidebar/adminSidebarMenu.ts`,
  `components/layout/admin-sidebar/useFilteredAdminMenu.ts`,
  `components/admin/settings/NetworkSettings.tsx`,
  `lib/hooks/useFullRadiusMode.ts`,
  `lib/menu-config.ts`,
  `docs/guides/accel-ppp-setup.md`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: halaman Purchase Request + landing hub (Sprint 2)

- **Tipe**: [ADDED]
- **Scope**: `app/admin/procurement`
- **Author**: agent
- **Deskripsi**: Tambah halaman read-only Purchase Request di
  `/admin/procurement/purchase-requests` dengan filter status/search,
  badge status & prioritas, link ke PO terkait, dan action multi-select
  untuk generate PO dari PR APPROVED. Landing page `/admin/procurement`
  dijadikan hub navigasi (sebelumnya `notFound`) — kartu menu untuk
  Supplier, PR, PO, dan Market Price. Lifecycle PR (create/approve/
  reject/process/receive) tetap di modul `inventory/restock`; halaman
  ini menyediakan view dari sudut procurement saja.
- **Files**: `app/admin/procurement/page.tsx`,
  `app/admin/procurement/purchase-requests/page.tsx`,
  `app/admin/procurement/purchase-requests/ProcurementPRListClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-24] — Procurement: Vendor Status + Dokumen Kelengkapan (Sprint 1)

- **Tipe**: [ADDED]
- **Scope**: `modules/procurement`, `app/admin/procurement/suppliers`, `app/api/admin/procurement/suppliers`, `app/api/admin/procurement/purchase-orders`
- **Author**: agent
- **Deskripsi**: Tambah lifecycle status (ACTIVE/INACTIVE/BLACKLISTED) dan
  field dokumen compliance (SIUP, NPWP scan, rekening pembayaran, kontrak)
  ke master Supplier. Guard di `PurchaseOrderService.create` dan
  `ProcurementService.generatePOFromPRs` reject PO baru ke supplier
  non-aktif via `SupplierNotActiveError` (HTTP 409). Status BLACKLISTED
  wajib menyertakan `blacklistReason` (validasi service + Zod). UI list
  supplier menampilkan badge status dan filter per status; form supplier
  punya section Status, Pajak & Compliance, Rekening, dan Kontrak.
- **Files**: `modules/procurement/domain/entities/Supplier.ts`,
  `modules/procurement/domain/ports/ISupplierRepository.ts`,
  `modules/procurement/repositories/SupplierRepository.ts`,
  `modules/procurement/dto/SupplierDTO.ts`,
  `modules/procurement/validators/supplier.ts`,
  `modules/procurement/services/SupplierService.ts`,
  `modules/procurement/services/PurchaseOrderService.ts`,
  `modules/procurement/services/ProcurementService.ts`,
  `app/admin/procurement/suppliers/SupplierForm.tsx`,
  `app/admin/procurement/suppliers/SupplierListClient.tsx`
- **Migration**: `20260524000000_add_supplier_status_and_documents`
- **Breaking**: ❌ Tidak (default `status = ACTIVE` untuk semua row existing)

### [2026-05-24] — Fix: UI toggle Full RADIUS Mode

- **Tipe**: [FIXED]
- **Scope**: `app/api/admin/settings/full-radius-mode/`, `components/admin/settings/NetworkSettings.tsx`
- **Author**: agent
- **Deskripsi**: Toggle global `FULL_RADIUS_MODE` sebelumnya hanya ada di
  service layer (M1) tanpa UI/endpoint, sehingga setting selalu OFF (default
  `undefined !== "true"`) dan API accel-ppp menolak semua request dengan 403
  walau modul sudah terdaftar. Diperbaiki dengan: (1) endpoint
  `GET/POST /api/admin/settings/full-radius-mode` yang panggil
  `getFullRadiusMode`/`setFullRadiusMode` dari `modules/settings`,
  (2) toggle UI di komponen `NetworkSettings` (halaman `Pengaturan → Umum`)
  dengan state lokal terpisah dari form general settings—save instan,
  tidak menyentuh field lain. Label dibuat eksplisit "Full RADIUS Mode
  (accel-ppp)" untuk membedakan dengan dropdown "Mode Koneksi PPP" yang
  scope-nya berbeda (auth strategy pelanggan, bukan toggle modul).
- **Files**:
  `app/api/admin/settings/full-radius-mode/route.ts`,
  `components/admin/settings/NetworkSettings.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Stabilkan quality gate (test/lint/typecheck/build)

- **Tipe**: [FIXED]
- **Scope**: `modules/feature-flags`, `modules/network`, `modules/notification`,
  `lib/cron-registry.ts`, `lib/security/requireFullRadiusMode.ts`,
  `app/api/mobile/chat/upload/`, `tests/`
- **Author**: agent
- **Deskripsi**: Perbaiki 17 test failure & 1 build warning untuk mengembalikan
  semua quality gate ke hijau. Akar masalah:
  (1) `modules/feature-flags/index.ts` mengekspos `FeatureFlagRepository` &
  `modules/network/index.ts` mengekspos `AccelPppServerRepository` — repository
  bukan public boundary, dihapus dari index.
  (2) `modules/notification/services/channel-router.ts` impor langsung
  `@/modules/pelanggan/services/...` dan `lib/security/requireFullRadiusMode.ts`
  impor `@/modules/network/domain/errors/...` — dipindah ke public API masing-
  masing modul untuk patuh module boundary.
  (3) `modules/feature-flags/domain/ports/IFeatureFlagRepository.ts` impor
  `@/lib/feature-modules` dari domain layer — domain harus pure, dipindah jadi
  type alias lokal.
  (4) `lib/cron-registry.ts` belum punya literal `await
  runAttendanceCronOrchestrator()` yang dijaga oleh test attendance
  orchestrator — disesuaikan agar inline.
  (5) Test monitor (RadiusMonitor/MikroTikMonitor) & worker
  (attendance/overtime auto-checkout) belum mock `@/lib/tenant-context` setelah
  monitor/worker migrasi pakai `runAsSystemContext` — ditambah mock pass-
  through.
  (6) Test `notifications-id-route` masih pakai pola lama (`requireAuth`)
  setelah route migrasi ke `createHandler` — ditulis ulang pakai pola bypass
  handler.
  (7) Test `notification-route-tenant-context` mengasumsikan tenant wrapping
  di route file langsung; setelah migrasi ke `createHandler`, kontrak digeser
  ke shared handler — test diupdate agar verify wrapping tetap dipertahankan
  di `lib/api/handler.ts`.
  (8) Test `admin-attendance-correct-missed-checkin-route` belum mock
  `buildTenantUploadDir` & belum tahu output path baru ber-namespace tenant.
  (9) Build Turbopack memunculkan warning NFT di `app/api/mobile/chat/upload/
  route.ts` karena `path.join(process.cwd(), dynamicDir)` — diberi anotasi
  `/*turbopackIgnore: true*/` agar tracker tidak menyapu seluruh project.
- **Files**:
  `modules/feature-flags/index.ts`,
  `modules/feature-flags/domain/ports/IFeatureFlagRepository.ts`,
  `modules/network/index.ts`,
  `modules/notification/services/channel-router.ts`,
  `lib/cron-registry.ts`,
  `lib/security/requireFullRadiusMode.ts`,
  `app/api/mobile/chat/upload/route.ts`,
  `tests/api/admin-attendance-correct-missed-checkin-route.test.ts`,
  `tests/api/notifications-id-route.test.ts`,
  `tests/lib/event-bus/attendance-auto-checkout-worker.test.ts`,
  `tests/lib/event-bus/overtime-auto-checkout-worker.test.ts`,
  `tests/modules/network/MikroTikMonitor.realtime.test.ts`,
  `tests/modules/network/RadiusMonitor.realtime.test.ts`,
  `tests/notification-route-tenant-context.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Accel-PPP FreeRADIUS bundle + setup guide (M7)

- **Tipe**: [DOCS]
- **Scope**: `freeradius-config/`, `docs/guides/`
- **Author**: agent
- **Deskripsi**: Tambah konfigurasi FreeRADIUS yang versioned di repo
  (`huntgroups`, `policy.d/per-nas-routing`, snippet `sites-available/default`)
  agar reply attribute spesifik per-NAS ter-inject saat coexist MikroTik dan
  accel-ppp. Bundle disertai README dengan langkah apply, validasi, dan
  troubleshooting umum. Buat panduan operator end-to-end di
  `docs/guides/accel-ppp-setup.md`: topologi, install accel-ppp + sample
  `accel-ppp.conf`, sinkronisasi nilai (`gw-ip-address` ↔ `nasname` ↔
  `ipAddress` di app, `radiusSecret` ↔ `[radius] server=`, `cliPassword`
  ↔ `[cli] password=`), prosedur registrasi via UI admin, verifikasi
  end-to-end (`radclient`, `freeradius -X`, dial PPPoE), operasi rutin (kick,
  monitor cron), dan tabel troubleshooting.
- **Files**:
  `freeradius-config/README.md`,
  `freeradius-config/huntgroups`,
  `freeradius-config/policy.d/per-nas-routing`,
  `freeradius-config/sites-available/default.snippet`,
  `docs/guides/accel-ppp-setup.md`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Accel-PPP admin UI (M6)

- **Tipe**: [ADDED]
- **Scope**: `app/admin/network/accel-ppp/`, `lib/menu-config.ts`
- **Author**: agent
- **Deskripsi**: Tambah halaman admin untuk modul accel-ppp: list, new (form),
  dan detail (tab Sessions Live + tab Edit). Sessions di-poll tiap 10 detik,
  dengan tombol kick langsung dari row. Hooks data-fetching sederhana
  (`useAccelPppServers`, `useAccelPppServer`, `useAccelPppSessions`) dibuat
  custom—tanpa TanStack Query—sesuai pola network module dan menghindari
  setState-in-effect violation lewat counter-tick refresh pattern. Mutations
  di-export sebagai object (`accelPppMutations.create/update/remove/
  testConnection/kick`) untuk dipakai komponen UI. Menu config `NETWORK.ACCEL_PPP`
  ditambah di sidebar admin (icon HiOutlineCpuChip).
- **Files**:
  `app/admin/network/accel-ppp/page.tsx`,
  `app/admin/network/accel-ppp/AccelPppServerList.tsx`,
  `app/admin/network/accel-ppp/AccelPppServerForm.tsx`,
  `app/admin/network/accel-ppp/hooks.ts`,
  `app/admin/network/accel-ppp/new/page.tsx`,
  `app/admin/network/accel-ppp/[id]/page.tsx`,
  `app/admin/network/accel-ppp/[id]/AccelPppServerDetail.tsx`,
  `lib/menu-config.ts`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Accel-PPP periodic health monitor (M5)

- **Tipe**: [ADDED]
- **Scope**: `modules/network/services/accel-ppp/`, `lib/cron-registry.ts`
- **Author**: agent
- **Deskripsi**: Tambah `AccelPppMonitor` yang dijalankan tiap 60 detik via
  `cron-registry`. Monitor iterasi seluruh accel-ppp server (lintas tenant)
  dengan `Promise.allSettled`—satu server hang tidak mengganggu yang lain.
  Liveness check dilakukan via CLI `show stat` (lebih kuat dari ICMP karena
  langsung membuktikan service responsif), lalu `pingStatus`/`userOnline`/
  `lastStatusCheck` di-persist ke DB. Multi-tenant aware: scoping per
  tenant via `runWithRequestTenantContext` supaya Prisma extension
  fail-closed tetap pass. CLI factory di-inject untuk memudahkan unit test.
  Disertai 4 unit test (empty, multi-server, isolation timeout, transition).
- **Files**:
  `modules/network/services/accel-ppp/AccelPppMonitor.ts`,
  `modules/network/index.ts`,
  `lib/cron-registry.ts`,
  `tests/modules/network/accel-ppp/unit/AccelPppMonitor.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Accel-PPP API routes + permission catalog (M4)

- **Tipe**: [ADDED]
- **Scope**: `app/api/admin/accel-ppp-servers/`, `lib/permission-config.ts`
- **Author**: agent
- **Deskripsi**: Tambah 5 endpoint admin untuk modul accel-ppp:
  `GET/POST /accel-ppp-servers`, `GET/PATCH/DELETE /accel-ppp-servers/[id]`,
  `POST /accel-ppp-servers/[id]/test-connection`,
  `GET /accel-ppp-servers/[id]/sessions`,
  `POST /accel-ppp-servers/[id]/sessions/[username]/kick`. Setiap handler
  panggil `requireFullRadiusMode()` dulu (403 bila toggle global OFF) lalu
  `hasPermission(...)` baru delegate ke `AccelPppServerService`. Tambah
  resource `accel_ppp` di `PERMISSION_GROUPS.NETWORK` dan granular
  `ACCEL_PPP_SESSION_KICK = "accel_ppp:session:kick"` untuk operasi kick
  yang sensitif. Helper `mapAccelPppErrorToResponse` dipakai semua handler
  untuk pemetaan domain error → status code yang konsisten (403/404/409/
  503/504). Disertai 10 unit test untuk error mapping helper.
- **Files**:
  `app/api/admin/accel-ppp-servers/route.ts`,
  `app/api/admin/accel-ppp-servers/_helpers.ts`,
  `app/api/admin/accel-ppp-servers/[id]/route.ts`,
  `app/api/admin/accel-ppp-servers/[id]/test-connection/route.ts`,
  `app/api/admin/accel-ppp-servers/[id]/sessions/route.ts`,
  `app/api/admin/accel-ppp-servers/[id]/sessions/[username]/kick/route.ts`,
  `lib/permission-config.ts`,
  `tests/modules/network/accel-ppp/unit/errorMapping.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Marketing: koreksi self-review

- **Tipe**: [FIXED]
- **Scope**: `modules/marketing`, `app/api/marketing/canvasing`, `tests/api`
- **Author**: agent
- **Deskripsi**: Koreksi setelah self-review menemukan tiga masalah dari
  perubahan medium/low sebelumnya.
  1. **Regresi response shape canvasing list**: route `GET /api/marketing/canvasing`
     setelah refactor saya bungkus dengan `apiSuccess(...)` (jadi `{success,data:{...}}`),
     padahal client di `app/admin/marketing/canvasing/useCanvasingListQuery.ts`
     membaca `data?.data` dan `data?.summary` di top-level. Dikembalikan ke
     `NextResponse.json(result.data)` agar contract tetap utuh.
  2. **Inkonsistensi typed error mapping**: PR sebelumnya hanya migrasi
     `mapCanvasingRouteError` ke `MarketingError`, sementara
     `mapPointClaimRouteError` dan `point-claim.service.helpers` masih
     `throw new Error(...)` + substring match. Kini seluruh helper
     point-claim pakai `MarketingError` dengan `kind`
     (`not_found | forbidden | invalid_status | validation`), dan mapper
     route point-claim switch by `error.kind`.
  3. **Test mock outdated**: `tests/api/marketing-canvasing-reject-route.test.ts`
     masih `mockRejectedValue(new Error("Hanya request PENDING ..."))`
     sehingga gagal setelah service mulai throw `MarketingError`. Test
     diupdate untuk pakai `MarketingError("invalid_status", ...)`.
- **Files**:
  - `app/api/marketing/canvasing/route.ts`
  - `modules/marketing/services/PointClaimService.ts`
  - `modules/marketing/services/point-claim.service.helpers.ts`
  - `modules/marketing/services/marketing-point-claim-route.helpers.ts`
  - `tests/api/marketing-canvasing-reject-route.test.ts`
- **Verifikasi**: `npm run typecheck` clean, `npm run lint` clean,
  46 test marketing passed.
- **Breaking**: ❌ Tidak — koreksi #1 memulihkan contract original yang
  sempat patah; #2 dan #3 internal.

### [2026-05-23] — Accel-PPP service layer + Full RADIUS Mode guard (M3)

- **Tipe**: [ADDED]
- **Scope**: `modules/network/services/accel-ppp/`, `lib/security/`
- **Author**: agent
- **Deskripsi**: Tambah `AccelPppServerService` sebagai orkestrator CRUD +
  operasi runtime accel-ppp. Service melakukan transactional create dengan
  rollback Prisma jika sinkronisasi NAS row ke FreeRADIUS DB gagal—berbeda
  dari pola legacy MikroTik yang menelan error sync. Operasi update otomatis
  re-sync NAS row hanya bila field NAS-relevan berubah (IP/secret/name/port/
  description). Delete default tolak server yang masih punya sesi aktif di
  `radacct`; bisa di-bypass dengan `force=true`. Operasi runtime (`getLiveSessions`,
  `getStat`, `kickSession`, `testConnection`) memakai `AccelPppCliClient`
  via injected factory supaya unit-test mudah. Tambah util
  `lib/security/requireFullRadiusMode` sebagai guard untuk dipanggil di awal
  setiap route handler accel-ppp—throw `FullRadiusModeDisabledError` saat
  toggle global OFF (akan dipetakan ke 403 di lapisan API). Disertai 10 unit
  test service yang mock repository + radius client + CLI client.
- **Files**:
  `modules/network/services/accel-ppp/AccelPppServerService.ts`,
  `lib/security/requireFullRadiusMode.ts`,
  `modules/network/index.ts`,
  `tests/modules/network/accel-ppp/unit/AccelPppServerService.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Accel-PPP CLI client (M2: parser + TCP socket client)

- **Tipe**: [ADDED]
- **Scope**: `modules/network/services/accel-ppp/`
- **Author**: agent
- **Deskripsi**: Tambah klien TCP CLI accel-ppp pada port 2001 dengan
  pemisahan tegas antara parser pure (text → DTO) dan layer socket I/O.
  Wire protocol mengikuti accel-cmd resmi: `<password>\n<command>\nexit\n`,
  baca semua stdout sampai server menutup koneksi. Klien ekspos
  `showSessions`, `showStat`, `terminateByUsername`, dan `ping`. Argument
  username di-sanitasi (whitelist alfanumerik+`._@-:`) untuk cegah CLI
  command injection. Domain errors dipakai untuk membedakan timeout,
  connection refused, command error, dan auth failure. Disertai 12 unit
  test parser dengan golden fixtures (multi/empty session, stat, terminate
  success/not-found, auth-failed) dan 8 integration test pakai `net.createServer`
  lokal—tanpa mock library—untuk memvalidasi flow connect/write/read/close.
- **Files**:
  `modules/network/services/accel-ppp/parsers.ts`,
  `modules/network/services/accel-ppp/AccelPppCliClient.ts`,
  `tests/modules/network/accel-ppp/fixtures/*.txt`,
  `tests/modules/network/accel-ppp/unit/parsers.test.ts`,
  `tests/modules/network/accel-ppp/integration.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Marketing: lanjutan review (medium & low)

- **Tipe**: [CHANGED]
- **Scope**: `modules/marketing`, `app/api/marketing`, `modules/work-order`
- **Author**: agent
- **Deskripsi**: Lanjutan dari hardening sebelumnya, menyentuh poin-poin
  medium/low di review awal.
  - **Orphan WorkOrder fix (#38)**: `cancelApproval` sekarang juga
    membatalkan WO terkait via `WorkOrderQueryService.cancel(reason, userId)`
    sehingga tidak ada WO yatim saat approval canvasing dibatalkan.
  - **Guard cashout (#29)**: `deleteClaim` menolak claim yang sudah
    `isCashedOut=true` selain APPROVED, agar komisi yang sudah masuk wallet
    mitra tidak hilang konteks asalnya.
  - **`MarketingCanvasingListRouteService` (#22)**: ekstrak permission/site
    scope dari `app/api/marketing/canvasing/route.ts` jadi service. Helper
    multi-site (`buildMultiSiteScope`) tetap dipakai. Route tinggal thin
    controller.
  - **`SalesAnalyticsRepository` (#24)**: tarik query `prisma.user`,
    `prisma.canvasing.groupBy`, `prisma.pointClaim.aggregate` dari
    `AdminSalesRouteService` ke repository baru — service kini bersih dari
    Prisma direct call dan ikut dependency rule.
  - **Robust technical department lookup (#33)**: pakai daftar kandidat
    case-insensitive (`Technical`, `Teknik`, `Teknisi`, `Engineering`)
    alih-alih literal exact match supaya tenant berbahasa Indonesia tetap
    dapat departmentId untuk INSTALLATION WO.
  - **Tightened typing (#28)**: `UpdatePointClaimInput.status` jadi union
    enum, `data: data as never` di `PointClaimRepository.update` diganti
    typed mapping ke `Prisma.PointClaimUpdateInput`.
  - **Strict create canvasing schema (#35)**: `createCanvasingSchema`
    pakai `.strict()` agar field di luar contract ditolak.
  - **Auth guard test endpoint (#36)**: `/api/marketing/test-canvasing`
    sekarang wajib super admin; sebelumnya bocor data ke unauthenticated.
  - **Typed error mapping (#37)**: tambah `MarketingError` (kind:
    `not_found | invalid_status | forbidden | validation`) di
    `modules/marketing/domain/errors/`. `mapCanvasingRouteError` &
    route approve/reject canvasing migrasi dari substring match
    error.message ke `isMarketingError(error)` + switch-by-kind. Lebih
    stabil terhadap perubahan wording pesan.
- **Dilewati**:
  - **#27** rename `pointClaims`→`pointClaim`: lapor saja, **tidak**
    dieksekusi karena field DTO sudah dipakai client UI (`app/admin/marketing`,
    mobile). Mengubahnya = breaking change yang lebih besar dari benefit.
- **Files**:
  - `modules/marketing/services/CanvasingService.ts`
  - `modules/marketing/services/MarketingCanvasingListRouteService.ts` (baru)
  - `modules/marketing/services/MarketingCanvasingDetailRouteService.ts`
  - `modules/marketing/services/marketing-canvasing-detail-route.helpers.ts`
  - `modules/marketing/services/AdminSalesRouteService.ts`
  - `modules/marketing/services/PointClaimService.ts`
  - `modules/marketing/services/canvasing.service.helpers.ts`
  - `modules/marketing/repositories/SalesAnalyticsRepository.ts` (baru)
  - `modules/marketing/repositories/PointClaimRepository.ts`
  - `modules/marketing/domain/errors/MarketingError.ts` (baru)
  - `modules/marketing/domain/ports/IPointClaimRepository.ts`
  - `modules/marketing/validators/canvasingValidation.ts`
  - `modules/marketing/index.ts`
  - `modules/work-order/services/WorkOrderQueryService.ts`
  - `app/api/marketing/canvasing/route.ts`
  - `app/api/marketing/canvasing/[id]/approve/route.ts`
  - `app/api/marketing/canvasing/[id]/reject/route.ts`
  - `app/api/marketing/test-canvasing/route.ts`
- **Verifikasi**: `npm run typecheck` clean, `npm run lint` clean,
  `npm run build` sukses.
- **Breaking**: ❌ Tidak — DTO `CanvasingListItemDTO`/`CanvasingDetailDTO`
  tetap utuh, response shape route tidak berubah, behavior auth pada
  test-canvasing memang sebelumnya security gap (sekarang ditutup).

### [2026-05-23] — Foundation accel-ppp server (M1: schema, domain, repository, settings)

- **Tipe**: [ADDED]
- **Scope**: `modules/network`, `modules/settings`, `prisma/`
- **Author**: agent
- **Deskripsi**: Tambah pondasi modul accel-ppp pada strategi coexist dengan MikroTik.
  Mencakup model `AccelPppServer`, domain entity + port repository, 8 domain error
  class (`FullRadiusModeDisabledError`, `AccelPppServerNotFoundError`,
  `AccelPppDuplicateIpError`, `AccelPppCliConnectionError`,
  `AccelPppCliCommandError`, `AccelPppCliTimeoutError`,
  `AccelPppRadiusNasSyncError`, `AccelPppSessionNotFoundError`), validator Zod,
  serta `AccelPppServerRepository` dengan auto encrypt/decrypt secrets via
  `encryptApiKey/decryptApiKey` (lebih kuat dari pola legacy MikroTik plain text).
  Tambah service `fullRadiusModeSettings` di `modules/settings` (key
  `FULL_RADIUS_MODE` di tabel `Settings`) sebagai single switch global.
- **Files**:
  `modules/network/domain/entities/AccelPppServerEntity.ts`,
  `modules/network/domain/ports/IAccelPppServerRepository.ts`,
  `modules/network/domain/errors/AccelPppErrors.ts`,
  `modules/network/validators/accelPppServer.ts`,
  `modules/network/repositories/AccelPppServerRepository.ts`,
  `modules/network/index.ts`,
  `modules/settings/services/fullRadiusModeSettings.ts`,
  `modules/settings/index.ts`,
  `prisma/schema.prisma`
- **Migration**: `20260523180000_add_accel_ppp_server`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Marketing: hardening, transaksi, & route service point claim

- **Tipe**: [CHANGED]
- **Scope**: `modules/marketing`, `app/api/marketing`
- **Author**: agent
- **Deskripsi**: Tujuh perbaikan modul pemasaran sesuai temuan review.
  1. Tenant scoping: `getTechnicalDepartmentId` pindah dari `prismaAuth`
     (bypass) ke `prisma` agar ikut auto-isolation Prisma extension. Repository
     `Canvasing` & `PointClaim` sebenarnya sudah ter-scope via
     `withTenantIsolation` (model tidak di `ignoreModels`), jadi tidak ada
     manual `tenantId` filter yang ditambahkan.
  2. Multi-site bug: route `app/api/marketing/canvasing/route.ts` sebelumnya
     hanya pakai `siteIds[0]` saat user punya banyak site → data site lain
     tersembunyi. Sekarang pakai `siteIds: { in }` lewat helper
     `buildMultiSiteScope` baru di `canvasing.repository.helpers.ts`.
  3. Transaksi multi-write: `submitClaim` (create + lock canvasing),
     `rejectClaim` (update + unlock), `deleteClaim` (delete + unlock), dan
     `cashoutAccumulatedClaims` (`updateMany`) di-wrap satu transaksi.
     `approveRequest` Canvasing dapat kompensasi rollback (delete WO) bila
     `canvasing.update` gagal — full prisma transaction tidak feasible
     karena WO menyebrang modul.
  4. Reject claim: dari DELETE row jadi UPDATE status REJECTED + reviewer +
     notes. Audit trail kini terjaga.
  5. `MarketingPointClaimRouteService` baru: tarik logika permission, error
     mapping, dan validasi dari 5 route handler (`point-claims/route.ts`,
     `[id]/route.ts`, `summary/route.ts`, `canvasing/[id]/claim/route.ts`,
     `claims/cashout/route.ts`) ke service dengan typed `Result` (sejalan
     `MarketingCanvasingDetailRouteService`). Pesan error tidak lagi bocor
     nama permission internal.
  6. Magic number poin & cashout dipindah ke `modules/marketing/config/marketing-points.ts`
     (WO_IN_PROGRESS_POINT, WO_COMPLETED_POINT, APPROVED_CLAIM_POINT,
     DEFAULT_POINT_VALUE, CASHOUT_DEFAULT_TARGET, ACCUMULATED_TARGET_SCHEMA,
     COMPLETED/IN_PROGRESS_WORK_ORDER_STATUSES). Mempersiapkan tuning
     per-tenant.
  7. Cleanup: `MarketingFactory.ts` (dead, tidak di-import siapa pun) dihapus
     bersama folder `factories/`. `getUserFeaturesWithCanvasing` masih
     dipakai mobile auth, tag `@deprecated` dihapus karena memang masih
     load-bearing.
- **Files**:
  - `modules/marketing/services/canvasing.service.helpers.ts`
  - `modules/marketing/services/CanvasingService.ts`
  - `modules/marketing/services/PointClaimService.ts`
  - `modules/marketing/services/point-claim.service.helpers.ts`
  - `modules/marketing/services/MarketingPointClaimRouteService.ts` (baru)
  - `modules/marketing/services/marketing-point-claim-route.helpers.ts` (baru)
  - `modules/marketing/services/CanvasingAccessService.ts`
  - `modules/marketing/repositories/PointClaimRepository.ts`
  - `modules/marketing/repositories/canvasing.repository.helpers.ts`
  - `modules/marketing/domain/ports/IPointClaimRepository.ts`
  - `modules/marketing/domain/ports/ICanvasingRepository.ts`
  - `modules/marketing/config/marketing-points.ts` (baru)
  - `modules/marketing/mappers/marketing-canvasing.mapper.ts`
  - `modules/marketing/index.ts`
  - `modules/work-order/services/WorkOrderQueryService.ts`
  - `app/api/marketing/canvasing/route.ts`
  - `app/api/marketing/canvasing/[id]/claim/route.ts`
  - `app/api/marketing/claims/cashout/route.ts`
  - `app/api/marketing/point-claims/route.ts`
  - `app/api/marketing/point-claims/[id]/route.ts`
  - `app/api/marketing/point-claims/summary/route.ts`
  - `modules/marketing/factories/MarketingFactory.ts` (dihapus)
- **Verifikasi**: `npm run typecheck` clean, `npm run lint` clean,
  `npm run build` sukses.
- **Breaking**: ❌ Tidak — semua kontrak API & response shape dipertahankan;
  reject claim tetap return DTO dengan struktur sama (sebelumnya in-memory,
  sekarang dari row update).


### [2026-05-23] — Feature flag: unit test & tag API representative

- **Tipe**: [ADDED]
- **Scope**: `tests/modules/feature-flags`, `app/api/admin/{accounting,marketing,salary,tax,investors,payment-gateway,chat}`
- **Author**: agent
- **Deskripsi**: (1) Unit test `FeatureFlagService` dengan mocked repository — 12 test mencakup default-enabled behavior, explicit disable, cache hit/invalidation, isolasi cache per-tenant, getDisabledFeatures filter, getCatalogForTenant merge, dan setBatch. (2) Tag opsi `feature` di route inti tiap module domain sebagai proof-of-concept incremental adoption: `accounting/coa` (GET+POST), `marketing/sales-dashboard` (manual gate karena pakai `requireAdmin`), `salary/components` (GET+POST), `tax/transactions` (GET), `investors` (GET+POST), `payment-gateway/configs` (GET), `chat/conversations` (GET+POST). Route lain dapat di-tag bertahap saat di-sentuh.
- **Files**:
  - `tests/modules/feature-flags/FeatureFlagService.test.ts` (NEW)
  - `app/api/admin/accounting/coa/route.ts` (tag GET+POST)
  - `app/api/admin/marketing/sales-dashboard/route.ts` (manual gate via getFeatureFlagService)
  - `app/api/admin/salary/components/route.ts` (tag GET+POST)
  - `app/api/admin/tax/transactions/route.ts` (tag GET, fix indentasi)
  - `app/api/admin/investors/route.ts` (tag GET+POST)
  - `app/api/admin/payment-gateway/configs/route.ts` (tag GET)
  - `app/api/admin/chat/conversations/route.ts` (tag GET+POST)
- **Breaking**: ❌ Tidak — feature flag default open untuk tenant existing; gate hanya aktif setelah super admin disable modul.

### [2026-05-23] — Per-tenant feature flag (module-level menu customization)

- **Tipe**: [ADDED]
- **Scope**: `lib/`, `modules/feature-flags`, `contexts/`, `app/api/tenant/feature-flags`, `app/api/admin/tenants/[id]/feature-flags`, `app/admin/tenants/[id]/features`, `prisma/`
- **Author**: agent
- **Deskripsi**: Sistem feature flag tingkat module per tenant. Super admin dapat enable/disable modul (akuntansi, marketing, work-order, salary, dst) per tenant agar menu sidebar dan akses API terkunci sesuai paket / kebutuhan tenant. Default behavior: tenant baru otomatis dapat semua modul (no row di tabel = enabled). Disable hanya direpresentasikan oleh row eksplisit `enabled: false`. RBAC tetap menangani granular permission dalam suatu module yang aktif.
  - **Module catalog** `lib/feature-modules.ts`: 26 modul domain (network, olt, pelanggan, work-order, finance, accounting, dst), grouped (core/operasional/keuangan/sdm/lainnya), const tuple dengan `FeatureModuleCode` type union.
  - **Schema** `TenantFeatureFlag(tenantId, feature, enabled, updatedBy, ...)` + relasi cascade ke `Tenant`. Migration: `20260523173439_add_tenant_feature_flag`.
  - **Module Clean Architecture** `modules/feature-flags/` (domain port, repository, service, dto, validator, index). Caching pakai `lib/cache.ts` tenant-aware (TTL 5 menit, invalidate per-tenant on update).
  - **Backend gate**: `HandlerOptions.feature` di `lib/api/handler.ts` & `SecureOptions.feature` di `lib/api/secure-handler.ts`. Super admin bypass. Pemakaian opsional per route (incremental adoption).
  - **Frontend**: `MenuConfig.featureModule?` di `lib/menu-config.ts` (tagged 13 menu utama: NETWORK, OLT, PELANGGAN, WORKORDERS, INVENTORY, USERS, INVESTORS, KEHADIRAN, SALARY, MARKETING, FINANCE, ACCOUNTING, TAX, CHAT, INTEGRATION). `contexts/FeatureFlagsContext.tsx` fetch `/api/tenant/feature-flags`, hook `useFeatureFlags()`. Sidebar filter via `adminSidebarMenu.ts` (parameter `isFeatureEnabled`).
  - **API endpoints**: `GET /api/tenant/feature-flags` (user aktif), `GET/PATCH /api/admin/tenants/[id]/feature-flags` (super admin only).
  - **Super admin UI**: `/admin/tenants/[id]/features` — tabel toggle per modul dengan grouping dan batch save. Tombol "Atur Modul" ditambah di `TenantList.tsx`.
  - **Audit**: `updatedBy` disimpan per row; `logger.info` setiap toggle.
- **Files**:
  - `lib/feature-modules.ts` (NEW)
  - `lib/menu-config.ts` (tag `featureModule` di 13 menu utama)
  - `lib/api/handler.ts`, `lib/api/secure-handler.ts` (gate)
  - `prisma/schema.prisma` + `prisma/migrations/20260523173439_add_tenant_feature_flag/`
  - `modules/feature-flags/{domain/ports,repositories,services,dto,validators,index.ts}` (NEW)
  - `contexts/FeatureFlagsContext.tsx` (NEW)
  - `components/layout/admin-sidebar/{adminSidebarMenu,useFilteredAdminMenu}.ts` (filter)
  - `components/layout/Sidebar.tsx` (inject hook)
  - `app/admin/layout.tsx` (wrap `FeatureFlagsProvider`)
  - `app/admin/tenants/{TenantList.tsx,[id]/features/{page,TenantFeaturesClient}.tsx}` (UI)
  - `app/api/{tenant/feature-flags/route.ts,admin/tenants/[id]/feature-flags/route.ts}` (NEW)
- **Migration**: `20260523173439_add_tenant_feature_flag`
- **Breaking**: ❌ Tidak — tenant existing langsung enabled untuk semua modul (no row = enabled by default). Pemakaian gate di route handler bersifat opt-in incremental.

### [2026-05-23] — Review modul mitra: hardening multi-tenant, race wallet/withdraw, silent failure

- **Tipe**: [SECURITY]
- **Scope**: `modules/mitra`, `app/api/admin/mitra`, `app/api/mobile/mitra`, `app/mitra-id`
- **Author**: agent
- **Deskripsi**: Hasil review menyeluruh modul mitra. Memperbaiki beberapa lubang multi-tenant
  (admin tenant lain bisa membaca/mengubah mitra, withdrawal, atau sync komisi tanpa filter
  `tenantId`), menutup race condition wallet & withdraw, menghilangkan silent failure event,
  dan migrasi service yang masih pola lama.
  - Multi-tenant: route `[id]/route.ts`, `[id]/face-verifications`, `[id]/wallet`,
    `withdrawals/route.ts`, `withdrawals/[id]/route.ts`, dan `sync-commissions/route.ts`
    sekarang **selalu meneruskan `user.tenantId`** ke service. `MitraCommissionSyncService`
    menambahkan guard `assertMitraInTenant` untuk menolak sync ke mitra di luar tenant pemanggil.
  - Race wallet: `findOrCreateWalletTx` & `ensureWalletExistsTx` sekarang pakai
    `prisma.mitraWallet.upsert` (mengandalkan `mitraId @unique`) untuk menghilangkan window
    duplicate-create antar transaksi paralel.
  - Race withdraw: `MitraWithdrawRepository.createWithdrawRequestAtomic` baru — memvalidasi
    saldo dan jumlah pending **di dalam satu transaksi DB** lalu insert. `MitraWithdrawService.requestWithdraw`
    direfactor untuk memakainya, sehingga dua POST `/withdraw` paralel tidak bisa lolos
    pengecekan pending=0 secara berbarengan. Helper `getWalletValidationError`/`validateWalletBasics`
    yang sudah usang dihapus.
  - Silent failure: event `MITRA_WITHDRAWAL_COMPLETED` tidak lagi ditelan dengan
    `.catch(() => {})`. Kegagalan publish di-log via `logWithdrawServiceError` agar tetap
    terlacak.
  - Sync I/O: `saveFaceVerificationPhoto` di `MobileMitraRouteService.helpers` migrasi dari
    `fs.mkdirSync`/`fs.writeFileSync` ke `fs/promises` agar tidak memblok event loop di
    Node runtime.
  - Validasi: `MitraCommissionSyncService.validateInput` mengganti truthy-check `amount`
    dengan `validatePositiveAmount` (mencegah amount negatif). `MitraWalletService.addAdjustment`
    menambahkan guard `Number.isFinite(amount) && amount !== 0`.
  - Pola lama → baru: `MitraIdCardService` sekarang pakai factory `getMitraIdCardService()`
    + injeksi via `getMitraRepository()`, menggantikan instance const lama. Caller di
    `app/mitra-id/[id]/page.tsx` ikut diupdate.
  - Konsistensi mobile route: `dashboard/route.ts`, `wallet/route.ts`, `withdraw/route.ts`,
    dan `verify-face/route.ts` tidak lagi mengeksekusi `getMobileMitraRouteService()` di
    module top-level (eager init); diubah jadi lazy. `parseInt` page param diberi NaN guard.
- **Files**:
  `modules/mitra/services/MitraWithdrawService.ts`,
  `modules/mitra/services/MitraWithdrawService.helpers.ts`,
  `modules/mitra/services/MitraCommissionSyncService.ts`,
  `modules/mitra/services/MitraWalletService.ts`,
  `modules/mitra/services/MitraIdCardService.ts`,
  `modules/mitra/services/MobileMitraRouteService.helpers.ts`,
  `modules/mitra/repositories/MitraWalletRepository.ts`,
  `modules/mitra/repositories/MitraWithdrawRepository.ts`,
  `modules/mitra/repositories/MitraRepository.helpers.ts`,
  `modules/mitra/domain/ports/IMitraWithdrawRepository.ts`,
  `modules/mitra/index.ts`,
  `app/api/admin/mitra/[id]/route.ts`,
  `app/api/admin/mitra/[id]/face-verifications/route.ts`,
  `app/api/admin/mitra/[id]/wallet/route.ts`,
  `app/api/admin/mitra/withdrawals/route.ts`,
  `app/api/admin/mitra/withdrawals/[id]/route.ts`,
  `app/api/admin/mitra/sync-commissions/route.ts`,
  `app/api/mobile/mitra/dashboard/route.ts`,
  `app/api/mobile/mitra/wallet/route.ts`,
  `app/api/mobile/mitra/withdraw/route.ts`,
  `app/api/mobile/mitra/verify-face/route.ts`,
  `app/mitra-id/[id]/page.tsx`
- **Breaking**: ❌ Tidak (signature publik service tetap; `mitraIdCardService` const lama
  diganti oleh factory `getMitraIdCardService()` — caller internal sudah diupdate)

### [2026-05-23] — Acknowledge safe-guard untuk migration OLT enum & multi-tenancy

- **Tipe**: [FIXED]
- **Scope**: `prisma/migrations/`
- **Author**: agent
- **Deskripsi**: Pipeline staging gagal di stage Database Migration karena Safe Migration Guard memblokir 2 file migration OLT akibat pattern `ALTER TABLE ... ALTER COLUMN ...` yang dianggap destruktif. Faktanya kedua migration non-destruktif (TEXT → ENUM via `USING ::enum` cast yang preserve data + fail-loud guard, plus `DROP NOT NULL` & re-scope unique index per-tenant). Ditambahkan acknowledgment `-- @safe-guard-ack: <alasan>` di baris pertama tiap file sesuai mekanisme bypass yang sudah disediakan pipeline.
- **Files**: `prisma/migrations/20260522166000_olt_module_enums_and_schema_evolve/migration.sql`, `prisma/migrations/20260522170000_olt_multi_tenancy_hardening/migration.sql`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Tambah policy Prisma Schema & Migration di CLAUDE.md

- **Tipe**: [DOCS]
- **Scope**: `docs/`
- **Author**: agent
- **Deskripsi**: Tambah section `Prisma Schema & Migration Policy — STRICTLY ENFORCED`
  di `CLAUDE.md` untuk mewajibkan generate migration setiap perubahan
  `prisma/schema.prisma`. Mencakup workflow standar (edit schema → `prisma migrate
  dev` → verifikasi SQL → generate client → commit schema + migration bersamaan),
  larangan `db push` untuk perubahan yang akan masuk produksi, aturan penamaan
  migration deskriptif, strategi multi-step untuk perubahan destruktif, dan referensi
  ke `prisma migrate deploy` saat deployment produksi. Tujuan: mencegah drift antara
  Prisma client lokal dengan database produksi karena schema diubah tanpa migration
  pasangan-nya.
- **Files**: `CLAUDE.md`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Tenant isolation hardening (medium): error masking, IS_SEEDING guard, audit script, bare-domain guard

- **Tipe**: [SECURITY]
- **Scope**: `lib/`, `scripts/`
- **Author**: agent
- **Deskripsi**: Empat perbaikan keamanan multi-tenant tingkat medium. (1) **Error masking**: `lib/prisma-extension.ts` mengganti `throw new Error("Security Breach: ...")` dengan class internal `TenantContextError`. Centralized error handler di `lib/api/handler.ts`, `lib/api/secure-handler.ts`, dan `lib/middleware/error-handler.ts` menerjemahkannya ke 500 generik tanpa membocorkan pesan internal — detail hanya masuk ke logger. (2) **IS_SEEDING production guard**: `prisma-extension` sekarang menolak (throw) ketika `IS_SEEDING=true` aktif di `NODE_ENV=production` — mencegah ENV bocor ke pod produksi membatalkan seluruh isolasi. Sekaligus refactor `lib/logger.ts` (`logActivity`/`logAuth`) yang dulu memanipulasi `process.env.IS_SEEDING` (race-prone, global state) menjadi pakai `runAsSystemContext()` (AsyncLocalStorage). (3) **Audit script** baru `scripts/audit-global-reference-rows.ts` melaporkan jumlah dan sample row Role/Departments/Sites yang `tenantId: null`; bisa dijadwalkan rutin untuk deteksi anomali. (4) **Bare-domain guard**: localhost dan bare/apex domain (`radpro.id`) tidak lagi otomatis di-mapping ke `MAIN_TENANT_ID` di `NODE_ENV=production`. Bare domain wajib opt-in via ENV `ALLOW_BARE_DOMAIN_AS_MAIN_TENANT=true` agar misconfiguration ingress tidak menyaru sebagai akses tenant utama.
- **Files**:
  - `lib/prisma-extension.ts` (`TenantContextError` class, IS_SEEDING production guard)
  - `lib/api/handler.ts` (mask `TenantContextError`)
  - `lib/api/secure-handler.ts` (mask `TenantContextError`)
  - `lib/middleware/error-handler.ts` (mask `TenantContextError`)
  - `lib/logger.ts` (refactor `logActivity`/`logAuth` ke `runAsSystemContext`)
  - `lib/tenant-context.ts` (localhost & bare-domain guard di production)
  - `scripts/audit-global-reference-rows.ts` (NEW)
- **Breaking**: ❌ Tidak — selama `NODE_ENV=production` tidak men-set `IS_SEEDING=true` dan ingress production tidak mengandalkan auto-map bare domain (yang memang tidak seharusnya). Untuk environment yang masih perlu, set `ALLOW_BARE_DOMAIN_AS_MAIN_TENANT=true`.

### [2026-05-23] — Refactor & hardening modul notification (P0–P2)

- **Tipe**: [CHANGED]
- **Scope**: `modules/notification`, `modules/pelanggan`, `modules/attendance`, `app/api/notifications`, `app/api/admin/notifications/monitoring`, `app/api/cron/cleanup-notification-logs`, `lib/api/handler.ts`
- **Author**: agent
- **Deskripsi**: Hasil review komprehensif modul notification — perbaikan pelanggaran dependency rule, module boundary, race condition, multi-tenant isolation, dan inkonsistensi pola route.
  - **P0-1**: `channel-router.ts` tidak lagi query Prisma langsung dan tidak lagi cross-module access ke tabel `pelanggan`. Diperkenalkan port `IPelangganContactPort` di `modules/notification/domain/ports` + adapter `PelangganContactService` yang diekspos via `modules/pelanggan/index.ts`. `resolveCustomerContact` menerima port via DI (default = adapter).
  - **P0-2**: `DeadLetterService` tidak lagi bypass repository. Direfactor menjadi class `DeadLetterService` (DI repo + dispatcher factory) dengan backward-compatible function exports. Sekaligus memperbaiki **P1-9** race condition pada `retryDeadLetter`/`resolveDeadLetter` melalui atomic conditional update `markResolvedIfPending` di `NotificationDeadLetterRepository`.
  - **P0-3**: Hapus `NotificationReadService.ts` (duplikat `NotificationService.ts`). `modules/notification/api.ts` migrasi ke `NotificationService` langsung.
  - **P0-4**: `AnnouncementService.getMobileAnnouncements` tidak lagi bypass injected repository. Ditambahkan method `findMobileItems` di `IAnnouncementRepository` + entity `AnnouncementMobileItemEntity`.
  - **P0-5**: Hapus export `EmailDeliveryLogRepository` dan `NotificationDeadLetterRepository` dari public API modul (`index.ts`) — repository tidak boleh jadi public boundary.
  - **P1-2**: `ExpoPushService.sendPushToDepartment` filter `pushToken` null sebelum kirim ke Expo (hindari kirim token null).
  - **P1-4**: `WhatsAppService` menerima `tenantId` via constructor; `findManyByKeys` di `AttendanceSettingsService`/`SettingsRepository`/`ISettingsRepository` menerima param `tenantId` opsional → mencegah cross-tenant credential leak untuk WhatsApp API key/Wablas device. `NotificationDispatcher.sendWhatsApp` mem-pass `contact.tenantId`.
  - **P1-5**: Route `app/api/admin/notifications/monitoring` migrasi dari `ensureAdminAccess` ke `createHandler({ auth: true, permissions: ["notifications:read"] })`.
  - **P1-6/7**: Route `app/api/notifications/route.ts`, `[id]/route.ts`, `[id]/read/route.ts`, `unread-count/route.ts` migrasi penuh ke `createHandler` + `apiSuccess/ApiErrors`. `unread-count` tidak lagi swallow error menjadi `count: 0`.
  - **P1-8**: `PushRetryQueue` mendapatkan `requeueStuckProcessingItems(thresholdMs)` untuk pemulihan item yang macet di `RETRY_PROCESSING_KEY` (mis. crash setelah `rpoplpush` sebelum `removeProcessingItem`). Dipanggil dari cron `cleanup-notification-logs`.
  - **P2**: hapus `validators/index.ts` kosong; magic number `100` ms di `whatsapp-sender.service.ts` jadi `BROADCAST_INTER_MESSAGE_DELAY_MS`; hapus empty `if (result.success) {}` di `whatsapp-service.ts` (`sendMessage`/`sendFile`); `notifyHolidayCreated` pakai chunked batching (50 per batch) untuk menghindari connection pool exhaustion.
  - **Bug fix bonus**: `lib/api/handler.ts` tidak meneruskan `departmentId` dari NextAuth session ke `ctx.session.user.departmentId` — diperbaiki agar route yang butuh departmentId-aware scoping berfungsi. Tipe `HandlerContext.session.user` ditambahkan `departmentId?: string`.
- **Files**: `modules/notification/services/{channel-router,DeadLetterService,NotificationDispatcher,NotificationService,AnnouncementService,ExpoPushService,PushRetryQueue,whatsapp-sender.service,whatsapp/whatsapp-service,whatsapp/whatsapp-throttler}.ts`, `modules/notification/repositories/{NotificationDeadLetterRepository,AnnouncementRepository}.ts`, `modules/notification/domain/{entities/AnnouncementEntity,ports/IAnnouncementRepository,ports/IPelangganContactPort}.ts`, `modules/notification/{api,index}.ts`, `modules/pelanggan/{index.ts,services/PelangganContactService.ts}`, `modules/attendance/{services/AttendanceSettingsService,repositories/SettingsRepository,domain/ports/ISettingsRepository}.ts`, `app/api/notifications/{route,[id]/route,[id]/read/route,unread-count/route}.ts`, `app/api/admin/notifications/monitoring/route.ts`, `app/api/cron/cleanup-notification-logs/route.ts`, `lib/api/handler.ts`, `tests/api/notifications-{route,unread-count-route}.test.ts`
- **Breaking**: ❌ Tidak (backward-compatible — function exports `listNotificationDeadLetters/resolveDeadLetter/retryDeadLetter` tetap, signature `findManyByKeys` tambah param opsional)

### [2026-05-23] — Tenant isolation hardening: bypass, cross-check, namespace cache/rate-limit/upload

- **Tipe**: [SECURITY]
- **Scope**: `lib/`, `modules/network`, `modules/notification`, `app/api/upload`, `app/api/admin/profile/photo`, `app/api/admin/attendance`, `app/api/map/upload`, `app/api/mobile`
- **Author**: agent
- **Deskripsi**: Lima perbaikan keamanan multi-tenant. (1) **IS_CUSTOM_SERVER bypass**: `getTenantIdFromContext()` tidak lagi otomatis mengembalikan `isSuperAdmin: true` ketika dipanggil dari custom server tanpa request context — sebelumnya setiap handler Socket.IO/cron yang lupa wrap konteks otomatis berjalan lintas tenant. Default kini fail-closed; tambah utilitas eksplisit `runAsSystemContext(reason, fn)` yang wajib dipakai oleh kode background, dengan logging untuk audit. Cron registry, RadiusMonitor, MikroTikMonitor, mikrotik-ping-check, OLT monitoring, PushRetryQueue, outbox processor, dan BullMQ workers diperbarui agar wrap konteks secara eksplisit. (2) **Session/host cross-check**: setelah resolve tenant dari NextAuth/mobile JWT/investor cookie/customer cookie, divalidasi terhadap tenant dari host (subdomain/custom domain). Jika user tenant A mengakses domain tenant B dan bukan superadmin → context dikosongkan (fail-closed) untuk mencegah confused-deputy attack. (3) **Cache key tenant namespace**: `lib/cache.ts` menambah API tenant-aware (`tenantCacheKey`, `globalCacheKey`, `setForTenant`, `getForTenant`, `invalidateTenant`) sehingga konsumen tidak lagi berbagi bucket lintas tenant untuk key generik. (4) **Redis rate limit**: `checkRateLimit`/`checkDelay` kini wajib menerima `tenantId` (atau `null` → bucket "global"); ditambah opsi `failClosed` untuk endpoint sensitif (`RateLimits.LOGIN`) agar Redis outage tidak membuka jalan brute-force lintas tenant. (5) **Upload path tenant namespace**: helper `buildTenantUploadDir()` menyisipkan segmen `tenants/{tenantId}/` ke `public/uploads/...` dan dipakai di endpoint upload generic, profile photo (admin & mobile), map upload, chat upload, attendance correction, dan overtime — mencegah collision filename serta akses lintas tenant via static URL.
- **Files**:
  - `lib/tenant-context.ts` (`runAsSystemContext`, `enforceSessionHostMatch`, fail-closed default)
  - `lib/cron-registry.ts` (`runCronTask` wrapper untuk semua cron callback)
  - `lib/event-bus/workers.ts` (`withTenantContext` BullMQ adapter)
  - `lib/event-bus/outbox-processor.ts` (wrap polling dengan `runAsSystemContext`)
  - `lib/event-bus/index.ts` (rehydrate jobs di system context)
  - `lib/redis.ts` (`checkRateLimit`/`checkDelay` namespace + `failClosed`)
  - `lib/middleware/rate-limit.ts` (forward tenantId & failClosed; `RateLimits.LOGIN.failClosed: true`)
  - `lib/cache.ts` (`tenantCacheKey`, `globalCacheKey`, `setForTenant`, `getForTenant`, `invalidateTenant`)
  - `lib/upload/upload-policy.ts` (`buildTenantUploadDir`, `sanitizeTenantUploadSegment`)
  - `modules/network/services/{RadiusMonitor,MikroTikMonitor,mikrotik-ping-check}.ts` (per-tenant context loop)
  - `modules/notification/services/PushRetryQueue.ts` (system context untuk processor)
  - `app/api/upload/route.ts`, `app/api/admin/profile/photo/route.ts`, `app/api/mobile/profile/photo/route.ts`, `app/api/admin/attendance/[id]/correct-missed-checkin/route.ts`, `app/api/map/upload/route.ts`, `app/api/mobile/chat/upload/route.ts`, `app/api/mobile/overtime/route.ts` (tenant-namespaced upload dir)
- **Breaking**: ✅ Ya — (a) `checkRateLimit`/`checkDelay` di `lib/redis.ts` mengubah signature: parameter ke-4 berupa `RateLimitOptions { tenantId: string | null, failClosed?: boolean }`. Pemanggil di luar `lib/middleware/rate-limit.ts` perlu disesuaikan. (b) Path upload pindah dari `public/uploads/{folder}/...` ke `public/uploads/tenants/{tenantId}/{folder}/...` untuk endpoint yang dimigrasi — file yang sudah ada di path lama tetap dapat diakses (tidak dipindah otomatis), tetapi upload baru memakai struktur baru. (c) Custom server entrypoint yang query Prisma harus eksplisit `runAsSystemContext()` atau `runWithRequestTenantContext()` — fail-closed jika tidak.

### [2026-05-23] — Procurement: API listing PR + batch generate PO from PR

- **Tipe**: [ADDED]
- **Scope**: `modules/procurement`, `app/api/admin/procurement`
- **Author**: agent
- **Deskripsi**: Dua endpoint procurement-side untuk PR. (1) `GET /api/admin/procurement/purchase-requests` — listing read-only PR (paginated, filter by status & search nomor) untuk view procurement; lifecycle PR (approve/reject/process/receive) tetap dimiliki modul inventory/restock. (2) `POST /api/admin/procurement/purchase-orders/from-pr` — batch generate PO dari sekumpulan PR APPROVED dengan optional `overrideSupplierId`, melengkapi auto-generate per-1-PR yang sudah ada di restock approve flow. Sub-tugas pendukung: (a) `RestockRequestLifecycleService` di inventory pakai DI constructor untuk `ProcurementService` (singleton module-level dihapus). (b) `ProcurementRepository.listPurchaseRequests` baru. (c) Klarifikasi semantik di komentar `PurchaseOrderService` & `index.ts`: "vendor" === "supplier", `vendorNpwp` adalah snapshot dari `Supplier.npwp` saat PO dibuat.
- **Files**:
  - `modules/procurement/index.ts` (export `getProcurementService`, validator + DTO PR)
  - `modules/procurement/services/ProcurementService.ts` (`listPurchaseRequests`)
  - `modules/procurement/services/PurchaseOrderService.ts` (komentar)
  - `modules/procurement/repositories/ProcurementRepository.ts` (`listPurchaseRequests`)
  - `modules/procurement/domain/ports/IProcurementRepository.ts` (port baru)
  - `modules/procurement/domain/entities/PurchaseRequest.ts` (`PurchaseRequestSummaryEntity`)
  - `modules/procurement/dto/PurchaseRequestDTO.ts` (NEW)
  - `modules/procurement/validators/purchase-request.ts` (NEW)
  - `modules/inventory/services/RestockRequestLifecycleService.ts` (DI ProcurementService)
  - `app/api/admin/procurement/purchase-requests/route.ts` (NEW)
  - `app/api/admin/procurement/purchase-orders/from-pr/route.ts` (NEW)
- **Breaking**: ❌ Tidak

### [2026-05-23] — Hardening sistem email: tenant isolation, klasifikasi error, dedup, DTO masking

- **Tipe**: [FIXED]
- **Scope**: `modules/notification`, `modules/settings`, `app/api/admin/settings/email`, `app/api/admin/notifications/email-logs`
- **Author**: agent
- **Deskripsi**: Audit menyeluruh review sistem email + fix 15 issue (10 prioritas tinggi + 5 medium/low).
  Perbaikan utama:
  1. **Tenant isolation kritis** — `EmailService.loadConfig` query Settings tanpa filter `tenantId` sehingga config SMTP antar-tenant bisa saling overwrite. Dipindah pakai `getTenantSettingsMap(tenantId, EMAIL_SETTINGS_FIELDS)` dan `tenantId` jadi parameter wajib di `SendEmailParams`.
  2. **Konsolidasi transporter** — duplikasi `nodemailer.createTransport` di `emailSettings.helpers` dihapus; `testEmailSettings` sekarang delegate ke `EmailService.testWithConfig`.
  3. **Error classifier baru** (`email-error-classifier.ts`) — kategorikan error ke `TRANSIENT`/`AUTH`/`INVALID_RECIPIENT`/`CONFIG`/`PERMANENT`/`UNKNOWN` sebagai basis retry decision. Pesan stack trace tidak lagi disimpan ke kolom `error`, hanya `[CATEGORY] safe message`.
  4. **Body plain text** — template `EmailContent.body` sekarang dikirim sebagai parameter `text` nodemailer (bukan `html`) sehingga newline preserved. Field `html` jadi opsional override.
  5. **Validasi `FROM_EMAIL`** — guard `validateEmail` di `loadEmailConfig` reject empty/format invalid.
  6. **DTO + masking** — listing `email-logs` super admin lintas-tenant kini di-mask alamat penerimanya. Field `errorCategory` & `errorMessage` di-extract dari prefix.
  7. **Permission check konsisten** — semua API email pakai `createHandler({ permissions: ['email:read'/'email:update'] })` deklaratif.
  8. **Constructor injection** — `EmailService` terima `EmailDeliveryLogRepository` via constructor untuk testability.
  9. **BOUNCED dead code** — `markBounced()` dihapus (tidak ada caller). Kolom `bouncedAt` di schema dibiarkan untuk migrasi terpisah.
  10. **Attachment size guard** — limit 10 MB total per email + per-attachment guard, error message spesifik nama file pelanggar.
  11. **Konstanta `TEST_EMAIL_SUBJECT` + helper `buildTestEmailPayload`** — dipakai bersama `testConnection` & `testWithConfig`, hilangkan duplikasi subject string.
  12. **Port parsing tervalidasi** — `parseSmtpPort` dengan `radix=10`, NaN check, dan bound check (1-65535).
  13. **JSDoc boundary type** — `EmailConfig` (runtime: port number, password decrypted) vs `EmailSettingsPayload` (boundary: port string) di-dokumentasi pemisahannya.
  14. **Dedup per recipient** — `SendEmailParams.dedupeWindowMs` baru: cek `EmailDeliveryLog` untuk recipient+subject yang sudah `SENT`/`PENDING` dalam window waktu, skip kalau ada. `NotificationDispatcher` aktifkan default 5 menit untuk billing email — cegah scheduler/event handler trigger ulang.
  15. **`SendEmailResult.deduped`** — flag baru untuk caller bedakan skip-dedup vs error.
- **Files**:
  - `modules/notification/services/email-service.ts` (rewrite + dedup + attachment guard)
  - `modules/notification/services/email-error-classifier.ts` (new)
  - `modules/notification/services/EmailLogQueryService.ts` (return DTO)
  - `modules/notification/services/NotificationDispatcher.ts` (forward tenantId, kirim text, aktifkan dedup 5 menit)
  - `modules/notification/repositories/EmailDeliveryLogRepository.ts` (signature `markFailed` + `hasRecentDelivery` + remove `markBounced`)
  - `modules/notification/dto/EmailDeliveryLogDTO.ts` (new)
  - `modules/notification/templates/billing-templates.ts` (`EmailContent.html` optional)
  - `modules/notification/index.ts` (re-exports)
  - `modules/settings/services/emailSettings.ts` (delegate ke `EmailService`)
  - `modules/settings/services/emailSettings.helpers.ts` (cleanup transporter dupe)
  - `modules/settings/index.ts` (export `EMAIL_SETTINGS_FIELDS`)
  - `modules/inventory/services/inventory-restock-check.helpers.ts` (pass tenantId)
  - `app/api/admin/settings/email/route.ts` & `test/route.ts` (permissions deklaratif)
  - `tests/modules/notification/repositories/EmailDeliveryLogRepository.test.ts` (sesuaikan signature)
- **Breaking**: ✅ Ya — `SendEmailParams.tenantId` jadi wajib (bukan optional). Pemanggil di `inventory` dan `NotificationDispatcher` sudah disesuaikan.

### [2026-05-23] — Fix npm run check (lint, typecheck, test, build) hingga clean

- **Tipe**: [FIXED]
- **Scope**: `modules/procurement`, `modules/inventory`, `app/admin/procurement`, `components/inventory`, `tests/`
- **Author**: agent
- **Deskripsi**: Membersihkan seluruh warning/error di `npm run check`. (1) Lint: ganti `setState-in-useEffect` jadi derived-state pattern (PurchaseOrderEditClient) dan onChange handler langsung (PurchaseOrderCreateClient); escape `&quot;`; ganti `React.FormEvent` (deprecated TS6385) jadi `React.SyntheticEvent<HTMLFormElement>`. (2) Test architecture: `IPurchaseOrderRepository` lepas dari Prisma types ke domain shapes; hapus re-export `PurchaseOrderRepository`/`SupplierRepository` dari `modules/procurement/index.ts`; `ZteAdapter.ts` masuk allowlist; `InvoicePaymentStateService` & `InventoryOpnameService` masuk dependency-inversion baseline. (3) Test rewrite: TransferForm.stock-caption & transfer-list-detail align ke struktur baru (custom hooks via `vi.mock`, useState order baru). (4) Build: buat `modules/inventory/client.ts` sebagai barrel client-safe agar import `STOCK_THRESHOLD` dari client component tidak menarik `firebase-admin`/server services ke client bundle.
- **Files**: `modules/inventory/client.ts` (NEW), `modules/procurement/{index.ts,domain/ports/IPurchaseOrderRepository.ts,services/PurchaseOrderService.ts}`, `app/admin/procurement/purchase-orders/{[id]/PurchaseOrderEditClient.tsx,create/PurchaseOrderCreateClient.tsx}`, `components/inventory/{BarangTable,BarangForm,TransferForm,form-shared/SelectionSummary,form-shared/StockByConditionPanel}.tsx`, `app/admin/inventory/barang/[id]/BarangDetailClient.tsx`, `tests/architecture/module-public-api.test.ts`, `tests/app/transfer-list-detail.test.ts`, `tests/components/inventory/TransferForm.stock-caption.test.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Fix traffic counter ifIndex signed overflow + Counter64 buffer parsing

- **Tipe**: [FIXED]
- **Scope**: `modules/olt/adapters/zte/ZteAdapter.ts`
- **Author**: agent
- **Deskripsi**: Dua bug di realtime traffic counter ONU: (1) encoding ifIndex `0x90 << 24` menghasilkan signed int32 negatif (`-1879048192`), sehingga OID jadi invalid (`argument is not a valid OID string`). Fix dengan `(...) >>> 0` untuk paksa unsigned. (2) `net-snmp` library deliver Counter64 sebagai Buffer 8-byte big-endian; `Number(Buffer)` → `NaN` → fallback 0, sehingga RX/Packets selalu 0. Fix dengan branch `Buffer.isBuffer(v)` yang loop byte-by-byte pakai BigInt.
- **Breaking**: ❌ Tidak

### [2026-05-23] — Cascading filter ONU dan manajemen card OLT

- **Tipe**: [ADDED]
- **Scope**: `modules/olt`, `app/admin/olt/onu`, `app/admin/olt/devices/[id]`, `app/api/olt/devices/[id]/cards`
- **Author**: agent
- **Deskripsi**: Tambah model `OltCard` untuk merepresentasikan card per OLT. Auto-discovery via SNMP (ZTE) atau seed BUILTIN (pizza-box). UI section manajemen card di halaman detail OLT. Rewrite halaman Daftar ONU menjadi cascading filter OLT → Card → PON dengan global search bypass (SN/description/nama pelanggan lintas OLT).
- **Migration**: `20260523000001_add_olt_card_table`
- **Breaking**: ❌ Tidak

### [2026-05-23] — Extend ONU list endpoint dengan scope filter dan global search

- **Tipe**: [CHANGED]
- **Scope**: `app/api/olt/onu`, `modules/olt/repositories/OnuRepository.ts`, `modules/olt/validators/onu.validator.ts`
- **Author**: agent
- **Deskripsi**: Endpoint GET /api/olt/onu menerima parameter scope (oltId, slotFrame, slot, ponPort) dan search yang OR-match SN/description/pelanggan.nama. Saat search aktif, parameter scope diabaikan (global search). Status filter tetap aktif di kedua mode.
- **Breaking**: ❌ Tidak

### [2026-05-22] — OLT ZTE adapter kalibrasi terhadap C300 lapangan

- **Tipe**: [FIXED]
- **Scope**: `modules/olt/adapters/zte`, `modules/olt/config/oid-registry`
- **Author**: agent
- **Deskripsi**: Hasil verifikasi telnet+SNMP terhadap OLT C300 production
  (BRAS-CARIU-BGR, firmware ZTE V2.x), tiga asumsi adapter sebelumnya yang
  salah dikoreksi: (1) **SNMP ifIndex encoding** — ZTE C300 pakai
  single 32-bit ifIndex `(frame<<28)|(0xFF<<16)|(slot<<8)|port` + onuIndex
  (2 segments), bukan 4-tuple `frame.slot.port.onuIndex` seperti yang
  saya tulis sebelumnya. Helper `encodeOltIfIndex/decodeOltIfIndex`
  ditambahkan dan dipakai di semua OID generator. (2) **Sintaks register
  ONU** — C300 produksi pakai `onu N type ALL sn X` (bukan
  `type default`); `type ALL` = profile generic accept-all. (3) **Mode
  provisioning** — T-CONT/GEM/service-port disetting di
  `interface gpon-onu_F/S/P:N` mode, BUKAN `pon-onu-mng` mode. Adapter
  sebelumnya masuk `pon-onu-mng` dan akan gagal di firmware ini.
  `resetOnu` pakai command `clear` di config-if mode. `firmware upgrade`
  pakai `system-software upgrade <file>` di config-if mode. Beberapa
  kolom OID untuk status & optical power masih ditandai UNVERIFIED di
  registry — perlu snmpwalk lanjutan untuk konfirmasi mapping kolom
  status integer ↔ phase state (working/offline/los/dyingGasp).
- **Files**: `modules/olt/adapters/zte/ZteAdapter.ts`,
  `modules/olt/config/oid-registry/zte.oid.ts`,
  `modules/olt/services/FirmwareUpgradeService.ts`
- **Breaking**: ❌ Tidak (perbaikan terhadap kode yang tidak pernah
  berhasil di-eksekusi terhadap device asli)

### [2026-05-22] — Hapus legacy procurement endpoints + helper disabled

- **Tipe**: [REMOVED]
- **Scope**: `app/api/procurement`, `app/api/inventory/procurement`, `modules/procurement`, `tests/api`, `tests/admin`
- **Author**: agent
- **Deskripsi**: Hapus semua endpoint legacy procurement yang sebelumnya
  return `procurementEndpointDisabled` (HTTP 410), karena sudah ada
  pengganti aktif di `app/api/admin/procurement/*` dan tidak ada UI/lib
  produksi yang refer ke route lama:
  - Hapus folder `app/api/procurement/` (purchase-orders, purchase-requests,
    suppliers + nested routes).
  - Hapus `app/api/inventory/procurement/purchase-request/route.ts`
    (kompatibilitas inventory legacy).
  - Hapus helper `procurementEndpointDisabled` dan service
    `ProcurementDisabledEndpointService.ts` di modul procurement.
  - Hapus test `tests/api/procurement-disabled-routes.test.ts` (sudah
    obsolete karena route-nya tidak ada lagi).
  - Update `tests/admin/removed-surfaces.test.ts`: hapus assertion untuk
    page-page yang sudah aktif (PurchaseOrders, Suppliers, dan sub-page),
    sisakan hanya `procurement/page.tsx` (landing) dan
    `procurement/market-price/page.tsx` yang masih `notFound`.
  - Update `modules/procurement/index.ts`: hapus
    `export * from "./services/ProcurementDisabledEndpointService"`.
- **Files**:
  `app/api/procurement/**` (deleted),
  `app/api/inventory/procurement/**` (deleted),
  `modules/procurement/services/ProcurementDisabledEndpointService.ts` (deleted),
  `modules/procurement/index.ts`,
  `tests/api/procurement-disabled-routes.test.ts` (deleted),
  `tests/admin/removed-surfaces.test.ts`
- **Breaking**: ✅ Ya — endpoint `/api/procurement/*` dan
  `/api/inventory/procurement/purchase-request` tidak lagi tersedia
  (sebelumnya return 410, sekarang return 404). Konsumen baru wajib pakai
  `/api/admin/procurement/*` dan `/api/inventory/restock/*`.

### [2026-05-22] — Decompose god component MasukForm/KeluarForm/TransferForm

- **Tipe**: [CHANGED]
- **Scope**: `components/inventory`
- **Author**: agent
- **Deskripsi**: Pecah tiga form inventory besar (total 2.259 LOC → 1.417 LOC,
  37% reduction) dengan extract building block bersama:
  1. **MasukForm**: 695 → 319 LOC (54% turun).
  2. **KeluarForm**: 818 → 497 LOC (39% turun).
  3. **TransferForm**: 746 → 601 LOC (19% turun).
  4. Hilangkan anti-pattern render-comparator state init (`if (prev !== curr) { setState; void fetch }`)
     di KeluarForm — clamp jumlah dipindah ke handler kondisi change.
  5. Hilangkan setState-in-effect di useStockByCondition — pakai derived value
     untuk reset saat barang/gudang kosong.
  6. `useBarangOptions` migrasi dari `useState+useEffect+fetch` ke `useApi`
     (TanStack Query) untuk caching otomatis dan eliminasi rules-of-hooks issue.
- **Files baru** (10 file shared di `components/inventory/form-shared/`):
  - **Hooks**: `useBarangOptions`, `useGudangOptions`, `useFotoBuktiUpload`,
    `useStockByCondition`.
  - **Sub-components**: `BarangSelector`, `GudangSelector`, `KondisiSelector`,
    `FotoBuktiSection`, `SelectionSummary`, `StockByConditionPanel`,
    `FormFields` (FormAlert/TextField/TextAreaField/JumlahField).
- **Files diubah**:
  - `components/inventory/MasukForm.tsx`
  - `components/inventory/KeluarForm.tsx`
  - `components/inventory/TransferForm.tsx`
- **Breaking**: ❌ Tidak (perilaku UI dan API contract tetap; refactor murni
  internal).

### [2026-05-22] — Aktifkan PO admin UI/API dengan vendor auto-populate

- **Tipe**: [ADDED]
- **Scope**: `modules/procurement`, `app/api/admin/procurement/purchase-orders`, `app/admin/procurement/purchase-orders`
- **Author**: agent
- **Deskripsi**: Mengaktifkan kembali Purchase Order admin UI/API yang
  sebelumnya placeholder (`procurementEndpointDisabled` + `notFound`):
  - Service baru `PurchaseOrderService` di `modules/procurement/services/`
    dengan operasi `list`, `getById`, `create`, `update` (faktur metadata),
    `delete`. Vendor `npwp` otomatis dipopulasi dari supplier master saat
    create kalau tidak di-supply manual — snapshot tersimpan di PO untuk
    konsistensi pelaporan PPN saat pembayaran.
  - Repository diperluas: `findByIdWithRelations`, `list` (paginated +
    filter), `create` (kalkulasi PPN otomatis), `updateMetadata`, `delete`,
    `generatePoNumber`. Port `IPurchaseOrderRepository` ikut diperluas
    menggunakan `Prisma.PurchaseOrderGetPayload<...>` untuk presisi tipe.
  - Validators baru: `createPurchaseOrderSchema`, `updatePurchaseOrderSchema`,
    `purchaseOrderListQuerySchema` di `validators/purchase-order.ts`.
  - API admin baru: `GET/POST /api/admin/procurement/purchase-orders` dan
    `GET/PATCH/DELETE /api/admin/procurement/purchase-orders/[id]` dengan
    permission `purchase_orders:read|create|update|delete`.
  - UI admin: list page (filter status bayar + search), create page (vendor
    auto-populate via `useEffect` saat supplier dipilih, kalkulasi PPN/grand
    total live), detail/edit page (faktur pajak metadata, hapus PO yang
    masih `UNPAID`).
- **Files**: `modules/procurement/services/PurchaseOrderService.ts`,
  `modules/procurement/repositories/PurchaseOrderRepository.ts`,
  `modules/procurement/domain/ports/IPurchaseOrderRepository.ts`,
  `modules/procurement/validators/purchase-order.ts`,
  `modules/procurement/index.ts`,
  `modules/procurement/dto/ProcurementDTO.ts`,
  `app/api/admin/procurement/purchase-orders/route.ts`,
  `app/api/admin/procurement/purchase-orders/[id]/route.ts`,
  `app/admin/procurement/purchase-orders/page.tsx`,
  `app/admin/procurement/purchase-orders/PurchaseOrderListClient.tsx`,
  `app/admin/procurement/purchase-orders/create/page.tsx`,
  `app/admin/procurement/purchase-orders/create/PurchaseOrderCreateClient.tsx`,
  `app/admin/procurement/purchase-orders/[id]/page.tsx`,
  `app/admin/procurement/purchase-orders/[id]/PurchaseOrderEditClient.tsx`
- **Breaking**: ❌ Tidak (endpoint lama `/api/procurement/purchase-orders/*`
  tetap return `procurementEndpointDisabled` untuk backward-compat; admin
  baru dipisah path `/api/admin/procurement/*`)

### [2026-05-22] — Konsolidasi PurchaseOrder ke modul procurement (jalan B)

- **Tipe**: [CHANGED]
- **Scope**: `modules/procurement`, `modules/finance`, `modules/tax`
- **Author**: agent
- **Deskripsi**: PurchaseOrder sebelumnya terpecah: domain entity di
  `procurement` (orphan), repository + payment service di `finance`. Sekarang
  semua kepemilikan dipindah ke `procurement` dengan port-based access:
  - `PurchaseOrderRepository` → pindah dari `modules/finance/repositories/`
    ke `modules/procurement/repositories/`, implement port baru
    `IPurchaseOrderRepository` di `domain/ports/`.
  - `FinancePurchaseOrderPaymentService` → pindah jadi
    `PurchaseOrderPaymentService` di `modules/procurement/services/`. Method
    publik tetap `payPurchaseOrder` agar route `app/api/finance/pay-po`
    tidak perlu berubah.
  - `FinanceService.payPurchaseOrder` tetap ada (delegate ke procurement
    via factory `getPurchaseOrderPaymentService()`) untuk backward-compat.
  - `FinanceReportService.findManyWithTax` sekarang konsumsi
    `IPurchaseOrderRepository` dari procurement (port, bukan concrete).
  - `handlePurchaseOrderPaidTax` di `modules/tax` tidak lagi `prisma.purchaseOrder.findUnique`
    inline — pakai `getPurchaseOrderRepository().findById()`.
  - Entity `PurchaseOrderEntity` ditambah field faktur pajak
    (`fakturPajakNo`, `fakturPajakDate`, `vendorNpwp`) supaya selaras
    dengan schema Prisma.
  - **Catatan `RestockPurchaseOrderStatusService` di inventory**: tetap di
    inventory karena workflow-nya dipicu event "barang diterima di gudang"
    dan butuh single-transaction integrity dengan stock movement. Status
    update PO yang dilakukan service ini dianggap acceptable cross-cutting
    untuk sekarang. Akan dipertimbangkan untuk pecah menjadi event-based
    (procurement listen `INVENTORY_RECEIVED`) di refactor berikutnya.
- **Files**:
  - `modules/procurement/domain/ports/IPurchaseOrderRepository.ts` (NEW)
  - `modules/procurement/repositories/PurchaseOrderRepository.ts` (NEW — pindahan)
  - `modules/procurement/services/PurchaseOrderPaymentService.ts` (NEW — pindahan)
  - `modules/procurement/domain/entities/PurchaseOrder.ts` (tambah field faktur pajak)
  - `modules/procurement/mappers/ProcurementMapper.ts` (mapping field faktur pajak)
  - `modules/procurement/index.ts` (export `getPurchaseOrderPaymentService`, `getPurchaseOrderRepository`)
  - `modules/finance/repositories/PurchaseOrderRepository.ts` (DELETED)
  - `modules/finance/services/FinancePurchaseOrderPaymentService.ts` (DELETED)
  - `modules/finance/repositories/index.ts` (hapus PurchaseOrderRepository export)
  - `modules/finance/services/FinanceService.ts` (delegate ke procurement)
  - `modules/finance/services/FinanceReportService.ts` (pakai port procurement)
  - `modules/tax/services/event-handlers/purchase-order-paid-tax.handler.ts` (pakai repo procurement)
- **Breaking**: ❌ Tidak (semua entry point publik tetap; perubahan internal saja)

### [2026-05-22] — Cleanup billing P3: batch customer lookup, konsolidasi PPN fallback, deprecate process-overdue

- **Tipe**: [CHANGED] [DEPRECATED]
- **Scope**: `modules/finance`, `modules/tax`, `modules/pelanggan`, `app/api/cron/process-overdue`
- **Author**: agent
- **Deskripsi**: Tiga perbaikan code-quality di pipeline billing.
  1. **N+1 customer name lookup**: `getCustomerNameMap` di
     `manual-payment-admin.helpers` sebelumnya melakukan
     `Promise.all(uniqueIds.map(findById))` — untuk 500 pending payment jadi
     500 query terpisah. Diganti pakai method baru
     `PelangganBillingBridgeService.findManyByIds(ids)` →
     `PelangganRepository.findManyByIds(ids)` yang menerjemahkan jadi 1
     query `findMany({ where: { id: { in } } })`.
  2. **Konsolidasi PPN fallback**: konstanta
     `FALLBACK_PPN_PERCENTAGE = 11` di `BillingInvoiceCreationService`
     dihapus. Logic pemilihan rate untuk pelanggan tenantless dipindah ke
     `PpnRateResolver.resolveOptional(tenantId | null, paketPercentage)`,
     sehingga tax module menjadi satu-satunya source of truth untuk rate
     PPN (sebelumnya double-fallback yang rawan drift).
  3. **Deprecate `/api/cron/process-overdue`**: route ini sudah jadi alias
     murni untuk `BillingScheduleReconciliationService.reconcile()`.
     Ditandai `@deprecated` di JSDoc, log warning ditambahkan, dan
     response payload sekarang menyertakan `deprecated: true` agar
     monitoring/cron operator bisa migrasi ke `/api/cron/reconcile-billing-schedules`.
- **Files**:
  `modules/finance/services/BillingInvoiceCreationService.ts`,
  `modules/finance/services/manual-payment-admin.helpers.ts`,
  `modules/tax/services/PpnRateResolver.ts`,
  `modules/pelanggan/repositories/PelangganRepository.ts`,
  `modules/pelanggan/services/PelangganBillingBridgeService.ts`,
  `app/api/cron/process-overdue/route.ts`
- **Breaking**: ❌ Tidak (perubahan internal; response `process-overdue`
  hanya menambah field `deprecated`)

### [2026-05-22] — Refactor inventory tabs (Dashboard, Master Barang, Gudang, Masuk, Keluar, Transfer)

- **Tipe**: [CHANGED] [FIXED]
- **Scope**: `components/inventory`, `app/admin/inventory`, `app/api/inventory/dashboard`, `modules/inventory`
- **Author**: agent
- **Deskripsi**: Bersihkan anti-pattern sistemik di 5 tab inventory:
  1. Hapus pola `confirm() + window.location.reload() + alert()` di seluruh tabel
     (Barang/Gudang/Masuk/Keluar/Transfer) → ganti dengan `ConfirmDialog` +
     `useToast` + `mutate()` dari useApi (soft refresh, themable, non-blocking).
  2. Hapus anti-pattern fetch via render-comparator (`if (prev !== curr) { setState; void fetch }`)
     di MasukTable & KeluarTable → migrasi ke `useApi` (TanStack Query) dengan
     URL ber-cache key. Konsolidasi state pagination ganda menjadi satu sumber.
  3. Pindahkan `lib/validations/barang.ts` (imperative) ke
     `modules/inventory/validators/barangValidator.ts` sebagai Zod schema dengan
     `superRefine` untuk cross-field validation. Re-export public API dari
     `modules/inventory/index.ts`. Hapus file lama.
  4. Decompose `app/admin/inventory/transfer/TransferList.tsx` (528 LOC, god component)
     menjadi `useTransferList` hook + `TransferDetailModal` + `TransferPagination`
     + composer tipis (~150 LOC). `fetchTransferDetail` dipindahkan ke
     `transferDetailFetcher.ts` (re-export di parent untuk kompatibilitas test).
  5. Extract konstanta `STOCK_THRESHOLD` + helper `getStockStatus/getStockLabel`
     ke `modules/inventory/domain/constants.ts` — hilangkan magic number `< 5`
     di Dashboard, BarangTable, BarangDetailClient.
  6. Standarisasi response API dashboard inventory: `InventoryDashboardService`
     return data langsung (bukan wrap manual `{success, data}`), route handler
     pakai `apiSuccess()`. Hapus fallback `result.data ?? (result as unknown as T)`
     di `InventoryIndexClient`. Buang dual-shape parser di `BarangDetailClient`
     dan `GudangList`.
- **Files**:
  - `components/inventory/{BarangTable,MasukTable,KeluarTable,TransferTable,BarangForm}.tsx`
  - `components/inventory/transfer/{useTransferList,TransferDetailModal,TransferPagination,transferDetailFetcher,index}.{ts,tsx}`
  - `app/admin/inventory/{InventoryIndexClient,gudang/GudangList,transfer/TransferList,barang/[id]/BarangDetailClient}.tsx`
  - `app/api/inventory/dashboard/route.ts`
  - `modules/inventory/services/InventoryDashboardService.ts`
  - `modules/inventory/validators/barangValidator.ts` (new)
  - `modules/inventory/domain/constants.ts` (new)
  - `modules/inventory/index.ts`
  - `lib/validations/barang.ts` (deleted)
- **Breaking**: ❌ Tidak (response shape `/api/inventory/dashboard` berubah ke
  format standar `apiSuccess` — frontend di repo sudah disesuaikan, konsumer
  eksternal tidak ada)

### [2026-05-22] — BillingReminderService toleran drift cron + idempotent per hari

- **Tipe**: [FIXED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: `BillingReminderService.isReminderTime` sebelumnya
  membandingkan `HH:MM` saat ini dengan `GENERAL_REMINDER_TIME` secara
  exact-match per menit. Akibatnya kalau cron `* * * * *` telat 1 menit
  (event loop sibuk, GC pause, restart aplikasi) reminder hari itu hilang
  total. Diperbarui menjadi window 5 menit `[reminderTime,
  reminderTime + 5min)` untuk mentolerir drift, ditambah Redis cron-lock
  harian (`billing:reminder:daily:YYYY-MM-DD`, TTL 24h) untuk memastikan
  reminder hanya benar-benar terkirim sekali per hari per cluster meski
  cron menyala beberapa kali dalam window. Validasi format
  `GENERAL_REMINDER_TIME` ditambahkan; nilai invalid di-log dan reminder
  di-skip alih-alih meledak. Method `sendDailyReminders` sekarang
  menerima parameter `now` opsional supaya bisa diuji deterministik.
- **Files**:
  `modules/finance/services/BillingReminderService.ts`,
  `tests/modules/finance/BillingReminderService.test.ts` (NEW)
- **Breaking**: ❌ Tidak (signature publik kompatibel; perilaku eksternal
  konsisten kecuali sekarang reminder benar-benar terkirim setiap hari)

### [2026-05-22] — Aktivasi CRUD Supplier (API + UI admin) di sub-modul procurement

- **Tipe**: [ADDED]
- **Scope**: `app/api/admin/procurement/suppliers`, `app/admin/procurement/suppliers`, `modules/procurement`
- **Author**: agent
- **Deskripsi**: Endpoint dan UI admin untuk CRUD supplier sekarang aktif —
  sebelumnya disabled via `procurementEndpointDisabled`. Konsumsi public API
  procurement (`getSupplierService`) yang baru di-introduce sebelumnya.
  Mencakup:
  - **API**: `GET/POST /api/admin/procurement/suppliers` (list+create dengan
    search, paginated), `GET/PATCH/DELETE /api/admin/procurement/suppliers/[id]`.
    Permission: `supplier:read|create|update|delete`.
  - **UI**: list page dengan search & pagination, form create/edit unified
    (`SupplierForm.tsx`) dengan section Identitas / Kontak / Pajak. Field
    NPWP otomatis filter ke digit-only (15-16 chars), kategori PPh sebagai
    select dengan label informatif (jasa/sewa/sewa_tanah).
  - **Catatan PO form**: wiring auto-populate vendor di Purchase Order form
    masih belum bisa dikerjakan karena PO admin UI & API masih disabled
    (`procurementEndpointDisabled`). Akan ditangani di iterasi berikutnya
    saat PO modul diaktifkan.
- **Files**:
  - `app/api/admin/procurement/suppliers/route.ts` (NEW)
  - `app/api/admin/procurement/suppliers/[id]/route.ts` (NEW)
  - `app/admin/procurement/suppliers/page.tsx` (replace placeholder)
  - `app/admin/procurement/suppliers/create/page.tsx` (replace placeholder)
  - `app/admin/procurement/suppliers/[id]/page.tsx` (replace placeholder)
  - `app/admin/procurement/suppliers/SupplierForm.tsx` (NEW — shared)
  - `app/admin/procurement/suppliers/SupplierListClient.tsx` (NEW)
  - `app/admin/procurement/suppliers/create/SupplierCreateClient.tsx` (NEW)
  - `app/admin/procurement/suppliers/[id]/SupplierEditClient.tsx` (NEW)
- **Breaking**: ❌ Tidak

### [2026-05-22] — Konsolidasi handler invoice paid via InvoicePaymentStateService

- **Tipe**: [FIXED] [CHANGED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: Endpoint `POST /api/payments` (admin manual) sebelumnya
  hanya memanggil `AutomaticBillingService.handleInvoicePaid` langsung
  tanpa emit event `INVOICE_PAID`, sehingga handler akuntansi
  (`handleInvoicePaidAccounting`) dan aktivasi pelanggan
  (`handleInvoicePaidActivation`) tidak ter-trigger — jurnal akuntansi
  tidak dibuat dan pelanggan ISOLIR tetap ISOLIR meski sudah bayar.
  Sekaligus, jalur verify-manual dan immediate settlement memanggil
  `handleInvoicePaid` dua kali (sekali langsung, sekali via event handler)
  sehingga side-effect billing dieksekusi ganda. Diperkenalkan
  `InvoicePaymentStateService.recompute(invoiceId)` sebagai single source
  untuk: hitung ulang `paidAmount` dari payment aktif, set status
  invoice, sync durable billing schedule, dan emit `INVOICE_PAID` sekali
  saat transisi menjadi PAID. `PaymentRouteService`,
  `manual-payment-admin.helpers`, `automatic-billing-payment.settlement`,
  dan `PaymentCancellationService` sekarang delegasi ke service ini.
- **Files**:
  `modules/finance/services/InvoicePaymentStateService.ts` (NEW),
  `modules/finance/services/PaymentRouteService.ts`,
  `modules/finance/services/manual-payment-admin.helpers.ts`,
  `modules/finance/services/automatic-billing-payment.settlement.ts`,
  `modules/finance/services/PaymentCancellationService.ts`,
  `modules/finance/index.ts`,
  `tests/modules/finance/PaymentCancellationService.test.ts`,
  `tests/modules/finance/services/PaymentRouteService.test.ts`
- **Breaking**: ❌ Tidak (kontrak API tidak berubah; perilaku internal
  konsisten — semua jalur lunas sekarang mengikuti event-driven side-effect)

### [2026-05-22] — Sub-modul Supplier di procurement (master vendor)

- **Tipe**: [ADDED]
- **Scope**: `modules/procurement`
- **Author**: agent
- **Deskripsi**: Sub-modul Supplier baru di `modules/procurement` sebagai
  rumah resmi master vendor. Sebelumnya `Supplier` hanya ada di Prisma
  schema tanpa repository/service di module manapun. Sub-modul ini
  menyediakan domain entity, port, repository, service, DTO, dan validator
  Zod, plus public API factory `getSupplierService()`. Validator NPWP
  mendukung 15 digit (legacy) dan 16 digit (NIK Coretax 2025).
  `purchase-order-paid-tax.handler` di-refactor agar fetch supplier via
  public API procurement (bukan inline Prisma `select`), menjaga module
  boundary.
- **Files**:
  - `modules/procurement/domain/entities/Supplier.ts` (NEW)
  - `modules/procurement/domain/ports/ISupplierRepository.ts` (NEW)
  - `modules/procurement/repositories/SupplierRepository.ts` (NEW)
  - `modules/procurement/services/SupplierService.ts` (NEW)
  - `modules/procurement/dto/SupplierDTO.ts` (NEW)
  - `modules/procurement/validators/supplier.ts` (NEW)
  - `modules/procurement/index.ts` (export public API)
  - `modules/tax/services/event-handlers/purchase-order-paid-tax.handler.ts` (pakai getSupplierService)
- **Breaking**: ❌ Tidak

### [2026-05-22] — Refactor Laporan Stok Gudang (snapshot-based, batch query, modular UI)

- **Tipe**: [CHANGED] [FIXED]
- **Scope**: `app/api/inventory/opname/report`, `modules/inventory`, `components/inventory`
- **Author**: agent
- **Deskripsi**: Tab "Laporan Stok per Gudang" direfactor end-to-end. Backend
  repository `InventoryOpnameApiRepository.findOpnameReport` sebelumnya N+1
  (untuk N items menjalankan 2 query history `barangMasuk/Keluar`) dan
  re-compute stok kondisi dari history transaksi sehingga inkonsisten dengan
  snapshot `barangGudang.stokBaru/Bekas/Rusak` yang dimaintain mutation paths
  (terutama hasil opname tidak tercermin). Sekarang: kondisi stok diambil
  langsung dari snapshot `barangGudang`, total hilang di-aggregate via
  `prisma.barangKeluar.groupBy({ by: ["gudangId","barangId"], _sum: { jumlah } })`
  satu query untuk semua gudang, response `gudangList` di-extend dengan
  `totalStokBaru/Bekas/Rusak` per gudang dan `summary.*` global. Frontend
  `StockReport.tsx` (400 LOC) dipecah jadi composer tipis + `useStockReport`
  hook + `StockReportSelector`/`StockReportHeader`/`StockReportTable`. Card
  ringkasan kini punya 6 metrik terpisah (Jenis Barang, Total Stok, Stok Baru,
  Stok Bekas, Stok Rusak, Barang Hilang) — sebelumnya "Stok Baik" menggabungkan
  baru+bekas yang menyesatkan. Tabel barang dapat search filter
  kode/nama. Fetch via `useEffect` + `AbortController` (sebelumnya pakai SWR
  `useApi` tanpa abort). CSV export pakai escape `"` proper, append/remove DOM
  link, dan `URL.revokeObjectURL`; sukses notif via `useToast`.
- **Files**:
  `modules/inventory/repositories/InventoryOpnameApiRepository.ts`,
  `modules/inventory/services/inventory-route.helpers.ts`,
  `components/inventory/StockReport.tsx`,
  `components/inventory/opname/stock-report/*` (baru: `useStockReport.ts`,
  `StockReportSelector.tsx`, `StockReportHeader.tsx`, `StockReportTable.tsx`)
- **Breaking**: ❌ Tidak (response API menambah field `totalStokBaru/Bekas/Rusak`
  per gudang dan di summary; field lama tetap dipertahankan)

### [2026-05-22] — Pengerasan integrasi Pajak: rate PPN, vendor NPWP, faktur pajak, PO handler, Coretax export

- **Tipe**: [CHANGED]
- **Scope**: `modules/tax`, `modules/finance`, `prisma/schema.prisma`, `lib/event-bus`
- **Author**: agent
- **Deskripsi**: Lima penguatan integrasi pajak ke finance/akuntansi:
  1. **Konsolidasi rate PPN** — `PpnRateResolver` baru di `modules/tax`. `BillingInvoiceCreationService` resolve rate via TaxConfig (lapor DJP) saat tenant PKP, fallback ke `hargaPaket.ppnPercentage`. Mismatch antara rate paket dan TaxConfig PKP di-warn agar tidak silent drift.
  2. **Master vendor pajak** — kolom `npwp` & `defaultPphCategory` di `Supplier`. Helper `classifyPph` di-extract ke `PphClassifier.ts` dengan resolution order: vendor override → category type → name string-match.
  3. **Metadata faktur pajak** — kolom `fakturPajakNo`, `fakturPajakDate`, `vendorNpwp` di `Expense`, `PurchaseOrder`, dan `TaxTransaction` (denormalized). `PpnService.recordPpnMasukan/Keluaran` accept & persist metadata; expense-approved-tax handler propagate dari Expense.
  4. **Handler PO_PAID ke pajak** — `handlePurchaseOrderPaidTax` baru. Record PPN Masukan + PPh 23/4(2) untuk PO yang ada komponen pajaknya, pakai supplier `defaultPphCategory` & `npwp`. Wired ke `EVENT_NAMES.PURCHASE_ORDER_PAID`.
  5. **Adapter Coretax DJP** — `CoretaxExportAdapter` baru menghasilkan CSV format e-Faktur Coretax (FK/LT/OF row schema) untuk PPN keluaran/masukan. Faktur tanpa `fakturPajakNo` di-skip dan dilaporkan via summary.
- **Files**:
  - `modules/tax/services/PpnRateResolver.ts` (NEW)
  - `modules/tax/services/PphClassifier.ts` (NEW)
  - `modules/tax/services/CoretaxExportAdapter.ts` (NEW)
  - `modules/tax/services/event-handlers/purchase-order-paid-tax.handler.ts` (NEW)
  - `modules/tax/services/PpnService.ts` (faktur metadata params)
  - `modules/tax/services/event-handlers/expense-approved-tax.handler.ts` (lookup faktur metadata)
  - `modules/tax/repositories/TaxTransactionRepository.ts` (faktur fields)
  - `modules/tax/domain/entities/TaxTransaction.ts`, `domain/ports/ITaxTransactionRepository.ts`
  - `modules/tax/index.ts` (factories & exports)
  - `modules/finance/services/BillingInvoiceCreationService.ts` (PpnRateResolver)
  - `modules/finance/services/automatic-billing.helpers.ts`, `services/AutomaticBillingService.ts` (tenantId di payload)
  - `lib/event-bus/event-handlers.ts` (registrasi PO_PAID tax handler)
  - `tests/modules/finance/services/BillingInvoiceCreationService.test.ts` (fixture tenantId)
- **Migration**:
  - `20260522180000_add_supplier_tax_fields` — `suppliers.npwp`, `suppliers.defaultPphCategory`
  - `20260522181000_add_faktur_pajak_metadata` — faktur pajak metadata di `Expense`, `purchase_orders`, `tax_transactions`
- **Breaking**: ❌ Tidak (semua field baru nullable; payload `BillingCustomerPayload` extend dengan `tenantId` yang sudah otomatis tersedia dari Pelanggan)

### [2026-05-22] — OLT ZTE production-readiness (multi-slot, telnet flow, provisioning)

- **Tipe**: [CHANGED] [ADDED] [MIGRATION]
- **Scope**: `modules/olt`, `app/admin/olt/devices/tambah`, `lib/event-bus`,
  `prisma/schema.prisma`, `docs/guides/olt-zte-testing-checklist.md`
- **Author**: agent
- **Deskripsi**: Membuat modul OLT siap dipakai untuk control device ZTE riil
  (target C300 multi-slot dan C320 stand-alone). Schema `OltDevice` ditambah
  `telnetEnablePass`, `defaultSlotFrame`, `defaultSlot`. `ZteAdapter` baca
  slot dari device—tidak lagi hardcode 1/1. `ZteTelnetClient` menangani
  enable password dua-tahap, auto-disable pagination (`terminal length 0`
  fallback `screen-length 0 temporary`). `registerOnu` dipisah jadi dua
  tahap: **bind (mandatory, assert success)** + **provisioning best-effort**
  (T-CONT, GEM port, service-port — kalau gagal, ONU tetap ter-bind dan
  user bisa atur VLAN manual via "Set VLAN"). Service-port pakai syntax
  universal `vport gpon-onu_F/S/P:O.1` yang berlaku di C300+C320 (sebelumnya
  pakai `vport-mode manual` yang vendor-specific). `service HSI ... vlan`
  tanpa `type internet` (firmware V4.x reject `type` keyword).
  `deregisterOnu` lakukan cleanup berurutan: hapus service-port → service →
  gemport → tcont → unbind ONU. OID registry diberi dokumentasi compatibility
  per model. `OnuDiscoveryService` sekarang **auto-register** ONU yang punya
  pre-registration match (otomatis assign ke pelanggan jika `pelangganId`
  di-set). Handler `handlePelangganStatusForOlt` didaftarkan ke event-bus
  untuk `CUSTOMER_SUSPENDED`/`CUSTOMER_ACTIVATED`/`CUSTOMER_ISOLATED`.
  UI form OLT: dropdown vendor non-ZTE ditandai "Coming soon" disabled,
  tambah field enable password & slot. Testing checklist 17 langkah dibuat
  di `docs/guides/olt-zte-testing-checklist.md` untuk validasi terhadap
  device asli.
- **Files**: `modules/olt/adapters/zte/{ZteAdapter,ZteTelnetClient}.ts`,
  `modules/olt/config/oid-registry/zte.oid.ts`,
  `modules/olt/domain/entities/olt-device.entity.ts`,
  `modules/olt/repositories/{OltRepository,BandwidthProfileRepository}.ts`,
  `modules/olt/services/{OnuDiscoveryService,FirmwareUpgradeService,event-handlers/pelanggan-status.handler}.ts`,
  `modules/olt/validators/olt-device.validator.ts`, `modules/olt/index.ts`,
  `app/admin/olt/devices/tambah/OltDeviceFormClient.tsx`,
  `lib/event-bus/event-handlers.ts`, `prisma/schema.prisma`,
  `docs/guides/olt-zte-testing-checklist.md`
- **Migration**: `20260522180000_olt_add_slot_and_enable_pass`
  (kolom baru `telnetEnablePass`, `defaultSlotFrame`, `defaultSlot` dengan
  default 1; non-destruktif via `IF NOT EXISTS`). **Catatan deploy**: lokal DB
  saat ini punya banyak migration historis yang sudah applied tapi absen dari
  filesystem (drift). Jangan jalankan `prisma migrate dev` di lingkungan
  itu—pakai `prisma migrate resolve --applied 20260522180000_olt_add_slot_and_enable_pass`
  setelah eksekusi SQL manual, atau `prisma migrate deploy` di environment
  bersih (staging/prod) yang baseline-nya sinkron.
- **Breaking**: ❌ Tidak (migration non-destruktif, default slot 1/1 sama
  dengan perilaku sebelumnya, vendor non-ZTE memang sebelumnya sudah ditolak
  validator)

### [2026-05-22] — Hardening end-to-end modul Salary, Accounting, dan Tax

- **Tipe**: [FIXED] [CHANGED] [SECURITY] [MIGRATION]
- **Scope**: `modules/salary`, `modules/accounting`, `modules/tax`, `app/api/admin/salary`, `app/api/mobile/salary`
- **Author**: agent
- **Deskripsi**: Hasil review komprehensif tiga modul finansial menemukan 10 issue lintas-batas yang membahayakan integritas data. Semua diperbaiki dalam batch ini.
  1. **COA mapping mismatch (HIGH)** — `coa-mapping-config.ts` menunjuk ke kode COA yang tidak ada / akun header non-postable di `DEFAULT_COA`. Diperbaiki agar match satu-satu, ditambah unit test verifikasi (`tests/accounting/coa-mapping-config.test.ts`). Mapping baru: `BEBAN_GAJI=5-100`, `UTANG_GAJI=2-350`, `UTANG_BPJS=2-360`, `UTANG_PPH_21=2-400`, `KAS_UTAMA=1-110`, `BANK_UTAMA=1-120`, `KAS_KECIL=1-130`, dst.
  2. **DEFAULT_COA duplikat (HIGH)** — `seedDefaultCoa.ts` di-deprecate menjadi thin wrapper ke `ChartOfAccountService.ensureDefaultCoa`. Sumber kebenaran tunggal sekarang ada di `ChartOfAccountService`. Naming "Hutang"→"Utang" konsisten (PSAK).
  3. **Akuntansi gaji tidak lengkap (HIGH)** — handler `salary-processed-accounting` sekarang menjurnal: DR Beban Gaji + DR Beban BPJS Employer; CR Utang Gaji + Utang PPh21 + Utang BPJS + Piutang Karyawan (kasbon yang dipotong). Sebelumnya BPJS & kasbon tidak terjurnal sama sekali — ledger misstated.
  4. **Event payload SALARY_PROCESSED diperkaya** — sekarang membawa `totalDeductions, bpjsEmployee, bpjsEmployer, advanceDeducted, netSalary, advanceDeductions[]`. Repository PayrollEntry tambah method `findCalculatedEventDetails`.
  5. **Idempotency processAdvanceDeductions (HIGH)** — tambah kolom `PayrollRun.advancesProcessedAt` (migration: `20260522160000_add_payroll_run_advances_processed_at`). Service di-rewrite atomic via `prisma.$transaction`; PUT status=PAID dua kali tidak lagi memotong saldo kasbon ganda.
  6. **Server-side basicSalary di mobile advance (SECURITY)** — `app/api/mobile/salary/advances` tidak lagi menerima `basicSalary` dari body; diambil dari `EmployeePayrollProfile` server-side. Mencegah karyawan kirim nilai palsu untuk lolos validasi `EXCEEDS_MAX_PERCENT`.
  7. **Period-locking guard di disburse** — `SalaryAdvanceManagementService.disburse()` cek `PayrollPeriod.findContainingDate(disbursedAt)` dan menolak bila status LOCKED. Mencegah jurnal salah periode.
  8. **Konsolidasi maxPercentOfSalary** — hapus `buildTenantConfig` di `PayrollCalculationRunService` (yang hardcode `30`); semua path sekarang pakai `getPayrollConfig` (decimal `0.3`). Unit ambiguity hilang.
  9. **PrismaTaxHistoryLoader (HIGH)** — implementasi nyata pengganti `InMemoryTaxHistoryProvider([])` hardcoded. Membaca PayrollEntry/Line tahun berjalan untuk membangun YTD history sebelum kalkulasi. Koreksi PPh21 Desember & resign mid-year sekarang akurat.
 10. **TER PMK 168/2023 di-seed di DEFAULT_TAX_CONFIG** — 132 baris tarif (kategori A/B/C). Tenant baru langsung compliant. PTKP table dilengkapi `KI_0..KI_3` (gabung penghasilan istri). `TerMonthlyStrategy.getPtkpGroup` throw error untuk status tidak dikenal.
 11. **Restitusi PPh21 (HIGH)** — `Math.max(0, finalMonthTax)` tidak lagi menyembunyikan over-collect. Bila negatif, kelebihan bayar di-expose sebagai komponen earning `PPH21_RESTITUSI` plus metadata `restitusiAmount, hasOverpaid`.
- **Files**:
  - `modules/accounting/services/coa/ChartOfAccountService.ts` (tambah Kas Kecil 1-130, Utang BPJS 2-360, 3-300 Laba/Rugi Berjalan; "Hutang"→"Utang")
  - `modules/accounting/services/coa/seedDefaultCoa.ts` (deprecated, jadi wrapper)
  - `modules/accounting/services/event-handlers/coa-mapping-config.ts` (mapping baru, listCoaPurposes)
  - `modules/accounting/services/event-handlers/coa-resolver.ts` (tambah BPJS, Piutang Karyawan)
  - `modules/accounting/services/event-handlers/salary-processed-accounting.handler.ts` (jurnal lengkap)
  - `modules/salary/repositories/PrismaPayrollEntryRepository.ts` (findCalculatedEventDetails)
  - `modules/salary/repositories/PrismaPayrollPeriodRepository.ts` (findContainingDate)
  - `modules/salary/workflow/services/AdvancePostPayrollService.ts` (atomic + idempotent)
  - `modules/salary/workflow/services/PayrollCalculationRunService.ts` (pakai PayrollConfigStore + TaxHistoryLoader)
  - `modules/salary/benefits/advance/SalaryAdvanceManagementService.ts` (period-lock guard, periodRepo injection)
  - `modules/salary/tax/providers/PrismaTaxHistoryLoader.ts` (NEW)
  - `modules/salary/tax/strategies/TerMonthlyStrategy.ts` (KI mapping + throw)
  - `modules/salary/tax/TaxCalculator.ts` (restitusi exposure)
  - `modules/salary/core/config/TaxConfig.ts` (TER PMK 168 + KI PTKP)
  - `modules/salary/factory.ts` (engine accept taxHistoryProvider; advanceManagement inject periodRepo)
  - `modules/salary/workflow/index.ts` (re-export processAdvanceDeductions)
  - `app/api/admin/salary/runs/[id]/route.ts` (publisher payload diperkaya, import via public API)
  - `app/api/mobile/salary/advances/route.ts` (basicSalary server-side)
  - `lib/event-bus/types.ts` (SalaryProcessedPayload diperkaya)
  - `tests/accounting/coa-mapping-config.test.ts` (NEW)
  - `tests/modules/salary/payment/payroll-period-service.test.ts` (mock findContainingDate)
- **Migration**: `20260522160000_add_payroll_run_advances_processed_at`
- **Breaking**: ✅ Ya — payload event `SALARY_PROCESSED` mengandung field baru. Handler accounting mengasumsikan field-field ini ada (semuanya optional di types untuk backward-compat, tapi flow yang publish tanpa field BPJS/advance akan menghasilkan jurnal yang lebih sederhana). Mapping COA berubah; tenant existing yang sudah ada COA non-default perlu memverifikasi mapping mereka.

### [2026-05-22] — Refactor Riwayat Stock Opname (filter, stats, modular UI)

- **Tipe**: [CHANGED]
- **Scope**: `app/api/inventory/opname`, `modules/inventory`, `components/inventory`
- **Author**: agent
- **Deskripsi**: Riwayat Opname direfactor end-to-end. Backend: konsolidasi
  `getOpnameRecord/updateOpname/deleteOpname` ke `InventoryOpnameService`
  (sebelumnya tersebar di `InventoryStockMovementService`); endpoint `[id]`
  sekarang pakai `createHandler` + Zod (`opnameUpdateSchema`); list endpoint
  menerima filter `gudangId/tanggalMulai/tanggalSelesai/alasanSelisih`; ditambah
  endpoint baru `GET /api/inventory/opname/history-stats` untuk agregat
  akurasi/kondisi/hilang dengan filter sama. Frontend: `OpnameReportTable`
  (629 LOC, god component) dipecah jadi composer tipis + `useOpnameHistory`
  hook + `OpnameStatsCards`/`OpnameHistoryFiltersBar`/`OpnameHistoryTable`/
  `OpnameHistoryPaginationBar`; filter bar punya dropdown gudang (fetch
  `/api/inventory/gudang?view=all`), tanggal mulai/selesai, dan alasan selisih
  — Riwayat sekarang bisa difilter per gudang; statistik dihitung di backend
  (sebelumnya hanya agregasi page aktif sehingga menyesatkan); fetch via
  `useEffect` dengan `AbortController` (sebelumnya side-effect di body render);
  `confirm/alert` diganti `ConfirmDialog` + `useToast`; CSV export pakai
  dataset terfilter via list endpoint dengan escaping `"` proper; pagination
  windowed (max 5 tombol). Dead code `components/inventory/OpnameTable.tsx`
  (549 LOC, no consumer) dihapus.
- **Files**:
  `modules/inventory/services/InventoryOpnameService.ts`,
  `modules/inventory/services/inventory-opname-list.helpers.ts`,
  `modules/inventory/services/InventoryStockMovementService.ts`,
  `modules/inventory/validators/opnameValidator.ts`,
  `modules/inventory/index.ts`,
  `app/api/inventory/opname/list/route.ts`,
  `app/api/inventory/opname/[id]/route-handlers-impl.ts`,
  `app/api/inventory/opname/history-stats/route.ts` (baru),
  `components/inventory/OpnameReportTable.tsx`,
  `components/inventory/opname/history/*` (baru),
  `components/inventory/OpnameTable.tsx` (dihapus)
- **Breaking**: ❌ Tidak (kontrak API `list` & `[id]` tetap kompatibel; method
  opname pada `InventoryStockMovementService` dihapus tapi tidak ada consumer
  eksternal)

### [2026-05-22] — Hardening modul OLT (security, multi-tenancy, reliability)

- **Tipe**: [SECURITY]
- **Scope**: `modules/olt`, `app/api/olt`, `app/api/cron/olt-discovery`, `app/api/cron/olt-monitoring`, `prisma/schema.prisma`
- **Author**: agent
- **Deskripsi**: Audit ulang modul OLT dan tutup tujuh celah kritis sekaligus rapikan beberapa code smell.
  Multi-tenancy: semua repository (`OltRepository`, `OnuRepository`, `BandwidthProfileRepository`,
  `VlanConfigRepository`, `PreRegistrationRepository`, `OnuPowerHistoryRepository`,
  `OltCommandLogService`, `OltAlertService`) sekarang wajib `tenantId` di setiap operasi
  by-id; service & API route mem-forward `session.user.tenantId`; query global cross-tenant
  hilang. Validator: `serialNumber` wajib `^[A-Za-z0-9]{1,32}$`, `firmwareFile` strict
  whitelist, OID di `/snmp-walk` dibatasi `^[0-9.]+$`, vendor `create` dibatasi ke `ZTE`
  (HSGQ/Hioso/CData baru stub, dicegah agar tidak bisa dibuat). Cron auth: pakai
  `crypto.timingSafeEqual` dan hapus alias `GET`. Telnet: helper `executeAndAssertSuccess`
  menolak output dengan kata kunci error/failed/invalid; `OnuControlService` tidak lagi
  memutakhirkan status DB saat command sebenarnya gagal. Reliability: race-safe
  `registerOnu` (handle `P2002`), `OnuMonitoringService` batch query (1× per OLT, bukan
  N+1), alert dedup window 6 jam, `discoverByOlt` tidak lagi hardcode `onuIndex=0`
  (kolom dijadikan nullable, `@@unique([oltId, serialNumber])` & `@@unique([tenantId, serialNumber])`).
  Workflow: `deleteOnu` route sekarang panggil `deregisterOnu` agar state OLT konsisten;
  pelanggan-status handler pakai static import.
- **Files**: `modules/olt/repositories/*`, `modules/olt/services/*`,
  `modules/olt/adapters/zte/{ZteAdapter,ZteTelnetClient}.ts`,
  `modules/olt/adapters/OltConnectionManager.ts`,
  `modules/olt/validators/*`, `modules/olt/index.ts`,
  `modules/olt/services/event-handlers/pelanggan-status.handler.ts`,
  semua `app/api/olt/**/*.ts`, `app/api/cron/olt-{discovery,monitoring}/route.ts`,
  `prisma/schema.prisma`
- **Migration**: `20260522170000_olt_multi_tenancy_hardening`
- **Breaking**: ✅ Ya — kontrak `IOltRepository`/`IOnuRepository` berubah (semua operasi
  by-id menerima `tenantId`), `OnuDevice.onuIndex` jadi nullable, validator
  vendor `create` hanya menerima `ZTE`, dan response gagal command tetap `200` tapi
  signature kontrol service berubah (semua method `OnuControlService`/
  `OltProvisioningService`/`BandwidthProfileService`/`OltVlanService`/`FirmwareUpgradeService`
  butuh argument `tenantId`).

### [2026-05-22] — Sinkronisasi Prisma migrations dengan schema (drift recovery)

- **Tipe**: [MIGRATION]
- **Scope**: `prisma/migrations`, `scripts/db-audit`
- **Author**: agent
- **Deskripsi**: Memperbaiki drift antara `prisma/schema.prisma` dan migrations directory. Drift terjadi karena beberapa perubahan schema (OLT enums, kolom-kolom baru, FK rule) sudah pernah diterapkan ke DB lewat `db push` atau SQL manual tanpa generate file migration. Membuat 8 migration baru yang **idempotent** dan **non-destruktif** (pakai `IF NOT EXISTS`, `IF EXISTS`, dan `ALTER TYPE ... USING` untuk preserve data production). Migration OLT (`20260522166000`) memakai **pre-flight validation pattern**: kalau ada nilai di luar enum target, migration **fail loud** dengan `RAISE EXCEPTION` yang mencantumkan nilai bermasalah—bukan menelan error secara diam-diam. Hasil verifikasi `prisma migrate diff` setelah perbaikan: `No difference detected`.
- **Files**:
  - `20260522140000_add_salary_advance_approval_workflow/migration.sql` — fix referensi tabel `tenants` → `Tenant`
  - `20260522160000_add_investor_config_tax_fields/migration.sql` — kolom `isTaxable`, `taxType`, `taxRate`
  - `20260522161000_add_whatsapp_account_type/migration.sql` — kolom `accountType` + index
  - `20260522162000_add_assets_actor_assignment/migration.sql` — kolom `assignedActorId`/`assignedActorType` + composite index
  - `20260522163000_add_inventory_actor_indexes/migration.sql` — index `(actorType, actorId)` di `barang_keluar`/`barang_masuk`
  - `20260522164000_drop_redundant_attendance_indexes/migration.sql` — drop 3 index Attendance obsolete
  - `20260522165000_add_tax_config_histories_table/migration.sql` — tabel audit trail tax config
  - `20260522166000_olt_module_enums_and_schema_evolve/migration.sql` — enum `OltVendor`/`OltStatus`/`OnuStatus`/`OltCommandResult`/`PreRegStatus`, evolusi kolom `olt_devices`/`onu_devices`/`olt_command_logs`/`onu_pre_registrations`, dengan pre-flight validation per kolom enum
  - `20260522167000_fix_tenant_settings_fk_on_delete/migration.sql` — alignment FK `TenantSettings.tenantId` ke `ON DELETE RESTRICT` (sebelumnya `CASCADE`); behavior change: delete tenant dengan settings sekarang akan FK violation, perlu cleanup settings dulu di app layer
  - `scripts/db-audit/pre-olt-enum-migration.sql` — script audit read-only untuk inventarisir nilai existing di kolom OLT/ONU sebelum migration enum dijalankan di production
- **Migration**: 8 file baru di `prisma/migrations/`
- **Breaking**: ⚠️ Sebagian — `TenantSettings` FK rule berubah dari `CASCADE` ke `RESTRICT`. App code yang panggil `prisma.tenant.delete()` harus handle case settings exists (delete settings dulu). Migrasi enum OLT akan **gagal** kalau ada data nilai out-of-range; jalankan dulu `scripts/db-audit/pre-olt-enum-migration.sql` di production untuk audit.

### [2026-05-22] — Tambah super admin guard di /admin/website layout

- **Tipe**: [SECURITY]
- **Scope**: `app/admin/website`
- **Author**: agent
- **Deskripsi**: Sebelumnya halaman `/admin/website/*` (hero, footer, fitur, pricing, testimonial, faq) tidak punya page-level auth guard — meskipun semua API route sudah pakai `isSuperAdmin` check, user non-super-admin yang mengetik URL langsung akan tetap bisa load halaman (walau API call akan gagal403). Ditambah `app/admin/website/layout.tsx` server component yang verifikasi `isSuperAdmin(session.user)` dan redirect ke `/admin?error=SuperAdminOnly` jika bukan. Ini memastikan konsistensi authorization antara API layer dan UI layer.
- **Files**: `app/admin/website/layout.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-22] — Tambah unit tests untuk modul website

- **Tipe**: [ADDED]
- **Scope**: `tests/modules/website`, `tests/api/admin-website-upload-logo-route.test.ts`
- **Author**: agent
- **Deskripsi**: Sebelumnya modul `website` tidak punya tests sama sekali. Ditambah36 unit tests yang cover: (1) Zod validators untuk6 schemas (hero, footer, feature, pricing, testimonial, faq) termasuk constraint dan field `logoUrl` baru, (2) `LandingContentService` dengan mock repository yang verify delegasi method dan mapping JSON→typed di `getAllContent`, (3) endpoint `POST /api/admin/website/upload-logo` cover auth (super admin only), validasi file, success path, error handling.
- **Files**: `tests/modules/website/landing-content.validator.test.ts`, `tests/modules/website/LandingContentService.test.ts`, `tests/api/admin-website-upload-logo-route.test.ts`
- **Breaking**: ❌ Tidak

### [2026-05-22] — Tambah upload logo navbar dan footer di landing page

- **Tipe**: [ADDED]
- **Scope**: `modules/website`, `app/api/admin/website/upload-logo`, `app/admin/website/hero`, `app/admin/website/footer`, `components/landing/SaasLandingPage.tsx`
- **Author**: agent
- **Deskripsi**: Super admin sekarang dapat upload2 logo terpisah untuk landing page SaaS: logo navbar (background terang) lewat halaman Hero, dan logo footer (background gelap) lewat halaman Footer. Render di komponen pakai `<img>` dengan fallback ke ikon `MdRocketLaunch` default jika belum di-upload. Endpoint upload baru `POST /api/admin/website/upload-logo` (super admin only) menyimpan ke folder `public/uploads/landing-logo/`. Komponen reusable `LogoUploader` dipakai di kedua halaman admin.
- **Files**: `prisma/schema.prisma` (LandingHero.logoUrl, LandingFooter.logoUrl), `modules/website/domain/LandingContent.ts`, `modules/website/validators/landing-content.validator.ts`, `modules/website/repositories/LandingContentRepository.ts`, `lib/upload/upload-policy.ts`, `app/api/admin/website/upload-logo/route.ts`, `components/admin/website/LogoUploader.tsx`, `components/landing/SaasLandingPage.tsx`
- **Migration**: `20260522150000_add_logo_url_to_landing_hero_and_footer`
- **Breaking**: ❌ Tidak

### [2026-05-22] — Refactor modul website (clean architecture cleanup)

- **Tipe**: [CHANGED]
- **Scope**: `modules/website`, `app/api/public/landing-content`
- **Author**: agent
- **Deskripsi**: Perbaikan code smell di modul website: weak typing (`Record<string, unknown>`) di `updatePricing` dan `upsertFooter` diganti typed struct, data mapping JSON→typed dipindah dari repository ke service layer (proper layering), dan public route `landing-content` di-migrasi ke `createHandler` agar punya error boundary konsisten dengan admin routes. Tidak mengubah API contract.
- **Files**: `modules/website/repositories/LandingContentRepository.ts`, `modules/website/services/LandingContentService.ts`, `app/api/public/landing-content/route.ts`
- **Breaking**: ❌ Tidak

### [2026-05-22] — Implementasi fitur kasbon (salary advance) end-to-end

- **Tipe**: [ADDED]
- **Scope**: `modules/salary`, `modules/accounting`, `app/api/admin/salary/advances/`, `app/api/mobile/salary/advances/`
- **Author**: agent
- **Deskripsi**: Implementasi lengkap lifecycle kasbon: request (mobile) → approve/reject → disburse → auto-deduct di payroll → mark DEDUCTED. Termasuk:
  1. API admin: list, create, approve, reject, disburse kasbon
  2. API mobile: request dan list kasbon karyawan
  3. Event `SALARY_ADVANCE_DISBURSED` → auto-posting journal (DR Piutang Karyawan / CR Kas)
  4. Post-payroll service: auto-update `remainingAmount` dan status DEDUCTED saat payroll PAID
  5. COA baru: 1-150 Piutang Karyawan
- **Files**:
  - `app/api/admin/salary/advances/route.ts`
  - `app/api/admin/salary/advances/[id]/route.ts`
  - `app/api/mobile/salary/advances/route.ts`
  - `modules/salary/workflow/services/AdvancePostPayrollService.ts`
  - `modules/accounting/services/event-handlers/advance-disbursed-accounting.handler.ts`
- **Migration**: Butuh migration untuk enum `AUTO_SALARY_ADVANCE` di JournalSource
- **Breaking**: ❌ Tidak

### [2026-05-22] — Integrasi salary→accounting dan hardening module keuangan

- **Tipe**: [ADDED]
- **Scope**: `modules/accounting`, `modules/salary`, `modules/tax`, `lib/event-bus`
- **Author**: agent
- **Deskripsi**: Lima perbaikan hasil code review module penggajian, akuntan, dan pajak:
  1. Event handler `salary-processed-accounting` untuk auto-posting journal beban gaji (DR Beban Gaji 5-200, CR Utang Gaji 2-300)
  2. PayrollApprovalService dengan repository Prisma — approval workflow 2-level (HR → Finance)
  3. Implementasi `PrismaPayrollPeriodRepository` dan `PrismaSalaryAdvanceRepository`
  4. COA mapping configurable per tenant via `coa-mapping-config.ts` (menghilangkan hardcoded magic strings)
  5. Hardening: NaN validation di salary-processed-tax handler, warning log di COA fallback
- **Files**:
  - `modules/accounting/services/event-handlers/salary-processed-accounting.handler.ts`
  - `modules/accounting/services/event-handlers/coa-mapping-config.ts`
  - `modules/accounting/services/event-handlers/coa-resolver.ts`
  - `modules/salary/repositories/PrismaPayrollPeriodRepository.ts`
  - `modules/salary/repositories/PrismaSalaryAdvanceRepository.ts`
  - `modules/salary/repositories/PrismaApprovalWorkflowRepository.ts`
  - `modules/salary/factory.ts`
  - `modules/tax/services/event-handlers/salary-processed-tax.handler.ts`
- **Migration**: Butuh migration untuk model `PayrollApprovalWorkflow` dan enum `AUTO_SALARY`
- **Breaking**: ❌ Tidak

### [2026-05-22] — Website CMS untuk manage konten landing page

- **Tipe**: [ADDED]
- **Scope**: `modules/website`, `app/admin/website/`, `app/api/admin/website/`
- **Author**: agent
- **Deskripsi**: Admin panel baru untuk super admin manage konten SaaS landing page
  (hero, fitur, pricing, testimonial, FAQ, footer). Kategori "Website" ditambahkan
  di sidebar. Landing page sekarang render konten dari database dengan fallback
  ke default hardcoded.
- **Migration**: `20260522120000_add_landing_content_tables`
- **Breaking**: ❌ Tidak

### [2026-05-22] — Multi-tenant landing page dengan custom domain management

- **Tipe**: [ADDED]
- **Scope**: `modules/tenant`, `app/page.tsx`, `components/landing/`
- **Author**: agent
- **Deskripsi**: Implementasi landing page per tenant dengan branding dinamis.
  Landing page RADPRO.ID (SaaS) dipisah dari landing page tenant. Setiap tenant
  otomatis dapat subdomain ({slug}.radpro.id) dan bisa menambahkan custom domain
  via CNAME. Termasuk DNS verification cron job dan SSL auto-provisioning via
  cert-manager.
- **Migration**: `20260522100000_add_tenant_domain_table`
- **Breaking**: ❌ Tidak

### [2026-05-22] — Rewrite modul salary ke V2 (standar payroll Indonesia)

- **Tipe**: [ADDED]
- **Scope**: `modules/salary-v2`
- **Author**: agent
- **Deskripsi**: Rewrite lengkap modul salary dengan standar payroll Indonesia. Mencakup:
  - Core domain model (16 enums, 10 entities, 3 value objects, 8 repository ports, config types)
  - Calculation engine dengan pipeline pattern (9 calculators: BasicSalary, Prorata, Attendance, Overtime, Component, BPJS, Tax, LoanDeduction, NetSalary)
  - Tax engine lengkap (TER brackets PP 58/2023, progressive Pasal 17, iterative gross-up, annual correction Desember, resign mid-year)
  - Benefits engine (THR dengan prorata, rapel/back-pay, salary advance dengan validasi)
  - Payment & period management (pay schedule, period lifecycle OPEN→PROCESSING→CLOSED→LOCKED, auto-lock)
  - Workflow & compliance (compliance rules UMR/overtime cap/BPJS, multi-step approval, audit trail)
  - Reporting (payslip generator, accounting journal, export CSV)
  - API routes (Next.js App Router, 7 endpoints)
  - Admin frontend (4 halaman: runs, detail, components, profiles)
  - Data migration script dari modul lama
  - Prisma schema (14 enums, 11 models baru dengan suffix V2)
  - 246+ unit tests passing
- **Files**: `modules/salary-v2/`, `app/api/admin/salary-v2/`, `app/admin/salary-v2/`, `prisma/schema.prisma`
- **Migration**: Pending — perlu run `npx prisma migrate dev --name add_payroll_v2_tables`
- **Breaking**: ❌ Tidak (modul baru, modul lama tetap ada)

### [2026-05-21] — Refactor circular dependency finance ↔ pelanggan

- **Tipe**: [CHANGED]
- **Scope**: `modules/finance`
- **Author**: agent
- **Deskripsi**: Menghilangkan runtime circular dependency antara finance dan pelanggan module.
  Semua 11 file di finance yang import langsung dari pelanggan sekarang menggunakan
  lazy-loading registry (`pelanggan-registry.ts`) dengan `require()` yang di-resolve
  saat pertama kali diakses. Type-only imports tetap dipertahankan (di-strip saat compile).
  Ini memastikan module loading order tidak lagi saling bergantung di runtime.
- **Files**: `modules/finance/pelanggan-registry.ts` (new),
  `modules/finance/domain/ports/IPelangganBillingBridge.ts` (new),
  `modules/finance/services/AutomaticBillingService.ts`,
  `modules/finance/services/AutomaticIsolationSchedulerService.ts`,
  `modules/finance/services/AutomaticIsolationExecutionService.ts`,
  `modules/finance/services/ManualPaymentAdminRouteService.ts`,
  `modules/finance/services/VoidInvoiceService.ts`,
  `modules/finance/services/PaymentRouteService.ts`,
  `modules/finance/services/InvoiceRouteService.ts`,
  `modules/finance/services/PaymentCancellationService.ts`,
  `modules/finance/services/InvoiceCollectionRouteService.ts`,
  `modules/finance/services/manual-payment-admin.helpers.ts`,
  `modules/finance/services/automatic-billing-payment.helpers.ts`
- **Breaking**: ❌ Tidak

### [2026-05-21] — Fix integrasi payment-billing: transaction safety dan gateway failure handling

- **Tipe**: [FIXED]
- **Scope**: `modules/payment-gateway`, `modules/finance`, `modules/pelanggan`, `lib/event-bus`
- **Author**: agent
- **Deskripsi**: Perbaikan 4 issue integrasi payment-billing:
  (1) Invoice read di `updateInvoiceStatus` dipindah ke dalam transaction context (`tx`) untuk
  mencegah stale data pada concurrent webhook processing.
  (2) Silent gateway failure di `createGatewayPaymentIfNeeded` sekarang mark payment records
  sebagai FAILED dan throw error ke customer (bukan return null diam-diam).
  (3) Circular dependency finance↔pelanggan didokumentasikan dan interface
  `IPelangganBillingBridge` dibuat di finance ports untuk future decoupling.
  (4) Dead event `PAYMENT_RECEIVED` dihapus dari event-bus types (tidak pernah di-emit,
  tidak ada handler).
- **Files**: `modules/payment-gateway/services/webhook-invoice-settlement-service.ts`,
  `modules/pelanggan/services/CustomerPaymentRouteService.ts`,
  `modules/finance/services/CustomerPaymentFinanceService.ts`,
  `modules/finance/repositories/PaymentRepository.ts`,
  `modules/finance/domain/ports/IPelangganBillingBridge.ts` (new),
  `lib/event-bus/types.ts`
- **Breaking**: ❌ Tidak

### [2026-05-21] — Hardening payment gateway module (security, reliability, robustness)

- **Tipe**: [SECURITY]
- **Scope**: `modules/payment-gateway`, `app/api/payments/`, `app/api/admin/payments/`, `app/api/customer/payments/`
- **Author**: agent
- **Deskripsi**: Perbaikan 14 issue dari code review payment gateway:
  **Security (Wave 1):** Tambah RBAC permission check di 3 API route (cancel, verify-manual, payments CRUD),
  fix Moota webhook verification bypass (reject jika apiSecret kosong), validasi amount > 0 sebelum
  dikirim ke provider, reject empty API key saat initialize provider.
  **Reliability (Wave 2):** Fix Xendit async race condition (lazy-load SDK pattern), tambah fetch timeout
  30s di semua provider via `fetchWithTimeout` helper, fix UUID fallback di idempotency (throw error
  bukan random UUID), fix amount mismatch handling (markAsFailed bukan PROCESSED untuk audit trail),
  fix re-parse di catch block yang bisa throw.
  **Robustness (Wave 3):** Fix Midtrans signature config (verifikasi di body bukan header),
  fix BRI hardcoded webhook URL, tambah Zod validation di customer payment route,
  bounded metrics ring buffer (max 1000 entries).
- **Files**: `modules/payment-gateway/services/PaymentGatewayService.ts`,
  `modules/payment-gateway/services/providers/xendit-provider.ts`,
  `modules/payment-gateway/services/providers/moota-provider.ts`,
  `modules/payment-gateway/services/providers/fetch-with-timeout.ts` (new),
  `modules/payment-gateway/services/WebhookIdempotencyService.ts`,
  `modules/payment-gateway/services/webhook-processing-service.ts`,
  `modules/payment-gateway/services/PaymentGatewayMetrics.ts`,
  `modules/payment-gateway/services/WebhookVerificationService.ts`,
  `modules/payment-gateway/services/provider-interface.ts`,
  `modules/payment-gateway/services/providers/bri-provider-utils.ts`,
  `modules/payment-gateway/domain/value-objects/ProviderType.ts`,
  `app/api/admin/payments/[id]/cancel/route.ts`,
  `app/api/admin/payments/verify-manual/route.ts`,
  `app/api/payments/route.ts`,
  `app/api/customer/payments/route.ts`
- **Breaking**: ❌ Tidak

### [2026-05-21] — Tambah UI pages setoran masuk dan bagi hasil investor

- **Tipe**: [ADDED]
- **Scope**: `app/admin/investors/deposits/`, `app/admin/investors/profit-shares/`
- **Author**: agent
- **Deskripsi**: Dua halaman baru untuk modul investor. Halaman Setoran Masuk
  menampilkan antrian deposit PENDING dengan aksi Verifikasi, Selesaikan, dan Tolak
  (beserta modal alasan penolakan), filter per status, dan hero card total pending.
  Halaman Bagi Hasil menampilkan form kalkulasi bagi hasil (periode + laba bersih),
  list semua profit shares dengan aksi Setujui dan Tandai Dibayar, serta summary
  cards per status. Kedua halaman menggunakan design system yang konsisten
  (gradient hero card, dark mode, Bahasa Indonesia).
- **Files**: `app/admin/investors/deposits/page.tsx`,
  `app/admin/investors/deposits/DepositsClient.tsx`,
  `app/admin/investors/profit-shares/page.tsx`,
  `app/admin/investors/profit-shares/ProfitSharesClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-21] — Tambah modul pajak (Tax Module)

- **Tipe**: [ADDED]
- **Scope**: `modules/tax`, `app/api/admin/tax/`, `app/admin/pajak/`
- **Author**: agent
- **Deskripsi**: Modul pajak lengkap untuk ISP — PPN otomatis saat invoice dibuat,
  PPh 21/23/4(2) otomatis dari salary/expense, BHP/USO kalkulasi bulanan,
  rekap periode, reminder jatuh tempo, denda keterlambatan, export CSV.
  Termasuk 5 halaman UI (dashboard, konfigurasi, transaksi, BHP/USO, export)
  dan menu sidebar terpisah.
- **Files**: `modules/tax/`, `app/api/admin/tax/`, `app/api/cron/tax/`,
  `app/admin/pajak/`, `lib/menu-config.ts`, `lib/permission-config.ts`
- **Breaking**: ❌ Tidak

### [2026-05-21] — Refactor UI modul akuntansi + fitur COA

- **Tipe**: [CHANGED]
- **Scope**: `app/admin/akuntansi/`, `modules/accounting`
- **Author**: agent
- **Deskripsi**: Refactor seluruh UI modul akuntansi ke design system hybrid
  (gradient hero card + rounded-2xl + dark mode). Tambah fitur: tree view COA
  berjenjang, kolom saldo per akun, filter lengkap (cari/tipe/klasifikasi/status),
  edit akun, auto-generate kode akun, auto-seed COA standar ISP (26 akun +
  10 akun pajak), label CAPEX/OPEX/COGS, tombol seed di halaman backup.
  Semua label Bahasa Indonesia.
- **Files**: `app/admin/akuntansi/coa/CoaClient.tsx`,
  `app/admin/akuntansi/jurnal/`, `app/admin/akuntansi/laporan/`,
  `modules/accounting/services/coa/ChartOfAccountService.ts`,
  `app/api/admin/accounting/coa/`
- **Breaking**: ❌ Tidak

### [2026-05-21] — Deep review & fix halaman ACS Devices

- **Tipe**: [FIXED]
- **Scope**: `modules/network`, `app/api/acs/devices/`, `app/admin/network/acs/devices/`
- **Author**: agent
- **Deskripsi**: Deep review dan perbaikan menyeluruh halaman ACS Devices:
  - Fix DELETE handler yang missing (UI memanggil tapi handler tidak ada)
  - Tambah Zod validation di task/wan endpoint
  - Tambah tenant ownership verification di configureWan, createTask, deleteDevice (security fix)
  - Deduplikasi tipe GenieAcsDevice ke file terpisah
  - Hapus singleton factory yang unused
  - Fix hardcoded Online status di detail page
  - Connect WAN modal inputs (name, vlan) ke state
  - SSID modal sekarang dynamic (support 2.4G dan 5G)
  - Ganti native confirm() dengan ConfirmDialog component
  - Tambah dark mode di semua modal
  - Rename hook useDevicesPolling → useDevicesQuery
  - Hapus Interface Bindings non-functional dari WAN modal
- **Files**: `modules/network/services/AcsDeviceService.ts`,
  `modules/network/services/AcsDeviceService.types.ts`,
  `modules/network/validators/acs-device.ts`,
  `app/api/acs/devices/[id]/route.ts`,
  `app/admin/network/acs/devices/DevicesClient.tsx`,
  `app/admin/network/acs/devices/components/DeviceDetailModals.tsx`,
  `app/admin/network/acs/devices/components/DeviceDetailPanels.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-21] — Tambah fitur UX halaman ACS Devices

- **Tipe**: [ADDED]
- **Scope**: `app/admin/network/acs/devices/`
- **Author**: agent
- **Deskripsi**: Peningkatan kegunaan halaman ACS Devices:
  - Summary cards (Total/Online/Offline/Critical RX) yang clickable untuk filter
  - Filter dropdown di toolbar (All/Online/Offline/Critical RX)
  - Sortable columns (Serial, PPPoE, RX Power, Last Inform)
  - Link PPPoE → halaman pelanggan
  - Panel SSID 5GHz di detail page
  - Panel Connected Hosts di detail page (tabel device yang terkoneksi ke ONT)
- **Files**: `app/admin/network/acs/devices/components/DevicesSummary.tsx`,
  `app/admin/network/acs/devices/components/DevicesTable.tsx`,
  `app/admin/network/acs/devices/components/DevicesToolbar.tsx`,
  `app/admin/network/acs/devices/components/DeviceDetailPanels.tsx`,
  `modules/network/services/AcsDeviceService.formatters.ts`
- **Breaking**: ❌ Tidak

### [2026-05-21] — Fix modul coupons: tenant isolation, CRUD lengkap, auth verify

- **Tipe**: [FIXED]
- **Scope**: `modules/coupons`, `app/api/coupons/`
- **Author**: agent
- **Deskripsi**: Perbaikan beberapa issue di modul coupons:
  - Tambah tenant isolation di repository, service, dan API routes
  - Tambah GET single coupon dan PUT update coupon endpoint
  - Fix test enum `"PERCENTAGE"` → `"PERCENT"`
  - Ubah verify endpoint dari `auth: false` ke `auth: true`
  - Pass tenantId ke coupon verification di payment flow
- **Files**: `modules/coupons/repositories/CouponRepository.ts`,
  `modules/coupons/services/CouponService.ts`, `app/api/coupons/[id]/route.ts`,
  `app/api/coupons/verify/route.ts`
- **Breaking**: ✅ Ya (verify endpoint sekarang butuh auth — hanya affect customer portal yang sudah authenticated)

### [2026-05-21] — Integrasi kupon dengan modul akuntansi (auto-journal)

- **Tipe**: [ADDED]
- **Scope**: `modules/accounting`, `modules/pelanggan`, `lib/event-bus`
- **Author**: agent
- **Deskripsi**: Saat kupon dipakai untuk pembayaran, sistem otomatis membuat jurnal
  akuntansi (contra-revenue). Debit 4-300 Potongan Penjualan, Credit 1-200 Piutang Usaha.
  Terintegrasi via domain event `billing:coupon.used` yang di-publish setelah payment commit.
- **Files**: `modules/accounting/services/event-handlers/coupon-used-accounting.handler.ts`,
  `modules/accounting/services/coa/ChartOfAccountService.ts`,
  `modules/pelanggan/services/CustomerPaymentRouteService.ts`,
  `lib/event-bus/types.ts`, `prisma/schema.prisma`
- **Migration**: pending (enum `JournalSource` ditambah `AUTO_COUPON_USED`)
- **Breaking**: ❌ Tidak

### [2026-05-20] — Modul OLT Provisioning (Phase 1-5 complete)

- **Tipe**: [ADDED]
- **Scope**: `modules/olt/`, `app/api/olt/`, `app/admin/olt/`, `app/api/cron/olt-discovery/`, `app/api/cron/olt-monitoring/`, `lib/permission-config.ts`, `lib/menu-config.ts`
- **Author**: agent
- **Deskripsi**: Modul OLT Provisioning baru untuk manajemen perangkat OLT multi-vendor (ZTE pilot, HSGQ/Hioso/C-Data skeleton). Mencakup:
  - **Phase 1**: Database schema (5 model + 6 enum), domain layer (entities, ports, errors), ZTE adapter (telnet + SNMP), OLT CRUD, admin UI (list/tambah/detail), test connection
  - **Phase 2**: ONU discovery via SNMP, ONU registration via Telnet CLI, pre-registration system, cron auto-discovery (5 menit), search by SN, assign ONU ke pelanggan
  - **Phase 3**: ONU control (disable/enable/reset/reboot via Telnet), VLAN management (set/remove service port), event handler pelanggan suspend→auto disable ONU
  - **Phase 4**: SNMP Explorer tool (walk OID tree untuk riset vendor baru)
  - **Phase 5**: Bandwidth profile management, bulk operations (batch register/disable/enable max 50), ONU monitoring (poll optical power + threshold alert), firmware upgrade ONU
  - 30+ API endpoints, 16+ admin UI pages, 12 services, 6 repositories, full audit trail
- **Files**: `modules/olt/` (domain, adapters, services, repositories, validators, config), `app/api/olt/`, `app/admin/olt/`, `prisma/schema.prisma`
- **Migration**: pending (schema added, migration belum di-apply karena DB divergence)
- **Breaking**: ❌ Tidak

### [2026-05-20] — Modul Akuntansi (Phase 1-6 complete)

- **Tipe**: [ADDED]
- **Scope**: `modules/accounting`, `app/api/admin/accounting/`, `app/api/cron/accounting/`, `lib/event-bus/`, `lib/permission-config.ts`
- **Author**: agent
- **Deskripsi**: Modul akuntansi baru dengan double-entry General Ledger. Mencakup:
  Chart of Accounts (18 default per tenant), JournalPostingService (manual + auto),
  4 event handlers (invoice-created, invoice-paid, expense-approved, po-paid) gated
  feature flag `ACCOUNTING_MODULE_ENABLED`, 6 laporan (Trial Balance, Laba Rugi, Neraca,
  Arus Kas, Buku Kas, Buku Besar), Period Closing (3 closing journals + reopen),
  Journal Reversal, Opening Balance, Recurring Journal Engine (cron harian),
  Bank Reconciliation (CSV parser BCA/Mandiri/BNI + autoMatcher Levenshtein),
  Health Check cron, 8 permissions baru, 18 API routes.
- **Files**: `modules/accounting/`, `app/api/admin/accounting/`, `app/api/cron/accounting/`,
  `prisma/schema.prisma`, `prisma/migrations/20260520000000_add_accounting_module/`,
  `lib/event-bus/types.ts`, `lib/event-bus/event-handlers.ts`, `lib/permission-config.ts`
- **Migration**: `20260520000000_add_accounting_module`
- **Breaking**: ❌ Tidak

### [2026-05-20] — Fix data contact tidak tersimpan saat create WO (guest/MixRadius)

- **Tipe**: [FIXED]
- **Scope**: `lib/validations/workorder.ts`, `modules/work-order/services/work-order.mutation.types.ts`
- **Author**: agent
- **Deskripsi**: Field `contactName`, `contactPhone`, dan `locationAddress` tidak ada di Zod schema (`workOrderCreateSchema`) maupun `CreateWorkOrderInput` interface. Akibatnya Zod `safeParse()` membuang field tersebut dari payload — data contact yang diisi user di form tidak pernah sampai ke DB. Ditambahkan ketiga field ke schema dan interface sehingga alur data frontend → Zod → service → repository → DB kini utuh.
- **Files**: `lib/validations/workorder.ts`, `modules/work-order/services/work-order.mutation.types.ts`
- **Breaking**: ❌ Tidak

### [2026-05-20] — Customer Info di WO list/detail tidak tampil untuk pelanggan MixRadius

- **Tipe**: [FIXED]
- **Scope**: `app/admin/workorders`, `modules/work-order`
- **Author**: agent
- **Deskripsi**: Sejak commit `22f72832d` (Jan 2026 — pivot ke `MixRadiusCustomer` model), semua WO yang dibuat dari pelanggan MixRadius selalu disimpan dengan `pelangganId: null` (sesuai desain karena data pelanggan ada di MixRadius, bukan DB lokal). Tapi `WoSidebar` dan `WoListClient` masih merender Customer Info hanya dari relasi `workOrder.pelanggan` — alhasil 1968 WO existing tidak menampilkan nama, ID, telepon, atau alamat pelanggan. Diperbaiki dengan helper `getWorkOrderCustomerInfo` yang resolve sumber pelanggan secara konsisten dari `pelanggan` (FK lokal), `[MixRadius: <username>]` marker di description, atau fallback `contactName/contactPhone/locationAddress`. UI sekarang menampilkan badge sumber (Lokal/MixRadius/Internal/Guest) dan field-field customer terisi untuk semua sumber. Tidak ada migration DB — semata-mata layer rendering yang dilengkapi.
- **Files**: `modules/work-order/utils/mixradius-customer-info.ts` (baru), `modules/work-order/client.ts`, `modules/work-order/domain/entities/WorkOrderRepositoryTypes.ts`, `modules/work-order/repositories/work-order-repository-selects.ts`, `app/admin/workorders/[id]/types.ts`, `app/admin/workorders/[id]/components/WoSidebar.tsx`, `app/admin/workorders/list/WoListClient.tsx`
- **Breaking**: ❌ Tidak

### [2026-05-20] — Standarkan permission `list:*` → `workorders:*` di workorders pages

- **Tipe**: [FIXED]
- **Scope**: `app/admin/workorders`, `app/api/admin/workorders`
- **Author**: agent
- **Deskripsi**: Page-level (`list/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `layout.tsx`, `page.tsx`) dan client-level (`WoListClient`, `WoDetailClient`) masih menggunakan resource legacy `list:*` yang inkonsisten dengan API (`workorders:*`), `RoleFactory`, dan konstanta `PERMISSIONS.WORK_ORDER`. Walaupun alias dua arah `list:* ↔ workorders:*` mencegah 403 secara fungsional, inkonsistensi ini menyimpang dari standar catalog dan menyulitkan audit RBAC. Diseragamkan ke `workorders:*` (read/create/update/delete/cancel/verify/approve_request) sesuai pola standar. Pola fallback `workorders:* || list:*` di `WoDetailClient` dan endpoint `[id]/approve` ikut disederhanakan karena `hasPermissionWithAlias` sudah menangani backward compatibility lewat `PERMISSION_ALIASES`.
- **Files**: `app/admin/workorders/page.tsx`, `app/admin/workorders/layout.tsx`, `app/admin/workorders/list/page.tsx`, `app/admin/workorders/list/WoListClient.tsx`, `app/admin/workorders/new/page.tsx`, `app/admin/workorders/[id]/page.tsx`, `app/admin/workorders/[id]/WoDetailClient.tsx`, `app/api/admin/workorders/[id]/approve/route.ts`
- **Breaking**: ❌ Tidak (alias backward-compatible tetap aktif di `lib/permission-aliases.ts`)

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
