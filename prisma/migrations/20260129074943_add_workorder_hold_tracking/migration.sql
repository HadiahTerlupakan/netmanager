-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "heldAt" TIMESTAMP(3),
ADD COLUMN     "holdReason" TEXT,
ADD COLUMN     "resumedAt" TIMESTAMP(3);
