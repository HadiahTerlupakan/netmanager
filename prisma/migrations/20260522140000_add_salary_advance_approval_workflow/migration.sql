-- Add salary advance and approval workflow support

-- Add AUTO_SALARY and AUTO_SALARY_ADVANCE to JournalSource enum
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_SALARY';
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_SALARY_ADVANCE';

-- Add CAPEX to COASubtype enum
ALTER TYPE "COASubtype" ADD VALUE IF NOT EXISTS 'CAPEX';

-- Create payroll approval workflow table
CREATE TABLE "payroll_approval_workflow" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "autoApproveThreshold" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_approval_workflow_pkey" PRIMARY KEY ("id")
);

-- Create unique index on payrollRunId
CREATE UNIQUE INDEX "payroll_approval_workflow_payrollRunId_key" ON "payroll_approval_workflow"("payrollRunId");

-- Create indexes
CREATE INDEX "payroll_approval_workflow_tenantId_idx" ON "payroll_approval_workflow"("tenantId");
CREATE INDEX "payroll_approval_workflow_status_idx" ON "payroll_approval_workflow"("status");

-- Add foreign keys
ALTER TABLE "payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_run_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
