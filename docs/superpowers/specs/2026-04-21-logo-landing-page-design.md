# Desain Fitur Logo Landing Page

## Ringkasan
Tambahkan slot logo baru khusus landing page tanpa memindahkan pengelolaan logo ke menu lain. Halaman `Pengaturan Logo` tetap menjadi pusat input logo, tetapi sekarang memiliki tiga jenis logo terpisah: invoice, aplikasi, dan landing page.

## Tujuan
- Menyediakan logo khusus untuk landing page public.
- Menjaga `Logo Aplikasi` tetap dipakai untuk area aplikasi internal.
- Menjaga semua input logo tetap berada di satu menu admin.
- Menyediakan fallback ke logo default bawaan ketika logo landing page belum diisi.

## Ruang Lingkup
### Termasuk
- Menambah tipe logo baru `landing` pada alur pengaturan logo.
- Menambah key setting `LOGO_LANDING_PAGE`.
- Menambah field `logoLandingPage` pada payload pengaturan logo admin.
- Menambah field public branding `landingLogoUrl`.
- Menambah blok UI `Logo Landing Page` pada halaman `Pengaturan Logo`.
- Mengubah landing page utama agar memakai `landingLogoUrl`.
- Menambah atau menyesuaikan test terkait service, API, dan resolusi branding.

### Tidak termasuk
- Mengubah perilaku `Logo Aplikasi` di sidebar, header internal, login customer, atau halaman kebijakan privasi.
- Menambah editor crop, resize, atau variant image.
- Menambah fallback ke `Logo Aplikasi` untuk landing page.

## Desain Data dan Backend
### Setting baru
Tambahkan key setting baru:
- `LOGO_LANDING_PAGE`

### Tipe logo
Perluas `LogoType` dari:
- `invoice | aplikasi`

menjadi:
- `invoice | aplikasi | landing`

### Payload service admin
`getLogoSettings()` mengembalikan:
- `logoInvoice`
- `logoAplikasi`
- `logoLandingPage`

### Upload dan delete logo
Endpoint `POST /api/settings/logo` dan `DELETE /api/settings/logo` tetap dipakai. Input `type` ditambah nilai `landing`.

Penyimpanan file mengikuti pola yang sudah ada di `modules/settings/services/logoSettings.ts`, dengan nama file yang konsisten untuk logo landing page.

### Public branding
Endpoint public settings menambah field:
- `landingLogoUrl`

Field ini khusus dipakai landing page public.

## Desain UI Admin
Halaman `app/admin/pengaturan/logo/LogoSettingsClient.tsx` tetap menjadi satu halaman pengelolaan logo, tetapi memiliki tiga blok:

1. `Logo Invoice`
2. `Logo Aplikasi`
3. `Logo Landing Page`

Setiap blok memiliki pola yang sama:
- preview gambar
- tombol upload/ganti logo
- tombol hapus logo
- deskripsi fungsi logo

Deskripsi `Logo Landing Page` harus menjelaskan bahwa logo ini hanya dipakai di halaman landing/public utama.

State client ditambah:
- `logoLandingPage`
- `previewLandingPage`

Flow upload dan delete menggunakan endpoint yang sama dengan tipe `landing`.

## Integrasi Landing Page
Landing page utama di `app/page.tsx` harus menggunakan urutan resolusi berikut:
1. `landingLogoUrl` jika tersedia
2. `DEFAULT_PUBLIC_APP_LOGO_URL` jika `landingLogoUrl` kosong atau tidak ada

`Logo Aplikasi` tetap dipakai oleh area aplikasi internal.

## Error Handling
Validasi file mengikuti aturan yang sudah berlaku saat ini:
- hanya file gambar
- ukuran maksimum 5MB

Jika upload gagal, preview untuk slot landing page kembali ke state tersimpan terakhir, mengikuti pola perilaku blok logo lain.

## Testing
Tambahkan atau sesuaikan test untuk memastikan:
- service logo membaca dan menulis `LOGO_LANDING_PAGE`
- API logo menerima `type=landing` untuk upload dan delete
- payload public settings menyertakan `landingLogoUrl`
- landing page memakai `landingLogoUrl` dan fallback ke logo default bawaan jika kosong
- perubahan ini tidak mengubah perilaku `Logo Aplikasi` yang dipakai area internal

## Dampak Perubahan
Perubahan tetap terlokalisasi di area pengaturan logo dan branding public. Tidak perlu memecah menu admin atau menambah service baru terpisah.

## Keputusan Desain
Pendekatan yang dipilih adalah menambah setting baru `LOGO_LANDING_PAGE` dalam service logo yang sudah ada.

Alasan:
- paling konsisten dengan arsitektur sekarang
- tidak menyebar logika upload logo ke banyak tempat
- UI tetap sederhana bagi admin
- tanggung jawab `Logo Aplikasi` dan `Logo Landing Page` tetap jelas terpisah
