# Migrasi Peta ke Google Maps JavaScript API — Desain

**Tanggal**: 2026-10-12
**Status**: Draf desain, menunggu review
**Penulis**: agent

---

## 1. Masalah

Aplikasi ini punya **tiga tumpukan peta** yang tidak saling tahu, dan dua di
antaranya memperlihatkan dunia yang berbeda kepada pemakai yang sama.

| Permukaan | Mesin | Sumber petak |
|---|---|---|
| `/admin/map` (peta jaringan) | Leaflet 1.9 | Google satelit lewat `mt0.google.com` |
| Tab Peta rencana OSP | Leaflet 1.9 | Google satelit lewat `mt0.google.com` |
| Panel "Lokasi GPS" detail planning | OpenLayers 10 | OpenStreetMap |
| Pemilih koordinat planning baru | OpenLayers 10 | OpenStreetMap |
| Pemilih koordinat pelanggan PPP | OpenLayers 10 | OpenStreetMap |
| Pemilih koordinat Site Work Order | OpenLayers 10 | OpenStreetMap |
| Live-map kehadiran | OpenLayers 10 | OpenStreetMap |
| Peta kegiatan presurvei | OpenLayers 10 | OpenStreetMap |
| Mobile (topologi, presurvei) | MapLibre | Google satelit lewat `mt0.google.com` |

Dua masalah terpisah, dan keduanya nyata:

**Masalah kepatuhan.** `https://mt0.google.com/vt/lyrs=y&...` adalah endpoint
internal Google yang tidak pernah didokumentasikan, tanpa API key dan tanpa
tagihan. Dokumentasi repo sendiri sudah menamainya apa adanya —
`docs/guides/NEXTJS_MAP_INTEGRATION.md:202` menulis
`// [REVERSE ENGINEERED] Google Maps Hybrid Tile Layer`. Endpoint itu bisa
diblokir kapan saja tanpa pemberitahuan, dan pemakaiannya di luar Terms of
Service Google. Risikonya bukan teoretis: satu perubahan di sisi Google
memadamkan peta di web **dan** mobile secara bersamaan.

**Masalah pengalaman.** Di satu halaman yang sama (`/admin/planning/[id]`),
tab "Peta" menampilkan citra satelit sementara panel "Lokasi GPS" di tab
Overview menampilkan OpenStreetMap datar. Itu bukan pilihan desain, itu
akibat dua pustaka peta yang kebetulan hidup berdampingan.

## 2. Keputusan

Migrasi seluruh peta web ke **Google Maps JavaScript API resmi**, dengan API
key yang dikelola dari menu Pengaturan. Leaflet dan OpenLayers dicabut.

Keputusan ini diambil pemilik produk setelah ditawarkan alternatif yang lebih
murah (Map Tiles API: cukup mengganti URL petak, seluruh kode peta bertahan,
kuota gratis 10× lebih besar). Alternatif itu ditolak karena yang diinginkan
bukan sekadar citra Google, melainkan antarmuka Google — **Street View** dan
label POI. Street View punya nilai operasional langsung untuk perencanaan OSP:
tim planning bisa memeriksa tiang dan rute kabel dari jalan tanpa turun ke
lapangan dua kali.

Konsekuensi yang diterima: tujuh komponen peta ditulis ulang, aplikasi mobile
tidak ikut terbantu, dan kuota gratis turun dari 100.000 petak/bulan menjadi
10.000 pemuatan peta/bulan.

### 2.1 Pustaka

**`@vis.gl/react-google-maps@1.10.1`** — inilah pustaka yang dipakai
dokumentasi resmi Google sendiri untuk contoh React-nya, peer dependency-nya
sudah menyebut React 19 secara eksplisit, dan rilis terakhirnya September 2026.

Yang sudah disediakannya, sehingga tidak perlu kita tulis: `APIProvider`,
`Map`, `AdvancedMarker`, `Pin`, `InfoWindow`, `MapControl`, `Polyline`,
`Polygon`, `Circle`, `Rectangle`, `useMapsLibrary`, `useMap`.

`Polyline` tersedia sebagai komponen — ini penting, karena jalur kabel OSP dan
jalur fiber peta jaringan keduanya bergantung padanya.

Pustaka pembanding `@react-google-maps/api` tidak dipilih: ia tidak dipakai
dokumentasi Google dan laporan komunitas menyebut pemeliharaannya tertinggal.

### 2.2 Map ID wajib

`AdvancedMarker` hanya bekerja bila `Map` diberi `mapId` — sebuah Map ID
berbasis cloud yang dibuat di Google Cloud Console (Maps → Map Management).
Karena seluruh penanda node kita adalah ikon kustom, Map ID menjadi
**prasyarat**, bukan opsi. Ia disimpan sebagai setelan kedua di samping API
key.

Satu batasan yang perlu diketahui sejak awal: dengan cloud-based styling,
Google mencabut kemampuan mengatur tampilan POI untuk tipe peta non-roadmap
seperti `hybrid`. Artinya label POI pada citra satelit tidak bisa kita
sembunyikan atau tata sendiri.

### 2.3 Penyimpanan kredensial

Tiga baris baru di tabel `Settings` (key-value per-tenant yang sudah ada):

| Key | `encrypted` | Keterangan |
|---|---|---|
| `GOOGLE_MAPS_ENABLED` | `false` | Saklar fitur |
| `GOOGLE_MAPS_API_KEY` | `false` | Dikirim ke browser |
| `GOOGLE_MAPS_MAP_ID` | `false` | Dikirim ke browser |

**API key ini sengaja TIDAK dienkripsi dan TIDAK dimasking.** Maps JavaScript
API memuat skripnya dari browser dengan key di URL — key itu terlihat oleh
siapa pun yang membuka DevTools, pada setiap halaman yang menampilkan peta.
Menyimpannya terenkripsi lalu menampilkannya sebagai `••••••••` di form akan
menyiratkan kerahasiaan yang tidak pernah ada, dan menyesatkan administrator
berikutnya yang membaca kode ini.

Polanya mengikuti `captcha_site_key` (`modules/settings/services/captchaSettings.ts`)
yang menghadapi persoalan identik — kunci publik di samping kunci rahasia —
dan sudah memutuskan hal yang sama.

**Pengaman yang sesungguhnya adalah pembatasan di Google Cloud Console**, dan
halaman pengaturan harus mengatakannya dengan jelas kepada administrator:

1. *Application restrictions* → HTTP referrers, diisi domain tenant
   (`https://admin.radpro.id/*`) dan `http://localhost:3000/*` untuk pengembangan.
2. *API restrictions* → hanya Maps JavaScript API (tambah Street View Static
   API bila panel Street View dipakai).
3. *Quota* → batas harian, supaya key yang bocor tidak melahirkan tagihan.

Tanpa ketiganya, key yang terbuka memang berbahaya. Dengan ketiganya, ia tidak
lebih berbahaya daripada nama domain.

### 2.4 Pengiriman key ke klien

Setelan ini **ditulis dari halaman `/admin/pengaturan/api` yang sudah ada**,
sebagai kartu ketiga di samping Gemini dan Cloudflare R2 — bukan halaman
pengaturan tersendiri. Ketiga key-nya ikut `API_SETTINGS_KEYS`, jadi satu
tombol Simpan di halaman itu mengurus semuanya.

Pembacaannya tetap lewat endpoint terpisah `GET /api/settings/maps`,
`createHandler({ auth: true })` **tanpa `permissions`**, karena penulisannya
dikunci `api:update` sementara pembacaannya tidak boleh dikunci sama sekali.

Tanpa izin apa pun, dan itu disengaja. Peta dipakai di layar yang penggunanya
belum tentu punya `map:read` — pemilih koordinat pelanggan PPP, Site Work
Order, live-map kehadiran, presurvei. Menggantungkan key pada `map:read` akan
mengulang persis jebakan yang sudah pernah kita perbaiki di peta rencana OSP:
peta tampak kosong padahal datanya ada, dan tidak ada yang tahu sebabnya.

Yang dikembalikan hanya tiga field, dan hanya saat fitur aktif:

```ts
{ enabled: boolean; apiKey: string; mapId: string }
```

Saat `enabled === false`, `apiKey` dan `mapId` keluar sebagai string kosong —
meniru `publicCaptchaSettings` yang menahan site key selama fitur mati.

### 2.5 Pemuatan SDK

`APIProvider` dipasang sekali di `app/admin/layout.tsx` lewat pembungkus baru
`contexts/GoogleMapsContext.tsx` (Fase 2), bukan di tiap komponen peta. Alasannya:
`APIProvider` yang dipasang berulang akan memuat skrip Maps lebih dari sekali,
dan setiap pemuatan dihitung sebagai *map load* berbayar.

Pembungkus itu merender `children` apa adanya selama setelan belum tiba,
lalu memasang `APIProvider` begitu key ada. Ia juga mengekspos
`useGoogleMapsSiap()` supaya komponen peta bisa membedakan "sedang memuat"
dari "belum dikonfigurasi".

### 2.6 Perilaku saat belum dikonfigurasi

Karena Leaflet dan OpenLayers dicabut, tidak ada lagi peta cadangan. Setiap
permukaan peta menampilkan satu panel kosong yang jujur:

> **Peta belum dikonfigurasi.** Google Maps API key belum diisi.
> Buka Pengaturan → Peta untuk mengisinya. (tautan, hanya untuk yang punya izin)

Ini **bukan** kemunduran yang disembunyikan, dan konsekuensinya harus
dipahami sebelum migrasi dimulai: begitu Leaflet dicabut, instalasi tanpa API
key kehilangan seluruh fungsi petanya. Karena itu Fase 1 (pengaturan) harus
tayang dan terisi lebih dulu, sebelum satu komponen peta pun disentuh.

Satu penyangga sudah ada: form titik rencana OSP menerima koordinat ketikan
manual dan tautan Google Maps, jadi pencatatan titik tidak sepenuhnya mati
meski kanvasnya kosong.

## 3. Arsitektur

### 3.1 Primitif bersama

Folder baru `components/map/google/`, dipakai ketujuh permukaan:

| Berkas | Tanggung jawab |
|---|---|
| `PetaGoogle.tsx` | Pembungkus `Map`: `mapId`, tipe peta, zoom, gestur, kondisi "belum dikonfigurasi" |
| `PenandaNode.tsx` | `AdvancedMarker` + ikon node sebagai komponen React |
| `PenandaDapatDiseret.tsx` | `AdvancedMarker draggable` untuk pemilih koordinat dan penanda sementara |
| `JalurKabel.tsx` | `Polyline` + `InfoWindow`, berwarna menurut jenis fiber |
| `ikon-node.tsx` | Ikon node sebagai JSX, menggantikan pabrik string HTML |

`useKlikPeta.ts` yang semula direncanakan **tidak jadi dibuat**. `Map` milik
vis.gl sudah menerima prop `onClick`, jadi hook pembungkusnya hanya akan
menjadi lapisan tanpa isi — berbeda dari Leaflet, yang memaksa klik kanvas
lewat `useMapEvents` atau `ref` imperatif justru karena tidak punya prop itu.
`PetaGoogle` meneruskannya langsung sebagai `onKlik(lat, lng)`.

**Pabrik ikon menjadi lebih sederhana, bukan lebih rumit.**
`components/map/map-icon-factory.ts` hari ini merakit HTML sebagai *string
template* untuk `L.divIcon`. `AdvancedMarker` menerima `children` React, jadi
ikon yang sama menjadi komponen biasa yang bisa dibaca, diuji, dan diberi
properti.

Supaya ikon JSX itu tidak perlu `dangerouslySetInnerHTML`, jejak gambarnya
dipisahkan menjadi `NODE_ICON_PATH` (hanya atribut `d`) di
`map-icon-config.ts`, dan markup string `NODE_ICON_SVG` yang masih dipakai
Leaflet diturunkan dari daftar yang sama. Satu salinan jejak gambar, dua
bentuk keluaran — dan tidak ada HTML yang disuntikkan ke DOM.

### 3.2 Peta migrasi per permukaan

| # | Berkas sekarang | Baris | Mesin | Yang perlu perhatian |
|---|---|---|---|---|
| 1 | `app/admin/planning/[id]/peta/PetaRencanaLeaflet.tsx` | 339 | Leaflet | Klik kanvas, polyline jalur, dua kelompok penanda (rencana penuh / nyata redup), penanda draf, popup dengan unggah foto |
| 2 | `components/map/NetworkMapInteractive.tsx` | 605 | Leaflet | Terbesar. Enam penanda sementara **dapat diseret**, klik imperatif lewat `ref` + `setTimeout`, popup node, polyline fiber, overlay penggambaran |
| 3 | `components/common/MapPicker.tsx` | 342 | OpenLayers | Juga `MapPickerWithSearch`; pencarian alamatnya memanggil `/api/geocode/search` yang **tidak ada** (lihat §6) |
| 4 | `components/admin/sites/MapPicker.tsx` | 258 | OpenLayers | Varian kedua pemilih koordinat — kandidat digabung dengan #3 |
| 5 | `components/attendance/EmployeeLocationMap.tsx` | 332 | OpenLayers | Satu-satunya yang memakai `fit(extent)`; padanannya `map.fitBounds` |
| 6 | `app/admin/presurvei/kegiatan/KegiatanPeta.tsx` | 297 | OpenLayers | Banyak penanda kegiatan |
| 7 | `components/common/MapPreview.tsx` | 134 | OpenLayers | Hanya-baca; paling sederhana, dikerjakan pertama sebagai uji pola |

`components/map/NetworkMap.tsx` (189 baris) **dihapus, bukan dimigrasikan** —
penelusuran importer di `app/`, `components/`, dan `lib/` tidak menemukan satu
pun pemakai. Ia kode mati yang masih menyimpan URL `mt0.google.com` kedua.

### 3.3 Street View

Nilai yang menjadi alasan memilih jalur ini, jadi ia bagian dari lingkup, bukan
tambahan.

Panel Street View ditempatkan di **popup titik rencana OSP**
(`PopupTitikRencana.tsx`) sebagai tombol "Lihat dari jalan" yang membuka
`google.maps.StreetViewPanorama` pada koordinat titik. Ia dimuat lewat
`useMapsLibrary("streetView")` hanya saat diminta, sehingga halaman yang tidak
memakainya tidak membayar.

Bila Street View tidak tersedia di koordinat itu — hal biasa di gang
perumahan — panel menyatakannya, bukan menampilkan kotak abu-abu kosong.

## 4. Ongkos

Kuota gratis Maps JavaScript API adalah **10.000 pemuatan peta per bulan**,
setelah itu sekitar **$7 per 1.000**. Kredit $200/bulan yang lama sudah dicabut
Google sejak Maret 2025.

Satu kali membuka halaman berpeta = satu pemuatan. Dengan tujuh permukaan
berpeta, angka itu lebih mudah tersentuh daripada kelihatannya: sepuluh orang
membuka peta lima kali sehari selama 22 hari kerja sudah 1.100 — aman; tetapi
tim lapangan yang berpindah-pindah halaman sepanjang hari bisa melipatgandakannya.

Mitigasi yang masuk ke lingkup:

1. **Batas kuota harian di Google Cloud Console** — wajib, dan halaman
   pengaturan menyebutkannya. Ini satu-satunya pencegah tagihan kejut.
2. **`APIProvider` tunggal di layout** (§2.5) supaya berpindah antar-halaman
   admin tidak memuat ulang SDK.
3. `MapPreview` yang hanya-baca memakai **Static Maps API**, bukan peta
   dinamis — SKU-nya terpisah dan jauh lebih murah untuk gambar diam.

## 5. Pengujian

Google Maps JS tidak bisa dimuat di jsdom, jadi seluruh pengujian komponen
peta memakai tiruan `@vis.gl/react-google-maps`. Satu panggung bersama
`tests/app/google-maps-harness.tsx` menyediakan tiruan `Map`,
`AdvancedMarker`, `Polyline`, `InfoWindow` yang merender `children`-nya ke DOM
biasa, sehingga pengujian tetap menguji *perilaku komponen kita*, bukan SDK
Google.

Empat berkas uji yang ada menyentuh permukaan peta dan harus ikut disesuaikan:
`tests/app/admin/planning-peta-leaflet.test.tsx`,
`planning-peta-popup-titik.test.tsx`, `planning-peta-tab.test.tsx`,
`tests/components/map/map-overlay-components.test.ts`.

Tambahan yang wajib ada, karena ketiganya adalah mode gagal yang hanya terlihat
di produksi:

- Setelan kosong → panel "belum dikonfigurasi", bukan peta kosong atau galat.
- `GOOGLE_MAPS_ENABLED=false` → endpoint mengembalikan key kosong.
- Endpoint `/api/settings/maps` dapat diakses pengguna **tanpa** `map:read`.

## 6. Temuan sampingan

Penelusuran menemukan dua hal yang bukan bagian dari migrasi ini tetapi perlu
dicatat supaya tidak hilang:

1. **`/api/geocode/search` tidak ada.** `components/common/MapPicker.tsx:269`
   memanggilnya untuk pencarian alamat, dan `docs/api/API_DOCUMENTATION.md:90`
   mendokumentasikan `GET /api/geocode/reverse` — keduanya tidak ada di
   `app/api`. Fitur pencarian alamat di pemilih koordinat kemungkinan besar
   404 sejak lama. Migrasi ini memberi jalan keluar yang rapi: Places
   Autocomplete dari Google menggantikan endpoint yang tidak pernah dibangun
   itu. **Catatan kuota**: Places adalah SKU terpisah dengan tagihan sendiri.
2. **Reverse geocoding memakai Nominatim/OSM**, dipanggil langsung dari
   browser di `components/attendance/AttendancePageContent.tsx:347`. Ia bekerja
   dan gratis, tetapi kebijakan pemakaian Nominatim melarang pemakaian massal
   tanpa User-Agent yang jelas. Dibiarkan apa adanya di lingkup ini.

## 7. Di luar lingkup

- **Aplikasi mobile.** `mobile-netmanager` memakai MapLibre dengan URL petak
  `mt0.google.com` yang sama (`NativeTopologyMap.tsx:37`). Maps JavaScript API
  tidak berlaku untuk React Native. Artinya **setelah migrasi ini selesai, sisi
  mobile tetap berada di luar ToS Google.** Itu pekerjaan terpisah, dan
  pilihannya `react-native-maps` dengan provider Google atau Map Tiles API
  sebagai sumber raster MapLibre.
- Clustering penanda. Belum ada hari ini; `/admin/map` merender seluruh node
  tanpa batas. Bila dataset tumbuh, `@googlemaps/markerclusterer` adalah
  jalannya.
- Menggabungkan dua pemilih koordinat (#3 dan #4) menjadi satu komponen.
  Pantas dilakukan, tetapi jangan dicampur dengan migrasi mesin peta.

## 8. Urutan pengerjaan

Setiap fase berdiri sendiri dan bisa dihentikan tanpa meninggalkan aplikasi
dalam keadaan rusak.

| Fase | Isi | Setelah fase ini |
|---|---|---|
| 1 | Setelan: tiga key, service, endpoint baca, kartu di `/admin/pengaturan/api` | Tidak ada peta berubah. Administrator sudah bisa mengisi key |
| 2 | Primitif bersama `components/map/google/*` + panggung uji | Belum dipakai siapa pun |
| 3 | `MapPreview` (#7) — permukaan paling sederhana | Pola terbukti pada satu layar nyata |
| 4 | Peta rencana OSP (#1) + Street View | Fitur terbaru dan paling bernilai sudah pindah |
| 5 | Peta jaringan (#2), hapus `NetworkMap.tsx` mati | Leaflet tidak dipakai lagi |
| 6 | Lima pemilih OpenLayers (#3–#6) | OpenLayers tidak dipakai lagi |
| 7 | Cabut `leaflet`, `react-leaflet`, `@types/leaflet`, `ol`; bersihkan CSS `.leaflet-popup-*` | Satu mesin peta, `mt0.google.com` hilang dari web |

**Fase 1 harus tayang dan terisi key sebelum Fase 3 dimulai.** Begitu peta
pertama dimigrasikan, instalasi tanpa key kehilangan peta itu.

## 9. Risiko

| Risiko | Penanganan |
|---|---|
| Tagihan kejut melampaui 10.000 pemuatan | Batas kuota harian di Cloud Console, diinstruksikan di halaman pengaturan; `APIProvider` tunggal; Static Maps untuk pratinjau |
| Key bocor dan dipakai pihak lain | Pembatasan HTTP referrer + API restriction; key memang publik secara desain |
| Regresi pada peta rencana OSP yang baru selesai diuji | Fase 4 berdiri sendiri; 4 berkas uji yang ada dipertahankan perilakunya, dan alur ujung-ke-ujung (gambar jalur → material → terbitkan) diulang manual |
| Map ID belum dibuat → `AdvancedMarker` diam-diam tidak tampil | Map ID diperlakukan sebagai field wajib; fitur tidak "aktif" tanpanya |
| Mobile tertinggal di luar ToS | Dicatat terang-terangan di §7 sebagai pekerjaan lanjutan, bukan dianggap selesai |

## 10. Catatan cabang

Spesifikasi ini ditulis di worktree `worktree-planning-osp-peta`, yang masih
memuat commit fitur peta rencana OSP yang belum di-merge. Dua pekerjaan besar
yang tidak berhubungan dalam satu cabang membuat review dan rollback keduanya
sulit, jadi pembagiannya:

- **Fase 1 dan 2 dikerjakan di worktree ini.** Keduanya murni penambahan —
  setelan, endpoint, context, dan primitif yang belum dipakai siapa pun —
  sehingga tidak menyentuh satu pun berkas milik fitur OSP. Alasan praktisnya:
  server dev sedang hidup di worktree ini untuk pengujian, dan halaman
  pengaturan hanya berguna kalau bisa langsung dicoba. Commit-nya terpisah
  bersih sehingga bisa di-*cherry-pick* ke cabang lain bila diinginkan.
- **Fase 3 ke atas pindah ke cabang baru dari `main`**, setelah cabang OSP
  diintegrasikan. Mulai fase itulah berkas milik fitur OSP ikut ditulis ulang,
  dan menumpuknya di cabang yang sama akan mengunci keduanya menjadi satu
  keputusan merge.
