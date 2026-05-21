-- CreateEnum: TaxType, TaxDirection, TaxPayStatus
CREATE TYPE "TaxType" AS ENUM ('PPN_KELUARAN', 'PPN_MASUKAN', 'PPH_21', 'PPH_23', 'PPH_4_2', 'BHP', 'USO', 'KSO');
CREATE TYPE "TaxDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "TaxPayStatus" AS ENUM ('BELUM_SETOR', 'SUDAH_SETOR', 'TERLAMBAT');

-- Add new JournalSource values (accounting event handlers)
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_COUPON_USED';
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_MITRA_WITHDRAWAL';
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_INVESTOR_PAYOUT';

-- Add new JournalSource values (tax module)
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_TAX_PPN_KELUARAN';
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_TAX_PPN_MASUKAN';
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_TAX_PPH_21';
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_TAX_PPH_23';
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_TAX_PPH_4_2';
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_TAX_BHP';
ALTER TYPE "JournalSource" ADD VALUE IF NOT EXISTS 'AUTO_TAX_USO';

-- CreateTable: tax_configs
CREATE TABLE "tax_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "npwp" TEXT,
    "companyName" TEXT,
    "isPkp" BOOLEAN NOT NULL DEFAULT false,
    "ppnRate" DECIMAL(5,2) NOT NULL DEFAULT 11,
    "ppnIncluded" BOOLEAN NOT NULL DEFAULT false,
    "pph23RateJasa" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "pph23RateSewa" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "pph4Rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "bhpRate" DECIMAL(5,2) NOT NULL DEFAULT 0.5,
    "usoRate" DECIMAL(5,2) NOT NULL DEFAULT 1.25,
    "ksoRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ppnDueDay" INTEGER NOT NULL DEFAULT 15,
    "pph21DueDay" INTEGER NOT NULL DEFAULT 10,
    "pph23DueDay" INTEGER NOT NULL DEFAULT 10,
    "bhpDueMonth" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tax_transactions
CREATE TABLE "tax_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "direction" "TaxDirection" NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "taxAmount" DECIMAL(19,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "sourceRefType" TEXT NOT NULL,
    "sourceRefId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "journalId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tax_period_summaries
CREATE TABLE "tax_period_summaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "ppnKeluaran" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "ppnMasukan" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "ppnKurangBayar" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "pph21Total" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "pph23Total" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "pph4Total" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "bhpAccrual" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "usoAccrual" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "ppnStatus" "TaxPayStatus" NOT NULL DEFAULT 'BELUM_SETOR',
    "pph21Status" "TaxPayStatus" NOT NULL DEFAULT 'BELUM_SETOR',
    "pph23Status" "TaxPayStatus" NOT NULL DEFAULT 'BELUM_SETOR',
    "pph4Status" "TaxPayStatus" NOT NULL DEFAULT 'BELUM_SETOR',
    "bhpStatus" "TaxPayStatus" NOT NULL DEFAULT 'BELUM_SETOR',
    "ppnPaidAt" TIMESTAMP(3),
    "pph21PaidAt" TIMESTAMP(3),
    "pph23PaidAt" TIMESTAMP(3),
    "pph4PaidAt" TIMESTAMP(3),
    "bhpPaidAt" TIMESTAMP(3),
    "ppnPenalty" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "pph21Penalty" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "pph23Penalty" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_period_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tax_reminders
CREATE TABLE "tax_reminders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_configs_tenantId_key" ON "tax_configs"("tenantId");
CREATE UNIQUE INDEX "tax_transactions_tenantId_sourceRefType_sourceRefId_taxType_key" ON "tax_transactions"("tenantId", "sourceRefType", "sourceRefId", "taxType");
CREATE INDEX "tax_transactions_tenantId_periodYear_periodMonth_idx" ON "tax_transactions"("tenantId", "periodYear", "periodMonth");
CREATE INDEX "tax_transactions_tenantId_taxType_idx" ON "tax_transactions"("tenantId", "taxType");
CREATE UNIQUE INDEX "tax_period_summaries_tenantId_year_month_key" ON "tax_period_summaries"("tenantId", "year", "month");
CREATE INDEX "tax_period_summaries_tenantId_year_idx" ON "tax_period_summaries"("tenantId", "year");
CREATE UNIQUE INDEX "tax_reminders_tenantId_taxType_year_month_key" ON "tax_reminders"("tenantId", "taxType", "year", "month");
CREATE INDEX "tax_reminders_status_dueDate_idx" ON "tax_reminders"("status", "dueDate");

-- Seed tax permissions for all tenants
INSERT INTO "Permission" (id, name, action, resource, description, "createdAt", "updatedAt", "tenantId")
SELECT
  gen_random_uuid()::text,
  initcap(a.action) || ' Tax',
  a.action,
  'tax',
  'Allow ' || a.action || ' on tax',
  NOW(),
  NOW(),
  t.id
FROM (SELECT DISTINCT action FROM "Permission" LIMIT 20) a
CROSS JOIN (SELECT id FROM "Tenant") t
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" p
  WHERE p.resource = 'tax' AND p.action = a.action AND p."tenantId" = t.id
);
