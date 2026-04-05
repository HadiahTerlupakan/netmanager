-- DropIndex
DROP INDEX IF EXISTS "Holiday_date_key";

-- CreateIndex (idempotent: skip if already exists)
CREATE UNIQUE INDEX IF NOT EXISTS "Holiday_date_tenantId_key" ON "Holiday"("date", "tenantId");
