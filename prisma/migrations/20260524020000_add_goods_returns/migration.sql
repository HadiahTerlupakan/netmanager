-- Return to Vendor (RTV): retur barang yang sudah diterima kembali ke supplier.
-- Reference ke goods_receipts (batch mana yang diretur) untuk traceability.
-- Status SENT → RESOLVED (REFUNDED/REPLACED/CREDIT_NOTE/CANCELLED) menandai
-- gimana vendor menyelesaikan klaim.

CREATE TYPE "GoodsReturnReason" AS ENUM (
  'DAMAGED',
  'WRONG_SPEC',
  'EXCESS',
  'OTHER'
);

CREATE TYPE "GoodsReturnStatus" AS ENUM (
  'DRAFT',
  'SENT',
  'REFUNDED',
  'REPLACED',
  'CREDIT_NOTE',
  'CANCELLED'
);

CREATE TABLE "goods_returns" (
  "id" TEXT NOT NULL,
  "rtvNumber" TEXT NOT NULL,
  "goodsReceiptId" TEXT NOT NULL,
  "supplierId" TEXT,
  "gudangId" TEXT NOT NULL,
  "reason" "GoodsReturnReason" NOT NULL,
  "status" "GoodsReturnStatus" NOT NULL DEFAULT 'SENT',
  "returnedById" TEXT NOT NULL,
  "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "fotoBukti" TEXT[],
  "refundAmount" DOUBLE PRECISION,
  "replacementGrnId" TEXT,
  "creditNoteRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT,

  CONSTRAINT "goods_returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goods_returns_tenantId_rtvNumber_key"
  ON "goods_returns"("tenantId", "rtvNumber");
CREATE INDEX "goods_returns_goodsReceiptId_idx"
  ON "goods_returns"("goodsReceiptId");
CREATE INDEX "goods_returns_supplierId_idx"
  ON "goods_returns"("supplierId");
CREATE INDEX "goods_returns_tenantId_idx"
  ON "goods_returns"("tenantId");

ALTER TABLE "goods_returns"
  ADD CONSTRAINT "goods_returns_goodsReceiptId_fkey"
  FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_returns"
  ADD CONSTRAINT "goods_returns_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "goods_returns"
  ADD CONSTRAINT "goods_returns_gudangId_fkey"
  FOREIGN KEY ("gudangId") REFERENCES "gudang"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_returns"
  ADD CONSTRAINT "goods_returns_returnedById_fkey"
  FOREIGN KEY ("returnedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_returns"
  ADD CONSTRAINT "goods_returns_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "goods_return_items" (
  "id" TEXT NOT NULL,
  "goodsReturnId" TEXT NOT NULL,
  "goodsReceiptItemId" TEXT NOT NULL,
  "barangId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "notes" TEXT,
  "tenantId" TEXT,

  CONSTRAINT "goods_return_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goods_return_items_goodsReturnId_idx"
  ON "goods_return_items"("goodsReturnId");
CREATE INDEX "goods_return_items_goodsReceiptItemId_idx"
  ON "goods_return_items"("goodsReceiptItemId");
CREATE INDEX "goods_return_items_tenantId_idx"
  ON "goods_return_items"("tenantId");

ALTER TABLE "goods_return_items"
  ADD CONSTRAINT "goods_return_items_goodsReturnId_fkey"
  FOREIGN KEY ("goodsReturnId") REFERENCES "goods_returns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_return_items"
  ADD CONSTRAINT "goods_return_items_goodsReceiptItemId_fkey"
  FOREIGN KEY ("goodsReceiptItemId") REFERENCES "goods_receipt_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_return_items"
  ADD CONSTRAINT "goods_return_items_barangId_fkey"
  FOREIGN KEY ("barangId") REFERENCES "barang"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_return_items"
  ADD CONSTRAINT "goods_return_items_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
