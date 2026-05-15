-- Rename app_versions ke app_versions_legacy (arsip data lama).
-- Modul app-version legacy dihapus, OTA flow pindah ke app_updates (Expo Updates).
-- Tabel ini disimpan untuk audit/rollback dan tidak punya FK lagi.

-- Drop foreign keys yang merefensi app_versions
ALTER TABLE "app_versions" DROP CONSTRAINT IF EXISTS "app_versions_createdBy_fkey";
ALTER TABLE "app_versions" DROP CONSTRAINT IF EXISTS "app_versions_tenantId_fkey";

-- Tambah kolom apkHash agar konsisten dengan schema baru (nullable, untuk arsip)
ALTER TABLE "app_versions" ADD COLUMN IF NOT EXISTS "apkHash" TEXT;

-- Rename tabel
ALTER TABLE "app_versions" RENAME TO "app_versions_legacy";

-- Rename existing indexes agar prisma migrate engine senang
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'app_versions_isActive_idx') THEN
    ALTER INDEX "app_versions_isActive_idx" RENAME TO "app_versions_legacy_isActive_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'app_versions_platform_idx') THEN
    ALTER INDEX "app_versions_platform_idx" RENAME TO "app_versions_legacy_platform_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'app_versions_versionCode_idx') THEN
    ALTER INDEX "app_versions_versionCode_idx" RENAME TO "app_versions_legacy_versionCode_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'app_versions_tenantId_idx') THEN
    ALTER INDEX "app_versions_tenantId_idx" RENAME TO "app_versions_legacy_tenantId_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'app_versions_version_key') THEN
    ALTER INDEX "app_versions_version_key" RENAME TO "app_versions_legacy_version_key";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'app_versions_versionCode_key') THEN
    ALTER INDEX "app_versions_versionCode_key" RENAME TO "app_versions_legacy_versionCode_key";
  END IF;
END $$;
