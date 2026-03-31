-- AlterTable: Add checkInDate column for date-only duplicate prevention
ALTER TABLE "Attendance" ADD COLUMN "checkInDate" TIMESTAMP(3);

-- Backfill: Set checkInDate from checkIn (date-only, no time component)
UPDATE "Attendance" SET "checkInDate" = DATE_TRUNC('day', "checkIn") WHERE "checkInDate" IS NULL;

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

-- CreateIndex
CREATE UNIQUE INDEX "idx_attendance_user_checkin_date_tenant" ON "Attendance"("userId", "checkInDate", "tenantId");
