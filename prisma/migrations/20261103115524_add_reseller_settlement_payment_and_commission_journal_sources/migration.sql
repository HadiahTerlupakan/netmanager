-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalSource" ADD VALUE 'AUTO_RESELLER_COMMISSION';
ALTER TYPE "JournalSource" ADD VALUE 'AUTO_RESELLER_SETTLEMENT_PAID';

-- AlterTable
ALTER TABLE "ResellerSettlement" ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "paidById" TEXT,
ADD COLUMN     "paymentAccountId" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentReference" TEXT;
