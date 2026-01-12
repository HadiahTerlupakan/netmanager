/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to alter the column `flexibleTargetHour` on the `User` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the `Departments` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- ALTER TYPE "LeaveType" ADD VALUE 'TUKAR_LIBUR';

-- DropForeignKey
-- ALTER TABLE "User" DROP CONSTRAINT "User_departmentId_fkey";

-- AlterTable
-- ALTER TABLE "Attendance" ADD COLUMN     "geofenceMeta" JSONB;

-- AlterTable
-- ALTER TABLE "Expense" ADD COLUMN     "siteId" TEXT;

-- AlterTable
-- ALTER TABLE "Invoice" ADD COLUMN     "siteId" TEXT;

-- AlterTable
-- ALTER TABLE "LeaveRequest" ADD COLUMN     "replacementDate" TIMESTAMP(3);

-- AlterTable
-- ALTER TABLE "MikroTikRouter" ADD COLUMN     "siteId" TEXT;

-- AlterTable
-- ALTER TABLE "Odc" ADD COLUMN     "siteId" TEXT;

-- AlterTable
-- ALTER TABLE "Odp" ADD COLUMN     "siteId" TEXT;

-- AlterTable
-- ALTER TABLE "Olt" ADD COLUMN     "siteId" TEXT;

-- AlterTable
-- ALTER TABLE "Otb" ADD COLUMN     "siteId" TEXT;

-- AlterTable
-- ALTER TABLE "Pelanggan" ADD COLUMN     "siteId" TEXT;

-- AlterTable
-- ALTER TABLE "Pole" ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "User" -- DROP COLUMN "role",
ADD COLUMN     "canvasingTarget" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "isSales" BOOLEAN NOT NULL DEFAULT false,
-- ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "flexibleTargetHour" DROP DEFAULT,
ALTER COLUMN "flexibleTargetHour" SET DATA TYPE INTEGER;

-- AlterTable
-- ALTER TABLE "canvasing" ADD COLUMN     "fotoKtp" TEXT;

-- AlterTable
-- ALTER TABLE "notifications" ADD COLUMN     "siteId" TEXT;

-- AlterTable
-- ALTER TABLE "roles" RENAME CONSTRAINT "Role_pkey" TO "roles_pkey";

-- DropTable
-- DROP TABLE "Departments";

-- DropEnum
-- DROP TYPE "Role";

-- CreateIndex
-- CREATE INDEX "Expense_siteId_idx" ON "Expense"("siteId");

-- CreateIndex
-- CREATE INDEX "Invoice_siteId_idx" ON "Invoice"("siteId");

-- CreateIndex
-- CREATE INDEX "MikroTikRouter_siteId_idx" ON "MikroTikRouter"("siteId");

-- CreateIndex
-- CREATE INDEX "Odc_siteId_idx" ON "Odc"("siteId");

-- CreateIndex
-- CREATE INDEX "Odp_siteId_idx" ON "Odp"("siteId");

-- CreateIndex
-- CREATE INDEX "Olt_siteId_idx" ON "Olt"("siteId");

-- CreateIndex
-- CREATE INDEX "Otb_siteId_idx" ON "Otb"("siteId");

-- CreateIndex
-- CREATE INDEX "Pelanggan_siteId_idx" ON "Pelanggan"("siteId");

-- CreateIndex
-- CREATE INDEX "Pole_siteId_idx" ON "Pole"("siteId");

-- CreateIndex
-- CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
-- CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
-- CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
-- CREATE INDEX "User_siteId_idx" ON "User"("siteId");

-- CreateIndex
CREATE INDEX "barang_keluar_userId_tanggal_idx" ON "barang_keluar"("userId", "tanggal" DESC);

-- CreateIndex
CREATE INDEX "barang_keluar_gudangId_tanggal_idx" ON "barang_keluar"("gudangId", "tanggal" DESC);

-- CreateIndex
CREATE INDEX "barang_masuk_userId_tanggal_idx" ON "barang_masuk"("userId", "tanggal" DESC);

-- CreateIndex
CREATE INDEX "barang_masuk_gudangId_tanggal_idx" ON "barang_masuk"("gudangId", "tanggal" DESC);

-- CreateIndex
-- CREATE INDEX "employee_locations_userId_idx" ON "employee_locations"("userId");

-- CreateIndex
-- CREATE INDEX "employee_locations_recordedAt_idx" ON "employee_locations"("recordedAt");

-- CreateIndex
-- CREATE INDEX "employee_locations_userId_recordedAt_idx" ON "employee_locations"("userId", "recordedAt");

-- AddForeignKey
-- ALTER TABLE "employee_locations" ADD CONSTRAINT "employee_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "Expense" ADD CONSTRAINT "Expense_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "MikroTikRouter" ADD CONSTRAINT "MikroTikRouter_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "Odc" ADD CONSTRAINT "Odc_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "Odp" ADD CONSTRAINT "Odp_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "Olt" ADD CONSTRAINT "Olt_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "Otb" ADD CONSTRAINT "Otb_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "Pelanggan" ADD CONSTRAINT "Pelanggan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "Pole" ADD CONSTRAINT "Pole_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- ALTER TABLE "notifications" ADD CONSTRAINT "notifications_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
-- ALTER INDEX "work_orders_created_at_idx" RENAME TO "work_orders_createdAt_idx";

-- RenameIndex
-- ALTER INDEX "work_orders_status_created_at_idx" RENAME TO "work_orders_status_createdAt_idx";

-- RenameIndex
-- ALTER INDEX "work_orders_status_department_id_idx" RENAME TO "work_orders_status_departmentId_idx";
