-- Tambah field telnetEnablePass, defaultSlotFrame, defaultSlot di olt_devices
-- untuk dukungan ZTE multi-slot OLT (C300, C600/650).

ALTER TABLE "olt_devices"
  ADD COLUMN IF NOT EXISTS "telnetEnablePass" TEXT,
  ADD COLUMN IF NOT EXISTS "defaultSlotFrame" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "defaultSlot" INTEGER NOT NULL DEFAULT 1;
