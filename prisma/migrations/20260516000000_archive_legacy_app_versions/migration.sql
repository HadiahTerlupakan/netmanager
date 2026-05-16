-- Hapus FK constraints dari app_versions agar Prisma model legacy tidak butuh
-- relasi ke User/Tenant. Tabel sengaja TIDAK di-rename supaya migration lama
-- (init_tenant_schema) yang masih reference "app_versions" via psql backfill
-- tetap bisa jalan.
--
-- Modul app-version legacy dihapus dari kode; tabel ini disimpan apa adanya
-- untuk audit/arsip. Schema baru (Expo Updates) pakai tabel app_updates.

ALTER TABLE "app_versions" DROP CONSTRAINT IF EXISTS "app_versions_createdBy_fkey";
ALTER TABLE "app_versions" DROP CONSTRAINT IF EXISTS "app_versions_tenantId_fkey";

-- Tambah kolom apkHash agar konsisten dengan schema lama yang punya field ini.
ALTER TABLE "app_versions" ADD COLUMN IF NOT EXISTS "apkHash" TEXT;
