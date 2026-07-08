-- CreateEnum
CREATE TYPE "ResellerCommissionType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "ResellerCommissionStatus" AS ENUM ('ACCRUED', 'SETTLED', 'PAID');

-- CreateEnum
CREATE TYPE "ResellerSettlementStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

-- CreateTable
CREATE TABLE "ResellerCommissionRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "resellerId" TEXT NOT NULL,
    "hargaPaketId" TEXT,
    "type" "ResellerCommissionType" NOT NULL,
    "rate" INTEGER,
    "fixedAmount" INTEGER,
    "status" "ResellerStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ResellerCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerCommission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "resellerId" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "commissionRuleId" TEXT NOT NULL,
    "type" "ResellerCommissionType" NOT NULL,
    "rate" INTEGER,
    "baseAmount" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "status" "ResellerCommissionStatus" NOT NULL DEFAULT 'ACCRUED',
    "period" TEXT NOT NULL,
    "settlementId" TEXT,
    "accruedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ResellerCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerSettlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "resellerId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "commissionCount" INTEGER NOT NULL,
    "status" "ResellerSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ResellerSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResellerCommissionRule_tenantId_idx" ON "ResellerCommissionRule"("tenantId");

-- CreateIndex
CREATE INDEX "ResellerCommissionRule_resellerId_idx" ON "ResellerCommissionRule"("resellerId");

-- CreateIndex
CREATE INDEX "ResellerCommissionRule_hargaPaketId_idx" ON "ResellerCommissionRule"("hargaPaketId");

-- CreateIndex
CREATE INDEX "ResellerCommissionRule_status_idx" ON "ResellerCommissionRule"("status");

-- CreateIndex
CREATE INDEX "ResellerCommissionRule_deletedAt_idx" ON "ResellerCommissionRule"("deletedAt");

-- CreateIndex
CREATE INDEX "ResellerCommissionRule_startsAt_endsAt_idx" ON "ResellerCommissionRule"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ResellerCommission_tenantId_idx" ON "ResellerCommission"("tenantId");

-- CreateIndex
CREATE INDEX "ResellerCommission_resellerId_idx" ON "ResellerCommission"("resellerId");

-- CreateIndex
CREATE INDEX "ResellerCommission_pelangganId_idx" ON "ResellerCommission"("pelangganId");

-- CreateIndex
CREATE INDEX "ResellerCommission_invoiceId_idx" ON "ResellerCommission"("invoiceId");

-- CreateIndex
CREATE INDEX "ResellerCommission_status_idx" ON "ResellerCommission"("status");

-- CreateIndex
CREATE INDEX "ResellerCommission_period_idx" ON "ResellerCommission"("period");

-- CreateIndex
CREATE INDEX "ResellerCommission_settlementId_idx" ON "ResellerCommission"("settlementId");

-- CreateIndex
CREATE INDEX "ResellerCommission_deletedAt_idx" ON "ResellerCommission"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerCommission_tenantId_invoiceId_key" ON "ResellerCommission"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "ResellerSettlement_tenantId_idx" ON "ResellerSettlement"("tenantId");

-- CreateIndex
CREATE INDEX "ResellerSettlement_resellerId_idx" ON "ResellerSettlement"("resellerId");

-- CreateIndex
CREATE INDEX "ResellerSettlement_status_idx" ON "ResellerSettlement"("status");

-- CreateIndex
CREATE INDEX "ResellerSettlement_periodStart_periodEnd_idx" ON "ResellerSettlement"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ResellerSettlement_deletedAt_idx" ON "ResellerSettlement"("deletedAt");

-- AddForeignKey
ALTER TABLE "ResellerCommissionRule" ADD CONSTRAINT "ResellerCommissionRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommissionRule" ADD CONSTRAINT "ResellerCommissionRule_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommissionRule" ADD CONSTRAINT "ResellerCommissionRule_hargaPaketId_fkey" FOREIGN KEY ("hargaPaketId") REFERENCES "HargaPaket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommission" ADD CONSTRAINT "ResellerCommission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommission" ADD CONSTRAINT "ResellerCommission_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommission" ADD CONSTRAINT "ResellerCommission_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "ResellerCommissionRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommission" ADD CONSTRAINT "ResellerCommission_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "ResellerSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerSettlement" ADD CONSTRAINT "ResellerSettlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerSettlement" ADD CONSTRAINT "ResellerSettlement_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
