-- AlterTable
ALTER TABLE "mapping_nodes" ADD COLUMN "siteId" TEXT;

-- CreateIndex
CREATE INDEX "mapping_nodes_siteId_idx" ON "mapping_nodes"("siteId");

-- CreateIndex
CREATE INDEX "mapping_nodes_tenantId_siteId_idx" ON "mapping_nodes"("tenantId", "siteId");

-- AddForeignKey
ALTER TABLE "mapping_nodes" ADD CONSTRAINT "mapping_nodes_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
