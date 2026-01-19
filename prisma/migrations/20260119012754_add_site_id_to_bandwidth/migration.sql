-- AlterTable
ALTER TABLE "Bandwidth" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "Bandwidth_siteId_idx" ON "Bandwidth"("siteId");

-- AddForeignKey
ALTER TABLE "Bandwidth" ADD CONSTRAINT "Bandwidth_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
