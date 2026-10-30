-- Siapa yang menjadwalkan perubahan paket yang tertunda. Pelanggan hanya boleh
-- membatalkan pengajuannya sendiri, bukan jadwal petugas (bisa turun paket).
-- Baris lama tidak bisa dibedakan, jadi dianggap jadwal petugas (false).
ALTER TABLE "Pelanggan" ADD COLUMN "pendingPackageByCustomer" BOOLEAN NOT NULL DEFAULT false;
