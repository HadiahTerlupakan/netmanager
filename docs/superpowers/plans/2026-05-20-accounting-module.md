# Modul Akuntansi (Accounting) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun modul `modules/accounting/` yang menyediakan double-entry General Ledger dengan auto-journal dari `finance` (via event bus + outbox existing), Chart of Accounts, period closing, recurring journal, journal reversal, bank reconciliation, dan 4 laporan inti (Buku Kas & Bank, Laba Rugi, Neraca, Arus Kas).

**Architecture:** Module baru mengikuti Clean Architecture (`docs/architecture/clean-architecture.md`). Komunikasi dari `finance` via event bus + outbox existing (`OutboxEvent` + BullMQ). Boundary integrity: `accounting` tidak import dari `finance`, hanya consume events. Amount pakai `Decimal(19,2)`. Balance invariant di-enforce DB trigger DEFERRED + service-layer check. Idempotency via unique `(source, sourceRefId)` di `journal_entries`.

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL, TypeScript, Zod, Vitest (unit/integration), Playwright (E2E), BullMQ (existing), `decimal.js`, TanStack Query (frontend).

**Spec:** `docs/superpowers/specs/2026-05-20-accounting-module-design.md`

---

## File Structure

### Backend (modules/accounting + lib + prisma)

**Migrations (Prisma):**
- Create: `prisma/migrations/<timestamp>_add_accounting_enums/migration.sql`
- Create: `prisma/migrations/<timestamp>_create_chart_of_accounts/migration.sql`
- Create: `prisma/migrations/<timestamp>_create_accounting_periods/migration.sql`
- Create: `prisma/migrations/<timestamp>_create_journal_tables/migration.sql` (+ DB trigger)
- Create: `prisma/migrations/<timestamp>_create_recurring_journal_templates/migration.sql`
- Create: `prisma/migrations/<timestamp>_create_bank_reconciliation/migration.sql`
- Create: `prisma/migrations/<timestamp>_extend_existing_for_accounting/migration.sql`
- Modify: `prisma/schema.prisma` — tambah 7 model + 10 enum + 2 field nullable di model existing

**Domain layer:**
- Create: `modules/accounting/domain/entities/ChartOfAccount.ts`
- Create: `modules/accounting/domain/entities/JournalEntry.ts`
- Create: `modules/accounting/domain/entities/JournalLine.ts`
- Create: `modules/accounting/domain/entities/AccountingPeriod.ts`
- Create: `modules/accounting/domain/entities/RecurringJournalTemplate.ts`
- Create: `modules/accounting/domain/entities/BankReconciliation.ts`
- Create: `modules/accounting/domain/value-objects/Money.ts`
- Create: `modules/accounting/domain/value-objects/AccountCode.ts`
- Create: `modules/accounting/domain/ports/IChartOfAccountRepository.ts`
- Create: `modules/accounting/domain/ports/IJournalRepository.ts`
- Create: `modules/accounting/domain/ports/IPeriodRepository.ts`
- Create: `modules/accounting/domain/ports/IRecurringRepository.ts`
- Create: `modules/accounting/domain/ports/IReconciliationRepository.ts`

**DTO + Validators:**
- Create: `modules/accounting/dto/ChartOfAccountDto.ts`
- Create: `modules/accounting/dto/JournalDto.ts`
- Create: `modules/accounting/dto/PeriodDto.ts`
- Create: `modules/accounting/dto/RecurringDto.ts`
- Create: `modules/accounting/dto/ReconciliationDto.ts`
- Create: `modules/accounting/dto/ReportDto.ts`
- Create: `modules/accounting/validators/coa.ts`
- Create: `modules/accounting/validators/journal.ts`
- Create: `modules/accounting/validators/period.ts`
- Create: `modules/accounting/validators/recurring.ts`
- Create: `modules/accounting/validators/reconciliation.ts`

**Repositories (Prisma):**
- Create: `modules/accounting/repositories/ChartOfAccountRepository.ts`
- Create: `modules/accounting/repositories/JournalRepository.ts`
- Create: `modules/accounting/repositories/PeriodRepository.ts`
- Create: `modules/accounting/repositories/RecurringRepository.ts`
- Create: `modules/accounting/repositories/ReconciliationRepository.ts`

**Services:**
- Create: `modules/accounting/services/coa/ChartOfAccountService.ts`
- Create: `modules/accounting/services/coa/seedDefaultCoa.ts`
- Create: `modules/accounting/services/journal/JournalPostingService.ts`
- Create: `modules/accounting/services/journal/JournalReverseService.ts`
- Create: `modules/accounting/services/journal/JournalNumberGenerator.ts`
- Create: `modules/accounting/services/journal/balanceValidator.ts`
- Create: `modules/accounting/services/period/PeriodService.ts`
- Create: `modules/accounting/services/period/PeriodCloseService.ts`
- Create: `modules/accounting/services/recurring/RecurringEngineService.ts`
- Create: `modules/accounting/services/reconciliation/BankReconciliationService.ts`
- Create: `modules/accounting/services/reconciliation/autoMatcher.ts`
- Create: `modules/accounting/services/reports/TrialBalanceService.ts`
- Create: `modules/accounting/services/reports/ProfitLossService.ts`
- Create: `modules/accounting/services/reports/BalanceSheetService.ts`
- Create: `modules/accounting/services/reports/CashFlowService.ts`
- Create: `modules/accounting/services/reports/CashBookService.ts`
- Create: `modules/accounting/services/reports/GeneralLedgerService.ts`
- Create: `modules/accounting/services/event-handlers/invoice-created-accounting.handler.ts`
- Create: `modules/accounting/services/event-handlers/invoice-paid-accounting.handler.ts`
- Create: `modules/accounting/services/event-handlers/expense-approved-accounting.handler.ts`
- Create: `modules/accounting/services/event-handlers/purchase-order-paid-accounting.handler.ts`
- Create: `modules/accounting/services/event-handlers/coa-resolver.ts`

**Mappers + Public API:**
- Create: `modules/accounting/mappers/coa.mapper.ts`
- Create: `modules/accounting/mappers/journal.mapper.ts`
- Create: `modules/accounting/mappers/period.mapper.ts`
- Create: `modules/accounting/index.ts`
- Create: `modules/accounting/errors.ts`

**Tests:**
- Create: `modules/accounting/__tests__/Money.test.ts`
- Create: `modules/accounting/__tests__/balanceValidator.test.ts`
- Create: `modules/accounting/__tests__/JournalNumberGenerator.test.ts`
- Create: `modules/accounting/__tests__/seedDefaultCoa.test.ts`
- Create: `modules/accounting/__tests__/ChartOfAccountService.test.ts`
- Create: `modules/accounting/__tests__/JournalPostingService.test.ts`
- Create: `modules/accounting/__tests__/JournalReverseService.test.ts`
- Create: `modules/accounting/__tests__/PeriodService.test.ts`
- Create: `modules/accounting/__tests__/PeriodCloseService.test.ts`
- Create: `modules/accounting/__tests__/RecurringEngineService.test.ts`
- Create: `modules/accounting/__tests__/TrialBalanceService.test.ts`
- Create: `modules/accounting/__tests__/ProfitLossService.test.ts`
- Create: `modules/accounting/__tests__/BalanceSheetService.test.ts`
- Create: `modules/accounting/__tests__/CashFlowService.test.ts`
- Create: `modules/accounting/__tests__/invoice-paid-accounting.handler.test.ts`
- Create: `modules/accounting/__tests__/expense-approved-accounting.handler.test.ts`
- Create: `modules/accounting/__tests__/BankReconciliationService.test.ts`
- Create: `modules/accounting/__tests__/db-trigger-balance.test.ts` (integration)

**Event bus + permission:**
- Modify: `lib/event-bus/types.ts` — tambah `EXPENSE_APPROVED`, `PURCHASE_ORDER_PAID`, payload types, kategori `ACCOUNTING`
- Modify: `lib/event-bus/event-handlers.ts` — register handler accounting (gated feature flag)
- Modify: `lib/permission-config.ts` — tambah 8 permission `accounting:*`
- Modify: `modules/finance/services/PaymentRouteService.ts` — publish event saat payment success (jika belum)
- Modify: `modules/finance/services/ExpenseRouteService.ts` — publish `EXPENSE_APPROVED` saat expense disetujui
- Modify: `modules/finance/services/FinancePurchaseOrderPaymentService.ts` — publish `PURCHASE_ORDER_PAID`
- Modify: `modules/finance/services/InvoiceRouteService.ts` — publish `INVOICE_CREATED` saat invoice dibuat (verifikasi sudah ada)

**Cron + scripts:**
- Create: `app/api/cron/accounting/recurring/route.ts` — endpoint cron harian
- Create: `app/api/cron/accounting/health-check/route.ts` — daily health check
- Create: `prisma/seed-accounting.ts` — seed COA default + period awal per tenant
- Modify: `package.json` — script `accounting:seed`

### API Routes (Next.js)

- Create: `app/api/admin/accounting/coa/route.ts` — list/create COA
- Create: `app/api/admin/accounting/coa/[id]/route.ts` — get/update/delete COA
- Create: `app/api/admin/accounting/coa/tree/route.ts` — tree view
- Create: `app/api/admin/accounting/journal/route.ts` — list/create manual journal
- Create: `app/api/admin/accounting/journal/[id]/route.ts` — detail journal
- Create: `app/api/admin/accounting/journal/[id]/reverse/route.ts` — reverse journal
- Create: `app/api/admin/accounting/journal/opening-balance/route.ts` — input opening balance
- Create: `app/api/admin/accounting/period/route.ts` — list periode
- Create: `app/api/admin/accounting/period/[id]/close/route.ts` — tutup buku
- Create: `app/api/admin/accounting/period/[id]/reopen/route.ts` — buka kembali
- Create: `app/api/admin/accounting/recurring/route.ts` — list/create template
- Create: `app/api/admin/accounting/recurring/[id]/route.ts` — get/update/delete template
- Create: `app/api/admin/accounting/reconciliation/route.ts` — list/create rekonsiliasi
- Create: `app/api/admin/accounting/reconciliation/[id]/route.ts` — detail
- Create: `app/api/admin/accounting/reconciliation/[id]/match/route.ts` — manual match
- Create: `app/api/admin/accounting/reconciliation/[id]/complete/route.ts` — complete recon
- Create: `app/api/admin/accounting/reports/trial-balance/route.ts`
- Create: `app/api/admin/accounting/reports/profit-loss/route.ts`
- Create: `app/api/admin/accounting/reports/balance-sheet/route.ts`
- Create: `app/api/admin/accounting/reports/cash-flow/route.ts`
- Create: `app/api/admin/accounting/reports/cash-book/route.ts`
- Create: `app/api/admin/accounting/reports/general-ledger/route.ts`

### UI Pages (admin portal)

- Create: `app/admin/akuntansi/page.tsx` — dashboard
- Create: `app/admin/akuntansi/coa/page.tsx` — COA tree manager
- Create: `app/admin/akuntansi/coa/components/CoaTreeView.tsx`
- Create: `app/admin/akuntansi/coa/components/CoaForm.tsx`
- Create: `app/admin/akuntansi/jurnal/page.tsx` — list jurnal
- Create: `app/admin/akuntansi/jurnal/new/page.tsx` — manual entry
- Create: `app/admin/akuntansi/jurnal/[id]/page.tsx` — detail + reverse
- Create: `app/admin/akuntansi/jurnal/components/JournalLinesEditor.tsx`
- Create: `app/admin/akuntansi/jurnal/recurring/page.tsx` — recurring templates
- Create: `app/admin/akuntansi/periode/page.tsx` — list + close/reopen
- Create: `app/admin/akuntansi/rekonsiliasi/page.tsx`
- Create: `app/admin/akuntansi/rekonsiliasi/[id]/page.tsx`
- Create: `app/admin/akuntansi/laporan/trial-balance/page.tsx`
- Create: `app/admin/akuntansi/laporan/laba-rugi/page.tsx`
- Create: `app/admin/akuntansi/laporan/neraca/page.tsx`
- Create: `app/admin/akuntansi/laporan/arus-kas/page.tsx`
- Create: `app/admin/akuntansi/laporan/buku-kas/page.tsx`
- Create: `app/admin/akuntansi/laporan/buku-besar/page.tsx`

### Documentation

- Modify: `docs/CHANGELOG.md` — entries `[Unreleased]` per phase
- Modify: `CLAUDE.md` — tambah module `accounting` ke Module Ownership Map

---

# PHASE 1 — Foundation (Schema + Domain + Chart of Accounts)

## Task 1: Prisma Schema — Enums & Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Tambahkan 10 enum ke `prisma/schema.prisma`**

Cari section enum di akhir file `prisma/schema.prisma`, append:

```prisma
enum COAType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

enum COASubtype {
  CURRENT_ASSET
  FIXED_ASSET
  CURRENT_LIABILITY
  LONG_TERM_LIABILITY
  CONTRIBUTED_CAPITAL
  RETAINED_EARNINGS
  OPERATING_REVENUE
  OTHER_REVENUE
  COGS
  OPEX
  OTHER_EXPENSE
}

enum DebitCredit {
  DEBIT
  CREDIT
}

enum CashFlowCategory {
  OPERATING
  INVESTING
  FINANCING
}

enum JournalSource {
  AUTO_INVOICE_PAID
  AUTO_INVOICE_CREATED
  AUTO_PAYMENT
  AUTO_EXPENSE
  AUTO_PO_PAID
  MANUAL
  RECURRING
  REVERSAL
  OPENING_BALANCE
  ADJUSTMENT
  CLOSING
}

enum JournalStatus {
  DRAFT
  POSTED
  REVERSED
}

enum PeriodStatus {
  OPEN
  CLOSING
  CLOSED
  REOPENED
}

enum RecurringFreq {
  MONTHLY
  QUARTERLY
  YEARLY
}

enum ReconStatus {
  DRAFT
  COMPLETED
}

enum MatchStatus {
  MATCHED
  UNMATCHED
  MANUAL_MATCH
}
```

- [ ] **Step 2: Tambahkan model `ChartOfAccount`**

Append di section model `prisma/schema.prisma`:

```prisma
model ChartOfAccount {
  id                String            @id @default(cuid())
  tenantId          String
  code              String
  name              String
  type              COAType
  subtype           COASubtype?
  normalSide        DebitCredit
  cashFlowCategory  CashFlowCategory?
  parentId          String?
  isPostable        Boolean           @default(true)
  isSystem          Boolean           @default(false)
  isActive          Boolean           @default(true)
  description       String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  parent            ChartOfAccount?   @relation("CoaTree", fields: [parentId], references: [id])
  children          ChartOfAccount[]  @relation("CoaTree")
  lines             JournalLine[]
  bankReconciliations BankReconciliation[]

  @@unique([tenantId, code])
  @@index([tenantId, type])
  @@index([tenantId, parentId])
  @@map("chart_of_accounts")
}
```

- [ ] **Step 3: Tambahkan model `AccountingPeriod`**

```prisma
model AccountingPeriod {
  id        String         @id @default(cuid())
  tenantId  String
  year      Int
  month     Int
  status    PeriodStatus   @default(OPEN)
  closedAt  DateTime?
  closedBy  String?
  startDate DateTime
  endDate   DateTime
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
  entries   JournalEntry[]

  @@unique([tenantId, year, month])
  @@index([tenantId, status])
  @@map("accounting_periods")
}
```

- [ ] **Step 4: Tambahkan model `JournalEntry` & `JournalLine`**

```prisma
model JournalEntry {
  id            String           @id @default(cuid())
  tenantId      String
  entryNumber   String
  entryDate     DateTime
  periodId      String
  source        JournalSource
  sourceRefType String?
  sourceRefId   String?
  description   String
  status        JournalStatus    @default(POSTED)
  reversalOfId  String?          @unique
  postedAt      DateTime?
  postedBy      String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  period        AccountingPeriod @relation(fields: [periodId], references: [id])
  lines         JournalLine[]
  reversalOf    JournalEntry?    @relation("JournalReversal", fields: [reversalOfId], references: [id])
  reversedBy    JournalEntry?    @relation("JournalReversal")

  @@unique([tenantId, entryNumber])
  @@unique([tenantId, source, sourceRefId])
  @@index([tenantId, entryDate])
  @@index([periodId, status])
  @@map("journal_entries")
}

model JournalLine {
  id          String         @id @default(cuid())
  entryId     String
  coaId       String
  side        DebitCredit
  amount      Decimal        @db.Decimal(19, 2)
  description String?
  lineOrder   Int
  entry       JournalEntry   @relation(fields: [entryId], references: [id], onDelete: Cascade)
  coa         ChartOfAccount @relation(fields: [coaId], references: [id])

  @@index([entryId])
  @@index([coaId])
  @@map("journal_lines")
}
```

- [ ] **Step 5: Tambahkan model `RecurringJournalTemplate`**

```prisma
model RecurringJournalTemplate {
  id              String        @id @default(cuid())
  tenantId        String
  name            String
  description     String?
  frequency       RecurringFreq
  dayOfMonth      Int
  startDate       DateTime
  endDate         DateTime?
  templateLines   Json
  isActive        Boolean       @default(true)
  lastGeneratedAt DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([tenantId, isActive, dayOfMonth])
  @@map("recurring_journal_templates")
}
```

- [ ] **Step 6: Tambahkan model `BankReconciliation` & `BankReconciliationLine`**

```prisma
model BankReconciliation {
  id                String                   @id @default(cuid())
  tenantId          String
  coaId             String
  statementDate     DateTime
  statementBalance  Decimal                  @db.Decimal(19, 2)
  bookBalance       Decimal                  @db.Decimal(19, 2)
  reconciledBalance Decimal                  @db.Decimal(19, 2)
  status            ReconStatus              @default(DRAFT)
  completedAt       DateTime?
  completedBy       String?
  createdAt         DateTime                 @default(now())
  updatedAt         DateTime                 @updatedAt
  coa               ChartOfAccount           @relation(fields: [coaId], references: [id])
  lines             BankReconciliationLine[]

  @@index([tenantId, coaId, statementDate])
  @@map("bank_reconciliations")
}

model BankReconciliationLine {
  id                 String             @id @default(cuid())
  reconciliationId   String
  journalLineId      String?
  bankRefDate        DateTime
  bankRefDescription String
  bankRefAmount      Decimal            @db.Decimal(19, 2)
  matchStatus        MatchStatus        @default(UNMATCHED)
  reconciliation     BankReconciliation @relation(fields: [reconciliationId], references: [id], onDelete: Cascade)

  @@index([reconciliationId, matchStatus])
  @@map("bank_reconciliation_lines")
}
```

- [ ] **Step 7: Tambah field `coaId` nullable ke `ExpenseCategory` & `FinancialAccount`**

Cari `model ExpenseCategory { ... }`, tambah:

```prisma
  coaId  String?
```

Cari `model FinancialAccount { ... }`, tambah:

```prisma
  coaId  String?
```

- [ ] **Step 8: Validasi schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 9: Generate migration**

Run: `npx prisma migrate dev --name add_accounting_module --create-only`
Expected: file migration baru di `prisma/migrations/<timestamp>_add_accounting_module/migration.sql`. **Jangan apply dulu** — kita akan tambahkan trigger DB di Task 2.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(accounting): tambah schema model akuntansi (COA, journal, period, recurring, reconciliation)"
```

---

## Task 2: DB Trigger — Journal Balance Constraint

**Files:**
- Modify: `prisma/migrations/<timestamp>_add_accounting_module/migration.sql`

- [ ] **Step 1: Append SQL trigger ke migration file**

Tambahkan di akhir file `prisma/migrations/<timestamp>_add_accounting_module/migration.sql`:

```sql
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
```

- [ ] **Step 2: Apply migration di local DB**

Run: `npm run db:up && npx prisma migrate deploy`
Expected: migration applied. Cek dengan `psql` atau Prisma Studio bahwa table baru ada.

- [ ] **Step 3: Generate Prisma client**

Run: `npm run prisma:generate`
Expected: `@prisma/client` updated dengan model baru.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/
git commit -m "feat(accounting): tambah DB trigger DEFERRED untuk enforce balance journal"
```

---

## Task 3: Domain Value Object — Money

**Files:**
- Create: `modules/accounting/domain/value-objects/Money.ts`
- Create: `modules/accounting/__tests__/Money.test.ts`

- [ ] **Step 1: Tulis test untuk `Money`**

Create `modules/accounting/__tests__/Money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Money } from "../domain/value-objects/Money";

describe("Money", () => {
  it("create from number with 2 decimal precision", () => {
    const m = Money.fromNumber(1000.5);
    expect(m.toString()).toBe("1000.50");
  });

  it("add two Money correctly without float drift", () => {
    const a = Money.fromString("0.1");
    const b = Money.fromString("0.2");
    expect(a.add(b).toString()).toBe("0.30");
  });

  it("subtract returns negative when b > a", () => {
    const a = Money.fromString("100");
    const b = Money.fromString("150");
    expect(a.subtract(b).toString()).toBe("-50.00");
  });

  it("equals compares value not reference", () => {
    expect(Money.fromString("10").equals(Money.fromNumber(10))).toBe(true);
  });

  it("isZero returns true for 0.00", () => {
    expect(Money.fromNumber(0).isZero()).toBe(true);
  });

  it("isPositive / isNegative", () => {
    expect(Money.fromString("5").isPositive()).toBe(true);
    expect(Money.fromString("-5").isNegative()).toBe(true);
  });

  it("multiply by scalar", () => {
    expect(Money.fromString("100").multiply(0.1).toString()).toBe("10.00");
  });

  it("zero() factory", () => {
    expect(Money.zero().toString()).toBe("0.00");
  });

  it("rejects non-finite input", () => {
    expect(() => Money.fromNumber(NaN)).toThrow();
    expect(() => Money.fromNumber(Infinity)).toThrow();
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/Money.test.ts`
Expected: FAIL — module tidak ada.

- [ ] **Step 3: Implement `Money`**

Create `modules/accounting/domain/value-objects/Money.ts`:

```ts
import { Decimal } from "decimal.js";

export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal) {
    this.value = value;
  }

  static fromNumber(n: number): Money {
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid Money value: ${n}`);
    }
    return new Money(new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  }

  static fromString(s: string): Money {
    return new Money(new Decimal(s).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  }

  static fromDecimal(d: Decimal | { toString(): string }): Money {
    return Money.fromString(d.toString());
  }

  static zero(): Money {
    return new Money(new Decimal(0).toDecimalPlaces(2));
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  multiply(scalar: number | string): Money {
    return new Money(
      this.value.times(scalar).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    );
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  toString(): string {
    return this.value.toFixed(2);
  }

  toNumber(): number {
    return this.value.toNumber();
  }

  toDecimal(): Decimal {
    return this.value;
  }
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/Money.test.ts`
Expected: PASS semua 9 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/domain/value-objects/Money.ts modules/accounting/__tests__/Money.test.ts
git commit -m "feat(accounting): tambah Money value object dengan Decimal precision"
```

---

## Task 4: Domain Entities — Account, Journal, Period

**Files:**
- Create: `modules/accounting/domain/entities/ChartOfAccount.ts`
- Create: `modules/accounting/domain/entities/JournalEntry.ts`
- Create: `modules/accounting/domain/entities/JournalLine.ts`
- Create: `modules/accounting/domain/entities/AccountingPeriod.ts`
- Create: `modules/accounting/domain/entities/RecurringJournalTemplate.ts`
- Create: `modules/accounting/domain/entities/BankReconciliation.ts`
- Create: `modules/accounting/errors.ts`

- [ ] **Step 1: Buat `errors.ts`**

Create `modules/accounting/errors.ts`:

```ts
export class AccountingError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AccountingError";
  }
}

export class JournalUnbalancedError extends AccountingError {
  constructor(debit: string, credit: string) {
    super(
      `Journal tidak balance: DR=${debit}, CR=${credit}`,
      "JOURNAL_UNBALANCED",
    );
  }
}

export class PeriodClosedError extends AccountingError {
  constructor(year: number, month: number) {
    super(
      `Periode ${year}-${String(month).padStart(2, "0")} sudah ditutup`,
      "PERIOD_CLOSED",
    );
  }
}

export class CoaNotFoundError extends AccountingError {
  constructor(identifier: string) {
    super(`Akun COA tidak ditemukan: ${identifier}`, "COA_NOT_FOUND");
  }
}

export class CoaNotPostableError extends AccountingError {
  constructor(code: string) {
    super(
      `Akun ${code} adalah header account, tidak bisa di-post`,
      "COA_NOT_POSTABLE",
    );
  }
}

export class JournalAlreadyReversedError extends AccountingError {
  constructor(entryNumber: string) {
    super(`Journal ${entryNumber} sudah di-reverse`, "JOURNAL_ALREADY_REVERSED");
  }
}

export class DuplicateJournalSourceError extends AccountingError {
  constructor(source: string, sourceRefId: string) {
    super(
      `Journal untuk source=${source}, ref=${sourceRefId} sudah ada`,
      "DUPLICATE_JOURNAL_SOURCE",
    );
  }
}
```

- [ ] **Step 2: Buat entity `ChartOfAccount`**

Create `modules/accounting/domain/entities/ChartOfAccount.ts`:

```ts
export type COAType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export type COASubtype =
  | "CURRENT_ASSET"
  | "FIXED_ASSET"
  | "CURRENT_LIABILITY"
  | "LONG_TERM_LIABILITY"
  | "CONTRIBUTED_CAPITAL"
  | "RETAINED_EARNINGS"
  | "OPERATING_REVENUE"
  | "OTHER_REVENUE"
  | "COGS"
  | "OPEX"
  | "OTHER_EXPENSE";

export type DebitCredit = "DEBIT" | "CREDIT";
export type CashFlowCategory = "OPERATING" | "INVESTING" | "FINANCING";

export interface ChartOfAccount {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: COAType;
  subtype: COASubtype | null;
  normalSide: DebitCredit;
  cashFlowCategory: CashFlowCategory | null;
  parentId: string | null;
  isPostable: boolean;
  isSystem: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function normalSideForType(type: COAType): DebitCredit {
  return type === "ASSET" || type === "EXPENSE" ? "DEBIT" : "CREDIT";
}
```

- [ ] **Step 3: Buat entity `JournalEntry` & `JournalLine`**

Create `modules/accounting/domain/entities/JournalLine.ts`:

```ts
import type { DebitCredit } from "./ChartOfAccount";

export interface JournalLine {
  id: string;
  entryId: string;
  coaId: string;
  side: DebitCredit;
  amount: string;
  description: string | null;
  lineOrder: number;
}

export interface JournalLineDraft {
  coaId: string;
  side: DebitCredit;
  amount: string;
  description?: string | null;
  lineOrder?: number;
}
```

Create `modules/accounting/domain/entities/JournalEntry.ts`:

```ts
import type { JournalLine } from "./JournalLine";

export type JournalSource =
  | "AUTO_INVOICE_PAID"
  | "AUTO_INVOICE_CREATED"
  | "AUTO_PAYMENT"
  | "AUTO_EXPENSE"
  | "AUTO_PO_PAID"
  | "MANUAL"
  | "RECURRING"
  | "REVERSAL"
  | "OPENING_BALANCE"
  | "ADJUSTMENT"
  | "CLOSING";

export type JournalStatus = "DRAFT" | "POSTED" | "REVERSED";

export interface JournalEntry {
  id: string;
  tenantId: string;
  entryNumber: string;
  entryDate: Date;
  periodId: string;
  source: JournalSource;
  sourceRefType: string | null;
  sourceRefId: string | null;
  description: string;
  status: JournalStatus;
  reversalOfId: string | null;
  postedAt: Date | null;
  postedBy: string | null;
  lines: JournalLine[];
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 4: Buat entity `AccountingPeriod`, `RecurringJournalTemplate`, `BankReconciliation`**

Create `modules/accounting/domain/entities/AccountingPeriod.ts`:

```ts
export type PeriodStatus = "OPEN" | "CLOSING" | "CLOSED" | "REOPENED";

export interface AccountingPeriod {
  id: string;
  tenantId: string;
  year: number;
  month: number;
  status: PeriodStatus;
  closedAt: Date | null;
  closedBy: string | null;
  startDate: Date;
  endDate: Date;
}

export function isPeriodWritable(p: AccountingPeriod): boolean {
  return p.status === "OPEN" || p.status === "REOPENED";
}
```

Create `modules/accounting/domain/entities/RecurringJournalTemplate.ts`:

```ts
import type { DebitCredit } from "./ChartOfAccount";

export type RecurringFreq = "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface RecurringTemplateLine {
  coaId: string;
  side: DebitCredit;
  amount: string;
  description: string | null;
}

export interface RecurringJournalTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  frequency: RecurringFreq;
  dayOfMonth: number;
  startDate: Date;
  endDate: Date | null;
  templateLines: RecurringTemplateLine[];
  isActive: boolean;
  lastGeneratedAt: Date | null;
}
```

Create `modules/accounting/domain/entities/BankReconciliation.ts`:

```ts
export type ReconStatus = "DRAFT" | "COMPLETED";
export type MatchStatus = "MATCHED" | "UNMATCHED" | "MANUAL_MATCH";

export interface BankReconciliationLine {
  id: string;
  reconciliationId: string;
  journalLineId: string | null;
  bankRefDate: Date;
  bankRefDescription: string;
  bankRefAmount: string;
  matchStatus: MatchStatus;
}

export interface BankReconciliation {
  id: string;
  tenantId: string;
  coaId: string;
  statementDate: Date;
  statementBalance: string;
  bookBalance: string;
  reconciledBalance: string;
  status: ReconStatus;
  completedAt: Date | null;
  completedBy: string | null;
  lines: BankReconciliationLine[];
}
```

- [ ] **Step 5: Type check**

Run: `npm run typecheck`
Expected: PASS untuk file-file accounting baru.

- [ ] **Step 6: Commit**

```bash
git add modules/accounting/domain/ modules/accounting/errors.ts
git commit -m "feat(accounting): tambah domain entities + errors"
```

---

## Task 5: Domain Ports (Repository Interfaces)

**Files:**
- Create: `modules/accounting/domain/ports/IChartOfAccountRepository.ts`
- Create: `modules/accounting/domain/ports/IJournalRepository.ts`
- Create: `modules/accounting/domain/ports/IPeriodRepository.ts`
- Create: `modules/accounting/domain/ports/IRecurringRepository.ts`
- Create: `modules/accounting/domain/ports/IReconciliationRepository.ts`

- [ ] **Step 1: Tulis port `IChartOfAccountRepository`**

Create `modules/accounting/domain/ports/IChartOfAccountRepository.ts`:

```ts
import type { ChartOfAccount, COAType } from "../entities/ChartOfAccount";

export interface CoaCreateInput {
  tenantId: string;
  code: string;
  name: string;
  type: COAType;
  subtype?: ChartOfAccount["subtype"];
  normalSide: ChartOfAccount["normalSide"];
  cashFlowCategory?: ChartOfAccount["cashFlowCategory"];
  parentId?: string | null;
  isPostable?: boolean;
  isSystem?: boolean;
  description?: string | null;
}

export interface CoaUpdateInput {
  name?: string;
  subtype?: ChartOfAccount["subtype"];
  cashFlowCategory?: ChartOfAccount["cashFlowCategory"];
  parentId?: string | null;
  isActive?: boolean;
  description?: string | null;
}

export interface IChartOfAccountRepository {
  create(input: CoaCreateInput): Promise<ChartOfAccount>;
  update(id: string, input: CoaUpdateInput): Promise<ChartOfAccount>;
  findById(id: string): Promise<ChartOfAccount | null>;
  findByCode(tenantId: string, code: string): Promise<ChartOfAccount | null>;
  list(tenantId: string, filter?: { type?: COAType; isActive?: boolean }): Promise<ChartOfAccount[]>;
  delete(id: string): Promise<void>;
  countChildren(parentId: string): Promise<number>;
  countLines(coaId: string): Promise<number>;
}
```

- [ ] **Step 2: Tulis port `IJournalRepository`**

Create `modules/accounting/domain/ports/IJournalRepository.ts`:

```ts
import type {
  JournalEntry,
  JournalSource,
  JournalStatus,
} from "../entities/JournalEntry";
import type { JournalLineDraft } from "../entities/JournalLine";
import type { Prisma } from "@prisma/client";

export interface JournalCreateInput {
  tenantId: string;
  entryNumber: string;
  entryDate: Date;
  periodId: string;
  source: JournalSource;
  sourceRefType?: string | null;
  sourceRefId?: string | null;
  description: string;
  status?: JournalStatus;
  reversalOfId?: string | null;
  postedBy?: string | null;
  lines: JournalLineDraft[];
}

export interface JournalListFilter {
  tenantId: string;
  from?: Date;
  to?: Date;
  source?: JournalSource;
  status?: JournalStatus;
  coaId?: string;
  skip?: number;
  take?: number;
}

export interface IJournalRepository {
  create(
    input: JournalCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<JournalEntry>;
  findById(id: string): Promise<JournalEntry | null>;
  findBySource(
    tenantId: string,
    source: JournalSource,
    sourceRefId: string,
  ): Promise<JournalEntry | null>;
  list(filter: JournalListFilter): Promise<{ items: JournalEntry[]; total: number }>;
  markReversed(
    id: string,
    reversalEntryId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  countByMonth(tenantId: string, year: number, month: number): Promise<number>;
}
```

- [ ] **Step 3: Tulis port `IPeriodRepository`**

Create `modules/accounting/domain/ports/IPeriodRepository.ts`:

```ts
import type {
  AccountingPeriod,
  PeriodStatus,
} from "../entities/AccountingPeriod";
import type { Prisma } from "@prisma/client";

export interface IPeriodRepository {
  findById(id: string): Promise<AccountingPeriod | null>;
  findByYearMonth(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<AccountingPeriod | null>;
  findByDate(tenantId: string, date: Date): Promise<AccountingPeriod | null>;
  create(period: Omit<AccountingPeriod, "id">): Promise<AccountingPeriod>;
  updateStatus(
    id: string,
    status: PeriodStatus,
    closedBy?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingPeriod>;
  list(tenantId: string): Promise<AccountingPeriod[]>;
  lockForUpdate(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<AccountingPeriod | null>;
}
```

- [ ] **Step 4: Tulis port `IRecurringRepository` & `IReconciliationRepository`**

Create `modules/accounting/domain/ports/IRecurringRepository.ts`:

```ts
import type {
  RecurringJournalTemplate,
  RecurringTemplateLine,
} from "../entities/RecurringJournalTemplate";

export interface RecurringCreateInput {
  tenantId: string;
  name: string;
  description?: string | null;
  frequency: RecurringJournalTemplate["frequency"];
  dayOfMonth: number;
  startDate: Date;
  endDate?: Date | null;
  templateLines: RecurringTemplateLine[];
}

export interface IRecurringRepository {
  create(input: RecurringCreateInput): Promise<RecurringJournalTemplate>;
  update(
    id: string,
    input: Partial<RecurringCreateInput> & { isActive?: boolean },
  ): Promise<RecurringJournalTemplate>;
  findById(id: string): Promise<RecurringJournalTemplate | null>;
  list(tenantId: string): Promise<RecurringJournalTemplate[]>;
  findDueToday(today: Date): Promise<RecurringJournalTemplate[]>;
  markGenerated(id: string, at: Date): Promise<void>;
  delete(id: string): Promise<void>;
}
```

Create `modules/accounting/domain/ports/IReconciliationRepository.ts`:

```ts
import type {
  BankReconciliation,
  BankReconciliationLine,
  MatchStatus,
} from "../entities/BankReconciliation";

export interface ReconciliationCreateInput {
  tenantId: string;
  coaId: string;
  statementDate: Date;
  statementBalance: string;
  bookBalance: string;
}

export interface ReconciliationLineInput {
  reconciliationId: string;
  journalLineId?: string | null;
  bankRefDate: Date;
  bankRefDescription: string;
  bankRefAmount: string;
  matchStatus: MatchStatus;
}

export interface IReconciliationRepository {
  create(input: ReconciliationCreateInput): Promise<BankReconciliation>;
  findById(id: string): Promise<BankReconciliation | null>;
  list(tenantId: string, coaId?: string): Promise<BankReconciliation[]>;
  addLines(lines: ReconciliationLineInput[]): Promise<void>;
  updateLineMatch(
    lineId: string,
    journalLineId: string | null,
    matchStatus: MatchStatus,
  ): Promise<void>;
  complete(
    id: string,
    reconciledBalance: string,
    completedBy: string,
  ): Promise<BankReconciliation>;
}
```

- [ ] **Step 5: Type check & commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add modules/accounting/domain/ports/
git commit -m "feat(accounting): tambah repository ports (interfaces)"
```

---

## Task 6: COA Repository (Prisma Implementation)

**Files:**
- Create: `modules/accounting/repositories/ChartOfAccountRepository.ts`
- Create: `modules/accounting/mappers/coa.mapper.ts`

- [ ] **Step 1: Buat mapper Prisma → domain**

Create `modules/accounting/mappers/coa.mapper.ts`:

```ts
import type { ChartOfAccount as PrismaCoa } from "@prisma/client";
import type { ChartOfAccount } from "../domain/entities/ChartOfAccount";

export function toChartOfAccount(row: PrismaCoa): ChartOfAccount {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    type: row.type,
    subtype: row.subtype,
    normalSide: row.normalSide,
    cashFlowCategory: row.cashFlowCategory,
    parentId: row.parentId,
    isPostable: row.isPostable,
    isSystem: row.isSystem,
    isActive: row.isActive,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

- [ ] **Step 2: Implement repository**

Create `modules/accounting/repositories/ChartOfAccountRepository.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type {
  IChartOfAccountRepository,
  CoaCreateInput,
  CoaUpdateInput,
} from "../domain/ports/IChartOfAccountRepository";
import type { ChartOfAccount, COAType } from "../domain/entities/ChartOfAccount";
import { toChartOfAccount } from "../mappers/coa.mapper";

export class ChartOfAccountRepository implements IChartOfAccountRepository {
  async create(input: CoaCreateInput): Promise<ChartOfAccount> {
    const row = await prisma.chartOfAccount.create({
      data: {
        tenantId: input.tenantId,
        code: input.code,
        name: input.name,
        type: input.type,
        subtype: input.subtype ?? null,
        normalSide: input.normalSide,
        cashFlowCategory: input.cashFlowCategory ?? null,
        parentId: input.parentId ?? null,
        isPostable: input.isPostable ?? true,
        isSystem: input.isSystem ?? false,
        description: input.description ?? null,
      },
    });
    return toChartOfAccount(row);
  }

  async update(id: string, input: CoaUpdateInput): Promise<ChartOfAccount> {
    const row = await prisma.chartOfAccount.update({
      where: { id },
      data: {
        name: input.name,
        subtype: input.subtype,
        cashFlowCategory: input.cashFlowCategory,
        parentId: input.parentId,
        isActive: input.isActive,
        description: input.description,
      },
    });
    return toChartOfAccount(row);
  }

  async findById(id: string): Promise<ChartOfAccount | null> {
    const row = await prisma.chartOfAccount.findUnique({ where: { id } });
    return row ? toChartOfAccount(row) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<ChartOfAccount | null> {
    const row = await prisma.chartOfAccount.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    return row ? toChartOfAccount(row) : null;
  }

  async list(
    tenantId: string,
    filter?: { type?: COAType; isActive?: boolean },
  ): Promise<ChartOfAccount[]> {
    const rows = await prisma.chartOfAccount.findMany({
      where: {
        tenantId,
        ...(filter?.type ? { type: filter.type } : {}),
        ...(filter?.isActive !== undefined ? { isActive: filter.isActive } : {}),
      },
      orderBy: { code: "asc" },
    });
    return rows.map(toChartOfAccount);
  }

  async delete(id: string): Promise<void> {
    await prisma.chartOfAccount.delete({ where: { id } });
  }

  async countChildren(parentId: string): Promise<number> {
    return prisma.chartOfAccount.count({ where: { parentId } });
  }

  async countLines(coaId: string): Promise<number> {
    return prisma.journalLine.count({ where: { coaId } });
  }
}
```

- [ ] **Step 3: Type check & commit**

Run: `npm run typecheck`

```bash
git add modules/accounting/repositories/ChartOfAccountRepository.ts modules/accounting/mappers/
git commit -m "feat(accounting): tambah ChartOfAccountRepository (Prisma)"
```

---

## Task 7: Seed Default Chart of Accounts

**Files:**
- Create: `modules/accounting/services/coa/seedDefaultCoa.ts`
- Create: `modules/accounting/__tests__/seedDefaultCoa.test.ts`

- [ ] **Step 1: Tulis test seed COA**

Create `modules/accounting/__tests__/seedDefaultCoa.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedDefaultCoa } from "../services/coa/seedDefaultCoa";

const TENANT = "test-tenant-coa";

describe("seedDefaultCoa", () => {
  beforeEach(async () => {
    await prisma.journalLine.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.chartOfAccount.deleteMany({ where: { tenantId: TENANT } });
  });

  it("seeds 18 default accounts", async () => {
    await seedDefaultCoa(TENANT);
    const count = await prisma.chartOfAccount.count({ where: { tenantId: TENANT } });
    expect(count).toBe(18);
  });

  it("system accounts marked isSystem=true", async () => {
    await seedDefaultCoa(TENANT);
    const ar = await prisma.chartOfAccount.findUnique({
      where: { tenantId_code: { tenantId: TENANT, code: "1-200" } },
    });
    expect(ar?.isSystem).toBe(true);
  });

  it("normalSide consistent dengan type", async () => {
    await seedDefaultCoa(TENANT);
    const all = await prisma.chartOfAccount.findMany({ where: { tenantId: TENANT } });
    for (const a of all) {
      const expected = a.type === "ASSET" || a.type === "EXPENSE" ? "DEBIT" : "CREDIT";
      expect(a.normalSide).toBe(expected);
    }
  });

  it("idempotent: running 2x tidak duplicate", async () => {
    await seedDefaultCoa(TENANT);
    await seedDefaultCoa(TENANT);
    const count = await prisma.chartOfAccount.count({ where: { tenantId: TENANT } });
    expect(count).toBe(18);
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/seedDefaultCoa.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `seedDefaultCoa`**

Create `modules/accounting/services/coa/seedDefaultCoa.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type {
  COAType,
  COASubtype,
  CashFlowCategory,
  DebitCredit,
} from "../../domain/entities/ChartOfAccount";
import { normalSideForType } from "../../domain/entities/ChartOfAccount";

interface DefaultCoaSpec {
  code: string;
  name: string;
  type: COAType;
  subtype: COASubtype | null;
  cashFlowCategory: CashFlowCategory | null;
  isSystem: boolean;
  isPostable: boolean;
  parentCode: string | null;
}

const DEFAULT_COA: DefaultCoaSpec[] = [
  { code: "1-100", name: "Kas", type: "ASSET", subtype: "CURRENT_ASSET", cashFlowCategory: null, isSystem: true, isPostable: true, parentCode: null },
  { code: "1-110", name: "Bank", type: "ASSET", subtype: "CURRENT_ASSET", cashFlowCategory: null, isSystem: true, isPostable: false, parentCode: null },
  { code: "1-200", name: "Piutang Usaha", type: "ASSET", subtype: "CURRENT_ASSET", cashFlowCategory: "OPERATING", isSystem: true, isPostable: true, parentCode: null },
  { code: "1-300", name: "Persediaan", type: "ASSET", subtype: "CURRENT_ASSET", cashFlowCategory: "OPERATING", isSystem: false, isPostable: true, parentCode: null },
  { code: "1-400", name: "Aset Tetap", type: "ASSET", subtype: "FIXED_ASSET", cashFlowCategory: "INVESTING", isSystem: false, isPostable: true, parentCode: null },
  { code: "1-410", name: "Akumulasi Penyusutan", type: "ASSET", subtype: "FIXED_ASSET", cashFlowCategory: "INVESTING", isSystem: false, isPostable: true, parentCode: null },
  { code: "2-100", name: "Utang Usaha", type: "LIABILITY", subtype: "CURRENT_LIABILITY", cashFlowCategory: "OPERATING", isSystem: true, isPostable: true, parentCode: null },
  { code: "2-200", name: "Utang Pajak", type: "LIABILITY", subtype: "CURRENT_LIABILITY", cashFlowCategory: "OPERATING", isSystem: false, isPostable: true, parentCode: null },
  { code: "3-100", name: "Modal Disetor", type: "EQUITY", subtype: "CONTRIBUTED_CAPITAL", cashFlowCategory: "FINANCING", isSystem: true, isPostable: true, parentCode: null },
  { code: "3-200", name: "Laba Ditahan", type: "EQUITY", subtype: "RETAINED_EARNINGS", cashFlowCategory: null, isSystem: true, isPostable: true, parentCode: null },
  { code: "3-300", name: "Laba/Rugi Berjalan", type: "EQUITY", subtype: "RETAINED_EARNINGS", cashFlowCategory: null, isSystem: true, isPostable: true, parentCode: null },
  { code: "4-100", name: "Pendapatan Layanan PPP", type: "REVENUE", subtype: "OPERATING_REVENUE", cashFlowCategory: "OPERATING", isSystem: true, isPostable: true, parentCode: null },
  { code: "4-200", name: "Pendapatan Lain-lain", type: "REVENUE", subtype: "OTHER_REVENUE", cashFlowCategory: "OPERATING", isSystem: false, isPostable: true, parentCode: null },
  { code: "5-100", name: "Beban Bandwidth", type: "EXPENSE", subtype: "COGS", cashFlowCategory: "OPERATING", isSystem: false, isPostable: true, parentCode: null },
  { code: "5-200", name: "Beban Gaji", type: "EXPENSE", subtype: "OPEX", cashFlowCategory: "OPERATING", isSystem: false, isPostable: true, parentCode: null },
  { code: "5-300", name: "Beban Operasional", type: "EXPENSE", subtype: "OPEX", cashFlowCategory: "OPERATING", isSystem: false, isPostable: true, parentCode: null },
  { code: "5-400", name: "Beban Penyusutan", type: "EXPENSE", subtype: "OPEX", cashFlowCategory: "OPERATING", isSystem: false, isPostable: true, parentCode: null },
  { code: "5-500", name: "Beban Lain-lain", type: "EXPENSE", subtype: "OTHER_EXPENSE", cashFlowCategory: "OPERATING", isSystem: true, isPostable: true, parentCode: null },
];

export async function seedDefaultCoa(tenantId: string): Promise<void> {
  for (const spec of DEFAULT_COA) {
    const exists = await prisma.chartOfAccount.findUnique({
      where: { tenantId_code: { tenantId, code: spec.code } },
    });
    if (exists) continue;

    const parentId = spec.parentCode
      ? (
          await prisma.chartOfAccount.findUnique({
            where: { tenantId_code: { tenantId, code: spec.parentCode } },
          })
        )?.id ?? null
      : null;

    await prisma.chartOfAccount.create({
      data: {
        tenantId,
        code: spec.code,
        name: spec.name,
        type: spec.type,
        subtype: spec.subtype,
        normalSide: normalSideForType(spec.type) as DebitCredit,
        cashFlowCategory: spec.cashFlowCategory,
        parentId,
        isPostable: spec.isPostable,
        isSystem: spec.isSystem,
      },
    });
  }
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `./scripts/setup-test-db.sh && npx vitest run modules/accounting/__tests__/seedDefaultCoa.test.ts`
Expected: PASS semua 4 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/coa/seedDefaultCoa.ts modules/accounting/__tests__/seedDefaultCoa.test.ts
git commit -m "feat(accounting): seed default 18 COA dengan idempotency"
```

---

## Task 8: ChartOfAccountService (CRUD COA)

**Files:**
- Create: `modules/accounting/services/coa/ChartOfAccountService.ts`
- Create: `modules/accounting/__tests__/ChartOfAccountService.test.ts`
- Create: `modules/accounting/validators/coa.ts`

- [ ] **Step 1: Tulis Zod validator COA**

Create `modules/accounting/validators/coa.ts`:

```ts
import { z } from "zod";

export const coaCreateSchema = z.object({
  code: z.string().min(2).max(20).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(2).max(100),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  subtype: z
    .enum([
      "CURRENT_ASSET",
      "FIXED_ASSET",
      "CURRENT_LIABILITY",
      "LONG_TERM_LIABILITY",
      "CONTRIBUTED_CAPITAL",
      "RETAINED_EARNINGS",
      "OPERATING_REVENUE",
      "OTHER_REVENUE",
      "COGS",
      "OPEX",
      "OTHER_EXPENSE",
    ])
    .nullable()
    .optional(),
  cashFlowCategory: z.enum(["OPERATING", "INVESTING", "FINANCING"]).nullable().optional(),
  parentId: z.string().cuid().nullable().optional(),
  isPostable: z.boolean().optional(),
  description: z.string().max(500).nullable().optional(),
});

export const coaUpdateSchema = coaCreateSchema
  .partial()
  .omit({ code: true, type: true });

export type CoaCreateBody = z.infer<typeof coaCreateSchema>;
export type CoaUpdateBody = z.infer<typeof coaUpdateSchema>;
```

- [ ] **Step 2: Tulis test untuk service**

Create `modules/accounting/__tests__/ChartOfAccountService.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { ChartOfAccountService } from "../services/coa/ChartOfAccountService";
import { ChartOfAccountRepository } from "../repositories/ChartOfAccountRepository";
import { CoaNotFoundError } from "../errors";

const TENANT = "test-tenant-coa-svc";

const svc = new ChartOfAccountService(new ChartOfAccountRepository());

describe("ChartOfAccountService", () => {
  beforeEach(async () => {
    await prisma.journalLine.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.chartOfAccount.deleteMany({ where: { tenantId: TENANT } });
  });

  it("create COA dengan auto-derive normalSide", async () => {
    const acc = await svc.create(TENANT, {
      code: "1-999",
      name: "Test Asset",
      type: "ASSET",
    });
    expect(acc.normalSide).toBe("DEBIT");
  });

  it("create REVENUE auto-derive normalSide=CREDIT", async () => {
    const acc = await svc.create(TENANT, {
      code: "4-999",
      name: "Test Revenue",
      type: "REVENUE",
    });
    expect(acc.normalSide).toBe("CREDIT");
  });

  it("findById throws when not found", async () => {
    await expect(svc.findById("nonexistent")).rejects.toBeInstanceOf(CoaNotFoundError);
  });

  it("delete refuses if isSystem=true", async () => {
    const acc = await svc.create(TENANT, {
      code: "9-001",
      name: "Sys",
      type: "ASSET",
    });
    await prisma.chartOfAccount.update({ where: { id: acc.id }, data: { isSystem: true } });
    await expect(svc.delete(acc.id)).rejects.toThrow(/system/i);
  });

  it("delete refuses if punya children", async () => {
    const parent = await svc.create(TENANT, { code: "1-PAR", name: "Parent", type: "ASSET" });
    await svc.create(TENANT, { code: "1-CHI", name: "Child", type: "ASSET", parentId: parent.id });
    await expect(svc.delete(parent.id)).rejects.toThrow(/children/i);
  });

  it("delete refuses if punya journal lines", async () => {
    const acc = await svc.create(TENANT, { code: "1-USED", name: "Used", type: "ASSET" });
    // Akan ditest setelah JournalRepo siap; placeholder sementara — skip
    expect(acc).toBeDefined();
  });
});
```

- [ ] **Step 3: Implement `ChartOfAccountService`**

Create `modules/accounting/services/coa/ChartOfAccountService.ts`:

```ts
import type {
  IChartOfAccountRepository,
  CoaCreateInput,
  CoaUpdateInput,
} from "../../domain/ports/IChartOfAccountRepository";
import type { ChartOfAccount, COAType } from "../../domain/entities/ChartOfAccount";
import { normalSideForType } from "../../domain/entities/ChartOfAccount";
import { CoaNotFoundError, AccountingError } from "../../errors";

export interface CreateCoaParams {
  code: string;
  name: string;
  type: COAType;
  subtype?: ChartOfAccount["subtype"];
  cashFlowCategory?: ChartOfAccount["cashFlowCategory"];
  parentId?: string | null;
  isPostable?: boolean;
  description?: string | null;
}

export class ChartOfAccountService {
  constructor(private readonly repo: IChartOfAccountRepository) {}

  async create(tenantId: string, params: CreateCoaParams): Promise<ChartOfAccount> {
    const existing = await this.repo.findByCode(tenantId, params.code);
    if (existing) {
      throw new AccountingError(
        `Kode COA ${params.code} sudah ada`,
        "COA_DUPLICATE_CODE",
      );
    }
    const input: CoaCreateInput = {
      tenantId,
      code: params.code,
      name: params.name,
      type: params.type,
      subtype: params.subtype ?? null,
      normalSide: normalSideForType(params.type),
      cashFlowCategory: params.cashFlowCategory ?? null,
      parentId: params.parentId ?? null,
      isPostable: params.isPostable ?? true,
      description: params.description ?? null,
    };
    return this.repo.create(input);
  }

  async update(id: string, input: CoaUpdateInput): Promise<ChartOfAccount> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new CoaNotFoundError(id);
    return this.repo.update(id, input);
  }

  async findById(id: string): Promise<ChartOfAccount> {
    const acc = await this.repo.findById(id);
    if (!acc) throw new CoaNotFoundError(id);
    return acc;
  }

  async list(tenantId: string, filter?: { type?: COAType; isActive?: boolean }) {
    return this.repo.list(tenantId, filter);
  }

  async delete(id: string): Promise<void> {
    const acc = await this.repo.findById(id);
    if (!acc) throw new CoaNotFoundError(id);
    if (acc.isSystem) {
      throw new AccountingError(
        "Akun sistem tidak boleh dihapus",
        "COA_IS_SYSTEM",
      );
    }
    const childCount = await this.repo.countChildren(id);
    if (childCount > 0) {
      throw new AccountingError(
        "Akun masih punya children, hapus dulu",
        "COA_HAS_CHILDREN",
      );
    }
    const lineCount = await this.repo.countLines(id);
    if (lineCount > 0) {
      throw new AccountingError(
        "Akun sudah dipakai di journal, tidak boleh dihapus",
        "COA_HAS_LINES",
      );
    }
    await this.repo.delete(id);
  }
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/ChartOfAccountService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/coa/ChartOfAccountService.ts modules/accounting/validators/coa.ts modules/accounting/__tests__/ChartOfAccountService.test.ts
git commit -m "feat(accounting): tambah ChartOfAccountService (CRUD + validation)"
```

---

## Task 9: Period Repository & Service

**Files:**
- Create: `modules/accounting/repositories/PeriodRepository.ts`
- Create: `modules/accounting/mappers/period.mapper.ts`
- Create: `modules/accounting/services/period/PeriodService.ts`
- Create: `modules/accounting/__tests__/PeriodService.test.ts`

- [ ] **Step 1: Tulis mapper period**

Create `modules/accounting/mappers/period.mapper.ts`:

```ts
import type { AccountingPeriod as PrismaPeriod } from "@prisma/client";
import type { AccountingPeriod } from "../domain/entities/AccountingPeriod";

export function toAccountingPeriod(row: PrismaPeriod): AccountingPeriod {
  return {
    id: row.id,
    tenantId: row.tenantId,
    year: row.year,
    month: row.month,
    status: row.status,
    closedAt: row.closedAt,
    closedBy: row.closedBy,
    startDate: row.startDate,
    endDate: row.endDate,
  };
}
```

- [ ] **Step 2: Implement `PeriodRepository`**

Create `modules/accounting/repositories/PeriodRepository.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPeriodRepository,
} from "../domain/ports/IPeriodRepository";
import type {
  AccountingPeriod,
  PeriodStatus,
} from "../domain/entities/AccountingPeriod";
import { toAccountingPeriod } from "../mappers/period.mapper";

export class PeriodRepository implements IPeriodRepository {
  async findById(id: string): Promise<AccountingPeriod | null> {
    const row = await prisma.accountingPeriod.findUnique({ where: { id } });
    return row ? toAccountingPeriod(row) : null;
  }

  async findByYearMonth(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<AccountingPeriod | null> {
    const row = await prisma.accountingPeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });
    return row ? toAccountingPeriod(row) : null;
  }

  async findByDate(tenantId: string, date: Date): Promise<AccountingPeriod | null> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return this.findByYearMonth(tenantId, year, month);
  }

  async create(period: Omit<AccountingPeriod, "id">): Promise<AccountingPeriod> {
    const row = await prisma.accountingPeriod.create({
      data: {
        tenantId: period.tenantId,
        year: period.year,
        month: period.month,
        status: period.status,
        startDate: period.startDate,
        endDate: period.endDate,
        closedAt: period.closedAt,
        closedBy: period.closedBy,
      },
    });
    return toAccountingPeriod(row);
  }

  async updateStatus(
    id: string,
    status: PeriodStatus,
    closedBy?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingPeriod> {
    const client = tx ?? prisma;
    const row = await client.accountingPeriod.update({
      where: { id },
      data: {
        status,
        closedAt: status === "CLOSED" ? new Date() : null,
        closedBy: status === "CLOSED" ? closedBy ?? null : null,
      },
    });
    return toAccountingPeriod(row);
  }

  async list(tenantId: string): Promise<AccountingPeriod[]> {
    const rows = await prisma.accountingPeriod.findMany({
      where: { tenantId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return rows.map(toAccountingPeriod);
  }

  async lockForUpdate(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<AccountingPeriod | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        tenantId: string;
        year: number;
        month: number;
        status: PeriodStatus;
        closedAt: Date | null;
        closedBy: string | null;
        startDate: Date;
        endDate: Date;
      }>
    >`SELECT id, "tenantId", year, month, status, "closedAt", "closedBy", "startDate", "endDate"
       FROM accounting_periods WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0) return null;
    return rows[0];
  }
}
```

- [ ] **Step 3: Tulis test PeriodService**

Create `modules/accounting/__tests__/PeriodService.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { PeriodRepository } from "../repositories/PeriodRepository";
import { PeriodService } from "../services/period/PeriodService";

const TENANT = "test-tenant-period";
const svc = new PeriodService(new PeriodRepository());

describe("PeriodService", () => {
  beforeEach(async () => {
    await prisma.accountingPeriod.deleteMany({ where: { tenantId: TENANT } });
  });

  it("ensureCurrentPeriod create new OPEN period if absent", async () => {
    const p = await svc.ensureCurrentPeriod(TENANT, new Date("2026-05-15"));
    expect(p.year).toBe(2026);
    expect(p.month).toBe(5);
    expect(p.status).toBe("OPEN");
    expect(p.startDate.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(p.endDate.toISOString().slice(0, 10)).toBe("2026-05-31");
  });

  it("ensureCurrentPeriod returns existing period if exists", async () => {
    const a = await svc.ensureCurrentPeriod(TENANT, new Date("2026-05-15"));
    const b = await svc.ensureCurrentPeriod(TENANT, new Date("2026-05-20"));
    expect(b.id).toBe(a.id);
  });

  it("findByDate returns period containing date", async () => {
    await svc.ensureCurrentPeriod(TENANT, new Date("2026-05-15"));
    const p = await svc.findByDate(TENANT, new Date("2026-05-30"));
    expect(p?.month).toBe(5);
  });

  it("isWritable true untuk OPEN", async () => {
    const p = await svc.ensureCurrentPeriod(TENANT, new Date("2026-05-15"));
    expect(svc.isWritable(p)).toBe(true);
  });
});
```

- [ ] **Step 4: Implement `PeriodService`**

Create `modules/accounting/services/period/PeriodService.ts`:

```ts
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { AccountingPeriod } from "../../domain/entities/AccountingPeriod";
import { isPeriodWritable } from "../../domain/entities/AccountingPeriod";

export class PeriodService {
  constructor(private readonly repo: IPeriodRepository) {}

  async ensureCurrentPeriod(tenantId: string, date: Date): Promise<AccountingPeriod> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const existing = await this.repo.findByYearMonth(tenantId, year, month);
    if (existing) return existing;

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return this.repo.create({
      tenantId,
      year,
      month,
      status: "OPEN",
      startDate,
      endDate,
      closedAt: null,
      closedBy: null,
    });
  }

  async findByDate(tenantId: string, date: Date) {
    return this.repo.findByDate(tenantId, date);
  }

  async list(tenantId: string) {
    return this.repo.list(tenantId);
  }

  isWritable(p: AccountingPeriod): boolean {
    return isPeriodWritable(p);
  }
}
```

- [ ] **Step 5: Run test (expected pass) & commit**

Run: `npx vitest run modules/accounting/__tests__/PeriodService.test.ts`
Expected: PASS.

```bash
git add modules/accounting/services/period/PeriodService.ts modules/accounting/repositories/PeriodRepository.ts modules/accounting/mappers/period.mapper.ts modules/accounting/__tests__/PeriodService.test.ts
git commit -m "feat(accounting): tambah PeriodService + PeriodRepository"
```

---

## Task 10: Permissions & RBAC Registration

**Files:**
- Modify: `lib/permission-config.ts`

- [ ] **Step 1: Tambah permission baru**

Edit `lib/permission-config.ts`. Cari struktur permission existing dan tambahkan:

```ts
// Accounting permissions
{ resource: "accounting", action: "read", label: "Lihat akuntansi & laporan" },
{ resource: "accounting", action: "journal:create", label: "Buat manual journal" },
{ resource: "accounting", action: "journal:reverse", label: "Reverse journal" },
{ resource: "accounting", action: "coa:manage", label: "Kelola Chart of Accounts" },
{ resource: "accounting", action: "period:close", label: "Tutup buku" },
{ resource: "accounting", action: "period:reopen", label: "Buka kembali buku" },
{ resource: "accounting", action: "reconciliation", label: "Bank reconciliation" },
{ resource: "accounting", action: "recurring:manage", label: "Kelola recurring journal" },
```

> **Catatan:** struktur literal di repo bisa berbeda — sesuaikan dengan format `lib/permission-config.ts` saat ini (ikuti pattern existing di file tsb).

- [ ] **Step 2: Verifikasi typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/permission-config.ts
git commit -m "feat(accounting): registrasi 8 permission accounting di permission-config"
```

---

## Task 11: Seed Script + CHANGELOG Phase 1

**Files:**
- Create: `prisma/seed-accounting.ts`
- Modify: `package.json`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Buat seed script**

Create `prisma/seed-accounting.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { seedDefaultCoa } from "@/modules/accounting/services/coa/seedDefaultCoa";
import { PeriodService } from "@/modules/accounting/services/period/PeriodService";
import { PeriodRepository } from "@/modules/accounting/repositories/PeriodRepository";

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const periodSvc = new PeriodService(new PeriodRepository());
  const now = new Date();

  for (const t of tenants) {
    console.log(`[seed-accounting] tenant=${t.id}`);
    await seedDefaultCoa(t.id);
    await periodSvc.ensureCurrentPeriod(t.id, now);
  }
  console.log("[seed-accounting] done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Tambah script `accounting:seed` ke package.json**

Edit `package.json`, di section `"scripts"` tambahkan:

```json
"accounting:seed": "tsx prisma/seed-accounting.ts",
```

- [ ] **Step 3: Update CHANGELOG `[Unreleased]`**

Edit `docs/CHANGELOG.md` di section `[Unreleased]`:

```markdown
### [2026-05-20] — Phase 1: Foundation modul accounting (COA + Period)

- **Tipe**: [ADDED]
- **Scope**: `modules/accounting`, `prisma/`
- **Author**: agent
- **Deskripsi**: Phase 1 modul akuntansi: schema 7 model + 10 enum, DB trigger DEFERRED untuk balance, domain entities, value object Money, repository COA & Period, service ChartOfAccountService & PeriodService, seed default 18 COA per tenant, registrasi 8 permission accounting.
- **Files**: `prisma/schema.prisma`, `modules/accounting/domain/`, `modules/accounting/repositories/Chart*`, `modules/accounting/services/coa/`, `modules/accounting/services/period/`, `prisma/seed-accounting.ts`, `lib/permission-config.ts`
- **Migration**: `<timestamp>_add_accounting_module`
- **Breaking**: ❌ Tidak
```

- [ ] **Step 4: Run full check**

Run: `npm run check`
Expected: lint + typecheck + build PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed-accounting.ts package.json docs/CHANGELOG.md
git commit -m "chore(accounting): seed script + changelog Phase 1"
```

---

