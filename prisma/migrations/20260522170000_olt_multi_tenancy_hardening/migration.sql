-- OLT multi-tenancy hardening
-- 1. ONU serialNumber: drop global unique, add per-tenant + per-OLT unique
-- 2. ONU onuIndex: nullable (multiple unregistered ONU per port allowed)
-- 3. Drop @@unique([oltId, ponPort, onuIndex]) — replaced with index;
--    uniqueness for registered ONU enforced di service layer karena Prisma
--    tidak support partial unique index secara portable.
-- 4. OnuPreRegistration: per-tenant unique untuk serialNumber

-- ONU device
DROP INDEX IF EXISTS "onu_devices_serialNumber_key";
DROP INDEX IF EXISTS "onu_devices_oltId_ponPort_onuIndex_key";

ALTER TABLE "onu_devices" ALTER COLUMN "onuIndex" DROP NOT NULL;

CREATE UNIQUE INDEX "onu_devices_oltId_serialNumber_key" ON "onu_devices"("oltId", "serialNumber");
CREATE UNIQUE INDEX "onu_devices_tenantId_serialNumber_key" ON "onu_devices"("tenantId", "serialNumber");
CREATE INDEX "onu_devices_oltId_ponPort_onuIndex_idx" ON "onu_devices"("oltId", "ponPort", "onuIndex");

-- ONU pre-registration
DROP INDEX IF EXISTS "onu_pre_registrations_serialNumber_key";
CREATE UNIQUE INDEX "onu_pre_registrations_tenantId_serialNumber_key" ON "onu_pre_registrations"("tenantId", "serialNumber");
