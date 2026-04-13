-- CreateTable: AttendanceEvaluation
CREATE TABLE IF NOT EXISTS "AttendanceEvaluation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "finalStatus" "AttendanceStatus" NOT NULL,
    "reviewState" TEXT NOT NULL,
    "rawPresenceState" TEXT,
    "workMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutesApproved" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutesHeld" INTEGER NOT NULL DEFAULT 0,
    "payrollHoldState" TEXT NOT NULL DEFAULT 'NONE',
    "holidayState" TEXT,
    "leaveState" TEXT,
    "scheduleState" TEXT,
    "evidenceQuality" TEXT,
    "reasonCodes" JSONB NOT NULL DEFAULT '[]',
    "anomalyCodes" JSONB NOT NULL DEFAULT '[]',
    "sourceRefs" JSONB NOT NULL DEFAULT '{}',
    "evaluationVersion" INTEGER NOT NULL DEFAULT 1,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceEvaluation_tenantId_userId_workDate_key"
ON "AttendanceEvaluation"("tenantId", "userId", "workDate");

CREATE INDEX IF NOT EXISTS "AttendanceEvaluation_tenantId_workDate_idx"
ON "AttendanceEvaluation"("tenantId", "workDate");

CREATE INDEX IF NOT EXISTS "AttendanceEvaluation_tenantId_reviewState_idx"
ON "AttendanceEvaluation"("tenantId", "reviewState");

DO $$ BEGIN
  ALTER TABLE "AttendanceEvaluation"
    ADD CONSTRAINT "AttendanceEvaluation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'constraint AttendanceEvaluation_tenantId_fkey already exists, skipping';
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceEvaluation"
    ADD CONSTRAINT "AttendanceEvaluation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'constraint AttendanceEvaluation_userId_fkey already exists, skipping';
END $$;

-- CreateTable: AttendanceEvaluationAudit
CREATE TABLE IF NOT EXISTS "AttendanceEvaluationAudit" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "action" TEXT NOT NULL,
    "previousSnapshot" JSONB,
    "nextSnapshot" JSONB,
    "reason" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "evaluationVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvaluationAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AttendanceEvaluationAudit_tenantId_workDate_idx"
ON "AttendanceEvaluationAudit"("tenantId", "workDate");

CREATE INDEX IF NOT EXISTS "AttendanceEvaluationAudit_evaluationId_idx"
ON "AttendanceEvaluationAudit"("evaluationId");

DO $$ BEGIN
  ALTER TABLE "AttendanceEvaluationAudit"
    ADD CONSTRAINT "AttendanceEvaluationAudit_evaluationId_fkey"
    FOREIGN KEY ("evaluationId") REFERENCES "AttendanceEvaluation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'constraint AttendanceEvaluationAudit_evaluationId_fkey already exists, skipping';
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceEvaluationAudit"
    ADD CONSTRAINT "AttendanceEvaluationAudit_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'constraint AttendanceEvaluationAudit_tenantId_fkey already exists, skipping';
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceEvaluationAudit"
    ADD CONSTRAINT "AttendanceEvaluationAudit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'constraint AttendanceEvaluationAudit_userId_fkey already exists, skipping';
END $$;
