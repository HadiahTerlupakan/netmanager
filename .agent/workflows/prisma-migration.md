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
- JANGAN buat folder dengan nama generic seperti `manual` di `prisma/migrations/` - akan dianggap sebagai migration!
- Format nama migration: `YYYYMMDDHHMMSS_deskripsi_perubahan`

### 3. Generate Prisma Client

// turbo

```bash
npx prisma generate
```

### 4. Verifikasi Migration

Periksa file migration yang dibuat di `prisma/migrations/`:

- Pastikan SQL yang dihasilkan sesuai ekspektasi
- Pastikan tidak ada `DROP TABLE` atau `DROP COLUMN` yang tidak diinginkan
- **(RECOMMENDED)** Modifikasi SQL agar **Idempotent** (Aman dijalankan ulang) jika ada resiko drift di production:

### 4a. Teknik Idempotent (Safe Migration)

**Menambah Kolom:**
Gunakan `IF NOT EXISTS` untuk menghindari error jika kolom sudah ada.

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "newColumn" TEXT;
```

**Menghapus Kolom/Tabel:**
Gunakan `IF EXISTS` untuk menghindari error jika object sudah terhapus.

```sql
ALTER TABLE "User" DROP COLUMN IF EXISTS "legacyColumn";
DROP TABLE IF EXISTS "LegacyTable";
```

**Menambah Value Enum:**
Gunakan block PL/pgSQL untuk menangani duplicate value.

```sql
DO $$
BEGIN
    ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
```

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

- **JANGAN** gunakan `prisma db push` untuk perubahan schema di production
- **JANGAN** edit migration file yang sudah di-commit
- **SELALU** test migration di lokal sebelum deploy ke production
- **SELALU** backup database sebelum migration di production (sudah otomatis di deploy.sh)

---

## 🔧 Troubleshooting: Database Drift

### Apa itu Drift?

Drift terjadi ketika database schema tidak sinkron dengan migration history. Penyebab:

- Migration dijalankan manual di database
- Migration file dimodifikasi setelah di-apply
- Sync antar environment berbeda

### Cara Handle Drift

**1. Development Environment:**

```bash
# Langsung sync schema ke database (tanpa migration file)
npx prisma db push
```

**2. Production Environment:**

```bash
# Cek status migration
npx prisma migrate status

# Jika ada migration yang sudah ada di DB tapi belum di-mark applied:
npx prisma migrate resolve --applied <migration_name>

# Contoh:
npx prisma migrate resolve --applied 20260112014810_sync_schema_drift

# Kemudian deploy migration baru
npx prisma migrate deploy
```

**3. Reset Drift (Development Only):**

```bash
# Baseline seluruh state database saat ini
npx prisma migrate resolve --rolled-back <migration_name>
npx prisma migrate dev --name sync_drift
```

### ❌ JANGAN LAKUKAN

- Jangan gunakan `db push` di production
- Jangan resolve migration yang belum selesai di-apply
- Jangan hapus migration folder di production
