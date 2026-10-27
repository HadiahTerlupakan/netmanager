-- Kupon pemberi potongan, untuk mencatat ulang pemakaiannya bila checkout
-- yang kuponnya sudah dikembalikan ternyata dibayar.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "couponId" TEXT;
