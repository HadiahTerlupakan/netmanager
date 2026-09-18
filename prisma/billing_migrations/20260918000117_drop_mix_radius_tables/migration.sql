-- @safe-guard-ack: tahap 2 hapus cerminan data panel MixRadius, disetujui user 2026-09-18; panel mati sejak 2026-09-13 dan kode berhenti membacanya sejak 622ed045a
-- Tahap 2 pembersihan MixRadius: buang cerminan data panel di DB billing.
-- Panel MixRadius memakai CAPTCHA dan remote-nya dimatikan sejak 2026-09-13;
-- kode berhenti membaca tabel-tabel ini sejak 622ed045a. Destruktif dan sudah
-- disetujui user. Isi produksi saat drop (2026-09-18): customers 3.130,
-- invoices 2.930, owner_groups 11, investor_sites 1, configs 0.
-- Tidak ada FK dari tabel lain ke tabel-tabel ini, dan tidak ada enum yang
-- hanya dipakai olehnya.
DROP TABLE IF EXISTS "mix_radius_invoices";
DROP TABLE IF EXISTS "mix_radius_customers";
DROP TABLE IF EXISTS "mix_radius_owner_groups";
DROP TABLE IF EXISTS "mix_radius_investor_sites";
DROP TABLE IF EXISTS "mix_radius_configs";
