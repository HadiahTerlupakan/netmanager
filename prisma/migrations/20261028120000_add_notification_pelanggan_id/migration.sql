-- Notifikasi in-app pelanggan portal. Penerima sebelumnya hanya userId (akun
-- User), yang tidak dimiliki kebanyakan pelanggan, sehingga notifikasi
-- tagihan mereka tidak pernah tersimpan.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "pelangganId" TEXT;
CREATE INDEX IF NOT EXISTS "notifications_pelangganId_isRead_idx" ON "notifications"("pelangganId", "isRead");
