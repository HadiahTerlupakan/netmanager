-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "purchasedQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "purchase_records" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,
    "fotoNota" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_record_items" (
    "id" TEXT NOT NULL,
    "purchaseRecordId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "tenantId" TEXT,

    CONSTRAINT "purchase_record_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_records_purchaseOrderId_idx" ON "purchase_records"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_records_supplierId_idx" ON "purchase_records"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_records_tenantId_idx" ON "purchase_records"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_record_items_purchaseRecordId_idx" ON "purchase_record_items"("purchaseRecordId");

-- CreateIndex
CREATE INDEX "purchase_record_items_purchaseOrderItemId_idx" ON "purchase_record_items"("purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "purchase_record_items_tenantId_idx" ON "purchase_record_items"("tenantId");

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_record_items" ADD CONSTRAINT "purchase_record_items_purchaseRecordId_fkey" FOREIGN KEY ("purchaseRecordId") REFERENCES "purchase_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_record_items" ADD CONSTRAINT "purchase_record_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_record_items" ADD CONSTRAINT "purchase_record_items_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_record_items" ADD CONSTRAINT "purchase_record_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
