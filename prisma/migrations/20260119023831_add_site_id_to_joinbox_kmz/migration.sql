-- AlterTable
ALTER TABLE "Joinbox" ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "KmzFile" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "Joinbox_siteId_idx" ON "Joinbox"("siteId");

-- CreateIndex
CREATE INDEX "KmzFile_siteId_idx" ON "KmzFile"("siteId");

-- AddForeignKey
ALTER TABLE "Joinbox" ADD CONSTRAINT "Joinbox_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KmzFile" ADD CONSTRAINT "KmzFile_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
