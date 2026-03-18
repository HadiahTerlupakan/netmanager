-- CreateIndex
CREATE UNIQUE INDEX "Pelanggan_username_key" ON "Pelanggan"("username");

-- CreateIndex
CREATE INDEX "Pelanggan_tenantId_username_idx" ON "Pelanggan"("tenantId", "username");
