-- CreateTable
CREATE TABLE "work_order_materials" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "satuan" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_template_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_order_materials_workOrderId_idx" ON "work_order_materials"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_materials_barangId_idx" ON "work_order_materials"("barangId");

-- CreateIndex
CREATE INDEX "work_order_template_items_templateId_idx" ON "work_order_template_items"("templateId");

-- AddForeignKey
ALTER TABLE "work_order_materials" ADD CONSTRAINT "work_order_materials_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_materials" ADD CONSTRAINT "work_order_materials_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_template_items" ADD CONSTRAINT "work_order_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "work_order_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
