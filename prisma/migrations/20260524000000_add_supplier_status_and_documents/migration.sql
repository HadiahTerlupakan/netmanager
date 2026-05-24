-- Add lifecycle status + dokumen kelengkapan ke master Supplier.
-- Tujuan: cegah PO dibuat ke supplier non-aktif/blacklisted, simpan jejak
-- compliance (SIUP, NPWP scan, rekening bank, kontrak).

CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

ALTER TABLE "suppliers"
  ADD COLUMN "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "blacklistReason" TEXT,
  ADD COLUMN "siupNumber" TEXT,
  ADD COLUMN "siupDocumentUrl" TEXT,
  ADD COLUMN "npwpDocumentUrl" TEXT,
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "bankAccountNumber" TEXT,
  ADD COLUMN "bankAccountHolder" TEXT,
  ADD COLUMN "contractDocumentUrl" TEXT,
  ADD COLUMN "contractExpiresAt" TIMESTAMP(3);

CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");
