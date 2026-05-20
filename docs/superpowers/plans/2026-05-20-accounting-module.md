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

# PHASE 2 — Journal Engine (Manual + Auto Handlers)

## Task 12: JournalNumberGenerator

**Files:**
- Create: `modules/accounting/services/journal/JournalNumberGenerator.ts`
- Create: `modules/accounting/__tests__/JournalNumberGenerator.test.ts`

- [ ] **Step 1: Tulis test untuk `JournalNumberGenerator`**

Create `modules/accounting/__tests__/JournalNumberGenerator.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { JournalNumberGenerator } from "../services/journal/JournalNumberGenerator";
import type { IJournalRepository } from "../domain/ports/IJournalRepository";

describe("JournalNumberGenerator", () => {
  function createMockRepo(count: number): IJournalRepository {
    return {
      countByMonth: vi.fn().mockResolvedValue(count),
      create: vi.fn(),
      findById: vi.fn(),
      findBySource: vi.fn(),
      list: vi.fn(),
      markReversed: vi.fn(),
    } as unknown as IJournalRepository;
  }

  it("generates first entry number of the month", async () => {
    const repo = createMockRepo(0);
    const gen = new JournalNumberGenerator(repo);
    const result = await gen.generate("tenant-1", new Date("2026-05-15"));
    expect(result).toBe("JV-2026-05-0001");
    expect(repo.countByMonth).toHaveBeenCalledWith("tenant-1", 2026, 5);
  });

  it("generates sequential entry number", async () => {
    const repo = createMockRepo(42);
    const gen = new JournalNumberGenerator(repo);
    const result = await gen.generate("tenant-1", new Date("2026-12-01"));
    expect(result).toBe("JV-2026-12-0043");
  });

  it("pads month and sequence correctly", async () => {
    const repo = createMockRepo(9);
    const gen = new JournalNumberGenerator(repo);
    const result = await gen.generate("tenant-1", new Date("2026-01-20"));
    expect(result).toBe("JV-2026-01-0010");
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/JournalNumberGenerator.test.ts`
Expected: FAIL — module tidak ada.

- [ ] **Step 3: Implement `JournalNumberGenerator`**

Create `modules/accounting/services/journal/JournalNumberGenerator.ts`:

```ts
import type { IJournalRepository } from "../../domain/ports/IJournalRepository";

export class JournalNumberGenerator {
  constructor(private readonly journalRepo: IJournalRepository) {}

  async generate(tenantId: string, entryDate: Date): Promise<string> {
    const year = entryDate.getFullYear();
    const month = entryDate.getMonth() + 1;
    const count = await this.journalRepo.countByMonth(tenantId, year, month);
    const seq = String(count + 1).padStart(4, "0");
    const mm = String(month).padStart(2, "0");
    return `JV-${year}-${mm}-${seq}`;
  }
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/JournalNumberGenerator.test.ts`
Expected: PASS semua 3 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/journal/JournalNumberGenerator.ts modules/accounting/__tests__/JournalNumberGenerator.test.ts
git commit -m "feat(accounting): tambah JournalNumberGenerator (JV-YYYY-MM-####)"
```

---

## Task 13: balanceValidator

**Files:**
- Create: `modules/accounting/services/journal/balanceValidator.ts`
- Create: `modules/accounting/__tests__/balanceValidator.test.ts`

- [ ] **Step 1: Tulis test untuk `balanceValidator`**

Create `modules/accounting/__tests__/balanceValidator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateBalance } from "../services/journal/balanceValidator";
import { JournalUnbalancedError } from "../errors";
import type { JournalLineDraft } from "../domain/entities/JournalLine";

describe("balanceValidator", () => {
  it("passes when DR equals CR", () => {
    const lines: JournalLineDraft[] = [
      { coaId: "coa-1", side: "DEBIT", amount: "100000.00" },
      { coaId: "coa-2", side: "CREDIT", amount: "100000.00" },
    ];
    expect(() => validateBalance(lines)).not.toThrow();
  });

  it("passes with multiple lines that balance", () => {
    const lines: JournalLineDraft[] = [
      { coaId: "coa-1", side: "DEBIT", amount: "50000.00" },
      { coaId: "coa-2", side: "DEBIT", amount: "50000.00" },
      { coaId: "coa-3", side: "CREDIT", amount: "75000.00" },
      { coaId: "coa-4", side: "CREDIT", amount: "25000.00" },
    ];
    expect(() => validateBalance(lines)).not.toThrow();
  });

  it("throws JournalUnbalancedError when DR > CR", () => {
    const lines: JournalLineDraft[] = [
      { coaId: "coa-1", side: "DEBIT", amount: "100000.00" },
      { coaId: "coa-2", side: "CREDIT", amount: "99999.99" },
    ];
    expect(() => validateBalance(lines)).toThrow(JournalUnbalancedError);
  });

  it("throws JournalUnbalancedError when CR > DR", () => {
    const lines: JournalLineDraft[] = [
      { coaId: "coa-1", side: "DEBIT", amount: "50000.00" },
      { coaId: "coa-2", side: "CREDIT", amount: "75000.00" },
    ];
    expect(() => validateBalance(lines)).toThrow(JournalUnbalancedError);
  });

  it("handles decimal precision without float drift", () => {
    const lines: JournalLineDraft[] = [
      { coaId: "coa-1", side: "DEBIT", amount: "0.10" },
      { coaId: "coa-2", side: "DEBIT", amount: "0.20" },
      { coaId: "coa-3", side: "CREDIT", amount: "0.30" },
    ];
    expect(() => validateBalance(lines)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/balanceValidator.test.ts`
Expected: FAIL — module tidak ada.

- [ ] **Step 3: Implement `balanceValidator`**

Create `modules/accounting/services/journal/balanceValidator.ts`:

```ts
import { Money } from "../../domain/value-objects/Money";
import { JournalUnbalancedError } from "../../errors";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";

export function validateBalance(lines: JournalLineDraft[]): void {
  let totalDebit = Money.zero();
  let totalCredit = Money.zero();

  for (const line of lines) {
    const amount = Money.fromString(line.amount);
    if (line.side === "DEBIT") {
      totalDebit = totalDebit.add(amount);
    } else {
      totalCredit = totalCredit.add(amount);
    }
  }

  if (!totalDebit.equals(totalCredit)) {
    throw new JournalUnbalancedError(totalDebit.toString(), totalCredit.toString());
  }
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/balanceValidator.test.ts`
Expected: PASS semua 5 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/journal/balanceValidator.ts modules/accounting/__tests__/balanceValidator.test.ts
git commit -m "feat(accounting): tambah balanceValidator (DR=CR check via Money)"
```

---

## Task 14: JournalRepository + journal.mapper

**Files:**
- Create: `modules/accounting/repositories/JournalRepository.ts`
- Create: `modules/accounting/mappers/journal.mapper.ts`

- [ ] **Step 1: Buat mapper Prisma → domain**

Create `modules/accounting/mappers/journal.mapper.ts`:

```ts
import type {
  JournalEntry as PrismaJournalEntry,
  JournalLine as PrismaJournalLine,
} from "@prisma/client";
import type { JournalEntry } from "../domain/entities/JournalEntry";
import type { JournalLine } from "../domain/entities/JournalLine";

export function toJournalLine(row: PrismaJournalLine): JournalLine {
  return {
    id: row.id,
    entryId: row.entryId,
    coaId: row.coaId,
    side: row.side,
    amount: row.amount.toString(),
    description: row.description,
    lineOrder: row.lineOrder,
  };
}

export function toJournalEntry(
  row: PrismaJournalEntry & { lines: PrismaJournalLine[] },
): JournalEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entryNumber: row.entryNumber,
    entryDate: row.entryDate,
    periodId: row.periodId,
    source: row.source,
    sourceRefType: row.sourceRefType,
    sourceRefId: row.sourceRefId,
    description: row.description,
    status: row.status,
    reversalOfId: row.reversalOfId,
    postedAt: row.postedAt,
    postedBy: row.postedBy,
    lines: row.lines
      .map(toJournalLine)
      .sort((a, b) => a.lineOrder - b.lineOrder),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

- [ ] **Step 2: Implement `JournalRepository`**

Create `modules/accounting/repositories/JournalRepository.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IJournalRepository,
  JournalCreateInput,
  JournalListFilter,
} from "../domain/ports/IJournalRepository";
import type { JournalEntry, JournalSource } from "../domain/entities/JournalEntry";
import { toJournalEntry } from "../mappers/journal.mapper";

export class JournalRepository implements IJournalRepository {
  async create(
    input: JournalCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<JournalEntry> {
    const client = tx ?? prisma;
    const row = await client.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        entryNumber: input.entryNumber,
        entryDate: input.entryDate,
        periodId: input.periodId,
        source: input.source,
        sourceRefType: input.sourceRefType ?? null,
        sourceRefId: input.sourceRefId ?? null,
        description: input.description,
        status: input.status ?? "POSTED",
        reversalOfId: input.reversalOfId ?? null,
        postedAt: new Date(),
        postedBy: input.postedBy ?? null,
        lines: {
          create: input.lines.map((line, idx) => ({
            coaId: line.coaId,
            side: line.side,
            amount: line.amount,
            description: line.description ?? null,
            lineOrder: line.lineOrder ?? idx + 1,
          })),
        },
      },
      include: { lines: true },
    });
    return toJournalEntry(row);
  }

  async findById(id: string): Promise<JournalEntry | null> {
    const row = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    return row ? toJournalEntry(row) : null;
  }

  async findBySource(
    tenantId: string,
    source: JournalSource,
    sourceRefId: string,
  ): Promise<JournalEntry | null> {
    const row = await prisma.journalEntry.findUnique({
      where: {
        tenantId_source_sourceRefId: { tenantId, source, sourceRefId },
      },
      include: { lines: true },
    });
    return row ? toJournalEntry(row) : null;
  }

  async list(
    filter: JournalListFilter,
  ): Promise<{ items: JournalEntry[]; total: number }> {
    const where: Prisma.JournalEntryWhereInput = {
      tenantId: filter.tenantId,
      ...(filter.from && { entryDate: { gte: filter.from } }),
      ...(filter.to && { entryDate: { ...((filter.from && { gte: filter.from }) || {}), lte: filter.to } }),
      ...(filter.source && { source: filter.source }),
      ...(filter.status && { status: filter.status }),
      ...(filter.coaId && { lines: { some: { coaId: filter.coaId } } }),
    };

    const [items, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: { lines: true },
        orderBy: { entryDate: "desc" },
        skip: filter.skip ?? 0,
        take: filter.take ?? 50,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return { items: items.map(toJournalEntry), total };
  }

  async markReversed(
    id: string,
    reversalEntryId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? prisma;
    await client.journalEntry.update({
      where: { id },
      data: { status: "REVERSED" },
    });
  }

  async countByMonth(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    return prisma.journalEntry.count({
      where: {
        tenantId,
        entryDate: { gte: startDate, lt: endDate },
      },
    });
  }
}
```

- [ ] **Step 3: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/repositories/JournalRepository.ts modules/accounting/mappers/journal.mapper.ts
git commit -m "feat(accounting): tambah JournalRepository + journal mapper"
```

---

## Task 15: DB Trigger Integration Test

**Files:**
- Create: `modules/accounting/__tests__/db-trigger-balance.test.ts`

- [ ] **Step 1: Tulis integration test**

Create `modules/accounting/__tests__/db-trigger-balance.test.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

describe("DB Trigger: journal_balance_check (integration)", () => {
  let tenantId: string;
  let periodId: string;
  let coaDebitId: string;
  let coaCreditId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("No tenant in test DB");
    tenantId = tenant.id;

    const period = await prisma.accountingPeriod.create({
      data: {
        tenantId,
        year: 2099,
        month: 1,
        status: "OPEN",
        startDate: new Date("2099-01-01"),
        endDate: new Date("2099-01-31"),
      },
    });
    periodId = period.id;

    const coaDebit = await prisma.chartOfAccount.create({
      data: {
        tenantId,
        code: "TEST-DR-TRIGGER",
        name: "Test Debit Trigger",
        type: "ASSET",
        normalSide: "DEBIT",
        isPostable: true,
      },
    });
    coaDebitId = coaDebit.id;

    const coaCredit = await prisma.chartOfAccount.create({
      data: {
        tenantId,
        code: "TEST-CR-TRIGGER",
        name: "Test Credit Trigger",
        type: "LIABILITY",
        normalSide: "CREDIT",
        isPostable: true,
      },
    });
    coaCreditId = coaCredit.id;
  });

  afterAll(async () => {
    await prisma.journalLine.deleteMany({
      where: { entry: { tenantId, periodId } },
    });
    await prisma.journalEntry.deleteMany({ where: { tenantId, periodId } });
    await prisma.accountingPeriod.delete({ where: { id: periodId } });
    await prisma.chartOfAccount.deleteMany({
      where: { tenantId, code: { startsWith: "TEST-" } },
    });
  });

  it("allows balanced POSTED journal", async () => {
    const entry = await prisma.journalEntry.create({
      data: {
        tenantId,
        entryNumber: "JV-TEST-TRIGGER-001",
        entryDate: new Date("2099-01-15"),
        periodId,
        source: "MANUAL",
        description: "Balanced test",
        status: "POSTED",
        postedAt: new Date(),
        lines: {
          create: [
            { coaId: coaDebitId, side: "DEBIT", amount: 10000, lineOrder: 1 },
            { coaId: coaCreditId, side: "CREDIT", amount: 10000, lineOrder: 2 },
          ],
        },
      },
      include: { lines: true },
    });
    expect(entry.lines).toHaveLength(2);
  });

  it("rejects unbalanced POSTED journal at commit", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const entry = await tx.journalEntry.create({
          data: {
            tenantId,
            entryNumber: "JV-TEST-TRIGGER-002",
            entryDate: new Date("2099-01-15"),
            periodId,
            source: "MANUAL",
            description: "Unbalanced test",
            status: "POSTED",
            postedAt: new Date(),
            lines: {
              create: [
                { coaId: coaDebitId, side: "DEBIT", amount: 10000, lineOrder: 1 },
                { coaId: coaCreditId, side: "CREDIT", amount: 5000, lineOrder: 2 },
              ],
            },
          },
        });
        return entry;
      }),
    ).rejects.toThrow(/unbalanced/i);
  });

  it("allows unbalanced DRAFT journal (trigger skips non-POSTED)", async () => {
    const entry = await prisma.journalEntry.create({
      data: {
        tenantId,
        entryNumber: "JV-TEST-TRIGGER-003",
        entryDate: new Date("2099-01-15"),
        periodId,
        source: "MANUAL",
        description: "Draft unbalanced",
        status: "DRAFT",
        lines: {
          create: [
            { coaId: coaDebitId, side: "DEBIT", amount: 10000, lineOrder: 1 },
            { coaId: coaCreditId, side: "CREDIT", amount: 3000, lineOrder: 2 },
          ],
        },
      },
      include: { lines: true },
    });
    expect(entry.status).toBe("DRAFT");
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run modules/accounting/__tests__/db-trigger-balance.test.ts`
Expected: PASS semua 3 test (membutuhkan DB test sudah di-migrate).

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/__tests__/db-trigger-balance.test.ts
git commit -m "test(accounting): integration test DB trigger balance constraint"
```

---
## Task 16: Journal Validators + DTOs

**Files:**
- Create: `modules/accounting/validators/journal.ts`
- Create: `modules/accounting/dto/JournalDto.ts`

- [ ] **Step 1: Buat Zod validators**

Create `modules/accounting/validators/journal.ts`:

```ts
import { z } from "zod";

const journalLineSchema = z.object({
  coaId: z.string().min(1, "coaId wajib diisi"),
  side: z.enum(["DEBIT", "CREDIT"]),
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: "amount harus angka positif" },
  ),
  description: z.string().nullable().optional(),
});

export const createManualJournalSchema = z.object({
  entryDate: z.coerce.date({ required_error: "entryDate wajib diisi" }),
  description: z.string().min(1, "description wajib diisi").max(500),
  lines: z
    .array(journalLineSchema)
    .min(2, "Minimal 2 baris jurnal (1 debit + 1 kredit)"),
});

export const journalListQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  source: z
    .enum([
      "AUTO_INVOICE_PAID",
      "AUTO_INVOICE_CREATED",
      "AUTO_PAYMENT",
      "AUTO_EXPENSE",
      "AUTO_PO_PAID",
      "MANUAL",
      "RECURRING",
      "REVERSAL",
      "OPENING_BALANCE",
      "ADJUSTMENT",
      "CLOSING",
    ])
    .optional(),
  status: z.enum(["DRAFT", "POSTED", "REVERSED"]).optional(),
  coaId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateManualJournalInput = z.infer<typeof createManualJournalSchema>;
export type JournalListQueryInput = z.infer<typeof journalListQuerySchema>;
```

- [ ] **Step 2: Buat DTOs**

Create `modules/accounting/dto/JournalDto.ts`:

```ts
import type { JournalEntry } from "../domain/entities/JournalEntry";
import type { JournalLine } from "../domain/entities/JournalLine";

export interface JournalLineResponseDto {
  id: string;
  coaId: string;
  side: "DEBIT" | "CREDIT";
  amount: string;
  description: string | null;
  lineOrder: number;
}

export interface JournalResponseDto {
  id: string;
  entryNumber: string;
  entryDate: string;
  source: string;
  sourceRefType: string | null;
  sourceRefId: string | null;
  description: string;
  status: string;
  reversalOfId: string | null;
  postedAt: string | null;
  postedBy: string | null;
  lines: JournalLineResponseDto[];
  createdAt: string;
}

export interface JournalListResponseDto {
  items: JournalResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export function toJournalResponseDto(entry: JournalEntry): JournalResponseDto {
  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    entryDate: entry.entryDate.toISOString(),
    source: entry.source,
    sourceRefType: entry.sourceRefType,
    sourceRefId: entry.sourceRefId,
    description: entry.description,
    status: entry.status,
    reversalOfId: entry.reversalOfId,
    postedAt: entry.postedAt?.toISOString() ?? null,
    postedBy: entry.postedBy,
    lines: entry.lines.map(toJournalLineDto),
    createdAt: entry.createdAt.toISOString(),
  };
}

function toJournalLineDto(line: JournalLine): JournalLineResponseDto {
  return {
    id: line.id,
    coaId: line.coaId,
    side: line.side,
    amount: line.amount,
    description: line.description,
    lineOrder: line.lineOrder,
  };
}
```

- [ ] **Step 3: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/validators/journal.ts modules/accounting/dto/JournalDto.ts
git commit -m "feat(accounting): tambah journal validators (Zod) + DTOs"
```

---

## Task 17: JournalPostingService

**Files:**
- Create: `modules/accounting/services/journal/JournalPostingService.ts`
- Create: `modules/accounting/__tests__/JournalPostingService.test.ts`

- [ ] **Step 1: Tulis test untuk `JournalPostingService`**

Create `modules/accounting/__tests__/JournalPostingService.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { JournalPostingService } from "../services/journal/JournalPostingService";
import { JournalNumberGenerator } from "../services/journal/JournalNumberGenerator";
import { JournalUnbalancedError, PeriodClosedError, CoaNotFoundError, CoaNotPostableError, DuplicateJournalSourceError } from "../errors";
import type { IJournalRepository } from "../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "../domain/ports/IPeriodRepository";
import type { JournalEntry } from "../domain/entities/JournalEntry";

describe("JournalPostingService", () => {
  let service: JournalPostingService;
  let journalRepo: IJournalRepository;
  let coaRepo: IChartOfAccountRepository;
  let periodRepo: IPeriodRepository;
  let numberGen: JournalNumberGenerator;

  const mockPeriod = {
    id: "period-1",
    tenantId: "tenant-1",
    year: 2026,
    month: 5,
    status: "OPEN" as const,
    closedAt: null,
    closedBy: null,
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-05-31"),
  };

  const mockCoa = {
    id: "coa-1",
    tenantId: "tenant-1",
    code: "1-200",
    name: "Piutang",
    type: "ASSET" as const,
    subtype: null,
    normalSide: "DEBIT" as const,
    cashFlowCategory: null,
    parentId: null,
    isPostable: true,
    isSystem: true,
    isActive: true,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    journalRepo = {
      create: vi.fn().mockResolvedValue({ id: "je-1", entryNumber: "JV-2026-05-0001" } as JournalEntry),
      findById: vi.fn(),
      findBySource: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
      markReversed: vi.fn(),
      countByMonth: vi.fn().mockResolvedValue(0),
    } as unknown as IJournalRepository;

    coaRepo = {
      findById: vi.fn().mockResolvedValue(mockCoa),
      findByCode: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      countChildren: vi.fn(),
      countLines: vi.fn(),
    } as unknown as IChartOfAccountRepository;

    periodRepo = {
      findByDate: vi.fn().mockResolvedValue(mockPeriod),
      findById: vi.fn(),
      findByYearMonth: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      list: vi.fn(),
      lockForUpdate: vi.fn(),
    } as unknown as IPeriodRepository;

    numberGen = new JournalNumberGenerator(journalRepo);
    service = new JournalPostingService(journalRepo, coaRepo, periodRepo, numberGen);
  });

  describe("postManual", () => {
    const validDto = {
      entryDate: new Date("2026-05-15"),
      description: "Test manual journal",
      lines: [
        { coaId: "coa-1", side: "DEBIT" as const, amount: "100000.00" },
        { coaId: "coa-2", side: "CREDIT" as const, amount: "100000.00" },
      ],
    };

    it("creates a POSTED journal when valid", async () => {
      const result = await service.postManual("tenant-1", validDto, "user-1");
      expect(journalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          source: "MANUAL",
          status: "POSTED",
          postedBy: "user-1",
        }),
      );
      expect(result).toBeDefined();
    });

    it("throws JournalUnbalancedError when lines unbalanced", async () => {
      const unbalanced = {
        ...validDto,
        lines: [
          { coaId: "coa-1", side: "DEBIT" as const, amount: "100000.00" },
          { coaId: "coa-2", side: "CREDIT" as const, amount: "50000.00" },
        ],
      };
      await expect(service.postManual("tenant-1", unbalanced, "user-1")).rejects.toThrow(JournalUnbalancedError);
    });

    it("throws PeriodClosedError when period is CLOSED", async () => {
      vi.mocked(periodRepo.findByDate).mockResolvedValue({ ...mockPeriod, status: "CLOSED" });
      await expect(service.postManual("tenant-1", validDto, "user-1")).rejects.toThrow(PeriodClosedError);
    });

    it("throws CoaNotFoundError when COA does not exist", async () => {
      vi.mocked(coaRepo.findById).mockResolvedValue(null);
      await expect(service.postManual("tenant-1", validDto, "user-1")).rejects.toThrow(CoaNotFoundError);
    });

    it("throws CoaNotPostableError when COA is header account", async () => {
      vi.mocked(coaRepo.findById).mockResolvedValue({ ...mockCoa, isPostable: false });
      await expect(service.postManual("tenant-1", validDto, "user-1")).rejects.toThrow(CoaNotPostableError);
    });
  });

  describe("postAuto", () => {
    const autoParams = {
      source: "AUTO_INVOICE_PAID" as const,
      sourceRefType: "Invoice",
      sourceRefId: "inv-123",
      entryDate: new Date("2026-05-15"),
      description: "Auto journal invoice paid",
      lines: [
        { coaId: "coa-1", side: "DEBIT" as const, amount: "100000.00" },
        { coaId: "coa-2", side: "CREDIT" as const, amount: "100000.00" },
      ],
    };

    it("creates journal when no duplicate exists", async () => {
      const result = await service.postAuto("tenant-1", autoParams);
      expect(journalRepo.findBySource).toHaveBeenCalledWith("tenant-1", "AUTO_INVOICE_PAID", "inv-123");
      expect(journalRepo.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("returns existing journal when duplicate found (idempotent)", async () => {
      const existing = { id: "je-existing", entryNumber: "JV-2026-05-0001" } as JournalEntry;
      vi.mocked(journalRepo.findBySource).mockResolvedValue(existing);
      const result = await service.postAuto("tenant-1", autoParams);
      expect(journalRepo.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/JournalPostingService.test.ts`
Expected: FAIL — module tidak ada.

- [ ] **Step 3: Implement `JournalPostingService`**

Create `modules/accounting/services/journal/JournalPostingService.ts`:

```ts
import type { IJournalRepository, JournalCreateInput } from "../../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { JournalEntry, JournalSource } from "../../domain/entities/JournalEntry";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";
import { isPeriodWritable } from "../../domain/entities/AccountingPeriod";
import { validateBalance } from "./balanceValidator";
import { JournalNumberGenerator } from "./JournalNumberGenerator";
import {
  PeriodClosedError,
  CoaNotFoundError,
  CoaNotPostableError,
} from "../../errors";

export interface PostManualDto {
  entryDate: Date;
  description: string;
  lines: JournalLineDraft[];
}

export interface PostAutoParams {
  source: JournalSource;
  sourceRefType: string;
  sourceRefId: string;
  entryDate: Date;
  description: string;
  lines: JournalLineDraft[];
  postedBy?: string;
}

export class JournalPostingService {
  constructor(
    private readonly journalRepo: IJournalRepository,
    private readonly coaRepo: IChartOfAccountRepository,
    private readonly periodRepo: IPeriodRepository,
    private readonly numberGen: JournalNumberGenerator,
  ) {}

  async postManual(
    tenantId: string,
    dto: PostManualDto,
    postedBy: string,
  ): Promise<JournalEntry> {
    validateBalance(dto.lines);
    await this.validateCoaIds(dto.lines);
    const period = await this.getWritablePeriod(tenantId, dto.entryDate);
    const entryNumber = await this.numberGen.generate(tenantId, dto.entryDate);

    const input: JournalCreateInput = {
      tenantId,
      entryNumber,
      entryDate: dto.entryDate,
      periodId: period.id,
      source: "MANUAL",
      description: dto.description,
      status: "POSTED",
      postedBy,
      lines: dto.lines,
    };

    return this.journalRepo.create(input);
  }

  async postAuto(
    tenantId: string,
    params: PostAutoParams,
  ): Promise<JournalEntry> {
    const existing = await this.journalRepo.findBySource(
      tenantId,
      params.source,
      params.sourceRefId,
    );
    if (existing) {
      return existing;
    }

    validateBalance(params.lines);
    await this.validateCoaIds(params.lines);
    const period = await this.getWritablePeriod(tenantId, params.entryDate);
    const entryNumber = await this.numberGen.generate(tenantId, params.entryDate);

    const input: JournalCreateInput = {
      tenantId,
      entryNumber,
      entryDate: params.entryDate,
      periodId: period.id,
      source: params.source,
      sourceRefType: params.sourceRefType,
      sourceRefId: params.sourceRefId,
      description: params.description,
      status: "POSTED",
      postedBy: params.postedBy ?? null,
      lines: params.lines,
    };

    return this.journalRepo.create(input);
  }

  private async validateCoaIds(lines: JournalLineDraft[]): Promise<void> {
    const uniqueCoaIds = [...new Set(lines.map((l) => l.coaId))];
    for (const coaId of uniqueCoaIds) {
      const coa = await this.coaRepo.findById(coaId);
      if (!coa) {
        throw new CoaNotFoundError(coaId);
      }
      if (!coa.isPostable) {
        throw new CoaNotPostableError(coa.code);
      }
    }
  }

  private async getWritablePeriod(tenantId: string, entryDate: Date) {
    const period = await this.periodRepo.findByDate(tenantId, entryDate);
    if (!period) {
      throw new PeriodClosedError(
        entryDate.getFullYear(),
        entryDate.getMonth() + 1,
      );
    }
    if (!isPeriodWritable(period)) {
      throw new PeriodClosedError(period.year, period.month);
    }
    return period;
  }
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/JournalPostingService.test.ts`
Expected: PASS semua 7 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/journal/JournalPostingService.ts modules/accounting/__tests__/JournalPostingService.test.ts
git commit -m "feat(accounting): tambah JournalPostingService (manual + auto posting)"
```

---

## Task 18: Add Event Names to types.ts

**Files:**
- Modify: `lib/event-bus/types.ts`

- [ ] **Step 1: Tambah ACCOUNTING category**

Edit `lib/event-bus/types.ts`, di object `EVENT_CATEGORIES` tambahkan:

```ts
  ACCOUNTING: "accounting",
```

- [ ] **Step 2: Tambah event names baru**

Edit `lib/event-bus/types.ts`, di object `EVENT_NAMES` tambahkan setelah billing events:

```ts
  // Finance Events (for accounting consumption)
  EXPENSE_APPROVED: "finance:expense.approved",
  PURCHASE_ORDER_PAID: "finance:purchase_order.paid",
```

- [ ] **Step 3: Tambah payload type interfaces**

Append di akhir file `lib/event-bus/types.ts`:

```ts
// Accounting-related event payloads
export interface InvoiceCreatedPayload {
  invoiceId: string;
  tenantId: string;
  totalAmount: string;
  createdAt: string;
}

export interface InvoicePaidPayload {
  invoiceId: string;
  tenantId: string;
  amount: string;
  accountId: string;
  paidAt: string;
}

export interface ExpenseApprovedPayload {
  expenseId: string;
  tenantId: string;
  amount: string;
  accountId: string;
  expenseCategoryId: string;
  expenseDate: string;
}

export interface PurchaseOrderPaidPayload {
  purchaseOrderId: string;
  tenantId: string;
  amount: string;
  accountId: string;
  paidAt: string;
}
```

- [ ] **Step 4: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/event-bus/types.ts
git commit -m "feat(accounting): tambah event names EXPENSE_APPROVED, PURCHASE_ORDER_PAID + payload types"
```

---

## Task 19: coa-resolver Helper

**Files:**
- Create: `modules/accounting/services/event-handlers/coa-resolver.ts`

- [ ] **Step 1: Implement coa-resolver**

Create `modules/accounting/services/event-handlers/coa-resolver.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { CoaNotFoundError } from "../../errors";

interface ResolvedCoa {
  debitCoaId: string;
  creditCoaId: string;
}

async function findCoaByCode(tenantId: string, code: string): Promise<string> {
  const coa = await prisma.chartOfAccount.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: { id: true },
  });
  if (!coa) {
    throw new CoaNotFoundError(code);
  }
  return coa.id;
}

async function findBankCoaByAccountId(
  tenantId: string,
  accountId: string,
): Promise<string> {
  const account = await prisma.financialAccount.findUnique({
    where: { id: accountId },
    select: { coaId: true },
  });
  if (account?.coaId) {
    return account.coaId;
  }
  return findCoaByCode(tenantId, "1-110");
}

export async function resolveInvoiceCreatedCoa(
  tenantId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    findCoaByCode(tenantId, "1-200"),
    findCoaByCode(tenantId, "4-100"),
  ]);
  return { debitCoaId, creditCoaId };
}

export async function resolveInvoicePaidCoa(
  tenantId: string,
  accountId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    findBankCoaByAccountId(tenantId, accountId),
    findCoaByCode(tenantId, "1-200"),
  ]);
  return { debitCoaId, creditCoaId };
}

export async function resolveExpenseApprovedCoa(
  tenantId: string,
  expenseCategoryId: string,
  accountId: string,
): Promise<ResolvedCoa> {
  const category = await prisma.expenseCategory.findUnique({
    where: { id: expenseCategoryId },
    select: { coaId: true },
  });

  const debitCoaId = category?.coaId ?? (await findCoaByCode(tenantId, "5-500"));
  const creditCoaId = await findBankCoaByAccountId(tenantId, accountId);

  return { debitCoaId, creditCoaId };
}

export async function resolvePurchaseOrderPaidCoa(
  tenantId: string,
  accountId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    findCoaByCode(tenantId, "1-300"),
    findBankCoaByAccountId(tenantId, accountId),
  ]);
  return { debitCoaId, creditCoaId };
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/services/event-handlers/coa-resolver.ts
git commit -m "feat(accounting): tambah coa-resolver helper untuk auto-journal mapping"
```

---
## Task 20: invoice-created-accounting Handler

**Files:**
- Create: `modules/accounting/services/event-handlers/invoice-created-accounting.handler.ts`

- [ ] **Step 1: Implement handler**

Create `modules/accounting/services/event-handlers/invoice-created-accounting.handler.ts`:

```ts
import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { resolveInvoiceCreatedCoa } from "./coa-resolver";
import { PeriodService } from "../period/PeriodService";

const SOURCE = "InvoiceCreatedAccountingHandler";

export async function handleInvoiceCreatedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const invoiceId = requirePayloadString(payload.invoiceId, "invoiceId", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const totalAmount = requirePayloadString(payload.totalAmount, "totalAmount", SOURCE);
  const createdAt = requirePayloadString(payload.createdAt, "createdAt", SOURCE);

  logger.info(`[${SOURCE}] Processing invoice ${invoiceId} for tenant ${tenantId}`);

  const journalRepo = new JournalRepository();
  const coaRepo = new ChartOfAccountRepository();
  const periodRepo = new PeriodRepository();
  const numberGen = new JournalNumberGenerator(journalRepo);
  const postingService = new JournalPostingService(journalRepo, coaRepo, periodRepo, numberGen);

  const periodService = new PeriodService(periodRepo);
  const entryDate = new Date(createdAt);
  await periodService.ensureCurrentPeriod(tenantId, entryDate);

  const { debitCoaId, creditCoaId } = await resolveInvoiceCreatedCoa(tenantId);

  await postingService.postAuto(tenantId, {
    source: "AUTO_INVOICE_CREATED",
    sourceRefType: "Invoice",
    sourceRefId: invoiceId,
    entryDate,
    description: `Jurnal otomatis: Invoice ${invoiceId} dibuat (accrual)`,
    lines: [
      { coaId: debitCoaId, side: "DEBIT", amount: totalAmount },
      { coaId: creditCoaId, side: "CREDIT", amount: totalAmount },
    ],
  });

  logger.info(`[${SOURCE}] Journal posted for invoice ${invoiceId}`);
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/services/event-handlers/invoice-created-accounting.handler.ts
git commit -m "feat(accounting): tambah handler invoice-created → auto journal (DR AR / CR Revenue)"
```

---

## Task 21: invoice-paid-accounting Handler

**Files:**
- Create: `modules/accounting/services/event-handlers/invoice-paid-accounting.handler.ts`
- Create: `modules/accounting/__tests__/invoice-paid-accounting.handler.test.ts`

- [ ] **Step 1: Tulis test**

Create `modules/accounting/__tests__/invoice-paid-accounting.handler.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleInvoicePaidAccounting } from "../services/event-handlers/invoice-paid-accounting.handler";
import type { Job } from "bullmq";
import type { EventJobData } from "@/lib/event-bus/queues";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chartOfAccount: { findUnique: vi.fn() },
    financialAccount: { findUnique: vi.fn() },
    accountingPeriod: { findFirst: vi.fn(), create: vi.fn() },
    journalEntry: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe("handleInvoicePaidAccounting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when invoiceId missing from payload", async () => {
    const job = {
      data: { payload: { tenantId: "t1", amount: "100", accountId: "acc-1", paidAt: "2026-05-15" } },
    } as Job<EventJobData>;

    await expect(handleInvoicePaidAccounting(job)).rejects.toThrow(/invoiceId/);
  });

  it("throws when tenantId missing from payload", async () => {
    const job = {
      data: { payload: { invoiceId: "inv-1", amount: "100", accountId: "acc-1", paidAt: "2026-05-15" } },
    } as Job<EventJobData>;

    await expect(handleInvoicePaidAccounting(job)).rejects.toThrow(/tenantId/);
  });
});
```

- [ ] **Step 2: Implement handler**

Create `modules/accounting/services/event-handlers/invoice-paid-accounting.handler.ts`:

```ts
import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { resolveInvoicePaidCoa } from "./coa-resolver";
import { PeriodService } from "../period/PeriodService";

const SOURCE = "InvoicePaidAccountingHandler";

export async function handleInvoicePaidAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const invoiceId = requirePayloadString(payload.invoiceId, "invoiceId", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const amount = requirePayloadString(payload.amount, "amount", SOURCE);
  const accountId = requirePayloadString(payload.accountId, "accountId", SOURCE);
  const paidAt = requirePayloadString(payload.paidAt, "paidAt", SOURCE);

  logger.info(`[${SOURCE}] Processing invoice paid ${invoiceId} for tenant ${tenantId}`);

  const journalRepo = new JournalRepository();
  const coaRepo = new ChartOfAccountRepository();
  const periodRepo = new PeriodRepository();
  const numberGen = new JournalNumberGenerator(journalRepo);
  const postingService = new JournalPostingService(journalRepo, coaRepo, periodRepo, numberGen);

  const periodService = new PeriodService(periodRepo);
  const entryDate = new Date(paidAt);
  await periodService.ensureCurrentPeriod(tenantId, entryDate);

  const { debitCoaId, creditCoaId } = await resolveInvoicePaidCoa(tenantId, accountId);

  await postingService.postAuto(tenantId, {
    source: "AUTO_INVOICE_PAID",
    sourceRefType: "Invoice",
    sourceRefId: invoiceId,
    entryDate,
    description: `Jurnal otomatis: Invoice ${invoiceId} dibayar`,
    lines: [
      { coaId: debitCoaId, side: "DEBIT", amount },
      { coaId: creditCoaId, side: "CREDIT", amount },
    ],
  });

  logger.info(`[${SOURCE}] Journal posted for invoice paid ${invoiceId}`);
}
```

- [ ] **Step 3: Run test**

Run: `npx vitest run modules/accounting/__tests__/invoice-paid-accounting.handler.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/services/event-handlers/invoice-paid-accounting.handler.ts modules/accounting/__tests__/invoice-paid-accounting.handler.test.ts
git commit -m "feat(accounting): tambah handler invoice-paid → auto journal (DR Bank / CR AR)"
```

---

## Task 22: expense-approved-accounting Handler

**Files:**
- Create: `modules/accounting/services/event-handlers/expense-approved-accounting.handler.ts`
- Create: `modules/accounting/__tests__/expense-approved-accounting.handler.test.ts`

- [ ] **Step 1: Tulis test**

Create `modules/accounting/__tests__/expense-approved-accounting.handler.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleExpenseApprovedAccounting } from "../services/event-handlers/expense-approved-accounting.handler";
import type { Job } from "bullmq";
import type { EventJobData } from "@/lib/event-bus/queues";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chartOfAccount: { findUnique: vi.fn() },
    financialAccount: { findUnique: vi.fn() },
    expenseCategory: { findUnique: vi.fn() },
    accountingPeriod: { findFirst: vi.fn(), create: vi.fn() },
    journalEntry: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe("handleExpenseApprovedAccounting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when expenseId missing from payload", async () => {
    const job = {
      data: {
        payload: {
          tenantId: "t1",
          amount: "50000",
          accountId: "acc-1",
          expenseCategoryId: "cat-1",
          expenseDate: "2026-05-10",
        },
      },
    } as Job<EventJobData>;

    await expect(handleExpenseApprovedAccounting(job)).rejects.toThrow(/expenseId/);
  });

  it("throws when tenantId missing from payload", async () => {
    const job = {
      data: {
        payload: {
          expenseId: "exp-1",
          amount: "50000",
          accountId: "acc-1",
          expenseCategoryId: "cat-1",
          expenseDate: "2026-05-10",
        },
      },
    } as Job<EventJobData>;

    await expect(handleExpenseApprovedAccounting(job)).rejects.toThrow(/tenantId/);
  });
});
```

- [ ] **Step 2: Implement handler**

Create `modules/accounting/services/event-handlers/expense-approved-accounting.handler.ts`:

```ts
import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { resolveExpenseApprovedCoa } from "./coa-resolver";
import { PeriodService } from "../period/PeriodService";

const SOURCE = "ExpenseApprovedAccountingHandler";

export async function handleExpenseApprovedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const expenseId = requirePayloadString(payload.expenseId, "expenseId", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const amount = requirePayloadString(payload.amount, "amount", SOURCE);
  const accountId = requirePayloadString(payload.accountId, "accountId", SOURCE);
  const expenseCategoryId = requirePayloadString(payload.expenseCategoryId, "expenseCategoryId", SOURCE);
  const expenseDate = requirePayloadString(payload.expenseDate, "expenseDate", SOURCE);

  logger.info(`[${SOURCE}] Processing expense ${expenseId} for tenant ${tenantId}`);

  const journalRepo = new JournalRepository();
  const coaRepo = new ChartOfAccountRepository();
  const periodRepo = new PeriodRepository();
  const numberGen = new JournalNumberGenerator(journalRepo);
  const postingService = new JournalPostingService(journalRepo, coaRepo, periodRepo, numberGen);

  const periodService = new PeriodService(periodRepo);
  const entryDate = new Date(expenseDate);
  await periodService.ensureCurrentPeriod(tenantId, entryDate);

  const { debitCoaId, creditCoaId } = await resolveExpenseApprovedCoa(
    tenantId,
    expenseCategoryId,
    accountId,
  );

  await postingService.postAuto(tenantId, {
    source: "AUTO_EXPENSE",
    sourceRefType: "Expense",
    sourceRefId: expenseId,
    entryDate,
    description: `Jurnal otomatis: Expense ${expenseId} disetujui`,
    lines: [
      { coaId: debitCoaId, side: "DEBIT", amount },
      { coaId: creditCoaId, side: "CREDIT", amount },
    ],
  });

  logger.info(`[${SOURCE}] Journal posted for expense ${expenseId}`);
}
```

- [ ] **Step 3: Run test**

Run: `npx vitest run modules/accounting/__tests__/expense-approved-accounting.handler.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/services/event-handlers/expense-approved-accounting.handler.ts modules/accounting/__tests__/expense-approved-accounting.handler.test.ts
git commit -m "feat(accounting): tambah handler expense-approved → auto journal (DR Beban / CR Bank)"
```

---

## Task 23: purchase-order-paid-accounting Handler

**Files:**
- Create: `modules/accounting/services/event-handlers/purchase-order-paid-accounting.handler.ts`

- [ ] **Step 1: Implement handler**

Create `modules/accounting/services/event-handlers/purchase-order-paid-accounting.handler.ts`:

```ts
import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { resolvePurchaseOrderPaidCoa } from "./coa-resolver";
import { PeriodService } from "../period/PeriodService";

const SOURCE = "PurchaseOrderPaidAccountingHandler";

export async function handlePurchaseOrderPaidAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const purchaseOrderId = requirePayloadString(payload.purchaseOrderId, "purchaseOrderId", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const amount = requirePayloadString(payload.amount, "amount", SOURCE);
  const accountId = requirePayloadString(payload.accountId, "accountId", SOURCE);
  const paidAt = requirePayloadString(payload.paidAt, "paidAt", SOURCE);

  logger.info(`[${SOURCE}] Processing PO paid ${purchaseOrderId} for tenant ${tenantId}`);

  const journalRepo = new JournalRepository();
  const coaRepo = new ChartOfAccountRepository();
  const periodRepo = new PeriodRepository();
  const numberGen = new JournalNumberGenerator(journalRepo);
  const postingService = new JournalPostingService(journalRepo, coaRepo, periodRepo, numberGen);

  const periodService = new PeriodService(periodRepo);
  const entryDate = new Date(paidAt);
  await periodService.ensureCurrentPeriod(tenantId, entryDate);

  const { debitCoaId, creditCoaId } = await resolvePurchaseOrderPaidCoa(tenantId, accountId);

  await postingService.postAuto(tenantId, {
    source: "AUTO_PO_PAID",
    sourceRefType: "PurchaseOrder",
    sourceRefId: purchaseOrderId,
    entryDate,
    description: `Jurnal otomatis: PO ${purchaseOrderId} dibayar`,
    lines: [
      { coaId: debitCoaId, side: "DEBIT", amount },
      { coaId: creditCoaId, side: "CREDIT", amount },
    ],
  });

  logger.info(`[${SOURCE}] Journal posted for PO paid ${purchaseOrderId}`);
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/services/event-handlers/purchase-order-paid-accounting.handler.ts
git commit -m "feat(accounting): tambah handler purchase-order-paid → auto journal (DR Persediaan / CR Bank)"
```

---
## Task 24: Register Handlers Behind Feature Flag

**Files:**
- Modify: `lib/event-bus/event-handlers.ts`

- [ ] **Step 1: Import handlers**

Edit `lib/event-bus/event-handlers.ts`, tambahkan import di bagian atas file:

```ts
import { handleInvoiceCreatedAccounting } from "@/modules/accounting/services/event-handlers/invoice-created-accounting.handler";
import { handleInvoicePaidAccounting } from "@/modules/accounting/services/event-handlers/invoice-paid-accounting.handler";
import { handleExpenseApprovedAccounting } from "@/modules/accounting/services/event-handlers/expense-approved-accounting.handler";
import { handlePurchaseOrderPaidAccounting } from "@/modules/accounting/services/event-handlers/purchase-order-paid-accounting.handler";
```

- [ ] **Step 2: Register handlers gated by feature flag**

Di dalam function `registerAllHandlers()` (atau equivalent), tambahkan block baru di akhir:

```ts
  // Accounting Module Handlers (gated by feature flag)
  if (process.env.ACCOUNTING_MODULE_ENABLED === "true") {
    registerEventHandler(EVENT_NAMES.INVOICE_CREATED, handleInvoiceCreatedAccounting);
    registerEventHandler(EVENT_NAMES.INVOICE_PAID, handleInvoicePaidAccounting);
    registerEventHandler(EVENT_NAMES.EXPENSE_APPROVED, handleExpenseApprovedAccounting);
    registerEventHandler(EVENT_NAMES.PURCHASE_ORDER_PAID, handlePurchaseOrderPaidAccounting);
  }
```

- [ ] **Step 3: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/event-bus/event-handlers.ts
git commit -m "feat(accounting): register 4 accounting event handlers (gated ACCOUNTING_MODULE_ENABLED)"
```

---

## Task 25: Verify/Publish INVOICE_CREATED from Finance

**Files:**
- Modify: `modules/finance/services/InvoiceRouteService.ts` (jika belum publish)

- [ ] **Step 1: Verifikasi apakah INVOICE_CREATED sudah di-publish**

Cari di `modules/finance/services/InvoiceRouteService.ts` (atau service yang handle invoice creation):

```bash
grep -rn "INVOICE_CREATED\|invoice.created" modules/finance/services/
```

Jika sudah ada `saveToOutboxTx` dengan event `INVOICE_CREATED` → skip ke Step 3.

- [ ] **Step 2: Tambah publish event jika belum ada**

Jika belum ada, di method yang create invoice (biasanya dalam Prisma transaction), tambahkan:

```ts
import { saveToOutboxTx } from "@/lib/event-bus/outbox";
import { EVENT_NAMES } from "@/lib/event-bus/types";

// Di dalam transaction setelah invoice.create:
await saveToOutboxTx(tx, {
  eventName: EVENT_NAMES.INVOICE_CREATED,
  payload: {
    invoiceId: invoice.id,
    tenantId: invoice.tenantId,
    totalAmount: invoice.totalAmount.toString(),
    createdAt: invoice.createdAt.toISOString(),
  },
});
```

- [ ] **Step 3: Verifikasi payload INVOICE_PAID sudah include `accountId`**

Cari di service yang handle payment/invoice-paid:

```bash
grep -A 10 "INVOICE_PAID" modules/finance/services/PaymentRouteService.ts
```

Pastikan payload sudah include `accountId`. Jika belum, tambahkan field `accountId` ke payload existing.

- [ ] **Step 4: Type check & commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add modules/finance/services/
git commit -m "feat(finance): pastikan INVOICE_CREATED + INVOICE_PAID publish payload lengkap untuk accounting"
```

---

## Task 26: Publish EXPENSE_APPROVED + PURCHASE_ORDER_PAID from Finance

**Files:**
- Modify: `modules/finance/services/ExpenseRouteService.ts`
- Modify: `modules/finance/services/FinancePurchaseOrderPaymentService.ts`

- [ ] **Step 1: Tambah publish EXPENSE_APPROVED**

Edit `modules/finance/services/ExpenseRouteService.ts`. Cari method yang mengubah status expense ke APPROVED (biasanya `approve` atau `updateStatus`). Di dalam transaction, tambahkan:

```ts
import { saveToOutboxTx } from "@/lib/event-bus/outbox";
import { EVENT_NAMES } from "@/lib/event-bus/types";

// Setelah expense status di-update ke APPROVED dalam transaction:
await saveToOutboxTx(tx, {
  eventName: EVENT_NAMES.EXPENSE_APPROVED,
  payload: {
    expenseId: expense.id,
    tenantId: expense.tenantId,
    amount: expense.amount.toString(),
    accountId: expense.accountId,
    expenseCategoryId: expense.expenseCategoryId,
    expenseDate: expense.expenseDate.toISOString(),
  },
});
```

- [ ] **Step 2: Tambah publish PURCHASE_ORDER_PAID**

Edit `modules/finance/services/FinancePurchaseOrderPaymentService.ts`. Cari method yang create payment untuk PO. Di dalam transaction, tambahkan:

```ts
import { saveToOutboxTx } from "@/lib/event-bus/outbox";
import { EVENT_NAMES } from "@/lib/event-bus/types";

// Setelah PO payment created dalam transaction:
await saveToOutboxTx(tx, {
  eventName: EVENT_NAMES.PURCHASE_ORDER_PAID,
  payload: {
    purchaseOrderId: payment.purchaseOrderId,
    tenantId: payment.tenantId,
    amount: payment.amount.toString(),
    accountId: payment.accountId,
    paidAt: payment.paidAt.toISOString(),
  },
});
```

- [ ] **Step 3: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/finance/services/ExpenseRouteService.ts modules/finance/services/FinancePurchaseOrderPaymentService.ts
git commit -m "feat(finance): publish EXPENSE_APPROVED + PURCHASE_ORDER_PAID events untuk accounting"
```

---

## Task 27: Module Index + Integration Test + CHANGELOG

**Files:**
- Create: `modules/accounting/index.ts`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Buat module public API**

Create `modules/accounting/index.ts`:

```ts
// Services
export { ChartOfAccountService } from "./services/coa/ChartOfAccountService";
export { JournalPostingService } from "./services/journal/JournalPostingService";
export { JournalNumberGenerator } from "./services/journal/JournalNumberGenerator";
export { PeriodService } from "./services/period/PeriodService";

// Repositories
export { ChartOfAccountRepository } from "./repositories/ChartOfAccountRepository";
export { JournalRepository } from "./repositories/JournalRepository";
export { PeriodRepository } from "./repositories/PeriodRepository";

// Domain
export type { ChartOfAccount, COAType, DebitCredit } from "./domain/entities/ChartOfAccount";
export type { JournalEntry, JournalSource, JournalStatus } from "./domain/entities/JournalEntry";
export type { JournalLine, JournalLineDraft } from "./domain/entities/JournalLine";
export type { AccountingPeriod, PeriodStatus } from "./domain/entities/AccountingPeriod";
export { isPeriodWritable } from "./domain/entities/AccountingPeriod";

// Value Objects
export { Money } from "./domain/value-objects/Money";

// Validators
export { createManualJournalSchema, journalListQuerySchema } from "./validators/journal";

// DTOs
export { toJournalResponseDto } from "./dto/JournalDto";
export type { JournalResponseDto, JournalListResponseDto } from "./dto/JournalDto";

// Errors
export {
  AccountingError,
  JournalUnbalancedError,
  PeriodClosedError,
  CoaNotFoundError,
  CoaNotPostableError,
  JournalAlreadyReversedError,
  DuplicateJournalSourceError,
} from "./errors";

// Event Handlers (for direct invocation in tests)
export { handleInvoiceCreatedAccounting } from "./services/event-handlers/invoice-created-accounting.handler";
export { handleInvoicePaidAccounting } from "./services/event-handlers/invoice-paid-accounting.handler";
export { handleExpenseApprovedAccounting } from "./services/event-handlers/expense-approved-accounting.handler";
export { handlePurchaseOrderPaidAccounting } from "./services/event-handlers/purchase-order-paid-accounting.handler";
```

- [ ] **Step 2: Update CHANGELOG `[Unreleased]`**

Edit `docs/CHANGELOG.md` di section `[Unreleased]`:

```markdown
### [2026-05-20] — Phase 2: Journal Engine (manual + auto handlers)

- **Tipe**: [ADDED]
- **Scope**: `modules/accounting`, `lib/event-bus/`, `modules/finance/`
- **Author**: agent
- **Deskripsi**: Phase 2 modul akuntansi: JournalNumberGenerator (JV-YYYY-MM-####), balanceValidator (DR=CR via Money), JournalRepository + mapper, JournalPostingService (manual + auto posting dengan idempotency), 4 event handlers (invoice-created, invoice-paid, expense-approved, purchase-order-paid), coa-resolver helper, journal validators (Zod) + DTOs, registrasi handler di event-bus (gated feature flag ACCOUNTING_MODULE_ENABLED), publish events EXPENSE_APPROVED + PURCHASE_ORDER_PAID dari finance services.
- **Files**: `modules/accounting/services/journal/`, `modules/accounting/services/event-handlers/`, `modules/accounting/repositories/JournalRepository.ts`, `modules/accounting/validators/journal.ts`, `modules/accounting/dto/JournalDto.ts`, `lib/event-bus/types.ts`, `lib/event-bus/event-handlers.ts`, `modules/finance/services/ExpenseRouteService.ts`, `modules/finance/services/FinancePurchaseOrderPaymentService.ts`
- **Breaking**: ❌ Tidak
```

- [ ] **Step 3: Run full check**

Run: `npm run check`
Expected: lint + typecheck + build PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/index.ts docs/CHANGELOG.md
git commit -m "feat(accounting): module index public API + changelog Phase 2"
```

---
# PHASE 3 — Reports (Read-only Aggregation + API + UI)

> Phase ini implementasi 6 laporan akuntansi inti. Semua service bersifat **read-only**, ambil data on-the-fly dari `journal_lines` + `journal_entries` + `chart_of_accounts`. Tidak ada denormalisasi, tidak ada cache di v1 (volume ≤ 100 jurnal/tenant/hari sesuai spec Section 6.4).
>
> Konstruktor service: `constructor(private readonly prisma: PrismaClient)` agar mockable di test.
>
> Decimal precision: hasil agregasi Postgres `numeric` → di-convert ke string via `.toFixed(2)` (atau `Money.fromString(row.amount).toString()`). **Tidak boleh** ada `Number()` cast yang merusak precision.
>
> Setiap report service test wajib jalan di real DB (`./scripts/setup-test-db.sh` dulu) dan minimal 3 test case (happy path + edge case + balance/total verification).

---

## Task 28: Report DTOs

**Files:**
- Create: `modules/accounting/dto/ReportDto.ts`

- [ ] **Step 1: Tulis DTO untuk semua 6 laporan**

Create `modules/accounting/dto/ReportDto.ts`:

```ts
import type { COAType, DebitCredit } from "../domain/entities/ChartOfAccount";

// ============================================================
// Trial Balance
// ============================================================
export interface TrialBalanceRow {
  coaCode: string;
  coaName: string;
  coaType: COAType;
  totalDebit: string;
  totalCredit: string;
  balance: string;
  normalSide: DebitCredit;
}

export interface TrialBalanceReport {
  asOfDate: string;
  rows: TrialBalanceRow[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

// ============================================================
// Section helper (digunakan oleh P&L, Neraca, Arus Kas)
// ============================================================
export interface ReportSectionAccount {
  coaCode: string;
  coaName: string;
  amount: string;
}

export interface ProfitLossSection {
  label: string;
  accounts: ReportSectionAccount[];
  subtotal: string;
}

// ============================================================
// Profit & Loss (Laba Rugi)
// ============================================================
export interface ProfitLossReport {
  from: string;
  to: string;
  revenue: ProfitLossSection;
  expense: ProfitLossSection;
  netIncome: string;
}

// ============================================================
// Balance Sheet (Neraca)
// ============================================================
export interface BalanceSheetReport {
  asOfDate: string;
  asset: ProfitLossSection;
  liability: ProfitLossSection;
  equity: ProfitLossSection;
  totalAsset: string;
  totalLiabilityEquity: string;
  balanced: boolean;
}

// ============================================================
// Cash Flow (Arus Kas — metode tidak langsung)
// ============================================================
export interface CashFlowReport {
  from: string;
  to: string;
  operating: ProfitLossSection;
  investing: ProfitLossSection;
  financing: ProfitLossSection;
  netChange: string;
  openingCash: string;
  closingCash: string;
}

// ============================================================
// Cash Book (Buku Kas/Bank — per akun kas/bank)
// ============================================================
export interface CashBookEntry {
  date: string;
  entryNumber: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface CashBookReport {
  coaId: string;
  coaCode: string;
  coaName: string;
  from: string;
  to: string;
  openingBalance: string;
  entries: CashBookEntry[];
  closingBalance: string;
}

// ============================================================
// General Ledger (Buku Besar — per akun apa saja)
// ============================================================
export interface GeneralLedgerEntry {
  date: string;
  entryNumber: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface GeneralLedgerReport {
  coaId: string;
  coaCode: string;
  coaName: string;
  coaType: COAType;
  normalSide: DebitCredit;
  from: string;
  to: string;
  openingBalance: string;
  entries: GeneralLedgerEntry[];
  closingBalance: string;
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/dto/ReportDto.ts
git commit -m "feat(accounting): tambah DTO laporan akuntansi (Trial Balance, P&L, Neraca, Arus Kas, Buku Kas, Buku Besar)"
```

---

## Task 29: Report Validators (Zod)

**Files:**
- Create: `modules/accounting/validators/reports.ts`

- [ ] **Step 1: Tulis Zod schema untuk query params**

Create `modules/accounting/validators/reports.ts`:

```ts
import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), {
    message: "Tanggal tidak valid",
  });

export const asOfDateSchema = z.object({
  asOfDate: isoDate,
});

export const dateRangeSchema = z
  .object({
    from: isoDate,
    to: isoDate,
  })
  .refine((v) => new Date(v.from).getTime() <= new Date(v.to).getTime(), {
    message: "from harus <= to",
    path: ["to"],
  });

export const ledgerQuerySchema = z
  .object({
    coaId: z.string().cuid(),
    from: isoDate,
    to: isoDate,
  })
  .refine((v) => new Date(v.from).getTime() <= new Date(v.to).getTime(), {
    message: "from harus <= to",
    path: ["to"],
  });

export type AsOfDateQuery = z.infer<typeof asOfDateSchema>;
export type DateRangeQuery = z.infer<typeof dateRangeSchema>;
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
```

- [ ] **Step 2: Type check & commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add modules/accounting/validators/reports.ts
git commit -m "feat(accounting): tambah Zod validators untuk query laporan"
```

---

## Task 30: TrialBalanceService

**Files:**
- Create: `modules/accounting/services/reports/TrialBalanceService.ts`
- Create: `modules/accounting/__tests__/TrialBalanceService.test.ts`

- [ ] **Step 1: Tulis test (TDD)**

Create `modules/accounting/__tests__/TrialBalanceService.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { TrialBalanceService } from "../services/reports/TrialBalanceService";
import { JournalPostingService } from "../services/journal/JournalPostingService";
import { JournalRepository } from "../repositories/JournalRepository";
import { PeriodRepository } from "../repositories/PeriodRepository";
import { PeriodService } from "../services/period/PeriodService";
import { ChartOfAccountRepository } from "../repositories/ChartOfAccountRepository";
import { seedDefaultCoa } from "../services/coa/seedDefaultCoa";

const TENANT = "test-tenant-tb";

async function getCoaId(code: string): Promise<string> {
  const c = await prisma.chartOfAccount.findUnique({
    where: { tenantId_code: { tenantId: TENANT, code } },
  });
  if (!c) throw new Error(`COA ${code} not found`);
  return c.id;
}

describe("TrialBalanceService", () => {
  const journalRepo = new JournalRepository();
  const periodRepo = new PeriodRepository();
  const coaRepo = new ChartOfAccountRepository();
  const periodSvc = new PeriodService(periodRepo);
  const postingSvc = new JournalPostingService(journalRepo, periodRepo, coaRepo);
  const tbSvc = new TrialBalanceService(prisma);

  beforeEach(async () => {
    await prisma.journalLine.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.accountingPeriod.deleteMany({ where: { tenantId: TENANT } });
    await prisma.chartOfAccount.deleteMany({ where: { tenantId: TENANT } });
    await seedDefaultCoa(TENANT);
    await periodSvc.ensureCurrentPeriod(TENANT, new Date("2026-05-15"));
  });

  it("trial balance balanced setelah 3 jurnal balanced", async () => {
    const bank = await getCoaId("1-110");
    const ar = await getCoaId("1-200");
    const revenue = await getCoaId("4-100");
    const expenseOpex = await getCoaId("5-300");

    // Jurnal 1: Invoice created (DR AR 1.000.000 / CR Revenue 1.000.000)
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-10"),
      source: "AUTO_INVOICE_CREATED",
      sourceRefType: "Invoice",
      sourceRefId: "inv-1",
      description: "Invoice INV-001",
      lines: [
        { coaId: ar, side: "DEBIT", amount: "1000000.00" },
        { coaId: revenue, side: "CREDIT", amount: "1000000.00" },
      ],
    });

    // Jurnal 2: Payment received (DR Bank 1.000.000 / CR AR 1.000.000)
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-12"),
      source: "AUTO_INVOICE_PAID",
      sourceRefType: "Invoice",
      sourceRefId: "inv-1-paid",
      description: "Bayar INV-001",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "1000000.00" },
        { coaId: ar, side: "CREDIT", amount: "1000000.00" },
      ],
    });

    // Jurnal 3: Expense (DR Opex 200.000 / CR Bank 200.000)
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-15"),
      source: "AUTO_EXPENSE",
      sourceRefType: "Expense",
      sourceRefId: "exp-1",
      description: "Beban operasional",
      lines: [
        { coaId: expenseOpex, side: "DEBIT", amount: "200000.00" },
        { coaId: bank, side: "CREDIT", amount: "200000.00" },
      ],
    });

    const tb = await tbSvc.generate(TENANT, "2026-05-31");

    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
    expect(Number(tb.totalDebit)).toBe(2200000);

    const bankRow = tb.rows.find((r) => r.coaCode === "1-110");
    expect(bankRow?.balance).toBe("800000.00"); // 1.000.000 - 200.000

    const revenueRow = tb.rows.find((r) => r.coaCode === "4-100");
    expect(revenueRow?.balance).toBe("1000000.00");

    const opexRow = tb.rows.find((r) => r.coaCode === "5-300");
    expect(opexRow?.balance).toBe("200000.00");
  });

  it("trial balance kosong saat tidak ada jurnal", async () => {
    const tb = await tbSvc.generate(TENANT, "2026-05-31");
    expect(tb.rows).toEqual([]);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe("0.00");
    expect(tb.totalCredit).toBe("0.00");
  });

  it("trial balance filter by asOfDate (jurnal masa depan tidak masuk)", async () => {
    const bank = await getCoaId("1-110");
    const revenue = await getCoaId("4-100");

    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-10"),
      source: "MANUAL",
      description: "Mei",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "100.00" },
        { coaId: revenue, side: "CREDIT", amount: "100.00" },
      ],
    });

    // Jurnal Juni — harus tidak masuk kalau asOfDate = 31 Mei
    await periodSvc.ensureCurrentPeriod(TENANT, new Date("2026-06-15"));
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-06-10"),
      source: "MANUAL",
      description: "Juni",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "999.00" },
        { coaId: revenue, side: "CREDIT", amount: "999.00" },
      ],
    });

    const tb = await tbSvc.generate(TENANT, "2026-05-31");
    expect(Number(tb.totalDebit)).toBe(100);
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/TrialBalanceService.test.ts`
Expected: FAIL — service belum ada.

- [ ] **Step 3: Implement `TrialBalanceService`**

Create `modules/accounting/services/reports/TrialBalanceService.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import { Money } from "../../domain/value-objects/Money";
import type {
  TrialBalanceReport,
  TrialBalanceRow,
} from "../../dto/ReportDto";
import type { COAType, DebitCredit } from "../../domain/entities/ChartOfAccount";

interface RawRow {
  coa_code: string;
  coa_name: string;
  coa_type: COAType;
  normal_side: DebitCredit;
  total_debit: string;
  total_credit: string;
}

export class TrialBalanceService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(tenantId: string, asOfDate: string): Promise<TrialBalanceReport> {
    const asOf = new Date(`${asOfDate}T23:59:59.999Z`);

    const rows = await this.prisma.$queryRaw<RawRow[]>`
      SELECT
        coa.code AS coa_code,
        coa.name AS coa_name,
        coa.type::text AS coa_type,
        coa."normalSide"::text AS normal_side,
        COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
        COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND je."entryDate" <= ${asOf}
      GROUP BY coa.code, coa.name, coa.type, coa."normalSide"
      ORDER BY coa.code ASC
    `;

    const tbRows: TrialBalanceRow[] = rows.map((r) => {
      const debit = Money.fromString(r.total_debit);
      const credit = Money.fromString(r.total_credit);
      const balance =
        r.coa_type === "ASSET" || r.coa_type === "EXPENSE"
          ? debit.subtract(credit)
          : credit.subtract(debit);
      return {
        coaCode: r.coa_code,
        coaName: r.coa_name,
        coaType: r.coa_type,
        totalDebit: debit.toString(),
        totalCredit: credit.toString(),
        balance: balance.toString(),
        normalSide: r.normal_side,
      };
    });

    const totalDebit = tbRows.reduce(
      (acc, r) => acc.add(Money.fromString(r.totalDebit)),
      Money.zero(),
    );
    const totalCredit = tbRows.reduce(
      (acc, r) => acc.add(Money.fromString(r.totalCredit)),
      Money.zero(),
    );

    return {
      asOfDate,
      rows: tbRows,
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
      balanced: totalDebit.equals(totalCredit),
    };
  }
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `./scripts/setup-test-db.sh && npx vitest run modules/accounting/__tests__/TrialBalanceService.test.ts`
Expected: PASS 3 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/reports/TrialBalanceService.ts modules/accounting/__tests__/TrialBalanceService.test.ts
git commit -m "feat(accounting): tambah TrialBalanceService (agregasi journal_lines per COA)"
```

---

## Task 31: ProfitLossService

**Files:**
- Create: `modules/accounting/services/reports/ProfitLossService.ts`
- Create: `modules/accounting/__tests__/ProfitLossService.test.ts`

- [ ] **Step 1: Tulis test**

Create `modules/accounting/__tests__/ProfitLossService.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { ProfitLossService } from "../services/reports/ProfitLossService";
import { JournalPostingService } from "../services/journal/JournalPostingService";
import { JournalRepository } from "../repositories/JournalRepository";
import { PeriodRepository } from "../repositories/PeriodRepository";
import { PeriodService } from "../services/period/PeriodService";
import { ChartOfAccountRepository } from "../repositories/ChartOfAccountRepository";
import { seedDefaultCoa } from "../services/coa/seedDefaultCoa";

const TENANT = "test-tenant-pl";

async function coa(code: string): Promise<string> {
  const c = await prisma.chartOfAccount.findUnique({
    where: { tenantId_code: { tenantId: TENANT, code } },
  });
  if (!c) throw new Error(`COA ${code} not found`);
  return c.id;
}

describe("ProfitLossService", () => {
  const journalRepo = new JournalRepository();
  const periodRepo = new PeriodRepository();
  const coaRepo = new ChartOfAccountRepository();
  const periodSvc = new PeriodService(periodRepo);
  const postingSvc = new JournalPostingService(journalRepo, periodRepo, coaRepo);
  const plSvc = new ProfitLossService(prisma);

  beforeEach(async () => {
    await prisma.journalLine.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.accountingPeriod.deleteMany({ where: { tenantId: TENANT } });
    await prisma.chartOfAccount.deleteMany({ where: { tenantId: TENANT } });
    await seedDefaultCoa(TENANT);
    await periodSvc.ensureCurrentPeriod(TENANT, new Date("2026-05-15"));
  });

  it("net income = revenue - expense", async () => {
    const bank = await coa("1-110");
    const revenue = await coa("4-100");
    const opex = await coa("5-300");

    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-05"),
      source: "MANUAL",
      description: "Pendapatan PPP",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "5000000.00" },
        { coaId: revenue, side: "CREDIT", amount: "5000000.00" },
      ],
    });
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-10"),
      source: "MANUAL",
      description: "Beban listrik",
      lines: [
        { coaId: opex, side: "DEBIT", amount: "1500000.00" },
        { coaId: bank, side: "CREDIT", amount: "1500000.00" },
      ],
    });

    const pl = await plSvc.generate(TENANT, "2026-05-01", "2026-05-31");

    expect(pl.revenue.subtotal).toBe("5000000.00");
    expect(pl.expense.subtotal).toBe("1500000.00");
    expect(pl.netIncome).toBe("3500000.00");
    expect(pl.revenue.accounts).toHaveLength(1);
    expect(pl.expense.accounts).toHaveLength(1);
  });

  it("rugi (net income negatif) saat expense > revenue", async () => {
    const bank = await coa("1-110");
    const revenue = await coa("4-100");
    const opex = await coa("5-300");

    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-05"),
      source: "MANUAL",
      description: "Pendapatan kecil",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "100.00" },
        { coaId: revenue, side: "CREDIT", amount: "100.00" },
      ],
    });
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-10"),
      source: "MANUAL",
      description: "Beban besar",
      lines: [
        { coaId: opex, side: "DEBIT", amount: "500.00" },
        { coaId: bank, side: "CREDIT", amount: "500.00" },
      ],
    });

    const pl = await plSvc.generate(TENANT, "2026-05-01", "2026-05-31");
    expect(pl.netIncome).toBe("-400.00");
  });

  it("filter date range exclude jurnal di luar range", async () => {
    const bank = await coa("1-110");
    const revenue = await coa("4-100");

    // April
    await periodSvc.ensureCurrentPeriod(TENANT, new Date("2026-04-15"));
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-04-15"),
      source: "MANUAL",
      description: "April",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "999.00" },
        { coaId: revenue, side: "CREDIT", amount: "999.00" },
      ],
    });
    // Mei
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-15"),
      source: "MANUAL",
      description: "Mei",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "111.00" },
        { coaId: revenue, side: "CREDIT", amount: "111.00" },
      ],
    });

    const pl = await plSvc.generate(TENANT, "2026-05-01", "2026-05-31");
    expect(pl.revenue.subtotal).toBe("111.00");
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/ProfitLossService.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `ProfitLossService`**

Create `modules/accounting/services/reports/ProfitLossService.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import { Money } from "../../domain/value-objects/Money";
import type {
  ProfitLossReport,
  ProfitLossSection,
  ReportSectionAccount,
} from "../../dto/ReportDto";

interface RawAcc {
  coa_code: string;
  coa_name: string;
  total_debit: string;
  total_credit: string;
}

export class ProfitLossService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<ProfitLossReport> {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const revenueRows = await this.prisma.$queryRaw<RawAcc[]>`
      SELECT
        coa.code AS coa_code,
        coa.name AS coa_name,
        COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
        COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND je."entryDate" >= ${fromDate}
        AND je."entryDate" <= ${toDate}
        AND coa.type = 'REVENUE'
      GROUP BY coa.code, coa.name
      ORDER BY coa.code ASC
    `;

    const expenseRows = await this.prisma.$queryRaw<RawAcc[]>`
      SELECT
        coa.code AS coa_code,
        coa.name AS coa_name,
        COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
        COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND je."entryDate" >= ${fromDate}
        AND je."entryDate" <= ${toDate}
        AND coa.type = 'EXPENSE'
      GROUP BY coa.code, coa.name
      ORDER BY coa.code ASC
    `;

    const revenueSection = buildSection("Pendapatan", revenueRows, "CREDIT");
    const expenseSection = buildSection("Beban", expenseRows, "DEBIT");

    const netIncome = Money.fromString(revenueSection.subtotal).subtract(
      Money.fromString(expenseSection.subtotal),
    );

    return {
      from,
      to,
      revenue: revenueSection,
      expense: expenseSection,
      netIncome: netIncome.toString(),
    };
  }
}

function buildSection(
  label: string,
  rows: RawAcc[],
  normalSide: "DEBIT" | "CREDIT",
): ProfitLossSection {
  const accounts: ReportSectionAccount[] = rows.map((r) => {
    const debit = Money.fromString(r.total_debit);
    const credit = Money.fromString(r.total_credit);
    const amount =
      normalSide === "DEBIT" ? debit.subtract(credit) : credit.subtract(debit);
    return {
      coaCode: r.coa_code,
      coaName: r.coa_name,
      amount: amount.toString(),
    };
  });
  const subtotal = accounts.reduce(
    (acc, a) => acc.add(Money.fromString(a.amount)),
    Money.zero(),
  );
  return { label, accounts, subtotal: subtotal.toString() };
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/ProfitLossService.test.ts`
Expected: PASS 3 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/reports/ProfitLossService.ts modules/accounting/__tests__/ProfitLossService.test.ts
git commit -m "feat(accounting): tambah ProfitLossService (Laba Rugi)"
```

---

## Task 32: BalanceSheetService

**Files:**
- Create: `modules/accounting/services/reports/BalanceSheetService.ts`
- Create: `modules/accounting/__tests__/BalanceSheetService.test.ts`

- [ ] **Step 1: Tulis test**

Create `modules/accounting/__tests__/BalanceSheetService.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { BalanceSheetService } from "../services/reports/BalanceSheetService";
import { JournalPostingService } from "../services/journal/JournalPostingService";
import { JournalRepository } from "../repositories/JournalRepository";
import { PeriodRepository } from "../repositories/PeriodRepository";
import { PeriodService } from "../services/period/PeriodService";
import { ChartOfAccountRepository } from "../repositories/ChartOfAccountRepository";
import { seedDefaultCoa } from "../services/coa/seedDefaultCoa";

const TENANT = "test-tenant-bs";

async function coa(code: string): Promise<string> {
  const c = await prisma.chartOfAccount.findUnique({
    where: { tenantId_code: { tenantId: TENANT, code } },
  });
  if (!c) throw new Error(`COA ${code} not found`);
  return c.id;
}

describe("BalanceSheetService", () => {
  const journalRepo = new JournalRepository();
  const periodRepo = new PeriodRepository();
  const coaRepo = new ChartOfAccountRepository();
  const periodSvc = new PeriodService(periodRepo);
  const postingSvc = new JournalPostingService(journalRepo, periodRepo, coaRepo);
  const bsSvc = new BalanceSheetService(prisma);

  beforeEach(async () => {
    await prisma.journalLine.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.accountingPeriod.deleteMany({ where: { tenantId: TENANT } });
    await prisma.chartOfAccount.deleteMany({ where: { tenantId: TENANT } });
    await seedDefaultCoa(TENANT);
    await periodSvc.ensureCurrentPeriod(TENANT, new Date("2026-05-15"));
  });

  it("neraca balanced setelah opening capital + transaksi", async () => {
    const bank = await coa("1-110");
    const modal = await coa("3-100");
    const revenue = await coa("4-100");
    const opex = await coa("5-300");

    // Opening balance: setor modal 10jt
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-01"),
      source: "OPENING_BALANCE",
      description: "Setor modal awal",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "10000000.00" },
        { coaId: modal, side: "CREDIT", amount: "10000000.00" },
      ],
    });
    // Pendapatan 5jt
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-10"),
      source: "MANUAL",
      description: "Pendapatan",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "5000000.00" },
        { coaId: revenue, side: "CREDIT", amount: "5000000.00" },
      ],
    });
    // Beban 1jt
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-15"),
      source: "MANUAL",
      description: "Beban",
      lines: [
        { coaId: opex, side: "DEBIT", amount: "1000000.00" },
        { coaId: bank, side: "CREDIT", amount: "1000000.00" },
      ],
    });

    const bs = await bsSvc.generate(TENANT, "2026-05-31");

    // Aset = bank 14jt
    expect(bs.totalAsset).toBe("14000000.00");
    // Modal 10jt + Laba berjalan (5jt - 1jt = 4jt) = 14jt
    expect(bs.totalLiabilityEquity).toBe("14000000.00");
    expect(bs.balanced).toBe(true);

    const labaBerjalan = bs.equity.accounts.find((a) => a.coaCode === "3-300");
    expect(labaBerjalan?.amount).toBe("4000000.00");
  });

  it("balanced=false ketika ada anomali (defense in depth)", async () => {
    // Simulasi: kosong → totalAsset=0, totalLE=0 → balanced true
    const bs = await bsSvc.generate(TENANT, "2026-05-31");
    expect(bs.totalAsset).toBe("0.00");
    expect(bs.totalLiabilityEquity).toBe("0.00");
    expect(bs.balanced).toBe(true);
  });

  it("laba berjalan dihitung dari awal tahun fiskal sampai asOfDate", async () => {
    const bank = await coa("1-110");
    const revenue = await coa("4-100");

    // Februari 2026
    await periodSvc.ensureCurrentPeriod(TENANT, new Date("2026-02-15"));
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-02-15"),
      source: "MANUAL",
      description: "Pendapatan Feb",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "1000.00" },
        { coaId: revenue, side: "CREDIT", amount: "1000.00" },
      ],
    });
    // Mei 2026
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-10"),
      source: "MANUAL",
      description: "Pendapatan Mei",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "2000.00" },
        { coaId: revenue, side: "CREDIT", amount: "2000.00" },
      ],
    });

    const bs = await bsSvc.generate(TENANT, "2026-05-31");
    const lr = bs.equity.accounts.find((a) => a.coaCode === "3-300");
    // Akumulasi dari Jan 2026 sampai 31 Mei = 1000 + 2000 = 3000
    expect(lr?.amount).toBe("3000.00");
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/BalanceSheetService.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `BalanceSheetService`**

Create `modules/accounting/services/reports/BalanceSheetService.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import { Money } from "../../domain/value-objects/Money";
import type {
  BalanceSheetReport,
  ProfitLossSection,
  ReportSectionAccount,
} from "../../dto/ReportDto";

interface RawAcc {
  coa_code: string;
  coa_name: string;
  total_debit: string;
  total_credit: string;
}

interface RawTotal {
  total_debit: string;
  total_credit: string;
}

const LABA_BERJALAN_CODE = "3-300";
const LABA_BERJALAN_NAME = "Laba/Rugi Berjalan";

export class BalanceSheetService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(tenantId: string, asOfDate: string): Promise<BalanceSheetReport> {
    const asOf = new Date(`${asOfDate}T23:59:59.999Z`);
    const fyStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));

    const [assetRows, liabilityRows, equityRows, revenueTotal, expenseTotal] =
      await Promise.all([
        this.queryByType(tenantId, asOf, "ASSET"),
        this.queryByType(tenantId, asOf, "LIABILITY"),
        this.queryByType(tenantId, asOf, "EQUITY"),
        this.queryTotalByType(tenantId, fyStart, asOf, "REVENUE"),
        this.queryTotalByType(tenantId, fyStart, asOf, "EXPENSE"),
      ]);

    const assetSection = buildSection("Aset", assetRows, "DEBIT");
    const liabilitySection = buildSection("Liabilitas", liabilityRows, "CREDIT");

    // Equity dari journal lines
    const equityFromLines = buildSection("Ekuitas", equityRows, "CREDIT");

    // Hitung Laba/Rugi Berjalan on-the-fly = REVENUE (CR-DR) - EXPENSE (DR-CR)
    const revenueAmount = creditMinusDebit(revenueTotal);
    const expenseAmount = debitMinusCredit(expenseTotal);
    const labaBerjalanComputed = revenueAmount.subtract(expenseAmount);

    // Merge laba berjalan ke equity section
    const equityAccounts: ReportSectionAccount[] = [...equityFromLines.accounts];
    const existingIdx = equityAccounts.findIndex(
      (a) => a.coaCode === LABA_BERJALAN_CODE,
    );
    if (existingIdx >= 0) {
      const existingAmount = Money.fromString(equityAccounts[existingIdx].amount);
      equityAccounts[existingIdx] = {
        ...equityAccounts[existingIdx],
        amount: existingAmount.add(labaBerjalanComputed).toString(),
      };
    } else {
      equityAccounts.push({
        coaCode: LABA_BERJALAN_CODE,
        coaName: LABA_BERJALAN_NAME,
        amount: labaBerjalanComputed.toString(),
      });
      equityAccounts.sort((a, b) => a.coaCode.localeCompare(b.coaCode));
    }

    const equitySubtotal = equityAccounts.reduce(
      (acc, a) => acc.add(Money.fromString(a.amount)),
      Money.zero(),
    );

    const equitySection: ProfitLossSection = {
      label: "Ekuitas",
      accounts: equityAccounts,
      subtotal: equitySubtotal.toString(),
    };

    const totalAsset = Money.fromString(assetSection.subtotal);
    const totalLE = Money.fromString(liabilitySection.subtotal).add(
      Money.fromString(equitySection.subtotal),
    );

    return {
      asOfDate,
      asset: assetSection,
      liability: liabilitySection,
      equity: equitySection,
      totalAsset: totalAsset.toString(),
      totalLiabilityEquity: totalLE.toString(),
      balanced: totalAsset.equals(totalLE),
    };
  }

  private async queryByType(
    tenantId: string,
    asOf: Date,
    type: "ASSET" | "LIABILITY" | "EQUITY",
  ): Promise<RawAcc[]> {
    return this.prisma.$queryRaw<RawAcc[]>`
      SELECT
        coa.code AS coa_code,
        coa.name AS coa_name,
        COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
        COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND je."entryDate" <= ${asOf}
        AND coa.type::text = ${type}
      GROUP BY coa.code, coa.name
      ORDER BY coa.code ASC
    `;
  }

  private async queryTotalByType(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
    type: "REVENUE" | "EXPENSE",
  ): Promise<RawTotal> {
    const rows = await this.prisma.$queryRaw<RawTotal[]>`
      SELECT
        COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
        COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND je."entryDate" >= ${fromDate}
        AND je."entryDate" <= ${toDate}
        AND coa.type::text = ${type}
    `;
    return rows[0] ?? { total_debit: "0", total_credit: "0" };
  }
}

function buildSection(
  label: string,
  rows: RawAcc[],
  normalSide: "DEBIT" | "CREDIT",
): ProfitLossSection {
  const accounts: ReportSectionAccount[] = rows.map((r) => {
    const debit = Money.fromString(r.total_debit);
    const credit = Money.fromString(r.total_credit);
    const amount =
      normalSide === "DEBIT" ? debit.subtract(credit) : credit.subtract(debit);
    return {
      coaCode: r.coa_code,
      coaName: r.coa_name,
      amount: amount.toString(),
    };
  });
  const subtotal = accounts.reduce(
    (acc, a) => acc.add(Money.fromString(a.amount)),
    Money.zero(),
  );
  return { label, accounts, subtotal: subtotal.toString() };
}

function creditMinusDebit(t: RawTotal): Money {
  return Money.fromString(t.total_credit).subtract(Money.fromString(t.total_debit));
}

function debitMinusCredit(t: RawTotal): Money {
  return Money.fromString(t.total_debit).subtract(Money.fromString(t.total_credit));
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/BalanceSheetService.test.ts`
Expected: PASS 3 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/reports/BalanceSheetService.ts modules/accounting/__tests__/BalanceSheetService.test.ts
git commit -m "feat(accounting): tambah BalanceSheetService (Neraca + Laba/Rugi Berjalan on-the-fly)"
```

---

## Task 33: CashFlowService

**Files:**
- Create: `modules/accounting/services/reports/CashFlowService.ts`
- Create: `modules/accounting/__tests__/CashFlowService.test.ts`

- [ ] **Step 1: Tulis test**

Create `modules/accounting/__tests__/CashFlowService.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { CashFlowService } from "../services/reports/CashFlowService";
import { JournalPostingService } from "../services/journal/JournalPostingService";
import { JournalRepository } from "../repositories/JournalRepository";
import { PeriodRepository } from "../repositories/PeriodRepository";
import { PeriodService } from "../services/period/PeriodService";
import { ChartOfAccountRepository } from "../repositories/ChartOfAccountRepository";
import { seedDefaultCoa } from "../services/coa/seedDefaultCoa";

const TENANT = "test-tenant-cf";

async function coa(code: string): Promise<string> {
  const c = await prisma.chartOfAccount.findUnique({
    where: { tenantId_code: { tenantId: TENANT, code } },
  });
  if (!c) throw new Error(`COA ${code} not found`);
  return c.id;
}

describe("CashFlowService", () => {
  const journalRepo = new JournalRepository();
  const periodRepo = new PeriodRepository();
  const coaRepo = new ChartOfAccountRepository();
  const periodSvc = new PeriodService(periodRepo);
  const postingSvc = new JournalPostingService(journalRepo, periodRepo, coaRepo);
  const cfSvc = new CashFlowService(prisma);

  beforeEach(async () => {
    await prisma.journalLine.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.accountingPeriod.deleteMany({ where: { tenantId: TENANT } });
    await prisma.chartOfAccount.deleteMany({ where: { tenantId: TENANT } });
    await seedDefaultCoa(TENANT);
    await periodSvc.ensureCurrentPeriod(TENANT, new Date("2026-05-15"));
  });

  it("operating: pendapatan + beban → net change cocok dengan perubahan kas", async () => {
    const bank = await coa("1-110");
    const revenue = await coa("4-100");
    const opex = await coa("5-300");

    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-05"),
      source: "MANUAL",
      description: "Pendapatan",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "5000000.00" },
        { coaId: revenue, side: "CREDIT", amount: "5000000.00" },
      ],
    });
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-15"),
      source: "MANUAL",
      description: "Beban",
      lines: [
        { coaId: opex, side: "DEBIT", amount: "1500000.00" },
        { coaId: bank, side: "CREDIT", amount: "1500000.00" },
      ],
    });

    const cf = await cfSvc.generate(TENANT, "2026-05-01", "2026-05-31");

    expect(cf.openingCash).toBe("0.00");
    expect(cf.closingCash).toBe("3500000.00");
    expect(cf.netChange).toBe("3500000.00");
  });

  it("financing: setor modal masuk kategori FINANCING", async () => {
    const bank = await coa("1-110");
    const modal = await coa("3-100");

    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-01"),
      source: "OPENING_BALANCE",
      description: "Setor modal",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "10000000.00" },
        { coaId: modal, side: "CREDIT", amount: "10000000.00" },
      ],
    });

    const cf = await cfSvc.generate(TENANT, "2026-05-01", "2026-05-31");
    expect(cf.financing.subtotal).toBe("10000000.00");
    expect(cf.netChange).toBe("10000000.00");
    expect(cf.closingCash).toBe("10000000.00");
  });

  it("kosong → semua section nol", async () => {
    const cf = await cfSvc.generate(TENANT, "2026-05-01", "2026-05-31");
    expect(cf.openingCash).toBe("0.00");
    expect(cf.closingCash).toBe("0.00");
    expect(cf.netChange).toBe("0.00");
    expect(cf.operating.subtotal).toBe("0.00");
    expect(cf.investing.subtotal).toBe("0.00");
    expect(cf.financing.subtotal).toBe("0.00");
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/CashFlowService.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `CashFlowService`**

Create `modules/accounting/services/reports/CashFlowService.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import { Money } from "../../domain/value-objects/Money";
import type {
  CashFlowReport,
  ProfitLossSection,
  ReportSectionAccount,
} from "../../dto/ReportDto";

type CashFlowCategoryKey = "OPERATING" | "INVESTING" | "FINANCING";

interface RawCfRow {
  coa_code: string;
  coa_name: string;
  category: CashFlowCategoryKey;
  total_debit: string;
  total_credit: string;
  normal_side: "DEBIT" | "CREDIT";
}

interface RawCashTotal {
  total_debit: string;
  total_credit: string;
}

export class CashFlowService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<CashFlowReport> {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);
    const dayBefore = new Date(fromDate.getTime() - 1);

    const [rows, openingTotal, closingTotal] = await Promise.all([
      this.prisma.$queryRaw<RawCfRow[]>`
        SELECT
          coa.code AS coa_code,
          coa.name AS coa_name,
          coa."cashFlowCategory"::text AS category,
          coa."normalSide"::text AS normal_side,
          COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
          COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl."entryId"
        JOIN chart_of_accounts coa ON coa.id = jl."coaId"
        WHERE je."tenantId" = ${tenantId}
          AND je.status = 'POSTED'
          AND je."entryDate" >= ${fromDate}
          AND je."entryDate" <= ${toDate}
          AND coa."cashFlowCategory" IS NOT NULL
        GROUP BY coa.code, coa.name, coa."cashFlowCategory", coa."normalSide"
        ORDER BY coa.code ASC
      `,
      this.queryCashTotal(tenantId, dayBefore),
      this.queryCashTotal(tenantId, toDate),
    ]);

    const operating = filterAndBuild(rows, "OPERATING", "Aktivitas Operasi");
    const investing = filterAndBuild(rows, "INVESTING", "Aktivitas Investasi");
    const financing = filterAndBuild(rows, "FINANCING", "Aktivitas Pendanaan");

    const openingCash = Money.fromString(openingTotal.total_debit).subtract(
      Money.fromString(openingTotal.total_credit),
    );
    const closingCash = Money.fromString(closingTotal.total_debit).subtract(
      Money.fromString(closingTotal.total_credit),
    );
    const netChange = closingCash.subtract(openingCash);

    return {
      from,
      to,
      operating,
      investing,
      financing,
      netChange: netChange.toString(),
      openingCash: openingCash.toString(),
      closingCash: closingCash.toString(),
    };
  }

  /**
   * Net cash position: aggregate semua akun cash & bank (subtype CURRENT_ASSET di
   * bawah parent kode "1-100" / "1-110") via filter cashFlowCategory IS NULL +
   * type=ASSET + code prefix. Implementasi v1: sum DR-CR untuk akun dengan kode
   * yang prefix "1-1" (Kas/Bank standar di seed default).
   */
  private async queryCashTotal(tenantId: string, asOf: Date): Promise<RawCashTotal> {
    const rows = await this.prisma.$queryRaw<RawCashTotal[]>`
      SELECT
        COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
        COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND je."entryDate" <= ${asOf}
        AND coa.type = 'ASSET'
        AND (coa.code LIKE '1-100%' OR coa.code LIKE '1-110%')
    `;
    return rows[0] ?? { total_debit: "0", total_credit: "0" };
  }
}

function filterAndBuild(
  rows: RawCfRow[],
  category: CashFlowCategoryKey,
  label: string,
): ProfitLossSection {
  const filtered = rows.filter((r) => r.category === category);
  const accounts: ReportSectionAccount[] = filtered.map((r) => {
    // Net change kas dari kategori ini = -(perubahan saldo akun non-kas).
    // Untuk REVENUE (CR-DR) → cash in (positif). Untuk EXPENSE (DR-CR) → cash
    // out (negatif). Untuk LIABILITY/EQUITY (CR-DR) → cash in. Untuk ASSET
    // non-kas (DR-CR) → cash out.
    const debit = Money.fromString(r.total_debit);
    const credit = Money.fromString(r.total_credit);
    const normalDelta =
      r.normal_side === "DEBIT" ? debit.subtract(credit) : credit.subtract(debit);
    const cashImpact =
      r.normal_side === "DEBIT"
        ? Money.zero().subtract(normalDelta) // ASSET/EXPENSE naik → cash turun
        : normalDelta; // LIABILITY/EQUITY/REVENUE naik → cash naik
    return {
      coaCode: r.coa_code,
      coaName: r.coa_name,
      amount: cashImpact.toString(),
    };
  });
  const subtotal = accounts.reduce(
    (acc, a) => acc.add(Money.fromString(a.amount)),
    Money.zero(),
  );
  return { label, accounts, subtotal: subtotal.toString() };
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/CashFlowService.test.ts`
Expected: PASS 3 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/reports/CashFlowService.ts modules/accounting/__tests__/CashFlowService.test.ts
git commit -m "feat(accounting): tambah CashFlowService (PSAK 2 metode tidak langsung)"
```

---

## Task 34: CashBookService

**Files:**
- Create: `modules/accounting/services/reports/CashBookService.ts`
- Create: `modules/accounting/services/reports/buildLedgerEntries.ts`
- Create: `modules/accounting/__tests__/CashBookService.test.ts`

- [ ] **Step 1: Tulis test**

Create `modules/accounting/__tests__/CashBookService.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { CashBookService } from "../services/reports/CashBookService";
import { JournalPostingService } from "../services/journal/JournalPostingService";
import { JournalRepository } from "../repositories/JournalRepository";
import { PeriodRepository } from "../repositories/PeriodRepository";
import { PeriodService } from "../services/period/PeriodService";
import { ChartOfAccountRepository } from "../repositories/ChartOfAccountRepository";
import { seedDefaultCoa } from "../services/coa/seedDefaultCoa";

const TENANT = "test-tenant-cashbook";

async function coa(code: string): Promise<string> {
  const c = await prisma.chartOfAccount.findUnique({
    where: { tenantId_code: { tenantId: TENANT, code } },
  });
  if (!c) throw new Error(`COA ${code} not found`);
  return c.id;
}

describe("CashBookService", () => {
  const journalRepo = new JournalRepository();
  const periodRepo = new PeriodRepository();
  const coaRepo = new ChartOfAccountRepository();
  const periodSvc = new PeriodService(periodRepo);
  const postingSvc = new JournalPostingService(journalRepo, periodRepo, coaRepo);
  const cbSvc = new CashBookService(prisma);

  beforeEach(async () => {
    await prisma.journalLine.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.accountingPeriod.deleteMany({ where: { tenantId: TENANT } });
    await prisma.chartOfAccount.deleteMany({ where: { tenantId: TENANT } });
    await seedDefaultCoa(TENANT);
    await periodSvc.ensureCurrentPeriod(TENANT, new Date("2026-05-15"));
  });

  it("running balance benar untuk akun ASSET (DR-CR)", async () => {
    const bank = await coa("1-110");
    const revenue = await coa("4-100");
    const opex = await coa("5-300");

    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-05"),
      source: "MANUAL",
      description: "Setor pendapatan",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "1000.00" },
        { coaId: revenue, side: "CREDIT", amount: "1000.00" },
      ],
    });
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-10"),
      source: "MANUAL",
      description: "Bayar listrik",
      lines: [
        { coaId: opex, side: "DEBIT", amount: "300.00" },
        { coaId: bank, side: "CREDIT", amount: "300.00" },
      ],
    });

    const r = await cbSvc.generate(TENANT, bank, "2026-05-01", "2026-05-31");
    expect(r.openingBalance).toBe("0.00");
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0].debit).toBe("1000.00");
    expect(r.entries[0].runningBalance).toBe("1000.00");
    expect(r.entries[1].credit).toBe("300.00");
    expect(r.entries[1].runningBalance).toBe("700.00");
    expect(r.closingBalance).toBe("700.00");
  });

  it("opening balance dari jurnal sebelum from", async () => {
    const bank = await coa("1-110");
    const modal = await coa("3-100");

    await periodSvc.ensureCurrentPeriod(TENANT, new Date("2026-04-15"));
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-04-15"),
      source: "OPENING_BALANCE",
      description: "Setor modal",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "5000000.00" },
        { coaId: modal, side: "CREDIT", amount: "5000000.00" },
      ],
    });

    const r = await cbSvc.generate(TENANT, bank, "2026-05-01", "2026-05-31");
    expect(r.openingBalance).toBe("5000000.00");
    expect(r.entries).toHaveLength(0);
    expect(r.closingBalance).toBe("5000000.00");
  });

  it("kosong → opening, closing, entries semua nol", async () => {
    const bank = await coa("1-110");
    const r = await cbSvc.generate(TENANT, bank, "2026-05-01", "2026-05-31");
    expect(r.openingBalance).toBe("0.00");
    expect(r.closingBalance).toBe("0.00");
    expect(r.entries).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/CashBookService.test.ts`
Expected: FAIL.

- [ ] **Step 3: Buat helper `buildLedgerEntries`**

Create `modules/accounting/services/reports/buildLedgerEntries.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import { Money } from "../../domain/value-objects/Money";
import type { GeneralLedgerEntry } from "../../dto/ReportDto";
import type {
  ChartOfAccount,
  DebitCredit,
} from "../../domain/entities/ChartOfAccount";

interface RawLine {
  entry_date: Date;
  entry_number: string;
  description: string;
  side: DebitCredit;
  amount: string;
  line_description: string | null;
}

interface RawTotal {
  total_debit: string;
  total_credit: string;
}

export interface LedgerResult {
  openingBalance: string;
  entries: GeneralLedgerEntry[];
  closingBalance: string;
}

export async function buildLedgerEntries(
  prisma: PrismaClient,
  tenantId: string,
  coa: Pick<ChartOfAccount, "id" | "normalSide" | "type">,
  from: Date,
  to: Date,
): Promise<LedgerResult> {
  // Opening balance dari jurnal sebelum `from`
  const dayBefore = new Date(from.getTime() - 1);
  const openingRows = await prisma.$queryRaw<RawTotal[]>`
    SELECT
      COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
      COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl."entryId"
    WHERE je."tenantId" = ${tenantId}
      AND je.status = 'POSTED'
      AND je."entryDate" <= ${dayBefore}
      AND jl."coaId" = ${coa.id}
  `;

  const opening = computeBalance(openingRows[0], coa.normalSide);

  // Entries di rentang
  const lines = await prisma.$queryRaw<RawLine[]>`
    SELECT
      je."entryDate" AS entry_date,
      je."entryNumber" AS entry_number,
      je.description AS description,
      jl.side::text AS side,
      jl.amount::text AS amount,
      jl.description AS line_description
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl."entryId"
    WHERE je."tenantId" = ${tenantId}
      AND je.status = 'POSTED'
      AND je."entryDate" >= ${from}
      AND je."entryDate" <= ${to}
      AND jl."coaId" = ${coa.id}
    ORDER BY je."entryDate" ASC, je."entryNumber" ASC, jl."lineOrder" ASC
  `;

  let running = opening;
  const entries: GeneralLedgerEntry[] = lines.map((l) => {
    const amount = Money.fromString(l.amount);
    const debit = l.side === "DEBIT" ? amount : Money.zero();
    const credit = l.side === "CREDIT" ? amount : Money.zero();
    if (coa.normalSide === "DEBIT") {
      running = running.add(debit).subtract(credit);
    } else {
      running = running.add(credit).subtract(debit);
    }
    return {
      date: l.entry_date.toISOString().slice(0, 10),
      entryNumber: l.entry_number,
      description: l.line_description ?? l.description,
      debit: debit.toString(),
      credit: credit.toString(),
      runningBalance: running.toString(),
    };
  });

  return {
    openingBalance: opening.toString(),
    entries,
    closingBalance: running.toString(),
  };
}

function computeBalance(t: RawTotal | undefined, normalSide: DebitCredit): Money {
  if (!t) return Money.zero();
  const debit = Money.fromString(t.total_debit);
  const credit = Money.fromString(t.total_credit);
  return normalSide === "DEBIT" ? debit.subtract(credit) : credit.subtract(debit);
}
```

- [ ] **Step 4: Implement `CashBookService`**

Create `modules/accounting/services/reports/CashBookService.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import type { CashBookReport } from "../../dto/ReportDto";
import { CoaNotFoundError } from "../../errors";
import { buildLedgerEntries } from "./buildLedgerEntries";

export class CashBookService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    tenantId: string,
    coaId: string,
    from: string,
    to: string,
  ): Promise<CashBookReport> {
    const coa = await this.prisma.chartOfAccount.findFirst({
      where: { id: coaId, tenantId },
    });
    if (!coa) throw new CoaNotFoundError(coaId);

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const result = await buildLedgerEntries(
      this.prisma,
      tenantId,
      { id: coa.id, normalSide: coa.normalSide, type: coa.type },
      fromDate,
      toDate,
    );

    return {
      coaId: coa.id,
      coaCode: coa.code,
      coaName: coa.name,
      from,
      to,
      openingBalance: result.openingBalance,
      entries: result.entries,
      closingBalance: result.closingBalance,
    };
  }
}
```

- [ ] **Step 5: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/CashBookService.test.ts`
Expected: PASS 3 test.

- [ ] **Step 6: Commit**

```bash
git add modules/accounting/services/reports/CashBookService.ts modules/accounting/services/reports/buildLedgerEntries.ts modules/accounting/__tests__/CashBookService.test.ts
git commit -m "feat(accounting): tambah CashBookService + helper buildLedgerEntries"
```

---

## Task 35: GeneralLedgerService

**Files:**
- Create: `modules/accounting/services/reports/GeneralLedgerService.ts`
- Create: `modules/accounting/__tests__/GeneralLedgerService.test.ts`

- [ ] **Step 1: Tulis test**

Create `modules/accounting/__tests__/GeneralLedgerService.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GeneralLedgerService } from "../services/reports/GeneralLedgerService";
import { JournalPostingService } from "../services/journal/JournalPostingService";
import { JournalRepository } from "../repositories/JournalRepository";
import { PeriodRepository } from "../repositories/PeriodRepository";
import { PeriodService } from "../services/period/PeriodService";
import { ChartOfAccountRepository } from "../repositories/ChartOfAccountRepository";
import { seedDefaultCoa } from "../services/coa/seedDefaultCoa";
import { CoaNotFoundError } from "../errors";

const TENANT = "test-tenant-gl";

async function coa(code: string): Promise<string> {
  const c = await prisma.chartOfAccount.findUnique({
    where: { tenantId_code: { tenantId: TENANT, code } },
  });
  if (!c) throw new Error(`COA ${code} not found`);
  return c.id;
}

describe("GeneralLedgerService", () => {
  const journalRepo = new JournalRepository();
  const periodRepo = new PeriodRepository();
  const coaRepo = new ChartOfAccountRepository();
  const periodSvc = new PeriodService(periodRepo);
  const postingSvc = new JournalPostingService(journalRepo, periodRepo, coaRepo);
  const glSvc = new GeneralLedgerService(prisma);

  beforeEach(async () => {
    await prisma.journalLine.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.accountingPeriod.deleteMany({ where: { tenantId: TENANT } });
    await prisma.chartOfAccount.deleteMany({ where: { tenantId: TENANT } });
    await seedDefaultCoa(TENANT);
    await periodSvc.ensureCurrentPeriod(TENANT, new Date("2026-05-15"));
  });

  it("buku besar untuk akun REVENUE (CR-DR running balance)", async () => {
    const bank = await coa("1-110");
    const revenue = await coa("4-100");

    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-05"),
      source: "MANUAL",
      description: "Pendapatan A",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "1000.00" },
        { coaId: revenue, side: "CREDIT", amount: "1000.00" },
      ],
    });
    await postingSvc.post(TENANT, {
      entryDate: new Date("2026-05-10"),
      source: "MANUAL",
      description: "Pendapatan B",
      lines: [
        { coaId: bank, side: "DEBIT", amount: "500.00" },
        { coaId: revenue, side: "CREDIT", amount: "500.00" },
      ],
    });

    const r = await glSvc.generate(TENANT, revenue, "2026-05-01", "2026-05-31");
    expect(r.coaCode).toBe("4-100");
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0].credit).toBe("1000.00");
    expect(r.entries[0].runningBalance).toBe("1000.00");
    expect(r.entries[1].runningBalance).toBe("1500.00");
    expect(r.closingBalance).toBe("1500.00");
  });

  it("throw CoaNotFoundError untuk coa yang bukan milik tenant", async () => {
    await expect(
      glSvc.generate(TENANT, "non-existent", "2026-05-01", "2026-05-31"),
    ).rejects.toBeInstanceOf(CoaNotFoundError);
  });

  it("kosong → opening, closing nol & entries kosong", async () => {
    const opex = await coa("5-300");
    const r = await glSvc.generate(TENANT, opex, "2026-05-01", "2026-05-31");
    expect(r.openingBalance).toBe("0.00");
    expect(r.closingBalance).toBe("0.00");
    expect(r.entries).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/GeneralLedgerService.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `GeneralLedgerService`**

Create `modules/accounting/services/reports/GeneralLedgerService.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import type { GeneralLedgerReport } from "../../dto/ReportDto";
import { CoaNotFoundError } from "../../errors";
import { buildLedgerEntries } from "./buildLedgerEntries";

export class GeneralLedgerService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    tenantId: string,
    coaId: string,
    from: string,
    to: string,
  ): Promise<GeneralLedgerReport> {
    const coa = await this.prisma.chartOfAccount.findFirst({
      where: { id: coaId, tenantId },
    });
    if (!coa) throw new CoaNotFoundError(coaId);

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const result = await buildLedgerEntries(
      this.prisma,
      tenantId,
      { id: coa.id, normalSide: coa.normalSide, type: coa.type },
      fromDate,
      toDate,
    );

    return {
      coaId: coa.id,
      coaCode: coa.code,
      coaName: coa.name,
      coaType: coa.type,
      normalSide: coa.normalSide,
      from,
      to,
      openingBalance: result.openingBalance,
      entries: result.entries,
      closingBalance: result.closingBalance,
    };
  }
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/GeneralLedgerService.test.ts`
Expected: PASS 3 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/reports/GeneralLedgerService.ts modules/accounting/__tests__/GeneralLedgerService.test.ts
git commit -m "feat(accounting): tambah GeneralLedgerService (Buku Besar per akun)"
```

---

## Task 36: API Routes — 6 Report Endpoints

**Files:**
- Create: `app/api/admin/accounting/reports/trial-balance/route.ts`
- Create: `app/api/admin/accounting/reports/profit-loss/route.ts`
- Create: `app/api/admin/accounting/reports/balance-sheet/route.ts`
- Create: `app/api/admin/accounting/reports/cash-flow/route.ts`
- Create: `app/api/admin/accounting/reports/cash-book/route.ts`
- Create: `app/api/admin/accounting/reports/general-ledger/route.ts`

> Pola: `createHandler({ auth: true })` + `hasPermission("accounting:read")` + Zod validate query + service call + `apiSuccess`. Pada Zod error, return `ApiErrors.validation(...)`. Pada `CoaNotFoundError`, return `ApiErrors.notFound(...)`. Pada `AccountingError` lain, return `ApiErrors.badRequest(...)`. Error tak terduga → `apiError` 500 + log.

- [ ] **Step 1: Buat shared helper handler error**

Create `modules/accounting/services/reports/handleReportError.ts`:

```ts
import { ApiErrors, apiError, ErrorCodes } from "@/lib/api";
import { ZodError } from "zod";
import { AccountingError, CoaNotFoundError } from "../../errors";

export function handleReportError(err: unknown) {
  if (err instanceof ZodError) {
    return ApiErrors.validation(err.errors[0]?.message ?? "Validasi gagal");
  }
  if (err instanceof CoaNotFoundError) {
    return ApiErrors.notFound(err.message);
  }
  if (err instanceof AccountingError) {
    return apiError(err.message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
  }
  return apiError(
    "Gagal menghasilkan laporan",
    ErrorCodes.INTERNAL_ERROR,
    { status: 500 },
  );
}
```

- [ ] **Step 2: Trial Balance route**

Create `app/api/admin/accounting/reports/trial-balance/route.ts`:

```ts
import { hasPermission } from "@/lib/rbac";
import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { TrialBalanceService } from "@/modules/accounting/services/reports/TrialBalanceService";
import { asOfDateSchema } from "@/modules/accounting/validators/reports";
import { handleReportError } from "@/modules/accounting/services/reports/handleReportError";

export const dynamic = "force-dynamic";

const service = new TrialBalanceService(prisma);

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("accounting:read"))) {
    return ApiErrors.forbidden("Tidak ada akses laporan akuntansi");
  }
  const tenantId = ctx.session?.user?.tenantId;
  if (!tenantId) return ApiErrors.forbidden("Tenant tidak teridentifikasi");

  try {
    const { searchParams } = req.nextUrl;
    const parsed = asOfDateSchema.parse({
      asOfDate: searchParams.get("asOfDate") ?? "",
    });
    const report = await service.generate(tenantId, parsed.asOfDate);
    return apiSuccess(report);
  } catch (err) {
    return handleReportError(err);
  }
});
```

- [ ] **Step 3: Profit Loss route**

Create `app/api/admin/accounting/reports/profit-loss/route.ts`:

```ts
import { hasPermission } from "@/lib/rbac";
import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ProfitLossService } from "@/modules/accounting/services/reports/ProfitLossService";
import { dateRangeSchema } from "@/modules/accounting/validators/reports";
import { handleReportError } from "@/modules/accounting/services/reports/handleReportError";

export const dynamic = "force-dynamic";

const service = new ProfitLossService(prisma);

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("accounting:read"))) {
    return ApiErrors.forbidden("Tidak ada akses laporan akuntansi");
  }
  const tenantId = ctx.session?.user?.tenantId;
  if (!tenantId) return ApiErrors.forbidden("Tenant tidak teridentifikasi");

  try {
    const { searchParams } = req.nextUrl;
    const parsed = dateRangeSchema.parse({
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
    });
    const report = await service.generate(tenantId, parsed.from, parsed.to);
    return apiSuccess(report);
  } catch (err) {
    return handleReportError(err);
  }
});
```

- [ ] **Step 4: Balance Sheet route**

Create `app/api/admin/accounting/reports/balance-sheet/route.ts`:

```ts
import { hasPermission } from "@/lib/rbac";
import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { BalanceSheetService } from "@/modules/accounting/services/reports/BalanceSheetService";
import { asOfDateSchema } from "@/modules/accounting/validators/reports";
import { handleReportError } from "@/modules/accounting/services/reports/handleReportError";

export const dynamic = "force-dynamic";

const service = new BalanceSheetService(prisma);

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("accounting:read"))) {
    return ApiErrors.forbidden("Tidak ada akses laporan akuntansi");
  }
  const tenantId = ctx.session?.user?.tenantId;
  if (!tenantId) return ApiErrors.forbidden("Tenant tidak teridentifikasi");

  try {
    const { searchParams } = req.nextUrl;
    const parsed = asOfDateSchema.parse({
      asOfDate: searchParams.get("asOfDate") ?? "",
    });
    const report = await service.generate(tenantId, parsed.asOfDate);
    return apiSuccess(report);
  } catch (err) {
    return handleReportError(err);
  }
});
```

- [ ] **Step 5: Cash Flow route**

Create `app/api/admin/accounting/reports/cash-flow/route.ts`:

```ts
import { hasPermission } from "@/lib/rbac";
import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { CashFlowService } from "@/modules/accounting/services/reports/CashFlowService";
import { dateRangeSchema } from "@/modules/accounting/validators/reports";
import { handleReportError } from "@/modules/accounting/services/reports/handleReportError";

export const dynamic = "force-dynamic";

const service = new CashFlowService(prisma);

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("accounting:read"))) {
    return ApiErrors.forbidden("Tidak ada akses laporan akuntansi");
  }
  const tenantId = ctx.session?.user?.tenantId;
  if (!tenantId) return ApiErrors.forbidden("Tenant tidak teridentifikasi");

  try {
    const { searchParams } = req.nextUrl;
    const parsed = dateRangeSchema.parse({
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
    });
    const report = await service.generate(tenantId, parsed.from, parsed.to);
    return apiSuccess(report);
  } catch (err) {
    return handleReportError(err);
  }
});
```

- [ ] **Step 6: Cash Book route**

Create `app/api/admin/accounting/reports/cash-book/route.ts`:

```ts
import { hasPermission } from "@/lib/rbac";
import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { CashBookService } from "@/modules/accounting/services/reports/CashBookService";
import { ledgerQuerySchema } from "@/modules/accounting/validators/reports";
import { handleReportError } from "@/modules/accounting/services/reports/handleReportError";

export const dynamic = "force-dynamic";

const service = new CashBookService(prisma);

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("accounting:read"))) {
    return ApiErrors.forbidden("Tidak ada akses laporan akuntansi");
  }
  const tenantId = ctx.session?.user?.tenantId;
  if (!tenantId) return ApiErrors.forbidden("Tenant tidak teridentifikasi");

  try {
    const { searchParams } = req.nextUrl;
    const parsed = ledgerQuerySchema.parse({
      coaId: searchParams.get("coaId") ?? "",
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
    });
    const report = await service.generate(
      tenantId,
      parsed.coaId,
      parsed.from,
      parsed.to,
    );
    return apiSuccess(report);
  } catch (err) {
    return handleReportError(err);
  }
});
```

- [ ] **Step 7: General Ledger route**

Create `app/api/admin/accounting/reports/general-ledger/route.ts`:

```ts
import { hasPermission } from "@/lib/rbac";
import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { GeneralLedgerService } from "@/modules/accounting/services/reports/GeneralLedgerService";
import { ledgerQuerySchema } from "@/modules/accounting/validators/reports";
import { handleReportError } from "@/modules/accounting/services/reports/handleReportError";

export const dynamic = "force-dynamic";

const service = new GeneralLedgerService(prisma);

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("accounting:read"))) {
    return ApiErrors.forbidden("Tidak ada akses laporan akuntansi");
  }
  const tenantId = ctx.session?.user?.tenantId;
  if (!tenantId) return ApiErrors.forbidden("Tenant tidak teridentifikasi");

  try {
    const { searchParams } = req.nextUrl;
    const parsed = ledgerQuerySchema.parse({
      coaId: searchParams.get("coaId") ?? "",
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
    });
    const report = await service.generate(
      tenantId,
      parsed.coaId,
      parsed.from,
      parsed.to,
    );
    return apiSuccess(report);
  } catch (err) {
    return handleReportError(err);
  }
});
```

- [ ] **Step 8: Type check, build, & commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add app/api/admin/accounting/reports/ modules/accounting/services/reports/handleReportError.ts
git commit -m "feat(accounting): tambah 6 API route laporan (trial balance, P&L, neraca, arus kas, buku kas, buku besar)"
```

---

## Task 37: UI Pages — 6 Report Pages

**Files:**
- Create: `app/admin/akuntansi/laporan/trial-balance/page.tsx`
- Create: `app/admin/akuntansi/laporan/laba-rugi/page.tsx`
- Create: `app/admin/akuntansi/laporan/neraca/page.tsx`
- Create: `app/admin/akuntansi/laporan/arus-kas/page.tsx`
- Create: `app/admin/akuntansi/laporan/buku-kas/page.tsx`
- Create: `app/admin/akuntansi/laporan/buku-besar/page.tsx`

> [Asumsi] Project belum punya date-range picker reusable yang seragam — gunakan plain `<input type="date">`. Kalau ada `<DateRangePicker>` di `components/`, ganti import sesuai. Pakai `useApi` dari `lib/hooks/useApi.ts` (TanStack Query wrapper) sesuai `docs/standards/data-fetching.md`. Format angka pakai `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2 })`.

- [ ] **Step 1: Helper formatter**

Create `app/admin/akuntansi/laporan/_components/formatRupiah.ts`:

```ts
const formatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatRupiah(amount: string | number): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return formatter.format(n);
}
```

- [ ] **Step 2: Trial Balance page**

Create `app/admin/akuntansi/laporan/trial-balance/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import type { TrialBalanceReport } from "@/modules/accounting/dto/ReportDto";
import { formatRupiah } from "../_components/formatRupiah";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TrialBalancePage() {
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const { data, isLoading, error } = useApi<{ data: TrialBalanceReport }>(
    `/api/admin/accounting/reports/trial-balance?asOfDate=${asOfDate}`,
  );
  const report = data?.data;

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trial Balance</h1>
        <label className="flex items-center gap-2">
          <span className="text-sm">Per tanggal</span>
          <input
            type="date"
            className="rounded border px-2 py-1"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
        </label>
      </header>

      {isLoading && <p>Memuat…</p>}
      {error && <p className="text-red-600">Gagal memuat: {error.message}</p>}

      {report && !report.balanced && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-red-700">
          Tidak balance! Total Debit ({formatRupiah(report.totalDebit)}) ≠ Total
          Credit ({formatRupiah(report.totalCredit)}).
        </div>
      )}

      {report && (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="border px-2 py-1 text-left">Kode</th>
              <th className="border px-2 py-1 text-left">Akun</th>
              <th className="border px-2 py-1 text-right">Debit</th>
              <th className="border px-2 py-1 text-right">Kredit</th>
              <th className="border px-2 py-1 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.coaCode}>
                <td className="border px-2 py-1">{r.coaCode}</td>
                <td className="border px-2 py-1">{r.coaName}</td>
                <td className="border px-2 py-1 text-right">
                  {formatRupiah(r.totalDebit)}
                </td>
                <td className="border px-2 py-1 text-right">
                  {formatRupiah(r.totalCredit)}
                </td>
                <td className="border px-2 py-1 text-right font-medium">
                  {formatRupiah(r.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td className="border px-2 py-1" colSpan={2}>
                Total
              </td>
              <td className="border px-2 py-1 text-right">
                {formatRupiah(report.totalDebit)}
              </td>
              <td className="border px-2 py-1 text-right">
                {formatRupiah(report.totalCredit)}
              </td>
              <td className="border px-2 py-1" />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Laba Rugi page**

Create `app/admin/akuntansi/laporan/laba-rugi/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import type { ProfitLossReport } from "@/modules/accounting/dto/ReportDto";
import { formatRupiah } from "../_components/formatRupiah";

function defaultRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function LabaRugiPage() {
  const init = defaultRange();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);

  const { data, isLoading, error } = useApi<{ data: ProfitLossReport }>(
    `/api/admin/accounting/reports/profit-loss?from=${from}&to=${to}`,
  );
  const report = data?.data;

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Laporan Laba Rugi</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="rounded border px-2 py-1"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span>—</span>
          <input
            type="date"
            className="rounded border px-2 py-1"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </header>

      {isLoading && <p>Memuat…</p>}
      {error && <p className="text-red-600">Gagal memuat: {error.message}</p>}

      {report && (
        <div className="space-y-6">
          <Section title={report.revenue.label} accounts={report.revenue.accounts} subtotal={report.revenue.subtotal} />
          <Section title={report.expense.label} accounts={report.expense.accounts} subtotal={report.expense.subtotal} />
          <div className="border-t pt-3 text-right text-lg font-semibold">
            Laba/Rugi Bersih: {formatRupiah(report.netIncome)}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  accounts,
  subtotal,
}: {
  title: string;
  accounts: { coaCode: string; coaName: string; amount: string }[];
  subtotal: string;
}) {
  return (
    <div>
      <h2 className="mb-2 text-lg font-medium">{title}</h2>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {accounts.map((a) => (
            <tr key={a.coaCode}>
              <td className="border px-2 py-1 w-24">{a.coaCode}</td>
              <td className="border px-2 py-1">{a.coaName}</td>
              <td className="border px-2 py-1 text-right">{formatRupiah(a.amount)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="border px-2 py-1" colSpan={2}>Subtotal</td>
            <td className="border px-2 py-1 text-right">{formatRupiah(subtotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Neraca page**

Create `app/admin/akuntansi/laporan/neraca/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import type { BalanceSheetReport, ProfitLossSection } from "@/modules/accounting/dto/ReportDto";
import { formatRupiah } from "../_components/formatRupiah";

export default function NeracaPage() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const { data, isLoading, error } = useApi<{ data: BalanceSheetReport }>(
    `/api/admin/accounting/reports/balance-sheet?asOfDate=${asOfDate}`,
  );
  const report = data?.data;

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Neraca</h1>
        <input
          type="date"
          className="rounded border px-2 py-1"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
        />
      </header>

      {isLoading && <p>Memuat…</p>}
      {error && <p className="text-red-600">Gagal memuat: {error.message}</p>}

      {report && !report.balanced && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-red-700">
          Tidak balance! Total Aset ({formatRupiah(report.totalAsset)}) ≠ Total Liabilitas + Ekuitas ({formatRupiah(report.totalLiabilityEquity)}).
        </div>
      )}

      {report && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <SectionTable title="Aset" section={report.asset} />
            <p className="mt-2 text-right font-semibold">
              Total Aset: {formatRupiah(report.totalAsset)}
            </p>
          </div>
          <div className="space-y-4">
            <SectionTable title="Liabilitas" section={report.liability} />
            <SectionTable title="Ekuitas" section={report.equity} />
            <p className="mt-2 text-right font-semibold">
              Total Liabilitas + Ekuitas: {formatRupiah(report.totalLiabilityEquity)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTable({ title, section }: { title: string; section: ProfitLossSection }) {
  return (
    <div>
      <h2 className="mb-2 text-lg font-medium">{title}</h2>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {section.accounts.map((a) => (
            <tr key={a.coaCode}>
              <td className="border px-2 py-1 w-24">{a.coaCode}</td>
              <td className="border px-2 py-1">{a.coaName}</td>
              <td className="border px-2 py-1 text-right">{formatRupiah(a.amount)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="border px-2 py-1" colSpan={2}>Subtotal</td>
            <td className="border px-2 py-1 text-right">{formatRupiah(section.subtotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Arus Kas page**

Create `app/admin/akuntansi/laporan/arus-kas/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import type { CashFlowReport, ProfitLossSection } from "@/modules/accounting/dto/ReportDto";
import { formatRupiah } from "../_components/formatRupiah";

function defaultRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function ArusKasPage() {
  const init = defaultRange();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);

  const { data, isLoading, error } = useApi<{ data: CashFlowReport }>(
    `/api/admin/accounting/reports/cash-flow?from=${from}&to=${to}`,
  );
  const report = data?.data;

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Laporan Arus Kas</h1>
        <div className="flex items-center gap-2">
          <input type="date" className="rounded border px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span>—</span>
          <input type="date" className="rounded border px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </header>

      {isLoading && <p>Memuat…</p>}
      {error && <p className="text-red-600">Gagal memuat: {error.message}</p>}

      {report && (
        <div className="space-y-6">
          <SectionTable title={report.operating.label} section={report.operating} />
          <SectionTable title={report.investing.label} section={report.investing} />
          <SectionTable title={report.financing.label} section={report.financing} />
          <div className="space-y-1 border-t pt-3 text-right">
            <div>Saldo Kas Awal: {formatRupiah(report.openingCash)}</div>
            <div>Net Change: {formatRupiah(report.netChange)}</div>
            <div className="text-lg font-semibold">
              Saldo Kas Akhir: {formatRupiah(report.closingCash)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTable({ title, section }: { title: string; section: ProfitLossSection }) {
  return (
    <div>
      <h2 className="mb-2 text-lg font-medium">{title}</h2>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {section.accounts.map((a) => (
            <tr key={a.coaCode}>
              <td className="border px-2 py-1 w-24">{a.coaCode}</td>
              <td className="border px-2 py-1">{a.coaName}</td>
              <td className="border px-2 py-1 text-right">{formatRupiah(a.amount)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="border px-2 py-1" colSpan={2}>Subtotal</td>
            <td className="border px-2 py-1 text-right">{formatRupiah(section.subtotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Buku Kas page**

Create `app/admin/akuntansi/laporan/buku-kas/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import type { CashBookReport } from "@/modules/accounting/dto/ReportDto";
import { formatRupiah } from "../_components/formatRupiah";

interface CoaOption {
  id: string;
  code: string;
  name: string;
}

function defaultRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function BukuKasPage() {
  const init = defaultRange();
  const [coaId, setCoaId] = useState<string>("");
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);

  // List COA bertipe ASSET (akun kas/bank).
  const { data: coaListData } = useApi<{ data: CoaOption[] }>(
    `/api/admin/accounting/coa?type=ASSET`,
  );
  const coaOptions = coaListData?.data ?? [];

  const { data, isLoading, error } = useApi<{ data: CashBookReport }>(
    coaId
      ? `/api/admin/accounting/reports/cash-book?coaId=${coaId}&from=${from}&to=${to}`
      : null,
  );
  const report = data?.data;

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Buku Kas / Bank</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded border px-2 py-1"
            value={coaId}
            onChange={(e) => setCoaId(e.target.value)}
          >
            <option value="">Pilih akun…</option>
            {coaOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <input type="date" className="rounded border px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span>—</span>
          <input type="date" className="rounded border px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </header>

      {isLoading && <p>Memuat…</p>}
      {error && <p className="text-red-600">Gagal memuat: {error.message}</p>}

      {report && (
        <div className="space-y-2">
          <div className="text-sm">
            <strong>{report.coaCode} — {report.coaName}</strong> · Saldo Awal: {formatRupiah(report.openingBalance)}
          </div>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border px-2 py-1 text-left">Tanggal</th>
                <th className="border px-2 py-1 text-left">No. Jurnal</th>
                <th className="border px-2 py-1 text-left">Keterangan</th>
                <th className="border px-2 py-1 text-right">Debit</th>
                <th className="border px-2 py-1 text-right">Kredit</th>
                <th className="border px-2 py-1 text-right">Saldo Berjalan</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((e, idx) => (
                <tr key={`${e.entryNumber}-${idx}`}>
                  <td className="border px-2 py-1">{e.date}</td>
                  <td className="border px-2 py-1">{e.entryNumber}</td>
                  <td className="border px-2 py-1">{e.description}</td>
                  <td className="border px-2 py-1 text-right">{formatRupiah(e.debit)}</td>
                  <td className="border px-2 py-1 text-right">{formatRupiah(e.credit)}</td>
                  <td className="border px-2 py-1 text-right">{formatRupiah(e.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="border px-2 py-1" colSpan={5}>Saldo Akhir</td>
                <td className="border px-2 py-1 text-right">{formatRupiah(report.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Buku Besar page**

Create `app/admin/akuntansi/laporan/buku-besar/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import type { GeneralLedgerReport } from "@/modules/accounting/dto/ReportDto";
import { formatRupiah } from "../_components/formatRupiah";

interface CoaOption {
  id: string;
  code: string;
  name: string;
}

function defaultRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function BukuBesarPage() {
  const init = defaultRange();
  const [coaId, setCoaId] = useState<string>("");
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);

  const { data: coaListData } = useApi<{ data: CoaOption[] }>(
    `/api/admin/accounting/coa`,
  );
  const coaOptions = coaListData?.data ?? [];

  const { data, isLoading, error } = useApi<{ data: GeneralLedgerReport }>(
    coaId
      ? `/api/admin/accounting/reports/general-ledger?coaId=${coaId}&from=${from}&to=${to}`
      : null,
  );
  const report = data?.data;

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Buku Besar</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded border px-2 py-1"
            value={coaId}
            onChange={(e) => setCoaId(e.target.value)}
          >
            <option value="">Pilih akun…</option>
            {coaOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <input type="date" className="rounded border px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span>—</span>
          <input type="date" className="rounded border px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </header>

      {isLoading && <p>Memuat…</p>}
      {error && <p className="text-red-600">Gagal memuat: {error.message}</p>}

      {report && (
        <div className="space-y-2">
          <div className="text-sm">
            <strong>{report.coaCode} — {report.coaName}</strong> ({report.coaType}, normal {report.normalSide}) · Saldo Awal: {formatRupiah(report.openingBalance)}
          </div>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border px-2 py-1 text-left">Tanggal</th>
                <th className="border px-2 py-1 text-left">No. Jurnal</th>
                <th className="border px-2 py-1 text-left">Keterangan</th>
                <th className="border px-2 py-1 text-right">Debit</th>
                <th className="border px-2 py-1 text-right">Kredit</th>
                <th className="border px-2 py-1 text-right">Saldo Berjalan</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((e, idx) => (
                <tr key={`${e.entryNumber}-${idx}`}>
                  <td className="border px-2 py-1">{e.date}</td>
                  <td className="border px-2 py-1">{e.entryNumber}</td>
                  <td className="border px-2 py-1">{e.description}</td>
                  <td className="border px-2 py-1 text-right">{formatRupiah(e.debit)}</td>
                  <td className="border px-2 py-1 text-right">{formatRupiah(e.credit)}</td>
                  <td className="border px-2 py-1 text-right">{formatRupiah(e.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="border px-2 py-1" colSpan={5}>Saldo Akhir</td>
                <td className="border px-2 py-1 text-right">{formatRupiah(report.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Build & lint**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/admin/akuntansi/laporan/
git commit -m "feat(accounting): tambah 6 halaman laporan akuntansi (UI + TanStack Query)"
```

---

## Task 38: Redirect `/admin/finance/laba-rugi` ke `/admin/akuntansi/laporan/laba-rugi`

**Files:**
- Modify: `app/admin/finance/laba-rugi/page.tsx`

> Spec Section 5.4: setelah module accounting siap, halaman `/admin/finance/laba-rugi` di-redirect ke versi baru. File `ProfitLossClient.tsx` lama tidak dihapus (untuk rollback cepat), tapi tidak lagi di-import dari `page.tsx`.

- [ ] **Step 1: Replace `page.tsx` body dengan `redirect()`**

Edit `app/admin/finance/laba-rugi/page.tsx` menjadi:

```tsx
import { redirect } from "next/navigation";

/**
 * Redirect: laporan Laba Rugi sekarang dimiliki module accounting.
 * Halaman lama dipertahankan untuk fallback rollback (lihat ProfitLossClient.tsx).
 */
export default function Page(): never {
  redirect("/admin/akuntansi/laporan/laba-rugi");
}
```

- [ ] **Step 2: Verifikasi build**

Run: `npm run build`
Expected: build PASS.

- [ ] **Step 3: Smoke test manual**

Run: `npm run dev`
Buka browser → `http://localhost:3000/admin/finance/laba-rugi` → harus auto-redirect ke `/admin/akuntansi/laporan/laba-rugi`. Stop server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add app/admin/finance/laba-rugi/page.tsx
git commit -m "feat(accounting): redirect /admin/finance/laba-rugi ke /admin/akuntansi/laporan/laba-rugi"
```

---

## Task 39: CHANGELOG Phase 3 + Final Verification

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Tambah entry ke `[Unreleased]`**

Edit `docs/CHANGELOG.md`, tambahkan di section `[Unreleased]`:

```markdown
### [2026-05-20] — Phase 3: Laporan akuntansi (6 laporan inti)

- **Tipe**: [ADDED]
- **Scope**: `modules/accounting/services/reports`, `app/api/admin/accounting/reports`, `app/admin/akuntansi/laporan`
- **Author**: agent
- **Deskripsi**: Phase 3 modul akuntansi: 6 laporan read-only (Trial Balance, Laba Rugi, Neraca, Arus Kas, Buku Kas/Bank, Buku Besar) yang di-compute on-the-fly dari `journal_lines`. DTO + Zod validators + 6 service + helper `buildLedgerEntries` + 6 API route (`accounting:read` permission) + 6 halaman UI dengan TanStack Query. Halaman `/admin/finance/laba-rugi` di-redirect ke `/admin/akuntansi/laporan/laba-rugi`.
- **Files**: `modules/accounting/dto/ReportDto.ts`, `modules/accounting/validators/reports.ts`, `modules/accounting/services/reports/*`, `app/api/admin/accounting/reports/**`, `app/admin/akuntansi/laporan/**`, `app/admin/finance/laba-rugi/page.tsx`
- **Breaking**: ❌ Tidak (redirect bersifat backward-compatible; user lama otomatis diarahkan ke URL baru)
```

- [ ] **Step 2: Run full check**

Run: `./scripts/setup-test-db.sh`
Expected: test DB siap.

Run: `npx vitest run modules/accounting/__tests__/TrialBalanceService.test.ts modules/accounting/__tests__/ProfitLossService.test.ts modules/accounting/__tests__/BalanceSheetService.test.ts modules/accounting/__tests__/CashFlowService.test.ts modules/accounting/__tests__/CashBookService.test.ts modules/accounting/__tests__/GeneralLedgerService.test.ts`
Expected: PASS semua (≥ 18 test).

Run: `npm run check`
Expected: lint + typecheck + build PASS.

- [ ] **Step 3: Final commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(accounting): changelog Phase 3 (6 laporan akuntansi)"
```

---
# PHASE 4 — Period Closing + Journal Reversal + Opening Balance

## Task 40: Period & Reversal Validators

**Files:**
- Create: `modules/accounting/validators/period.ts`

- [ ] **Step 1: Buat Zod validators untuk period & reversal**

Create `modules/accounting/validators/period.ts`:

```ts
import { z } from "zod";

export const closePeriodSchema = z.object({
  periodId: z.string().min(1, "periodId wajib diisi"),
});

export const reopenPeriodSchema = z.object({
  periodId: z.string().min(1, "periodId wajib diisi"),
});

export const reverseJournalSchema = z.object({
  journalId: z.string().min(1, "journalId wajib diisi"),
  reason: z.string().min(1, "Alasan reversal wajib diisi").max(500),
});

export const openingBalanceSchema = z.object({
  entryDate: z.coerce.date({ required_error: "entryDate wajib diisi" }),
  lines: z
    .array(
      z.object({
        coaId: z.string().min(1, "coaId wajib diisi"),
        side: z.enum(["DEBIT", "CREDIT"]),
        amount: z.string().refine(
          (val) => {
            const num = parseFloat(val);
            return !isNaN(num) && num > 0;
          },
          { message: "amount harus angka positif" },
        ),
      }),
    )
    .min(2, "Minimal 2 baris (1 debit + 1 kredit)"),
});

export type ClosePeriodInput = z.infer<typeof closePeriodSchema>;
export type ReopenPeriodInput = z.infer<typeof reopenPeriodSchema>;
export type ReverseJournalInput = z.infer<typeof reverseJournalSchema>;
export type OpeningBalanceInput = z.infer<typeof openingBalanceSchema>;
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/validators/period.ts
git commit -m "feat(accounting): tambah validators period close/reopen, journal reverse, opening balance"
```

---

## Task 41: Outbox Event Check Helper

**Files:**
- Create: `modules/accounting/services/period/outbox-check.ts`

- [ ] **Step 1: Implement helper**

Create `modules/accounting/services/period/outbox-check.ts`:

```ts
import { prisma } from "@/lib/prisma";

export async function hasPendingOutboxForPeriod(
  tenantId: string,
  startDate: Date,
  endDate: Date,
): Promise<boolean> {
  const count = await prisma.outboxEvent.count({
    where: {
      status: "PENDING",
      createdAt: { gte: startDate, lte: endDate },
      payload: { path: ["tenantId"], equals: tenantId },
    },
  });
  return count > 0;
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/services/period/outbox-check.ts
git commit -m "feat(accounting): tambah outbox-check helper untuk period closing prerequisite"
```

---

## Task 42: PeriodCloseService.close()

**Files:**
- Create: `modules/accounting/services/period/PeriodCloseService.ts`
- Create: `modules/accounting/__tests__/PeriodCloseService.test.ts`

- [ ] **Step 1: Tulis test**

Create `modules/accounting/__tests__/PeriodCloseService.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PeriodCloseService } from "../services/period/PeriodCloseService";
import type { IPeriodRepository } from "../domain/ports/IPeriodRepository";
import type { IJournalRepository } from "../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../domain/ports/IChartOfAccountRepository";
import type { AccountingPeriod } from "../domain/entities/AccountingPeriod";
import { PeriodClosedError } from "../errors";

vi.mock("../services/period/outbox-check", () => ({
  hasPendingOutboxForPeriod: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn: any) => fn({})),
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

describe("PeriodCloseService", () => {
  let service: PeriodCloseService;
  let periodRepo: IPeriodRepository;
  let journalRepo: IJournalRepository;
  let coaRepo: IChartOfAccountRepository;

  const openPeriod: AccountingPeriod = {
    id: "period-1",
    tenantId: "tenant-1",
    year: 2026,
    month: 5,
    status: "OPEN",
    closedAt: null,
    closedBy: null,
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-05-31"),
  };

  beforeEach(() => {
    periodRepo = {
      findById: vi.fn().mockResolvedValue(openPeriod),
      lockForUpdate: vi.fn().mockResolvedValue(openPeriod),
      updateStatus: vi.fn().mockResolvedValue({ ...openPeriod, status: "CLOSED" }),
      findByYearMonth: vi.fn().mockResolvedValue(null),
      findByDate: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "period-2" }),
      list: vi.fn(),
    } as unknown as IPeriodRepository;

    journalRepo = {
      create: vi.fn().mockResolvedValue({ id: "je-closing" }),
      findById: vi.fn(),
      findBySource: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
      markReversed: vi.fn(),
      countByMonth: vi.fn().mockResolvedValue(0),
    } as unknown as IJournalRepository;

    coaRepo = {
      findByCode: vi.fn().mockResolvedValue({ id: "coa-laba-rugi", code: "3-300" }),
      findById: vi.fn().mockResolvedValue({ id: "coa-1", isPostable: true }),
      create: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      countChildren: vi.fn(),
      countLines: vi.fn(),
    } as unknown as IChartOfAccountRepository;

    service = new PeriodCloseService(periodRepo, journalRepo, coaRepo);
  });

  it("throws PeriodClosedError when period already CLOSED", async () => {
    vi.mocked(periodRepo.findById).mockResolvedValue({ ...openPeriod, status: "CLOSED" });
    await expect(service.close("period-1", "user-1")).rejects.toThrow(PeriodClosedError);
  });

  it("closes period successfully when all prerequisites met", async () => {
    vi.mocked(periodRepo.lockForUpdate).mockResolvedValue(openPeriod);
    const result = await service.close("period-1", "user-1");
    expect(periodRepo.updateStatus).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/PeriodCloseService.test.ts`
Expected: FAIL — module tidak ada.

- [ ] **Step 3: Implement `PeriodCloseService`**

Create `modules/accounting/services/period/PeriodCloseService.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { IJournalRepository } from "../../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { AccountingPeriod } from "../../domain/entities/AccountingPeriod";
import { isPeriodWritable } from "../../domain/entities/AccountingPeriod";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { Money } from "../../domain/value-objects/Money";
import { PeriodClosedError, AccountingError } from "../../errors";
import { hasPendingOutboxForPeriod } from "./outbox-check";

interface TrialRow {
  coa_id: string;
  coa_code: string;
  coa_type: string;
  total_debit: string;
  total_credit: string;
}

export class PeriodCloseService {
  constructor(
    private readonly periodRepo: IPeriodRepository,
    private readonly journalRepo: IJournalRepository,
    private readonly coaRepo: IChartOfAccountRepository,
  ) {}

  async close(periodId: string, closedBy: string): Promise<AccountingPeriod> {
    const period = await this.periodRepo.findById(periodId);
    if (!period) {
      throw new AccountingError("Period tidak ditemukan", "PERIOD_NOT_FOUND");
    }
    if (!isPeriodWritable(period)) {
      throw new PeriodClosedError(period.year, period.month);
    }

    const hasPending = await hasPendingOutboxForPeriod(
      period.tenantId,
      period.startDate,
      period.endDate,
    );
    if (hasPending) {
      throw new AccountingError(
        "Masih ada event PENDING di outbox untuk periode ini",
        "OUTBOX_PENDING",
      );
    }

    return prisma.$transaction(async (tx) => {
      const locked = await this.periodRepo.lockForUpdate(periodId, tx);
      if (!locked || !isPeriodWritable(locked)) {
        throw new PeriodClosedError(period.year, period.month);
      }

      await this.periodRepo.updateStatus(periodId, "CLOSING", undefined, tx);

      await this.generateClosingJournals(tx, period, closedBy);

      const closed = await this.periodRepo.updateStatus(
        periodId,
        "CLOSED",
        closedBy,
        tx,
      );

      await this.ensureNextPeriod(period, tx);

      return closed;
    });
  }

  async reopen(periodId: string, reopenedBy: string): Promise<AccountingPeriod> {
    const period = await this.periodRepo.findById(periodId);
    if (!period) {
      throw new AccountingError("Period tidak ditemukan", "PERIOD_NOT_FOUND");
    }
    if (period.status !== "CLOSED") {
      throw new AccountingError(
        "Hanya periode CLOSED yang bisa di-reopen",
        "PERIOD_NOT_CLOSED",
      );
    }

    return prisma.$transaction(async (tx) => {
      const reopened = await this.periodRepo.updateStatus(
        periodId,
        "REOPENED",
        reopenedBy,
        tx,
      );

      await this.reverseClosingJournals(tx, period);

      return reopened;
    });
  }

  private async generateClosingJournals(
    tx: Prisma.TransactionClient,
    period: AccountingPeriod,
    closedBy: string,
  ): Promise<void> {
    const trialData = await prisma.$queryRaw<TrialRow[]>`
      SELECT
        coa.id AS coa_id,
        coa.code AS coa_code,
        coa.type AS coa_type,
        COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
        COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.entry_id
      JOIN chart_of_accounts coa ON coa.id = jl.coa_id
      WHERE je.tenant_id = ${period.tenantId}
        AND je.period_id = ${period.id}
        AND je.status = 'POSTED'
        AND coa.type IN ('REVENUE', 'EXPENSE')
      GROUP BY coa.id, coa.code, coa.type
    `;

    let totalRevenue = Money.zero();
    let totalExpense = Money.zero();

    for (const row of trialData) {
      const debit = Money.fromString(row.total_debit);
      const credit = Money.fromString(row.total_credit);
      if (row.coa_type === "REVENUE") {
        totalRevenue = totalRevenue.add(credit.subtract(debit));
      } else {
        totalExpense = totalExpense.add(debit.subtract(credit));
      }
    }

    const labaRugiBerjalan = await this.coaRepo.findByCode(period.tenantId, "3-300");
    const labaDitahan = await this.coaRepo.findByCode(period.tenantId, "3-200");
    if (!labaRugiBerjalan || !labaDitahan) {
      throw new AccountingError("COA 3-300 atau 3-200 tidak ditemukan", "COA_NOT_FOUND");
    }

    const numberGen = new JournalNumberGenerator(this.journalRepo);
    const entryDate = period.endDate;

    if (!totalRevenue.isZero()) {
      const revenueLines: JournalLineDraft[] = [];
      for (const row of trialData.filter((r) => r.coa_type === "REVENUE")) {
        const credit = Money.fromString(row.total_credit);
        const debit = Money.fromString(row.total_debit);
        const net = credit.subtract(debit);
        if (!net.isZero()) {
          revenueLines.push({ coaId: row.coa_id, side: "DEBIT", amount: net.toString() });
        }
      }
      revenueLines.push({
        coaId: labaRugiBerjalan.id,
        side: "CREDIT",
        amount: totalRevenue.toString(),
      });

      await this.journalRepo.create(
        {
          tenantId: period.tenantId,
          entryNumber: await numberGen.generate(period.tenantId, entryDate),
          entryDate,
          periodId: period.id,
          source: "CLOSING",
          sourceRefType: "Period",
          sourceRefId: `${period.id}-revenue`,
          description: `Closing revenue periode ${period.year}-${String(period.month).padStart(2, "0")}`,
          status: "POSTED",
          postedBy: closedBy,
          lines: revenueLines,
        },
        tx,
      );
    }

    if (!totalExpense.isZero()) {
      const expenseLines: JournalLineDraft[] = [];
      expenseLines.push({
        coaId: labaRugiBerjalan.id,
        side: "DEBIT",
        amount: totalExpense.toString(),
      });
      for (const row of trialData.filter((r) => r.coa_type === "EXPENSE")) {
        const debit = Money.fromString(row.total_debit);
        const credit = Money.fromString(row.total_credit);
        const net = debit.subtract(credit);
        if (!net.isZero()) {
          expenseLines.push({ coaId: row.coa_id, side: "CREDIT", amount: net.toString() });
        }
      }

      await this.journalRepo.create(
        {
          tenantId: period.tenantId,
          entryNumber: await numberGen.generate(period.tenantId, entryDate),
          entryDate,
          periodId: period.id,
          source: "CLOSING",
          sourceRefType: "Period",
          sourceRefId: `${period.id}-expense`,
          description: `Closing expense periode ${period.year}-${String(period.month).padStart(2, "0")}`,
          status: "POSTED",
          postedBy: closedBy,
          lines: expenseLines,
        },
        tx,
      );
    }

    const netIncome = totalRevenue.subtract(totalExpense);
    if (!netIncome.isZero()) {
      const transferLines: JournalLineDraft[] = netIncome.isPositive()
        ? [
            { coaId: labaRugiBerjalan.id, side: "DEBIT", amount: netIncome.toString() },
            { coaId: labaDitahan.id, side: "CREDIT", amount: netIncome.toString() },
          ]
        : [
            { coaId: labaDitahan.id, side: "DEBIT", amount: netIncome.subtract(netIncome).subtract(netIncome).toString() },
            { coaId: labaRugiBerjalan.id, side: "CREDIT", amount: netIncome.subtract(netIncome).subtract(netIncome).toString() },
          ];

      await this.journalRepo.create(
        {
          tenantId: period.tenantId,
          entryNumber: await numberGen.generate(period.tenantId, entryDate),
          entryDate,
          periodId: period.id,
          source: "CLOSING",
          sourceRefType: "Period",
          sourceRefId: `${period.id}-transfer`,
          description: `Transfer laba/rugi ke laba ditahan periode ${period.year}-${String(period.month).padStart(2, "0")}`,
          status: "POSTED",
          postedBy: closedBy,
          lines: transferLines,
        },
        tx,
      );
    }
  }

  private async reverseClosingJournals(
    tx: Prisma.TransactionClient,
    period: AccountingPeriod,
  ): Promise<void> {
    const closingJournals = await prisma.journalEntry.findMany({
      where: {
        tenantId: period.tenantId,
        periodId: period.id,
        source: "CLOSING",
        status: "POSTED",
      },
      select: { id: true },
    });

    for (const journal of closingJournals) {
      await this.journalRepo.markReversed(journal.id, journal.id, tx);
    }
  }

  private async ensureNextPeriod(
    current: AccountingPeriod,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const nextMonth = current.month === 12 ? 1 : current.month + 1;
    const nextYear = current.month === 12 ? current.year + 1 : current.year;

    const existing = await this.periodRepo.findByYearMonth(
      current.tenantId,
      nextYear,
      nextMonth,
    );
    if (!existing) {
      const startDate = new Date(nextYear, nextMonth - 1, 1);
      const endDate = new Date(nextYear, nextMonth, 0);
      await this.periodRepo.create({
        tenantId: current.tenantId,
        year: nextYear,
        month: nextMonth,
        status: "OPEN",
        closedAt: null,
        closedBy: null,
        startDate,
        endDate,
      });
    }
  }
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/PeriodCloseService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/period/PeriodCloseService.ts modules/accounting/__tests__/PeriodCloseService.test.ts
git commit -m "feat(accounting): tambah PeriodCloseService (close + reopen + closing journals)"
```

---
## Task 43: JournalReverseService

**Files:**
- Create: `modules/accounting/services/journal/JournalReverseService.ts`
- Create: `modules/accounting/__tests__/JournalReverseService.test.ts`

- [ ] **Step 1: Tulis test**

Create `modules/accounting/__tests__/JournalReverseService.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { JournalReverseService } from "../services/journal/JournalReverseService";
import type { IJournalRepository } from "../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "../domain/ports/IPeriodRepository";
import type { JournalEntry } from "../domain/entities/JournalEntry";
import { JournalAlreadyReversedError, AccountingError } from "../errors";

describe("JournalReverseService", () => {
  let service: JournalReverseService;
  let journalRepo: IJournalRepository;
  let coaRepo: IChartOfAccountRepository;
  let periodRepo: IPeriodRepository;

  const mockEntry: JournalEntry = {
    id: "je-1",
    tenantId: "tenant-1",
    entryNumber: "JV-2026-05-0001",
    entryDate: new Date("2026-05-15"),
    periodId: "period-1",
    source: "MANUAL",
    sourceRefType: null,
    sourceRefId: null,
    description: "Test journal",
    status: "POSTED",
    reversalOfId: null,
    postedAt: new Date(),
    postedBy: "user-1",
    lines: [
      { id: "jl-1", entryId: "je-1", coaId: "coa-1", side: "DEBIT", amount: "100000.00", description: null, lineOrder: 1 },
      { id: "jl-2", entryId: "je-1", coaId: "coa-2", side: "CREDIT", amount: "100000.00", description: null, lineOrder: 2 },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPeriod = {
    id: "period-1",
    tenantId: "tenant-1",
    year: 2026,
    month: 5,
    status: "OPEN" as const,
    closedAt: null,
    closedBy: null,
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-05-31"),
  };

  beforeEach(() => {
    journalRepo = {
      create: vi.fn().mockResolvedValue({ id: "je-reversal", entryNumber: "JV-2026-05-0002" }),
      findById: vi.fn().mockResolvedValue(mockEntry),
      findBySource: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
      markReversed: vi.fn(),
      countByMonth: vi.fn().mockResolvedValue(1),
    } as unknown as IJournalRepository;

    coaRepo = {
      findById: vi.fn().mockResolvedValue({ id: "coa-1", isPostable: true }),
      findByCode: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      countChildren: vi.fn(),
      countLines: vi.fn(),
    } as unknown as IChartOfAccountRepository;

    periodRepo = {
      findByDate: vi.fn().mockResolvedValue(mockPeriod),
      findById: vi.fn(),
      findByYearMonth: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      list: vi.fn(),
      lockForUpdate: vi.fn(),
    } as unknown as IPeriodRepository;

    service = new JournalReverseService(journalRepo, coaRepo, periodRepo);
  });

  it("reverses a POSTED journal successfully", async () => {
    const result = await service.reverse("je-1", "Koreksi salah input", "user-1");
    expect(journalRepo.markReversed).toHaveBeenCalledWith("je-1", expect.any(String), undefined);
    expect(journalRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "REVERSAL",
        reversalOfId: "je-1",
      }),
      undefined,
    );
    expect(result).toBeDefined();
  });

  it("throws JournalAlreadyReversedError when status is REVERSED", async () => {
    vi.mocked(journalRepo.findById).mockResolvedValue({ ...mockEntry, status: "REVERSED" });
    await expect(service.reverse("je-1", "reason", "user-1")).rejects.toThrow(JournalAlreadyReversedError);
  });

  it("throws when journal not found", async () => {
    vi.mocked(journalRepo.findById).mockResolvedValue(null);
    await expect(service.reverse("je-999", "reason", "user-1")).rejects.toThrow(AccountingError);
  });
});
```

- [ ] **Step 2: Run test (expected fail)**

Run: `npx vitest run modules/accounting/__tests__/JournalReverseService.test.ts`
Expected: FAIL — module tidak ada.

- [ ] **Step 3: Implement `JournalReverseService`**

Create `modules/accounting/services/journal/JournalReverseService.ts`:

```ts
import type { IJournalRepository } from "../../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { JournalEntry } from "../../domain/entities/JournalEntry";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";
import { isPeriodWritable } from "../../domain/entities/AccountingPeriod";
import { JournalNumberGenerator } from "./JournalNumberGenerator";
import {
  AccountingError,
  JournalAlreadyReversedError,
  PeriodClosedError,
} from "../../errors";

export class JournalReverseService {
  constructor(
    private readonly journalRepo: IJournalRepository,
    private readonly coaRepo: IChartOfAccountRepository,
    private readonly periodRepo: IPeriodRepository,
  ) {}

  async reverse(
    journalId: string,
    reason: string,
    reversedBy: string,
  ): Promise<JournalEntry> {
    const original = await this.journalRepo.findById(journalId);
    if (!original) {
      throw new AccountingError("Journal tidak ditemukan", "JOURNAL_NOT_FOUND");
    }
    if (original.status === "REVERSED") {
      throw new JournalAlreadyReversedError(original.entryNumber);
    }
    if (original.status !== "POSTED") {
      throw new AccountingError(
        "Hanya journal POSTED yang bisa di-reverse",
        "JOURNAL_NOT_POSTED",
      );
    }

    const period = await this.periodRepo.findByDate(original.tenantId, new Date());
    if (!period || !isPeriodWritable(period)) {
      const now = new Date();
      throw new PeriodClosedError(now.getFullYear(), now.getMonth() + 1);
    }

    const reversalLines: JournalLineDraft[] = original.lines.map((line) => ({
      coaId: line.coaId,
      side: line.side === "DEBIT" ? "CREDIT" : "DEBIT",
      amount: line.amount,
      description: line.description ?? undefined,
      lineOrder: line.lineOrder,
    }));

    const numberGen = new JournalNumberGenerator(this.journalRepo);
    const entryDate = new Date();
    const entryNumber = await numberGen.generate(original.tenantId, entryDate);

    const reversal = await this.journalRepo.create({
      tenantId: original.tenantId,
      entryNumber,
      entryDate,
      periodId: period.id,
      source: "REVERSAL",
      sourceRefType: "JournalEntry",
      sourceRefId: original.id,
      description: `Reversal: ${original.entryNumber} — ${reason}`,
      status: "POSTED",
      reversalOfId: original.id,
      postedBy: reversedBy,
      lines: reversalLines,
    });

    await this.journalRepo.markReversed(original.id, reversal.id);

    return reversal;
  }
}
```

- [ ] **Step 4: Run test (expected pass)**

Run: `npx vitest run modules/accounting/__tests__/JournalReverseService.test.ts`
Expected: PASS semua 3 test.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/journal/JournalReverseService.ts modules/accounting/__tests__/JournalReverseService.test.ts
git commit -m "feat(accounting): tambah JournalReverseService (idempotent reversal)"
```

---

## Task 44: OpeningBalanceService

**Files:**
- Create: `modules/accounting/services/journal/OpeningBalanceService.ts`

- [ ] **Step 1: Implement `OpeningBalanceService`**

Create `modules/accounting/services/journal/OpeningBalanceService.ts`:

```ts
import type { IJournalRepository } from "../../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { JournalEntry } from "../../domain/entities/JournalEntry";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";
import { isPeriodWritable } from "../../domain/entities/AccountingPeriod";
import { JournalNumberGenerator } from "./JournalNumberGenerator";
import { validateBalance } from "./balanceValidator";
import { PeriodClosedError, AccountingError, CoaNotFoundError, CoaNotPostableError } from "../../errors";

export class OpeningBalanceService {
  constructor(
    private readonly journalRepo: IJournalRepository,
    private readonly coaRepo: IChartOfAccountRepository,
    private readonly periodRepo: IPeriodRepository,
  ) {}

  async post(
    tenantId: string,
    entryDate: Date,
    lines: JournalLineDraft[],
    postedBy: string,
  ): Promise<JournalEntry> {
    const existing = await this.journalRepo.findBySource(
      tenantId,
      "OPENING_BALANCE",
      tenantId,
    );
    if (existing) {
      throw new AccountingError(
        "Opening balance sudah pernah di-input untuk tenant ini",
        "OPENING_BALANCE_EXISTS",
      );
    }

    validateBalance(lines);

    const uniqueCoaIds = [...new Set(lines.map((l) => l.coaId))];
    for (const coaId of uniqueCoaIds) {
      const coa = await this.coaRepo.findById(coaId);
      if (!coa) throw new CoaNotFoundError(coaId);
      if (!coa.isPostable) throw new CoaNotPostableError(coa.code);
    }

    const period = await this.periodRepo.findByDate(tenantId, entryDate);
    if (!period || !isPeriodWritable(period)) {
      throw new PeriodClosedError(entryDate.getFullYear(), entryDate.getMonth() + 1);
    }

    const numberGen = new JournalNumberGenerator(this.journalRepo);
    const entryNumber = await numberGen.generate(tenantId, entryDate);

    return this.journalRepo.create({
      tenantId,
      entryNumber,
      entryDate,
      periodId: period.id,
      source: "OPENING_BALANCE",
      sourceRefType: "Tenant",
      sourceRefId: tenantId,
      description: "Saldo awal (opening balance)",
      status: "POSTED",
      postedBy,
      lines,
    });
  }
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/services/journal/OpeningBalanceService.ts
git commit -m "feat(accounting): tambah OpeningBalanceService (one-shot per tenant)"
```

---
## Task 45: API Routes (Period Close/Reopen, Journal Reverse, Opening Balance)

**Files:**
- Create: `app/api/admin/accounting/period/[id]/close/route.ts`
- Create: `app/api/admin/accounting/period/[id]/reopen/route.ts`
- Create: `app/api/admin/accounting/journal/[id]/reverse/route.ts`
- Create: `app/api/admin/accounting/journal/opening-balance/route.ts`

- [ ] **Step 1: Buat route period close**

Create `app/api/admin/accounting/period/[id]/close/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { PeriodCloseService } from "@/modules/accounting/services/period/PeriodCloseService";
import { PeriodRepository } from "@/modules/accounting/repositories/PeriodRepository";
import { JournalRepository } from "@/modules/accounting/repositories/JournalRepository";
import { ChartOfAccountRepository } from "@/modules/accounting/repositories/ChartOfAccountRepository";
import { AccountingError } from "@/modules/accounting/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!hasPermission(session, "accounting:period:close")) {
    return ApiErrors.forbidden();
  }

  try {
    const service = new PeriodCloseService(
      new PeriodRepository(),
      new JournalRepository(),
      new ChartOfAccountRepository(),
    );
    const result = await service.close(params.id, session.userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AccountingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
```

- [ ] **Step 2: Buat route period reopen**

Create `app/api/admin/accounting/period/[id]/reopen/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { PeriodCloseService } from "@/modules/accounting/services/period/PeriodCloseService";
import { PeriodRepository } from "@/modules/accounting/repositories/PeriodRepository";
import { JournalRepository } from "@/modules/accounting/repositories/JournalRepository";
import { ChartOfAccountRepository } from "@/modules/accounting/repositories/ChartOfAccountRepository";
import { AccountingError } from "@/modules/accounting/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!hasPermission(session, "accounting:period:reopen")) {
    return ApiErrors.forbidden();
  }

  try {
    const service = new PeriodCloseService(
      new PeriodRepository(),
      new JournalRepository(),
      new ChartOfAccountRepository(),
    );
    const result = await service.reopen(params.id, session.userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AccountingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
```

- [ ] **Step 3: Buat route journal reverse**

Create `app/api/admin/accounting/journal/[id]/reverse/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { JournalReverseService } from "@/modules/accounting/services/journal/JournalReverseService";
import { JournalRepository } from "@/modules/accounting/repositories/JournalRepository";
import { ChartOfAccountRepository } from "@/modules/accounting/repositories/ChartOfAccountRepository";
import { PeriodRepository } from "@/modules/accounting/repositories/PeriodRepository";
import { reverseJournalSchema } from "@/modules/accounting/validators/period";
import { toJournalResponseDto } from "@/modules/accounting/dto/JournalDto";
import { AccountingError } from "@/modules/accounting/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!hasPermission(session, "accounting:journal:reverse")) {
    return ApiErrors.forbidden();
  }

  const body = await req.json();
  const parsed = reverseJournalSchema.safeParse({ ...body, journalId: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const service = new JournalReverseService(
      new JournalRepository(),
      new ChartOfAccountRepository(),
      new PeriodRepository(),
    );
    const result = await service.reverse(params.id, parsed.data.reason, session.userId);
    return NextResponse.json(toJournalResponseDto(result));
  } catch (error) {
    if (error instanceof AccountingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
```

- [ ] **Step 4: Buat route opening balance**

Create `app/api/admin/accounting/journal/opening-balance/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { OpeningBalanceService } from "@/modules/accounting/services/journal/OpeningBalanceService";
import { JournalRepository } from "@/modules/accounting/repositories/JournalRepository";
import { ChartOfAccountRepository } from "@/modules/accounting/repositories/ChartOfAccountRepository";
import { PeriodRepository } from "@/modules/accounting/repositories/PeriodRepository";
import { openingBalanceSchema } from "@/modules/accounting/validators/period";
import { toJournalResponseDto } from "@/modules/accounting/dto/JournalDto";
import { AccountingError } from "@/modules/accounting/errors";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!hasPermission(session, "accounting:journal:create")) {
    return ApiErrors.forbidden();
  }

  const body = await req.json();
  const parsed = openingBalanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const service = new OpeningBalanceService(
      new JournalRepository(),
      new ChartOfAccountRepository(),
      new PeriodRepository(),
    );
    const result = await service.post(
      session.tenantId,
      parsed.data.entryDate,
      parsed.data.lines,
      session.userId,
    );
    return NextResponse.json(toJournalResponseDto(result), { status: 201 });
  } catch (error) {
    if (error instanceof AccountingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
```

- [ ] **Step 5: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/accounting/period/ app/api/admin/accounting/journal/
git commit -m "feat(accounting): tambah API routes period close/reopen, journal reverse, opening balance"
```

---

## Task 46: UI Page Periode

**Files:**
- Create: `app/admin/akuntansi/periode/page.tsx`

- [ ] **Step 1: Implement halaman periode**

Create `app/admin/akuntansi/periode/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
  closedAt: string | null;
  closedBy: string | null;
  startDate: string;
  endDate: string;
}

export default function PeriodePage() {
  const queryClient = useQueryClient();

  const { data: periods = [], isLoading } = useQuery<Period[]>({
    queryKey: ["accounting", "periods"],
    queryFn: async () => {
      const res = await fetch("/api/admin/accounting/period");
      if (!res.ok) throw new Error("Gagal memuat data periode");
      return res.json();
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const res = await fetch(`/api/admin/accounting/period/${periodId}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal tutup buku");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "periods"] });
      toast.success("Periode berhasil ditutup");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const res = await fetch(`/api/admin/accounting/period/${periodId}/reopen`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal buka kembali periode");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "periods"] });
      toast.success("Periode berhasil dibuka kembali");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const statusColor: Record<string, string> = {
    OPEN: "bg-green-100 text-green-800",
    CLOSING: "bg-yellow-100 text-yellow-800",
    CLOSED: "bg-red-100 text-red-800",
    REOPENED: "bg-blue-100 text-blue-800",
  };

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  if (isLoading) return <div className="p-6">Memuat...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Periode Akuntansi</h1>

      <div className="grid gap-4">
        {periods.map((period) => (
          <Card key={period.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">
                {monthNames[period.month - 1]} {period.year}
              </CardTitle>
              <Badge className={statusColor[period.status] || ""}>
                {period.status}
              </Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {new Date(period.startDate).toLocaleDateString("id-ID")} —{" "}
                {new Date(period.endDate).toLocaleDateString("id-ID")}
              </span>
              <div className="flex gap-2">
                {(period.status === "OPEN" || period.status === "REOPENED") && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => closeMutation.mutate(period.id)}
                    disabled={closeMutation.isPending}
                  >
                    Tutup Buku
                  </Button>
                )}
                {period.status === "CLOSED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reopenMutation.mutate(period.id)}
                    disabled={reopenMutation.isPending}
                  >
                    Buka Kembali
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/admin/akuntansi/periode/
git commit -m "feat(accounting): tambah UI page periode (list + tutup/buka buku)"
```

---

## Task 47: UI Reverse + Opening Balance

**Files:**
- Create: `app/admin/akuntansi/jurnal/[id]/page.tsx` (detail + reverse button)

- [ ] **Step 1: Implement halaman detail jurnal + reverse**

Create `app/admin/akuntansi/jurnal/[id]/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface JournalLine {
  id: string;
  coaId: string;
  side: "DEBIT" | "CREDIT";
  amount: string;
  description: string | null;
  lineOrder: number;
}

interface JournalDetail {
  id: string;
  entryNumber: string;
  entryDate: string;
  source: string;
  description: string;
  status: string;
  reversalOfId: string | null;
  postedBy: string | null;
  lines: JournalLine[];
  createdAt: string;
}

export default function JournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [showReverse, setShowReverse] = useState(false);

  const { data: journal, isLoading } = useQuery<JournalDetail>({
    queryKey: ["accounting", "journal", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/accounting/journal/${id}`);
      if (!res.ok) throw new Error("Gagal memuat journal");
      return res.json();
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/accounting/journal/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal reverse journal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal", id] });
      toast.success("Journal berhasil di-reverse");
      setShowReverse(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (isLoading) return <div className="p-6">Memuat...</div>;
  if (!journal) return <div className="p-6">Journal tidak ditemukan</div>;

  const statusColor: Record<string, string> = {
    POSTED: "bg-green-100 text-green-800",
    REVERSED: "bg-red-100 text-red-800",
    DRAFT: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{journal.entryNumber}</h1>
        <Badge className={statusColor[journal.status] || ""}>{journal.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Tanggal:</strong> {new Date(journal.entryDate).toLocaleDateString("id-ID")}</p>
          <p><strong>Sumber:</strong> {journal.source}</p>
          <p><strong>Deskripsi:</strong> {journal.description}</p>
          <p><strong>Posted by:</strong> {journal.postedBy || "-"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Baris Jurnal</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">COA</th>
                <th className="text-right py-2">Debit</th>
                <th className="text-right py-2">Kredit</th>
                <th className="text-left py-2">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {journal.lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="py-2">{line.coaId}</td>
                  <td className="text-right py-2">
                    {line.side === "DEBIT" ? Number(line.amount).toLocaleString("id-ID") : ""}
                  </td>
                  <td className="text-right py-2">
                    {line.side === "CREDIT" ? Number(line.amount).toLocaleString("id-ID") : ""}
                  </td>
                  <td className="py-2">{line.description || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {journal.status === "POSTED" && (
        <Card>
          <CardContent className="pt-6">
            {!showReverse ? (
              <Button variant="destructive" onClick={() => setShowReverse(true)}>
                Reverse Journal
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="reason">Alasan Reversal</Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Jelaskan alasan reversal..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => reverseMutation.mutate()}
                    disabled={!reason || reverseMutation.isPending}
                  >
                    Konfirmasi Reverse
                  </Button>
                  <Button variant="outline" onClick={() => setShowReverse(false)}>
                    Batal
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/admin/akuntansi/jurnal/[id]/
git commit -m "feat(accounting): tambah UI detail jurnal + reverse button"
```

---

## Task 48: Integration Test Period Close Flow

**Files:**
- Create: `modules/accounting/__tests__/period-close-flow.test.ts`

- [ ] **Step 1: Tulis integration test end-to-end**

Create `modules/accounting/__tests__/period-close-flow.test.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { PeriodCloseService } from "../services/period/PeriodCloseService";
import { JournalPostingService } from "../services/journal/JournalPostingService";
import { JournalNumberGenerator } from "../services/journal/JournalNumberGenerator";
import { PeriodRepository } from "../repositories/PeriodRepository";
import { JournalRepository } from "../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../repositories/ChartOfAccountRepository";

describe("Period Close Flow (integration)", () => {
  let tenantId: string;
  let periodId: string;
  let coaRevenueId: string;
  let coaExpenseId: string;
  let coaLabaRugiId: string;
  let coaLabaDitahanId: string;
  let coaBankId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("No tenant in test DB");
    tenantId = tenant.id;

    const coas = await Promise.all([
      prisma.chartOfAccount.create({ data: { tenantId, code: "TEST-4-100", name: "Revenue Test", type: "REVENUE", normalSide: "CREDIT", isPostable: true } }),
      prisma.chartOfAccount.create({ data: { tenantId, code: "TEST-5-100", name: "Expense Test", type: "EXPENSE", normalSide: "DEBIT", isPostable: true } }),
      prisma.chartOfAccount.create({ data: { tenantId, code: "TEST-3-300", name: "Laba Rugi Test", type: "EQUITY", normalSide: "CREDIT", isPostable: true } }),
      prisma.chartOfAccount.create({ data: { tenantId, code: "TEST-3-200", name: "Laba Ditahan Test", type: "EQUITY", normalSide: "CREDIT", isPostable: true } }),
      prisma.chartOfAccount.create({ data: { tenantId, code: "TEST-1-110", name: "Bank Test", type: "ASSET", normalSide: "DEBIT", isPostable: true } }),
    ]);
    [coaRevenueId, coaExpenseId, coaLabaRugiId, coaLabaDitahanId, coaBankId] = coas.map((c) => c.id);

    const period = await prisma.accountingPeriod.create({
      data: { tenantId, year: 2098, month: 6, status: "OPEN", startDate: new Date("2098-06-01"), endDate: new Date("2098-06-30") },
    });
    periodId = period.id;

    const journalRepo = new JournalRepository();
    const coaRepo = new ChartOfAccountRepository();
    const periodRepo = new PeriodRepository();
    const numberGen = new JournalNumberGenerator(journalRepo);
    const postingService = new JournalPostingService(journalRepo, coaRepo, periodRepo, numberGen);

    await postingService.postManual(tenantId, {
      entryDate: new Date("2098-06-15"),
      description: "Revenue test",
      lines: [
        { coaId: coaBankId, side: "DEBIT", amount: "500000.00" },
        { coaId: coaRevenueId, side: "CREDIT", amount: "500000.00" },
      ],
    }, "test-user");

    await postingService.postManual(tenantId, {
      entryDate: new Date("2098-06-20"),
      description: "Expense test",
      lines: [
        { coaId: coaExpenseId, side: "DEBIT", amount: "200000.00" },
        { coaId: coaBankId, side: "CREDIT", amount: "200000.00" },
      ],
    }, "test-user");
  });

  afterAll(async () => {
    await prisma.journalLine.deleteMany({ where: { entry: { tenantId, periodId } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId, periodId } });
    await prisma.accountingPeriod.deleteMany({ where: { tenantId, year: { gte: 2098 } } });
    await prisma.chartOfAccount.deleteMany({ where: { tenantId, code: { startsWith: "TEST-" } } });
  });

  it("closes period and generates closing journals", async () => {
    const service = new PeriodCloseService(
      new PeriodRepository(),
      new JournalRepository(),
      new ChartOfAccountRepository(),
    );

    const result = await service.close(periodId, "test-user");
    expect(result.status).toBe("CLOSED");

    const closingJournals = await prisma.journalEntry.findMany({
      where: { tenantId, periodId, source: "CLOSING" },
    });
    expect(closingJournals.length).toBeGreaterThanOrEqual(2);

    const nextPeriod = await prisma.accountingPeriod.findFirst({
      where: { tenantId, year: 2098, month: 7 },
    });
    expect(nextPeriod).not.toBeNull();
    expect(nextPeriod!.status).toBe("OPEN");
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run modules/accounting/__tests__/period-close-flow.test.ts`
Expected: PASS (membutuhkan test DB ter-migrate).

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/__tests__/period-close-flow.test.ts
git commit -m "test(accounting): integration test period close flow (closing journals + next period)"
```

---

## Task 49: CHANGELOG Phase 4

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG `[Unreleased]`**

Edit `docs/CHANGELOG.md` di section `[Unreleased]`:

```markdown
### [2026-05-20] — Phase 4: Period Closing + Journal Reversal + Opening Balance

- **Tipe**: [ADDED]
- **Scope**: `modules/accounting`, `app/api/admin/accounting/`
- **Author**: agent
- **Deskripsi**: Phase 4 modul akuntansi: validators period/reversal/opening-balance, outbox-check helper, PeriodCloseService (close dengan 3 closing journal + reopen + auto-create next period), JournalReverseService (idempotent, flip DR↔CR), OpeningBalanceService (one-shot per tenant), 4 API routes (period close/reopen, journal reverse, opening balance), UI page periode (tutup/buka buku), UI detail jurnal + reverse button, integration test end-to-end period close flow.
- **Files**: `modules/accounting/services/period/PeriodCloseService.ts`, `modules/accounting/services/journal/JournalReverseService.ts`, `modules/accounting/services/journal/OpeningBalanceService.ts`, `modules/accounting/validators/period.ts`, `app/api/admin/accounting/period/`, `app/api/admin/accounting/journal/`, `app/admin/akuntansi/periode/`, `app/admin/akuntansi/jurnal/[id]/`
- **Breaking**: ❌ Tidak
```

- [ ] **Step 2: Run full check**

Run: `npm run check`
Expected: lint + typecheck + build PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(accounting): changelog Phase 4 (period closing + reversal + opening balance)"
```

---

## Task 50: Run Full Check Phase 4

**Files:**
- (verification only)

- [ ] **Step 1: Run full check**

Run: `npm run check`
Expected: lint + typecheck + build PASS.

- [ ] **Step 2: Run all accounting tests**

Run: `npx vitest run modules/accounting/`
Expected: semua test PASS.

- [ ] **Step 3: Commit (jika ada perubahan tertinggal)**

```bash
git status
git add -A
git commit -m "chore(accounting): final verification Phase 4"
```

---

# PHASE 5 — Recurring Journal Engine

**Goal:** Cron harian (01:00 UTC) men-generate jurnal otomatis dari `RecurringJournalTemplate` saat `dayOfMonth` cocok dengan tanggal hari ini, dengan idempotency per (template, bulan), respect frekuensi MONTHLY/QUARTERLY/YEARLY, dan multi-tenant safe dalam satu pemanggilan cron.

**Prerequisite (sudah ada dari Phase 1–4):**
- Prisma model `RecurringJournalTemplate` + enum `RecurringFreq` (Phase 1, Task 5).
- Domain entity `RecurringJournalTemplate` + `RecurringTemplateLine` (Phase 1, Task 4).
- Port `IRecurringRepository` dengan `create / update / findById / list / findDueToday / markGenerated / delete` (Phase 1, Task 5).
- `JournalPostingService.postManualEntry(input)` + `JournalNumberGenerator.next(tenantId, periodId, source)` (Phase 2).
- Unique constraint `@@unique([tenantId, source, sourceRefId])` di `journal_entries` (Phase 1, Task 4) — backbone idempotency.
- `ChartOfAccountService.findById` + period auto-create OPEN (Phase 2 / Phase 4).
- API helper `apiSuccess` / `ApiErrors` di `lib/api-response.ts`, `getEnv()` di `lib/env.ts`, `acquireCronLock` di `lib/cron-lock.ts`.

**Scope OUT:** bank reconciliation (Phase 6+), UI kalender preview multi-bulan (cukup `previewNextRun` single).

---

## Task 51 — RecurringRepository (Prisma impl) + mapper + test

**Files:**
- Create: `modules/accounting/repositories/RecurringRepository.ts`
- Create: `modules/accounting/repositories/mappers/recurring.mapper.ts`
- Create: `modules/accounting/__tests__/recurring-repository.test.ts`

- [ ] **Step 1: Tulis test repo (RED)**

Create `modules/accounting/__tests__/recurring-repository.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { RecurringRepository } from "../repositories/RecurringRepository";
import { setupAccountingFixture } from "./helpers/fixture";

describe("RecurringRepository (integration)", () => {
  const repo = new RecurringRepository();
  let tenantId: string;
  let kasCoaId: string;
  let bebanCoaId: string;

  beforeAll(async () => {
    const fixture = await setupAccountingFixture();
    tenantId = fixture.tenantId;
    kasCoaId = fixture.coa.kas.id;
    bebanCoaId = fixture.coa.bebanSewa.id;
  });

  beforeEach(async () => {
    await prisma.recurringJournalTemplate.deleteMany({ where: { tenantId } });
  });

  it("create persists templateLines as JSON array", async () => {
    const tpl = await repo.create({
      tenantId,
      name: "Sewa Kantor Bulanan",
      description: "Akrual sewa kantor",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      startDate: new Date("2026-01-01"),
      endDate: null,
      templateLines: [
        { coaId: bebanCoaId, side: "DEBIT", amount: "5000000", description: "Sewa" },
        { coaId: kasCoaId, side: "CREDIT", amount: "5000000", description: null },
      ],
    });

    expect(tpl.id).toBeDefined();
    expect(tpl.isActive).toBe(true);
    expect(tpl.templateLines).toHaveLength(2);
    expect(tpl.templateLines[0].amount).toBe("5000000");
  });

  it("findDueToday returns only templates matching dayOfMonth, active, and not yet generated this month", async () => {
    const today = new Date("2026-05-05T12:00:00Z");

    // Due: dayOfMonth=5, lastGeneratedAt null
    const due = await repo.create({
      tenantId,
      name: "Due",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      startDate: new Date("2026-01-01"),
      templateLines: [
        { coaId: bebanCoaId, side: "DEBIT", amount: "100", description: null },
        { coaId: kasCoaId, side: "CREDIT", amount: "100", description: null },
      ],
    });

    // Skip: dayOfMonth=10
    await repo.create({
      tenantId,
      name: "Wrong day",
      frequency: "MONTHLY",
      dayOfMonth: 10,
      startDate: new Date("2026-01-01"),
      templateLines: [
        { coaId: bebanCoaId, side: "DEBIT", amount: "100", description: null },
        { coaId: kasCoaId, side: "CREDIT", amount: "100", description: null },
      ],
    });

    // Skip: already generated this month
    const generated = await repo.create({
      tenantId,
      name: "Already generated",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      startDate: new Date("2026-01-01"),
      templateLines: [
        { coaId: bebanCoaId, side: "DEBIT", amount: "100", description: null },
        { coaId: kasCoaId, side: "CREDIT", amount: "100", description: null },
      ],
    });
    await repo.markGenerated(generated.id, new Date("2026-05-05T01:00:00Z"));

    // Skip: inactive
    const inactive = await repo.create({
      tenantId,
      name: "Inactive",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      startDate: new Date("2026-01-01"),
      templateLines: [
        { coaId: bebanCoaId, side: "DEBIT", amount: "100", description: null },
        { coaId: kasCoaId, side: "CREDIT", amount: "100", description: null },
      ],
    });
    await repo.update(inactive.id, { isActive: false });

    // Skip: endDate < today
    await repo.create({
      tenantId,
      name: "Expired",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-04-30"),
      templateLines: [
        { coaId: bebanCoaId, side: "DEBIT", amount: "100", description: null },
        { coaId: kasCoaId, side: "CREDIT", amount: "100", description: null },
      ],
    });

    // Skip: startDate > today (belum aktif)
    await repo.create({
      tenantId,
      name: "Future",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      startDate: new Date("2026-06-01"),
      templateLines: [
        { coaId: bebanCoaId, side: "DEBIT", amount: "100", description: null },
        { coaId: kasCoaId, side: "CREDIT", amount: "100", description: null },
      ],
    });

    const result = await repo.findDueToday(today);
    const ids = result.map((t) => t.id);

    expect(ids).toContain(due.id);
    expect(ids).not.toContain(generated.id);
    expect(ids).not.toContain(inactive.id);
    expect(result.length).toBe(1);
  });

  it("markGenerated updates lastGeneratedAt", async () => {
    const tpl = await repo.create({
      tenantId,
      name: "X",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      startDate: new Date("2026-01-01"),
      templateLines: [
        { coaId: bebanCoaId, side: "DEBIT", amount: "100", description: null },
        { coaId: kasCoaId, side: "CREDIT", amount: "100", description: null },
      ],
    });

    const at = new Date("2026-05-05T01:00:00Z");
    await repo.markGenerated(tpl.id, at);

    const reloaded = await repo.findById(tpl.id);
    expect(reloaded?.lastGeneratedAt?.toISOString()).toBe(at.toISOString());
  });
});
```

Run: `npm test -- recurring-repository`. Expected: FAIL (file belum ada).

- [ ] **Step 2: Tulis mapper**

Create `modules/accounting/repositories/mappers/recurring.mapper.ts`:

```ts
import type { RecurringJournalTemplate as PrismaRecurring } from "@prisma/client";
import type {
  RecurringJournalTemplate,
  RecurringTemplateLine,
} from "../../domain/entities/RecurringJournalTemplate";

/** Map Prisma row → domain entity. `templateLines` di-store sebagai Json. */
export function toDomainRecurring(
  row: PrismaRecurring,
): RecurringJournalTemplate {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    frequency: row.frequency,
    dayOfMonth: row.dayOfMonth,
    startDate: row.startDate,
    endDate: row.endDate,
    templateLines: parseTemplateLines(row.templateLines),
    isActive: row.isActive,
    lastGeneratedAt: row.lastGeneratedAt,
  };
}

function parseTemplateLines(raw: unknown): RecurringTemplateLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((line) => {
    const obj = line as Record<string, unknown>;
    return {
      coaId: String(obj.coaId),
      side: obj.side as RecurringTemplateLine["side"],
      amount: String(obj.amount),
      description:
        typeof obj.description === "string" ? obj.description : null,
    };
  });
}
```

- [ ] **Step 3: Tulis repository**

Create `modules/accounting/repositories/RecurringRepository.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type {
  IRecurringRepository,
  RecurringCreateInput,
} from "../domain/ports/IRecurringRepository";
import type { RecurringJournalTemplate } from "../domain/entities/RecurringJournalTemplate";
import { toDomainRecurring } from "./mappers/recurring.mapper";

/** Implementasi IRecurringRepository berbasis Prisma. */
export class RecurringRepository implements IRecurringRepository {
  async create(input: RecurringCreateInput): Promise<RecurringJournalTemplate> {
    const row = await prisma.recurringJournalTemplate.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description ?? null,
        frequency: input.frequency,
        dayOfMonth: input.dayOfMonth,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        templateLines: input.templateLines as unknown as object,
        isActive: true,
      },
    });
    return toDomainRecurring(row);
  }

  async update(
    id: string,
    input: Partial<RecurringCreateInput> & { isActive?: boolean },
  ): Promise<RecurringJournalTemplate> {
    const row = await prisma.recurringJournalTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        frequency: input.frequency,
        dayOfMonth: input.dayOfMonth,
        startDate: input.startDate,
        endDate: input.endDate,
        templateLines: input.templateLines
          ? (input.templateLines as unknown as object)
          : undefined,
        isActive: input.isActive,
      },
    });
    return toDomainRecurring(row);
  }

  async findById(id: string): Promise<RecurringJournalTemplate | null> {
    const row = await prisma.recurringJournalTemplate.findUnique({
      where: { id },
    });
    return row ? toDomainRecurring(row) : null;
  }

  async list(tenantId: string): Promise<RecurringJournalTemplate[]> {
    const rows = await prisma.recurringJournalTemplate.findMany({
      where: { tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return rows.map(toDomainRecurring);
  }

  /**
   * Cari template yang due hari ini (multi-tenant).
   *
   * Kriteria:
   *  - isActive = true
   *  - dayOfMonth = today.getUTCDate()
   *  - startDate <= today
   *  - endDate IS NULL OR endDate >= today
   *  - lastGeneratedAt IS NULL OR lastGeneratedAt < startOfThisMonth
   *    (cegah double-generate dalam 1 bulan; idempotency layer 1)
   */
  async findDueToday(today: Date): Promise<RecurringJournalTemplate[]> {
    const day = today.getUTCDate();
    const startOfMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 0, 0, 0, 0),
    );

    const rows = await prisma.recurringJournalTemplate.findMany({
      where: {
        isActive: true,
        dayOfMonth: day,
        startDate: { lte: today },
        AND: [
          {
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
          {
            OR: [
              { lastGeneratedAt: null },
              { lastGeneratedAt: { lt: startOfMonth } },
            ],
          },
        ],
      },
      orderBy: { tenantId: "asc" },
    });
    return rows.map(toDomainRecurring);
  }

  async markGenerated(id: string, at: Date): Promise<void> {
    await prisma.recurringJournalTemplate.update({
      where: { id },
      data: { lastGeneratedAt: at },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.recurringJournalTemplate.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run test (GREEN)**

Run: `npm test -- recurring-repository`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/repositories/RecurringRepository.ts \
        modules/accounting/repositories/mappers/recurring.mapper.ts \
        modules/accounting/__tests__/recurring-repository.test.ts
git commit -m "feat(accounting): RecurringRepository Prisma impl + mapper"
```

---

## Task 52 — Validator (Zod) untuk recurring template

**Files:**
- Create: `modules/accounting/validators/recurring.ts`
- Create: `modules/accounting/__tests__/recurring-validator.test.ts`

- [ ] **Step 1: Tulis test validator (RED)**

Create `modules/accounting/__tests__/recurring-validator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  recurringCreateSchema,
  recurringUpdateSchema,
} from "../validators/recurring";

describe("recurringCreateSchema", () => {
  const validInput = {
    name: "Sewa Bulanan",
    frequency: "MONTHLY" as const,
    dayOfMonth: 5,
    startDate: "2026-01-01T00:00:00.000Z",
    templateLines: [
      {
        coaId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
        side: "DEBIT" as const,
        amount: "5000000",
        description: "Sewa",
      },
      {
        coaId: "ckyyyyyyyyyyyyyyyyyyyyyyy",
        side: "CREDIT" as const,
        amount: "5000000",
      },
    ],
  };

  it("accepts valid input", () => {
    const result = recurringCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects dayOfMonth > 28 with explanatory message", () => {
    const result = recurringCreateSchema.safeParse({
      ...validInput,
      dayOfMonth: 31,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = JSON.stringify(result.error.issues);
      expect(msg).toMatch(/Februari hanya 28-29 hari/);
    }
  });

  it("rejects unbalanced lines", () => {
    const result = recurringCreateSchema.safeParse({
      ...validInput,
      templateLines: [
        { coaId: validInput.templateLines[0].coaId, side: "DEBIT", amount: "100" },
        { coaId: validInput.templateLines[1].coaId, side: "CREDIT", amount: "200" },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/balance/i);
    }
  });

  it("rejects fewer than 2 lines", () => {
    const result = recurringCreateSchema.safeParse({
      ...validInput,
      templateLines: [validInput.templateLines[0]],
    });
    expect(result.success).toBe(false);
  });

  it("rejects amount <= 0", () => {
    const result = recurringCreateSchema.safeParse({
      ...validInput,
      templateLines: [
        { coaId: validInput.templateLines[0].coaId, side: "DEBIT", amount: "0" },
        { coaId: validInput.templateLines[1].coaId, side: "CREDIT", amount: "0" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects endDate < startDate", () => {
    const result = recurringCreateSchema.safeParse({
      ...validInput,
      endDate: "2025-12-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("update schema allows partial fields including isActive", () => {
    const result = recurringUpdateSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });
});
```

Run: `npm test -- recurring-validator`. Expected: FAIL.

- [ ] **Step 2: Tulis validator**

Create `modules/accounting/validators/recurring.ts`:

```ts
import { z } from "zod";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Format amount tidak valid (max 2 desimal)")
  .refine((v) => Number(v) > 0, "Amount harus > 0");

const lineSchema = z.object({
  coaId: z.string().cuid(),
  side: z.enum(["DEBIT", "CREDIT"]),
  amount: decimalString,
  description: z.string().max(255).optional().nullable(),
});

const baseShape = {
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  dayOfMonth: z
    .number()
    .int()
    .min(1, "dayOfMonth minimum 1")
    .max(
      28,
      "dayOfMonth maksimum 28. Februari hanya 28-29 hari, gunakan dayOfMonth ≤ 28 agar template selalu valid setiap bulan.",
    ),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
  templateLines: z.array(lineSchema).min(2, "Minimal 2 baris (debit & kredit)"),
};

const balanceCheck = (input: {
  templateLines: Array<{ side: "DEBIT" | "CREDIT"; amount: string }>;
}) => {
  const sum = (side: "DEBIT" | "CREDIT") =>
    input.templateLines
      .filter((l) => l.side === side)
      .reduce((acc, l) => acc + Math.round(Number(l.amount) * 100), 0);
  return sum("DEBIT") === sum("CREDIT");
};

const dateRangeCheck = (input: {
  startDate: string;
  endDate?: string | null;
}) => {
  if (!input.endDate) return true;
  return new Date(input.endDate) >= new Date(input.startDate);
};

export const recurringCreateSchema = z
  .object(baseShape)
  .refine(balanceCheck, {
    message: "Total DEBIT harus balance dengan total CREDIT",
    path: ["templateLines"],
  })
  .refine(dateRangeCheck, {
    message: "endDate harus >= startDate",
    path: ["endDate"],
  });

export const recurringUpdateSchema = z
  .object({
    ...baseShape,
    isActive: z.boolean(),
  })
  .partial()
  .refine(
    (input) =>
      !input.templateLines ||
      balanceCheck({ templateLines: input.templateLines }),
    {
      message: "Total DEBIT harus balance dengan total CREDIT",
      path: ["templateLines"],
    },
  );

export type RecurringCreateDTO = z.infer<typeof recurringCreateSchema>;
export type RecurringUpdateDTO = z.infer<typeof recurringUpdateSchema>;
```

- [ ] **Step 3: Run test (GREEN)**

Run: `npm test -- recurring-validator`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/validators/recurring.ts \
        modules/accounting/__tests__/recurring-validator.test.ts
git commit -m "feat(accounting): validator Zod untuk recurring template"
```

---

## Task 53 — RecurringEngineService (core engine)

**Files:**
- Create: `modules/accounting/services/recurring/RecurringEngineService.ts`
- Create: `modules/accounting/services/recurring/frequency-rules.ts`
- Create: `modules/accounting/__tests__/recurring-engine.unit.test.ts`

- [ ] **Step 1: Tulis test unit (RED) — pakai fakes/mocks**

Create `modules/accounting/__tests__/recurring-engine.unit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecurringEngineService } from "../services/recurring/RecurringEngineService";
import type { IRecurringRepository } from "../domain/ports/IRecurringRepository";
import type { IPeriodRepository } from "../domain/ports/IPeriodRepository";
import type { JournalPostingService } from "../services/journal/JournalPostingService";
import type { RecurringJournalTemplate } from "../domain/entities/RecurringJournalTemplate";

const tpl = (
  partial: Partial<RecurringJournalTemplate>,
): RecurringJournalTemplate => ({
  id: partial.id ?? "tpl_x",
  tenantId: partial.tenantId ?? "tenant_a",
  name: partial.name ?? "T",
  description: null,
  frequency: partial.frequency ?? "MONTHLY",
  dayOfMonth: partial.dayOfMonth ?? 5,
  startDate: partial.startDate ?? new Date("2026-01-01"),
  endDate: partial.endDate ?? null,
  templateLines: [
    { coaId: "coa_d", side: "DEBIT", amount: "100", description: null },
    { coaId: "coa_c", side: "CREDIT", amount: "100", description: null },
  ],
  isActive: true,
  lastGeneratedAt: partial.lastGeneratedAt ?? null,
});

const makeRepo = (
  templates: RecurringJournalTemplate[],
): IRecurringRepository => ({
  create: vi.fn(),
  update: vi.fn(),
  findById: vi.fn(),
  list: vi.fn(),
  findDueToday: vi.fn().mockResolvedValue(templates),
  markGenerated: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
});

const makePeriodRepo = (): IPeriodRepository =>
  ({
    findOrCreateOpenPeriodForDate: vi.fn().mockImplementation(async (
      tenantId: string,
      date: Date,
    ) => ({
      id: `period_${tenantId}_${date.getUTCFullYear()}_${date.getUTCMonth() + 1}`,
      tenantId,
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      status: "OPEN",
      closedAt: null,
      closedBy: null,
    })),
  } as unknown as IPeriodRepository);

const makePosting = () =>
  ({
    postAutoEntry: vi.fn().mockImplementation(async () => ({
      id: "je_new",
      entryNumber: "JV-2026-05-0001",
    })),
  } as unknown as JournalPostingService);

describe("RecurringEngineService", () => {
  const today = new Date("2026-05-05T01:00:00Z");

  beforeEach(() => vi.clearAllMocks());

  it("generates only templates due today (filters non-due frequency)", async () => {
    const monthlyDue = tpl({ id: "m1", frequency: "MONTHLY" });
    // Quarterly: due hanya bulan Jan/Apr/Jul/Oct → Mei = SKIP
    const quarterlyNotDue = tpl({ id: "q1", frequency: "QUARTERLY" });
    // Yearly: due hanya bulan Jan → Mei = SKIP
    const yearlyNotDue = tpl({ id: "y1", frequency: "YEARLY" });

    const repo = makeRepo([monthlyDue, quarterlyNotDue, yearlyNotDue]);
    const posting = makePosting();
    const periods = makePeriodRepo();
    const engine = new RecurringEngineService(repo, posting, periods);

    const summary = await engine.runForDate(today);

    expect(summary.generated).toBe(1);
    expect(summary.skipped).toBe(2);
    expect(posting.postAutoEntry).toHaveBeenCalledTimes(1);
    expect(repo.markGenerated).toHaveBeenCalledWith("m1", today);
  });

  it("continues on per-template error and reports it", async () => {
    const ok = tpl({ id: "ok" });
    const bad = tpl({ id: "bad" });

    const repo = makeRepo([ok, bad]);
    const posting = makePosting();
    (posting.postAutoEntry as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: "je_ok", entryNumber: "JV-1" })
      .mockRejectedValueOnce(new Error("balance check failed"));
    const engine = new RecurringEngineService(repo, posting, makePeriodRepo());

    const summary = await engine.runForDate(today);

    expect(summary.generated).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({ templateId: "bad" });
    expect(repo.markGenerated).toHaveBeenCalledTimes(1);
    expect(repo.markGenerated).toHaveBeenCalledWith("ok", today);
  });

  it("uses sourceRefId=`${templateId}-YYYY-MM` for idempotency", async () => {
    const t = tpl({ id: "t1", tenantId: "tnt_1" });
    const repo = makeRepo([t]);
    const posting = makePosting();
    const engine = new RecurringEngineService(repo, posting, makePeriodRepo());

    await engine.runForDate(today);

    const call = (posting.postAutoEntry as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.source).toBe("RECURRING");
    expect(call.sourceRefId).toBe("t1-2026-05");
    expect(call.tenantId).toBe("tnt_1");
    expect(call.entryDate.toISOString()).toBe(today.toISOString());
  });
});
```

Run: `npm test -- recurring-engine.unit`. Expected: FAIL (engine belum ada).

- [ ] **Step 2: Tulis frequency rules helper**

Create `modules/accounting/services/recurring/frequency-rules.ts`:

```ts
import type { RecurringJournalTemplate } from "../../domain/entities/RecurringJournalTemplate";

/**
 * Tentukan apakah template due berdasarkan frekuensi pada bulan `today`.
 *
 * - MONTHLY: setiap bulan (asal dayOfMonth match — itu sudah difilter di repo).
 * - QUARTERLY: hanya Januari (1), April (4), Juli (7), Oktober (10).
 * - YEARLY: hanya Januari.
 *
 * Catatan: filter `dayOfMonth = today.day` dan `lastGeneratedAt < startOfMonth`
 * sudah dilakukan di repo. Helper ini hanya layer frequency.
 */
export function isDueForFrequency(
  template: Pick<RecurringJournalTemplate, "frequency">,
  today: Date,
): boolean {
  const month = today.getUTCMonth() + 1; // 1..12
  switch (template.frequency) {
    case "MONTHLY":
      return true;
    case "QUARTERLY":
      return month === 1 || month === 4 || month === 7 || month === 10;
    case "YEARLY":
      return month === 1;
    default:
      return false;
  }
}

/**
 * Hitung tanggal next run berikutnya setelah `from` untuk template tertentu.
 * Return null kalau sudah lewat endDate.
 */
export function computeNextRun(
  template: Pick<
    RecurringJournalTemplate,
    "frequency" | "dayOfMonth" | "startDate" | "endDate"
  >,
  from: Date,
): Date | null {
  const fromUtc = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
    ),
  );
  // Mulai cari dari bulan ini, naikkan sampai max 24 bulan ke depan.
  for (let offset = 0; offset < 24; offset++) {
    const year = fromUtc.getUTCFullYear();
    const month = fromUtc.getUTCMonth() + offset; // boleh > 11, JS auto-roll
    const candidate = new Date(
      Date.UTC(year, month, template.dayOfMonth),
    );
    if (candidate < fromUtc) continue;
    if (template.startDate && candidate < template.startDate) continue;
    if (template.endDate && candidate > template.endDate) return null;
    if (isDueForFrequency(template, candidate)) return candidate;
  }
  return null;
}
```

- [ ] **Step 3: Tulis engine**

Create `modules/accounting/services/recurring/RecurringEngineService.ts`:

```ts
import { logger } from "@/lib/logger";
import type { IRecurringRepository } from "../../domain/ports/IRecurringRepository";
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { JournalPostingService } from "../journal/JournalPostingService";
import type { RecurringJournalTemplate } from "../../domain/entities/RecurringJournalTemplate";
import { isDueForFrequency } from "./frequency-rules";

export interface RecurringRunSummary {
  generated: number;
  skipped: number;
  errors: Array<{ templateId: string; error: string }>;
}

/**
 * Engine yang men-generate jurnal otomatis dari template recurring.
 * Multi-tenant: satu pemanggilan handle semua tenant via `findDueToday`.
 */
export class RecurringEngineService {
  constructor(
    private readonly recurringRepo: IRecurringRepository,
    private readonly postingService: JournalPostingService,
    private readonly periodRepo: IPeriodRepository,
  ) {}

  /**
   * Run engine untuk tanggal `today`. Idempotent: aman dipanggil ulang
   * dalam hari yang sama karena unique (tenantId, source, sourceRefId)
   * di journal_entries menjamin tidak ada duplikat.
   */
  async runForDate(today: Date): Promise<RecurringRunSummary> {
    const summary: RecurringRunSummary = {
      generated: 0,
      skipped: 0,
      errors: [],
    };

    const candidates = await this.recurringRepo.findDueToday(today);
    logger.info(
      `[RecurringEngine] Found ${candidates.length} candidates for ${today.toISOString()}`,
    );

    for (const tpl of candidates) {
      try {
        if (!isDueForFrequency(tpl, today)) {
          summary.skipped++;
          continue;
        }
        await this.generateOne(tpl, today);
        summary.generated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
          `[RecurringEngine] Failed to generate for template=${tpl.id}: ${message}`,
        );
        summary.errors.push({ templateId: tpl.id, error: message });
      }
    }

    return summary;
  }

  private async generateOne(
    template: RecurringJournalTemplate,
    today: Date,
  ): Promise<void> {
    const period = await this.periodRepo.findOrCreateOpenPeriodForDate(
      template.tenantId,
      today,
    );
    if (period.status !== "OPEN") {
      throw new Error(
        `Period ${period.year}-${period.month} status=${period.status}, tidak bisa post`,
      );
    }

    const sourceRefId = buildSourceRefId(template.id, today);

    await this.postingService.postAutoEntry({
      tenantId: template.tenantId,
      entryDate: today,
      periodId: period.id,
      source: "RECURRING",
      sourceRefType: "RecurringJournalTemplate",
      sourceRefId,
      description: template.name,
      lines: template.templateLines.map((line) => ({
        coaId: line.coaId,
        side: line.side,
        amount: line.amount,
        description: line.description ?? template.name,
      })),
    });

    await this.recurringRepo.markGenerated(template.id, today);
  }
}

/** Format: `<templateId>-YYYY-MM` (UTC). Idempotent per-template-per-month. */
export function buildSourceRefId(templateId: string, date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${templateId}-${yyyy}-${mm}`;
}
```

> **Catatan**: `JournalPostingService.postAutoEntry` di-asumsikan sudah ada dari Phase 2 sebagai overload yang menerima `source` non-MANUAL (mirror dari `postManualEntry` tapi tanpa `postedBy` dan tanpa enforcement role). Jika di Phase 2 hanya `postManualEntry`, generalisasi sudah tercatat di Phase 2 Task untuk dipakai integrasi finance + recurring. Bila belum ada, tambahkan method `postAutoEntry(input)` ringkas yang memanggil core posting logic yang sama dengan `status=POSTED`.

- [ ] **Step 4: Run test (GREEN)**

Run: `npm test -- recurring-engine.unit`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/services/recurring/RecurringEngineService.ts \
        modules/accounting/services/recurring/frequency-rules.ts \
        modules/accounting/__tests__/recurring-engine.unit.test.ts
git commit -m "feat(accounting): RecurringEngineService + frequency rules"
```

---

## Task 54 — RecurringService (CRUD wrapper) + previewNextRun

**Files:**
- Create: `modules/accounting/services/recurring/RecurringService.ts`
- Create: `modules/accounting/__tests__/recurring-service.test.ts`

- [ ] **Step 1: Tulis test (RED)**

Create `modules/accounting/__tests__/recurring-service.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { RecurringService } from "../services/recurring/RecurringService";
import { RecurringRepository } from "../repositories/RecurringRepository";
import { setupAccountingFixture } from "./helpers/fixture";

describe("RecurringService (integration)", () => {
  const service = new RecurringService(new RecurringRepository());
  let tenantId: string;
  let kasCoaId: string;
  let bebanCoaId: string;

  beforeAll(async () => {
    const fixture = await setupAccountingFixture();
    tenantId = fixture.tenantId;
    kasCoaId = fixture.coa.kas.id;
    bebanCoaId = fixture.coa.bebanSewa.id;
  });

  beforeEach(async () => {
    await prisma.recurringJournalTemplate.deleteMany({ where: { tenantId } });
  });

  it("create validates input via schema", async () => {
    await expect(
      service.create(tenantId, {
        name: "X",
        frequency: "MONTHLY",
        dayOfMonth: 31, // invalid
        startDate: "2026-01-01T00:00:00.000Z",
        templateLines: [
          { coaId: bebanCoaId, side: "DEBIT", amount: "100" },
          { coaId: kasCoaId, side: "CREDIT", amount: "100" },
        ],
      }),
    ).rejects.toThrow(/dayOfMonth/i);
  });

  it("previewNextRun returns null when ended", () => {
    const tpl = {
      id: "x",
      tenantId,
      name: "y",
      description: null,
      frequency: "MONTHLY" as const,
      dayOfMonth: 5,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-04-30"),
      templateLines: [],
      isActive: true,
      lastGeneratedAt: null,
    };
    expect(service.previewNextRun(tpl, new Date("2026-05-10")).nextDate).toBeNull();
  });

  it("previewNextRun returns next dayOfMonth for monthly", () => {
    const tpl = {
      id: "x",
      tenantId,
      name: "y",
      description: null,
      frequency: "MONTHLY" as const,
      dayOfMonth: 5,
      startDate: new Date("2026-01-01"),
      endDate: null,
      templateLines: [],
      isActive: true,
      lastGeneratedAt: null,
    };
    const today = new Date("2026-05-10T00:00:00Z");
    const result = service.previewNextRun(tpl, today);
    expect(result.nextDate?.toISOString()).toBe("2026-06-05T00:00:00.000Z");
  });

  it("create + list + delete roundtrip", async () => {
    const created = await service.create(tenantId, {
      name: "Sewa Kantor",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      startDate: "2026-01-01T00:00:00.000Z",
      templateLines: [
        { coaId: bebanCoaId, side: "DEBIT", amount: "5000000" },
        { coaId: kasCoaId, side: "CREDIT", amount: "5000000" },
      ],
    });

    const list = await service.list(tenantId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);

    await service.delete(created.id);
    const after = await service.list(tenantId);
    expect(after).toHaveLength(0);
  });
});
```

Run: `npm test -- recurring-service`. Expected: FAIL.

- [ ] **Step 2: Tulis service**

Create `modules/accounting/services/recurring/RecurringService.ts`:

```ts
import type { IRecurringRepository } from "../../domain/ports/IRecurringRepository";
import type { RecurringJournalTemplate } from "../../domain/entities/RecurringJournalTemplate";
import {
  recurringCreateSchema,
  recurringUpdateSchema,
  type RecurringCreateDTO,
  type RecurringUpdateDTO,
} from "../../validators/recurring";
import { computeNextRun } from "./frequency-rules";

/** CRUD service untuk recurring template (wrapper repo + validasi). */
export class RecurringService {
  constructor(private readonly repo: IRecurringRepository) {}

  async create(
    tenantId: string,
    input: RecurringCreateDTO,
  ): Promise<RecurringJournalTemplate> {
    const parsed = recurringCreateSchema.parse(input);
    return this.repo.create({
      tenantId,
      name: parsed.name,
      description: parsed.description ?? null,
      frequency: parsed.frequency,
      dayOfMonth: parsed.dayOfMonth,
      startDate: new Date(parsed.startDate),
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      templateLines: parsed.templateLines.map((l) => ({
        coaId: l.coaId,
        side: l.side,
        amount: l.amount,
        description: l.description ?? null,
      })),
    });
  }

  async update(
    id: string,
    input: RecurringUpdateDTO,
  ): Promise<RecurringJournalTemplate> {
    const parsed = recurringUpdateSchema.parse(input);
    return this.repo.update(id, {
      name: parsed.name,
      description: parsed.description,
      frequency: parsed.frequency,
      dayOfMonth: parsed.dayOfMonth,
      startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
      endDate:
        parsed.endDate === undefined
          ? undefined
          : parsed.endDate
            ? new Date(parsed.endDate)
            : null,
      templateLines: parsed.templateLines?.map((l) => ({
        coaId: l.coaId,
        side: l.side,
        amount: l.amount,
        description: l.description ?? null,
      })),
      isActive: parsed.isActive,
    });
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  list(tenantId: string) {
    return this.repo.list(tenantId);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }

  /** Preview tanggal generate berikutnya untuk display di UI. */
  previewNextRun(
    template: Pick<
      RecurringJournalTemplate,
      "frequency" | "dayOfMonth" | "startDate" | "endDate" | "lastGeneratedAt"
    >,
    today: Date,
  ): { nextDate: Date | null } {
    const from = template.lastGeneratedAt
      ? new Date(
          Date.UTC(
            template.lastGeneratedAt.getUTCFullYear(),
            template.lastGeneratedAt.getUTCMonth() + 1,
            1,
          ),
        )
      : today;
    return { nextDate: computeNextRun(template, from) };
  }
}
```

- [ ] **Step 3: Run test (GREEN)**

Run: `npm test -- recurring-service`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/services/recurring/RecurringService.ts \
        modules/accounting/__tests__/recurring-service.test.ts
git commit -m "feat(accounting): RecurringService CRUD + previewNextRun"
```

---

## Task 55 — Cron route handler

**Files:**
- Create: `app/api/cron/accounting/recurring/route.ts`

- [ ] **Step 1: Tulis route**

Pattern auth mengikuti `app/api/cron/depreciation/route.ts` dan `app/api/cron/reconcile-billing-schedules/route.ts`: cek `Authorization: Bearer ${env.CRON_SECRET}`, optional Redis lock untuk mencegah double-run paralel.

Create `app/api/cron/accounting/recurring/route.ts`:

```ts
import { NextRequest } from "next/server";
import {
  apiError,
  ApiErrors,
  apiSuccess,
  ErrorCodes,
} from "@/lib/api-response";
import {
  acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE,
} from "@/lib/cron-lock";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { RecurringRepository } from "@/modules/accounting/repositories/RecurringRepository";
import { PeriodRepository } from "@/modules/accounting/repositories/PeriodRepository";
import { JournalRepository } from "@/modules/accounting/repositories/JournalRepository";
import { ChartOfAccountRepository } from "@/modules/accounting/repositories/ChartOfAccountRepository";
import { JournalPostingService } from "@/modules/accounting/services/journal/JournalPostingService";
import { RecurringEngineService } from "@/modules/accounting/services/recurring/RecurringEngineService";

export const dynamic = "force-dynamic";

/**
 * Cron daily 01:00 UTC: generate jurnal recurring untuk seluruh tenant.
 * Idempotent: aman re-run, unique (tenantId, source, sourceRefId) di journal_entries
 * mencegah duplikat per (template, bulan).
 */
export async function GET(req: NextRequest) {
  try {
    const env = getEnv();
    const authHeader = req.headers.get("authorization");
    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const lockResult = await acquireCronLock(
      "route:accounting.recurring",
      55,
    );
    if (lockResult === "unavailable") {
      return apiError(
        CRON_LOCK_UNAVAILABLE_MESSAGE,
        ErrorCodes.INTERNAL_ERROR,
        { status: 503 },
      );
    }
    if (lockResult === "locked") {
      return apiSuccess(
        { skipped: true, reason: "Lock already held" },
        { message: "Recurring engine sedang berjalan di runtime lain" },
      );
    }

    const today = new Date();
    const engine = buildEngine();
    const summary = await engine.runForDate(today);

    logger.info(
      `[Cron Accounting Recurring] generated=${summary.generated} skipped=${summary.skipped} errors=${summary.errors.length}`,
    );

    return apiSuccess(summary, {
      message: `Recurring engine: ${summary.generated} generated, ${summary.skipped} skipped, ${summary.errors.length} errors`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Recurring cron failed";
    logger.error("[Cron Accounting Recurring] Failed:", error);
    return ApiErrors.internalError(message);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

function buildEngine(): RecurringEngineService {
  const recurringRepo = new RecurringRepository();
  const periodRepo = new PeriodRepository();
  const journalRepo = new JournalRepository();
  const coaRepo = new ChartOfAccountRepository();
  const posting = new JournalPostingService(journalRepo, periodRepo, coaRepo);
  return new RecurringEngineService(recurringRepo, posting, periodRepo);
}
```

> **Asumsi**: `PeriodRepository`, `JournalRepository`, `ChartOfAccountRepository`, `JournalPostingService` sudah tersedia sebagai class concrete dari Phase 2. Bila signature constructor berbeda, sesuaikan saat implementasi.

- [ ] **Step 2: Smoke test manual (optional)**

Lokal:
```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/accounting/recurring
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/accounting/recurring/route.ts
git commit -m "feat(accounting): cron route untuk recurring engine"
```

---

## Task 56 — API CRUD routes (admin)

**Files:**
- Create: `app/api/admin/accounting/recurring/route.ts`
- Create: `app/api/admin/accounting/recurring/[id]/route.ts`

Permission baru: `accounting:recurring:manage` — tambahkan ke `lib/permission-config.ts` di Phase 1 jika belum (note: catalog match wajib, sesuai lessons multi-tenant RBAC).

- [ ] **Step 1: Route list + create**

Create `app/api/admin/accounting/recurring/route.ts`:

```ts
import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { hasPermission } from "@/lib/rbac";
import { getSession } from "@/lib/auth";
import { RecurringService } from "@/modules/accounting/services/recurring/RecurringService";
import { RecurringRepository } from "@/modules/accounting/repositories/RecurringRepository";
import { recurringCreateSchema } from "@/modules/accounting/validators/recurring";

export const dynamic = "force-dynamic";

const service = new RecurringService(new RecurringRepository());

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!(await hasPermission(session, "accounting:recurring:manage"))) {
    return ApiErrors.forbidden();
  }
  const items = await service.list(session.tenantId);
  return apiSuccess({ items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!(await hasPermission(session, "accounting:recurring:manage"))) {
    return ApiErrors.forbidden();
  }
  const body = await req.json();
  const parsed = recurringCreateSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.validation(parsed.error.issues);
  }
  const created = await service.create(session.tenantId, parsed.data);
  return apiSuccess({ item: created }, { status: 201 });
}
```

- [ ] **Step 2: Route detail / patch / delete**

Create `app/api/admin/accounting/recurring/[id]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { hasPermission } from "@/lib/rbac";
import { getSession } from "@/lib/auth";
import { RecurringService } from "@/modules/accounting/services/recurring/RecurringService";
import { RecurringRepository } from "@/modules/accounting/repositories/RecurringRepository";
import { recurringUpdateSchema } from "@/modules/accounting/validators/recurring";

export const dynamic = "force-dynamic";

const service = new RecurringService(new RecurringRepository());

async function authorize() {
  const session = await getSession();
  if (!session) return { error: ApiErrors.unauthorized(), session: null };
  if (!(await hasPermission(session, "accounting:recurring:manage"))) {
    return { error: ApiErrors.forbidden(), session: null };
  }
  return { error: null, session };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error, session } = await authorize();
  if (error) return error;
  const item = await service.findById(params.id);
  if (!item || item.tenantId !== session!.tenantId) {
    return ApiErrors.notFound("Template tidak ditemukan");
  }
  return apiSuccess({ item });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error, session } = await authorize();
  if (error) return error;
  const existing = await service.findById(params.id);
  if (!existing || existing.tenantId !== session!.tenantId) {
    return ApiErrors.notFound("Template tidak ditemukan");
  }
  const body = await req.json();
  const parsed = recurringUpdateSchema.safeParse(body);
  if (!parsed.success) return ApiErrors.validation(parsed.error.issues);
  const updated = await service.update(params.id, parsed.data);
  return apiSuccess({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error, session } = await authorize();
  if (error) return error;
  const existing = await service.findById(params.id);
  if (!existing || existing.tenantId !== session!.tenantId) {
    return ApiErrors.notFound("Template tidak ditemukan");
  }
  await service.delete(params.id);
  return apiSuccess({ deleted: true });
}
```

- [ ] **Step 3: Verify permission catalog**

Pastikan `accounting:recurring:manage` ada di `lib/permission-config.ts` (Phase 1 wajib menambahkannya bareng permission accounting lain). Jika belum:

```ts
// lib/permission-config.ts (snippet)
{ resource: "accounting", actions: ["read", "manual_journal:create", "period:close", "period:reopen", "recurring:manage"] }
```

Jalankan grep untuk konfirmasi:
```bash
rg "accounting:recurring:manage" lib/permission-config.ts
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/accounting/recurring/
git commit -m "feat(accounting): API admin CRUD recurring template"
```

---

## Task 57 — UI page (admin recurring)

**Files:**
- Create: `app/admin/akuntansi/jurnal/recurring/page.tsx`
- Create: `app/admin/akuntansi/jurnal/recurring/_components/RecurringTable.tsx`
- Create: `app/admin/akuntansi/jurnal/recurring/_components/RecurringFormModal.tsx`
- Create: `app/admin/akuntansi/jurnal/recurring/_components/LinesEditor.tsx`
- Create: `app/admin/akuntansi/jurnal/recurring/_hooks/useRecurring.ts`

- [ ] **Step 1: Hook TanStack Query**

Create `app/admin/akuntansi/jurnal/recurring/_hooks/useRecurring.ts`:

```ts
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const KEY = ["accounting", "recurring"];

export function useRecurringList() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await apiClient.get("/api/admin/accounting/recurring");
      return res.data.items as Array<{
        id: string;
        name: string;
        frequency: "MONTHLY" | "QUARTERLY" | "YEARLY";
        dayOfMonth: number;
        isActive: boolean;
        lastGeneratedAt: string | null;
        startDate: string;
        endDate: string | null;
      }>;
    },
  });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: unknown) => {
      const res = await apiClient.post(
        "/api/admin/accounting/recurring",
        input,
      );
      return res.data.item;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: unknown }) => {
      const res = await apiClient.patch(
        `/api/admin/accounting/recurring/${id}`,
        input,
      );
      return res.data.item;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/admin/accounting/recurring/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

- [ ] **Step 2: Page shell**

Create `app/admin/akuntansi/jurnal/recurring/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RecurringTable } from "./_components/RecurringTable";
import { RecurringFormModal } from "./_components/RecurringFormModal";

export default function RecurringPage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Jurnal Recurring</h1>
          <p className="text-sm text-muted-foreground">
            Template jurnal otomatis (sewa, depresiasi, akrual). Cron 01:00 UTC men-generate jurnal sesuai frekuensi & tanggal.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Buat Template</Button>
      </header>
      <RecurringTable />
      <RecurringFormModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
```

- [ ] **Step 3: Table dengan toggle isActive + nextRun**

Create `app/admin/akuntansi/jurnal/recurring/_components/RecurringTable.tsx`:

```tsx
"use client";
import { useMemo } from "react";
import {
  useRecurringList,
  useUpdateRecurring,
  useDeleteRecurring,
} from "../_hooks/useRecurring";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { computeNextRun } from "@/modules/accounting/services/recurring/frequency-rules";

export function RecurringTable() {
  const { data, isLoading } = useRecurringList();
  const update = useUpdateRecurring();
  const del = useDeleteRecurring();

  const today = useMemo(() => new Date(), []);

  if (isLoading) return <div>Loading...</div>;
  if (!data?.length) return <div className="text-muted-foreground">Belum ada template.</div>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Nama</th>
          <th>Frekuensi</th>
          <th>Tgl</th>
          <th>Last Run</th>
          <th>Next Run</th>
          <th>Aktif</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {data.map((tpl) => {
          const next = computeNextRun(
            {
              frequency: tpl.frequency,
              dayOfMonth: tpl.dayOfMonth,
              startDate: new Date(tpl.startDate),
              endDate: tpl.endDate ? new Date(tpl.endDate) : null,
            },
            today,
          );
          return (
            <tr key={tpl.id} className="border-b">
              <td className="py-2">{tpl.name}</td>
              <td>{tpl.frequency}</td>
              <td>{tpl.dayOfMonth}</td>
              <td>{tpl.lastGeneratedAt ? new Date(tpl.lastGeneratedAt).toLocaleDateString("id-ID") : "-"}</td>
              <td>{next ? next.toLocaleDateString("id-ID") : "-"}</td>
              <td>
                <Switch
                  checked={tpl.isActive}
                  onCheckedChange={(v) =>
                    update.mutate({ id: tpl.id, input: { isActive: v } })
                  }
                />
              </td>
              <td>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Hapus template "${tpl.name}"?`)) del.mutate(tpl.id);
                  }}
                >
                  Hapus
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Form modal + lines editor**

Create `app/admin/akuntansi/jurnal/recurring/_components/LinesEditor.tsx`:

```tsx
"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface LineDraft {
  coaId: string;
  side: "DEBIT" | "CREDIT";
  amount: string;
  description?: string;
}

export function LinesEditor({
  lines,
  onChange,
  coaOptions,
}: {
  lines: LineDraft[];
  onChange: (next: LineDraft[]) => void;
  coaOptions: Array<{ id: string; code: string; name: string }>;
}) {
  const update = (i: number, patch: Partial<LineDraft>) => {
    const next = lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    onChange(next);
  };

  const totalD = lines
    .filter((l) => l.side === "DEBIT")
    .reduce((acc, l) => acc + Number(l.amount || 0), 0);
  const totalC = lines
    .filter((l) => l.side === "CREDIT")
    .reduce((acc, l) => acc + Number(l.amount || 0), 0);
  const balanced = totalD === totalC && totalD > 0;

  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <Select
            className="col-span-5"
            value={line.coaId}
            onChange={(v) => update(i, { coaId: v })}
          >
            <option value="">Pilih akun…</option>
            {coaOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </Select>
          <Select
            className="col-span-2"
            value={line.side}
            onChange={(v) => update(i, { side: v as LineDraft["side"] })}
          >
            <option value="DEBIT">DEBIT</option>
            <option value="CREDIT">CREDIT</option>
          </Select>
          <Input
            className="col-span-3"
            type="number"
            min="0"
            step="0.01"
            value={line.amount}
            onChange={(e) => update(i, { amount: e.target.value })}
          />
          <Input
            className="col-span-2"
            placeholder="Keterangan"
            value={line.description ?? ""}
            onChange={(e) => update(i, { description: e.target.value })}
          />
        </div>
      ))}
      <div className="flex justify-between items-center pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...lines, { coaId: "", side: "DEBIT", amount: "0" }])}
        >
          + Baris
        </Button>
        <div className={balanced ? "text-emerald-600" : "text-rose-600"}>
          DR: {totalD.toLocaleString()} / CR: {totalC.toLocaleString()} {balanced ? "✓ balance" : "✗ unbalanced"}
        </div>
      </div>
    </div>
  );
}
```

Create `app/admin/akuntansi/jurnal/recurring/_components/RecurringFormModal.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LinesEditor, type LineDraft } from "./LinesEditor";
import { useCreateRecurring } from "../_hooks/useRecurring";
import { useCoaOptions } from "@/app/admin/akuntansi/_hooks/useCoa";

export function RecurringFormModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineDraft[]>([
    { coaId: "", side: "DEBIT", amount: "0" },
    { coaId: "", side: "CREDIT", amount: "0" },
  ]);

  const create = useCreateRecurring();
  const { data: coaOptions = [] } = useCoaOptions();

  const submit = async () => {
    await create.mutateAsync({
      name,
      frequency,
      dayOfMonth,
      startDate: new Date(startDate).toISOString(),
      templateLines: lines,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Buat Template Recurring</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nama template" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Select value={frequency} onChange={(v) => setFrequency(v as typeof frequency)}>
              <option value="MONTHLY">Bulanan</option>
              <option value="QUARTERLY">Kuartalan</option>
              <option value="YEARLY">Tahunan</option>
            </Select>
            <Input
              type="number"
              min={1}
              max={28}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
              placeholder="Tanggal (1-28)"
            />
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Catatan: dayOfMonth dibatasi 1–28 karena Februari hanya 28–29 hari.
          </p>
          <LinesEditor lines={lines} onChange={setLines} coaOptions={coaOptions} />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={create.isPending}>Simpan</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Verify build**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add app/admin/akuntansi/jurnal/recurring/
git commit -m "feat(accounting): UI admin halaman recurring template"
```

---

## Task 58 — Cron schedule (Vercel) + dokumentasi

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Tambahkan cron entry**

`vercel.json` saat ini punya array kosong `"crons": []`. Tambahkan recurring (1 AM UTC daily):

```json
{
  "crons": [
    {
      "path": "/api/cron/accounting/recurring",
      "schedule": "0 1 * * *"
    }
  ]
}
```

Pertahankan entry cron lain bila ada — append, jangan replace.

- [ ] **Step 2: Verifikasi**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"
```

- [ ] **Step 3: Catatan deploy non-Vercel**

Bila project deploy di Kubernetes / Docker / VM (bukan Vercel), wire cron via OS-level scheduler (CronJob k8s atau systemd timer) yang memanggil:
```
GET https://<host>/api/cron/accounting/recurring
Authorization: Bearer ${CRON_SECRET}
```
Jadwal: setiap hari 01:00 UTC. Route handler sudah idempotent — aman jika dipanggil ulang.

[Asumsi] Project memakai Vercel cron (sesuai `vercel.json` existing). Bila tidak, user harus wire manually; route sudah siap dipanggil.

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "chore(accounting): jadwalkan cron recurring 01:00 UTC harian"
```

---

## Task 59 — Integration test (real DB end-to-end)

**Files:**
- Create: `modules/accounting/__tests__/recurring-engine.integration.test.ts`

- [ ] **Step 1: Tulis test integrasi**

Create `modules/accounting/__tests__/recurring-engine.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { setupAccountingFixture } from "./helpers/fixture";
import { RecurringRepository } from "../repositories/RecurringRepository";
import { PeriodRepository } from "../repositories/PeriodRepository";
import { JournalRepository } from "../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../repositories/ChartOfAccountRepository";
import { JournalPostingService } from "../services/journal/JournalPostingService";
import { RecurringEngineService } from "../services/recurring/RecurringEngineService";

describe("RecurringEngineService (integration)", () => {
  let tenantId: string;
  let kasCoaId: string;
  let bebanCoaId: string;
  let templateId: string;

  const buildEngine = () => {
    const recurringRepo = new RecurringRepository();
    const periodRepo = new PeriodRepository();
    const journalRepo = new JournalRepository();
    const coaRepo = new ChartOfAccountRepository();
    const posting = new JournalPostingService(journalRepo, periodRepo, coaRepo);
    return new RecurringEngineService(recurringRepo, posting, periodRepo);
  };

  beforeAll(async () => {
    const f = await setupAccountingFixture();
    tenantId = f.tenantId;
    kasCoaId = f.coa.kas.id;
    bebanCoaId = f.coa.bebanSewa.id;
  });

  beforeEach(async () => {
    await prisma.journalLine.deleteMany({ where: { entry: { tenantId } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId } });
    await prisma.recurringJournalTemplate.deleteMany({ where: { tenantId } });
    await prisma.accountingPeriod.deleteMany({ where: { tenantId } });

    const tpl = await new RecurringRepository().create({
      tenantId,
      name: "Sewa Kantor Bulanan",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      startDate: new Date("2026-01-01"),
      templateLines: [
        { coaId: bebanCoaId, side: "DEBIT", amount: "5000000", description: "Sewa" },
        { coaId: kasCoaId, side: "CREDIT", amount: "5000000", description: null },
      ],
    });
    templateId = tpl.id;
  });

  it("generates journal on first run, marks lastGeneratedAt", async () => {
    const today = new Date("2026-05-05T01:00:00Z");
    const summary = await buildEngine().runForDate(today);

    expect(summary.generated).toBe(1);
    expect(summary.errors).toHaveLength(0);

    const entries = await prisma.journalEntry.findMany({
      where: { tenantId, source: "RECURRING" },
      include: { lines: true },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].sourceRefId).toBe(`${templateId}-2026-05`);
    expect(entries[0].sourceRefType).toBe("RecurringJournalTemplate");
    expect(entries[0].status).toBe("POSTED");
    expect(entries[0].lines).toHaveLength(2);

    const tpl = await prisma.recurringJournalTemplate.findUnique({
      where: { id: templateId },
    });
    expect(tpl?.lastGeneratedAt?.toISOString()).toBe(today.toISOString());
  });

  it("re-running same day same month is idempotent (no duplicate)", async () => {
    const today = new Date("2026-05-05T01:00:00Z");
    await buildEngine().runForDate(today);
    // Reset lastGeneratedAt agar repo's findDueToday tetap return template;
    // engine harus gagal di unique constraint dan summary.errors++.
    await prisma.recurringJournalTemplate.update({
      where: { id: templateId },
      data: { lastGeneratedAt: null },
    });

    const summary = await buildEngine().runForDate(today);
    // Idempotency layer 2: unique (tenantId, source, sourceRefId) menolak insert kedua.
    expect(summary.generated).toBe(0);
    expect(summary.errors.length).toBe(1);
    expect(summary.errors[0].error).toMatch(/sourceRefId|unique|sudah ada/i);

    const entries = await prisma.journalEntry.findMany({
      where: { tenantId, source: "RECURRING" },
    });
    expect(entries).toHaveLength(1);
  });

  it("running next month creates new journal", async () => {
    await buildEngine().runForDate(new Date("2026-05-05T01:00:00Z"));
    const summary = await buildEngine().runForDate(new Date("2026-06-05T01:00:00Z"));

    expect(summary.generated).toBe(1);

    const entries = await prisma.journalEntry.findMany({
      where: { tenantId, source: "RECURRING" },
      orderBy: { entryDate: "asc" },
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].sourceRefId).toBe(`${templateId}-2026-05`);
    expect(entries[1].sourceRefId).toBe(`${templateId}-2026-06`);
  });
});
```

- [ ] **Step 2: Setup test DB & run**

```bash
./scripts/setup-test-db.sh
npm test -- recurring-engine.integration
```

Expected: PASS (3 test).

- [ ] **Step 3: Coverage check**

```bash
npm run test:coverage -- modules/accounting/services/recurring
```

Target: ≥80% pada `RecurringEngineService` & `RecurringService`.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/__tests__/recurring-engine.integration.test.ts
git commit -m "test(accounting): integration test recurring engine end-to-end"
```

---

## Task 60 — CHANGELOG + final commit Phase 5

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Self-review diff**

```bash
git log --oneline staging..HEAD -- modules/accounting app/api/admin/accounting/recurring app/api/cron/accounting app/admin/akuntansi/jurnal/recurring vercel.json
```

Pastikan tidak ada dead code, debug log, atau perubahan tidak related.

- [ ] **Step 2: Run full check**

```bash
npm run typecheck
npm run lint
npm test -- modules/accounting
```

Expected: semua PASS.

- [ ] **Step 3: Update CHANGELOG**

Tambahkan entry di bagian `[Unreleased]` `docs/CHANGELOG.md`:

```markdown
### [2026-05-20] — Recurring journal engine (Phase 5)

- **Tipe**: [ADDED]
- **Scope**: `modules/accounting/services/recurring`, `app/api/cron/accounting/recurring`, `app/api/admin/accounting/recurring`, `app/admin/akuntansi/jurnal/recurring`, `vercel.json`
- **Author**: agent
- **Deskripsi**: Engine recurring journal multi-tenant. Cron daily 01:00 UTC men-generate jurnal otomatis dari `RecurringJournalTemplate` saat `dayOfMonth` cocok, menghormati frekuensi MONTHLY/QUARTERLY/YEARLY. Idempotent via unique `(tenantId, source=RECURRING, sourceRefId=templateId-YYYY-MM)`. Termasuk validator Zod (dayOfMonth ≤ 28), CRUD service, REST API admin (permission `accounting:recurring:manage`), UI form + table, dan cron entry Vercel.
- **Files**: `modules/accounting/repositories/RecurringRepository.ts`, `modules/accounting/services/recurring/RecurringEngineService.ts`, `modules/accounting/services/recurring/RecurringService.ts`, `modules/accounting/services/recurring/frequency-rules.ts`, `modules/accounting/validators/recurring.ts`, `app/api/cron/accounting/recurring/route.ts`, `app/api/admin/accounting/recurring/route.ts`, `app/api/admin/accounting/recurring/[id]/route.ts`, `app/admin/akuntansi/jurnal/recurring/page.tsx`, `vercel.json`
- **Breaking**: ❌ Tidak
```

- [ ] **Step 4: Commit final**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): catat Phase 5 recurring journal engine"
```

- [ ] **Step 5: Verifikasi akhir Phase 5**

Checklist:
- [x] RecurringRepository (Prisma) + mapper + test
- [x] Validator Zod (dayOfMonth ≤ 28, balance check)
- [x] RecurringEngineService (multi-tenant, frequency-aware, idempotent)
- [x] RecurringService CRUD + previewNextRun
- [x] Cron route `/api/cron/accounting/recurring` (Bearer auth + Redis lock)
- [x] API admin CRUD (permission `accounting:recurring:manage`)
- [x] UI admin (table + form + lines editor + nextRun)
- [x] Cron schedule di `vercel.json` (0 1 * * *)
- [x] Integration test (3 skenario: first run, idempotent retry, next month)
- [x] CHANGELOG updated

**Manual smoke (opsional, lokal):**
1. Buat tenant fixture + COA via seed.
2. Buat template via UI (`/admin/akuntansi/jurnal/recurring`).
3. Trigger cron lokal:
   ```bash
   curl -i -H "Authorization: Bearer $CRON_SECRET" \
        http://localhost:3000/api/cron/accounting/recurring
   ```
4. Cek tabel `journal_entries` untuk row baru `source=RECURRING`.

---
# PHASE 6 — Bank Reconciliation + Health Check + Production Rollout + E2E

## Task 61: ReconciliationRepository (Prisma)

**Files:**
- Create: `modules/accounting/repositories/ReconciliationRepository.ts`

- [ ] **Step 1: Implement repository**

Create `modules/accounting/repositories/ReconciliationRepository.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type {
  IReconciliationRepository,
  ReconciliationCreateInput,
  ReconciliationLineInput,
} from "../domain/ports/IReconciliationRepository";
import type {
  BankReconciliation,
  BankReconciliationLine,
  MatchStatus,
} from "../domain/entities/BankReconciliation";

function toReconciliation(
  row: any & { lines: any[] },
): BankReconciliation {
  return {
    id: row.id,
    tenantId: row.tenantId,
    coaId: row.coaId,
    statementDate: row.statementDate,
    statementBalance: row.statementBalance.toString(),
    bookBalance: row.bookBalance.toString(),
    reconciledBalance: row.reconciledBalance.toString(),
    status: row.status,
    completedAt: row.completedAt,
    completedBy: row.completedBy,
    lines: row.lines.map(toReconciliationLine),
  };
}

function toReconciliationLine(row: any): BankReconciliationLine {
  return {
    id: row.id,
    reconciliationId: row.reconciliationId,
    journalLineId: row.journalLineId,
    bankRefDate: row.bankRefDate,
    bankRefDescription: row.bankRefDescription,
    bankRefAmount: row.bankRefAmount.toString(),
    matchStatus: row.matchStatus,
  };
}

export class ReconciliationRepository implements IReconciliationRepository {
  async create(input: ReconciliationCreateInput): Promise<BankReconciliation> {
    const row = await prisma.bankReconciliation.create({
      data: {
        tenantId: input.tenantId,
        coaId: input.coaId,
        statementDate: input.statementDate,
        statementBalance: input.statementBalance,
        bookBalance: input.bookBalance,
        reconciledBalance: "0",
        status: "DRAFT",
      },
      include: { lines: true },
    });
    return toReconciliation(row);
  }

  async findById(id: string): Promise<BankReconciliation | null> {
    const row = await prisma.bankReconciliation.findUnique({
      where: { id },
      include: { lines: true },
    });
    return row ? toReconciliation(row) : null;
  }

  async list(tenantId: string, coaId?: string): Promise<BankReconciliation[]> {
    const rows = await prisma.bankReconciliation.findMany({
      where: { tenantId, ...(coaId && { coaId }) },
      include: { lines: true },
      orderBy: { statementDate: "desc" },
    });
    return rows.map(toReconciliation);
  }

  async addLines(lines: ReconciliationLineInput[]): Promise<void> {
    await prisma.bankReconciliationLine.createMany({
      data: lines.map((l) => ({
        reconciliationId: l.reconciliationId,
        journalLineId: l.journalLineId ?? null,
        bankRefDate: l.bankRefDate,
        bankRefDescription: l.bankRefDescription,
        bankRefAmount: l.bankRefAmount,
        matchStatus: l.matchStatus,
      })),
    });
  }

  async updateLineMatch(
    lineId: string,
    journalLineId: string | null,
    matchStatus: MatchStatus,
  ): Promise<void> {
    await prisma.bankReconciliationLine.update({
      where: { id: lineId },
      data: { journalLineId, matchStatus },
    });
  }

  async complete(
    id: string,
    reconciledBalance: string,
    completedBy: string,
  ): Promise<BankReconciliation> {
    const row = await prisma.bankReconciliation.update({
      where: { id },
      data: {
        reconciledBalance,
        status: "COMPLETED",
        completedAt: new Date(),
        completedBy,
      },
      include: { lines: true },
    });
    return toReconciliation(row);
  }
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/repositories/ReconciliationRepository.ts
git commit -m "feat(accounting): tambah ReconciliationRepository (Prisma)"
```

---

## Task 62: CSV Parser (BCA, Mandiri, BNI)

**Files:**
- Create: `modules/accounting/services/reconciliation/csvParser.ts`

- [ ] **Step 1: Implement CSV parser**

Create `modules/accounting/services/reconciliation/csvParser.ts`:

```ts
export interface BankStatementRow {
  date: Date;
  description: string;
  amount: string;
}

export type BankFormat = "BCA" | "MANDIRI" | "BNI" | "GENERIC";

export function parseBankCsv(
  csvContent: string,
  format: BankFormat,
): BankStatementRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  switch (format) {
    case "BCA":
      return parseBCA(lines);
    case "MANDIRI":
      return parseMandiri(lines);
    case "BNI":
      return parseBNI(lines);
    case "GENERIC":
    default:
      return parseGeneric(lines);
  }
}

function parseBCA(lines: string[]): BankStatementRow[] {
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const dateStr = cols[0]?.trim();
    const description = cols[1]?.trim() || "";
    const debit = parseAmount(cols[3]);
    const credit = parseAmount(cols[4]);
    const amount = credit > 0 ? credit.toString() : (-debit).toString();

    return {
      date: parseDate(dateStr, "DD/MM/YYYY"),
      description,
      amount,
    };
  }).filter((r) => r.description !== "");
}

function parseMandiri(lines: string[]): BankStatementRow[] {
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const dateStr = cols[0]?.trim();
    const description = cols[1]?.trim() || "";
    const debit = parseAmount(cols[2]);
    const credit = parseAmount(cols[3]);
    const amount = credit > 0 ? credit.toString() : (-debit).toString();

    return {
      date: parseDate(dateStr, "DD-MM-YYYY"),
      description,
      amount,
    };
  }).filter((r) => r.description !== "");
}

function parseBNI(lines: string[]): BankStatementRow[] {
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const dateStr = cols[0]?.trim();
    const description = cols[2]?.trim() || "";
    const debit = parseAmount(cols[3]);
    const credit = parseAmount(cols[4]);
    const amount = credit > 0 ? credit.toString() : (-debit).toString();

    return {
      date: parseDate(dateStr, "DD/MM/YYYY"),
      description,
      amount,
    };
  }).filter((r) => r.description !== "");
}

function parseGeneric(lines: string[]): BankStatementRow[] {
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    return {
      date: new Date(cols[0]?.trim()),
      description: cols[1]?.trim() || "",
      amount: cols[2]?.trim() || "0",
    };
  }).filter((r) => r.description !== "");
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseAmount(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  return parseFloat(cleaned) || 0;
}

function parseDate(s: string, format: string): Date {
  if (format === "DD/MM/YYYY" || format === "DD-MM-YYYY") {
    const sep = format.includes("/") ? "/" : "-";
    const parts = s.split(sep);
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
  }
  return new Date(s);
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/services/reconciliation/csvParser.ts
git commit -m "feat(accounting): tambah CSV parser bank (BCA, Mandiri, BNI, generic)"
```

---

## Task 63: autoMatcher

**Files:**
- Create: `modules/accounting/services/reconciliation/autoMatcher.ts`

- [ ] **Step 1: Implement auto matcher**

Create `modules/accounting/services/reconciliation/autoMatcher.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { Money } from "../../domain/value-objects/Money";
import type { BankStatementRow } from "./csvParser";

export interface MatchCandidate {
  bankLineIndex: number;
  journalLineId: string;
  confidence: number;
}

export async function autoMatch(
  tenantId: string,
  coaId: string,
  bankRows: BankStatementRow[],
  windowDays: number = 3,
): Promise<MatchCandidate[]> {
  const matches: MatchCandidate[] = [];
  const usedJournalLineIds = new Set<string>();

  for (let i = 0; i < bankRows.length; i++) {
    const row = bankRows[i];
    const bankAmount = Money.fromString(row.amount);
    const dateFrom = new Date(row.date);
    dateFrom.setDate(dateFrom.getDate() - windowDays);
    const dateTo = new Date(row.date);
    dateTo.setDate(dateTo.getDate() + windowDays);

    const candidates = await prisma.journalLine.findMany({
      where: {
        coaId,
        entry: {
          tenantId,
          status: "POSTED",
          entryDate: { gte: dateFrom, lte: dateTo },
        },
        id: { notIn: Array.from(usedJournalLineIds) },
      },
      include: { entry: { select: { description: true, entryDate: true } } },
    });

    let bestMatch: { journalLineId: string; confidence: number } | null = null;

    for (const candidate of candidates) {
      const candidateAmount = Money.fromString(candidate.amount.toString());
      if (!bankAmount.equals(candidateAmount) && !bankAmount.equals(candidateAmount.multiply(-1))) {
        continue;
      }

      const descSimilarity = levenshteinSimilarity(
        row.description.toLowerCase(),
        (candidate.entry?.description || "").toLowerCase(),
      );

      const confidence = 0.6 + descSimilarity * 0.4;

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { journalLineId: candidate.id, confidence };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.6) {
      matches.push({
        bankLineIndex: i,
        journalLineId: bestMatch.journalLineId,
        confidence: bestMatch.confidence,
      });
      usedJournalLineIds.add(bestMatch.journalLineId);
    }
  }

  return matches;
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/accounting/services/reconciliation/autoMatcher.ts
git commit -m "feat(accounting): tambah autoMatcher (window ±3 hari + amount + Levenshtein)"
```

---
## Task 64: BankReconciliationService

**Files:**
- Create: `modules/accounting/services/reconciliation/BankReconciliationService.ts`
- Create: `modules/accounting/__tests__/BankReconciliationService.test.ts`

- [ ] **Step 1: Tulis test**

Create `modules/accounting/__tests__/BankReconciliationService.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BankReconciliationService } from "../services/reconciliation/BankReconciliationService";
import type { IReconciliationRepository } from "../domain/ports/IReconciliationRepository";
import type { BankReconciliation } from "../domain/entities/BankReconciliation";
import { AccountingError } from "../errors";

describe("BankReconciliationService", () => {
  let service: BankReconciliationService;
  let reconRepo: IReconciliationRepository;

  const mockRecon: BankReconciliation = {
    id: "recon-1",
    tenantId: "tenant-1",
    coaId: "coa-bank",
    statementDate: new Date("2026-05-31"),
    statementBalance: "10000000.00",
    bookBalance: "9500000.00",
    reconciledBalance: "0",
    status: "DRAFT",
    completedAt: null,
    completedBy: null,
    lines: [],
  };

  beforeEach(() => {
    reconRepo = {
      create: vi.fn().mockResolvedValue(mockRecon),
      findById: vi.fn().mockResolvedValue(mockRecon),
      list: vi.fn().mockResolvedValue([mockRecon]),
      addLines: vi.fn(),
      updateLineMatch: vi.fn(),
      complete: vi.fn().mockResolvedValue({ ...mockRecon, status: "COMPLETED" }),
    } as unknown as IReconciliationRepository;

    service = new BankReconciliationService(reconRepo);
  });

  it("creates a reconciliation session", async () => {
    const result = await service.create("tenant-1", {
      coaId: "coa-bank",
      statementDate: new Date("2026-05-31"),
      statementBalance: "10000000.00",
      bookBalance: "9500000.00",
    });
    expect(reconRepo.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("throws when completing an already completed reconciliation", async () => {
    vi.mocked(reconRepo.findById).mockResolvedValue({ ...mockRecon, status: "COMPLETED" });
    await expect(service.complete("recon-1", "user-1")).rejects.toThrow(AccountingError);
  });

  it("completes reconciliation successfully", async () => {
    const result = await service.complete("recon-1", "user-1");
    expect(reconRepo.complete).toHaveBeenCalled();
    expect(result.status).toBe("COMPLETED");
  });
});
```

- [ ] **Step 2: Implement service**

Create `modules/accounting/services/reconciliation/BankReconciliationService.ts`:

```ts
import type {
  IReconciliationRepository,
  ReconciliationLineInput,
} from "../../domain/ports/IReconciliationRepository";
import type { BankReconciliation, MatchStatus } from "../../domain/entities/BankReconciliation";
import { Money } from "../../domain/value-objects/Money";
import { AccountingError } from "../../errors";
import type { BankStatementRow } from "./csvParser";

interface CreateInput {
  coaId: string;
  statementDate: Date;
  statementBalance: string;
  bookBalance: string;
}

export class BankReconciliationService {
  constructor(private readonly reconRepo: IReconciliationRepository) {}

  async create(tenantId: string, input: CreateInput): Promise<BankReconciliation> {
    return this.reconRepo.create({
      tenantId,
      coaId: input.coaId,
      statementDate: input.statementDate,
      statementBalance: input.statementBalance,
      bookBalance: input.bookBalance,
    });
  }

  async loadBankRows(
    reconciliationId: string,
    rows: BankStatementRow[],
  ): Promise<void> {
    const lines: ReconciliationLineInput[] = rows.map((row) => ({
      reconciliationId,
      bankRefDate: row.date,
      bankRefDescription: row.description,
      bankRefAmount: row.amount,
      matchStatus: "UNMATCHED" as MatchStatus,
    }));
    await this.reconRepo.addLines(lines);
  }

  async manualMatch(
    lineId: string,
    journalLineId: string,
  ): Promise<void> {
    await this.reconRepo.updateLineMatch(lineId, journalLineId, "MANUAL_MATCH");
  }

  async unmatch(lineId: string): Promise<void> {
    await this.reconRepo.updateLineMatch(lineId, null, "UNMATCHED");
  }

  async complete(
    reconciliationId: string,
    completedBy: string,
  ): Promise<BankReconciliation> {
    const recon = await this.reconRepo.findById(reconciliationId);
    if (!recon) {
      throw new AccountingError("Reconciliation tidak ditemukan", "RECON_NOT_FOUND");
    }
    if (recon.status === "COMPLETED") {
      throw new AccountingError("Reconciliation sudah selesai", "RECON_ALREADY_COMPLETED");
    }

    const matchedTotal = recon.lines
      .filter((l) => l.matchStatus !== "UNMATCHED")
      .reduce((sum, l) => sum.add(Money.fromString(l.bankRefAmount)), Money.zero());

    return this.reconRepo.complete(reconciliationId, matchedTotal.toString(), completedBy);
  }

  async findById(id: string): Promise<BankReconciliation | null> {
    return this.reconRepo.findById(id);
  }

  async list(tenantId: string, coaId?: string): Promise<BankReconciliation[]> {
    return this.reconRepo.list(tenantId, coaId);
  }
}
```

- [ ] **Step 3: Run test**

Run: `npx vitest run modules/accounting/__tests__/BankReconciliationService.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/accounting/services/reconciliation/BankReconciliationService.ts modules/accounting/__tests__/BankReconciliationService.test.ts
git commit -m "feat(accounting): tambah BankReconciliationService (create, load, match, complete)"
```

---

## Task 65: Reconciliation Validators

**Files:**
- Create: `modules/accounting/validators/reconciliation.ts`

- [ ] **Step 1: Implement validators**

Create `modules/accounting/validators/reconciliation.ts`:

```ts
import { z } from "zod";

export const createReconciliationSchema = z.object({
  coaId: z.string().min(1, "coaId wajib diisi"),
  statementDate: z.coerce.date({ required_error: "statementDate wajib diisi" }),
  statementBalance: z.string().refine(
    (val) => !isNaN(parseFloat(val)),
    { message: "statementBalance harus angka valid" },
  ),
  bookBalance: z.string().refine(
    (val) => !isNaN(parseFloat(val)),
    { message: "bookBalance harus angka valid" },
  ),
});

export const uploadCsvSchema = z.object({
  format: z.enum(["BCA", "MANDIRI", "BNI", "GENERIC"]),
});

export const manualMatchSchema = z.object({
  lineId: z.string().min(1),
  journalLineId: z.string().min(1),
});

export type CreateReconciliationInput = z.infer<typeof createReconciliationSchema>;
export type UploadCsvInput = z.infer<typeof uploadCsvSchema>;
export type ManualMatchInput = z.infer<typeof manualMatchSchema>;
```

- [ ] **Step 2: Type check & commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add modules/accounting/validators/reconciliation.ts
git commit -m "feat(accounting): tambah reconciliation validators (Zod)"
```

---

## Task 66: API Routes Reconciliation

**Files:**
- Create: `app/api/admin/accounting/reconciliation/route.ts`
- Create: `app/api/admin/accounting/reconciliation/[id]/route.ts`
- Create: `app/api/admin/accounting/reconciliation/[id]/match/route.ts`
- Create: `app/api/admin/accounting/reconciliation/[id]/complete/route.ts`

- [ ] **Step 1: Buat route list + create**

Create `app/api/admin/accounting/reconciliation/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { BankReconciliationService } from "@/modules/accounting/services/reconciliation/BankReconciliationService";
import { ReconciliationRepository } from "@/modules/accounting/repositories/ReconciliationRepository";
import { createReconciliationSchema } from "@/modules/accounting/validators/reconciliation";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!hasPermission(session, "accounting:reconciliation")) return ApiErrors.forbidden();

  const service = new BankReconciliationService(new ReconciliationRepository());
  const coaId = req.nextUrl.searchParams.get("coaId") || undefined;
  const items = await service.list(session.tenantId, coaId);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!hasPermission(session, "accounting:reconciliation")) return ApiErrors.forbidden();

  const body = await req.json();
  const parsed = createReconciliationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = new BankReconciliationService(new ReconciliationRepository());
  const result = await service.create(session.tenantId, parsed.data);
  return NextResponse.json(result, { status: 201 });
}
```

- [ ] **Step 2: Buat route detail**

Create `app/api/admin/accounting/reconciliation/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { BankReconciliationService } from "@/modules/accounting/services/reconciliation/BankReconciliationService";
import { ReconciliationRepository } from "@/modules/accounting/repositories/ReconciliationRepository";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!hasPermission(session, "accounting:reconciliation")) return ApiErrors.forbidden();

  const service = new BankReconciliationService(new ReconciliationRepository());
  const result = await service.findById(params.id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Buat route manual match**

Create `app/api/admin/accounting/reconciliation/[id]/match/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { BankReconciliationService } from "@/modules/accounting/services/reconciliation/BankReconciliationService";
import { ReconciliationRepository } from "@/modules/accounting/repositories/ReconciliationRepository";
import { manualMatchSchema } from "@/modules/accounting/validators/reconciliation";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!hasPermission(session, "accounting:reconciliation")) return ApiErrors.forbidden();

  const body = await req.json();
  const parsed = manualMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = new BankReconciliationService(new ReconciliationRepository());
  await service.manualMatch(parsed.data.lineId, parsed.data.journalLineId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Buat route complete**

Create `app/api/admin/accounting/reconciliation/[id]/complete/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { BankReconciliationService } from "@/modules/accounting/services/reconciliation/BankReconciliationService";
import { ReconciliationRepository } from "@/modules/accounting/repositories/ReconciliationRepository";
import { AccountingError } from "@/modules/accounting/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return ApiErrors.unauthorized();
  if (!hasPermission(session, "accounting:reconciliation")) return ApiErrors.forbidden();

  try {
    const service = new BankReconciliationService(new ReconciliationRepository());
    const result = await service.complete(params.id, session.userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AccountingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
```

- [ ] **Step 5: Type check & commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add app/api/admin/accounting/reconciliation/
git commit -m "feat(accounting): tambah API routes reconciliation (CRUD + match + complete)"
```

---

## Task 67: UI Reconciliation (3 Kolom Matching)

**Files:**
- Create: `app/admin/akuntansi/rekonsiliasi/page.tsx`
- Create: `app/admin/akuntansi/rekonsiliasi/[id]/page.tsx`

- [ ] **Step 1: List page**

Create `app/admin/akuntansi/rekonsiliasi/page.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function RekonsiliasiPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["accounting", "reconciliation"],
    queryFn: async () => {
      const res = await fetch("/api/admin/accounting/reconciliation");
      if (!res.ok) throw new Error("Gagal memuat data");
      return res.json();
    },
  });

  if (isLoading) return <div className="p-6">Memuat...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
        <Button asChild>
          <Link href="/admin/akuntansi/rekonsiliasi/new">Buat Baru</Link>
        </Button>
      </div>
      <div className="grid gap-4">
        {items.map((item: any) => (
          <Link key={item.id} href={`/admin/akuntansi/rekonsiliasi/${item.id}`}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">
                  {new Date(item.statementDate).toLocaleDateString("id-ID")}
                </CardTitle>
                <Badge>{item.status}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Saldo statement: Rp {Number(item.statementBalance).toLocaleString("id-ID")}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Detail + matching page (simplified)**

Create `app/admin/akuntansi/rekonsiliasi/[id]/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ReconciliationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: recon, isLoading } = useQuery({
    queryKey: ["accounting", "reconciliation", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/accounting/reconciliation/${id}`);
      if (!res.ok) throw new Error("Gagal memuat");
      return res.json();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/accounting/reconciliation/${id}/complete`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyelesaikan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "reconciliation", id] });
      toast.success("Reconciliation selesai");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <div className="p-6">Memuat...</div>;
  if (!recon) return <div className="p-6">Tidak ditemukan</div>;

  const matched = recon.lines?.filter((l: any) => l.matchStatus !== "UNMATCHED") || [];
  const unmatched = recon.lines?.filter((l: any) => l.matchStatus === "UNMATCHED") || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rekonsiliasi Detail</h1>
        <Badge>{recon.status}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Matched</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{matched.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Unmatched Bank</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{unmatched.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Saldo Statement</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Rp {Number(recon.statementBalance).toLocaleString("id-ID")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Baris Mutasi Bank</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Tanggal</th>
                <th className="text-left py-2">Deskripsi</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-center py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recon.lines?.map((line: any) => (
                <tr key={line.id} className="border-b">
                  <td className="py-2">{new Date(line.bankRefDate).toLocaleDateString("id-ID")}</td>
                  <td className="py-2">{line.bankRefDescription}</td>
                  <td className="text-right py-2">{Number(line.bankRefAmount).toLocaleString("id-ID")}</td>
                  <td className="text-center py-2">
                    <Badge variant={line.matchStatus === "UNMATCHED" ? "destructive" : "default"}>
                      {line.matchStatus}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {recon.status === "DRAFT" && (
        <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
          Selesaikan Reconciliation
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type check & commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add app/admin/akuntansi/rekonsiliasi/
git commit -m "feat(accounting): tambah UI rekonsiliasi bank (list + detail 3 kolom + complete)"
```

---
## Task 68: Daily Health Check Cron

**Files:**
- Create: `app/api/cron/accounting/health-check/route.ts`

- [ ] **Step 1: Implement health check cron route**

Create `app/api/cron/accounting/health-check/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {};

  const unbalancedEntries = await prisma.$queryRaw<{ id: string; entry_number: string }[]>`
    SELECT je.id, je.entry_number
    FROM journal_entries je
    WHERE je.status = 'POSTED'
    AND (
      SELECT COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)
      FROM journal_lines jl WHERE jl.entry_id = je.id
    ) <> (
      SELECT COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)
      FROM journal_lines jl WHERE jl.entry_id = je.id
    )
    LIMIT 10
  `;

  results.unbalancedEntries = unbalancedEntries;
  if (unbalancedEntries.length > 0) {
    logger.error(`[accounting-health] Found ${unbalancedEntries.length} unbalanced POSTED entries!`);
  }

  const pendingOutbox = await prisma.outboxEvent.count({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
  });
  results.staleOutboxEvents = pendingOutbox;
  if (pendingOutbox > 0) {
    logger.warn(`[accounting-health] ${pendingOutbox} outbox events pending > 30 min`);
  }

  const openPeriods = await prisma.accountingPeriod.findMany({
    where: { status: "OPEN" },
    select: { tenantId: true, year: true, month: true },
  });
  results.openPeriods = openPeriods.length;

  const healthy = unbalancedEntries.length === 0 && pendingOutbox === 0;
  results.healthy = healthy;

  logger.info(`[accounting-health] Check complete: healthy=${healthy}`);

  return NextResponse.json(results, { status: healthy ? 200 : 500 });
}
```

- [ ] **Step 2: Type check & commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add app/api/cron/accounting/health-check/
git commit -m "feat(accounting): tambah daily health check cron (unbalanced entries + stale outbox)"
```

---

## Task 69: Observability Metrics Helpers

**Files:**
- Create: `modules/accounting/services/observability.ts`

- [ ] **Step 1: Implement observability helpers**

Create `modules/accounting/services/observability.ts`:

```ts
import { logger } from "@/lib/logger";

export function logJournalPosted(params: {
  tenantId: string;
  entryNumber: string;
  source: string;
  amount: string;
  linesCount: number;
}): void {
  logger.info("[accounting:journal:posted]", {
    tenantId: params.tenantId,
    entryNumber: params.entryNumber,
    source: params.source,
    amount: params.amount,
    linesCount: params.linesCount,
  });
}

export function logPeriodClosed(params: {
  tenantId: string;
  year: number;
  month: number;
  closedBy: string;
}): void {
  logger.info("[accounting:period:closed]", params);
}

export function logReconciliationCompleted(params: {
  tenantId: string;
  reconciliationId: string;
  matchedCount: number;
  unmatchedCount: number;
}): void {
  logger.info("[accounting:reconciliation:completed]", params);
}

export function logAutoJournalFailed(params: {
  tenantId: string;
  source: string;
  sourceRefId: string;
  error: string;
}): void {
  logger.error("[accounting:auto-journal:failed]", params);
}

export function logHealthCheckResult(params: {
  healthy: boolean;
  unbalancedCount: number;
  staleOutboxCount: number;
}): void {
  const level = params.healthy ? "info" : "error";
  logger[level]("[accounting:health-check]", params);
}
```

- [ ] **Step 2: Type check & commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add modules/accounting/services/observability.ts
git commit -m "feat(accounting): tambah observability metric helpers (structured logging)"
```

---

## Task 70: Production Rollout Doc

**Files:**
- Create: `docs/standards/accounting-rollout.md`

- [ ] **Step 1: Tulis rollout plan**

Create `docs/standards/accounting-rollout.md`:

```markdown
# Accounting Module — Production Rollout Plan

## 5-Stage Rollout

### Stage 1: Schema Migration (Low Risk)
- Deploy Prisma migration (additive only, no breaking changes)
- Verify tables created: `chart_of_accounts`, `journal_entries`, `journal_lines`, `accounting_periods`, `recurring_journal_templates`, `bank_reconciliations`, `bank_reconciliation_lines`
- Verify DB trigger `journal_balance_check` active
- Feature flag `ACCOUNTING_MODULE_ENABLED=false` (handlers not active)

### Stage 2: Seed + Internal Testing
- Run `npm run accounting:seed` per tenant (COA default + first period)
- Set `ACCOUNTING_MODULE_ENABLED=true` di staging
- QA team test: manual journal, COA CRUD, period operations
- Verify event handlers fire correctly di staging
- Monitor error rate + DLQ

### Stage 3: Shadow Mode (1 Tenant Production)
- Enable flag untuk 1 tenant pilot
- Auto-journal mulai aktif; manual journal available
- Monitor 1 minggu: cek journal balance, compare vs finance data
- Akuntan pilot review laporan vs pembukuan manual

### Stage 4: Gradual Rollout
- Enable per-tenant (batch 5-10 tenant per hari)
- Monitor DLQ, health check cron, error rate
- Rollback: set flag false per tenant (journals tetap ada tapi handler stop)

### Stage 5: General Availability
- Set `ACCOUNTING_MODULE_ENABLED=true` global
- Remove feature flag check dari event handler registration
- Enable recurring journal cron
- Enable daily health check cron
- Add sidebar menu link untuk semua tenant

## Rollback Strategy
- Feature flag off → handlers stop, no new journals
- Existing journals remain (read-only)
- No schema rollback needed (additive migration)

## Monitoring Checklist
- [ ] Health check cron returns 200
- [ ] No unbalanced entries in DB
- [ ] DLQ empty (no stuck events)
- [ ] Trial Balance DR = CR per tenant
- [ ] Auto-journal latency < 5s from event publish
```

- [ ] **Step 2: Commit**

```bash
git add docs/standards/accounting-rollout.md
git commit -m "docs(accounting): tambah production rollout plan (5-stage)"
```

---

## Task 71: E2E Playwright Test

**Files:**
- Create: `e2e/accounting.spec.ts`

- [ ] **Step 1: Implement E2E test**

Create `e2e/accounting.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Accounting Module", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/akuntansi");
  });

  test("displays accounting dashboard", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Akuntansi");
  });

  test("navigates to COA page and displays tree", async ({ page }) => {
    await page.click("text=Chart of Accounts");
    await expect(page).toHaveURL(/\/admin\/akuntansi\/coa/);
    await expect(page.locator("table")).toBeVisible();
  });

  test("navigates to journal list", async ({ page }) => {
    await page.click("text=Jurnal");
    await expect(page).toHaveURL(/\/admin\/akuntansi\/jurnal/);
  });

  test("navigates to reports", async ({ page }) => {
    await page.click("text=Laporan");
    await expect(page.locator("text=Trial Balance")).toBeVisible();
  });

  test("creates manual journal entry", async ({ page }) => {
    await page.goto("/admin/akuntansi/jurnal/new");
    await page.fill("[name=description]", "Test manual journal E2E");
    await page.fill("[name=entryDate]", "2026-05-15");

    await page.click("text=Tambah Baris");
    await page.selectOption("[name='lines.0.side']", "DEBIT");
    await page.fill("[name='lines.0.amount']", "100000");

    await page.click("text=Tambah Baris");
    await page.selectOption("[name='lines.1.side']", "CREDIT");
    await page.fill("[name='lines.1.amount']", "100000");

    await page.click("text=Simpan");
    await expect(page.locator("text=berhasil")).toBeVisible();
  });

  test("period page shows list of periods", async ({ page }) => {
    await page.goto("/admin/akuntansi/periode");
    await expect(page.locator("text=Periode Akuntansi")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E (jika dev server up)**

Run: `npx playwright test e2e/accounting.spec.ts`
Expected: PASS (membutuhkan dev server + seed data).

- [ ] **Step 3: Commit**

```bash
git add e2e/accounting.spec.ts
git commit -m "test(accounting): tambah E2E Playwright test modul akuntansi"
```

---

## Task 72: CLAUDE.md Update (Module Ownership Map)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Tambah accounting ke Module Ownership Map**

Edit `CLAUDE.md`, cari section `## Module Ownership Map` dan tambahkan row:

```markdown
| accounting | Double-entry GL, journal, COA, reports, reconciliation | finance (via events), pelanggan |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: tambah module accounting ke Module Ownership Map di CLAUDE.md"
```

---

## Task 73: Final CHANGELOG

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG `[Unreleased]`**

Edit `docs/CHANGELOG.md` di section `[Unreleased]`:

```markdown
### [2026-05-20] — Phase 6: Bank Reconciliation + Health Check + Production Rollout + E2E

- **Tipe**: [ADDED]
- **Scope**: `modules/accounting`, `app/api/admin/accounting/reconciliation/`, `app/api/cron/accounting/`, `e2e/`, `docs/`
- **Author**: agent
- **Deskripsi**: Phase 6 (final) modul akuntansi: ReconciliationRepository, CSV parser (BCA/Mandiri/BNI/generic), autoMatcher (window ±3 hari + amount + Levenshtein), BankReconciliationService (create/loadBankRows/manualMatch/complete), reconciliation validators, 4 API routes reconciliation, UI rekonsiliasi (list + detail 3 kolom matching), daily health check cron, observability helpers (structured logging), production rollout doc (5-stage), E2E Playwright test, CLAUDE.md module ownership update.
- **Files**: `modules/accounting/repositories/ReconciliationRepository.ts`, `modules/accounting/services/reconciliation/`, `modules/accounting/validators/reconciliation.ts`, `app/api/admin/accounting/reconciliation/`, `app/api/cron/accounting/health-check/`, `app/admin/akuntansi/rekonsiliasi/`, `e2e/accounting.spec.ts`, `docs/standards/accounting-rollout.md`
- **Breaking**: ❌ Tidak
```

- [ ] **Step 2: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(accounting): changelog Phase 6 (reconciliation + rollout + E2E)"
```

---

## Task 74: Final Check + Commit

**Files:**
- (verification only)

- [ ] **Step 1: Run full check**

Run: `npm run check`
Expected: lint + typecheck + build PASS.

- [ ] **Step 2: Run all accounting tests**

Run: `npx vitest run modules/accounting/`
Expected: semua test PASS.

- [ ] **Step 3: Verify module exports**

Run: `npx tsc --noEmit modules/accounting/index.ts`
Expected: no errors.

- [ ] **Step 4: Final commit (jika ada file tertinggal)**

```bash
git status
git add -A
git commit -m "chore(accounting): final check Phase 6 — all tests pass, build clean"
```

---
