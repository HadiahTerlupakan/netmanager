-- Align TenantSettings.tenantId FK with schema (onDelete: Restrict)
-- Earlier migration created it as ON DELETE CASCADE; schema now declares Restrict.
-- This migration drops and re-creates the FK with the correct rule.

ALTER TABLE "TenantSettings" DROP CONSTRAINT IF EXISTS "TenantSettings_tenantId_fkey";

ALTER TABLE "TenantSettings"
    ADD CONSTRAINT "TenantSettings_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
