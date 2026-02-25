-- CreateEnum
CREATE TYPE "UnmatchedStatus" AS ENUM ('PENDING', 'RESOLVED', 'IGNORED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "receiptUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN "unmatchedMutationId" TEXT;

-- CreateTable
CREATE TABLE "UnmatchedMutation" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MOOTA',
    "transactionId" TEXT,
    "amount" DECIMAL(19,2) NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "bankId" TEXT,
    "rawPayload" JSONB,
    "status" "UnmatchedStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "matchedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnmatchedMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnmatchedMutation_transactionId_key" ON "UnmatchedMutation"("transactionId");
CREATE INDEX "UnmatchedMutation_status_idx" ON "UnmatchedMutation"("status");
CREATE INDEX "UnmatchedMutation_provider_idx" ON "UnmatchedMutation"("provider");
CREATE INDEX "UnmatchedMutation_amount_idx" ON "UnmatchedMutation"("amount");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_unmatchedMutationId_key" ON "Payment"("unmatchedMutationId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_unmatchedMutationId_fkey" FOREIGN KEY ("unmatchedMutationId") REFERENCES "UnmatchedMutation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
