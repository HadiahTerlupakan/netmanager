-- Biaya yang dipotong gateway dari pembayaran lunas (mis. 78 untuk QRIS
-- Rp11.100); jumlah yang diterima merchant = amount - gatewayFee.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "gatewayFee" BIGINT;
