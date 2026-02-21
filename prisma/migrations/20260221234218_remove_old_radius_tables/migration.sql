-- CreateEnum
CREATE TYPE "GatewayPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIAL_PAID';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "gatewayProvider" TEXT,
ADD COLUMN     "gatewayStatus" "GatewayPaymentStatus",
ADD COLUMN     "paymentUrl" TEXT,
ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_gatewayStatus_idx" ON "Payment"("gatewayStatus");

-- CreateIndex
CREATE INDEX "Payment_transactionId_idx" ON "Payment"("transactionId");
