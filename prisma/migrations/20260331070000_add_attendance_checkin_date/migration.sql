-- AlterTable: Add checkInDate column for date-only duplicate prevention
ALTER TABLE "Attendance" ADD COLUMN "checkInDate" TIMESTAMP(3);

-- Backfill: Set checkInDate from checkIn (date-only, no time component)
UPDATE "Attendance" SET "checkInDate" = DATE_TRUNC('day', "checkIn") WHERE "checkInDate" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "idx_attendance_user_checkin_date_tenant" ON "Attendance"("userId", "checkInDate", "tenantId");
