-- AlterTable
ALTER TABLE "barang_keluar" ADD COLUMN     "opnameId" TEXT;

-- AlterTable
ALTER TABLE "barang_masuk" ADD COLUMN     "opnameId" TEXT;

-- CreateIndex
CREATE INDEX "barang_keluar_opnameId_idx" ON "barang_keluar"("opnameId");

-- CreateIndex
CREATE INDEX "barang_masuk_opnameId_idx" ON "barang_masuk"("opnameId");

-- Backfill: mutasi opname lama hanya ditautkan lewat teks "Ref: <opnameId>"
-- di akhir keterangan. Tautkan yang opname-nya masih ada; barang & gudang
-- harus sama agar teks yang kebetulan mirip tidak salah tertaut.
UPDATE "barang_keluar" AS bk
SET "opnameId" = so."id"
FROM "stock_opname" AS so
WHERE bk."opnameId" IS NULL
  AND bk."keterangan" LIKE 'Opname:%'
  AND substring(bk."keterangan" from 'Ref: ([0-9A-Za-z-]+)$') = so."id"
  AND bk."barangId" = so."barangId"
  AND bk."gudangId" = so."gudangId";

UPDATE "barang_masuk" AS bm
SET "opnameId" = so."id"
FROM "stock_opname" AS so
WHERE bm."opnameId" IS NULL
  AND bm."keterangan" LIKE 'Opname:%'
  AND substring(bm."keterangan" from 'Ref: ([0-9A-Za-z-]+)$') = so."id"
  AND bm."barangId" = so."barangId"
  AND bm."gudangId" = so."gudangId";

-- AddForeignKey
ALTER TABLE "barang_keluar" ADD CONSTRAINT "barang_keluar_opnameId_fkey" FOREIGN KEY ("opnameId") REFERENCES "stock_opname"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barang_masuk" ADD CONSTRAINT "barang_masuk_opnameId_fkey" FOREIGN KEY ("opnameId") REFERENCES "stock_opname"("id") ON DELETE SET NULL ON UPDATE CASCADE;
