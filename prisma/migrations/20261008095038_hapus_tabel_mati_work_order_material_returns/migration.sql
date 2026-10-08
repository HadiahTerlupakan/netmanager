-- @safe-guard-ack: Tabel work_order_material_returns tidak pernah ditulis maupun dibaca kode mana pun; pengembalian barang menulis ke barang_masuk dan workOrderUpdates. Skemanya memuat status/verifiedById/verifiedAt sehingga menyesatkan pembaca seolah ada alur verifikasi retur. Tabel lokal kosong; isi produksi wajib dihitung sebelum deploy.
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
