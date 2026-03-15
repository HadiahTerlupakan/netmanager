-- @safe-guard-ack: Adding tenantId for Multi-Tenant SaaS architecture radius db
-- AlterTable
ALTER TABLE "radacct" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radcheck" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radgroupcheck" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radgroupreply" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radreply" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radusergroup" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radpostauth" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "nas" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radippool" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radacct_tenantId_idx" ON "radacct"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radcheck_tenantId_idx" ON "radcheck"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radgroupcheck_tenantId_idx" ON "radgroupcheck"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radgroupreply_tenantId_idx" ON "radgroupreply"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radreply_tenantId_idx" ON "radreply"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radusergroup_tenantId_idx" ON "radusergroup"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radpostauth_tenantId_idx" ON "radpostauth"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "nas_tenantId_idx" ON "nas"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radippool_tenantId_idx" ON "radippool"("tenantId");

