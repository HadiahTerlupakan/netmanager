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
│   ├── peran-pelaku.ts          # peran & departemen pelaku, penjaga tenant per baris
│   └── prospek-rules.ts         # aturan transisi status, fungsi murni
├── dto/
│   ├── kegiatan.dto.ts
│   ├── prospek.dto.ts
│   ├── iklan.dto.ts
│   ├── departemen.dto.ts
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

### 4.4a `PresurveiKegiatanRiwayat` (Task 21, Fase 3)

Jejak audit jalur ubah kegiatan, preseden `PlanningAuditLog`. Migration
`20260923090000_add_presurvei_kegiatan_riwayat_table`.

```prisma
model PresurveiKegiatanRiwayat {
  id           String   @id @default(uuid())
  kegiatanId   String   // FK PresurveiKegiatan, onDelete Cascade
  tenantId     String?  // tenant baris kegiatan; nullable seperti kegiatannya
  diubahOlehId String?  // FK User, onDelete SetNull
  diubahPada   DateTime @default(now())
  perubahan    Json     // { medan: { dari, ke } } — HANYA medan yang berubah

  @@index([kegiatanId])
  @@index([tenantId])
  @@map("presurvei_kegiatan_riwayat")
}
```

Hanya `catatan`, `ditemuiNama`, dan `hasil` yang bisa diubah; `hasil` tidak boleh
melintasi batas `isHasilMelahirkanProspek` (`isPerubahanHasilSah`). Kegiatan dan
riwayatnya ditulis dalam satu transaksi dengan kunci konkurensi optimistis
(`updateMany where { id, updatedAt: versi }`; versi basi → 409). `versi` adalah
medan opsional badan PATCH — `updatedAt` rincian yang dilihat klien
(`KegiatanRincianDto.updatedAt`), bukan medan yang diubah. Modal web selalu
mengirimnya, jadi suntingan orang lain sejak modal dibuka tidak tertimpa. Klien
tanpa `versi` (mobile lama) memakai versi bacaan service sendiri, yang hanya menjaga
jendela di dalam satu request.

**Kontrak untuk klien mobile.** Per 2026-09-24 aplikasi `mobile-netmanager` belum
punya fitur presurvei sama sekali (tidak ada pemanggilan `/api/presurvei/*`). Saat
alur ubah kegiatan dibangun di sana, klien WAJIB mengirim `versi` = `updatedAt` dari
`GET /api/presurvei/kegiatan/[id]` apa adanya. Formatnya ISO 8601 bermilidetik
berakhiran `Z`, persis keluaran `Date.prototype.toISOString()`. `z.iso.datetime()`
menolak offset lain seperti `+07:00`, dan membulatkan ke detik akan selalu memicu
409. Respons 409 berarti kegiatan diubah pihak lain: muat ulang rincian, jangan
kirim ulang otomatis.

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
5. Bila `hasil` bernilai `TERTARIK` atau `DEAL`, `prospekId` masih kosong, **dan
   jenis kegiatannya terjadi di lapangan** (`KUNJUNGAN` atau `SURVEI_LOKASI`),
   `KegiatanService` membuat `PresurveiProspek` baru dengan `sumber = LAPANGAN` dan
   `pemilikId` = pelaku kegiatan, lalu menautkannya balik ke kegiatan tersebut.

   Pembatasan ke jenis lapangan itu disengaja: `sumber = LAPANGAN` hanya jujur
   untuk kegiatan yang benar-benar terjadi di lokasi. Telepon dan chat tidak
   punya nilai `PresurveiSumberProspek` yang tepat — menyebutnya `WALK_IN` akan
   melaporkan panggilan keluar sebagai pelanggan yang datang sendiri, dan
   menambah nilai enum baru menuntut migration (Fase 2). Sampai itu ada, kegiatan
   telepon dan chat tetap tersimpan tanpa melahirkan prospek, dan prospeknya
   dibuat lewat `POST /api/presurvei/prospek` dengan `sumber` yang eksplisit.
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

Pencocokan kampanye bersifat pelengkap, bukan syarat: bila `utmCampaign` kosong,
tidak dikirim, atau tidak cocok dengan `kode` iklan mana pun, prospek **tetap
dibuat** dengan `sumber = WEBSITE` dan `iklanId` kosong — pendaftar tidak pernah
hilang hanya karena atribusi kampanyenya tidak terlacak.

Penugasan pemilik memakai aturan beban paling ringan: sales aktif di site tersebut
dengan jumlah prospek berstatus `BARU`/`DIHUBUNGI`/`TERTARIK`/`NEGOSIASI` paling
sedikit. Bila site tidak punya sales aktif, prospek dibuat tanpa pemilik dan muncul
di daftar "Belum ditugaskan" pada UI admin, dengan notifikasi ke pemegang izin
`presurvei:update` di site tersebut. Karena itu `pemilikId` pada model bersifat
nullable.

Handler idempotent lewat `registrationId @unique`: event yang terkirim dua kali
tidak menghasilkan prospek ganda.

### 6.3 Promosi prospek menjadi canvasing

`ProspekKonversiService.jadikanCanvasing(prospekId, input, pemilikWajib?)`:

1. Muat prospek, verifikasi `canPromosikanKeCanvasing()` — bila gagal, lempar
   `AppError` dengan kode `INVALID_STATE`
2. Ambil kegiatan `SURVEI_LOKASI` terbaru milik prospek — bila ada, data teknisnya
   (`odpTerdekat`, `estimasiKabelMeter`, foto pertama) jadi **nilai awal** untuk
   kolom sejenis di canvasing
3. Bangun payload canvasing: nama, telepon, email, alamat, koordinat, shareloc, dan
   pemilik disalin apa adanya dari prospek. `noKtp` dan `paket` **wajib dikirim
   lewat body** endpoint — prospek tidak memiliki keduanya sama sekali. `kabel`,
   `odp`, `sn`, `foto`, dan `fotoKtp` juga diterima dari body; bila `kabel`, `odp`,
   atau `foto` tidak dikirim, nilainya jatuh ke data teknis dari langkah 2 (`kabel`
   jatuh lagi ke 1 meter bila kegiatan survei pun tidak ada)
4. Panggil `CanvasingService.createRequest()` lewat public API `@/modules/marketing`
   dengan payload tersebut, divalidasi ulang lewat validator marketing
   (`parseCreateCanvasingInput`) supaya invarian seperti kabel minimal 1 meter tetap
   berlaku meski jalur ini yang satu-satunya melewatinya
5. Tandai prospek dengan `canvasingId` dan `konversiAt` lewat pembaruan bersyarat
   (`where: { id, canvasingId: null }`), yang sekaligus jadi titik serialisasi:
   permintaan promosi yang kalah balapan menghapus canvasing yang terlanjur dibuat
   alih-alih meninggalkannya yatim
6. Publikasikan event `presurvei:prospek.converted`

Bila langkah 4 gagal setelah canvasing terbuat, atau langkah 5 kalah balapan,
jalankan kompensasi: hapus canvasing yang terlanjur dibuat dan catat kegagalannya —
mengikuti pola kompensasi yang sudah dipakai `CanvasingService.approveRequest()`,
karena dua domain tidak bisa berada dalam satu transaksi Prisma.

---

## 7. Integrasi lintas modul

**Event yang dipublikasikan modul ini:**

| Event | Kapan | Konsumen |
|---|---|---|
| `presurvei:prospek.created` | Prospek baru dibuat dari jalur mana pun | notifikasi |
| `presurvei:prospek.converted` | Prospek dipromosikan menjadi canvasing | statistik, kelak komisi |
| `presurvei:kegiatan.updated` | Kegiatan diubah lewat `PATCH /api/presurvei/kegiatan/[id]` (setelah commit) | belum ada (tanpa handler) |

**`presurvei:prospek.created` belum dipublikasikan.** Hanya `prospek.converted` yang
nyata sampai akhir Fase 2 — tidak ada `EVENT_NAMES.PRESURVEI_PROSPEK_CREATED`, tidak
ada `presurvei.notifications.ts`, dan notifikasi "prospek tanpa pemilik" yang disebut
di §6.2 belum terkirim ke mana pun. `cariSalesTeringan()` mengembalikan `null` dengan
tenang saat tidak ada sales aktif; prospeknya tersimpan tanpa `pemilikId`, tapi tidak
ada yang diberi tahu. Seluruh jalur notifikasi presurvei — termasuk deep link mobile
di paragraf berikut — adalah pekerjaan yang belum dimulai, bukan yang sudah berjalan.

**Event yang dikonsumsi:**

| Event | Sumber | Penanganan |
|---|---|---|
| `registration:registration.created` | `modules/registration` | Membuat prospek `sumber = WEBSITE` |

Event `registration:registration.created` sudah dibangun di Fase 2: definisi di
`lib/event-bus/types.ts`, publikasi fire-and-forget di `RegistrationService.register()`,
dan handler `registration-created-presurvei.handler.ts` terdaftar di
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
| `/api/presurvei/kegiatan/[id]` | GET, PATCH | `presurvei:read` + `m_presurvei:read` / `presurvei:update` + `m_presurvei:update` |
| `/api/presurvei/prospek` | GET, POST | `presurvei:read` + `m_presurvei:read` / `presurvei:create` + `m_presurvei:create` |
| `/api/presurvei/prospek/[id]` | GET, PATCH | `presurvei:read` + `m_presurvei:read` / `presurvei:update` + `m_presurvei:update` |
| `/api/presurvei/prospek/[id]/jadikan-canvasing` | POST | `presurvei:update` + `m_presurvei:update` |
| `/api/admin/presurvei/iklan` | GET, POST | `presurvei_iklan:read` / `:create` |
| `/api/admin/presurvei/iklan/[id]` | GET, PATCH | `presurvei_iklan:read` / `:update` |
| `/api/admin/presurvei/target` | GET, POST | `presurvei_target:read` / `:create` |
| `/api/admin/presurvei/laporan` | GET | `presurvei_laporan:read` |
| `/api/admin/presurvei/departemen` | GET | `presurvei:read` / `presurvei_target:read` / `presurvei_laporan:read` |

**Peran pelaku kegiatan.** `KegiatanListItemDto` (dan turunannya) membawa
`peranPelaku` (`"SALES" | "NON_SALES" | null`, dari `User.isSales`) dan
`departemenPelaku` (nama departemen atau null). Keduanya keadaan user **saat ini**,
bukan snapshot saat kegiatan dicatat, dan dijaga tenant per baris
(`domain/peran-pelaku.ts`, penjaga yang sama dengan `namaSalesSatuTenant`; departemen
juga harus satu tenant dengan baris). `GET /api/presurvei/kegiatan` menerima filter
`peran` dan `departemenId` sebagai filter relasi `user` yang hanya mempersempit —
pengikatan pemanggil mobile ke `userId` sesi tetap berlaku.
`/api/admin/presurvei/departemen` mengisi dropdown departemen dengan tenant hanya dari
sesi; ia ada karena `/api/admin/departments` menuntut `department:read`/`users:create`.

Route adalah thin controller: parse request, panggil service, kembalikan DTO. List
memakai `apiPaginated`, detail memakai `apiSuccess`.

**Penanganan error**: service melempar `AppError` (`@/lib/errors`), yang dipetakan
otomatis ke HTTP oleh `createHandler`. Ini mengikuti modul terbaru di repo
(`modules/endorsement`) — lihat catatan keputusan di bagian 12.

---

## 9. Permission & menu

**Web** (grup `MARKETING` di `lib/permission-config.ts`):
`presurvei:read|create|update|delete`, `presurvei_iklan:read|create|update`,
`presurvei_target:read|create`, `presurvei_laporan:read`.

Tiga yang terakhir (`presurvei_iklan`, `presurvei_target`, `presurvei_laporan`) baru
di Fase 2 dan **admin-web saja** — tidak ada padanan `m_*` untuk mereka di
`PERMISSION_GROUPS_MOBILE`. `presurvei_iklan` tidak punya `delete` dan
`presurvei_target` tidak punya `update`/`delete` karena route admin yang dibangun
Fase 2 hanya menyediakan aksi itu (lihat tabel route di §8).

**Mobile** (grup `MARKETING` di `PERMISSION_GROUPS_MOBILE`):
`m_presurvei:read|create|update` — `update` diperlukan karena sales mengubah
status prospek dari lapangan.

**Pemakai non-sales.** Teknisi atau staf lain boleh memakai presurvei secara opsional.
Aksesnya diatur lewat role (izin `m_presurvei:*` untuk mobile, `presurvei:*` untuk
web), bukan aturan otomatis per departemen. Kegiatan mereka tampil sebagai
"Non-sales · <departemen>" dan bisa disaring terpisah (lihat "Peran pelaku kegiatan"
di §8).

Tiap route presurvei menyebut **dua** permission sekaligus, misalnya
`["presurvei:read", "m_presurvei:read"]`. `createHandler` memeriksa daftar itu
dengan `.some()` (`lib/api/handler.ts:238`), sehingga daftarnya bersifat **ATAU**:
admin web lolos lewat permission web, sales lapangan lewat permission mobile.
Menyebut permission web saja akan menolak sales dengan 403, karena role sales
punya `accessAdminPanel: false` dan hanya memegang permission berprefix `m_`.

**Pembatasan kepemilikan.** Karena permission bersifat ATAU, pemanggil bermodal
permission mobile saja tetap lolos ke route yang sama dengan admin web. Karena itu
route menurunkan kapabilitas dari `ctx.permissions`: pemanggil tanpa
`presurvei:read` terikat ke datanya sendiri — filter `pemilikId` (prospek) dan
`userId` (kegiatan) **ditimpa** dengan id sesi, dan `detail` serta `ubah` menolak
dengan 403 bila pemiliknya orang lain. Tanpa ini, sales bisa melihat seluruh
prospek tenant dan mengubah milik rekan setimnya. Polanya mengikuti
`MarketingCanvasingListRouteService` di modul marketing.

**`site_only` belum dideklarasikan.** Pembatasan per-site adalah Fase 3 dan belum
ditegakkan kode mana pun. Mendeklarasikannya lebih awal membuat toggle "Batasi ke
Site Sendiri" di panel admin tampak aktif padahal tidak berefek — lebih buruk
daripada tidak ada. Ia ditambahkan bersama kode yang menegakkannya.

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
| Prospek ganda antara jalur manual dan form publik | **Dibangun (Fase 2).** `ProspekService.buat()` menolak dengan 409 `DUPLIKAT` bila ada prospek aktif (status belum final) dengan nomor telepon sama, dan menyertakan daftar yang bentrok. Ini **peringatan yang bisa dilewati** (`abaikanDuplikat: true`), bukan larangan keras — dua orang memang bisa berbagi satu nomor telepon. Jalur otomatis (form publik) memakai `registrationId @unique` untuk idempotensi, mekanisme terpisah dari peringatan ini |
| Sales bingung membedakan Presurvei dan Canvasing | Penamaan layar yang tegas: Presurvei = "sedang dikejar", Canvasing = "siap dipasang". Tombol promosi hanya muncul saat status `DEAL` |
| Event registration gagal terkirim | Publikasi fire-and-forget dengan outbox yang sudah ada di event bus; prospek tetap bisa dibuat manual dari daftar registrasi |
| Foto kunjungan membengkakkan penyimpanan | Kompresi ke WebP sudah otomatis; batas jumlah foto per kegiatan ditetapkan lewat konstanta di validator |

---

## 14. Fase pengerjaan

| Fase | Isi | Hasil yang bisa diuji | Status |
|---|---|---|---|
| 1 | Skema + migration + domain + repository + `KegiatanService` + `ProspekService` + API kegiatan & prospek + test | Kegiatan dan prospek bisa dicatat lewat API | ✅ Selesai |
| 2 | `PresurveiIklan` + `PresurveiTarget` + event registration + UTM + `ProspekKonversiService` | Atribusi sumber lengkap, promosi ke canvasing berfungsi | ✅ Selesai (2026-09-22) |
| 3 | UI admin web: daftar kegiatan, papan prospek, kelola iklan, kelola target, laporan — desain rinci di [`presurvei-ui-admin-design.md`](./presurvei-ui-admin-design.md) | Manajemen bisa melihat kegiatan tim | ✅ Selesai (2026-09-23) |
| 4 | Mobile: route group `(sales)`, beranda sales, layar presurvei, pengarahan setelah login | Sales bekerja penuh dari aplikasi | ⬜ Belum dikerjakan |

Fase 1, 2, dan 3 selesai. Modul ini kini punya sembilan halaman admin web di bawah
`/admin/presurvei` (dashboard, kegiatan beserta peta dan rinciannya, papan prospek,
kampanye iklan, target, laporan). Sampai Fase 4 (mobile sales) dikerjakan, kegiatan
lapangan — `KUNJUNGAN` dan `SURVEI_LOKASI`, yang wajib berkoordinat — hanya bisa
dicatat lewat pemanggilan API langsung, karena form web sengaja tidak menangkap GPS
maupun foto. Keterbatasan Fase 3 lainnya tercatat di entri `docs/CHANGELOG.md`
bertanggal 2026-09-23.

Setiap fase punya migration sendiri bila menyentuh skema, dan entri `docs/CHANGELOG.md`
sendiri.
