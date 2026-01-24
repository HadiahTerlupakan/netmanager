-- AlterTable
ALTER TABLE "transfer_antar_gudang" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "transfer_antar_gudang_createdById_idx" ON "transfer_antar_gudang"("createdById");

-- AddForeignKey
ALTER TABLE "transfer_antar_gudang" ADD CONSTRAINT "transfer_antar_gudang_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
