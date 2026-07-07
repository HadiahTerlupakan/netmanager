-- CreateEnum
CREATE TYPE "ResellerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Pelanggan" ADD COLUMN     "resellerId" TEXT,
ADD COLUMN     "resellerOutletId" TEXT;

-- CreateTable
CREATE TABLE "Reseller" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "ResellerStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Reseller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerOutlet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "resellerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "status" "ResellerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ResellerOutlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerPackagePrice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "resellerId" TEXT NOT NULL,
    "hargaPaketId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "ResellerStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ResellerPackagePrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reseller_tenantId_idx" ON "Reseller"("tenantId");

-- CreateIndex
CREATE INDEX "Reseller_status_idx" ON "Reseller"("status");

-- CreateIndex
CREATE INDEX "Reseller_deletedAt_idx" ON "Reseller"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reseller_tenantId_code_key" ON "Reseller"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ResellerOutlet_tenantId_idx" ON "ResellerOutlet"("tenantId");

-- CreateIndex
CREATE INDEX "ResellerOutlet_resellerId_idx" ON "ResellerOutlet"("resellerId");

-- CreateIndex
CREATE INDEX "ResellerOutlet_status_idx" ON "ResellerOutlet"("status");

-- CreateIndex
CREATE INDEX "ResellerOutlet_deletedAt_idx" ON "ResellerOutlet"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerOutlet_tenantId_resellerId_code_key" ON "ResellerOutlet"("tenantId", "resellerId", "code");

-- CreateIndex
CREATE INDEX "ResellerPackagePrice_tenantId_idx" ON "ResellerPackagePrice"("tenantId");

-- CreateIndex
CREATE INDEX "ResellerPackagePrice_resellerId_idx" ON "ResellerPackagePrice"("resellerId");

-- CreateIndex
CREATE INDEX "ResellerPackagePrice_hargaPaketId_idx" ON "ResellerPackagePrice"("hargaPaketId");

-- CreateIndex
CREATE INDEX "ResellerPackagePrice_status_idx" ON "ResellerPackagePrice"("status");

-- CreateIndex
CREATE INDEX "ResellerPackagePrice_deletedAt_idx" ON "ResellerPackagePrice"("deletedAt");

-- CreateIndex
CREATE INDEX "ResellerPackagePrice_startsAt_endsAt_idx" ON "ResellerPackagePrice"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Pelanggan_tenantId_resellerId_idx" ON "Pelanggan"("tenantId", "resellerId");

-- CreateIndex
CREATE INDEX "Pelanggan_tenantId_resellerOutletId_idx" ON "Pelanggan"("tenantId", "resellerOutletId");

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_resellerOutletId_fkey" FOREIGN KEY ("resellerOutletId") REFERENCES "ResellerOutlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reseller" ADD CONSTRAINT "Reseller_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerOutlet" ADD CONSTRAINT "ResellerOutlet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerOutlet" ADD CONSTRAINT "ResellerOutlet_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerPackagePrice" ADD CONSTRAINT "ResellerPackagePrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerPackagePrice" ADD CONSTRAINT "ResellerPackagePrice_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerPackagePrice" ADD CONSTRAINT "ResellerPackagePrice_hargaPaketId_fkey" FOREIGN KEY ("hargaPaketId") REFERENCES "HargaPaket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
