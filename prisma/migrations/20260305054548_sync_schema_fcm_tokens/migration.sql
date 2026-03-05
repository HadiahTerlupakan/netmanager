/*
  Warnings:

  - You are about to drop the `Mitra` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MixRadiusConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MixRadiusCustomer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MixRadiusOwnerGroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mitra_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mitra_wallets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `radacct` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `radcheck` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `radgroupcheck` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `radgroupreply` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `radippool` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `radpostauth` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `radreply` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `radusergroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `withdraw_requests` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[loanPaymentId]` on the table `salary_details` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PtkpStatus" AS ENUM ('TK_0', 'TK_1', 'TK_2', 'TK_3', 'K_0', 'K_1', 'K_2', 'K_3', 'KI_0', 'KI_1', 'KI_2', 'KI_3');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PAID_OFF');

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_mixRadiusGroupId_fkey";

-- DropForeignKey
ALTER TABLE "Mitra" DROP CONSTRAINT "Mitra_siteId_fkey";

-- DropForeignKey
ALTER TABLE "MixRadiusOwnerGroup" DROP CONSTRAINT "MixRadiusOwnerGroup_siteId_fkey";

-- DropForeignKey
ALTER TABLE "canvasing" DROP CONSTRAINT "canvasing_mitraId_fkey";

-- DropForeignKey
ALTER TABLE "mitra_transactions" DROP CONSTRAINT "mitra_transactions_walletId_fkey";

-- DropForeignKey
ALTER TABLE "mitra_wallets" DROP CONSTRAINT "mitra_wallets_mitraId_fkey";

-- DropForeignKey
ALTER TABLE "rab_projects" DROP CONSTRAINT "rab_projects_mixRadiusGroupId_fkey";

-- DropForeignKey
ALTER TABLE "withdraw_requests" DROP CONSTRAINT "withdraw_requests_mitraId_fkey";

-- DropForeignKey
ALTER TABLE "withdraw_requests" DROP CONSTRAINT "withdraw_requests_mitraWalletId_fkey";

-- DropForeignKey
ALTER TABLE "withdraw_requests" DROP CONSTRAINT "withdraw_requests_processedById_fkey";

-- DropForeignKey
ALTER TABLE "work_order_assignments" DROP CONSTRAINT "work_order_assignments_mitraId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bpjsKesehatan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bpjsKetenagakerjaan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fcmTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "joinDate" TIMESTAMP(3),
ADD COLUMN     "ptkpStatus" "PtkpStatus";

-- AlterTable
ALTER TABLE "rab_projects" ADD COLUMN     "mixRadiusInvestorSiteId" TEXT;

-- AlterTable
ALTER TABLE "salary_details" ADD COLUMN     "loanPaymentId" TEXT;

-- AlterTable
ALTER TABLE "work_order_assignments" ADD COLUMN     "isLead" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "assignedMitraId" TEXT,
ADD COLUMN     "isWarranty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warrantyOwnerId" TEXT,
ADD COLUMN     "warrantySla" TIMESTAMP(3);

-- DropTable
DROP TABLE "Mitra";

-- DropTable
DROP TABLE "MixRadiusConfig";

-- DropTable
DROP TABLE "MixRadiusCustomer";

-- DropTable
DROP TABLE "MixRadiusOwnerGroup";

-- DropTable
DROP TABLE "mitra_transactions";

-- DropTable
DROP TABLE "mitra_wallets";

-- DropTable
DROP TABLE "nas";

-- DropTable
DROP TABLE "radacct";

-- DropTable
DROP TABLE "radcheck";

-- DropTable
DROP TABLE "radgroupcheck";

-- DropTable
DROP TABLE "radgroupreply";

-- DropTable
DROP TABLE "radippool";

-- DropTable
DROP TABLE "radpostauth";

-- DropTable
DROP TABLE "radreply";

-- DropTable
DROP TABLE "radusergroup";

-- DropTable
DROP TABLE "withdraw_requests";

-- DropEnum
DROP TYPE "MitraTransactionType";

-- DropEnum
DROP TYPE "MitraType";

-- DropEnum
DROP TYPE "WithdrawMethod";

-- DropEnum
DROP TYPE "WithdrawStatus";

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "passwordHash" TEXT,
    "namaLengkap" TEXT NOT NULL,
    "perusahaan" TEXT,
    "noTelp" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorPayout" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RabInvestor" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "investmentAmount" BIGINT NOT NULL DEFAULT 0,
    "profitSharePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "RabInvestor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_loans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "installment" DOUBLE PRECISION NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_payments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Investor_username_key" ON "Investor"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_email_key" ON "Investor"("email");

-- CreateIndex
CREATE INDEX "InvestorPayout_investorId_idx" ON "InvestorPayout"("investorId");

-- CreateIndex
CREATE INDEX "InvestorPayout_date_idx" ON "InvestorPayout"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RabInvestor_rabProjectId_investorId_key" ON "RabInvestor"("rabProjectId", "investorId");

-- CreateIndex
CREATE INDEX "employee_loans_userId_idx" ON "employee_loans"("userId");

-- CreateIndex
CREATE INDEX "employee_loans_status_idx" ON "employee_loans"("status");

-- CreateIndex
CREATE INDEX "loan_payments_loanId_idx" ON "loan_payments"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "salary_details_loanPaymentId_key" ON "salary_details"("loanPaymentId");

-- CreateIndex
CREATE INDEX "work_orders_assignedMitraId_idx" ON "work_orders"("assignedMitraId");

-- AddForeignKey
ALTER TABLE "InvestorPayout" ADD CONSTRAINT "InvestorPayout_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RabInvestor" ADD CONSTRAINT "RabInvestor_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RabInvestor" ADD CONSTRAINT "RabInvestor_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_details" ADD CONSTRAINT "salary_details_loanPaymentId_fkey" FOREIGN KEY ("loanPaymentId") REFERENCES "loan_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "employee_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
