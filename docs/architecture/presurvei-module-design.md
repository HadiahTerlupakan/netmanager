# Desain Modul Presurvei

**Tanggal**: 2026-09-22
**Status**: Draft — menunggu review
**Scope**: `modules/presurvei`, `modules/registration` (perubahan minor), mobile app

---

## 1. Tujuan

Memberi manajemen visibilitas atas kegiatan tim sales dan marketing: siapa mengerjakan
apa, di mana, dan hasilnya apa — baik yang bekerja di lapangan (kunjungan, walk-in)
maupun di kantor (iklan berbayar).

Prospek yang dihasilkan dari kegiatan tersebut dikelola sampai matang, lalu
dipromosikan ke modul Canvasing yang sudah ada untuk diproses menjadi pelanggan.

**Pertanyaan yang harus bisa dijawab modul ini:**

1. Sales A hari ini berkunjung ke mana saja, dan hasil tiap kunjungan apa?
2. Marketing B menjalankan iklan apa, dan berapa prospek yang masuk dari iklan itu?
3. Prospek ini datangnya dari mana — kunjungan lapangan, iklan, website, atau referral?
4. Berapa prospek yang akhirnya menjadi canvasing, dan siapa yang membawanya?
5. Sudah sejauh mana pencapaian target tiap sales bulan ini?

---

## 2. Konteks — apa yang sudah ada

Modul ini dibangun di atas fondasi yang sudah berjalan. Yang **sudah ada dan tidak
diubah**:

| Komponen | Keterangan |
|---|---|
| `Canvasing` (`modules/marketing`) | Prospek door-to-door lengkap: KTP, foto, GPS, paket, estimasi kabel, ODP. Approve → auto-create Work Order `INSTALLATION` + checklist task. |
| `PointClaim` (`modules/marketing`) | Gamifikasi poin sales dan cashout. |
| `Registrations` (`modules/registration`) | Form pendaftaran publik `/register` dengan captcha Turnstile. |
| `User.isSales`, `User.canvasingTarget` | Penanda sales dan target canvasing. |
| Permission `canvasing:*`, `sales:*`, `sales_dashboard:*`, `m_canvasing:*` | Sudah matang, termasuk role template "Sales / Marketing". |
| Mobile: JWT Bearer, antrian offline SQLite, upload foto → WebP → R2, GPS | Dipakai ulang apa adanya. |

**Lubang yang diisi modul ini**: tidak ada pencatatan kegiatan sales, tidak ada
entitas prospek yang bisa di-follow-up berulang, tidak ada atribusi sumber prospek,
dan tidak ada target per periode dengan riwayat.

**Di luar cakupan (sengaja tidak dikerjakan sekarang)**:

- Perhitungan komisi rupiah — target dulu, komisi menyusul setelah data kegiatan
  terkumpul dan aturannya jelas dari pemakaian nyata
- Integrasi API ke Meta Lead Ads / Google Ads — prospek dari iklan masuk lewat
  input manual dan form publik
- Rencana kunjungan harian (plan vs realisasi) — hanya realisasi yang dicatat
- Perubahan pada alur Canvasing, PointClaim, atau Work Order

---

## 3. Arsitektur

`modules/presurvei` berdiri sendiri, mengikuti pola modul terbaru di repo
(`modules/endorsement`): domain murni, ports, mapper, DTO, validator Zod, service
dengan constructor DI.

**Kenapa modul terpisah, bukan ditambahkan ke `modules/marketing`**: modul marketing
sudah menampung Canvasing, PointClaim, dan sales dashboard (45 file). Menambahkan
kegiatan, prospek, iklan, dan target ke sana membuatnya punya banyak alasan berubah
sekaligus — melanggar Single Responsibility di tingkat modul.

```
modules/presurvei/
├── domain/
│   ├── entities/
│   │   ├── Kegiatan.ts          # const array status + union type + entity
│   │   ├── Prospek.ts
│   │   ├── Iklan.ts
│   │   └── Target.ts
│   ├── ports/
│   │   ├── IKegiatanRepository.ts
│   │   ├── IProspekRepository.ts
│   │   ├── IIklanRepository.ts
│   │   └── ITargetRepository.ts
│   └── prospek-rules.ts         # aturan transisi status, fungsi murni
├── dto/
│   ├── kegiatan.dto.ts
│   ├── prospek.dto.ts
│   ├── iklan.dto.ts
│   └── laporan.dto.ts
├── mappers/                     # Row Prisma → domain entity
├── repositories/
├── services/
│   ├── KegiatanService.ts
│   ├── ProspekService.ts
│   ├── ProspekKonversiService.ts    # promosi prospek → canvasing
│   ├── IklanService.ts
│   ├── TargetService.ts
│   ├── LaporanPresurveiService.ts
│   ├── presurvei.notifications.ts
│   └── event-handlers/
│       └── registration-created-presurvei.handler.ts
├── validators/
└── index.ts                     # public API
```

**Ketergantungan keluar modul** — hanya dua, keduanya lewat public API:

- `@/modules/marketing` → `CanvasingService.createRequest()` saat promosi prospek
- `@/modules/database` → klien Prisma dengan ekstensi isolasi tenant

Repository dan mapper **tidak** diekspor dari `index.ts`.

---

## 4. Model data

Empat tabel baru, semua dengan `tenantId` (isolasi tenant ditangani otomatis oleh
ekstensi Prisma) dan `siteId` opsional untuk site-scoping.

### 4.1 `PresurveiKegiatan`

Jantung modul — inilah yang menjawab "sales saya mengerjakan apa".

```prisma
model PresurveiKegiatan {
  id        String @id @default(uuid())

  jenis     PresurveiJenisKegiatan
  userId    String                            // pelaku: sales atau marketing
  user      User   @relation("UserPresurveiKegiatan", fields: [userId], references: [id])

  prospekId String?                           // null bila belum menghasilkan prospek
  prospek   PresurveiProspek? @relation(fields: [prospekId], references: [id])

  iklanId String?                             // diisi saat jenis = IKLAN
  iklan   PresurveiIklan? @relation(fields: [iklanId], references: [id])

  waktuMulai   DateTime
  waktuSelesai DateTime?

  // Ke mana — diisi untuk KUNJUNGAN dan SURVEI_LOKASI
  latitude         Float?
  longitude        Float?
  alamatDikunjungi String?

  ditemuiNama String?                         // ketemu siapa
  hasil       PresurveiHasilKegiatan
  catatan     String?
  fotoUrls    String[]                        // bukti kunjungan

  // Hasil teknis — hanya terisi saat jenis = SURVEI_LOKASI
  odpTerdekat        String?
  estimasiKabelMeter Int?
  catatanTeknis      String?

  siteId   String?
  site     Sites?  @relation(fields: [siteId], references: [id])
  tenantId String?
  tenant   Tenant? @relation(fields: [tenantId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, waktuMulai])
  @@index([prospekId])
  @@index([tenantId])
  @@index([jenis, hasil])
  @@map("presurvei_kegiatan")
}
```

Tiga kolom teknis (`odpTerdekat`, `estimasiKabelMeter`, `catatanTeknis`) sengaja
menempel di kegiatan alih-alih tabel terpisah: hasil survei adalah hasil dari satu
kunjungan, memisahkannya hanya menambah join tanpa menambah kejelasan. Data ini yang
mem-prefill `Canvasing.odp` dan `Canvasing.kabel` saat promosi.

Kolom mana yang terisi bergantung pada `jenis`:

| `jenis` | Lokasi & `ditemuiNama` | Kolom teknis | `iklanId` |
|---|---|---|---|
| `KUNJUNGAN` | terisi | kosong | kosong |
| `SURVEI_LOKASI` | terisi | terisi | kosong |
| `TELEPON`, `CHAT` | kosong | kosong | kosong |
| `IKLAN` | kosong | kosong | terisi |

Jenis `IKLAN` dipakai marketing kantor untuk mencatat pekerjaan harian atas sebuah
iklan — menyiapkan materi, membalas pesan masuk, menaikkan anggaran. Validator menolak
kombinasi yang tidak sesuai tabel di atas, misalnya kegiatan `TELEPON` yang membawa
estimasi kabel.

### 4.2 `PresurveiProspek`

```prisma
model PresurveiProspek {
  id     String @id @default(uuid())

  nama      String
  noTelp    String
  email     String?
  alamat    String
  latitude  Float?
  longitude Float?
  shareloc  String?

  // Atribusi sumber — menjawab "dapat prospeknya dari mana"
  sumber         PresurveiSumberProspek
  iklanId        String?                     // bila sumber = IKLAN
  iklan          PresurveiIklan?  @relation(fields: [iklanId], references: [id])
  registrationId String?          @unique    // bila sumber = WEBSITE; unique = idempotensi handler
  referralNama   String?                     // bila sumber = REFERRAL

  status        PresurveiStatusProspek @default(BARU)
  pemilikId     String?                      // sales pemegang; null = belum ditugaskan
  pemilik       User? @relation("UserPresurveiProspek", fields: [pemilikId], references: [id])
  paketDiminati String?
  catatan       String?

  // Jejak setelah dipromosikan
  canvasingId String?   @unique
  konversiAt  DateTime?

  kegiatan PresurveiKegiatan[]

  siteId   String?
  site     Sites?  @relation(fields: [siteId], references: [id])
  tenantId String?
  tenant   Tenant? @relation(fields: [tenantId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([pemilikId, status])
  @@index([sumber])
  @@index([tenantId])
  @@index([createdAt])
  @@map("presurvei_prospek")
}
```

`canvasingId` disimpan di sisi prospek, bukan `prospekId` di tabel `Canvasing`.
Dengan begitu tabel milik modul marketing sama sekali tidak tersentuh, dan arah
ketergantungan tetap satu arah: presurvei tahu tentang canvasing, canvasing tidak
tahu tentang presurvei.

### 4.3 `PresurveiIklan`

```prisma
model PresurveiIklan {
  id   String @id @default(uuid())
  nama String                                  // "Promo Ramadan Instagram"
  kode String                                  // "promo-ramadan-ig" — dicocokkan ke utm_campaign

  channel        PresurveiChannelIklan
  tanggalMulai   DateTime
  tanggalSelesai DateTime?
  biaya          Decimal? @db.Decimal(15, 2)

  penanggungJawabId String?
  penanggungJawab   User? @relation("UserPresurveiIklan", fields: [penanggungJawabId], references: [id])

  isAktif Boolean @default(true)

  prospek  PresurveiProspek[]
  kegiatan PresurveiKegiatan[]

  tenantId String?
  tenant   Tenant? @relation(fields: [tenantId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([kode, tenantId])
  @@index([tenantId])
  @@index([isAktif, tanggalMulai])
  @@map("presurvei_iklan")
}
```

`biaya` bersifat opsional dan belum dipakai untuk laporan ROI pada fase ini —
disediakan supaya data terkumpul sejak awal, tanpa membangun analitik yang belum
diminta.

### 4.4 `PresurveiTarget`

```prisma
model PresurveiTarget {
  id     String @id @default(uuid())
  userId String
  user   User   @relation("UserPresurveiTarget", fields: [userId], references: [id])

  periodeTahun Int
  periodeBulan Int                             // 1-12

  targetKunjungan Int @default(0)
  targetProspek   Int @default(0)
  targetKonversi  Int @default(0)

  tenantId String?
  tenant   Tenant? @relation(fields: [tenantId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, periodeTahun, periodeBulan, tenantId])
  @@index([tenantId])
  @@map("presurvei_target")
}
```

Terpisah dari `User.canvasingTarget` yang sudah ada, karena kolom itu hanya satu
angka tanpa riwayat periode — tidak bisa menjawab "berapa target sales A bulan lalu".
`User.canvasingTarget` tetap dipakai modul marketing dan tidak diubah.

### 4.5 Enum baru

```prisma
enum PresurveiJenisKegiatan { KUNJUNGAN SURVEI_LOKASI TELEPON CHAT IKLAN }

enum PresurveiHasilKegiatan { TERTARIK PERLU_FOLLOWUP TIDAK_MINAT TIDAK_ADA_ORANG DEAL }

enum PresurveiSumberProspek { LAPANGAN IKLAN WEBSITE REFERRAL WALK_IN }

enum PresurveiStatusProspek { BARU DIHUBUNGI TERTARIK NEGOSIASI DEAL TIDAK_MINAT TIDAK_LAYAK }

enum PresurveiChannelIklan { META GOOGLE TIKTOK WHATSAPP OFFLINE LAINNYA }
```

### 4.6 Perubahan pada `Registrations`

Tiga kolom nullable, non-breaking:

```prisma
utmSource   String?
utmMedium   String?
utmCampaign String?
```

Form publik `/register` menangkap ketiganya dari query string saat halaman dibuka.

---

## 5. Aturan domain

Ditulis sebagai fungsi murni di `domain/prospek-rules.ts` supaya bisa diuji tanpa
database dan supaya definisinya tidak tersebar di service maupun UI.

**Transisi status prospek yang sah:**

```
BARU        → DIHUBUNGI | TIDAK_MINAT
DIHUBUNGI   → TERTARIK  | TIDAK_MINAT | TIDAK_LAYAK
TERTARIK    → NEGOSIASI | TIDAK_MINAT | TIDAK_LAYAK
NEGOSIASI   → DEAL      | TIDAK_MINAT | TIDAK_LAYAK
DEAL        → (final, hanya boleh dipromosikan ke canvasing)
TIDAK_MINAT → DIHUBUNGI              (boleh dibuka lagi bulan berikutnya)
TIDAK_LAYAK → (final)
```

**Aturan promosi ke canvasing** — `canPromosikanKeCanvasing(prospek)`:

- status harus `DEAL`
- `canvasingId` harus masih kosong (mencegah promosi ganda)
- `noTelp` dan `alamat` harus terisi

**Aturan pencapaian target** — `hitungPencapaian(target, realisasi)`: mengembalikan
persentase per jenis target, dibatasi pada 100% untuk tampilan progres.

---

## 6. Alur utama

### 6.1 Sales mencatat kunjungan (mobile)

1. Sales membuka layar Presurvei, menekan "Catat Kunjungan"
2. Aplikasi mengambil GPS (lewat `useApiMutation({ includeLocation: true })` yang
   sudah ada) dan meminta foto lewat kamera
3. Sales mengisi: siapa yang ditemui, hasilnya, catatan. Bila jenisnya survei lokasi,
   tambahan: ODP terdekat, estimasi kabel, catatan teknis
4. `POST /api/presurvei/kegiatan` — bila sedang offline, otomatis masuk antrian SQLite
   dan dikirim saat koneksi kembali (infrastruktur yang sudah ada)
5. Bila `hasil` bernilai `TERTARIK` atau `DEAL` dan `prospekId` masih kosong,
   `KegiatanService` membuat `PresurveiProspek` baru dengan `sumber = LAPANGAN` dan
   `pemilikId` = pelaku kegiatan, lalu menautkannya balik ke kegiatan tersebut.
   Pembuatan kegiatan dan prospek berjalan dalam satu transaksi Prisma — keduanya
   berada di modul yang sama, jadi tidak perlu pola kompensasi. Nama dan nomor telepon
   prospek diambil dari `ditemuiNama` dan masukan tambahan pada formulir; bila nomor
   telepon belum diisi, kegiatan tetap tersimpan tanpa prospek dan sales diberi tahu
   bahwa prospek perlu dilengkapi terpisah.

### 6.2 Prospek dari iklan

**Jalur manual**: marketing mencatat prospek yang masuk dari DM, WhatsApp, atau
telepon lewat `POST /api/presurvei/prospek` dengan `sumber = IKLAN` dan `iklanId`.

**Jalur form publik**: pengunjung mengisi `/register` dengan parameter UTM di URL →
`RegistrationService.register()` menyimpan UTM dan mempublikasikan event
`registration:registration.created` → handler di presurvei membuat prospek
`sumber = WEBSITE`, mencocokkan `utmCampaign` dengan `PresurveiIklan.kode` untuk
mengisi `iklanId`, dan menugaskan pemiliknya.

Penugasan pemilik memakai aturan beban paling ringan: sales aktif di site tersebut
dengan jumlah prospek berstatus `BARU`/`DIHUBUNGI`/`TERTARIK`/`NEGOSIASI` paling
sedikit. Bila site tidak punya sales aktif, prospek dibuat tanpa pemilik dan muncul
di daftar "Belum ditugaskan" pada UI admin, dengan notifikasi ke pemegang izin
`presurvei:update` di site tersebut. Karena itu `pemilikId` pada model bersifat
nullable.

Handler idempotent lewat `registrationId @unique`: event yang terkirim dua kali
tidak menghasilkan prospek ganda.

### 6.3 Promosi prospek menjadi canvasing

`ProspekKonversiService.jadikanCanvasing(prospekId, userId)`:

1. Muat prospek, verifikasi `canPromosikanKeCanvasing()` — bila gagal, lempar
   `AppError` dengan kode `INVALID_STATE`
2. Ambil kegiatan `SURVEI_LOKASI` terbaru milik prospek untuk mengambil data teknis
3. Panggil `CanvasingService.createRequest()` lewat public API `@/modules/marketing`
   dengan data ter-prefill: nama, telepon, alamat, koordinat, shareloc, paket, ODP,
   estimasi kabel, foto
4. Simpan `canvasingId` dan `konversiAt` ke prospek
5. Publikasikan event `presurvei:prospek.converted`

Bila langkah 4 gagal setelah canvasing terbuat, jalankan kompensasi dengan mencatat
kegagalan dan membiarkan canvasing tetap ada — mengikuti pola kompensasi yang sudah
dipakai `CanvasingService.approveRequest()`, karena dua domain tidak bisa berada dalam
satu transaksi Prisma.

---

## 7. Integrasi lintas modul

**Event yang dipublikasikan modul ini:**

| Event | Kapan | Konsumen |
|---|---|---|
| `presurvei:prospek.created` | Prospek baru dibuat dari jalur mana pun | notifikasi |
| `presurvei:prospek.converted` | Prospek dipromosikan menjadi canvasing | statistik, kelak komisi |

**Event yang dikonsumsi:**

| Event | Sumber | Penanganan |
|---|---|---|
| `registration:registration.created` | `modules/registration` (baru) | Membuat prospek `sumber = WEBSITE` |

Event `registration:registration.created` belum ada dan perlu ditambahkan:
definisi di `lib/event-bus/types.ts` (nama, payload, metadata routing), publikasi
fire-and-forget di `RegistrationService.register()`, dan registrasi handler di
`lib/event-bus/event-handlers.ts`.

**Notifikasi**: mengikuti pola `canvasing.notifications.ts` — fire-and-forget dari
service, penerima ditentukan berdasarkan site. Deep link mobile perlu ditambahkan di
`MobileNotificationRouteService` dengan `sourceType: "PRESURVEI"`.

---

## 8. API

Semua route memakai `createHandler` dari `@/lib/api`, yang sudah menangani sesi
NextAuth **dan** fallback Bearer token mobile — satu route melayani web admin dan
mobile sekaligus, tanpa endpoint kembar.

Route yang dipakai sales lapangan menerima permission web **atau** mobile:

| Route | Method | Permission (salah satu cukup) |
|---|---|---|
| `/api/presurvei/kegiatan` | GET, POST | `presurvei:read` + `m_presurvei:read` / `presurvei:create` + `m_presurvei:create` |
| `/api/presurvei/kegiatan/[id]` | GET | `presurvei:read` + `m_presurvei:read` |
| `/api/presurvei/prospek` | GET, POST | `presurvei:read` + `m_presurvei:read` / `presurvei:create` + `m_presurvei:create` |
| `/api/presurvei/prospek/[id]` | GET, PATCH | `presurvei:read` + `m_presurvei:read` / `presurvei:update` + `m_presurvei:update` |
| `/api/presurvei/prospek/[id]/jadikan-canvasing` | POST | `presurvei:update` + `m_presurvei:update` |
| `/api/admin/presurvei/iklan` | GET, POST | `presurvei_iklan:read` / `:create` |
| `/api/admin/presurvei/iklan/[id]` | GET, PATCH, DELETE | `presurvei_iklan:*` |
| `/api/admin/presurvei/target` | GET, POST | `presurvei_target:read` / `:create` |
| `/api/admin/presurvei/laporan` | GET | `presurvei_laporan:read` |

Route adalah thin controller: parse request, panggil service, kembalikan DTO. List
memakai `apiPaginated`, detail memakai `apiSuccess`.

**Penanganan error**: service melempar `AppError` (`@/lib/errors`), yang dipetakan
otomatis ke HTTP oleh `createHandler`. Ini mengikuti modul terbaru di repo
(`modules/endorsement`) — lihat catatan keputusan di bagian 12.

---

## 9. Permission & menu

**Web** (grup `MARKETING` di `lib/permission-config.ts`):
`presurvei:read|create|update|delete|site_only`, `presurvei_iklan:read|create|update|delete`,
`presurvei_target:read|create|update|delete`, `presurvei_laporan:read`

**Mobile** (grup `MARKETING` di `PERMISSION_GROUPS_MOBILE`):
`m_presurvei:read|create|update` — `update` diperlukan karena sales mengubah
status prospek dari lapangan.

Tiap route presurvei menyebut **dua** permission sekaligus, misalnya
`["presurvei:read", "m_presurvei:read"]`. `createHandler` memeriksa daftar itu
dengan `.some()` (`lib/api/handler.ts:238`), sehingga daftarnya bersifat **ATAU**:
admin web lolos lewat permission web, sales lapangan lewat permission mobile.
Menyebut permission web saja akan menolak sales dengan 403, karena role sales
punya `accessAdminPanel: false` dan hanya memegang permission berprefix `m_`.

Semuanya didaftarkan di `lib/permissions.ts`, `lib/resource-capabilities.ts`, dan
`lib/permission-config.ts`, dengan script seed mengikuti pola
`scripts/seed-canvasing-permissions.ts`. Role template "Sales / Marketing" di
`lib/role-templates.ts` ditambah `m_presurvei:read|create|update`.

Menu admin web masuk ke bagian "Pemasaran" yang sudah ada di `lib/menu-config.ts`.

---

## 10. Mobile — pengalaman tersendiri untuk sales

Sales mendapat navigasi dan beranda sendiri, terpisah dari teknisi. Pola yang dipakai
mengikuti preseden yang sudah terbukti di repo: route group `(customer)` sudah
memberi pelanggan pengalaman terpisah dari `(app)` dalam satu APK.

```
app/
├── (app)/        # teknisi & mitra — tidak diubah
├── (customer)/   # pelanggan — tidak diubah
└── (sales)/      # BARU
    ├── _layout.tsx           # tab bar sendiri
    ├── dashboard.tsx         # progres target, kunjungan hari ini, perlu follow-up
    ├── presurvei/
    │   ├── index.tsx         # daftar prospek
    │   ├── create.tsx        # catat kunjungan
    │   └── [id]/index.tsx    # detail prospek + riwayat kegiatan
    ├── canvasing/            # tautan ke layar canvasing yang sudah ada
    ├── absensi.tsx
    └── profile.tsx
```

Setelah login, pengguna diarahkan berdasarkan identitasnya: `user.isSales` → `(sales)`,
pelanggan → `(customer)`, selain itu → `(app)`. Logika pengarahan ditempatkan di satu
tempat supaya tidak tersebar.

**Yang dipakai ulang tanpa perubahan**: antrian offline SQLite, `UploadService`,
`LocationPickerModal`, `useApiMutation`, `useFeatureGuard`, komponen kamera KTP.

**Yang ditambahkan**: `AppFeature.PRESURVEI = 'm_presurvei'` di
`src/constants/features.ts`, `'presurvei'` pada `UploadType` di kedua repo, dan
`case "presurvei"` pada resolver folder upload backend.

Karena hanya menyentuh JS/TS, rilis cukup lewat OTA — tidak perlu rebuild APK.

---

## 11. Testing

Mengikuti standar repo: file di `tests/modules/presurvei/`, service diuji dengan
me-mock port repository (bukan Prisma), waktu selalu di-inject supaya deterministik.

| File | Menguji |
|---|---|
| `prospek-rules.test.ts` | Transisi status, syarat promosi, hitung pencapaian — tanpa mock sama sekali |
| `kegiatan-service.test.ts` | Pembuatan kegiatan, pembuatan prospek otomatis saat hasil `TERTARIK`/`DEAL` |
| `prospek-service.test.ts` | CRUD prospek, penolakan transisi status yang tidak sah |
| `prospek-konversi-service.test.ts` | Promosi ke canvasing, prefill data teknis, penolakan promosi ganda |
| `registration-created-handler.test.ts` | Idempotensi, pencocokan UTM ke iklan, penugasan pemilik |

Target cakupan: minimum 70% untuk service, sesuai `docs/standards/testing.md`.

---

## 12. Keputusan & alasannya

**Modul terpisah, bukan perluasan `modules/marketing`** — modul marketing sudah punya
tiga tanggung jawab besar. Menambah empat agregat lagi membuatnya punya terlalu banyak
alasan berubah.

**`canvasingId` di sisi prospek** — menjaga tabel milik modul lain tidak tersentuh dan
arah ketergantungan tetap satu arah.

**Kolom teknis survei menempel di `PresurveiKegiatan`** — hasil survei adalah hasil
satu kunjungan; tabel terpisah hanya menambah join.

**`AppError` alih-alih `Result<T, E>`** — perlu perhatian reviewer. `CLAUDE.md` dan
`docs/standards/error-handling.md` menyebut pola `Result<T, E>` untuk service layer,
tetapi tidak ada definisi `Result` terpusat di repo (tiap modul mendefinisikan
sendiri: `ServiceResult<T>`, `RegistrationResult<T>`), sedangkan modul terbaru
(`modules/endorsement`) dan `lib/api/handler.ts` sudah dioptimalkan untuk `AppError`
yang dilempar. Desain ini mengikuti pola terbaru demi konsistensi dengan
`createHandler`. **Bila keputusan ini disetujui, `CLAUDE.md` dan dokumen standar
sebaiknya diperbarui agar tidak lagi bertentangan dengan praktik nyata.**

**Prospek dari form publik lewat event, bukan panggilan langsung** — modul
registration tidak perlu tahu presurvei ada. Bila presurvei dimatikan, form publik
tetap berfungsi.

---

## 13. Risiko

| Risiko | Penanganan |
|---|---|
| Prospek ganda antara jalur manual dan form publik | Peringatan duplikat berbasis nomor telepon saat input manual; `registrationId @unique` untuk jalur otomatis |
| Sales bingung membedakan Presurvei dan Canvasing | Penamaan layar yang tegas: Presurvei = "sedang dikejar", Canvasing = "siap dipasang". Tombol promosi hanya muncul saat status `DEAL` |
| Event registration gagal terkirim | Publikasi fire-and-forget dengan outbox yang sudah ada di event bus; prospek tetap bisa dibuat manual dari daftar registrasi |
| Foto kunjungan membengkakkan penyimpanan | Kompresi ke WebP sudah otomatis; batas jumlah foto per kegiatan ditetapkan lewat konstanta di validator |

---

## 14. Fase pengerjaan

| Fase | Isi | Hasil yang bisa diuji |
|---|---|---|
| 1 | Skema + migration + domain + repository + `KegiatanService` + `ProspekService` + API kegiatan & prospek + test | Kegiatan dan prospek bisa dicatat lewat API |
| 2 | `PresurveiIklan` + `PresurveiTarget` + event registration + UTM + `ProspekKonversiService` | Atribusi sumber lengkap, promosi ke canvasing berfungsi |
| 3 | UI admin web: daftar kegiatan, papan prospek, kelola iklan, kelola target, laporan | Manajemen bisa melihat kegiatan tim |
| 4 | Mobile: route group `(sales)`, beranda sales, layar presurvei, pengarahan setelah login | Sales bekerja penuh dari aplikasi |

Setiap fase punya migration sendiri bila menyentuh skema, dan entri `docs/CHANGELOG.md`
sendiri.
