-- DropIndex
DROP INDEX "presurvei_rencana_salesId_tanggal_idx";

-- AlterTable
ALTER TABLE "presurvei_rencana" ADD COLUMN     "jam" TEXT;

-- CreateIndex
CREATE INDEX "presurvei_rencana_salesId_tanggal_jam_idx" ON "presurvei_rencana"("salesId", "tanggal", "jam");
