-- Kueri terpanas notifikasi selalu menggabungkan penerima dengan status baca:
-- daftar lonceng (`userId` + `isRead`) dan hitungan belum dibaca per tenant.
-- Index tunggal yang sudah ada memaksa Postgres menyaring sisanya baris per
-- baris setelah salah satu index dipakai.
CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "notifications_tenantId_isRead_idx" ON "notifications"("tenantId", "isRead");
