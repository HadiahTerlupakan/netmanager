-- Add tax-related fields to investor_configs (idempotent for envs that already have them)

ALTER TABLE "investor_configs" ADD COLUMN IF NOT EXISTS "isTaxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "investor_configs" ADD COLUMN IF NOT EXISTS "taxType" TEXT;
ALTER TABLE "investor_configs" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,2);
