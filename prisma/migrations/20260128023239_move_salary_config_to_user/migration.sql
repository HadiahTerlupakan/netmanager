-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('KARYAWAN', 'MITRA');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('FIXED', 'PER_HOUR', 'PERCENTAGE', 'DAILY_SALARY');

-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('DRAFT', 'CALCULATED', 'AUDITED', 'APPROVED', 'PAID', 'REVISED');

-- CreateEnum
CREATE TYPE "SalaryComponentType" AS ENUM ('EARNING', 'DEDUCTION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "absentDeductionRate" DOUBLE PRECISION,
ADD COLUMN     "basicSalary" DOUBLE PRECISION,
ADD COLUMN     "employeeType" "EmployeeType" NOT NULL DEFAULT 'KARYAWAN',
ADD COLUMN     "lateDeductionRate" DOUBLE PRECISION,
ADD COLUMN     "overtimeCalcTypeHoliday" "RateType" NOT NULL DEFAULT 'PER_HOUR',
ADD COLUMN     "overtimeCalcTypeNational" "RateType" NOT NULL DEFAULT 'PER_HOUR',
ADD COLUMN     "overtimeCalcTypeNormal" "RateType" NOT NULL DEFAULT 'PER_HOUR',
ADD COLUMN     "overtimeRateHoliday" DOUBLE PRECISION,
ADD COLUMN     "overtimeRateNational" DOUBLE PRECISION,
ADD COLUMN     "overtimeRateNormal" DOUBLE PRECISION,
ADD COLUMN     "payDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "payPeriodDay" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "woIncentiveEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "woIncentiveRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "salaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "SalaryStatus" NOT NULL DEFAULT 'DRAFT',
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3),
    "auditedById" TEXT,
    "auditedAt" TIMESTAMP(3),
    "auditNotes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_components" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SalaryComponentType" NOT NULL,
    "rateType" "RateType" NOT NULL DEFAULT 'FIXED',
    "defaultAmount" DOUBLE PRECISION,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_details" (
    "id" TEXT NOT NULL,
    "salaryId" TEXT NOT NULL,
    "componentId" TEXT,
    "name" TEXT NOT NULL,
    "type" "SalaryComponentType" NOT NULL,
    "quantity" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "salary_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_revisions" (
    "id" TEXT NOT NULL,
    "salaryId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "revisedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_salary_components" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salaries_month_year_idx" ON "salaries"("month", "year");

-- CreateIndex
CREATE INDEX "salaries_status_idx" ON "salaries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "salaries_userId_month_year_key" ON "salaries"("userId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "salary_components_name_key" ON "salary_components"("name");

-- CreateIndex
CREATE INDEX "salary_details_salaryId_idx" ON "salary_details"("salaryId");

-- CreateIndex
CREATE INDEX "salary_revisions_salaryId_idx" ON "salary_revisions"("salaryId");

-- CreateIndex
CREATE INDEX "user_salary_components_userId_idx" ON "user_salary_components"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_salary_components_userId_componentId_key" ON "user_salary_components"("userId", "componentId");

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_auditedById_fkey" FOREIGN KEY ("auditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_details" ADD CONSTRAINT "salary_details_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "salary_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_details" ADD CONSTRAINT "salary_details_salaryId_fkey" FOREIGN KEY ("salaryId") REFERENCES "salaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_revisions" ADD CONSTRAINT "salary_revisions_salaryId_fkey" FOREIGN KEY ("salaryId") REFERENCES "salaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_salary_components" ADD CONSTRAINT "user_salary_components_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_salary_components" ADD CONSTRAINT "user_salary_components_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "salary_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;
