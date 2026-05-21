-- CreateEnum: PayrollRunStatus
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATING', 'CALCULATED', 'AUDITED', 'APPROVED', 'PAID', 'CLOSED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum: PayrollRunType
CREATE TYPE "PayrollRunType" AS ENUM ('REGULAR', 'THR', 'BONUS', 'RAPEL', 'ADVANCE');

-- CreateEnum: PayrollEntryStatus
CREATE TYPE "PayrollEntryStatus" AS ENUM ('PENDING', 'CALCULATED', 'ERROR', 'APPROVED', 'PAID');

-- CreateEnum: PayrollEmployeeType
CREATE TYPE "PayrollEmployeeType" AS ENUM ('PKWTT', 'PKWT', 'DAILY', 'FREELANCE');

-- CreateEnum: TaxMethod
CREATE TYPE "TaxMethod" AS ENUM ('NET', 'GROSS_UP', 'NETT');

-- CreateEnum: PayFrequency
CREATE TYPE "PayFrequency" AS ENUM ('MONTHLY', 'BI_WEEKLY', 'WEEKLY', 'DAILY', 'ON_DEMAND');

-- CreateEnum: ComponentCategory
CREATE TYPE "ComponentCategory" AS ENUM ('EARNING', 'DEDUCTION', 'TAX', 'EMPLOYER_COST');

-- CreateEnum: ComponentCalcType
CREATE TYPE "ComponentCalcType" AS ENUM ('FIXED', 'PERCENTAGE', 'FORMULA', 'PER_HOUR', 'PER_DAY', 'PER_UNIT');

-- CreateEnum: PayrollPeriodStatus
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'PROCESSING', 'CLOSED', 'LOCKED');

-- CreateEnum: SalaryAdvanceStatus
CREATE TYPE "SalaryAdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'DISBURSED', 'DEDUCTED', 'REJECTED');

-- CreateEnum: DeductionMethod
CREATE TYPE "DeductionMethod" AS ENUM ('FULL_NEXT', 'INSTALLMENT');

-- CreateEnum: PaymentBatchStatus
CREATE TYPE "PaymentBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED');

-- CreateEnum: PaymentItemStatus
CREATE TYPE "PaymentItemStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRY');

-- CreateTable: pay_schedule_v2
CREATE TABLE "pay_schedule_v2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "PayFrequency" NOT NULL,
    "cutOffDay" INTEGER,
    "cutOffDayOfWeek" INTEGER,
    "payDay" INTEGER NOT NULL,
    "payDayOffset" INTEGER,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 3,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_schedule_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_period_v2
CREATE TABLE "payroll_period_v2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "unlockReason" TEXT,
    "unlockCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_period_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_run_v2
CREATE TABLE "payroll_run_v2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "type" "PayrollRunType" NOT NULL DEFAULT 'REGULAR',
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "totalEntries" INTEGER NOT NULL DEFAULT 0,
    "totalNetSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEmployerCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_run_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_entry_v2
CREATE TABLE "payroll_entry_v2" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeType" "PayrollEmployeeType" NOT NULL,
    "taxMethod" "TaxMethod" NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "effectiveSalary" DOUBLE PRECISION NOT NULL,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "PayrollEntryStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "calculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_entry_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_line_v2
CREATE TABLE "payroll_line_v2" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "componentId" TEXT,
    "componentCode" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "category" "ComponentCategory" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "formula" TEXT,
    "metadata" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "payroll_line_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_component_v2
CREATE TABLE "payroll_component_v2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "ComponentCategory" NOT NULL,
    "calculationType" "ComponentCalcType" NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "applicableTo" "PayrollEmployeeType"[],
    "isStatutory" BOOLEAN NOT NULL DEFAULT false,
    "formula" TEXT,
    "defaultAmount" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_component_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_payroll_profile_v2
CREATE TABLE "employee_payroll_profile_v2" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeType" "PayrollEmployeeType" NOT NULL,
    "taxMethod" "TaxMethod" NOT NULL DEFAULT 'NET',
    "payScheduleId" TEXT NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "payPeriodDay" INTEGER NOT NULL DEFAULT 25,
    "ptkpStatus" TEXT NOT NULL DEFAULT 'TK_0',
    "npwp" TEXT,
    "bpjsKesehatan" BOOLEAN NOT NULL DEFAULT true,
    "bpjsJht" BOOLEAN NOT NULL DEFAULT true,
    "bpjsJp" BOOLEAN NOT NULL DEFAULT true,
    "bpjsJkk" BOOLEAN NOT NULL DEFAULT true,
    "bpjsJkm" BOOLEAN NOT NULL DEFAULT true,
    "regionCode" TEXT NOT NULL,
    "contractStart" TIMESTAMP(3) NOT NULL,
    "contractEnd" TIMESTAMP(3),
    "overtimeEligible" BOOLEAN NOT NULL DEFAULT true,
    "thrEligible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_payroll_profile_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_component_v2
CREATE TABLE "employee_component_v2" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_component_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable: salary_advance_v2
CREATE TABLE "salary_advance_v2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "SalaryAdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "deductionMethod" "DeductionMethod" NOT NULL DEFAULT 'FULL_NEXT',
    "installmentCount" INTEGER,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "rejectionReason" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_advance_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable: regional_minimum_wage_v2
CREATE TABLE "regional_minimum_wage_v2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "regionName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "dailyAmount" DOUBLE PRECISION,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regional_minimum_wage_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_audit_log_v2
CREATE TABLE "payroll_audit_log_v2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "reason" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "payroll_audit_log_v2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: pay_schedule_v2
CREATE UNIQUE INDEX "pay_schedule_v2_tenantId_name_key" ON "pay_schedule_v2"("tenantId", "name");
CREATE INDEX "pay_schedule_v2_tenantId_idx" ON "pay_schedule_v2"("tenantId");

-- CreateIndex: payroll_period_v2
CREATE INDEX "payroll_period_v2_tenantId_idx" ON "payroll_period_v2"("tenantId");
CREATE INDEX "payroll_period_v2_scheduleId_idx" ON "payroll_period_v2"("scheduleId");
CREATE INDEX "payroll_period_v2_status_idx" ON "payroll_period_v2"("status");

-- CreateIndex: payroll_run_v2
CREATE INDEX "payroll_run_v2_tenantId_idx" ON "payroll_run_v2"("tenantId");
CREATE INDEX "payroll_run_v2_scheduleId_idx" ON "payroll_run_v2"("scheduleId");
CREATE INDEX "payroll_run_v2_status_idx" ON "payroll_run_v2"("status");
CREATE INDEX "payroll_run_v2_tenantId_periodStart_periodEnd_idx" ON "payroll_run_v2"("tenantId", "periodStart", "periodEnd");

-- CreateIndex: payroll_entry_v2
CREATE UNIQUE INDEX "payroll_entry_v2_payrollRunId_userId_key" ON "payroll_entry_v2"("payrollRunId", "userId");
CREATE INDEX "payroll_entry_v2_tenantId_idx" ON "payroll_entry_v2"("tenantId");
CREATE INDEX "payroll_entry_v2_payrollRunId_idx" ON "payroll_entry_v2"("payrollRunId");
CREATE INDEX "payroll_entry_v2_userId_idx" ON "payroll_entry_v2"("userId");

-- CreateIndex: payroll_line_v2
CREATE INDEX "payroll_line_v2_entryId_idx" ON "payroll_line_v2"("entryId");
CREATE INDEX "payroll_line_v2_tenantId_idx" ON "payroll_line_v2"("tenantId");

-- CreateIndex: payroll_component_v2
CREATE UNIQUE INDEX "payroll_component_v2_tenantId_code_key" ON "payroll_component_v2"("tenantId", "code");
CREATE INDEX "payroll_component_v2_tenantId_idx" ON "payroll_component_v2"("tenantId");
CREATE INDEX "payroll_component_v2_tenantId_category_idx" ON "payroll_component_v2"("tenantId", "category");

-- CreateIndex: employee_payroll_profile_v2
CREATE UNIQUE INDEX "employee_payroll_profile_v2_userId_key" ON "employee_payroll_profile_v2"("userId");
CREATE UNIQUE INDEX "employee_payroll_profile_v2_userId_tenantId_key" ON "employee_payroll_profile_v2"("userId", "tenantId");
CREATE INDEX "employee_payroll_profile_v2_tenantId_idx" ON "employee_payroll_profile_v2"("tenantId");
CREATE INDEX "employee_payroll_profile_v2_tenantId_employeeType_idx" ON "employee_payroll_profile_v2"("tenantId", "employeeType");
CREATE INDEX "employee_payroll_profile_v2_payScheduleId_idx" ON "employee_payroll_profile_v2"("payScheduleId");

-- CreateIndex: employee_component_v2
CREATE UNIQUE INDEX "employee_component_v2_profileId_componentId_key" ON "employee_component_v2"("profileId", "componentId");
CREATE INDEX "employee_component_v2_tenantId_idx" ON "employee_component_v2"("tenantId");

-- CreateIndex: salary_advance_v2
CREATE INDEX "salary_advance_v2_tenantId_idx" ON "salary_advance_v2"("tenantId");
CREATE INDEX "salary_advance_v2_userId_idx" ON "salary_advance_v2"("userId");
CREATE INDEX "salary_advance_v2_status_idx" ON "salary_advance_v2"("status");

-- CreateIndex: regional_minimum_wage_v2
CREATE UNIQUE INDEX "regional_minimum_wage_v2_tenantId_regionCode_year_key" ON "regional_minimum_wage_v2"("tenantId", "regionCode", "year");
CREATE INDEX "regional_minimum_wage_v2_tenantId_idx" ON "regional_minimum_wage_v2"("tenantId");

-- CreateIndex: payroll_audit_log_v2
CREATE INDEX "payroll_audit_log_v2_tenantId_idx" ON "payroll_audit_log_v2"("tenantId");
CREATE INDEX "payroll_audit_log_v2_entityType_entityId_idx" ON "payroll_audit_log_v2"("entityType", "entityId");
CREATE INDEX "payroll_audit_log_v2_performedBy_idx" ON "payroll_audit_log_v2"("performedBy");

-- AddForeignKey: pay_schedule_v2
ALTER TABLE "pay_schedule_v2" ADD CONSTRAINT "pay_schedule_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: payroll_period_v2
ALTER TABLE "payroll_period_v2" ADD CONSTRAINT "payroll_period_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_period_v2" ADD CONSTRAINT "payroll_period_v2_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "pay_schedule_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_period_v2" ADD CONSTRAINT "payroll_period_v2_lockedBy_fkey" FOREIGN KEY ("lockedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: payroll_run_v2
ALTER TABLE "payroll_run_v2" ADD CONSTRAINT "payroll_run_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_run_v2" ADD CONSTRAINT "payroll_run_v2_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "pay_schedule_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_run_v2" ADD CONSTRAINT "payroll_run_v2_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: payroll_entry_v2
ALTER TABLE "payroll_entry_v2" ADD CONSTRAINT "payroll_entry_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_entry_v2" ADD CONSTRAINT "payroll_entry_v2_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_run_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_entry_v2" ADD CONSTRAINT "payroll_entry_v2_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: payroll_line_v2
ALTER TABLE "payroll_line_v2" ADD CONSTRAINT "payroll_line_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_line_v2" ADD CONSTRAINT "payroll_line_v2_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "payroll_entry_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_line_v2" ADD CONSTRAINT "payroll_line_v2_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "payroll_component_v2"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: payroll_component_v2
ALTER TABLE "payroll_component_v2" ADD CONSTRAINT "payroll_component_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: employee_payroll_profile_v2
ALTER TABLE "employee_payroll_profile_v2" ADD CONSTRAINT "employee_payroll_profile_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_payroll_profile_v2" ADD CONSTRAINT "employee_payroll_profile_v2_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_payroll_profile_v2" ADD CONSTRAINT "employee_payroll_profile_v2_payScheduleId_fkey" FOREIGN KEY ("payScheduleId") REFERENCES "pay_schedule_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: employee_component_v2
ALTER TABLE "employee_component_v2" ADD CONSTRAINT "employee_component_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_component_v2" ADD CONSTRAINT "employee_component_v2_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "employee_payroll_profile_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_component_v2" ADD CONSTRAINT "employee_component_v2_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "payroll_component_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: salary_advance_v2
ALTER TABLE "salary_advance_v2" ADD CONSTRAINT "salary_advance_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salary_advance_v2" ADD CONSTRAINT "salary_advance_v2_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salary_advance_v2" ADD CONSTRAINT "salary_advance_v2_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: regional_minimum_wage_v2
ALTER TABLE "regional_minimum_wage_v2" ADD CONSTRAINT "regional_minimum_wage_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: payroll_audit_log_v2
ALTER TABLE "payroll_audit_log_v2" ADD CONSTRAINT "payroll_audit_log_v2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_audit_log_v2" ADD CONSTRAINT "payroll_audit_log_v2_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
