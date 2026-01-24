-- DropIndex
DROP INDEX "idx_invoice_pelanggan_status";

-- DropIndex
DROP INDEX "idx_invoice_status_duedate";

-- DropIndex
DROP INDEX "idx_pelanggan_site_status";

-- DropIndex
DROP INDEX "idx_user_department_active";

-- DropIndex
DROP INDEX "idx_user_site_active";

-- DropIndex
DROP INDEX "idx_notifications_user_read";

-- DropIndex
DROP INDEX "idx_workorders_assigned_status";

-- DropIndex
DROP INDEX "idx_workorders_department_status";

-- AlterTable
ALTER TABLE "MixRadiusOwnerGroup" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "MixRadiusOwnerGroup_siteId_idx" ON "MixRadiusOwnerGroup"("siteId");

-- AddForeignKey
ALTER TABLE "MixRadiusOwnerGroup" ADD CONSTRAINT "MixRadiusOwnerGroup_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
