-- AlterTable
ALTER TABLE "Pelanggan" ADD COLUMN     "salesId" TEXT;

-- CreateIndex
CREATE INDEX "Pelanggan_salesId_idx" ON "Pelanggan"("salesId");

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
