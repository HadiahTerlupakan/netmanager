-- Align MixRadius billing unique constraints with tenant-aware Prisma schema.
-- This migration intentionally fails with a clear error if duplicate data still exists.

-- 1. Backfill legacy rows so existing sync behavior (`tenantId || "DEFAULT"`) matches DB state.
UPDATE "mix_radius_invoices"
SET "tenantId" = 'DEFAULT'
WHERE "tenantId" IS NULL;

UPDATE "mix_radius_customers"
SET "tenantId" = 'DEFAULT'
WHERE "tenantId" IS NULL;

-- 2. Abort early if tenant-aware duplicates remain after backfill.
DO $$
DECLARE
  duplicate_invoice RECORD;
BEGIN
  SELECT
    "tenantId" AS tenant_id,
    "invoiceNumber" AS invoice_number,
    COUNT(*) AS duplicate_count
  INTO duplicate_invoice
  FROM "mix_radius_invoices"
  GROUP BY 1, 2
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_invoice IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot create mix_radius_invoices tenant unique index; duplicate tenantId=% invoiceNumber=% count=%',
      duplicate_invoice.tenant_id,
      duplicate_invoice.invoice_number,
      duplicate_invoice.duplicate_count;
  END IF;
END $$;

DO $$
DECLARE
  duplicate_customer_by_id RECORD;
BEGIN
  SELECT
    "tenantId" AS tenant_id,
    "mixRadiusId" AS mixradius_id,
    COUNT(*) AS duplicate_count
  INTO duplicate_customer_by_id
  FROM "mix_radius_customers"
  GROUP BY 1, 2
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_customer_by_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot create mix_radius_customers tenant/mixRadiusId unique index; duplicate tenantId=% mixRadiusId=% count=%',
      duplicate_customer_by_id.tenant_id,
      duplicate_customer_by_id.mixradius_id,
      duplicate_customer_by_id.duplicate_count;
  END IF;
END $$;

DO $$
DECLARE
  duplicate_customer_by_username RECORD;
BEGIN
  SELECT
    "tenantId" AS tenant_id,
    "username" AS username_value,
    COUNT(*) AS duplicate_count
  INTO duplicate_customer_by_username
  FROM "mix_radius_customers"
  GROUP BY 1, 2
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_customer_by_username IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot create mix_radius_customers tenant/username unique index; duplicate tenantId=% username=% count=%',
      duplicate_customer_by_username.tenant_id,
      duplicate_customer_by_username.username_value,
      duplicate_customer_by_username.duplicate_count;
  END IF;
END $$;

-- 3. Add tenant-aware unique indexes expected by Prisma upserts.
CREATE UNIQUE INDEX IF NOT EXISTS "mix_radius_invoices_tenantId_invoiceNumber_key"
  ON "mix_radius_invoices"("tenantId", "invoiceNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "mix_radius_customers_tenantId_mixRadiusId_key"
  ON "mix_radius_customers"("tenantId", "mixRadiusId");

CREATE UNIQUE INDEX IF NOT EXISTS "mix_radius_customers_tenantId_username_key"
  ON "mix_radius_customers"("tenantId", "username");

-- 4. Drop legacy global unique indexes that conflict with multi-tenant behavior.
DROP INDEX IF EXISTS "mix_radius_invoices_invoiceNumber_key";
DROP INDEX IF EXISTS "mix_radius_customers_mixRadiusId_key";
DROP INDEX IF EXISTS "mix_radius_customers_username_key";
