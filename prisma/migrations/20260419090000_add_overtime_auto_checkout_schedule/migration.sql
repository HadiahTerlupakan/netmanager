-- CreateEnum: OvertimeAutoCheckoutScheduleStatus
CREATE TYPE "OvertimeAutoCheckoutScheduleStatus" AS ENUM (
    'SCHEDULED',
    'COMPLETED',
    'CANCELLED',
    'FAILED'
);

-- CreateTable: OvertimeAutoCheckoutSchedule
CREATE TABLE "OvertimeAutoCheckoutSchedule" (
    "id" TEXT NOT NULL,
    "overtimeId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "jobId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "scheduleStatus" "OvertimeAutoCheckoutScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeAutoCheckoutSchedule_pkey" PRIMARY KEY ("id")
);

-- Unique and indexes
CREATE UNIQUE INDEX "OvertimeAutoCheckoutSchedule_overtimeId_key"
ON "OvertimeAutoCheckoutSchedule"("overtimeId");

CREATE INDEX "OvertimeAutoCheckoutSchedule_scheduleStatus_scheduledFor_idx"
ON "OvertimeAutoCheckoutSchedule"("scheduleStatus", "scheduledFor");

CREATE INDEX "OvertimeAutoCheckoutSchedule_jobId_idx"
ON "OvertimeAutoCheckoutSchedule"("jobId");

-- Foreign key
ALTER TABLE "OvertimeAutoCheckoutSchedule"
ADD CONSTRAINT "OvertimeAutoCheckoutSchedule_overtimeId_fkey"
FOREIGN KEY ("overtimeId") REFERENCES "Overtime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
