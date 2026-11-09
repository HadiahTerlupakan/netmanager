-- CreateEnum
CREATE TYPE "PurchaseRecordSource" AS ENUM ('ADMIN', 'PUBLIC_LINK');

-- AlterTable
ALTER TABLE "purchase_records" ADD COLUMN     "buyerName" TEXT,
ADD COLUMN     "buyerSignatureKey" TEXT,
ADD COLUMN     "clientRequestId" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "purchaseLinkId" TEXT,
ADD COLUMN     "source" "PurchaseRecordSource" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "restock_purchase_links" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restock_purchase_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restock_purchase_links_tokenHash_key" ON "restock_purchase_links"("tokenHash");

-- CreateIndex
CREATE INDEX "restock_purchase_links_purchaseRequestId_revokedAt_idx" ON "restock_purchase_links"("purchaseRequestId", "revokedAt");

-- CreateIndex
CREATE INDEX "restock_purchase_links_tenantId_idx" ON "restock_purchase_links"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_records_purchaseLinkId_clientRequestId_key" ON "purchase_records"("purchaseLinkId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_purchaseLinkId_fkey" FOREIGN KEY ("purchaseLinkId") REFERENCES "restock_purchase_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_purchase_links" ADD CONSTRAINT "restock_purchase_links_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_purchase_links" ADD CONSTRAINT "restock_purchase_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_purchase_links" ADD CONSTRAINT "restock_purchase_links_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_purchase_links" ADD CONSTRAINT "restock_purchase_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

