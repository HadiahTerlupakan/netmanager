-- Pemesanan kupon untuk checkout gateway, supaya kuotanya dikembalikan bila
-- checkout kedaluwarsa atau gagal.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "couponUsageId" TEXT;
