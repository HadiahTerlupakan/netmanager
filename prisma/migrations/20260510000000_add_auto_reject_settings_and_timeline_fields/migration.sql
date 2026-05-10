-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "autoRejectInsufficientQuota" BOOLEAN NOT NULL DEFAULT true,
    "autoRejectBackdate" BOOLEAN NOT NULL DEFAULT true,
    "autoRejectOverlap" BOOLEAN NOT NULL DEFAULT true,
    "autoRejectTooLong" BOOLEAN NOT NULL DEFAULT true,
    "autoRejectSakitNoDocument" BOOLEAN NOT NULL DEFAULT true,
    "autoRejectCutiNoAdvance" BOOLEAN NOT NULL DEFAULT true,
    "autoRejectTukarLiburNoDate" BOOLEAN NOT NULL DEFAULT true,
    "autoRejectBlackoutPeriod" BOOLEAN NOT NULL DEFAULT true,
    "maxDaysPerRequest" INTEGER NOT NULL DEFAULT 14,
    "minAdvanceNoticeDays" INTEGER NOT NULL DEFAULT 3,
    "sakitDocumentRequiredDays" INTEGER NOT NULL DEFAULT 2,
    "blackoutPeriods" JSONB NOT NULL DEFAULT '[]',
    "enableTimelineAutoReject" BOOLEAN NOT NULL DEFAULT true,
    "mendadakDeadlineHours" INTEGER NOT NULL DEFAULT 8,
    "mendadakReminder1Hours" INTEGER NOT NULL DEFAULT 4,
    "mendadakReminder2Hours" INTEGER NOT NULL DEFAULT 6,
    "normalDeadlineDays" INTEGER NOT NULL DEFAULT 1,
    "normalReminder1Days" INTEGER NOT NULL DEFAULT 3,
    "normalReminder2Days" INTEGER NOT NULL DEFAULT 2,
    "advanceDeadlineDays" INTEGER NOT NULL DEFAULT 1,
    "advanceReminder1Days" INTEGER NOT NULL DEFAULT 7,
    "advanceReminder2Days" INTEGER NOT NULL DEFAULT 3,
    "advanceReminder3Days" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable LeaveRequest - Add new columns if not exists
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "firstReminderSentAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "secondReminderSentAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "finalReminderSentAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "autoRejectedAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "autoRejectionReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'TenantSettings_tenantId_fkey'
    ) THEN
        ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
