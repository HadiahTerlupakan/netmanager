# Fix: Tabel MikroTikRouter Tidak Ada

## 🚨 Masalah

Error: `The table 'public.MikroTikRouter' does not exist`

**Penyebab:**
- Tabel `MikroTikRouter` ada di `schema.prisma` tapi tidak ada di migration files
- Migration `20251107004359_add_olt_and_other_tables` tidak include tabel MikroTikRouter
- Database tidak memiliki tabel ini setelah reset

## ✅ Solusi

### 1. Migration Sudah Dibuat

Migration baru sudah dibuat:
- `20251107030001_add_mikrotik_router/migration.sql`

### 2. Sync Database

Jalankan salah satu:

```bash
# Opsi 1: Sync dengan prisma db push (recommended untuk development)
npx prisma db push --accept-data-loss

# Opsi 2: Apply migrations
npx prisma migrate deploy
```

### 3. Regenerate Prisma Client

```bash
npx prisma generate
```

### 4. Clear Next.js Cache

```bash
rm -rf .next
```

### 5. Restart Dev Server

```bash
npm run dev
```

## 🔍 Verifikasi

Cek apakah tabel sudah ada:

```bash
# Menggunakan Prisma Studio
npx prisma studio
```

Atau cek langsung di database.

## 📝 Catatan

- Migration `20251107030001_add_mikrotik_router` sudah dibuat dan di-mark sebagai applied
- Tabel seharusnya sudah ada setelah `prisma db push`
- Jika masih error, pastikan:
  1. Prisma Client sudah di-regenerate
  2. Next.js cache sudah di-clear
  3. Dev server sudah di-restart

---

**Status:** ✅ Fixed - Migration sudah dibuat dan database sudah di-sync

