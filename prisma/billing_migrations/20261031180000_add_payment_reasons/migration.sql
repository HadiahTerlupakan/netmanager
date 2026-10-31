-- Alasan penolakan bukti transfer manual oleh admin (ditampilkan ke pelanggan)
-- dan pesan penolakan gateway saat checkout gagal dibuat (untuk admin).
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
