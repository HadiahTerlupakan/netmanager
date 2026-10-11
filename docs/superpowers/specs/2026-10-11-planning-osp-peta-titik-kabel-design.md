# Peta Perencanaan OSP: Titik ODP/ODC, Jalur Kabel, dan Kebutuhan Material

- **Tanggal**: 2026-10-11
- **Status**: Draf untuk ditinjau
- **Melanjutkan**: `docs/superpowers/specs/2026-08-08-planning-osp-design.md`
- **Lingkup**: web admin saja

---

## 1. Masalah

Modul Planning OSP sudah berdiri lengkap — wadah proyek per area, persetujuan
berjenjang, item material, milestone, dokumen, audit log, kanban. Di produksi
modul ini belum dipakai sama sekali (nol baris).

Yang membuatnya belum terpakai: sebuah planning hari ini hanya bisa menyatakan
*"area Perumahan X, estimasi 120 rumah, satu titik GPS"*. Ia tidak bisa
menyatakan *"ODP-01 di tiang depan nomor 12, ODC-A di ujung jalan, kabel feeder
dari ODC-A ke ODP-01 sepanjang 340 meter"*.

Akibatnya dua hal yang paling dibutuhkan tim planning tidak terjawab:

1. **Berapa panjang kabel yang harus dibeli** untuk area ini
2. **Berapa dan rasio berapa splitter yang dibutuhkan**

Keduanya kini dihitung manual di luar sistem, lalu diketik ulang sebagai item
material — persis masalah "data tersebar" yang ingin diselesaikan modul ini.

## 2. Hasil yang diinginkan

Tim planning (tim **teknis**, bukan sales) membuka satu Planning OSP dan:

1. Menaruh titik **ODP** dan **ODC** di peta
2. **Menarik garis jalur kabel** antar titik, mengikuti jalan, bukan garis lurus
3. Melihat **panjang kabel per jenis** dan **rekap splitter** terhitung otomatis
4. Angka itu **mengisi daftar kebutuhan material** planning, yang mengalir ke
   estimasi budget dan persetujuan berjenjang yang sudah ada
5. Melampirkan **foto sekitar** tiap titik dari hasil survei lapangan

### Bukan lingkup

- **Aplikasi mobile.** Diputuskan eksplisit: input cukup di web.
- **Membereskan tabel mati** `Odc`, `Odp`, `OdcOutput`, `OdpOutput`, `Otb`,
  `Pole`, `Joinbox` (lihat §3.4). Utang teknis nyata, dikerjakan terpisah.
- **Geocoding nama tempat.** Hanya koordinat, bukan pencarian alamat.
- **Perhitungan redaman** rencana.

## 3. Keadaan saat ini (terverifikasi)

### 3.1 Planning

`Planning` (`prisma/schema.prisma:6320`) sudah punya `type PlanningType` yang
**hanya bernilai `OSP`**, `area`, `coordinates Json?` (satu titik untuk seluruh
proyek), `estimatedUnits`, budget, `status PlanningStatus` (8 nilai), dan
persetujuan berjenjang penuh dengan jejak pengaju/penyetuju/penolak.

`PlanningItem` (`:6378`) adalah daftar kebutuhan material: `name`,
`description`, `quantity`, `unit`, `estimatedPrice`, `actualPrice`, `notes`.
**Selama ini hanya bisa diisi manual.**

`PlanningDocument` (`:6424`) menangani lampiran dengan `category
DocumentCategory`, yang **sudah memuat `SURVEY_PHOTO` dan `COMPLETION_PHOTO`**
(`:6295`) — tetapi melekat pada proyek, bukan pada titik.

Modul `modules/planning` sudah mengikuti arsitektur target: `domain/`, `dto/`,
`repositories/` (dengan `PrismaPlanningUnitOfWork`), `mappers/`, `services/`,
`validators/`, `errors/`, plus `client.ts` dan `index.ts`.

### 3.2 Peta dan topologi

ODP/ODC operasional **tidak** hidup di tabel `Odp`/`Odc`, melainkan di
`MappingNode` (`mapping_nodes`, `:3712`) — satu tabel generik untuk semua tipe
node. Tipe kanonik di `modules/map/domain/nodeType.ts`:
`olt, odc, odp, ont, pole, joinbox, customer`.

`MappingEdge` (`:3744`) sudah menyimpan `fiberType`, `distance`, `waypoints`,
`notes`, `name`.

Editor petanya lengkap dan berjalan di `/admin/map` (Leaflet + react-leaflet),
komponen di `components/map/`. Yang relevan untuk desain ini:

- **Perhitungan panjang kabel sudah ada**: `calculateMapDistance()` di
  `components/map/map-utils.ts` menjumlahkan jarak Haversine melewati tiap
  titik belok, dibulatkan ke 0,1 meter.
- **Penggambaran jalur sudah ada**: `MapDrawingOverlay`, `MapFiberLinesLayer`,
  `FiberFormModal`, dengan `MapFiberDrawingInfoPanel` menampilkan panjang
  secara langsung saat garis ditarik.
- **Jenis fiber ditentukan otomatis** dari tipe kedua ujungnya:
  `determineFiberType()` di `map-utils.ts`. Nilai yang dipakai di sinkronisasi
  peta: `feeder, distribution, drop, odp_to_odp, odp_to_odp_ratio, odc_to_odc,
  odc_to_odc_ratio`.
- **Splitter sudah termodelkan**: `MappingNode.splitter String?` berformat
  `1:8`/`1:16`, dengan dropdown di `NodeFormModal` dan pengurai rasio
  `getSplitterCapacity()` di `NetworkMapInteractive.tsx:441`.
- **Peta dasarnya sudah Google**: `NetworkMap.tsx:91` memakai
  `https://mt0.google.com/vt/lyrs=y` (satelit + label).

### 3.3 Permukaan konsumen `mapping_nodes`

Hanya **dua berkas** yang menyentuh tabelnya langsung:

| Berkas | Peran |
|---|---|
| `modules/map/repositories/MappingRepository.ts` | editor peta admin |
| `modules/network/repositories/MobileTopologyRepository.ts` | topologi mobile (baca saja) |

Klausa pencarian node dibangun di **satu tempat**: `buildMapWhere()` di
`modules/map/utils/tenantContext.ts:39`. Query edge punya jalurnya sendiri di
`MappingRepository.findAllEdges()` (memakai `buildTenantWhere`).

Konsumen tidak langsung yang penting: `Pelanggan.odpId` ber-FK ke
`MappingNode.nodeId` (`:976`), dan dropdown ODP pelanggan diisi lewat
`MappingService.getOdpOptions()` / `app/api/odps/route.ts`.

### 3.4 Tabel mati

`Odc`, `Odp`, `OdcOutput`, `OdpOutput`, `Otb`, `Pole`, `Joinbox` punya
repository lengkap di `modules/network/repositories/` tetapi **nol pemanggil**:
tanpa validator, tanpa API route, tanpa halaman admin. Kolom `images`-nya tidak
pernah ditulis maupun ditampilkan. Komentar di `app/api/odps/route.ts:7-14`
menyatakan tabel `Odp` tidak pernah ditulis oleh apa pun.

**Desain ini tidak menyentuh tabel-tabel itu.** Dicatat di sini karena
keberadaannya menyesatkan pembaca skema.

### 3.5 Tautan Google Maps

Repo ini **hanya membuat** tautan Google Maps untuk dibuka
(`AttendanceClient.tsx:796`, `CanvasingDetailClient.tsx:398`), tidak pernah
menguraikannya balik jadi koordinat. Field `shareloc` di `Canvasing` dan
`PresurveiProspek` menyimpan tautan mentah yang tidak pernah dikonversi.
Pengurai tautan karena itu merupakan kemampuan baru.

## 4. Keputusan desain

### K1 — Titik dan kabel rencana memakai tabel yang sama, dibatasi penanda

Titik dan jalur rencana disimpan sebagai `MappingNode` dan `MappingEdge` biasa,
ditandai sebagai rencana dan ditautkan ke planning-nya.

**Alternatif yang ditolak**: tabel `PlanningPoint`/`PlanningCable` tersendiri.
Dua alasan menolaknya:

1. Seluruh editor peta terikat ke `/api/map/*` lewat `map-api-client.ts` dan
   `useMapData.ts`. Tabel terpisah berarti menduplikasi atau memparameterkan
   seluruh editor — termasuk penggambaran, titik belok, dan perhitungan panjang
   yang sudah terbukti jalan.
2. Jalur kabel rencana yang menyambung dari **ODC yang sudah terpasang** ke
   **ODP baru** akan butuh ujung yang bisa menunjuk dua tabel berbeda. Bentuk
   data polimorfik seperti itu canggung dan rawan salah — padahal menyambung ke
   infrastruktur eksisting justru kebutuhan utama peta acuan.

**Harga yang diterima**: tabel topologi jadi berisi campuran "nyata" dan
"usulan". Ditutup oleh K2.

**Manfaat lain**: saat titik dibangun, "terbitkan" cukup melepas penandanya.
Tidak ada penyalinan data dan tidak ada titik kembar.

### K2 — Penyaring dipasang sebagai perilaku bawaan, bukan tanggung jawab pemanggil

Pembacaan topologi mengembalikan **hanya node nyata** kecuali secara eksplisit
meminta konteks planning. Lupa menyaring tidak dicegah oleh disiplin, tetapi
oleh bentuk kodenya.

Tiga tempat wajib:

1. `buildMapWhere()` — chokepoint query node
2. `MappingRepository.findAllEdges()` — query edge punya jalur sendiri
3. `MobileTopologyRepository` — menyentuh `prisma.mappingNode` langsung

Konsekuensi yang paling penting untuk dijaga: **pelanggan tidak boleh bisa
disambungkan ke ODP rencana.** `getOdpOptions()` ikut tersaring otomatis karena
lewat chokepoint yang sama.

Nilai bawaan kolom penanda adalah "nyata" (lihat §5), sehingga seluruh baris
yang sudah ada tetap nyata tanpa migrasi data, dan node yang dibuat dari editor
peta biasa tetap nyata. Risikonya: jalur pembuatan dari planning **harus**
menyetel penandanya. Itu satu jalur kode baru, dikunci tes.

### K3 — Foto per titik memakai dokumen yang sudah ada

`PlanningDocument` mendapat penunjuk opsional ke node. Kategori `SURVEY_PHOTO`
sudah tersedia. Tidak ada tabel foto baru dan tidak ada alur unggah baru —
mekanisme unggah yang dipakai modul lain (`lib/utils/image-upload.ts`, R2
dengan fallback lokal) dipakai apa adanya.

### K4 — Perhitungan adalah fungsi murni

Panjang kabel dan rekap splitter dihitung oleh fungsi murni di lapisan domain:
masukannya daftar titik dan garis, keluarannya rekap. Tanpa Prisma, tanpa I/O.

Alasan: angka ini menjadi dasar anggaran yang naik ke persetujuan direksi.
Bagian yang paling tidak boleh salah harus yang paling mudah diuji.

### K5 — Hasil perhitungan mengisi daftar material, tidak hanya ditampilkan

Rekap diterbitkan menjadi baris `PlanningItem`. Item hasil hitungan ditandai
agar pembuatan ulang hanya mengganti item otomatis dan **tidak pernah menimpa
item yang diketik manusia**.

Ini inti nilainya: peta menutup lingkaran ke budget dan persetujuan yang sudah
berjalan, bukan menghasilkan angka yang harus diketik ulang.

## 5. Perubahan skema

Semua lewat migration Prisma (wajib, sesuai CLAUDE.md).

### `MappingNode`

```prisma
planningId String?   // planning yang mengusulkan titik ini; disimpan selamanya
isPlanned  Boolean @default(false)  // true = usulan, belum terpasang
planning   Planning? @relation(fields: [planningId], references: [id], onDelete: SetNull)

@@index([planningId])
@@index([isPlanned])
```

`isPlanned` menentukan keterlihatan. `planningId` tetap terisi setelah
diterbitkan, sebagai jejak asal-usul.

`onDelete: SetNull` dipilih agar menghapus planning tidak pernah menghapus node
yang sudah terlanjur terpasang di jaringan nyata.

### `MappingEdge`

```prisma
planningId String?
isPlanned  Boolean @default(false)
planning   Planning? @relation(fields: [planningId], references: [id], onDelete: SetNull)

@@index([planningId])
@@index([isPlanned])
```

### `PlanningDocument`

```prisma
nodeId String?   // foto yang melekat pada satu titik, bukan pada proyek
node   MappingNode? @relation(fields: [nodeId], references: [nodeId], onDelete: Cascade)

@@index([nodeId])
```

### `PlanningItem`

```prisma
isAutoGenerated Boolean @default(false)  // dihasilkan dari peta, bukan diketik
sourceKey       String?                  // mis. "kabel:feeder", "splitter:1:8"

@@index([planningId, isAutoGenerated])
```

`sourceKey` membuat pembuatan ulang bersifat idempoten: item dicocokkan dan
diperbarui, bukan ditumpuk.

### `Planning`

```prisma
spareKabelPersen Float @default(0)  // cadangan kabel untuk seluruh planning
```

Menerima relasi balik `nodes MappingNode[]`, `edges MappingEdge[]`.

Bawaan `0` dipilih agar planning lama maupun baru tidak pernah mendapat
cadangan yang tidak diminta siapa pun; menaikkannya adalah tindakan sadar.
Divalidasi 0–100.

**Catatan**: `Planning.coordinates Json?` yang ada tetap dipertahankan sebagai
titik pusat area untuk tampilan daftar dan peta awal. Tidak diubah.

## 6. Input titik: tiga cara

Semua bermuara pada satu pasang koordinat tervalidasi.

1. **Klik di peta** — sudah ada
2. **Ketik latitude/longitude** — marker berpindah saat diketik, jadi salah
   ketik langsung terlihat
3. **Tempel tautan Google Maps** — koordinat diambil dari tautan

### 6.1 Pengurai tautan (murni, tanpa jaringan)

Fungsi murni baru di `lib/geo/tautan-peta.ts`, dipakai bersama dan nanti bisa
dipakai ulang oleh `shareloc` di canvasing/presurvei.

Bentuk yang dapat diurai langsung:

| Bentuk | Contoh |
|---|---|
| parameter `q` | `google.com/maps?q=-6.2,106.8` |
| `search` API | `google.com/maps/search/?api=1&query=-6.2,106.8` |
| koordinat kamera | `google.com/maps/@-6.2,106.8,17z` |
| koordinat tempat | `.../place/X/@-6.2,106.8,17z/data=...!3d-6.2!4d106.8` |

Pada bentuk terakhir, pasangan `!3d`/`!4d` adalah koordinat tempat yang
sebenarnya dan **lebih tepat** daripada `@` (yang merupakan posisi kamera);
pengurai mendahulukannya.

Divalidasi: lintang −90..90, bujur −180..180, bukan NaN.

### 6.2 Tautan pendek perlu satu permintaan keluar

`maps.app.goo.gl/...` dan `goo.gl/maps/...` **tidak memuat koordinat sama
sekali**. Padahal bentuk inilah yang keluar dari tombol "Bagikan" di aplikasi
Google Maps — yaitu kasus yang paling sering terjadi.

Menguraikannya menuntut server mengikuti pengalihan tautan. Itu berarti
**mengirim permintaan keluar berdasarkan teks yang diketik pengguna** — kelas
kerentanan SSRF. Penjaganya ditetapkan di desain, bukan ditambal belakangan:

- Daftar host yang diizinkan bersifat tertutup: `maps.app.goo.gl`, `goo.gl`,
  `maps.google.com`, `www.google.com`, `google.com`
- Host **diperiksa ulang di setiap langkah pengalihan**, bukan sekali di awal
- Maksimum 3 pengalihan, batas waktu 5 detik
- Menolak alamat yang menyelesaikan ke rentang IP privat/loopback/link-local
- Tidak mengirim kredensial, cookie, maupun header autentikasi
- Hanya alamat tujuan yang dibaca; badan responsnya tidak diambil
- Galat yang dikembalikan ke klien bersifat umum, tidak memuat alamat internal
  maupun pesan galat jaringan mentah

Endpoint: `POST /api/planning/tautan-peta/uraikan`, butuh izin
`planning:update`. Dibatasi laju per pengguna.

Bila gagal, form menyatakannya terang-terangan dan menawarkan jalan keluar
("buka tautannya di browser, lalu salin koordinatnya") — **tidak pernah**
mengisi koordinat tebakan. Titik ODP yang salah koordinat lebih berbahaya
daripada titik yang kosong, karena seluruh perhitungan kabel ikut salah.

## 7. Perhitungan kebutuhan material

Fungsi murni di `modules/planning/domain/kebutuhan-material-osp.ts`.

**Masukan**: daftar titik rencana (`type`, `splitter`), daftar garis rencana
(`fiberType`, `distance`), dan persentase cadangan kabel planning.

**Keluaran**:

```ts
interface KebutuhanMaterialOsp {
  kabel: Array<{
    jenisFiber: string;
    meterTerukur: number; // hasil ukur jalur di peta
    meterDipesan: number; // setelah cadangan diterapkan
  }>;
  splitter: Array<{ rasio: string; jumlah: number }>;
  jumlahTitik: { odp: number; odc: number };
  spareKabelPersen: number;
}
```

Kedua angka kabel disimpan berdampingan, bukan hanya hasil akhirnya, supaya
pembaca dapat memisahkan "berapa yang terukur" dari "berapa yang dibeli" tanpa
menghitung mundur.

Aturan:

- Panjang kabel dijumlahkan **per jenis fiber**, karena harga dan spesifikasi
  feeder, distribusi, dan drop berbeda
- Garis tanpa `distance` dihitung ulang dari koordinat + titik belok memakai
  `calculateMapDistance` yang sudah ada — bukan diabaikan diam-diam
- Rekap splitter dikelompokkan per rasio, dihitung dari titik ODC dan ODP
  rencana

### 7.1 Rasio splitter

Memakai daftar yang **sudah ada** di `components/map/node-form-utils.ts:17`,
bukan daftar baru:

| Tipe | Rasio tersedia |
|---|---|
| ODC | `1:2`, `1:4`, `1:8`, `1:16`, `1:32`, `1:64` |
| ODP | `1:2`, `1:4`, `1:8`, `1:16`, `1:32` |

Daftar ini sengaja tidak dipersempit. Bila peta planning dan peta operasional
menawarkan pilihan berbeda untuk hal yang sama, keduanya jadi sumber kebenaran
yang bersaing. Kalau rasio di atas `1:16` memang tidak dipakai di lapangan,
penyempitannya dilakukan di kedua tempat sekaligus, sebagai perubahan
tersendiri.

**Perbedaan dari form peta operasional**: di sana field splitter sudah
terpilih `1:8` secara otomatis (`NodeFormModal.tsx:219`). Untuk titik rencana,
field ini **dimulai kosong dan wajib dipilih**.

Alasannya: di peta operasional nilai bawaan hanyalah tebakan yang bisa
diperbaiki. Di dokumen anggaran, field yang tidak pernah disentuh perencana
diam-diam menjadi jumlah barang yang dibeli. Memaksa pilihan eksplisit lebih
murah daripada menemukan kesalahannya setelah barang dipesan.

### 7.2 Cadangan kabel (spare)

Cadangan **tidak** dihitung per ruas kabel. Ia diterapkan satu kali di akhir,
sebagai persentase milik planning.

- `Planning.spareKabelPersen` — persentase cadangan untuk seluruh planning
- Panjang yang dipesan = panjang terukur × (1 + persentase)
- Berlaku ke semua jenis fiber dalam planning itu

Setiap item kabel tetap **satu baris per jenis** dengan jumlah akhir yang bisa
langsung dipesan, dan asal angkanya tertulis di `notes` item, misalnya
`terukur 1.240 m + cadangan 10%`.

Bentuk ini menjaga dua hal sekaligus: yang dibaca bagian pengadaan adalah satu
angka siap pesan, sementara penurunannya tetap bisa ditelusuri saat ditanya —
cadangan tidak pernah tersembunyi di dalam rumus.

## 8. Izin

Memakai resource `planning` yang sudah terdaftar
(`lib/permission-config.ts:117`), bukan daftar granular aspirasional di
spesifikasi 2026-08-08 yang tidak jadi diterapkan.

| Aksi | Izin |
|---|---|
| Melihat peta planning | `planning:read` |
| Menambah/mengubah titik & jalur rencana | `planning:update` |
| Menguraikan tautan peta | `planning:update` |
| Menerbitkan titik rencana jadi node nyata | `planning:update` **dan** `map:create` |

Syarat ganda pada penerbitan disengaja: tim planning boleh merencanakan
sebebasnya, tetapi memasukkan node ke topologi operasional menuntut hak atas
peta. Ini mencegah rencana yang belum matang masuk ke jaringan nyata.

## 9. Alur layar

Tab baru **Peta** pada halaman detail planning (`/admin/planning/[id]`),
berdampingan dengan tab yang sudah ada.

Isinya:

- Peta dengan node nyata sebagai **latar redup** dan node rencana **menonjol**,
  sehingga perencanaan selalu dalam konteks jaringan yang sudah ada
- Tombol tambah titik → panel dengan tiga cara input (§6)
- Penarikan jalur kabel memakai overlay yang sudah ada; panjang tampil langsung
  saat menarik
- Panel ringkasan: kabel per jenis (terukur dan setelah cadangan), rekap
  splitter, jumlah titik, serta field persentase cadangan yang bisa diubah dan
  langsung memperbarui angka pesanan
- Tombol **"Perbarui kebutuhan material"** yang menuliskan rekap ke
  `PlanningItem`, dengan pratinjau perubahan sebelum ditulis
- Unggah foto per titik dari popup titiknya

Tombol penerbitan tidak diletakkan di tab ini melainkan menyusul status
planning; detailnya ditentukan saat perencanaan implementasi.

## 10. Pengujian

| Lapisan | Yang diuji |
|---|---|
| Domain (murni) | kabel per jenis, rekap splitter, garis tanpa `distance`, cadangan 0% tidak mengubah angka, pembulatan saat cadangan diterapkan |
| Pengurai tautan | tiap bentuk URL, pengutamaan `!3d`/`!4d`, koordinat di luar rentang, tautan sampah |
| Penjaga SSRF | host di luar daftar, pengalihan yang berpindah ke host lain di tengah jalan, IP privat, melebihi batas pengalihan, batas waktu |
| Repository | **node & edge rencana tidak muncul** di pembacaan topologi — node, edge, dan topologi mobile, masing-masing terpisah |
| Dropdown pelanggan | ODP rencana tidak muncul di `getOdpOptions` |
| Penerbitan item | item otomatis diperbarui bukan ditumpuk; item manual tidak pernah tersentuh |
| Izin | penerbitan ditolak tanpa `map:create` |

Setiap perbaikan dibuktikan ganda sesuai kebiasaan proyek: tes hijau **dan**
uji mutasi (balikkan perbaikannya, pastikan tes merah).

## 11. Risiko

| Risiko | Penanganan |
|---|---|
| Node rencana bocor ke topologi operasional | penyaring bawaan di tiga chokepoint (K2) + tes per chokepoint |
| Jalur pembuatan dari planning lupa menyetel `isPlanned` | satu jalur kode, dikunci tes; bawaan `false` dipilih demi keamanan data lama |
| Tautan pendek membuka SSRF | daftar host tertutup diperiksa tiap hop, tanpa kredensial, batas waktu & pengalihan |
| Tile Google tidak resmi diputus | sudah menjadi kondisi hari ini, bukan dampak desain ini; dicatat agar diketahui |
| Angka anggaran salah karena asumsi tersembunyi | rasio splitter wajib dipilih (tanpa bawaan `1:8`); cadangan berupa persentase eksplisit milik planning, bawaan 0, penurunannya tertulis di item |
| `MappingNode` dipakai dua konteks sehingga membingungkan | dinamai eksplisit di DTO & UI; tabel mati §3.4 tidak ditambah perannya |

## 12. Pertanyaan terbuka

1. Apakah penerbitan dilakukan per titik atau sekaligus satu planning saat
   statusnya `COMPLETED`?
2. Apakah node rencana dari planning yang `REJECTED`/`CANCELLED` dihapus,
   disembunyikan, atau dibiarkan sebagai arsip?

Keduanya tidak menghalangi implementasi tahap pertama dan diputuskan saat
perencanaan.
