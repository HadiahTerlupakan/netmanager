-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RabStatus" ADD VALUE 'PENGADAAN';
ALTER TYPE "RabStatus" ADD VALUE 'PENGGELARAN_JARINGAN';
ALTER TYPE "RabStatus" ADD VALUE 'PENJUALAN';
ALTER TYPE "RabStatus" ADD VALUE 'TARGET_TERCAPAI';
ALTER TYPE "RabStatus" ADD VALUE 'SELESAI';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "rabItemId" TEXT,
ADD COLUMN     "rabProjectId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_rabProjectId_idx" ON "Expense"("rabProjectId");

-- CreateIndex
CREATE INDEX "Expense_rabItemId_idx" ON "Expense"("rabItemId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_rabItemId_fkey" FOREIGN KEY ("rabItemId") REFERENCES "rab_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
