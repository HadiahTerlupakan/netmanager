# Multi-Tenant Logo Resolution Design

Tanggal: 2026-04-20
Topik: Mengganti hardcoded logo menjadi resolver terpusat dengan dukungan tenant-specific logo dan fallback global

## Latar belakang

Implementasi logo saat ini masih terpecah di beberapa tempat. Admin sudah memiliki pengaturan upload logo global melalui `app/api/settings/logo/route.ts` dan `modules/settings/services/logoSettings.ts`, tetapi consumer UI belum konsisten memakainya.

Masalah yang sudah teridentifikasi:

1. Beberapa halaman masih hardcode `"/images/logo-sbl.png"`, termasuk login customer, landing page, dan kebijakan privasi.
2. Sidebar admin dan karyawan belum memakai `logoAplikasi`, walaupun data tersebut sudah tersedia di settings.
3. `hooks/useSettings.ts` masih merge respons `/api/settings/logo` dengan shape yang salah, sehingga field logo dari endpoint ini tidak terbaca benar.
4. Kebutuhan produk mengharuskan logo mendukung multi-tenant: ketika tenant context tersedia, logo mengikuti tenant; ketika halaman publik tidak punya tenant context, sistem harus memakai logo global.

Akibatnya, fitur logo belum bekerja end-to-end. Upload logo berhasil, tetapi branding yang terlihat user tetap bercampur antara logo statis lama dan logo dari settings.

## Tujuan

1. Menghapus semua hardcoded aplikasi terhadap `"/images/logo-sbl.png"` sebagai source utama branding.
2. Menjadikan resolusi logo konsisten melalui satu alur: `tenant logo -> global logo -> default asset`.
3. Memastikan halaman dengan tenant context memakai logo tenant masing-masing.
4. Memastikan halaman publik atau tanpa tenant context memakai fallback logo global.
5. Memperbaiki kontrak data settings agar consumer UI membaca payload logo dengan benar.
6. Menjaga perubahan tetap modular dan sesuai arsitektur `UI -> API -> Service -> Repository`.

## Non-goals

1. Tidak mendesain ulang keseluruhan sistem settings tenant bila storage tenant logo belum tersedia penuh.
2. Tidak mengubah alur upload logo global yang sudah bekerja selain penyesuaian kontrak konsumsi.
3. Tidak menambah sistem asset management baru di luar mekanisme upload/logo settings yang sudah ada.
4. Tidak mengubah brand asset default `/images/logo-sbl.png`; file itu tetap menjadi fallback terakhir.

## Keputusan produk

1. Semua lokasi yang saat ini hardcode logo harus berpindah ke resolver terpusat.
2. Logo bersifat **per tenant** bila tenant context tersedia.
3. Untuk halaman publik atau halaman tanpa session/tenant context yang bisa dipercaya, sistem memakai **global fallback**.
4. Jika tenant logo dan global logo sama-sama tidak tersedia, sistem memakai asset default lokal.

## Desain tingkat tinggi

Arsitektur baru terdiri dari tiga lapisan:

1. **Logo source services** untuk mengambil kandidat logo tenant dan global.
2. **Logo resolver** untuk menentukan logo final berdasarkan prioritas bisnis.
3. **Shared UI consumers** yang hanya menerima hasil resolusi, bukan memutuskan fallback sendiri.

Urutan resolusi resmi setelah perubahan:

1. Consumer menentukan apakah ia punya tenant context yang valid.
2. Resolver mencoba mengambil `tenant logo` jika tenant context tersedia.
3. Jika tenant logo tidak ada, resolver mengambil `global logo aplikasi`.
4. Jika global logo juga tidak ada, resolver mengembalikan default asset `/images/logo-sbl.png`.
5. Consumer merender hasil resolver tanpa hardcode tambahan.

Dengan pola ini, keputusan branding tidak lagi tersebar di halaman-halaman individual.

## Komponen desain

### 1. Kontrak data logo terpusat

Tambahkan kontrak data bersama untuk hasil resolusi logo, misalnya:

- `appLogoUrl`
- `source: 'tenant' | 'global' | 'default'`
- `tenantId?: string | null`

Tujuannya bukan untuk semua consumer memakai detail source, tetapi untuk membuat jalur data eksplisit, mudah dites, dan mudah di-debug.

### 2. Service pembaca logo global

Service global tetap memakai settings yang ada sekarang:

- `LOGO_APLIKASI` untuk logo aplikasi
- `LOGO_INVOICE` tetap terpisah dan tidak dicampur dengan kebutuhan app branding

Service ini hanya bertugas membaca nilai global dari repository settings dan mengembalikan path yang sudah dinormalisasi bila tersedia.

### 3. Service pembaca logo tenant

Tambahkan service pembaca logo tenant yang hanya bekerja jika tenant context tersedia.

Tanggung jawabnya:

- menerima tenant identifier yang sudah tervalidasi dari layer atas
- membaca logo tenant dari source tenant yang berlaku di codebase
- mengembalikan `null` bila tenant tidak punya logo aplikasi

Service ini tidak boleh memutuskan fallback ke global. Ia hanya tahu cara membaca tenant-specific logo.

### 4. Logo resolver

Tambahkan resolver terpusat, misalnya `resolveAppLogo`, dengan aturan:

1. bila tenant context ada, baca tenant logo
2. bila tenant logo ada, return tenant logo
3. bila tenant logo tidak ada atau tenant context tidak tersedia, baca global logo
4. bila global logo ada, return global logo
5. selain itu, return default asset lokal

Resolver ini menjadi satu-satunya tempat yang mengetahui prioritas fallback.

### 5. Normalisasi path logo

Semua path logo dari database harus dinormalisasi sebelum dikirim ke UI:

- path selalu berbentuk absolute public path yang diawali `/`
- tidak ada consumer yang perlu menambahkan slash sendiri
- tidak ada consumer yang perlu trim string atau memperbaiki format manual

Normalisasi dilakukan di service/resolver, bukan di komponen UI.

### 6. Perbaikan kontrak hook settings

`hooks/useSettings.ts` saat ini melakukan merge terhadap respons `/api/settings/logo` secara langsung, padahal endpoint membungkus data dalam `data`.

Perubahan yang diperlukan:

- parse payload `/api/settings/logo` dengan shape yang benar
- gunakan helper `unwrapApiData` yang konsisten atau kontrak respons tunggal
- pastikan `logoAplikasi` dan `logoInvoice` benar-benar masuk ke state hook

Hook ini boleh tetap ada untuk consumer yang memang butuh general settings, tetapi tidak boleh lagi menjadi sumber bug integrasi logo.

### 7. Consumer UI yang harus dipindahkan

Semua lokasi branding yang masih memakai hardcoded logo harus berpindah ke source resolver/shared logo data.

Scope minimum yang sudah diketahui:

- `app/(customer)/login/page.tsx`
- `components/LandingPage.tsx`
- `app/kebijakan-privasi/page.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/EmployeeSidebar.tsx`

Tambahan rule:

- halaman dengan tenant context memakai resolver tenant-aware
- halaman publik tanpa tenant context memakai global fallback
- sidebar tidak lagi merender huruf awal sebagai branding utama jika logo final tersedia; fallback huruf awal hanya dipakai ketika resolver mengembalikan source `default` dan desain memang memerlukannya

### 8. API surface untuk halaman publik

Untuk halaman publik yang tidak punya tenant context tepercaya, consumer tidak perlu memaksakan pencarian tenant.

Pilihan yang dipakai di desain ini:

- halaman publik mengonsumsi global branding saja
- tenant-specific branding hanya aktif bila tenant context memang tersedia dari runtime yang sah

Ini mengikuti keputusan produk bahwa public page tanpa tenant context harus fallback ke global, bukan menebak tenant dari host/path.

## Data flow

### 1. Halaman tenant-aware

1. runtime UI atau server component memiliki tenant context
2. panggil logo resolver dengan tenant identifier
3. resolver baca tenant logo
4. bila tenant logo tidak ada, resolver baca global logo
5. UI merender hasil final

### 2. Halaman publik umum

1. page tidak memiliki tenant context
2. panggil logo resolver tanpa tenant identifier atau panggil global branding source yang setara
3. resolver langsung baca global logo
4. bila global kosong, pakai default asset
5. UI merender hasil final

### 3. Pengaturan admin

1. admin upload logo global melalui endpoint yang ada
2. service upload menyimpan public path global
3. consumer berikutnya membaca logo final dari resolver
4. branding seluruh halaman non-tenant-aware berubah otomatis tanpa hardcode baru

## Error handling

1. Jika tenant logo gagal dibaca, resolver tidak melempar error ke UI publik selama global/default masih tersedia; ia turun ke fallback berikutnya.
2. Jika global logo tidak ada, resolver wajib tetap mengembalikan default asset agar branding tidak kosong.
3. Jika path logo di database tidak valid formatnya, service melakukan normalisasi; bila tetap tidak valid, anggap tidak tersedia dan lanjut fallback.
4. Upload/delete logo global tetap mengikuti error handling endpoint yang sudah ada.

## Testing

### 1. Unit test resolver

Wajib ada test untuk tiga jalur utama:

1. return tenant logo saat tenant context tersedia dan tenant punya logo
2. return global logo saat tenant tidak punya logo atau tenant context tidak tersedia
3. return default asset saat tenant dan global logo sama-sama kosong

Tambahkan juga test normalisasi path bila service menerima path tanpa leading slash.

### 2. Unit test hook/parser settings

Tambahkan test yang membuktikan:

1. payload `/api/settings/logo` dengan wrapper `data` berhasil diparse
2. `logoAplikasi` dan `logoInvoice` benar masuk ke state hasil merge
3. shape respons yang tidak sesuai tidak silently merusak state

### 3. Consumer regression test

Tambahkan test ringan untuk consumer paling penting:

- sidebar memakai logo final jika tersedia
- login customer tidak lagi hardcode `logo-sbl.png`
- halaman publik utama memakai fallback global/default sesuai kontrak

Fokus test adalah memastikan consumer memakai source hasil resolusi, bukan lagi path statis lokal.

## Dampak arsitektur

Perubahan ini tetap mengikuti modular monolith:

- repository membaca data settings/tenant
- service membaca sumber data spesifik
- resolver memutuskan prioritas bisnis
- API atau UI layer hanya mengonsumsi hasil

Yang harus dihindari:

- komponen UI melakukan fallback sendiri
- komponen UI membangun path logo manual
- akses repository tenant langsung dari UI
- logika prioritas tenant/global tersebar di banyak file

## Rencana implementasi tingkat tinggi

1. Perkenalkan kontrak dan resolver logo aplikasi terpusat.
2. Perbaiki parser payload di `hooks/useSettings.ts`.
3. Migrasikan consumer internal utama: sidebar admin dan karyawan.
4. Migrasikan consumer publik yang masih hardcode logo.
5. Tambahkan test resolver, hook, dan regression test consumer inti.

## Risiko utama

1. Source tenant logo mungkin belum punya abstraction yang rapi; implementasi harus mengikuti source tenant yang benar-benar sudah ada, bukan menebak schema baru.
2. Bila consumer lama mencampur SSR dan CSR secara tidak konsisten, migrasi logo bisa memunculkan perbedaan initial render; resolver harus dipasang sesuai konteks halaman.
3. Jika ada halaman lain yang masih hardcode logo tetapi belum terdeteksi, pencarian usage perlu dijalankan kembali saat implementasi.

## Keputusan eksplisit

1. Source of truth branding aplikasi tidak lagi hardcoded asset path di komponen.
2. Fallback order bersifat baku: `tenant -> global -> default asset`.
3. Halaman publik tanpa tenant context tidak mencoba inferensi tenant dari host atau path.
4. `logoInvoice` tetap dipakai khusus untuk invoice/print use cases dan tidak dicampur dengan branding aplikasi umum.
