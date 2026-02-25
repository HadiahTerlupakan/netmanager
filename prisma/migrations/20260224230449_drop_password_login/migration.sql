/*
  Warnings:

  - You are about to drop the column `passwordLogin` on the `Pelanggan` table. All the data in the column will be lost.
  - You are about to drop the `Invoice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InvoiceItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentGatewayConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UnmatchedMutation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mix_radius_invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transaction_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_pelangganId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_siteId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_accountId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_unmatchedMutationId_fkey";

-- DropForeignKey
ALTER TABLE "mix_radius_invoices" DROP CONSTRAINT "mix_radius_invoices_username_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_accountId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_createdById_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_purchaseOrderId_fkey";

-- AlterTable
ALTER TABLE "Pelanggan" DROP COLUMN "passwordLogin";

-- DropTable
DROP TABLE "Invoice";

-- DropTable
DROP TABLE "InvoiceItem";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "PaymentGatewayConfig";

-- DropTable
DROP TABLE "UnmatchedMutation";

-- DropTable
DROP TABLE "mix_radius_invoices";

-- DropTable
DROP TABLE "transaction_categories";

-- DropTable
DROP TABLE "transactions";

-- DropEnum
DROP TYPE "ExpenseType";

-- DropEnum
DROP TYPE "GatewayPaymentStatus";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- DropEnum
DROP TYPE "ItemType";

-- DropEnum
DROP TYPE "PaymentMethod";

-- DropEnum
DROP TYPE "TransactionType";

-- DropEnum
DROP TYPE "UnmatchedStatus";

-- CreateTable
CREATE TABLE "acs_vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturerPatterns" TEXT NOT NULL,
    "productPatterns" TEXT NOT NULL,
    "parameterPrefix" TEXT,
    "serviceListPath" TEXT,
    "lanBindingPath" TEXT,
    "vlanIdPath" TEXT,
    "httpWanEnablePath" TEXT,
    "firewallLevelPath" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acs_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acs_wifi_security" (
    "id" TEXT NOT NULL,
    "productClass" TEXT NOT NULL,
    "parameterPath" TEXT NOT NULL,
    "wpaTypes" TEXT,
    "encryptTypes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acs_wifi_security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_bank_accounts" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "acs_vendors_name_key" ON "acs_vendors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "acs_wifi_security_productClass_key" ON "acs_wifi_security"("productClass");

-- CreateIndex
CREATE INDEX "company_bank_accounts_isActive_idx" ON "company_bank_accounts"("isActive");

-- CreateIndex
CREATE INDEX "company_bank_accounts_priority_idx" ON "company_bank_accounts"("priority");
