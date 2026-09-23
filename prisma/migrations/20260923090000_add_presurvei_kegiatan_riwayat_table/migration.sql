-- CreateTable
CREATE TABLE "presurvei_kegiatan_riwayat" (
    "id" TEXT NOT NULL,
    "kegiatanId" TEXT NOT NULL,
    "tenantId" TEXT,
    "diubahOlehId" TEXT,
    "diubahPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "perubahan" JSONB NOT NULL,

    CONSTRAINT "presurvei_kegiatan_riwayat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presurvei_kegiatan_riwayat_kegiatanId_idx" ON "presurvei_kegiatan_riwayat"("kegiatanId");

-- CreateIndex
CREATE INDEX "presurvei_kegiatan_riwayat_tenantId_idx" ON "presurvei_kegiatan_riwayat"("tenantId");

-- AddForeignKey
ALTER TABLE "presurvei_kegiatan_riwayat" ADD CONSTRAINT "presurvei_kegiatan_riwayat_kegiatanId_fkey" FOREIGN KEY ("kegiatanId") REFERENCES "presurvei_kegiatan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_kegiatan_riwayat" ADD CONSTRAINT "presurvei_kegiatan_riwayat_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presurvei_kegiatan_riwayat" ADD CONSTRAINT "presurvei_kegiatan_riwayat_diubahOlehId_fkey" FOREIGN KEY ("diubahOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

