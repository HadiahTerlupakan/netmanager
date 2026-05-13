-- AlterTable: tambah field pending package change + saldo kredit ke Pelanggan
ALTER TABLE "Pelanggan"
  ADD COLUMN IF NOT EXISTS "pendingPackageId" TEXT,
  ADD COLUMN IF NOT EXISTS "pendingPackageApplyAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "saldoKreditRupiah" BIGINT NOT NULL DEFAULT 0;

-- CreateIndex: index untuk scheduled package apply
CREATE INDEX IF NOT EXISTS "Pelanggan_pendingPackageApplyAt_idx" ON "Pelanggan"("pendingPackageApplyAt");

-- AddForeignKey: relasi Pelanggan.pendingPackageId -> HargaPaket
ALTER TABLE "Pelanggan"
  ADD CONSTRAINT "Pelanggan_pendingPackageId_fkey"
  FOREIGN KEY ("pendingPackageId")
  REFERENCES "HargaPaket"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: log prorate saat ganti paket
CREATE TABLE IF NOT EXISTS "ProratePaymentLog" (
    "id" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "oldPackageId" TEXT NOT NULL,
    "newPackageId" TEXT NOT NULL,
    "prorateOption" TEXT NOT NULL,
    "downgradeAdjustment" TEXT NOT NULL,
    "upgradeApplyTime" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "sisaHari" INTEGER NOT NULL,
    "totalHari" INTEGER NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT,

    CONSTRAINT "ProratePaymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: indexes untuk ProratePaymentLog
CREATE INDEX IF NOT EXISTS "ProratePaymentLog_pelangganId_idx" ON "ProratePaymentLog"("pelangganId");
CREATE INDEX IF NOT EXISTS "ProratePaymentLog_tenantId_idx" ON "ProratePaymentLog"("tenantId");
CREATE INDEX IF NOT EXISTS "ProratePaymentLog_createdAt_idx" ON "ProratePaymentLog"("createdAt");

-- AddForeignKey: relasi ProratePaymentLog.tenantId -> Tenant
ALTER TABLE "ProratePaymentLog"
  ADD CONSTRAINT "ProratePaymentLog_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
