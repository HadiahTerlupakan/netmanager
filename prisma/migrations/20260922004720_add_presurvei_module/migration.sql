-- CreateEnum
CREATE TYPE "PresurveiJenisKegiatan" AS ENUM ('KUNJUNGAN', 'SURVEI_LOKASI', 'TELEPON', 'CHAT', 'IKLAN');

-- CreateEnum
CREATE TYPE "PresurveiHasilKegiatan" AS ENUM ('TERTARIK', 'PERLU_FOLLOWUP', 'TIDAK_MINAT', 'TIDAK_ADA_ORANG', 'DEAL');

-- CreateEnum
CREATE TYPE "PresurveiSumberProspek" AS ENUM ('LAPANGAN', 'IKLAN', 'WEBSITE', 'REFERRAL', 'WALK_IN');

-- CreateEnum
CREATE TYPE "PresurveiStatusProspek" AS ENUM ('BARU', 'DIHUBUNGI', 'TERTARIK', 'NEGOSIASI', 'DEAL', 'TIDAK_MINAT', 'TIDAK_LAYAK');

-- CreateEnum
CREATE TYPE "PresurveiChannelIklan" AS ENUM ('META', 'GOOGLE', 'TIKTOK', 'WHATSAPP', 'OFFLINE', 'LAINNYA');

-- CreateTable
CREATE TABLE "presurvei_kegiatan" (
    "id" TEXT NOT NULL,
    "jenis" "PresurveiJenisKegiatan" NOT NULL,
    "userId" TEXT NOT NULL,
    "prospekId" TEXT,
    "iklanId" TEXT,
    "waktuMulai" TIMESTAMP(3) NOT NULL,
    "waktuSelesai" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "alamatDikunjungi" TEXT,
    "ditemuiNama" TEXT,
    "hasil" "PresurveiHasilKegiatan" NOT NULL,
    "catatan" TEXT,
    "fotoUrls" TEXT[],
    "odpTerdekat" TEXT,
    "estimasiKabelMeter" INTEGER,
    "catatanTeknis" TEXT,
    "siteId" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presurvei_kegiatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presurvei_prospek" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "noTelp" TEXT NOT NULL,
    "email" TEXT,
    "alamat" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "shareloc" TEXT,
    "sumber" "PresurveiSumberProspek" NOT NULL,
    "iklanId" TEXT,
    "registrationId" TEXT,
    "referralNama" TEXT,
    "status" "PresurveiStatusProspek" NOT NULL DEFAULT 'BARU',
    "pemilikId" TEXT,
    "paketDiminati" TEXT,
    "catatan" TEXT,
    "canvasingId" TEXT,
    "konversiAt" TIMESTAMP(3),
    "siteId" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presurvei_prospek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presurvei_iklan" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "channel" "PresurveiChannelIklan" NOT NULL,
    "tanggalMulai" TIMESTAMP(3) NOT NULL,
    "tanggalSelesai" TIMESTAMP(3),
    "biaya" DECIMAL(15,2),
    "penanggungJawabId" TEXT,
    "isAktif" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presurvei_iklan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presurvei_target" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeTahun" INTEGER NOT NULL,
    "periodeBulan" INTEGER NOT NULL,
    "targetKunjungan" INTEGER NOT NULL DEFAULT 0,
    "targetProspek" INTEGER NOT NULL DEFAULT 0,
    "targetKonversi" INTEGER NOT NULL DEFAULT 0,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presurvei_target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presurvei_kegiatan_userId_waktuMulai_idx" ON "presurvei_kegiatan"("userId", "waktuMulai");

-- CreateIndex
CREATE INDEX "presurvei_kegiatan_prospekId_idx" ON "presurvei_kegiatan"("prospekId");

-- CreateIndex
CREATE INDEX "presurvei_kegiatan_iklanId_idx" ON "presurvei_kegiatan"("iklanId");

-- CreateIndex
CREATE INDEX "presurvei_kegiatan_tenantId_idx" ON "presurvei_kegiatan"("tenantId");

-- CreateIndex
CREATE INDEX "presurvei_kegiatan_jenis_hasil_idx" ON "presurvei_kegiatan"("jenis", "hasil");

-- CreateIndex
CREATE UNIQUE INDEX "presurvei_prospek_registrationId_key" ON "presurvei_prospek"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "presurvei_prospek_canvasingId_key" ON "presurvei_prospek"("canvasingId");

-- CreateIndex
CREATE INDEX "presurvei_prospek_pemilikId_status_idx" ON "presurvei_prospek"("pemilikId", "status");

-- CreateIndex
CREATE INDEX "presurvei_prospek_sumber_idx" ON "presurvei_prospek"("sumber");

-- CreateIndex
CREATE INDEX "presurvei_prospek_tenantId_idx" ON "presurvei_prospek"("tenantId");

-- CreateIndex
CREATE INDEX "presurvei_prospek_createdAt_idx" ON "presurvei_prospek"("createdAt");

-- CreateIndex
CREATE INDEX "presurvei_iklan_tenantId_idx" ON "presurvei_iklan"("tenantId");

-- CreateIndex
CREATE INDEX "presurvei_iklan_isAktif_tanggalMulai_idx" ON "presurvei_iklan"("isAktif", "tanggalMulai");

-- CreateIndex
CREATE UNIQUE INDEX "presurvei_iklan_kode_tenantId_key" ON "presurvei_iklan"("kode", "tenantId");

-- CreateIndex
CREATE INDEX "presurvei_target_tenantId_idx" ON "presurvei_target"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "presurvei_target_userId_periodeTahun_periodeBulan_tenantId_key" ON "presurvei_target"("userId", "periodeTahun", "periodeBulan", "tenantId");

-- AddForeignKey
ALTER TABLE "presurvei_kegiatan" ADD CONSTRAINT "presurvei_kegiatan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_kegiatan" ADD CONSTRAINT "presurvei_kegiatan_prospekId_fkey" FOREIGN KEY ("prospekId") REFERENCES "presurvei_prospek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_kegiatan" ADD CONSTRAINT "presurvei_kegiatan_iklanId_fkey" FOREIGN KEY ("iklanId") REFERENCES "presurvei_iklan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_kegiatan" ADD CONSTRAINT "presurvei_kegiatan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_kegiatan" ADD CONSTRAINT "presurvei_kegiatan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_prospek" ADD CONSTRAINT "presurvei_prospek_iklanId_fkey" FOREIGN KEY ("iklanId") REFERENCES "presurvei_iklan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_prospek" ADD CONSTRAINT "presurvei_prospek_pemilikId_fkey" FOREIGN KEY ("pemilikId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_prospek" ADD CONSTRAINT "presurvei_prospek_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_prospek" ADD CONSTRAINT "presurvei_prospek_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_iklan" ADD CONSTRAINT "presurvei_iklan_penanggungJawabId_fkey" FOREIGN KEY ("penanggungJawabId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_iklan" ADD CONSTRAINT "presurvei_iklan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_target" ADD CONSTRAINT "presurvei_target_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_target" ADD CONSTRAINT "presurvei_target_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

