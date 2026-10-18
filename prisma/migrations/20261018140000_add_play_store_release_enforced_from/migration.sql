-- Waktu wajib yang dipercepat admin ("Wajibkan sekarang") untuk rilis yang
-- sudah disetujui Google sebelum masa tenggang 2 hari habis.
ALTER TABLE "play_store_releases" ADD COLUMN "enforcedFrom" TIMESTAMP(3);
ALTER TABLE "play_store_releases" ADD COLUMN "enforcedById" TEXT;
