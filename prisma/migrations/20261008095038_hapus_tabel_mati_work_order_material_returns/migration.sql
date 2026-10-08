/*
  Warnings:

  - You are about to drop the `work_order_material_returns` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "work_order_material_returns" DROP CONSTRAINT "work_order_material_returns_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "work_order_material_returns" DROP CONSTRAINT "work_order_material_returns_workOrderId_fkey";

-- DropTable
DROP TABLE "work_order_material_returns";

-- DropEnum
DROP TYPE "MaterialReturnStatus";
