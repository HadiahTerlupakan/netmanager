-- Kelebihan bayar yang dikreditkan ke saldo pelanggan, mis. VA lama yang
-- tetap dibayar setelah pelanggan mengganti metode pembayaran.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "kelebihanBayar" BIGINT;
