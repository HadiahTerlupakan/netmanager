-- Penjaga bukti transfer lama (`/receipts/*`) mencari payment pemilik berkas
-- lewat receiptUrl di setiap permintaan staf; tanpa index, setiap gambar yang
-- dibuka memindai seluruh tabel Payment.
CREATE INDEX IF NOT EXISTS "Payment_receiptUrl_idx" ON "Payment"("receiptUrl");
