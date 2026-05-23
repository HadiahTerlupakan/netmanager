-- Tambah field slot, slotFrame, description di onu_devices
-- untuk dukung multi-slot OLT (C300) dan label deskripsi dari OLT.

ALTER TABLE "onu_devices"
  ADD COLUMN IF NOT EXISTS "slotFrame" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "slot" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "description" TEXT;
