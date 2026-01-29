-- CreateEnum
CREATE TYPE "MaterialReturnStatus" AS ENUM ('PENDING', 'VERIFIED', 'RETURNED_TO_WAREHOUSE', 'REJECTED');

-- CreateTable
CREATE TABLE "work_order_material_returns" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "kondisi" "KondisiBarang" NOT NULL DEFAULT 'BARU',
    "returnedToGudangId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "returnedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "status" "MaterialReturnStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_material_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_order_material_returns_workOrderId_idx" ON "work_order_material_returns"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_material_returns_barangId_idx" ON "work_order_material_returns"("barangId");

-- CreateIndex
CREATE INDEX "work_order_material_returns_status_idx" ON "work_order_material_returns"("status");

-- AddForeignKey
ALTER TABLE "work_order_material_returns" ADD CONSTRAINT "work_order_material_returns_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
