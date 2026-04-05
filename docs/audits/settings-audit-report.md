# Laporan Audit Menu Pengaturan Admin

## Ringkasan Eksekutif
Audit lanjutan settings (2026-04-05) mengeksekusi remediation terarah pada layer API dan UI tanpa mengubah kontrak endpoint publik. Fokus utama adalah konsistensi boundary settings, deduplikasi logic route admin, dan pengurangan smell pada komponen ACS tab.

---

## 1. Temuan Keamanan (Kritikal) 🚨
### Celah Isolasi Tenant (Tenant Isolation Breach)
- **Lokasi**: `app/api/admin/settings/email/route.ts` dan `app/api/admin/settings/whatsapp/route.ts`.
- **Status**: ✅ **DITUTUP**.
- **Perbaikan**: Kedua route sekarang memakai shared helper `getTenantSettingsMap` dan `upsertTenantSettings` (modul `modules/settings/services/tenantSettings.ts`) yang selalu memaksa scope `tenantId` saat read/write.
- **Dampak**: Isolasi data tenant untuk pengaturan email/WhatsApp konsisten di satu jalur service.

### Metadata Enkripsi Hilang
- **Lokasi**: API WhatsApp.
- **Status**: ✅ **DITUTUP**.
- **Perbaikan**: Upsert WhatsApp tetap menyimpan API key dalam bentuk terenkripsi dengan metadata `encrypted: true`; dekripsi baca juga disatukan via helper service tenant settings.
- **Dampak**: Konsistensi enkripsi at-rest dan dekripsi read-path meningkat.

---

## 2. Temuan UI/UX (Medium) 🎨
### Refactoring Komponen Besar
- **File prioritas eksekusi saat ini**: `app/admin/pengaturan/acs/VendorConfigTab.tsx`.
- **Status**: ⚠️ **PARSIAL**.
- **Perbaikan yang sudah dilakukan**:
  - Hilangkan `any` pada state utama (`vendors`, `wifiConfigs`, modal state) dengan tipe eksplisit.
  - Ekstraksi helper request lokal (`fetchAcsList`, `saveAcsResource`, `deleteAcsResource`) untuk mengurangi duplikasi alur mutation.
  - Perbaikan aksesibilitas form (association `label` ↔ `input`) dan explicit button types.
- **Catatan residual**: `VendorConfigTab` masih menggabungkan dua domain (vendors + wifi-security) dalam satu file dan tetap kandidat split lanjutan.

### Inkonsistensi Library Ikon
- **Masalah**: Campuran antara `react-icons/hi2`, `lucide-react`, dan SVG mentah.
- **Status**: ⏸️ Belum menjadi fokus wave ini.

### Penggunaan Tailwind yang Berlebihan
- **Masalah**: Banyak inline class yang panjang dan redundan pada input form.
- **Status**: ⏸️ Belum menjadi fokus wave ini.

---

## 3. Temuan Izin & Akses (Low) 🔐
- **Masalah**: Pengecekan izin (`hasPermission`) sudah ada, namun tidak cukup kuat tanpa isolasi data di level database.
- **Status**: ✅ Diperkuat pada endpoint settings email/whatsapp melalui tenant-scoped service helper.

### Drift Kontrak Settings Public API
- **Lokasi**: `app/api/settings/public/route.ts`.
- **Masalah awal**: endpoint membaca key legacy (`general`, `logo`) sementara flow settings aktif memakai key granular (`GENERAL_*`, `LOGO_*`).
- **Status**: ✅ **DITUTUP**.
- **Perbaikan**: route sekarang mendelegasikan ke `getPublicPortalSettings` (`modules/settings/services/publicPortalSettings.ts`) yang membaca key granular canonical.
- **Dampak**: Konsistensi kontrak data public settings meningkat tanpa mengubah response shape.

---

## Langkah Selanjutnya (Action Plan)
1. **Prio 1 (Done)**: Tenant-scoped shared settings helper untuk endpoint Email & WhatsApp.
2. **Prio 2 (Done)**: Konsolidasi pembacaan public settings ke key granular canonical.
3. **Prio 3 (In Progress)**: Lanjut split `VendorConfigTab` menjadi dua tab component terpisah (`VendorsTabContent` dan `WifiConfigTabContent`) agar boundary UI lebih jelas.
4. **Prio 4 (Planned)**: Hardening route backup settings (`/api/settings/backup/*`) agar lebih thin-controller melalui service orchestration.
