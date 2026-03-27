-- AlterTable
ALTER TABLE "radacct" ADD COLUMN     "tenantId" TEXT,
ALTER COLUMN "nasipaddress" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "framedipaddress" SET DATA TYPE VARCHAR(64);

-- AlterTable
ALTER TABLE "radcheck" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radgroupcheck" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radgroupreply" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radreply" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radusergroup" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radpostauth" ADD COLUMN     "tenantId" TEXT,
ALTER COLUMN "reply" SET DATA TYPE VARCHAR(128);

-- AlterTable
ALTER TABLE "nas" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "radippool" ADD COLUMN     "tenantId" TEXT,
ALTER COLUMN "framedipaddress" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "nasipaddress" SET DATA TYPE VARCHAR(64);

-- CreateIndex
CREATE INDEX "radacct_tenantId_idx" ON "radacct"("tenantId");

-- CreateIndex
CREATE INDEX "radcheck_tenantId_idx" ON "radcheck"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "radcheck_username_attribute_tenantId_key" ON "radcheck"("username", "attribute", "tenantId");

-- CreateIndex
CREATE INDEX "radgroupcheck_tenantId_idx" ON "radgroupcheck"("tenantId");

-- CreateIndex
CREATE INDEX "radgroupreply_tenantId_idx" ON "radgroupreply"("tenantId");

-- CreateIndex
CREATE INDEX "radreply_tenantId_idx" ON "radreply"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "radreply_username_attribute_tenantId_key" ON "radreply"("username", "attribute", "tenantId");

-- CreateIndex
CREATE INDEX "radusergroup_tenantId_idx" ON "radusergroup"("tenantId");

-- CreateIndex
CREATE INDEX "radpostauth_tenantId_idx" ON "radpostauth"("tenantId");

-- CreateIndex
CREATE INDEX "nas_tenantId_idx" ON "nas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "nas_nasname_tenantId_key" ON "nas"("nasname", "tenantId");

-- CreateIndex
CREATE INDEX "radippool_tenantId_idx" ON "radippool"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "radippool_framedipaddress_pool_name_tenantId_key" ON "radippool"("framedipaddress", "pool_name", "tenantId");
