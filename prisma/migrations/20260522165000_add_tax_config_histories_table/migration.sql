-- Create tax_config_histories table for audit trail of tax configuration changes (idempotent)

CREATE TABLE IF NOT EXISTS "tax_config_histories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_config_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_config_histories_tenantId_changedAt_idx" ON "tax_config_histories"("tenantId", "changedAt");
CREATE INDEX IF NOT EXISTS "tax_config_histories_tenantId_field_idx" ON "tax_config_histories"("tenantId", "field");
