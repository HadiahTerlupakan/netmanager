/*
  Warnings:

  - You are about to drop the column `password` on the `Investor` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,tenantId]` on the table `Bandwidth` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,code]` on the table `Coupon` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,name]` on the table `ExpenseCategory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,name,siteId]` on the table `HargaPaket` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,ipAddress]` on the table `MikroTikRouter` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,idPelanggan]` on the table `Pelanggan` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,tenantId]` on the table `ProfilePPP` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,code]` on the table `Shift` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,productClass]` on the table `acs_wifi_security` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,kodeAsset]` on the table `assets` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,kode]` on the table `barang` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,tenantId]` on the table `departments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,kode]` on the table `gudang` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,poNumber]` on the table `purchase_orders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,nomorRequest]` on the table `purchase_requests` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,name]` on the table `salary_components` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,ticketNumber]` on the table `support_tickets` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,workOrderNumber]` on the table `work_orders` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Bandwidth_name_key";

-- DropIndex
DROP INDEX "Coupon_code_key";

-- DropIndex
DROP INDEX "HargaPaket_name_siteId_key";

-- DropIndex
DROP INDEX "MikroTikRouter_ipAddress_key";

-- DropIndex
DROP INDEX "Pelanggan_idPelanggan_key";

-- DropIndex
DROP INDEX "Shift_code_key";

-- DropIndex
DROP INDEX "acs_wifi_security_productClass_key";

-- DropIndex
DROP INDEX "assets_kodeAsset_key";

-- DropIndex
DROP INDEX "barang_kode_key";

-- DropIndex
DROP INDEX "departments_name_key";

-- DropIndex
DROP INDEX "gudang_kode_key";

-- DropIndex
DROP INDEX "purchase_orders_poNumber_key";

-- DropIndex
DROP INDEX "purchase_requests_nomorRequest_key";

-- DropIndex
DROP INDEX "salary_components_name_key";

-- DropIndex
DROP INDEX "support_tickets_ticketNumber_idx";

-- DropIndex
DROP INDEX "support_tickets_ticketNumber_key";

-- DropIndex
DROP INDEX "work_orders_workOrderNumber_idx";

-- DropIndex
DROP INDEX "work_orders_workOrderNumber_key";

-- AlterTable
ALTER TABLE "Investor" DROP COLUMN "password";

-- AlterTable
ALTER TABLE "ProfilePPP" ADD COLUMN     "poolMode" TEXT DEFAULT 'MIKROTIK';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAttendanceRequired" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "barang" ADD COLUMN     "minStokDefault" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "receivedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "fotoBukti" TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "Bandwidth_name_tenantId_key" ON "Bandwidth"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_tenantId_code_key" ON "Coupon"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_tenantId_name_key" ON "ExpenseCategory"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "HargaPaket_tenantId_name_siteId_key" ON "HargaPaket"("tenantId", "name", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "MikroTikRouter_tenantId_ipAddress_key" ON "MikroTikRouter"("tenantId", "ipAddress");

-- CreateIndex
CREATE INDEX "Pelanggan_userId_idx" ON "Pelanggan"("userId");

-- CreateIndex
CREATE INDEX "Pelanggan_odpId_idx" ON "Pelanggan"("odpId");

-- CreateIndex
CREATE INDEX "Pelanggan_syncStatus_idx" ON "Pelanggan"("syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Pelanggan_tenantId_idPelanggan_key" ON "Pelanggan"("tenantId", "idPelanggan");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePPP_name_tenantId_key" ON "ProfilePPP"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_tenantId_code_key" ON "Shift"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "acs_wifi_security_tenantId_productClass_key" ON "acs_wifi_security"("tenantId", "productClass");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tenantId_kodeAsset_key" ON "assets"("tenantId", "kodeAsset");

-- CreateIndex
CREATE UNIQUE INDEX "barang_tenantId_kode_key" ON "barang"("tenantId", "kode");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_tenantId_key" ON "departments"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "gudang_tenantId_kode_key" ON "gudang"("tenantId", "kode");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenantId_poNumber_key" ON "purchase_orders"("tenantId", "poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_tenantId_nomorRequest_key" ON "purchase_requests"("tenantId", "nomorRequest");

-- CreateIndex
CREATE UNIQUE INDEX "salary_components_tenantId_name_key" ON "salary_components"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_tenantId_ticketNumber_key" ON "support_tickets"("tenantId", "ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_tenantId_workOrderNumber_key" ON "work_orders"("tenantId", "workOrderNumber");

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
