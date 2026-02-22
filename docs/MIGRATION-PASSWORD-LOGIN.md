# Rencana Migrasi Penghapusan \`passwordLogin\` (Plaintext Password)

## Latar Belakang
Saat ini sistem pelanggan menyimpan password dalam bentuk teks murni (plaintext) di kolom \`passwordLogin\` pada tabel \`Pelanggan\`. Praktik ini berisiko tinggi terhadap keamanan data dan harus dihilangkan, mengingat sistem sudah memiliki dan mendukung mekanisme hashing (\`passwordHash\`).

## Analisis Dampak & Temuan
Kolom \`passwordLogin\` saat ini terintegrasi erat dengan beberapa komponen sistem:
1. **Admin UI (\`app/admin/pelanggan/**\`)**: Menampilkan dan mengedit password secara langsung sebagai teks.
2. **Mobile API (\`app/api/mobile/auth/login/route.ts\`)**: Menggunakan pengecekan \`passwordLogin === password\` sebagai skenario *fallback* jika hash tidak cocok.
3. **Seeders & Tests**: Bergantung pada nilai plaintext yang di-hardcode.

## Rencana Eksekusi (3 Fase)

### Fase 1: Perombakan UI Admin & Service Layer
- **Tujuan**: Admin tidak lagi dapat melihat password pengguna. Mengubah form edit password menjadi mode "Reset Password" satu arah.
- **Tindakan**:
  - Hapus field input `passwordLogin` dari tampilan detail dan edit pelanggan.
  - Ubah skema validasi `Zod` di form admin agar tidak menampilkan/mewajibkan `passwordLogin`.
  - Di layer service (`PelangganService.ts`), berikan nilai default "TERENKRIPSI" atau abaikan update `passwordLogin`, fokus hanya pada pembuatan dan pembaruan `passwordHash`.

### Fase 2: Perbaikan Skema Mobile Auth
- **Tujuan**: Mematikan jalur login *fallback* yang tidak aman.
- **Tindakan**:
  - Hapus pengecekan manual `if (customer.passwordLogin === password)` di API mobile.
  - Pastikan semua pelanggan memiliki `passwordHash`. Jika ada akun lama yang hanya memiliki `passwordLogin` (belum di-hash), jalankan skrip migrasi untuk meng-hash password tersebut.

### Fase 3: Penghapusan Kolom dari Skema Database
- **Tujuan**: Membersihkan database dan Prisma schema secara permanen.
- **Tindakan**:
  - Ubah `passwordLogin` di `prisma/schema.prisma` menjadi opsional (`String?`), lalu buat PR/migration Prisma.
  - Hapus semua *mapping* `passwordLogin` dari *Repository* dan *DTO*.
  - (Tahap akhir) Hapus kolom dari skema Prisma sepenuhnya.

---

**Status Saat Ini:** Menunggu persetujuan eksekusi Fase 1.
