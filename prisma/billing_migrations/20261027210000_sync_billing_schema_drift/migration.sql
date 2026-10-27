-- Menyamakan database billing hasil migrasi dengan billing.prisma. Bagian
-- ini pernah dipasang lewat `prisma db push` di sebagian lingkungan saja,
-- jadi semuanya idempoten. Tanpanya:
--   * WebhookEvent tidak ada: setiap webhook gateway gagal saat mencatat
--     event idempotensi.
--   * Unik PaymentGatewayConfig masih per provider (global), sedangkan kode
--     meng-upsert per (provider, tenantId): menyimpan konfigurasi gateway
--     gagal dengan 42P10, dan dua tenant tidak bisa memakai provider sama.
--   * Unik nomor invoice global, padahal per tenant.
-- Tabel lama transactions/transaction_categories dibiarkan (tidak dipakai
-- skema, tetapi menghapusnya destruktif).

DO $$
BEGIN
  CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "rawBody" TEXT,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT,
    "transactionId" TEXT,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "WebhookEvent_idempotencyKey_idx" ON "WebhookEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");
CREATE INDEX IF NOT EXISTS "WebhookEvent_status_idx" ON "WebhookEvent"("status");
CREATE INDEX IF NOT EXISTS "WebhookEvent_orderId_idx" ON "WebhookEvent"("orderId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_transactionId_idx" ON "WebhookEvent"("transactionId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_tenantId_idx" ON "WebhookEvent"("tenantId");

-- Unik lama lebih ketat dari yang baru, jadi data yang ada selalu lolos.
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentGatewayConfig_provider_tenantId_key" ON "PaymentGatewayConfig"("provider", "tenantId");
DROP INDEX IF EXISTS "PaymentGatewayConfig_provider_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_tenantId_invoiceNumber_key" ON "Invoice"("tenantId", "invoiceNumber");
DROP INDEX IF EXISTS "Invoice_invoiceNumber_key";

CREATE INDEX IF NOT EXISTS "Payment_accountId_idx" ON "Payment"("accountId");
