-- Pindahkan referensi ODP milik pelanggan dari tabel `Odp` ke `mapping_nodes`.
--
-- Ada dua penyimpanan ODP yang tidak terhubung. ODP yang benar-benar dipakai
-- dibuat lewat halaman Topology Map dan import CSV, dan keduanya menulis ke
-- `mapping_nodes` (type = 'odp'). Tabel `Odp` tidak pernah ditulis oleh apa pun
-- di aplikasi ini -- tidak oleh kode, seed, maupun migration -- sehingga
-- dropdown ODP di form pelanggan baru selalu kosong dan pelanggan tidak pernah
-- bisa dikaitkan ke ODP mana pun.
--
-- Migration ini hanya memindahkan foreign key. Tabel `Odp` dan `OdpOutput`
-- sengaja TIDAK dihapus di sini: penghapusan tabel adalah perubahan destruktif
-- yang dilakukan sebagai langkah terpisah setelah terbukti tidak ada yang
-- membutuhkannya lagi.

-- 1. Nol-kan referensi yang tidak punya padanan di `mapping_nodes`.
--    Tanpa ini penambahan foreign key baru akan gagal. Nilai yang dinolkan
--    hanya yang menunjuk ke baris `Odp` -- yang tabelnya memang tidak pernah
--    terisi, jadi pada praktiknya tidak ada data yang hilang.
UPDATE "Pelanggan"
SET "odpId" = NULL
WHERE "odpId" IS NOT NULL
  AND "odpId" NOT IN (SELECT "node_id" FROM "mapping_nodes");

-- 2. Lepas foreign key lama ke tabel `Odp`.
ALTER TABLE "Pelanggan" DROP CONSTRAINT IF EXISTS "Pelanggan_odpId_fkey";

-- 3. Pasang foreign key baru ke `mapping_nodes`.
--    ON DELETE SET NULL dipertahankan sama seperti sebelumnya: menghapus ODP
--    tidak boleh ikut menghapus pelanggannya, cukup melepas kaitannya.
ALTER TABLE "Pelanggan"
ADD CONSTRAINT "Pelanggan_odpId_fkey"
FOREIGN KEY ("odpId") REFERENCES "mapping_nodes"("node_id")
ON DELETE SET NULL ON UPDATE CASCADE;
