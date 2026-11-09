-- CreateEnum
CREATE TYPE "PurchaseRequestItemApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "purchase_request_items" ADD COLUMN     "barangIdDiminta" TEXT,
ADD COLUMN     "catatanApproval" TEXT,
ADD COLUMN     "jumlahDiminta" INTEGER,
ADD COLUMN     "statusApproval" "PurchaseRequestItemApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "purchase_request_jasa_items" ADD COLUMN     "catatanApproval" TEXT,
ADD COLUMN     "jumlahDiminta" INTEGER,
ADD COLUMN     "statusApproval" "PurchaseRequestItemApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "purchase_request_items_barangIdDiminta_idx" ON "purchase_request_items"("barangIdDiminta");

-- AddForeignKey
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_barangIdDiminta_fkey" FOREIGN KEY ("barangIdDiminta") REFERENCES "barang"("id") ON DELETE SET NULL ON UPDATE CASCADE;
