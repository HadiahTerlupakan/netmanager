-- CreateEnum
CREATE TYPE "InvestorDepositType" AS ENUM ('MODAL_AWAL', 'TAMBAHAN_MODAL', 'PINJAMAN');

-- CreateEnum
CREATE TYPE "InvestorDepositStatus" AS ENUM ('PENDING', 'VERIFIED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvestorProfitShareStatus" AS ENUM ('CALCULATED', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvestorShareMode" AS ENUM ('FIXED', 'PROPORTIONAL');

-- CreateEnum
CREATE TYPE "InvestorProfitPeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "JournalSource" ADD VALUE 'AUTO_INVESTOR_DEPOSIT';

-- CreateTable
CREATE TABLE "investor_deposits" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "depositType" "InvestorDepositType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "proofFileUrl" TEXT,
    "status" "InvestorDepositStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "journalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "investor_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_profit_shares" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "netProfit" DECIMAL(19,2) NOT NULL,
    "sharePercent" DOUBLE PRECISION NOT NULL,
    "shareAmount" DECIMAL(19,2) NOT NULL,
    "status" "InvestorProfitShareStatus" NOT NULL DEFAULT 'CALCULATED',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "payoutId" TEXT,
    "journalId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "investor_profit_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_configs" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "shareMode" "InvestorShareMode" NOT NULL DEFAULT 'PROPORTIONAL',
    "fixedSharePercent" DOUBLE PRECISION,
    "periodType" "InvestorProfitPeriodType" NOT NULL DEFAULT 'MONTHLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "investor_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investor_deposits_investorId_idx" ON "investor_deposits"("investorId");

-- CreateIndex
CREATE INDEX "investor_deposits_tenantId_idx" ON "investor_deposits"("tenantId");

-- CreateIndex
CREATE INDEX "investor_deposits_status_idx" ON "investor_deposits"("status");

-- CreateIndex
CREATE INDEX "investor_deposits_date_idx" ON "investor_deposits"("date");

-- CreateIndex
CREATE INDEX "investor_profit_shares_investorId_idx" ON "investor_profit_shares"("investorId");

-- CreateIndex
CREATE INDEX "investor_profit_shares_tenantId_idx" ON "investor_profit_shares"("tenantId");

-- CreateIndex
CREATE INDEX "investor_profit_shares_status_idx" ON "investor_profit_shares"("status");

-- CreateIndex
CREATE INDEX "investor_profit_shares_periodStart_periodEnd_idx" ON "investor_profit_shares"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "investor_configs_investorId_key" ON "investor_configs"("investorId");

-- CreateIndex
CREATE INDEX "investor_configs_tenantId_idx" ON "investor_configs"("tenantId");

-- AddForeignKey
ALTER TABLE "investor_deposits" ADD CONSTRAINT "investor_deposits_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_profit_shares" ADD CONSTRAINT "investor_profit_shares_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_profit_shares" ADD CONSTRAINT "investor_profit_shares_configId_fkey" FOREIGN KEY ("configId") REFERENCES "investor_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_configs" ADD CONSTRAINT "investor_configs_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
