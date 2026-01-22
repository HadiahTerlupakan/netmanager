/*
  Warnings:

  - A unique constraint covering the columns `[mixRadiusId]` on the table `Pelanggan` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Pelanggan" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "mixRadiusId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pelanggan_mixRadiusId_key" ON "Pelanggan"("mixRadiusId");
