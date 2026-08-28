-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledQuantity" INTEGER NOT NULL DEFAULT 0;

