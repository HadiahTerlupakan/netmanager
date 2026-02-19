# Sidebar Admin Redesign Design Doc

Tanggal: 2026-02-19  
Status: Approved by user

## Latar Belakang

Sidebar Admin saat ini berfungsi secara logic, tetapi kualitas visual dan kenyamanan interaksinya dirasa kurang baik. Tujuan redesign adalah memperbaiki tampilan agar lebih clean-professional tanpa mengubah behavior inti menu, permission, dan routing.

## Ruang Lingkup

- Target komponen: `components/layout/Sidebar.tsx`
- Fokus: UI + UX ringan
- Prioritas: desktop dan mobile seimbang
- Out of scope: perubahan struktur informasi menu, permission model, dan konfigurasi menu

## Pendekatan Terpilih

Pendekatan yang disetujui: **Refine Existing**.

Alasan:
- Risiko regresi rendah karena struktur dan logic utama dipertahankan
- Waktu implementasi lebih cepat
- Hasil tetap signifikan pada kualitas visual, hierarchy, dan readability

## Desain yang Disetujui

### 1) Arsitektur perubahan

- Tidak mengubah logic filtering menu berbasis permission
- Tidak mengubah perilaku auto-expand, mobile toggle, dan close on route change
- Perubahan berada di layer presentasi (kelas Tailwind + visual state)

### 2) Visual komponen

- Header brand dibuat lebih tenang, kontras teks lebih jelas, dekorasi lebih subtle
- Navigation list dirapikan: spacing vertical konsisten, radius seragam, hierarchy parent/child lebih jelas
- Active state dipertegas namun tetap clean (indicator + tone warna yang jelas)
- Hover state dibuat ringan agar interaksi terasa profesional
- Profile section dibersihkan agar lebih fokus dan tidak ramai
- Visual desktop/mobile dibuat konsisten

### 3) Interaksi dan animasi ringan

- Expand/collapse submenu tetap dipakai, easing/timing dirapikan
- Parent aktif vs child aktif dibedakan visualnya
- Section header dibuat lebih terbaca untuk scanning cepat
- Focus state keyboard diperjelas untuk aksesibilitas

### 4) Verifikasi

- Cek desktop: default/hover/active/expanded state
- Cek mobile: open/close drawer, overlay click, route-change auto-close
- Cek lint/typecheck agar tidak ada error dari perubahan markup/class

## Kriteria Sukses

- Sidebar terlihat lebih rapi, konsisten, dan modern
- Navigasi lebih cepat dipindai oleh pengguna
- Tidak ada perubahan behavior fungsional menu
- Tidak ada regresi pada pengalaman mobile
