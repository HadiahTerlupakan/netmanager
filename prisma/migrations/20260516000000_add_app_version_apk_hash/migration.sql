-- Add SHA-256 hash for APK integrity verification (used by mobile OTA download flow)
ALTER TABLE "app_versions" ADD COLUMN IF NOT EXISTS "apkHash" TEXT;
