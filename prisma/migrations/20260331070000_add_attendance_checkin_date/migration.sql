-- AlterTable: Add checkInDate column for date-only duplicate prevention (idempotent)
DO $$ BEGIN
  ALTER TABLE "Attendance" ADD COLUMN "checkInDate" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'column checkInDate already exists, skipping ADD COLUMN';
END $$;

-- Backfill: Reset and recompute checkInDate to ensure clean state on re-run
UPDATE "Attendance" SET "checkInDate" = DATE_TRUNC('day', "checkIn");

-- Clean duplicates: Keep only the earliest check-in per user per day per tenant
WITH "Duplicates" AS (
  SELECT id,
         ROW_NUMBER() OVER(
             PARTITION BY "userId", "checkInDate", "tenantId"
             ORDER BY "checkIn" ASC
         ) as row_num
  FROM "Attendance"
)
DELETE FROM "Attendance" WHERE id IN (SELECT id FROM "Duplicates" WHERE row_num > 1);

-- CreateIndex (idempotent: skip if already exists)
DO $$ BEGIN
  CREATE UNIQUE INDEX "idx_attendance_user_checkin_date_tenant" ON "Attendance"("userId", "checkInDate", "tenantId");
EXCEPTION WHEN duplicate_table THEN
  RAISE NOTICE 'index idx_attendance_user_checkin_date_tenant already exists, skipping';
END $$;
