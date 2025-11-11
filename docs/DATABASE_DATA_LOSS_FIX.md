# Fix: Data Hilang Setelah Menjalankan Tests

## 🚨 Masalah

Data user dan data lainnya hilang setelah menjalankan tests. Ini terjadi karena:

1. **Tests menggunakan database yang sama dengan development**
   - `testPrisma` di `lib/test-utils.ts` menggunakan `DATABASE_URL` jika `TEST_DATABASE_URL` tidak di-set
   - `cleanupTestDatabase()` menghapus **SEMUA** data setelah tests selesai

2. **Cleanup otomatis setelah tests**
   - `tests/setup.ts` memiliki `afterAll` yang memanggil `cleanupTestDatabase()`
   - Function ini menghapus semua data: users, OLTs, ODPs, ODCs, dll

## ✅ Solusi

### Opsi 1: Setup Test Database Terpisah (RECOMMENDED)

**1. Tambahkan `TEST_DATABASE_URL` di `.env`:**

```env
# Development Database
DATABASE_URL=postgresql://netmgr:netmgr@localhost:5433/netmanager?schema=public

# Test Database (TERPISAH!)
TEST_DATABASE_URL=postgresql://netmgr:netmgr@localhost:5433/netmanager_test?schema=public
```

**2. Buat test database:**

```bash
# Connect ke PostgreSQL
psql -h localhost -p 5433 -U netmgr -d postgres

# Create test database
CREATE DATABASE netmanager_test;

# Exit
\q
```

**3. Run migrations di test database:**

```bash
# Set TEST_DATABASE_URL untuk migration
TEST_DATABASE_URL="postgresql://netmgr:netmgr@localhost:5433/netmanager_test?schema=public" npx prisma migrate deploy
```

**4. Update `lib/test-utils.ts` untuk safety check:**

```typescript
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
  log: process.env.DEBUG ? ['query', 'error', 'warn'] : ['error'],
})

// Safety check: Jangan hapus data jika tidak menggunakan test database
export async function cleanupTestDatabase() {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  
  // Safety check: Jangan hapus data development database
  if (!process.env.TEST_DATABASE_URL) {
    console.warn('⚠️  WARNING: TEST_DATABASE_URL tidak di-set!')
    console.warn('⚠️  Tests akan menggunakan DATABASE_URL (development database)')
    console.warn('⚠️  Cleanup akan menghapus SEMUA data di development database!')
    console.warn('⚠️  Setup TEST_DATABASE_URL untuk menghindari kehilangan data!')
    
    // Tanya konfirmasi (hanya di development, bukan di CI)
    if (process.env.NODE_ENV !== 'test' && !process.env.CI) {
      throw new Error(
        'TEST_DATABASE_URL tidak di-set! ' +
        'Setup test database terpisah untuk menghindari kehilangan data development.'
      )
    }
  }
  
  // ... existing cleanup code ...
}
```

---

### Opsi 2: Disable Auto-Cleanup (TIDAK RECOMMENDED)

**Hapus atau comment `afterAll` di `tests/setup.ts`:**

```typescript
// Cleanup setelah semua tests
// afterAll(async () => {
//   // Cleanup test database
//   await cleanupTestDatabase()
// })
```

**⚠️ Catatan:** Ini akan menyebabkan data leak antar tests, tapi tidak akan menghapus data development.

---

### Opsi 3: Conditional Cleanup (RECOMMENDED)

**Update `tests/setup.ts` untuk hanya cleanup jika menggunakan test database:**

```typescript
// Cleanup setelah semua tests
afterAll(async () => {
  // Hanya cleanup jika menggunakan test database
  if (process.env.TEST_DATABASE_URL) {
    await cleanupTestDatabase()
  } else {
    console.warn('⚠️  TEST_DATABASE_URL tidak di-set, skip cleanup untuk menghindari kehilangan data')
  }
})
```

---

## 🔧 Implementasi Fix (Recommended)

Saya akan mengimplementasikan **Opsi 1 + Opsi 3** untuk safety maksimal:

1. ✅ Update `lib/test-utils.ts` dengan safety check
2. ✅ Update `tests/setup.ts` dengan conditional cleanup
3. ✅ Update `.env.example` dengan `TEST_DATABASE_URL`
4. ✅ Update dokumentasi

---

## 📋 Checklist Setup Test Database

- [ ] Tambahkan `TEST_DATABASE_URL` di `.env`
- [ ] Buat test database: `CREATE DATABASE netmanager_test;`
- [ ] Run migrations di test database
- [ ] Verify tests menggunakan test database
- [ ] Verify development database tidak terhapus

---

## 🚀 Quick Fix (Sekarang)

Jika data sudah hilang dan Anda perlu restore:

1. **Cek apakah ada backup:**
```bash
ls -la backups/
```

2. **Restore dari backup:**
```bash
./scripts/restore-db.sh backups/netmanager_YYYYMMDD_HHMMSS.sql.gz
```

3. **Atau restore dari Prisma migrations:**
```bash
# Reset database dan re-run migrations
npx prisma migrate reset

# Re-seed jika ada seed data
npm run prisma:seed
```

---

## ⚠️ Prevention

Untuk mencegah masalah ini di masa depan:

1. **SELALU setup `TEST_DATABASE_URL`** sebelum menjalankan tests
2. **Jangan jalankan tests di production database**
3. **Gunakan backup sebelum menjalankan tests** jika ragu-ragu
4. **Review test setup** sebelum merge ke main branch

---

**Status:** Fix akan diimplementasikan sekarang untuk mencegah masalah ini di masa depan.

