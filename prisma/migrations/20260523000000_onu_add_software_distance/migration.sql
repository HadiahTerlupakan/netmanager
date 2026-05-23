-- Tambah field softwareVersion dan distance di onu_devices
-- untuk SNMP discovery yang lebih lengkap (vendor info + jarak fiber).

ALTER TABLE "onu_devices"
  ADD COLUMN IF NOT EXISTS "softwareVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "distance" INTEGER;
