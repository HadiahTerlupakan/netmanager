# Sidebar Logo Shape Design

## Tujuan
Mengubah tampilan logo pada sidebar admin dan employee agar tidak terlihat bulat/dekoratif, sekaligus menghilangkan warning Next.js `Image fill` yang muncul karena parent belum `relative`.

## Masalah Saat Ini
- `components/layout/SidebarBrandingLogo.tsx` memakai container dekoratif dengan transform, gradient, dan bentuk visual yang terasa seperti badge bulat.
- Komponen memakai `Image fill` tetapi parent image belum memiliki positioning yang valid untuk pola `fill`.
- Setelah logo branding tenant aktif, gaya container lama membuat logo terlihat kurang natural.

## Desain yang Disetujui
Gunakan container logo berbentuk kotak dengan sudut rounded halus.

Karakteristik:
- ukuran tetap ringkas seperti sekarang agar header sidebar tidak berubah besar
- parent image memakai `relative`
- image memakai `object-contain`, bukan `object-cover`, agar logo asli tidak terpotong
- container tidak lagi memakai rotasi/dekorasi yang membuat logo terasa bulat
- fallback monogram tetap tersedia saat `logoUrl` kosong

## Dampak Komponen
### `components/layout/SidebarBrandingLogo.tsx`
- ubah wrapper utama menjadi kotak rounded halus
- pindahkan area image ke wrapper `relative`
- pertahankan API komponen: `appName`, `logoUrl`
- pertahankan fallback monogram

### `components/layout/Sidebar.tsx`
- tidak perlu ubah kontrak pemanggilan
- perubahan visual harus tetap pas di layout header sidebar saat ini

### `components/layout/EmployeeSidebar.tsx`
- otomatis ikut memakai tampilan baru karena memakai komponen yang sama

## Testing
- update/pertahankan test komponen `tests/components/layout/SidebarBrandingLogo.test.tsx`
- verifikasi typecheck tetap hijau
- verifikasi warning `Image fill` hilang setelah parent menjadi valid

## Di Luar Scope
- tidak mengubah typography/nama aplikasi di sidebar
- tidak mengubah ukuran keseluruhan header sidebar
- tidak mengubah flow branding resolver atau upload logo
