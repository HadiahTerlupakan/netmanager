-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MitraType" AS ENUM ('MITRA_SALES', 'MITRA_TEKNISI');

-- CreateEnum
CREATE TYPE "MitraTransactionType" AS ENUM ('EARNING', 'WITHDRAW', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WithdrawStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WithdrawMethod" AS ENUM ('TRANSFER', 'CASH');

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
    "pushToken" TEXT,
    "pushTokenUpdatedAt" TIMESTAMP(3),
    "fcmTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mitraRateWoPsb" DOUBLE PRECISION,
    "mitraRateWoMaintenance" DOUBLE PRECISION,
    "mitraRateCanvasing" DOUBLE PRECISION,
    "mitraRateFeePelanggan" DOUBLE PRECISION,
    "enableFeePelanggan" BOOLEAN NOT NULL DEFAULT false,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "bankAccountName" TEXT,
    "targetHarian" INTEGER,
    "minWithdrawal" INTEGER,
    "mixradiusOwnerNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nik" TEXT,
    "tempatLahir" TEXT,
    "tanggalLahir" TIMESTAMP(3),
    "alamat" TEXT,
    "latitudeRumah" DOUBLE PRECISION,
    "longitudeRumah" DOUBLE PRECISION,
    "fotoDiri" TEXT,
    "fotoKtp" TEXT,
    "fotoSim" TEXT,
    "fotoKk" TEXT,
    "requiresFaceVerification" BOOLEAN NOT NULL DEFAULT false,
    "lastFaceVerification" TIMESTAMP(3),
    "garansiHari" INTEGER DEFAULT 7,
    "slaGaransiJam" INTEGER DEFAULT 24,
    "penaltyPsb" DOUBLE PRECISION DEFAULT 0,
    "penaltyMaintenance" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mitra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mitra_wallets" (
    "id" TEXT NOT NULL,
    "mitraId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWithdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mitra_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mitra_transactions" (
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

-- CreateTable
CREATE TABLE "withdraw_requests" (
    "id" TEXT NOT NULL,
    "mitraId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccountNo" TEXT NOT NULL,
    "bankAccountName" TEXT NOT NULL,
    "status" "WithdrawStatus" NOT NULL DEFAULT 'PENDING',
    "method" "WithdrawMethod" NOT NULL DEFAULT 'TRANSFER',
    "notes" TEXT,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mitraWalletId" TEXT,

    CONSTRAINT "withdraw_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_verification_logs" (
    "id" TEXT NOT NULL,
    "mitraId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mitra_email_key" ON "Mitra"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Mitra_nik_key" ON "Mitra"("nik");

-- CreateIndex
CREATE INDEX "Mitra_siteId_idx" ON "Mitra"("siteId");

-- CreateIndex
CREATE INDEX "Mitra_mitraType_idx" ON "Mitra"("mitraType");

-- CreateIndex
CREATE INDEX "Mitra_isActive_idx" ON "Mitra"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "mitra_wallets_mitraId_key" ON "mitra_wallets"("mitraId");

-- CreateIndex
CREATE INDEX "mitra_wallets_mitraId_idx" ON "mitra_wallets"("mitraId");

-- CreateIndex
CREATE INDEX "mitra_transactions_walletId_idx" ON "mitra_transactions"("walletId");

-- CreateIndex
CREATE INDEX "mitra_transactions_createdAt_idx" ON "mitra_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "mitra_transactions_referenceId_idx" ON "mitra_transactions"("referenceId");

-- CreateIndex
CREATE INDEX "withdraw_requests_mitraId_idx" ON "withdraw_requests"("mitraId");

-- CreateIndex
CREATE INDEX "withdraw_requests_status_idx" ON "withdraw_requests"("status");

-- CreateIndex
CREATE INDEX "withdraw_requests_createdAt_idx" ON "withdraw_requests"("createdAt");

-- CreateIndex
CREATE INDEX "face_verification_logs_mitraId_idx" ON "face_verification_logs"("mitraId");

-- CreateIndex
CREATE INDEX "face_verification_logs_createdAt_idx" ON "face_verification_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "mitra_wallets" ADD CONSTRAINT "mitra_wallets_mitraId_fkey" FOREIGN KEY ("mitraId") REFERENCES "Mitra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mitra_transactions" ADD CONSTRAINT "mitra_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "mitra_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdraw_requests" ADD CONSTRAINT "withdraw_requests_mitraId_fkey" FOREIGN KEY ("mitraId") REFERENCES "Mitra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdraw_requests" ADD CONSTRAINT "withdraw_requests_mitraWalletId_fkey" FOREIGN KEY ("mitraWalletId") REFERENCES "mitra_wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_verification_logs" ADD CONSTRAINT "face_verification_logs_mitraId_fkey" FOREIGN KEY ("mitraId") REFERENCES "Mitra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

