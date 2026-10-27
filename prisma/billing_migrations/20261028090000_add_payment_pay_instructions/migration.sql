-- Instruksi bayar dari gateway (nomor VA / kode bayar minimarket, string
-- QRIS), agar portal menampilkannya sendiri alih-alih mengalihkan pelanggan
-- ke halaman bayar gateway.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "vaNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "qrString" TEXT;
