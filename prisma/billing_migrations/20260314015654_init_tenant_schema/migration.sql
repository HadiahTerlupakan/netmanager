-- @safe-guard-ack: Adding tenantId for Multi-Tenant SaaS architecture billing db
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PaymentGatewayConfig" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "UnmatchedMutation" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mix_radius_invoices" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mix_radius_customers" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mix_radius_owner_groups" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mix_radius_investor_sites" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "mix_radius_configs" ADD COLUMN     "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceItem_tenantId_idx" ON "InvoiceItem"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentGatewayConfig_tenantId_idx" ON "PaymentGatewayConfig"("tenantId");

-- CreateIndex
CREATE INDEX "UnmatchedMutation_tenantId_idx" ON "UnmatchedMutation"("tenantId");

-- CreateIndex
CREATE INDEX "mix_radius_invoices_tenantId_idx" ON "mix_radius_invoices"("tenantId");

-- CreateIndex
CREATE INDEX "mix_radius_customers_tenantId_idx" ON "mix_radius_customers"("tenantId");

-- CreateIndex
CREATE INDEX "mix_radius_owner_groups_tenantId_idx" ON "mix_radius_owner_groups"("tenantId");

-- CreateIndex
CREATE INDEX "mix_radius_investor_sites_tenantId_idx" ON "mix_radius_investor_sites"("tenantId");

-- CreateIndex
CREATE INDEX "mix_radius_configs_tenantId_idx" ON "mix_radius_configs"("tenantId");

