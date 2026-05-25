-- Drop legacy tarif & due day fields from tax_configs.
-- Source of truth pindah ke `tax_rate_configs` (TaxRateConfig).
-- Sebelum apply migration ini, pastikan semua tenant punya entry
-- TaxRateConfig untuk PPN, PPH21, PPH23_JASA, PPH23_SEWA, PPH4_FINAL,
-- BHP, USO. Cek via `seed-tax-rate-configs.ts`.

ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "ppnRate";
ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "pph23RateJasa";
ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "pph23RateSewa";
ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "pph4Rate";
ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "bhpRate";
ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "usoRate";
ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "ksoRate";
ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "ppnDueDay";
ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "pph21DueDay";
ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "pph23DueDay";
ALTER TABLE "tax_configs" DROP COLUMN IF EXISTS "bhpDueMonth";
