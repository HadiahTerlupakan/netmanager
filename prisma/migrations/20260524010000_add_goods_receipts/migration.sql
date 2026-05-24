-- Goods Receipt Note (GRN): dokumen penerimaan barang per batch.
-- Satu PO dapat punya banyak GRN (vendor kirim parsial). Header GRN
-- menyimpan referensi PO, gudang tujuan, penerima, foto bukti; detail
-- per barang di GoodsReceiptItem.
--
-- Status DRAFT/POSTED/CANCELLED: stok hanya di-update saat POSTED supaya
-- tidak double-count saat draft. Migration ini hanya membuat tabel +
-- enum + indeks; flow stock-in tetap ada di service layer (lihat
-- modules/procurement/services/GoodsReceiptService.ts).

CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

CREATE TABLE "goods_receipts" (
  "id" TEXT NOT NULL,
  "grnNumber" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "gudangId" TEXT NOT NULL,
  "receivedById" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'POSTED',
  "notes" TEXT,
  "fotoBukti" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT,

  CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goods_receipts_tenantId_grnNumber_key"
  ON "goods_receipts"("tenantId", "grnNumber");

CREATE INDEX "goods_receipts_purchaseOrderId_idx"
  ON "goods_receipts"("purchaseOrderId");

CREATE INDEX "goods_receipts_tenantId_idx"
  ON "goods_receipts"("tenantId");

ALTER TABLE "goods_receipts"
  ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipts"
  ADD CONSTRAINT "goods_receipts_gudangId_fkey"
  FOREIGN KEY ("gudangId") REFERENCES "gudang"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipts"
  ADD CONSTRAINT "goods_receipts_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipts"
  ADD CONSTRAINT "goods_receipts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "goods_receipt_items" (
  "id" TEXT NOT NULL,
  "goodsReceiptId" TEXT NOT NULL,
  "purchaseOrderItemId" TEXT NOT NULL,
  "barangId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "notes" TEXT,
  "tenantId" TEXT,

  CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goods_receipt_items_goodsReceiptId_idx"
  ON "goods_receipt_items"("goodsReceiptId");

CREATE INDEX "goods_receipt_items_purchaseOrderItemId_idx"
  ON "goods_receipt_items"("purchaseOrderItemId");

CREATE INDEX "goods_receipt_items_tenantId_idx"
  ON "goods_receipt_items"("tenantId");

ALTER TABLE "goods_receipt_items"
  ADD CONSTRAINT "goods_receipt_items_goodsReceiptId_fkey"
  FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_items"
  ADD CONSTRAINT "goods_receipt_items_purchaseOrderItemId_fkey"
  FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_items"
  ADD CONSTRAINT "goods_receipt_items_barangId_fkey"
  FOREIGN KEY ("barangId") REFERENCES "barang"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_items"
  ADD CONSTRAINT "goods_receipt_items_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
