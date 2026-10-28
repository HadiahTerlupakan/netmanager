-- Jatuh tempo pelanggan adalah tanggal. Nilai yang terlanjur membawa jam
-- (dari invoice yang dibuat dengan jam pembuatannya) dibulatkan ke awal hari
-- WIB, zona waktu semua tenant saat migrasi ini ditulis. Kolom TIMESTAMP
-- tanpa zona menyimpan jam UTC, jadi dibaca sebagai UTC, dipotong di WIB,
-- lalu dikembalikan ke UTC. Penulisan baru dibulatkan oleh extension Prisma
-- normalizeCustomerDueDates.
UPDATE "Pelanggan"
SET "jatuhTempo" = (date_trunc('day', ("jatuhTempo" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC'
WHERE "jatuhTempo" <> (date_trunc('day', ("jatuhTempo" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC';
