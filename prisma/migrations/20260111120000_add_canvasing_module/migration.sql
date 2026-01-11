-- CreateEnum
CREATE TYPE "CanvasingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "configuration_restores" DROP CONSTRAINT "configuration_restore_olt_fkey";

-- DropForeignKey
ALTER TABLE "configuration_restores" DROP CONSTRAINT "configuration_restore_onu_fkey";

-- DropForeignKey
ALTER TABLE "network_alerts" DROP CONSTRAINT "network_alert_olt_fkey";

-- DropForeignKey
ALTER TABLE "network_alerts" DROP CONSTRAINT "network_alert_onu_fkey";

-- DropForeignKey
ALTER TABLE "network_performance" DROP CONSTRAINT "network_performance_olt_fkey";

-- DropForeignKey
ALTER TABLE "network_performance" DROP CONSTRAINT "network_performance_onu_fkey";

-- AlterTable
ALTER TABLE "configuration_restores" ADD COLUMN     "oltId" TEXT,
ADD COLUMN     "onuId" TEXT;

-- AlterTable
ALTER TABLE "network_alerts" ADD COLUMN     "oltId" TEXT,
ADD COLUMN     "onuId" TEXT;

-- AlterTable
ALTER TABLE "network_performance" ADD COLUMN     "oltId" TEXT,
ADD COLUMN     "onuId" TEXT;

-- CreateTable
CREATE TABLE "canvasing" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "noKtp" TEXT NOT NULL,
    "noTelpon" TEXT NOT NULL,
    "email" TEXT,
    "alamat" TEXT NOT NULL,
    "kabel" INTEGER NOT NULL,
    "odp" TEXT,
    "paket" TEXT NOT NULL,
    "sn" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "foto" TEXT,
    "status" "CanvasingStatus" NOT NULL DEFAULT 'PENDING',
    "salesId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "workOrderId" TEXT,

    CONSTRAINT "canvasing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canvasing_salesId_idx" ON "canvasing"("salesId");

-- CreateIndex
CREATE INDEX "canvasing_status_idx" ON "canvasing"("status");

-- AddForeignKey
ALTER TABLE "configuration_restores" ADD CONSTRAINT "configuration_restores_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_restores" ADD CONSTRAINT "configuration_restores_onuId_fkey" FOREIGN KEY ("onuId") REFERENCES "Onu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_alerts" ADD CONSTRAINT "network_alerts_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_alerts" ADD CONSTRAINT "network_alerts_onuId_fkey" FOREIGN KEY ("onuId") REFERENCES "Onu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_performance" ADD CONSTRAINT "network_performance_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_performance" ADD CONSTRAINT "network_performance_onuId_fkey" FOREIGN KEY ("onuId") REFERENCES "Onu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvasing" ADD CONSTRAINT "canvasing_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

