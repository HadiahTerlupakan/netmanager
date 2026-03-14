-- @safe-guard-ack: Adding tenantId for Multi-Tenant SaaS architecture mitra db
-- AlterTable
ALTER TABLE "Mitra" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mitra_wallets" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mitra_transactions" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "withdraw_requests" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "face_verification_logs" ADD COLUMN     "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "Mitra_tenantId_idx" ON "Mitra"("tenantId");

-- CreateIndex
CREATE INDEX "mitra_wallets_tenantId_idx" ON "mitra_wallets"("tenantId");

-- CreateIndex
CREATE INDEX "mitra_transactions_tenantId_idx" ON "mitra_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "withdraw_requests_tenantId_idx" ON "withdraw_requests"("tenantId");

-- CreateIndex
CREATE INDEX "face_verification_logs_tenantId_idx" ON "face_verification_logs"("tenantId");

