-- ============================================
-- OLT Module: Evolve from TEXT-based to ENUM-based, restructure command logs
-- ============================================
-- This migration is idempotent (safe to re-apply on envs that already evolved
-- via db push or manual SQL) and non-destructive (uses ALTER TYPE ... USING
-- to preserve existing data).
--
-- IMPORTANT: This migration FAILS LOUD if production data contains values
-- outside the target enums. That is intentional. Silent failure here would
-- leave the DB in a half-migrated state and cause runtime crashes in the app.
-- If a pre-flight check fails, fix the data with explicit UPDATE statements
-- (added BEFORE the relevant ALTER TYPE) and re-run.
-- ============================================

-- ---------------------------------------------
-- 1. Create enums (no-op if already exist)
-- ---------------------------------------------
DO $$ BEGIN
    CREATE TYPE "OltVendor" AS ENUM ('ZTE', 'HSGQ', 'HIOSO', 'CDATA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "OltStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'OFFLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "OnuStatus" AS ENUM ('UNREGISTERED', 'REGISTERED', 'ACTIVE', 'OFFLINE', 'DISABLED', 'LOS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "OltCommandResult" AS ENUM ('SUCCESS', 'FAILED', 'TIMEOUT', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "PreRegStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------
-- 2. olt_devices.vendor: TEXT -> OltVendor
-- ---------------------------------------------
DO $$
DECLARE
    col_type text;
    bad_values text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'olt_devices' AND column_name = 'vendor';

    IF col_type = 'text' THEN
        SELECT string_agg(DISTINCT quote_literal(vendor), ', ')
        INTO bad_values
        FROM "olt_devices"
        WHERE vendor IS NOT NULL
          AND vendor NOT IN ('ZTE', 'HSGQ', 'HIOSO', 'CDATA');

        IF bad_values IS NOT NULL THEN
            RAISE EXCEPTION 'olt_devices.vendor contains values outside OltVendor enum: %. Add explicit UPDATE mapping before this migration.', bad_values;
        END IF;

        ALTER TABLE "olt_devices"
            ALTER COLUMN "vendor" DROP DEFAULT,
            ALTER COLUMN "vendor" TYPE "OltVendor" USING "vendor"::"OltVendor";
    END IF;
END $$;

-- ---------------------------------------------
-- 3. olt_devices.status: TEXT -> OltStatus
-- ---------------------------------------------
DO $$
DECLARE
    col_type text;
    bad_values text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'olt_devices' AND column_name = 'status';

    IF col_type = 'text' THEN
        SELECT string_agg(DISTINCT quote_literal(status), ', ')
        INTO bad_values
        FROM "olt_devices"
        WHERE status IS NOT NULL
          AND status NOT IN ('ACTIVE', 'MAINTENANCE', 'OFFLINE');

        IF bad_values IS NOT NULL THEN
            RAISE EXCEPTION 'olt_devices.status contains values outside OltStatus enum: %. Add explicit UPDATE mapping before this migration.', bad_values;
        END IF;

        ALTER TABLE "olt_devices"
            ALTER COLUMN "status" DROP DEFAULT,
            ALTER COLUMN "status" TYPE "OltStatus" USING "status"::"OltStatus",
            ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
    END IF;
END $$;

-- olt_devices.snmpPort: nullable -> not null (backfill nulls first)
UPDATE "olt_devices" SET "snmpPort" = 161 WHERE "snmpPort" IS NULL;
ALTER TABLE "olt_devices" ALTER COLUMN "snmpPort" SET NOT NULL;

-- olt_devices.totalPonPorts: drop default (kept NOT NULL)
ALTER TABLE "olt_devices" ALTER COLUMN "totalPonPorts" DROP DEFAULT;

-- ---------------------------------------------
-- 4. onu_devices.status: TEXT -> OnuStatus
-- ---------------------------------------------
DO $$
DECLARE
    col_type text;
    bad_values text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'onu_devices' AND column_name = 'status';

    IF col_type = 'text' THEN
        SELECT string_agg(DISTINCT quote_literal(status), ', ')
        INTO bad_values
        FROM "onu_devices"
        WHERE status IS NOT NULL
          AND status NOT IN ('UNREGISTERED', 'REGISTERED', 'ACTIVE', 'OFFLINE', 'DISABLED', 'LOS');

        IF bad_values IS NOT NULL THEN
            RAISE EXCEPTION 'onu_devices.status contains values outside OnuStatus enum: %. Add explicit UPDATE mapping before this migration.', bad_values;
        END IF;

        ALTER TABLE "onu_devices"
            ALTER COLUMN "status" DROP DEFAULT,
            ALTER COLUMN "status" TYPE "OnuStatus" USING "status"::"OnuStatus",
            ALTER COLUMN "status" SET DEFAULT 'UNREGISTERED';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "onu_devices_pelangganId_idx" ON "onu_devices"("pelangganId");
CREATE INDEX IF NOT EXISTS "onu_devices_status_idx" ON "onu_devices"("status");

-- ---------------------------------------------
-- 5. onu_pre_registrations.status: TEXT -> PreRegStatus
-- ---------------------------------------------
DO $$
DECLARE
    col_type text;
    bad_values text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'onu_pre_registrations' AND column_name = 'status';

    IF col_type = 'text' THEN
        SELECT string_agg(DISTINCT quote_literal(status), ', ')
        INTO bad_values
        FROM "onu_pre_registrations"
        WHERE status IS NOT NULL
          AND status NOT IN ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED');

        IF bad_values IS NOT NULL THEN
            RAISE EXCEPTION 'onu_pre_registrations.status contains values outside PreRegStatus enum: %. Add explicit UPDATE mapping before this migration.', bad_values;
        END IF;

        ALTER TABLE "onu_pre_registrations"
            ALTER COLUMN "status" DROP DEFAULT,
            ALTER COLUMN "status" TYPE "PreRegStatus" USING "status"::"PreRegStatus",
            ALTER COLUMN "status" SET DEFAULT 'PENDING';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "onu_pre_registrations_tenantId_status_idx" ON "onu_pre_registrations"("tenantId", "status");

-- ---------------------------------------------
-- 6. olt_command_logs: rename createdAt -> executedAt, evolve columns
-- ---------------------------------------------

-- 6a. Rename createdAt -> executedAt (idempotent)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'olt_command_logs' AND column_name = 'createdAt'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'olt_command_logs' AND column_name = 'executedAt'
    ) THEN
        ALTER TABLE "olt_command_logs" RENAME COLUMN "createdAt" TO "executedAt";
    END IF;
END $$;

-- 6b. params: nullable -> not null
-- NOTE: Backfilling NULL with '{}'::jsonb changes semantics from "no params"
-- to "empty params object". Verified safe because the application code does
-- not branch on `params IS NULL` — it always reads params as an object.
UPDATE "olt_command_logs" SET "params" = '{}'::jsonb WHERE "params" IS NULL;
ALTER TABLE "olt_command_logs" ALTER COLUMN "params" SET NOT NULL;

-- 6c. result: TEXT -> OltCommandResult
DO $$
DECLARE
    col_type text;
    bad_values text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'olt_command_logs' AND column_name = 'result';

    IF col_type = 'text' THEN
        SELECT string_agg(DISTINCT quote_literal(result), ', ')
        INTO bad_values
        FROM "olt_command_logs"
        WHERE result IS NOT NULL
          AND result NOT IN ('SUCCESS', 'FAILED', 'TIMEOUT', 'PENDING');

        IF bad_values IS NOT NULL THEN
            RAISE EXCEPTION 'olt_command_logs.result contains values outside OltCommandResult enum: %. Add explicit UPDATE mapping before this migration.', bad_values;
        END IF;

        ALTER TABLE "olt_command_logs"
            ALTER COLUMN "result" DROP DEFAULT,
            ALTER COLUMN "result" TYPE "OltCommandResult" USING "result"::"OltCommandResult";
    END IF;
END $$;

-- 6d. Drop FK on oltId (no longer modeled as relation in Prisma schema)
ALTER TABLE "olt_command_logs" DROP CONSTRAINT IF EXISTS "olt_command_logs_oltId_fkey";

-- 6e. Drop old index, add new ones
DROP INDEX IF EXISTS "olt_command_logs_tenantId_createdAt_idx";
CREATE INDEX IF NOT EXISTS "olt_command_logs_tenantId_executedAt_idx" ON "olt_command_logs"("tenantId", "executedAt");
CREATE INDEX IF NOT EXISTS "olt_command_logs_onuId_idx" ON "olt_command_logs"("onuId");

-- 6f. Add FK on onuId -> onu_devices
DO $$ BEGIN
    ALTER TABLE "olt_command_logs"
        ADD CONSTRAINT "olt_command_logs_onuId_fkey"
        FOREIGN KEY ("onuId") REFERENCES "onu_devices"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
