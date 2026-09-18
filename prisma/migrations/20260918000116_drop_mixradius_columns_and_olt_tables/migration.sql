-- @safe-guard-ack: tahap 2 hapus sisa MixRadius & OLT, disetujui user 2026-09-18; isi tiap objek sudah dihitung di produksi, kode tidak lagi menyentuhnya sejak image 43f9da932122-35, dan pipeline mencadangkan 4 DB sebelum migrasi
-- Tahap 2 pembersihan MixRadius & OLT Management.
-- Kode berhenti memakai keduanya sejak 622ed045a (MixRadius) dan ba6cfe674 (OLT);
-- migration ini membuang sisa skemanya. Destruktif dan sudah disetujui user.
--
-- Data yang diperiksa di produksi sebelum drop (2026-09-18):
--   Expense.mixRadiusGroupId    102/147 terisi, semuanya sudah punya siteId kecuali
--                               3 pengeluaran grup "Pejaten" yang deskripsinya sendiri
--                               sudah menyebut PEJATEN, jadi tidak ada keterangan hilang.
--   rab_projects                1 baris ber-mixRadiusGroupId (sudah bersite "Tegal"),
--                               2 baris ber-mixRadiusInvestorSiteId.
--   Pelanggan.mixRadiusId       0 baris (tabelnya kosong).
--   Tabel olt_*/onu_*           hanya olt_devices 1, olt_cards 1, olt_command_logs 2;
--                               tidak ada FK dari tabel lain ke tabel-tabel itu.

-- 1. Satu-satunya keterangan yang benar-benar hilang: tautan RAB ke "investor site"
--    MixRadius. Simpan namanya di deskripsi RAB yang belum punya site, supaya
--    konteksnya tetap terbaca setelah tabel billing-nya dibuang. Di luar produksi
--    kondisi WHERE tidak cocok sehingga tidak ada yang berubah.
UPDATE "rab_projects"
SET "description" = CASE
    WHEN "description" IS NULL OR btrim("description") = ''
      THEN 'Investor site lama (MixRadius): Zawiyah — owner "tegalnew — Manager"'
    ELSE "description" || E'\n\n' || 'Investor site lama (MixRadius): Zawiyah — owner "tegalnew — Manager"'
  END
WHERE "mixRadiusInvestorSiteId" = 'f3c914f8-afb4-4af9-8b5a-f36d32075442'
  AND "siteId" IS NULL
  AND ("description" IS NULL OR "description" NOT LIKE '%Investor site lama (MixRadius)%');

-- 2. Izin sisa kedua modul. Tautannya di "_PermissionToRole" ikut terhapus lewat
--    ON DELETE CASCADE, dan lib/permission-config.ts tidak lagi mendaftarkannya
--    sehingga sinkronisasi izin tidak membuatnya lagi.
DELETE FROM "Permission" WHERE "resource" IN (
  'm_mixradius',
  'mixradius',
  'mixradius_accounts',
  'mixradius_expenses',
  'mixradius_income',
  'mixradius_investor_sites',
  'mixradius_isolir',
  'mixradius_profit_loss',
  'mixradius_sites',
  'olt',
  'olt_cards',
  'olt_devices',
  'olt_logs',
  'olt_onu',
  'olt_vlan',
  'onu',
  'onutype'
);

-- 3. Pengaturan & feature flag sisa. Di produksi sudah 0 baris; tetap dibersihkan
--    untuk lingkungan lain yang masih menyimpannya.
DELETE FROM "Settings" WHERE "key" = 'mixradius_fees';
DELETE FROM "TenantFeatureFlag" WHERE "feature" = 'integrations';

-- 4. Kolom MixRadius. Index dan constraint yang bergantung pada kolom ini
--    (Expense_mixRadiusGroupId_idx, Pelanggan_mixRadiusId_key) ikut terhapus.
ALTER TABLE "Expense" DROP COLUMN IF EXISTS "mixRadiusGroupId";
ALTER TABLE "Pelanggan" DROP COLUMN IF EXISTS "mixRadiusId";
ALTER TABLE "rab_projects"
  DROP COLUMN IF EXISTS "mixRadiusGroupId",
  DROP COLUMN IF EXISTS "mixRadiusInvestorSiteId";

-- 5. Tabel OLT/ONU, anak lebih dulu. Sengaja tanpa CASCADE: bila ada objek lain
--    yang tergantung, migration harus gagal, bukan diam-diam ikut menghapusnya.
DROP TABLE IF EXISTS "olt_alerts";
DROP TABLE IF EXISTS "onu_power_history";
DROP TABLE IF EXISTS "onu_pre_registrations";
DROP TABLE IF EXISTS "olt_bandwidth_profiles";
DROP TABLE IF EXISTS "olt_command_logs";
DROP TABLE IF EXISTS "olt_vlan_configs";
DROP TABLE IF EXISTS "onu_devices";
DROP TABLE IF EXISTS "olt_cards";
DROP TABLE IF EXISTS "olt_devices";

-- 6. Enum milik modul OLT; tidak ada model lain yang memakainya.
DROP TYPE IF EXISTS "OltAlertSeverity";
DROP TYPE IF EXISTS "OltAlertType";
DROP TYPE IF EXISTS "OltCardStatus";
DROP TYPE IF EXISTS "OltCommandResult";
DROP TYPE IF EXISTS "OltStatus";
DROP TYPE IF EXISTS "OltVendor";
DROP TYPE IF EXISTS "OnuStatus";
DROP TYPE IF EXISTS "PreRegStatus";
DROP TYPE IF EXISTS "VlanPurpose";
