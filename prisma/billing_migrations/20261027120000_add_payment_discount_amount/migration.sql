-- Potongan kupon per pembayaran. Tanpa kolom ini status invoice hanya
-- menjumlahkan amount, sehingga invoice yang dibayar dengan kupon tertahan
-- PARTIAL_PAID walau pelanggan sudah membayar penuh.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "discountAmount" BIGINT NOT NULL DEFAULT 0;
