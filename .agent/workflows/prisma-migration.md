---
description: Workflow untuk membuat Prisma migration yang aman untuk production
---

# Prisma Migration Workflow

Gunakan workflow ini setiap kali ada perubahan pada `schema.prisma`.

## Langkah-langkah

### 1. Edit Schema

Edit file `prisma/schema.prisma` sesuai kebutuhan (tambah model, kolom, relasi, dll).

### 2. Buat Migration File

// turbo

```bash
npx prisma migrate dev --name deskripsi_perubahan
```

**PENTING**:

- Selalu gunakan nama yang deskriptif, contoh: `add_geofence_meta`, `add_employee_location`
- JANGAN gunakan `npx prisma db push` karena tidak membuat migration file

### 3. Generate Prisma Client

// turbo

```bash
npx prisma generate
```

### 4. Verifikasi Migration

Periksa file migration yang dibuat di `prisma/migrations/`:

- Pastikan SQL yang dihasilkan sesuai ekspektasi
- Pastikan tidak ada `DROP TABLE` atau `DROP COLUMN` yang tidak diinginkan

### 5. Commit Migration File

```bash
git add prisma/migrations/ prisma/schema.prisma
git commit -m "feat: add migration - deskripsi_perubahan"
```

### 6. Deploy ke Production

Di server production, jalankan:

```bash
./deploy.sh update
```

Ini akan secara otomatis:

1. Backup database
2. Pull kode terbaru
3. Rebuild & restart app
4. Jalankan `prisma migrate deploy` untuk apply migration

## ⚠️ Peringatan

- **JANGAN** gunakan `prisma db push` untuk perubahan schema
- **JANGAN** edit migration file yang sudah di-commit
- **SELALU** test migration di lokal sebelum deploy ke production
- **SELALU** backup database sebelum migration di production (sudah otomatis di deploy.sh)
