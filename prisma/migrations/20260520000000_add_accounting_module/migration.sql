-- CreateEnum
CREATE TYPE "COAType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "COASubtype" AS ENUM ('CURRENT_ASSET', 'FIXED_ASSET', 'CURRENT_LIABILITY', 'LONG_TERM_LIABILITY', 'CONTRIBUTED_CAPITAL', 'RETAINED_EARNINGS', 'OPERATING_REVENUE', 'OTHER_REVENUE', 'COGS', 'OPEX', 'OTHER_EXPENSE');
CREATE TYPE "DebitCredit" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "CashFlowCategory" AS ENUM ('OPERATING', 'INVESTING', 'FINANCING');
CREATE TYPE "JournalSource" AS ENUM ('AUTO_INVOICE_PAID', 'AUTO_INVOICE_CREATED', 'AUTO_PAYMENT', 'AUTO_EXPENSE', 'AUTO_PO_PAID', 'MANUAL', 'RECURRING', 'REVERSAL', 'OPENING_BALANCE', 'ADJUSTMENT', 'CLOSING');
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED', 'REOPENED');
CREATE TYPE "RecurringFreq" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "ReconStatus" AS ENUM ('DRAFT_RECON', 'COMPLETED_RECON');
CREATE TYPE "MatchStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'MANUAL_MATCH');

-- AlterTable: add coaId to existing models
ALTER TABLE "ExpenseCategory" ADD COLUMN "coaId" TEXT;
ALTER TABLE "financial_accounts" ADD COLUMN "coaId" TEXT;

-- CreateTable: chart_of_accounts
CREATE TABLE "chart_of_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "COAType" NOT NULL,
    "subtype" "COASubtype",
    "normalSide" "DebitCredit" NOT NULL,
    "cashFlowCategory" "CashFlowCategory",
    "parentId" TEXT,
    "isPostable" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: accounting_periods
CREATE TABLE "accounting_periods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable: journal_entries
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "periodId" TEXT NOT NULL,
    "source" "JournalSource" NOT NULL,
    "sourceRefType" TEXT,
    "sourceRefId" TEXT,
    "description" TEXT NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'POSTED',
    "reversalOfId" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: journal_lines
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "coaId" TEXT NOT NULL,
    "side" "DebitCredit" NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "description" TEXT,
    "lineOrder" INTEGER NOT NULL,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: recurring_journal_templates
CREATE TABLE "recurring_journal_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "RecurringFreq" NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "templateLines" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_journal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bank_reconciliations
CREATE TABLE "bank_reconciliations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "coaId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "statementBalance" DECIMAL(19,2) NOT NULL,
    "bookBalance" DECIMAL(19,2) NOT NULL,
    "reconciledBalance" DECIMAL(19,2) NOT NULL,
    "status" "ReconStatus" NOT NULL DEFAULT 'DRAFT_RECON',
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bank_reconciliation_lines
CREATE TABLE "bank_reconciliation_lines" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "journalLineId" TEXT,
    "bankRefDate" TIMESTAMP(3) NOT NULL,
    "bankRefDescription" TEXT NOT NULL,
    "bankRefAmount" DECIMAL(19,2) NOT NULL,
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'UNMATCHED',

    CONSTRAINT "bank_reconciliation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_tenantId_code_key" ON "chart_of_accounts"("tenantId", "code");
CREATE INDEX "chart_of_accounts_tenantId_type_idx" ON "chart_of_accounts"("tenantId", "type");
CREATE INDEX "chart_of_accounts_tenantId_parentId_idx" ON "chart_of_accounts"("tenantId", "parentId");

CREATE UNIQUE INDEX "accounting_periods_tenantId_year_month_key" ON "accounting_periods"("tenantId", "year", "month");
CREATE INDEX "accounting_periods_tenantId_status_idx" ON "accounting_periods"("tenantId", "status");

CREATE UNIQUE INDEX "journal_entries_tenantId_entryNumber_key" ON "journal_entries"("tenantId", "entryNumber");
CREATE UNIQUE INDEX "journal_entries_tenantId_source_sourceRefId_key" ON "journal_entries"("tenantId", "source", "sourceRefId");
CREATE UNIQUE INDEX "journal_entries_reversalOfId_key" ON "journal_entries"("reversalOfId");
CREATE INDEX "journal_entries_tenantId_entryDate_idx" ON "journal_entries"("tenantId", "entryDate");
CREATE INDEX "journal_entries_periodId_status_idx" ON "journal_entries"("periodId", "status");

CREATE INDEX "journal_lines_entryId_idx" ON "journal_lines"("entryId");
CREATE INDEX "journal_lines_coaId_idx" ON "journal_lines"("coaId");

CREATE INDEX "recurring_journal_templates_tenantId_isActive_dayOfMonth_idx" ON "recurring_journal_templates"("tenantId", "isActive", "dayOfMonth");

CREATE INDEX "bank_reconciliations_tenantId_coaId_statementDate_idx" ON "bank_reconciliations"("tenantId", "coaId", "statementDate");
CREATE INDEX "bank_reconciliation_lines_reconciliationId_matchStatus_idx" ON "bank_reconciliation_lines"("reconciliationId", "matchStatus");

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_coaId_fkey" FOREIGN KEY ("coaId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_coaId_fkey" FOREIGN KEY ("coaId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_lines" ADD CONSTRAINT "bank_reconciliation_lines_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigger: enforce double-entry balance (DR = CR) untuk journal_entries POSTED
CREATE OR REPLACE FUNCTION check_journal_balance() RETURNS trigger AS $$
DECLARE
  total_debit numeric;
  total_credit numeric;
  entry_status text;
BEGIN
  SELECT status INTO entry_status FROM journal_entries
  WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);

  IF entry_status <> 'POSTED' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN side = 'DEBIT' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN side = 'CREDIT' THEN amount ELSE 0 END), 0)
  INTO total_debit, total_credit
  FROM journal_lines WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id);

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Journal entry % unbalanced: DR=%, CR=%',
      COALESCE(NEW.entry_id, OLD.entry_id), total_debit, total_credit;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_balance_check
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_journal_balance();
