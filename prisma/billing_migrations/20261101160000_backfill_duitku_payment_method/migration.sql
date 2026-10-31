-- Payment Duitku dari portal dulu tersimpan dengan paymentMethod OTHER walau
-- gatewayProvider-nya kode kanal Duitku (mis. "BC"). Pemetaannya sama dengan
-- findBillingPaymentMethod (modules/payment-gateway/services/
-- payment-method-catalog.ts): VA → BANK_TRANSFER, QRIS dan e-wallet →
-- E_WALLET; ritel (FT, IR) tetap OTHER. Hanya baris OTHER yang disentuh,
-- jadi aman dijalankan ulang.
UPDATE "Payment"
SET "paymentMethod" = 'BANK_TRANSFER'
WHERE "paymentMethod" = 'OTHER'
  AND "gatewayProvider" IN ('BC', 'M2', 'BR');

UPDATE "Payment"
SET "paymentMethod" = 'E_WALLET'
WHERE "paymentMethod" = 'OTHER'
  AND "gatewayProvider" IN ('SP', 'DA', 'OV', 'SA', 'LA');
