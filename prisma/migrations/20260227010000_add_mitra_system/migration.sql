-- AlterEnum: Add MITRA_TEKNISI and MITRA_SALES to EmployeeType
ALTER TYPE "EmployeeType" ADD VALUE IF NOT EXISTS 'MITRA_TEKNISI';
ALTER TYPE "EmployeeType" ADD VALUE IF NOT EXISTS 'MITRA_SALES';

-- CreateEnum: MitraTransactionType
DO $$ BEGIN
    CREATE TYPE "MitraTransactionType" AS ENUM ('EARNING', 'WITHDRAW', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: WithdrawStatus
DO $$ BEGIN
    CREATE TYPE "WithdrawStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: WithdrawMethod
DO $$ BEGIN
    CREATE TYPE "WithdrawMethod" AS ENUM ('TRANSFER', 'CASH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add mitra fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mitraRateWo" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mitraRateCanvasing" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankAccountNo" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT;

-- CreateTable: mitra_wallets
CREATE TABLE IF NOT EXISTS "mitra_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWithdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mitra_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: mitra_transactions
CREATE TABLE IF NOT EXISTS "mitra_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "MitraTransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mitra_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: withdraw_requests
CREATE TABLE IF NOT EXISTS "withdraw_requests" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "WithdrawStatus" NOT NULL DEFAULT 'PENDING',
    "method" "WithdrawMethod" NOT NULL DEFAULT 'TRANSFER',
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "notes" TEXT,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdraw_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: mitra_wallets
CREATE UNIQUE INDEX IF NOT EXISTS "mitra_wallets_userId_key" ON "mitra_wallets"("userId");
CREATE INDEX IF NOT EXISTS "mitra_wallets_userId_idx" ON "mitra_wallets"("userId");

-- CreateIndex: mitra_transactions
CREATE INDEX IF NOT EXISTS "mitra_transactions_walletId_idx" ON "mitra_transactions"("walletId");
CREATE INDEX IF NOT EXISTS "mitra_transactions_createdAt_idx" ON "mitra_transactions"("createdAt");
CREATE INDEX IF NOT EXISTS "mitra_transactions_referenceId_idx" ON "mitra_transactions"("referenceId");

-- CreateIndex: withdraw_requests
CREATE INDEX IF NOT EXISTS "withdraw_requests_walletId_idx" ON "withdraw_requests"("walletId");
CREATE INDEX IF NOT EXISTS "withdraw_requests_status_idx" ON "withdraw_requests"("status");
CREATE INDEX IF NOT EXISTS "withdraw_requests_createdAt_idx" ON "withdraw_requests"("createdAt");

-- AddForeignKey: mitra_wallets -> User
DO $$ BEGIN
    ALTER TABLE "mitra_wallets" ADD CONSTRAINT "mitra_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: mitra_transactions -> mitra_wallets
DO $$ BEGIN
    ALTER TABLE "mitra_transactions" ADD CONSTRAINT "mitra_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "mitra_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: withdraw_requests -> mitra_wallets
DO $$ BEGIN
    ALTER TABLE "withdraw_requests" ADD CONSTRAINT "withdraw_requests_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "mitra_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: withdraw_requests -> User (processedBy)
DO $$ BEGIN
    ALTER TABLE "withdraw_requests" ADD CONSTRAINT "withdraw_requests_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
