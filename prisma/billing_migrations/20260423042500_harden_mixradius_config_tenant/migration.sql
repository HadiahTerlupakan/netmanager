-- Backfill and harden MixRadius config tenant ownership.

UPDATE "mix_radius_configs"
SET "tenantId" = 'DEFAULT'
WHERE "tenantId" IS NULL;

ALTER TABLE "mix_radius_configs"
ALTER COLUMN "tenantId" SET NOT NULL;
