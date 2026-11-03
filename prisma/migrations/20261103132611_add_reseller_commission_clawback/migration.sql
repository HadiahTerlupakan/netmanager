-- AlterEnum
ALTER TYPE "JournalSource" ADD VALUE 'AUTO_RESELLER_COMMISSION_CLAWBACK';

-- AlterEnum
ALTER TYPE "ResellerCommissionStatus" ADD VALUE 'REVERSED';

-- AlterTable
ALTER TABLE "ResellerSettlement" ADD COLUMN     "adjustmentAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ResellerCommissionAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "resellerId" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sourceCommissionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResellerCommissionAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerCommissionAdjustmentApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "adjustmentId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResellerCommissionAdjustmentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResellerCommissionAdjustment_sourceCommissionId_key" ON "ResellerCommissionAdjustment"("sourceCommissionId");

-- CreateIndex
CREATE INDEX "ResellerCommissionAdjustment_tenantId_resellerId_createdAt_idx" ON "ResellerCommissionAdjustment"("tenantId", "resellerId", "createdAt");

-- CreateIndex
CREATE INDEX "ResellerCommissionAdjustmentApplication_tenantId_idx" ON "ResellerCommissionAdjustmentApplication"("tenantId");

-- CreateIndex
CREATE INDEX "ResellerCommissionAdjustmentApplication_settlementId_idx" ON "ResellerCommissionAdjustmentApplication"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerCommissionAdjustmentApplication_adjustmentId_settle_key" ON "ResellerCommissionAdjustmentApplication"("adjustmentId", "settlementId");

-- AddForeignKey
ALTER TABLE "ResellerCommissionAdjustment" ADD CONSTRAINT "ResellerCommissionAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommissionAdjustment" ADD CONSTRAINT "ResellerCommissionAdjustment_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommissionAdjustment" ADD CONSTRAINT "ResellerCommissionAdjustment_sourceCommissionId_fkey" FOREIGN KEY ("sourceCommissionId") REFERENCES "ResellerCommission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommissionAdjustmentApplication" ADD CONSTRAINT "ResellerCommissionAdjustmentApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommissionAdjustmentApplication" ADD CONSTRAINT "ResellerCommissionAdjustmentApplication_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "ResellerCommissionAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerCommissionAdjustmentApplication" ADD CONSTRAINT "ResellerCommissionAdjustmentApplication_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "ResellerSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
