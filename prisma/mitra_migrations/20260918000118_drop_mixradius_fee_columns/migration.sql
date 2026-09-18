-- Tahap 2 pembersihan MixRadius: fee pelanggan mitra seluruh sumber datanya
-- berasal dari panel MixRadius, jadi kolomnya ikut dibuang. Kode berhenti
-- memakainya sejak 622ed045a (key API mobile tetap ada dengan nilai netral
-- supaya build lama tidak rusak). Destruktif dan sudah disetujui user.
-- Isi produksi saat drop (2026-09-18): 1 mitra, 0 punya owner MixRadius,
-- 0 mengaktifkan fee, 0 punya tarif.
ALTER TABLE "Mitra"
  DROP COLUMN IF EXISTS "mixradiusOwnerNames",
  DROP COLUMN IF EXISTS "enableFeePelanggan",
  DROP COLUMN IF EXISTS "mitraRateFeePelanggan";
