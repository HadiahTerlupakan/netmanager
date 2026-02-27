/*
  Warnings:

  - The values [MITRA,MITRA_TEKNISI,MITRA_SALES] on the enum `EmployeeType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `passwordLogin` on the `Pelanggan` table. All the data in the column will be lost.
  - You are about to drop the column `mitraRateCanvasing` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `mitraRateWo` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `mitra_wallets` table. All the data in the column will be lost.
  - You are about to drop the column `accountName` on the `withdraw_requests` table. All the data in the column will be lost.
  - You are about to drop the column `accountNumber` on the `withdraw_requests` table. All the data in the column will be lost.
  - You are about to drop the column `walletId` on the `withdraw_requests` table. All the data in the column will be lost.
  - You are about to drop the `Invoice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InvoiceItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentGatewayConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UnmatchedMutation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mix_radius_invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transaction_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transactions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[mitraId]` on the table `mitra_wallets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mitraId` to the `mitra_wallets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bankAccountName` to the `withdraw_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bankAccountNo` to the `withdraw_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mitraId` to the `withdraw_requests` table without a default value. This is not possible if the table is not empty.
  - Made the column `bankName` on table `withdraw_requests` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "MitraType" AS ENUM ('MITRA_TEKNISI', 'MITRA_SALES');

-- CreateEnum
CREATE TYPE "RabPaymentType" AS ENUM ('PREPAID', 'POSTPAID');

-- CreateEnum
CREATE TYPE "RabRecoveryType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterEnum
BEGIN;
CREATE TYPE "EmployeeType_new" AS ENUM ('KARYAWAN');
ALTER TABLE "public"."User" ALTER COLUMN "employeeType" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "employeeType" TYPE "EmployeeType_new" USING ("employeeType"::text::"EmployeeType_new");
ALTER TYPE "EmployeeType" RENAME TO "EmployeeType_old";
ALTER TYPE "EmployeeType_new" RENAME TO "EmployeeType";
DROP TYPE "public"."EmployeeType_old";
ALTER TABLE "User" ALTER COLUMN "employeeType" SET DEFAULT 'KARYAWAN';
COMMIT;

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
ALTER TABLE "canvasing" DROP CONSTRAINT "canvasing_salesId_fkey";

-- DropForeignKey
ALTER TABLE "mitra_wallets" DROP CONSTRAINT "mitra_wallets_userId_fkey";

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

-- DropForeignKey
ALTER TABLE "withdraw_requests" DROP CONSTRAINT "withdraw_requests_walletId_fkey";

-- DropIndex
DROP INDEX "mitra_wallets_userId_idx";

-- DropIndex
DROP INDEX "mitra_wallets_userId_key";

-- DropIndex
DROP INDEX "withdraw_requests_walletId_idx";

-- AlterTable
ALTER TABLE "Pelanggan" DROP COLUMN "passwordLogin";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "mitraRateCanvasing",
DROP COLUMN "mitraRateWo";

-- AlterTable
ALTER TABLE "canvasing" ADD COLUMN     "mitraId" TEXT,
ALTER COLUMN "salesId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "mitra_wallets" DROP COLUMN "userId",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'IDR',
ADD COLUMN     "mitraId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "rab_items" ADD COLUMN     "expenseCategoryId" TEXT,
ADD COLUMN     "wbsId" TEXT;

-- AlterTable
ALTER TABLE "rab_projects" ADD COLUMN     "contingencyAmount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "contingencyPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "hasDisbursementPlan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "investmentDurationMonths" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "investmentRecoveryType" "RabRecoveryType" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "investmentRecoveryValue" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN     "investorProfitSharePercent" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN     "paymentType" "RabPaymentType" NOT NULL DEFAULT 'PREPAID';

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "canApproveRab" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "withdraw_requests" DROP COLUMN "accountName",
DROP COLUMN "accountNumber",
DROP COLUMN "walletId",
ADD COLUMN     "bankAccountName" TEXT NOT NULL,
ADD COLUMN     "bankAccountNo" TEXT NOT NULL,
ADD COLUMN     "mitraId" TEXT NOT NULL,
ADD COLUMN     "mitraWalletId" TEXT,
ALTER COLUMN "bankName" SET NOT NULL;

-- AlterTable
ALTER TABLE "work_order_assignments" ADD COLUMN     "mitraId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

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
CREATE TABLE "rab_approvals" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rab_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_wbs" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rab_wbs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_disbursements" (
    "id" TEXT NOT NULL,
    "rabItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "amount" BIGINT NOT NULL,
    "estimatedDate" TIMESTAMP(3),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rab_disbursements_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "rab_actual_achievements" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "actualSubscribers" INTEGER NOT NULL,
    "actualRevenue" BIGINT NOT NULL,
    "actualOpex" BIGINT NOT NULL DEFAULT 0,
    "manualRecoveryInstallment" BIGINT,
    "manualInvestorShare" BIGINT,
    "manualCompanyShare" BIGINT,
    "manualInvestorProfitSharePercent" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rab_actual_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mitra" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "siteId" TEXT,
    "mitraType" "MitraType" NOT NULL DEFAULT 'MITRA_TEKNISI',
    "mitraRateWo" DOUBLE PRECISION,
    "mitraRateCanvasing" DOUBLE PRECISION,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "bankAccountName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mitra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rab_approvals_rabProjectId_idx" ON "rab_approvals"("rabProjectId");

-- CreateIndex
CREATE INDEX "rab_approvals_userId_idx" ON "rab_approvals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rab_approvals_rabProjectId_userId_key" ON "rab_approvals"("rabProjectId", "userId");

-- CreateIndex
CREATE INDEX "rab_wbs_rabProjectId_idx" ON "rab_wbs"("rabProjectId");

-- CreateIndex
CREATE INDEX "rab_disbursements_rabItemId_idx" ON "rab_disbursements"("rabItemId");

-- CreateIndex
CREATE UNIQUE INDEX "acs_vendors_name_key" ON "acs_vendors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "acs_wifi_security_productClass_key" ON "acs_wifi_security"("productClass");

-- CreateIndex
CREATE INDEX "company_bank_accounts_isActive_idx" ON "company_bank_accounts"("isActive");

-- CreateIndex
CREATE INDEX "company_bank_accounts_priority_idx" ON "company_bank_accounts"("priority");

-- CreateIndex
CREATE INDEX "rab_actual_achievements_rabProjectId_idx" ON "rab_actual_achievements"("rabProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "rab_actual_achievements_rabProjectId_month_year_key" ON "rab_actual_achievements"("rabProjectId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Mitra_email_key" ON "Mitra"("email");

-- CreateIndex
CREATE INDEX "Mitra_siteId_idx" ON "Mitra"("siteId");

-- CreateIndex
CREATE INDEX "Mitra_mitraType_idx" ON "Mitra"("mitraType");

-- CreateIndex
CREATE INDEX "Mitra_isActive_idx" ON "Mitra"("isActive");

-- CreateIndex
CREATE INDEX "canvasing_mitraId_idx" ON "canvasing"("mitraId");

-- CreateIndex
CREATE UNIQUE INDEX "mitra_wallets_mitraId_key" ON "mitra_wallets"("mitraId");

-- CreateIndex
CREATE INDEX "mitra_wallets_mitraId_idx" ON "mitra_wallets"("mitraId");

-- CreateIndex
CREATE INDEX "rab_items_wbsId_idx" ON "rab_items"("wbsId");

-- CreateIndex
CREATE INDEX "withdraw_requests_mitraId_idx" ON "withdraw_requests"("mitraId");

-- CreateIndex
CREATE INDEX "work_order_assignments_mitraId_idx" ON "work_order_assignments"("mitraId");

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_mitraId_fkey" FOREIGN KEY ("mitraId") REFERENCES "Mitra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_mitraId_fkey" FOREIGN KEY ("mitraId") REFERENCES "Mitra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_approvals" ADD CONSTRAINT "rab_approvals_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_approvals" ADD CONSTRAINT "rab_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_items" ADD CONSTRAINT "rab_items_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_items" ADD CONSTRAINT "rab_items_wbsId_fkey" FOREIGN KEY ("wbsId") REFERENCES "rab_wbs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_wbs" ADD CONSTRAINT "rab_wbs_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_disbursements" ADD CONSTRAINT "rab_disbursements_rabItemId_fkey" FOREIGN KEY ("rabItemId") REFERENCES "rab_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_actual_achievements" ADD CONSTRAINT "rab_actual_achievements_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mitra" ADD CONSTRAINT "Mitra_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mitra_wallets" ADD CONSTRAINT "mitra_wallets_mitraId_fkey" FOREIGN KEY ("mitraId") REFERENCES "Mitra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdraw_requests" ADD CONSTRAINT "withdraw_requests_mitraId_fkey" FOREIGN KEY ("mitraId") REFERENCES "Mitra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdraw_requests" ADD CONSTRAINT "withdraw_requests_mitraWalletId_fkey" FOREIGN KEY ("mitraWalletId") REFERENCES "mitra_wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
