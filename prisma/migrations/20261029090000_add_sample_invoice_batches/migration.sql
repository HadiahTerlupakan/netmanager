-- Riwayat generate invoice contoh (fiktif, terpisah dari billing).
CREATE TABLE "sample_invoice_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mitraId" TEXT NOT NULL,
    "mitraName" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "input" JSONB NOT NULL,
    "sampleSet" JSONB NOT NULL,
    "customerCount" INTEGER NOT NULL,
    "invoiceCount" INTEGER NOT NULL,
    "fromMonth" TEXT NOT NULL,
    "toMonth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sample_invoice_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sample_invoice_batches_tenantId_mitraId_createdAt_idx"
    ON "sample_invoice_batches"("tenantId", "mitraId", "createdAt");

ALTER TABLE "sample_invoice_batches"
    ADD CONSTRAINT "sample_invoice_batches_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
