-- =============================================================
-- Idempotent SQL script to complete partially-applied migration
-- 20260326004412_sync_schema_changes
-- 
-- This script is safe to run multiple times. Each statement
-- uses IF EXISTS / IF NOT EXISTS guards.
-- =============================================================

BEGIN;

-- =====================
-- 1. Drop old indexes (idempotent with IF EXISTS)
-- =====================
DROP INDEX IF EXISTS "Bandwidth_name_key";
DROP INDEX IF EXISTS "Coupon_code_key";
DROP INDEX IF EXISTS "HargaPaket_name_siteId_key";
DROP INDEX IF EXISTS "MikroTikRouter_ipAddress_key";
DROP INDEX IF EXISTS "Pelanggan_idPelanggan_key";
DROP INDEX IF EXISTS "Shift_code_key";
DROP INDEX IF EXISTS "acs_wifi_security_productClass_key";
DROP INDEX IF EXISTS "assets_kodeAsset_key";
DROP INDEX IF EXISTS "barang_kode_key";
DROP INDEX IF EXISTS "departments_name_key";
DROP INDEX IF EXISTS "gudang_kode_key";
DROP INDEX IF EXISTS "purchase_orders_poNumber_key";
DROP INDEX IF EXISTS "purchase_requests_nomorRequest_key";
DROP INDEX IF EXISTS "salary_components_name_key";
DROP INDEX IF EXISTS "support_tickets_ticketNumber_idx";
DROP INDEX IF EXISTS "support_tickets_ticketNumber_key";
DROP INDEX IF EXISTS "work_orders_workOrderNumber_idx";
DROP INDEX IF EXISTS "work_orders_workOrderNumber_key";

-- =====================
-- 2. Drop column (idempotent)
-- =====================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Investor' AND column_name = 'password'
  ) THEN
    ALTER TABLE "Investor" DROP COLUMN "password";
  END IF;
END $$;

-- =====================
-- 3. Add new columns (idempotent)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ProfilePPP' AND column_name = 'poolMode'
  ) THEN
    ALTER TABLE "ProfilePPP" ADD COLUMN "poolMode" TEXT DEFAULT 'MIKROTIK';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'isAttendanceRequired'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "isAttendanceRequired" BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'barang' AND column_name = 'minStokDefault'
  ) THEN
    ALTER TABLE "barang" ADD COLUMN "minStokDefault" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_order_items' AND column_name = 'receivedQuantity'
  ) THEN
    ALTER TABLE "purchase_order_items" ADD COLUMN "receivedQuantity" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'fotoBukti'
  ) THEN
    ALTER TABLE "purchase_orders" ADD COLUMN "fotoBukti" TEXT[];
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'barang_masuk' AND column_name = 'actorType'
  ) THEN
    ALTER TABLE "barang_masuk" ADD COLUMN "actorType" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'barang_masuk' AND column_name = 'actorId'
  ) THEN
    ALTER TABLE "barang_masuk" ADD COLUMN "actorId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'barang_keluar' AND column_name = 'actorType'
  ) THEN
    ALTER TABLE "barang_keluar" ADD COLUMN "actorType" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'barang_keluar' AND column_name = 'actorId'
  ) THEN
    ALTER TABLE "barang_keluar" ADD COLUMN "actorId" TEXT;
  END IF;
END $$;

-- =====================
-- 4. Create new unique indexes (idempotent)
-- =====================
CREATE UNIQUE INDEX IF NOT EXISTS "Bandwidth_name_tenantId_key" ON "Bandwidth"("name", "tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_tenantId_code_key" ON "Coupon"("tenantId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_tenantId_name_key" ON "ExpenseCategory"("tenantId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "HargaPaket_tenantId_name_siteId_key" ON "HargaPaket"("tenantId", "name", "siteId");
CREATE UNIQUE INDEX IF NOT EXISTS "MikroTikRouter_tenantId_ipAddress_key" ON "MikroTikRouter"("tenantId", "ipAddress");
CREATE INDEX IF NOT EXISTS "Pelanggan_userId_idx" ON "Pelanggan"("userId");
CREATE INDEX IF NOT EXISTS "Pelanggan_odpId_idx" ON "Pelanggan"("odpId");
CREATE INDEX IF NOT EXISTS "Pelanggan_syncStatus_idx" ON "Pelanggan"("syncStatus");
CREATE UNIQUE INDEX IF NOT EXISTS "Pelanggan_tenantId_idPelanggan_key" ON "Pelanggan"("tenantId", "idPelanggan");
CREATE UNIQUE INDEX IF NOT EXISTS "ProfilePPP_name_tenantId_key" ON "ProfilePPP"("name", "tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "Shift_tenantId_code_key" ON "Shift"("tenantId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "acs_wifi_security_tenantId_productClass_key" ON "acs_wifi_security"("tenantId", "productClass");
CREATE UNIQUE INDEX IF NOT EXISTS "assets_tenantId_kodeAsset_key" ON "assets"("tenantId", "kodeAsset");
CREATE UNIQUE INDEX IF NOT EXISTS "barang_tenantId_kode_key" ON "barang"("tenantId", "kode");
CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_tenantId_key" ON "departments"("name", "tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "gudang_tenantId_kode_key" ON "gudang"("tenantId", "kode");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_tenantId_poNumber_key" ON "purchase_orders"("tenantId", "poNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_requests_tenantId_nomorRequest_key" ON "purchase_requests"("tenantId", "nomorRequest");
CREATE UNIQUE INDEX IF NOT EXISTS "salary_components_tenantId_name_key" ON "salary_components"("tenantId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_tenantId_ticketNumber_key" ON "support_tickets"("tenantId", "ticketNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "work_orders_tenantId_workOrderNumber_key" ON "work_orders"("tenantId", "workOrderNumber");

-- =====================
-- 5. Add foreign key (idempotent)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'purchase_requests_approvedBy_fkey'
      AND table_name = 'purchase_requests'
  ) THEN
    ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approvedBy_fkey"
      FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
