-- @safe-guard-ack: Adding tenantId for Multi-Tenant SaaS architecture mitra db
-- AlterTable
ALTER TABLE "Mitra" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mitra_wallets" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mitra_transactions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "withdraw_requests" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "face_verification_logs" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Mitra_tenantId_idx" ON "Mitra"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mitra_wallets_tenantId_idx" ON "mitra_wallets"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mitra_transactions_tenantId_idx" ON "mitra_transactions"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "withdraw_requests_tenantId_idx" ON "withdraw_requests"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "face_verification_logs_tenantId_idx" ON "face_verification_logs"("tenantId");

