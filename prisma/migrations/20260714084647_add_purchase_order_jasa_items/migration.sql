-- CreateTable
CREATE TABLE "purchase_order_jasa_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "jasaId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_jasa_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_order_jasa_items_tenantId_idx" ON "purchase_order_jasa_items"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_order_jasa_items_purchaseOrderId_idx" ON "purchase_order_jasa_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_jasa_items_jasaId_idx" ON "purchase_order_jasa_items"("jasaId");

-- AddForeignKey
ALTER TABLE "purchase_order_jasa_items" ADD CONSTRAINT "purchase_order_jasa_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_jasa_items" ADD CONSTRAINT "purchase_order_jasa_items_jasaId_fkey" FOREIGN KEY ("jasaId") REFERENCES "jasa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_jasa_items" ADD CONSTRAINT "purchase_order_jasa_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;