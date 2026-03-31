-- DropIndex
DROP INDEX IF EXISTS "Holiday_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_tenantId_key" ON "Holiday"("date", "tenantId");
