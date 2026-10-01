-- CreateEnum
CREATE TYPE "PresurveiSumberRencana" AS ENUM ('MANDIRI', 'PENUGASAN');

-- CreateEnum
CREATE TYPE "PresurveiStatusRencana" AS ENUM ('DIRENCANAKAN', 'SELESAI', 'BATAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kepalaSalesId" TEXT;

-- CreateTable
CREATE TABLE "presurvei_rencana" (
    "id" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,
    "dibuatOlehId" TEXT NOT NULL,
    "sumber" "PresurveiSumberRencana" NOT NULL,
    "jenis" "PresurveiJenisKegiatan" NOT NULL DEFAULT 'KUNJUNGAN',
    "tanggal" DATE NOT NULL,
    "tujuan" TEXT NOT NULL,
    "prospekId" TEXT,
    "alamat" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "PresurveiStatusRencana" NOT NULL DEFAULT 'DIRENCANAKAN',
    "kegiatanId" TEXT,
    "dilaporkanAt" TIMESTAMP(3),
    "alasanBatal" TEXT,
    "dibatalkanOlehId" TEXT,
    "dibatalkanAt" TIMESTAMP(3),
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presurvei_rencana_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presurvei_rencana_kegiatanId_key" ON "presurvei_rencana"("kegiatanId");

-- CreateIndex
CREATE INDEX "presurvei_rencana_salesId_tanggal_idx" ON "presurvei_rencana"("salesId", "tanggal");

-- CreateIndex
CREATE INDEX "presurvei_rencana_dibuatOlehId_idx" ON "presurvei_rencana"("dibuatOlehId");

-- CreateIndex
CREATE INDEX "presurvei_rencana_prospekId_idx" ON "presurvei_rencana"("prospekId");

-- CreateIndex
CREATE INDEX "presurvei_rencana_tenantId_tanggal_idx" ON "presurvei_rencana"("tenantId", "tanggal");

-- CreateIndex
CREATE INDEX "User_kepalaSalesId_idx" ON "User"("kepalaSalesId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_kepalaSalesId_fkey" FOREIGN KEY ("kepalaSalesId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_rencana" ADD CONSTRAINT "presurvei_rencana_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_rencana" ADD CONSTRAINT "presurvei_rencana_dibuatOlehId_fkey" FOREIGN KEY ("dibuatOlehId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_rencana" ADD CONSTRAINT "presurvei_rencana_dibatalkanOlehId_fkey" FOREIGN KEY ("dibatalkanOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_rencana" ADD CONSTRAINT "presurvei_rencana_prospekId_fkey" FOREIGN KEY ("prospekId") REFERENCES "presurvei_prospek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_rencana" ADD CONSTRAINT "presurvei_rencana_kegiatanId_fkey" FOREIGN KEY ("kegiatanId") REFERENCES "presurvei_kegiatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_rencana" ADD CONSTRAINT "presurvei_rencana_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
