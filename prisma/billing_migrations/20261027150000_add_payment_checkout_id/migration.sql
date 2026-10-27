-- Penanda checkout portal: semua payment yang dibuat dalam satu checkout
-- berbagi nilai ini, supaya webhook gateway melunasi seluruh kelompok tanpa
-- menebak dari paymentUrl.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "checkoutId" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_checkoutId_idx" ON "Payment"("checkoutId");
