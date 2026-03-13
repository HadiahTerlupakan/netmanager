-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_categoryId_fkey";

-- DropTable
DROP TABLE "transactions";

-- DropTable
DROP TABLE "transaction_categories";

