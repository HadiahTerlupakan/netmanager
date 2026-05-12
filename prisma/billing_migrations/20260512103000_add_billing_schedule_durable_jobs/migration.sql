-- @safe-guard-ack: BillingSchedule durable job migration must survive additive drift on staging/prod where billing DB cannot be reset.

-- Create or align enum BillingScheduleJobType.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'BillingScheduleJobType'
  ) THEN
    CREATE TYPE "BillingScheduleJobType" AS ENUM (
      'INVOICE_MARK_OVERDUE',
      'CUSTOMER_AUTO_ISOLIR'
    );
  END IF;
END $$;

ALTER TYPE "BillingScheduleJobType" ADD VALUE IF NOT EXISTS 'INVOICE_MARK_OVERDUE';
ALTER TYPE "BillingScheduleJobType" ADD VALUE IF NOT EXISTS 'CUSTOMER_AUTO_ISOLIR';

-- Create or align enum BillingScheduleStatus.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'BillingScheduleStatus'
  ) THEN
    CREATE TYPE "BillingScheduleStatus" AS ENUM (
      'PENDING',
      'QUEUED',
      'PROCESSING',
      'COMPLETED',
      'CANCELLED',
      'FAILED'
    );
  END IF;
END $$;

ALTER TYPE "BillingScheduleStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "BillingScheduleStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "BillingScheduleStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "BillingScheduleStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "BillingScheduleStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "BillingScheduleStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- Create table when absent.
DO $$
BEGIN
  IF to_regclass('public."BillingSchedule"') IS NULL THEN
    CREATE TABLE "BillingSchedule" (
      "id" TEXT NOT NULL,
      "dedupeKey" TEXT NOT NULL,
      "jobType" "BillingScheduleJobType" NOT NULL,
      "invoiceId" TEXT,
      "pelangganId" TEXT,
      "runAt" TIMESTAMP(3) NOT NULL,
      "status" "BillingScheduleStatus" NOT NULL DEFAULT 'PENDING',
      "queueJobId" TEXT,
      "payload" JSONB,
      "version" INTEGER NOT NULL DEFAULT 1,
      "attemptCount" INTEGER NOT NULL DEFAULT 0,
      "queuedAt" TIMESTAMP(3),
      "processingAt" TIMESTAMP(3),
      "completedAt" TIMESTAMP(3),
      "cancelledAt" TIMESTAMP(3),
      "failedAt" TIMESTAMP(3),
      "lastAttemptAt" TIMESTAMP(3),
      "lastError" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "tenantId" TEXT,
      CONSTRAINT "BillingSchedule_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

-- Reject ambiguous partial table states that cannot be repaired safely in-place.
DO $$
DECLARE
  missing_required_columns TEXT[];
BEGIN
  SELECT ARRAY_AGG(required.column_name ORDER BY required.column_name)
  INTO missing_required_columns
  FROM (
    VALUES
      ('id'),
      ('dedupeKey'),
      ('jobType'),
      ('runAt'),
      ('updatedAt')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BillingSchedule'
      AND column_name = required.column_name
  );

  IF missing_required_columns IS NOT NULL THEN
    RAISE EXCEPTION
      'BillingSchedule table already exists but is missing required columns: %',
      array_to_string(missing_required_columns, ', ');
  END IF;
END $$;

-- Add additive/defaultable columns if a drifted table already exists.
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "pelangganId" TEXT;
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "status" "BillingScheduleStatus" DEFAULT 'PENDING';
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "queueJobId" TEXT;
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "payload" JSONB;
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER DEFAULT 0;
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMP(3);
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "processingAt" TIMESTAMP(3);
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "BillingSchedule" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- Normalize defaultable columns before hardening nullability/defaults.
UPDATE "BillingSchedule"
SET "status" = 'PENDING'
WHERE "status" IS NULL;

UPDATE "BillingSchedule"
SET "version" = 1
WHERE "version" IS NULL;

UPDATE "BillingSchedule"
SET "attemptCount" = 0
WHERE "attemptCount" IS NULL;

UPDATE "BillingSchedule"
SET "createdAt" = CURRENT_TIMESTAMP
WHERE "createdAt" IS NULL;

ALTER TABLE "BillingSchedule"
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "version" SET DEFAULT 1,
ALTER COLUMN "version" SET NOT NULL,
ALTER COLUMN "attemptCount" SET DEFAULT 0,
ALTER COLUMN "attemptCount" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "createdAt" SET NOT NULL;

-- Ensure the existing table is not carrying impossible nulls in core columns.
DO $$
DECLARE
  invalid_core_rows BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO invalid_core_rows
  FROM "BillingSchedule"
  WHERE "id" IS NULL
     OR "dedupeKey" IS NULL
     OR "jobType" IS NULL
     OR "runAt" IS NULL
     OR "updatedAt" IS NULL;

  IF invalid_core_rows > 0 THEN
    RAISE EXCEPTION
      'BillingSchedule contains % row(s) with null core columns (id, dedupeKey, jobType, runAt, updatedAt); manual reconciliation required before continuing',
      invalid_core_rows;
  END IF;
END $$;

-- Reject duplicate dedupe keys with a clear error before creating the unique index.
DO $$
DECLARE
  duplicate_dedupe_key TEXT;
BEGIN
  SELECT "dedupeKey"
  INTO duplicate_dedupe_key
  FROM "BillingSchedule"
  GROUP BY "dedupeKey"
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_dedupe_key IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot create BillingSchedule_dedupeKey_key; duplicate dedupeKey=%',
      duplicate_dedupe_key;
  END IF;
END $$;

-- Reject orphan invoice references before adding the foreign key.
DO $$
DECLARE
  orphan_invoice_id TEXT;
BEGIN
  SELECT schedule."invoiceId"
  INTO orphan_invoice_id
  FROM "BillingSchedule" AS schedule
  LEFT JOIN "Invoice" AS invoice ON invoice."id" = schedule."invoiceId"
  WHERE schedule."invoiceId" IS NOT NULL
    AND invoice."id" IS NULL
  LIMIT 1;

  IF orphan_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot add BillingSchedule_invoiceId_fkey; orphan invoiceId=%',
      orphan_invoice_id;
  END IF;
END $$;

-- Primary key should already exist for a drifted table; if not, stop with a clear error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public."BillingSchedule"'::regclass
      AND conname = 'BillingSchedule_pkey'
  ) THEN
    RAISE EXCEPTION
      'BillingSchedule table exists without BillingSchedule_pkey; manual reconciliation required before continuing';
  END IF;
END $$;

-- Create indexes idempotently.
CREATE UNIQUE INDEX IF NOT EXISTS "BillingSchedule_dedupeKey_key"
  ON "BillingSchedule"("dedupeKey");

CREATE INDEX IF NOT EXISTS "BillingSchedule_jobType_runAt_idx"
  ON "BillingSchedule"("jobType", "runAt");

CREATE INDEX IF NOT EXISTS "BillingSchedule_status_runAt_idx"
  ON "BillingSchedule"("status", "runAt");

CREATE INDEX IF NOT EXISTS "BillingSchedule_invoiceId_idx"
  ON "BillingSchedule"("invoiceId");

CREATE INDEX IF NOT EXISTS "BillingSchedule_pelangganId_idx"
  ON "BillingSchedule"("pelangganId");

CREATE INDEX IF NOT EXISTS "BillingSchedule_queueJobId_idx"
  ON "BillingSchedule"("queueJobId");

CREATE INDEX IF NOT EXISTS "BillingSchedule_tenantId_idx"
  ON "BillingSchedule"("tenantId");

-- Add the foreign key only when absent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public."BillingSchedule"'::regclass
      AND conname = 'BillingSchedule_invoiceId_fkey'
  ) THEN
    ALTER TABLE "BillingSchedule"
      ADD CONSTRAINT "BillingSchedule_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
