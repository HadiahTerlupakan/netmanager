-- @safe-guard-ack: harden MixRadius config tenant ownership after backfilling null tenantId rows so active config cannot be created without tenant scope again
-- Backfill and harden MixRadius config tenant ownership.

UPDATE "mix_radius_configs"
SET "tenantId" = 'DEFAULT'
WHERE "tenantId" IS NULL;

ALTER TABLE "mix_radius_configs"
ALTER COLUMN "tenantId" SET NOT NULL;
