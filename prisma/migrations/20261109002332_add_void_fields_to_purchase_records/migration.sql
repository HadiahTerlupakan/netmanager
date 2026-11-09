-- AlterTable
ALTER TABLE "purchase_records" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT;

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
