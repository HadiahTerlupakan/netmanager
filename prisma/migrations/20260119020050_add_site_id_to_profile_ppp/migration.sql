-- AlterTable
ALTER TABLE "ProfilePPP" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "ProfilePPP_siteId_idx" ON "ProfilePPP"("siteId");

-- AddForeignKey
ALTER TABLE "ProfilePPP" ADD CONSTRAINT "ProfilePPP_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
