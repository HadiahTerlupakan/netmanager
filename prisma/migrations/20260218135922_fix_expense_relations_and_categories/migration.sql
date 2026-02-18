/*
  Warnings:

  - A unique constraint covering the columns `[name,siteId]` on the table `HargaPaket` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ExpenseCategory_name_type_key";

-- DropIndex
DROP INDEX "HargaPaket_name_key";

-- DropIndex
DROP INDEX "rab_items_rabProjectId_idx";

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "HargaPaket" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "ExpenseCategory_type_idx" ON "ExpenseCategory"("type");

-- CreateIndex
CREATE INDEX "ExpenseCategory_parentId_idx" ON "ExpenseCategory"("parentId");

-- CreateIndex
CREATE INDEX "HargaPaket_siteId_idx" ON "HargaPaket"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "HargaPaket_name_siteId_key" ON "HargaPaket"("name", "siteId");

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HargaPaket" ADD CONSTRAINT "HargaPaket_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
