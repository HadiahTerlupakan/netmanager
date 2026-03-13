-- @safe-guard-ack: Menghapus tabel transactions dan transaction_categories yang sudah tidak dipakai (refactoring finance module)
-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_categoryId_fkey";

-- DropTable
DROP TABLE "transactions";

-- DropTable
DROP TABLE "transaction_categories";

