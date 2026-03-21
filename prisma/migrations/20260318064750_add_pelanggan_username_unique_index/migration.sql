-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Pelanggan_username_key" ON "Pelanggan"("username");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Pelanggan_tenantId_username_idx" ON "Pelanggan"("tenantId", "username");
