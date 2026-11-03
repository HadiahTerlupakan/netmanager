-- @safe-guard-ack: ALTER COLUMN sourceAccruedAt SET NOT NULL setelah kolom diisi dari ResellerCommission.accruedAt; tabel ResellerCommissionAdjustment baru dibuat di rilis yang sama (kosong di produksi). Unique index diganti versi gabungan. Tidak ada DROP TABLE/DROP COLUMN/TRUNCATE.
-- Komisi yang ditagih balik lalu terbit ulang (invoice lunas lagi) bisa
-- ditagih balik lagi: koreksi kini unik per akrual (komisi + accruedAt),
-- bukan per komisi.

-- AlterTable: tambah nullable, isi dari akrual komisi sumbernya, lalu wajibkan.
ALTER TABLE "ResellerCommissionAdjustment" ADD COLUMN     "sourceAccruedAt" TIMESTAMP(3);

UPDATE "ResellerCommissionAdjustment" AS adjustment
SET "sourceAccruedAt" = commission."accruedAt"
FROM "ResellerCommission" AS commission
WHERE commission."id" = adjustment."sourceCommissionId";

ALTER TABLE "ResellerCommissionAdjustment" ALTER COLUMN "sourceAccruedAt" SET NOT NULL;

-- DropIndex
DROP INDEX "ResellerCommissionAdjustment_sourceCommissionId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ResellerCommissionAdjustment_sourceCommissionId_sourceAccru_key" ON "ResellerCommissionAdjustment"("sourceCommissionId", "sourceAccruedAt");
