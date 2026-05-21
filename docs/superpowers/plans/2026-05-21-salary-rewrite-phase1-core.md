# Salary Module Rewrite — Phase 1: Core Domain Model

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the core domain model, enums, interfaces, value objects, and Prisma schema for the new salary module rewrite.

**Architecture:** Clean Architecture with domain-driven design. Core layer defines all types, entities, interfaces (ports), and value objects that other sub-modules (calculation, tax, benefits, payment, workflow, reporting) will depend on. No business logic in this phase — pure type definitions and data contracts.

**Tech Stack:** TypeScript, Prisma ORM, Zod (validators), Vitest (tests)

**Spec Reference:** `docs/superpowers/specs/2026-05-21-salary-module-rewrite-design.md`

**Phase Dependencies:** None (this is the foundation)

**Subsequent Phases:**
- Phase 2: Calculation Engine (depends on Phase 1)
- Phase 3: Tax Engine (depends on Phase 1, 2)
- Phase 4: Benefits Engine (depends on Phase 1, 2, 3)
- Phase 5: Payment & Period (depends on Phase 1)
- Phase 6: Workflow & Compliance (depends on Phase 1, 5)
- Phase 7: Reporting & Integration (depends on all above)
- Phase 8: API Layer (depends on all above)
- Phase 9: Frontend (depends on Phase 8)
- Phase 10: Migration (depends on all above)

---

## File Structure

```
modules/salary-v2/
├── core/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── PayrollRun.ts
│   │   │   ├── PayrollEntry.ts
│   │   │   ├── PayrollLine.ts
│   │   │   ├── PayrollComponent.ts
│   │   │   ├── EmployeePayrollProfile.ts
│   │   │   ├── PaySchedule.ts
│   │   │   ├── PayrollPeriod.ts
│   │   │   ├── PayrollAuditLog.ts
│   │   │   ├── SalaryAdvance.ts
│   │   │   ├── RegionalMinimumWage.ts
│   │   │   └── index.ts
│   │   ├── enums/
│   │   │   ├── payroll-status.enum.ts
│   │   │   ├── employee-type.enum.ts
│   │   │   ├── tax-method.enum.ts
│   │   │   ├── pay-schedule.enum.ts
│   │   │   ├── component-type.enum.ts
│   │   │   ├── payment-status.enum.ts
│   │   │   └── index.ts
│   │   ├── value-objects/
│   │   │   ├── Money.ts
│   │   │   ├── Period.ts
│   │   │   ├── PtkpStatus.ts
│   │   │   └── index.ts
│   │   └── ports/
│   │       ├── IPayrollRunRepository.ts
│   │       ├── IPayrollEntryRepository.ts
│   │       ├── IPayrollComponentRepository.ts
│   │       ├── IEmployeePayrollProfileRepository.ts
│   │       ├── IPayScheduleRepository.ts
│   │       ├── IPayrollPeriodRepository.ts
│   │       ├── ISalaryAdvanceRepository.ts
│   │       ├── IRegionalMinimumWageRepository.ts
│   │       └── index.ts
│   ├── config/
│   │   ├── TenantPayrollConfig.ts
│   │   ├── BpjsConfig.ts
│   │   ├── TaxConfig.ts
│   │   ├── OvertimeConfig.ts
│   │   └── index.ts
│   ├── errors/
│   │   ├── PayrollError.ts
│   │   └── index.ts
│   └── index.ts
├── index.ts
tests/
└── modules/
    └── salary-v2/
        └── core/
            ├── domain/
            │   ├── entities.test.ts
            │   ├── value-objects.test.ts
            │   └── enums.test.ts
            └── config/
                └── config.test.ts
```

---

## Task 1: Setup Module Structure & Enums

**Files:**
- Create: `modules/salary-v2/core/domain/enums/payroll-status.enum.ts`
- Create: `modules/salary-v2/core/domain/enums/employee-type.enum.ts`
- Create: `modules/salary-v2/core/domain/enums/tax-method.enum.ts`
- Create: `modules/salary-v2/core/domain/enums/pay-schedule.enum.ts`
- Create: `modules/salary-v2/core/domain/enums/component-type.enum.ts`
- Create: `modules/salary-v2/core/domain/enums/payment-status.enum.ts`
- Create: `modules/salary-v2/core/domain/enums/index.ts`
- Test: `tests/modules/salary-v2/core/domain/enums.test.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p modules/salary-v2/core/domain/{entities,enums,value-objects,ports}
mkdir -p modules/salary-v2/core/{config,errors}
mkdir -p tests/modules/salary-v2/core/{domain,config}
```

- [ ] **Step 2: Write enum test file**

```typescript
// tests/modules/salary-v2/core/domain/enums.test.ts
import { describe, it, expect } from 'vitest';
import {
  PayrollRunStatus,
  PayrollEntryStatus,
  PayrollRunType,
  EmployeeType,
  TaxMethod,
  PayFrequency,
  ComponentCategory,
  ComponentCalculationType,
  PaymentBatchStatus,
  PaymentItemStatus,
  PayrollPeriodStatus,
  SalaryAdvanceStatus,
  AuditAction,
  ComplianceSeverity,
  OvertimeDayType,
  OvertimeCapEnforcement,
} from '@/modules/salary-v2/core/domain/enums';

describe('Salary V2 Enums', () => {
  describe('PayrollRunStatus', () => {
    it('should have all workflow statuses', () => {
      expect(PayrollRunStatus.DRAFT).toBe('DRAFT');
      expect(PayrollRunStatus.CALCULATING).toBe('CALCULATING');
      expect(PayrollRunStatus.CALCULATED).toBe('CALCULATED');
      expect(PayrollRunStatus.AUDITED).toBe('AUDITED');
      expect(PayrollRunStatus.APPROVED).toBe('APPROVED');
      expect(PayrollRunStatus.PAID).toBe('PAID');
      expect(PayrollRunStatus.CLOSED).toBe('CLOSED');
      expect(PayrollRunStatus.REJECTED).toBe('REJECTED');
      expect(PayrollRunStatus.REVISION_REQUESTED).toBe('REVISION_REQUESTED');
    });
  });

  describe('PayrollEntryStatus', () => {
    it('should have all entry statuses', () => {
      expect(PayrollEntryStatus.PENDING).toBe('PENDING');
      expect(PayrollEntryStatus.CALCULATED).toBe('CALCULATED');
      expect(PayrollEntryStatus.ERROR).toBe('ERROR');
      expect(PayrollEntryStatus.APPROVED).toBe('APPROVED');
      expect(PayrollEntryStatus.PAID).toBe('PAID');
    });
  });

  describe('PayrollRunType', () => {
    it('should have all run types', () => {
      expect(PayrollRunType.REGULAR).toBe('REGULAR');
      expect(PayrollRunType.THR).toBe('THR');
      expect(PayrollRunType.BONUS).toBe('BONUS');
      expect(PayrollRunType.RAPEL).toBe('RAPEL');
      expect(PayrollRunType.ADVANCE).toBe('ADVANCE');
    });
  });

  describe('EmployeeType', () => {
    it('should have all employee types', () => {
      expect(EmployeeType.PKWTT).toBe('PKWTT');
      expect(EmployeeType.PKWT).toBe('PKWT');
      expect(EmployeeType.DAILY).toBe('DAILY');
      expect(EmployeeType.FREELANCE).toBe('FREELANCE');
    });
  });

  describe('TaxMethod', () => {
    it('should have all tax methods', () => {
      expect(TaxMethod.NET).toBe('NET');
      expect(TaxMethod.GROSS_UP).toBe('GROSS_UP');
      expect(TaxMethod.NETT).toBe('NETT');
    });
  });

  describe('PayFrequency', () => {
    it('should have all frequencies', () => {
      expect(PayFrequency.MONTHLY).toBe('MONTHLY');
      expect(PayFrequency.BI_WEEKLY).toBe('BI_WEEKLY');
      expect(PayFrequency.WEEKLY).toBe('WEEKLY');
      expect(PayFrequency.DAILY).toBe('DAILY');
      expect(PayFrequency.ON_DEMAND).toBe('ON_DEMAND');
    });
  });

  describe('ComponentCategory', () => {
    it('should have all categories', () => {
      expect(ComponentCategory.EARNING).toBe('EARNING');
      expect(ComponentCategory.DEDUCTION).toBe('DEDUCTION');
      expect(ComponentCategory.TAX).toBe('TAX');
      expect(ComponentCategory.EMPLOYER_COST).toBe('EMPLOYER_COST');
    });
  });

  describe('ComponentCalculationType', () => {
    it('should have all calculation types', () => {
      expect(ComponentCalculationType.FIXED).toBe('FIXED');
      expect(ComponentCalculationType.PERCENTAGE).toBe('PERCENTAGE');
      expect(ComponentCalculationType.FORMULA).toBe('FORMULA');
      expect(ComponentCalculationType.PER_HOUR).toBe('PER_HOUR');
      expect(ComponentCalculationType.PER_DAY).toBe('PER_DAY');
      expect(ComponentCalculationType.PER_UNIT).toBe('PER_UNIT');
    });
  });

  describe('PaymentBatchStatus', () => {
    it('should have all batch statuses', () => {
      expect(PaymentBatchStatus.PENDING).toBe('PENDING');
      expect(PaymentBatchStatus.PROCESSING).toBe('PROCESSING');
      expect(PaymentBatchStatus.COMPLETED).toBe('COMPLETED');
      expect(PaymentBatchStatus.PARTIAL_FAILED).toBe('PARTIAL_FAILED');
    });
  });

  describe('SalaryAdvanceStatus', () => {
    it('should have all advance statuses', () => {
      expect(SalaryAdvanceStatus.PENDING).toBe('PENDING');
      expect(SalaryAdvanceStatus.APPROVED).toBe('APPROVED');
      expect(SalaryAdvanceStatus.DISBURSED).toBe('DISBURSED');
      expect(SalaryAdvanceStatus.DEDUCTED).toBe('DEDUCTED');
      expect(SalaryAdvanceStatus.REJECTED).toBe('REJECTED');
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/core/domain/enums.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement payroll-status.enum.ts**

```typescript
// modules/salary-v2/core/domain/enums/payroll-status.enum.ts
export const PayrollRunStatus = {
  DRAFT: 'DRAFT',
  CALCULATING: 'CALCULATING',
  CALCULATED: 'CALCULATED',
  AUDITED: 'AUDITED',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
} as const;

export type PayrollRunStatus = (typeof PayrollRunStatus)[keyof typeof PayrollRunStatus];

export const PayrollEntryStatus = {
  PENDING: 'PENDING',
  CALCULATED: 'CALCULATED',
  ERROR: 'ERROR',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
} as const;

export type PayrollEntryStatus = (typeof PayrollEntryStatus)[keyof typeof PayrollEntryStatus];

export const PayrollRunType = {
  REGULAR: 'REGULAR',
  THR: 'THR',
  BONUS: 'BONUS',
  RAPEL: 'RAPEL',
  ADVANCE: 'ADVANCE',
} as const;

export type PayrollRunType = (typeof PayrollRunType)[keyof typeof PayrollRunType];

export const PayrollPeriodStatus = {
  OPEN: 'OPEN',
  PROCESSING: 'PROCESSING',
  CLOSED: 'CLOSED',
  LOCKED: 'LOCKED',
} as const;

export type PayrollPeriodStatus = (typeof PayrollPeriodStatus)[keyof typeof PayrollPeriodStatus];
```

- [ ] **Step 5: Implement employee-type.enum.ts**

```typescript
// modules/salary-v2/core/domain/enums/employee-type.enum.ts
export const EmployeeType = {
  PKWTT: 'PKWTT',
  PKWT: 'PKWT',
  DAILY: 'DAILY',
  FREELANCE: 'FREELANCE',
} as const;

export type EmployeeType = (typeof EmployeeType)[keyof typeof EmployeeType];
```

- [ ] **Step 6: Implement tax-method.enum.ts**

```typescript
// modules/salary-v2/core/domain/enums/tax-method.enum.ts
export const TaxMethod = {
  NET: 'NET',
  GROSS_UP: 'GROSS_UP',
  NETT: 'NETT',
} as const;

export type TaxMethod = (typeof TaxMethod)[keyof typeof TaxMethod];
```

- [ ] **Step 7: Implement pay-schedule.enum.ts**

```typescript
// modules/salary-v2/core/domain/enums/pay-schedule.enum.ts
export const PayFrequency = {
  MONTHLY: 'MONTHLY',
  BI_WEEKLY: 'BI_WEEKLY',
  WEEKLY: 'WEEKLY',
  DAILY: 'DAILY',
  ON_DEMAND: 'ON_DEMAND',
} as const;

export type PayFrequency = (typeof PayFrequency)[keyof typeof PayFrequency];
```

- [ ] **Step 8: Implement component-type.enum.ts**

```typescript
// modules/salary-v2/core/domain/enums/component-type.enum.ts
export const ComponentCategory = {
  EARNING: 'EARNING',
  DEDUCTION: 'DEDUCTION',
  TAX: 'TAX',
  EMPLOYER_COST: 'EMPLOYER_COST',
} as const;

export type ComponentCategory = (typeof ComponentCategory)[keyof typeof ComponentCategory];

export const ComponentCalculationType = {
  FIXED: 'FIXED',
  PERCENTAGE: 'PERCENTAGE',
  FORMULA: 'FORMULA',
  PER_HOUR: 'PER_HOUR',
  PER_DAY: 'PER_DAY',
  PER_UNIT: 'PER_UNIT',
} as const;

export type ComponentCalculationType = (typeof ComponentCalculationType)[keyof typeof ComponentCalculationType];
```

- [ ] **Step 9: Implement payment-status.enum.ts**

```typescript
// modules/salary-v2/core/domain/enums/payment-status.enum.ts
export const PaymentBatchStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  PARTIAL_FAILED: 'PARTIAL_FAILED',
} as const;

export type PaymentBatchStatus = (typeof PaymentBatchStatus)[keyof typeof PaymentBatchStatus];

export const PaymentItemStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  RETRY: 'RETRY',
} as const;

export type PaymentItemStatus = (typeof PaymentItemStatus)[keyof typeof PaymentItemStatus];

export const SalaryAdvanceStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DISBURSED: 'DISBURSED',
  DEDUCTED: 'DEDUCTED',
  REJECTED: 'REJECTED',
} as const;

export type SalaryAdvanceStatus = (typeof SalaryAdvanceStatus)[keyof typeof SalaryAdvanceStatus];

export const AuditAction = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  RECALCULATED: 'RECALCULATED',
  LOCKED: 'LOCKED',
  UNLOCKED: 'UNLOCKED',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const ComplianceSeverity = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
} as const;

export type ComplianceSeverity = (typeof ComplianceSeverity)[keyof typeof ComplianceSeverity];

export const OvertimeDayType = {
  WORKDAY: 'WORKDAY',
  HOLIDAY: 'HOLIDAY',
  NATIONAL_HOLIDAY: 'NATIONAL_HOLIDAY',
} as const;

export type OvertimeDayType = (typeof OvertimeDayType)[keyof typeof OvertimeDayType];

export const OvertimeCapEnforcement = {
  HARD_BLOCK: 'HARD_BLOCK',
  SOFT_WARNING: 'SOFT_WARNING',
  LOG_ONLY: 'LOG_ONLY',
} as const;

export type OvertimeCapEnforcement = (typeof OvertimeCapEnforcement)[keyof typeof OvertimeCapEnforcement];
```

- [ ] **Step 10: Create enums barrel export**

```typescript
// modules/salary-v2/core/domain/enums/index.ts
export * from './payroll-status.enum';
export * from './employee-type.enum';
export * from './tax-method.enum';
export * from './pay-schedule.enum';
export * from './component-type.enum';
export * from './payment-status.enum';
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/core/domain/enums.test.ts`
Expected: ALL PASS

- [ ] **Step 12: Commit**

```bash
git add modules/salary-v2/core/domain/enums/ tests/modules/salary-v2/core/domain/enums.test.ts
git commit -m "feat(salary-v2): add core domain enums for payroll module rewrite"
```

---

## Task 2: Value Objects (Money, Period, PtkpStatus)

**Files:**
- Create: `modules/salary-v2/core/domain/value-objects/Money.ts`
- Create: `modules/salary-v2/core/domain/value-objects/Period.ts`
- Create: `modules/salary-v2/core/domain/value-objects/PtkpStatus.ts`
- Create: `modules/salary-v2/core/domain/value-objects/index.ts`
- Test: `tests/modules/salary-v2/core/domain/value-objects.test.ts`

- [ ] **Step 1: Write value objects test**

```typescript
// tests/modules/salary-v2/core/domain/value-objects.test.ts
import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/salary-v2/core/domain/value-objects/Money';
import { Period } from '@/modules/salary-v2/core/domain/value-objects/Period';
import { PtkpStatus, PTKP_CATEGORIES } from '@/modules/salary-v2/core/domain/value-objects/PtkpStatus';

describe('Value Objects', () => {
  describe('Money', () => {
    it('should create money with amount', () => {
      const money = Money.of(5000000);
      expect(money.amount).toBe(5000000);
    });

    it('should add two money values', () => {
      const a = Money.of(3000000);
      const b = Money.of(2000000);
      expect(a.add(b).amount).toBe(5000000);
    });

    it('should subtract money values', () => {
      const a = Money.of(5000000);
      const b = Money.of(2000000);
      expect(a.subtract(b).amount).toBe(3000000);
    });

    it('should multiply by factor', () => {
      const money = Money.of(1000000);
      expect(money.multiply(1.5).amount).toBe(1500000);
    });

    it('should round to nearest integer (floor)', () => {
      const money = Money.of(1000000);
      const result = money.multiply(0.333);
      expect(result.amount).toBe(333000);
    });

    it('should compare money values', () => {
      const a = Money.of(5000000);
      const b = Money.of(3000000);
      expect(a.isGreaterThan(b)).toBe(true);
      expect(b.isGreaterThan(a)).toBe(false);
      expect(a.isZero()).toBe(false);
      expect(Money.of(0).isZero()).toBe(true);
    });

    it('should cap at maximum', () => {
      const money = Money.of(15000000);
      const capped = money.capAt(12000000);
      expect(capped.amount).toBe(12000000);
    });

    it('should not cap if below maximum', () => {
      const money = Money.of(8000000);
      const capped = money.capAt(12000000);
      expect(capped.amount).toBe(8000000);
    });

    it('should create zero money', () => {
      expect(Money.zero().amount).toBe(0);
    });
  });

  describe('Period', () => {
    it('should create period with start and end dates', () => {
      const start = new Date('2026-04-26');
      const end = new Date('2026-05-25');
      const period = Period.of(start, end);
      expect(period.start).toEqual(start);
      expect(period.end).toEqual(end);
    });

    it('should calculate total days', () => {
      const period = Period.of(new Date('2026-05-01'), new Date('2026-05-31'));
      expect(period.totalDays).toBe(31);
    });

    it('should check if date is within period', () => {
      const period = Period.of(new Date('2026-05-01'), new Date('2026-05-31'));
      expect(period.contains(new Date('2026-05-15'))).toBe(true);
      expect(period.contains(new Date('2026-06-01'))).toBe(false);
    });

    it('should throw if start is after end', () => {
      expect(() => Period.of(new Date('2026-05-31'), new Date('2026-05-01'))).toThrow();
    });

    it('should calculate overlap days with another period', () => {
      const a = Period.of(new Date('2026-05-01'), new Date('2026-05-31'));
      const b = Period.of(new Date('2026-05-15'), new Date('2026-06-15'));
      expect(a.overlapDays(b)).toBe(17);
    });
  });

  describe('PtkpStatus', () => {
    it('should have all PTKP categories', () => {
      expect(PTKP_CATEGORIES).toContain('TK_0');
      expect(PTKP_CATEGORIES).toContain('TK_1');
      expect(PTKP_CATEGORIES).toContain('TK_2');
      expect(PTKP_CATEGORIES).toContain('TK_3');
      expect(PTKP_CATEGORIES).toContain('K_0');
      expect(PTKP_CATEGORIES).toContain('K_1');
      expect(PTKP_CATEGORIES).toContain('K_2');
      expect(PTKP_CATEGORIES).toContain('K_3');
    });

    it('should create valid PtkpStatus', () => {
      const status = PtkpStatus.of('TK_0');
      expect(status.value).toBe('TK_0');
      expect(status.isMarried()).toBe(false);
      expect(status.dependents).toBe(0);
    });

    it('should identify married status', () => {
      const status = PtkpStatus.of('K_2');
      expect(status.isMarried()).toBe(true);
      expect(status.dependents).toBe(2);
    });

    it('should throw for invalid PTKP status', () => {
      expect(() => PtkpStatus.of('INVALID')).toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/core/domain/value-objects.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement Money value object**

```typescript
// modules/salary-v2/core/domain/value-objects/Money.ts
export class Money {
  private constructor(public readonly amount: number) {}

  static of(amount: number): Money {
    return new Money(Math.floor(amount));
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return Money.of(this.amount + other.amount);
  }

  subtract(other: Money): Money {
    return Money.of(this.amount - other.amount);
  }

  multiply(factor: number): Money {
    return Money.of(this.amount * factor);
  }

  divide(divisor: number): Money {
    if (divisor === 0) throw new Error('Cannot divide by zero');
    return Money.of(this.amount / divisor);
  }

  capAt(max: number): Money {
    return this.amount > max ? Money.of(max) : this;
  }

  isGreaterThan(other: Money): boolean {
    return this.amount > other.amount;
  }

  isLessThan(other: Money): boolean {
    return this.amount < other.amount;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }
}
```

- [ ] **Step 4: Implement Period value object**

```typescript
// modules/salary-v2/core/domain/value-objects/Period.ts
export class Period {
  private constructor(
    public readonly start: Date,
    public readonly end: Date
  ) {}

  static of(start: Date, end: Date): Period {
    if (start > end) {
      throw new Error('Period start date must be before or equal to end date');
    }
    return new Period(start, end);
  }

  get totalDays(): number {
    const diffMs = this.end.getTime() - this.start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }

  overlapDays(other: Period): number {
    const overlapStart = new Date(Math.max(this.start.getTime(), other.start.getTime()));
    const overlapEnd = new Date(Math.min(this.end.getTime(), other.end.getTime()));
    if (overlapStart > overlapEnd) return 0;
    return Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }
}
```

- [ ] **Step 5: Implement PtkpStatus value object**

```typescript
// modules/salary-v2/core/domain/value-objects/PtkpStatus.ts
export const PTKP_CATEGORIES = [
  'TK_0', 'TK_1', 'TK_2', 'TK_3',
  'K_0', 'K_1', 'K_2', 'K_3',
] as const;

export type PtkpCategory = (typeof PTKP_CATEGORIES)[number];

export class PtkpStatus {
  private constructor(public readonly value: PtkpCategory) {}

  static of(value: string): PtkpStatus {
    if (!PTKP_CATEGORIES.includes(value as PtkpCategory)) {
      throw new Error(`Invalid PTKP status: ${value}. Must be one of: ${PTKP_CATEGORIES.join(', ')}`);
    }
    return new PtkpStatus(value as PtkpCategory);
  }

  isMarried(): boolean {
    return this.value.startsWith('K_');
  }

  get dependents(): number {
    return parseInt(this.value.split('_')[1], 10);
  }
}
```

- [ ] **Step 6: Create value objects barrel export**

```typescript
// modules/salary-v2/core/domain/value-objects/index.ts
export { Money } from './Money';
export { Period } from './Period';
export { PtkpStatus, PTKP_CATEGORIES, type PtkpCategory } from './PtkpStatus';
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/core/domain/value-objects.test.ts`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add modules/salary-v2/core/domain/value-objects/ tests/modules/salary-v2/core/domain/value-objects.test.ts
git commit -m "feat(salary-v2): add Money, Period, PtkpStatus value objects"
```

---

## Task 3: Domain Entities — PayrollComponent & EmployeePayrollProfile

**Files:**
- Create: `modules/salary-v2/core/domain/entities/PayrollComponent.ts`
- Create: `modules/salary-v2/core/domain/entities/EmployeePayrollProfile.ts`
- Test: `tests/modules/salary-v2/core/domain/entities.test.ts`

- [ ] **Step 1: Write entity test (part 1 — PayrollComponent & EmployeePayrollProfile)**

```typescript
// tests/modules/salary-v2/core/domain/entities.test.ts
import { describe, it, expect } from 'vitest';
import type { PayrollComponent } from '@/modules/salary-v2/core/domain/entities/PayrollComponent';
import type { EmployeePayrollProfile, BpjsEnrollment, EmployeeComponent } from '@/modules/salary-v2/core/domain/entities/EmployeePayrollProfile';
import { ComponentCategory, ComponentCalculationType } from '@/modules/salary-v2/core/domain/enums';
import { EmployeeType, TaxMethod, PayFrequency } from '@/modules/salary-v2/core/domain/enums';

describe('Domain Entities', () => {
  describe('PayrollComponent', () => {
    it('should define a valid payroll component structure', () => {
      const component: PayrollComponent = {
        id: 'comp-1',
        tenantId: 'tenant-1',
        name: 'Tunjangan Transport',
        code: 'ALW_TRANSPORT',
        category: ComponentCategory.EARNING,
        calculationType: ComponentCalculationType.FIXED,
        taxable: true,
        applicableTo: [EmployeeType.PKWTT, EmployeeType.PKWT],
        isStatutory: false,
        formula: null,
        defaultAmount: 500000,
        sortOrder: 10,
        isActive: true,
        description: 'Tunjangan transportasi bulanan',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(component.name).toBe('Tunjangan Transport');
      expect(component.category).toBe('EARNING');
      expect(component.taxable).toBe(true);
      expect(component.isStatutory).toBe(false);
    });
  });

  describe('EmployeePayrollProfile', () => {
    it('should define a valid employee payroll profile', () => {
      const bpjs: BpjsEnrollment = {
        kesehatan: true,
        jht: true,
        jp: true,
        jkk: true,
        jkm: true,
      };

      const component: EmployeeComponent = {
        componentId: 'comp-1',
        componentCode: 'ALW_TRANSPORT',
        componentName: 'Tunjangan Transport',
        category: ComponentCategory.EARNING,
        calculationType: ComponentCalculationType.FIXED,
        amount: 600000,
        isActive: true,
      };

      const profile: EmployeePayrollProfile = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        employeeType: EmployeeType.PKWTT,
        taxMethod: TaxMethod.NET,
        payScheduleId: 'schedule-monthly',
        basicSalary: 8000000,
        payPeriodDay: 25,
        ptkpStatus: 'K_1',
        npwp: '12.345.678.9-012.000',
        bpjsConfig: bpjs,
        regionCode: 'ID-JK',
        contractStart: new Date('2024-01-15'),
        contractEnd: null,
        overtimeEligible: true,
        thrEligible: true,
        components: [component],
      };

      expect(profile.employeeType).toBe('PKWTT');
      expect(profile.taxMethod).toBe('NET');
      expect(profile.bpjsConfig.kesehatan).toBe(true);
      expect(profile.components).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/core/domain/entities.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement PayrollComponent entity**

```typescript
// modules/salary-v2/core/domain/entities/PayrollComponent.ts
import type { ComponentCategory, ComponentCalculationType } from '../enums';
import type { EmployeeType } from '../enums';

export interface PayrollComponent {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  category: ComponentCategory;
  calculationType: ComponentCalculationType;
  taxable: boolean;
  applicableTo: EmployeeType[];
  isStatutory: boolean;
  formula: string | null;
  defaultAmount: number | null;
  sortOrder: number;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 4: Implement EmployeePayrollProfile entity**

```typescript
// modules/salary-v2/core/domain/entities/EmployeePayrollProfile.ts
import type { EmployeeType, TaxMethod, ComponentCategory, ComponentCalculationType } from '../enums';
import type { PtkpCategory } from '../value-objects/PtkpStatus';

export interface BpjsEnrollment {
  kesehatan: boolean;
  jht: boolean;
  jp: boolean;
  jkk: boolean;
  jkm: boolean;
}

export interface EmployeeComponent {
  componentId: string;
  componentCode: string;
  componentName: string;
  category: ComponentCategory;
  calculationType: ComponentCalculationType;
  amount: number | null;
  isActive: boolean;
}

export interface EmployeePayrollProfile {
  userId: string;
  tenantId: string;
  employeeType: EmployeeType;
  taxMethod: TaxMethod;
  payScheduleId: string;
  basicSalary: number;
  payPeriodDay: number;
  ptkpStatus: PtkpCategory;
  npwp: string | null;
  bpjsConfig: BpjsEnrollment;
  regionCode: string;
  contractStart: Date;
  contractEnd: Date | null;
  overtimeEligible: boolean;
  thrEligible: boolean;
  components: EmployeeComponent[];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/core/domain/entities.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add modules/salary-v2/core/domain/entities/PayrollComponent.ts modules/salary-v2/core/domain/entities/EmployeePayrollProfile.ts tests/modules/salary-v2/core/domain/entities.test.ts
git commit -m "feat(salary-v2): add PayrollComponent and EmployeePayrollProfile entities"
```

---

## Task 4: Domain Entities — PayrollRun, PayrollEntry, PayrollLine

**Files:**
- Create: `modules/salary-v2/core/domain/entities/PayrollRun.ts`
- Create: `modules/salary-v2/core/domain/entities/PayrollEntry.ts`
- Create: `modules/salary-v2/core/domain/entities/PayrollLine.ts`
- Modify: `tests/modules/salary-v2/core/domain/entities.test.ts`

- [ ] **Step 1: Add tests for PayrollRun, PayrollEntry, PayrollLine**

Append to `tests/modules/salary-v2/core/domain/entities.test.ts`:

```typescript
import type { PayrollRun } from '@/modules/salary-v2/core/domain/entities/PayrollRun';
import type { PayrollEntry } from '@/modules/salary-v2/core/domain/entities/PayrollEntry';
import type { PayrollLine } from '@/modules/salary-v2/core/domain/entities/PayrollLine';
import { PayrollRunStatus, PayrollRunType, PayrollEntryStatus } from '@/modules/salary-v2/core/domain/enums';

// Add inside the main describe block:

  describe('PayrollRun', () => {
    it('should define a valid payroll run structure', () => {
      const run: PayrollRun = {
        id: 'run-1',
        tenantId: 'tenant-1',
        scheduleId: 'schedule-monthly',
        type: PayrollRunType.REGULAR,
        status: PayrollRunStatus.DRAFT,
        periodStart: new Date('2026-04-26'),
        periodEnd: new Date('2026-05-25'),
        payDate: new Date('2026-05-28'),
        totalEntries: 0,
        totalNetSalary: 0,
        totalEmployerCost: 0,
        lockedAt: null,
        lockedBy: null,
        notes: null,
        createdBy: 'user-admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(run.type).toBe('REGULAR');
      expect(run.status).toBe('DRAFT');
    });
  });

  describe('PayrollEntry', () => {
    it('should define a valid payroll entry structure', () => {
      const entry: PayrollEntry = {
        id: 'entry-1',
        payrollRunId: 'run-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        employeeType: EmployeeType.PKWTT,
        taxMethod: TaxMethod.NET,
        basicSalary: 8000000,
        effectiveSalary: 8000000,
        totalEarnings: 9500000,
        totalDeductions: 480000,
        totalTax: 285000,
        netSalary: 8735000,
        employerCost: 720000,
        status: PayrollEntryStatus.CALCULATED,
        errorMessage: null,
        calculatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(entry.status).toBe('CALCULATED');
      expect(entry.netSalary).toBe(8735000);
    });
  });

  describe('PayrollLine', () => {
    it('should define a valid payroll line structure', () => {
      const line: PayrollLine = {
        id: 'line-1',
        entryId: 'entry-1',
        tenantId: 'tenant-1',
        componentId: 'comp-1',
        componentCode: 'BASIC_SALARY',
        componentName: 'Gaji Pokok',
        category: ComponentCategory.EARNING,
        quantity: 1,
        rate: 8000000,
        amount: 8000000,
        formula: 'basicSalary',
        metadata: null,
        sortOrder: 1,
      };

      expect(line.category).toBe('EARNING');
      expect(line.amount).toBe(8000000);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/core/domain/entities.test.ts`
Expected: FAIL — new imports not found

- [ ] **Step 3: Implement PayrollRun entity**

```typescript
// modules/salary-v2/core/domain/entities/PayrollRun.ts
import type { PayrollRunStatus, PayrollRunType } from '../enums';

export interface PayrollRun {
  id: string;
  tenantId: string;
  scheduleId: string;
  type: PayrollRunType;
  status: PayrollRunStatus;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  totalEntries: number;
  totalNetSalary: number;
  totalEmployerCost: number;
  lockedAt: Date | null;
  lockedBy: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 4: Implement PayrollEntry entity**

```typescript
// modules/salary-v2/core/domain/entities/PayrollEntry.ts
import type { PayrollEntryStatus, EmployeeType, TaxMethod } from '../enums';

export interface PayrollEntry {
  id: string;
  payrollRunId: string;
  tenantId: string;
  userId: string;
  employeeType: EmployeeType;
  taxMethod: TaxMethod;
  basicSalary: number;
  effectiveSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalTax: number;
  netSalary: number;
  employerCost: number;
  status: PayrollEntryStatus;
  errorMessage: string | null;
  calculatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 5: Implement PayrollLine entity**

```typescript
// modules/salary-v2/core/domain/entities/PayrollLine.ts
import type { ComponentCategory } from '../enums';

export interface PayrollLine {
  id: string;
  entryId: string;
  tenantId: string;
  componentId: string | null;
  componentCode: string;
  componentName: string;
  category: ComponentCategory;
  quantity: number;
  rate: number;
  amount: number;
  formula: string | null;
  metadata: Record<string, unknown> | null;
  sortOrder: number;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/core/domain/entities.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add modules/salary-v2/core/domain/entities/PayrollRun.ts modules/salary-v2/core/domain/entities/PayrollEntry.ts modules/salary-v2/core/domain/entities/PayrollLine.ts tests/modules/salary-v2/core/domain/entities.test.ts
git commit -m "feat(salary-v2): add PayrollRun, PayrollEntry, PayrollLine entities"
```

---

## Task 5: Domain Entities — PaySchedule, PayrollPeriod, PayrollAuditLog, SalaryAdvance, RegionalMinimumWage

**Files:**
- Create: `modules/salary-v2/core/domain/entities/PaySchedule.ts`
- Create: `modules/salary-v2/core/domain/entities/PayrollPeriod.ts`
- Create: `modules/salary-v2/core/domain/entities/PayrollAuditLog.ts`
- Create: `modules/salary-v2/core/domain/entities/SalaryAdvance.ts`
- Create: `modules/salary-v2/core/domain/entities/RegionalMinimumWage.ts`
- Create: `modules/salary-v2/core/domain/entities/index.ts`
- Modify: `tests/modules/salary-v2/core/domain/entities.test.ts`

- [ ] **Step 1: Add tests for remaining entities**

Append to `tests/modules/salary-v2/core/domain/entities.test.ts`:

```typescript
import type { PaySchedule } from '@/modules/salary-v2/core/domain/entities/PaySchedule';
import type { PayrollPeriod } from '@/modules/salary-v2/core/domain/entities/PayrollPeriod';
import type { PayrollAuditLog } from '@/modules/salary-v2/core/domain/entities/PayrollAuditLog';
import type { SalaryAdvance } from '@/modules/salary-v2/core/domain/entities/SalaryAdvance';
import type { RegionalMinimumWage } from '@/modules/salary-v2/core/domain/entities/RegionalMinimumWage';
import { PayFrequency, PayrollPeriodStatus, AuditAction, SalaryAdvanceStatus } from '@/modules/salary-v2/core/domain/enums';

// Add inside the main describe block:

  describe('PaySchedule', () => {
    it('should define a valid pay schedule', () => {
      const schedule: PaySchedule = {
        id: 'schedule-1',
        tenantId: 'tenant-1',
        name: 'Bulanan Standar',
        frequency: PayFrequency.MONTHLY,
        cutOffDay: 25,
        cutOffDayOfWeek: null,
        payDay: 28,
        payDayOffset: null,
        gracePeriodDays: 3,
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(schedule.frequency).toBe('MONTHLY');
      expect(schedule.cutOffDay).toBe(25);
      expect(schedule.isDefault).toBe(true);
    });
  });

  describe('PayrollPeriod', () => {
    it('should define a valid payroll period', () => {
      const period: PayrollPeriod = {
        id: 'period-1',
        tenantId: 'tenant-1',
        scheduleId: 'schedule-1',
        periodStart: new Date('2026-04-26'),
        periodEnd: new Date('2026-05-25'),
        payDate: new Date('2026-05-28'),
        status: PayrollPeriodStatus.OPEN,
        lockedAt: null,
        lockedBy: null,
        unlockReason: null,
        unlockCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(period.status).toBe('OPEN');
      expect(period.unlockCount).toBe(0);
    });
  });

  describe('PayrollAuditLog', () => {
    it('should define a valid audit log entry', () => {
      const log: PayrollAuditLog = {
        id: 'log-1',
        tenantId: 'tenant-1',
        entityType: 'PAYROLL_RUN',
        entityId: 'run-1',
        action: AuditAction.STATUS_CHANGED,
        performedBy: 'user-admin',
        timestamp: new Date(),
        changes: [
          { field: 'status', oldValue: 'DRAFT', newValue: 'CALCULATING' },
        ],
        reason: null,
        ipAddress: '192.168.1.1',
      };

      expect(log.action).toBe('STATUS_CHANGED');
      expect(log.changes).toHaveLength(1);
    });
  });

  describe('SalaryAdvance', () => {
    it('should define a valid salary advance', () => {
      const advance: SalaryAdvance = {
        id: 'advance-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        amount: 2000000,
        requestDate: new Date(),
        approvedBy: null,
        approvedAt: null,
        status: SalaryAdvanceStatus.PENDING,
        deductionMethod: 'FULL_NEXT',
        installmentCount: null,
        remainingAmount: 2000000,
        reason: 'Keperluan mendesak',
        rejectionReason: null,
        disbursedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(advance.status).toBe('PENDING');
      expect(advance.amount).toBe(2000000);
    });
  });

  describe('RegionalMinimumWage', () => {
    it('should define a valid UMR entry', () => {
      const umr: RegionalMinimumWage = {
        id: 'umr-1',
        tenantId: 'tenant-1',
        regionCode: 'ID-JK',
        regionName: 'DKI Jakarta',
        year: 2026,
        monthlyAmount: 5067381,
        dailyAmount: 241304,
        effectiveDate: new Date('2026-01-01'),
        source: 'Pergub DKI Jakarta No. 120/2025',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(umr.regionCode).toBe('ID-JK');
      expect(umr.monthlyAmount).toBe(5067381);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/core/domain/entities.test.ts`
Expected: FAIL — new imports not found

- [ ] **Step 3: Implement PaySchedule entity**

```typescript
// modules/salary-v2/core/domain/entities/PaySchedule.ts
import type { PayFrequency } from '../enums';

export interface PaySchedule {
  id: string;
  tenantId: string;
  name: string;
  frequency: PayFrequency;
  cutOffDay: number | null;
  cutOffDayOfWeek: number | null;
  payDay: number;
  payDayOffset: number | null;
  gracePeriodDays: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 4: Implement PayrollPeriod entity**

```typescript
// modules/salary-v2/core/domain/entities/PayrollPeriod.ts
import type { PayrollPeriodStatus } from '../enums';

export interface PayrollPeriod {
  id: string;
  tenantId: string;
  scheduleId: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  status: PayrollPeriodStatus;
  lockedAt: Date | null;
  lockedBy: string | null;
  unlockReason: string | null;
  unlockCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 5: Implement PayrollAuditLog entity**

```typescript
// modules/salary-v2/core/domain/entities/PayrollAuditLog.ts
import type { AuditAction } from '../enums';

export type AuditEntityType = 'PAYROLL_RUN' | 'PAYROLL_ENTRY' | 'PAYROLL_LINE' | 'CONFIG' | 'COMPONENT' | 'PROFILE';

export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface PayrollAuditLog {
  id: string;
  tenantId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  performedBy: string;
  timestamp: Date;
  changes: AuditChange[];
  reason: string | null;
  ipAddress: string | null;
}
```

- [ ] **Step 6: Implement SalaryAdvance entity**

```typescript
// modules/salary-v2/core/domain/entities/SalaryAdvance.ts
import type { SalaryAdvanceStatus } from '../enums';

export type DeductionMethod = 'FULL_NEXT' | 'INSTALLMENT';

export interface SalaryAdvance {
  id: string;
  tenantId: string;
  userId: string;
  amount: number;
  requestDate: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  status: SalaryAdvanceStatus;
  deductionMethod: DeductionMethod;
  installmentCount: number | null;
  remainingAmount: number;
  reason: string | null;
  rejectionReason: string | null;
  disbursedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 7: Implement RegionalMinimumWage entity**

```typescript
// modules/salary-v2/core/domain/entities/RegionalMinimumWage.ts
export interface RegionalMinimumWage {
  id: string;
  tenantId: string;
  regionCode: string;
  regionName: string;
  year: number;
  monthlyAmount: number;
  dailyAmount: number | null;
  effectiveDate: Date;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 8: Create entities barrel export**

```typescript
// modules/salary-v2/core/domain/entities/index.ts
export type { PayrollRun } from './PayrollRun';
export type { PayrollEntry } from './PayrollEntry';
export type { PayrollLine } from './PayrollLine';
export type { PayrollComponent } from './PayrollComponent';
export type { EmployeePayrollProfile, BpjsEnrollment, EmployeeComponent } from './EmployeePayrollProfile';
export type { PaySchedule } from './PaySchedule';
export type { PayrollPeriod } from './PayrollPeriod';
export type { PayrollAuditLog, AuditChange, AuditEntityType } from './PayrollAuditLog';
export type { SalaryAdvance, DeductionMethod } from './SalaryAdvance';
export type { RegionalMinimumWage } from './RegionalMinimumWage';
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/core/domain/entities.test.ts`
Expected: ALL PASS

- [ ] **Step 10: Commit**

```bash
git add modules/salary-v2/core/domain/entities/ tests/modules/salary-v2/core/domain/entities.test.ts
git commit -m "feat(salary-v2): add PaySchedule, PayrollPeriod, AuditLog, SalaryAdvance, UMR entities"
```

---

## Task 6: Configuration Types (TenantPayrollConfig, BpjsConfig, TaxConfig, OvertimeConfig)

**Files:**
- Create: `modules/salary-v2/core/config/TenantPayrollConfig.ts`
- Create: `modules/salary-v2/core/config/BpjsConfig.ts`
- Create: `modules/salary-v2/core/config/TaxConfig.ts`
- Create: `modules/salary-v2/core/config/OvertimeConfig.ts`
- Create: `modules/salary-v2/core/config/index.ts`
- Test: `tests/modules/salary-v2/core/config/config.test.ts`

- [ ] **Step 1: Write config test**

```typescript
// tests/modules/salary-v2/core/config/config.test.ts
import { describe, it, expect } from 'vitest';
import type { TenantPayrollConfig } from '@/modules/salary-v2/core/config/TenantPayrollConfig';
import type { BpjsRateConfig } from '@/modules/salary-v2/core/config/BpjsConfig';
import type { TenantTaxConfig, TerBracket, ProgressiveRate } from '@/modules/salary-v2/core/config/TaxConfig';
import type { OvertimeConfig, OvertimeTier } from '@/modules/salary-v2/core/config/OvertimeConfig';
import { DEFAULT_BPJS_CONFIG } from '@/modules/salary-v2/core/config/BpjsConfig';
import { DEFAULT_TAX_CONFIG } from '@/modules/salary-v2/core/config/TaxConfig';
import { DEFAULT_OVERTIME_CONFIG } from '@/modules/salary-v2/core/config/OvertimeConfig';
import { OvertimeDayType, OvertimeCapEnforcement, TaxMethod } from '@/modules/salary-v2/core/domain/enums';

describe('Configuration Types', () => {
  describe('BpjsConfig', () => {
    it('should have correct default BPJS rates', () => {
      expect(DEFAULT_BPJS_CONFIG.kesehatan.employeeRate).toBe(0.01);
      expect(DEFAULT_BPJS_CONFIG.kesehatan.employerRate).toBe(0.04);
      expect(DEFAULT_BPJS_CONFIG.kesehatan.maxBase).toBe(12000000);
      expect(DEFAULT_BPJS_CONFIG.jht.employeeRate).toBe(0.02);
      expect(DEFAULT_BPJS_CONFIG.jht.employerRate).toBe(0.037);
      expect(DEFAULT_BPJS_CONFIG.jp.employeeRate).toBe(0.01);
      expect(DEFAULT_BPJS_CONFIG.jp.employerRate).toBe(0.02);
      expect(DEFAULT_BPJS_CONFIG.jp.maxBase).toBe(10042000);
      expect(DEFAULT_BPJS_CONFIG.jp.maxAge).toBe(57);
      expect(DEFAULT_BPJS_CONFIG.jkk.employerRate).toBe(0.0024);
      expect(DEFAULT_BPJS_CONFIG.jkm.employerRate).toBe(0.003);
    });
  });

  describe('TaxConfig', () => {
    it('should have correct default tax config', () => {
      expect(DEFAULT_TAX_CONFIG.defaultMethod).toBe('NET');
      expect(DEFAULT_TAX_CONFIG.npwpSurcharge).toBe(0.20);
      expect(DEFAULT_TAX_CONFIG.biayaJabatanRate).toBe(0.05);
      expect(DEFAULT_TAX_CONFIG.biayaJabatanMax).toBe(500000);
      expect(DEFAULT_TAX_CONFIG.biayaJabatanMaxAnnual).toBe(6000000);
      expect(DEFAULT_TAX_CONFIG.annualCorrectionMonth).toBe(12);
    });

    it('should have progressive rates matching Pasal 17', () => {
      const rates = DEFAULT_TAX_CONFIG.progressiveRates;
      expect(rates).toHaveLength(5);
      expect(rates[0]).toEqual({ minAmount: 0, maxAmount: 60000000, rate: 0.05 });
      expect(rates[1]).toEqual({ minAmount: 60000000, maxAmount: 250000000, rate: 0.15 });
      expect(rates[2]).toEqual({ minAmount: 250000000, maxAmount: 500000000, rate: 0.25 });
      expect(rates[3]).toEqual({ minAmount: 500000000, maxAmount: 5000000000, rate: 0.30 });
      expect(rates[4]).toEqual({ minAmount: 5000000000, maxAmount: null, rate: 0.35 });
    });
  });

  describe('OvertimeConfig', () => {
    it('should have correct default overtime config (PP 35/2021)', () => {
      expect(DEFAULT_OVERTIME_CONFIG.maxHoursPerDay).toBe(4);
      expect(DEFAULT_OVERTIME_CONFIG.maxHoursPerWeek).toBe(18);
      expect(DEFAULT_OVERTIME_CONFIG.rateBase).toBe('1/173');
      expect(DEFAULT_OVERTIME_CONFIG.capEnforcement).toBe('SOFT_WARNING');
    });

    it('should have correct workday tiers', () => {
      const workdayTiers = DEFAULT_OVERTIME_CONFIG.tiers.filter(
        t => t.dayType === OvertimeDayType.WORKDAY
      );
      expect(workdayTiers).toHaveLength(2);
      expect(workdayTiers[0]).toEqual({
        dayType: 'WORKDAY', fromHour: 0, toHour: 1, multiplier: 1.5,
      });
      expect(workdayTiers[1]).toEqual({
        dayType: 'WORKDAY', fromHour: 1, toHour: null, multiplier: 2,
      });
    });

    it('should have correct holiday tiers', () => {
      const holidayTiers = DEFAULT_OVERTIME_CONFIG.tiers.filter(
        t => t.dayType === OvertimeDayType.HOLIDAY
      );
      expect(holidayTiers).toHaveLength(3);
      expect(holidayTiers[0].multiplier).toBe(2);
      expect(holidayTiers[1].multiplier).toBe(3);
      expect(holidayTiers[2].multiplier).toBe(4);
    });
  });

  describe('TenantPayrollConfig', () => {
    it('should compose all sub-configs', () => {
      const config: TenantPayrollConfig = {
        tenantId: 'tenant-1',
        bpjs: DEFAULT_BPJS_CONFIG,
        tax: DEFAULT_TAX_CONFIG,
        overtime: DEFAULT_OVERTIME_CONFIG,
        thrConfig: {
          eligibleAfterMonths: 1,
          fullEntitlementMonths: 12,
          prorata: true,
          components: ['BASIC_SALARY'],
          paymentDeadlineDays: 7,
        },
        advancePolicy: {
          maxPercentOfSalary: 0.30,
          maxActiveAdvances: 2,
          minDaysBetweenRequests: 30,
          approvalRequired: true,
          deductionMethod: 'FULL_NEXT',
          maxInstallments: 6,
        },
        periodLocking: {
          autoLockAfterPaid: true,
          autoLockDelayDays: 3,
          requireApprovalToUnlock: true,
          maxUnlockCount: 2,
        },
      };

      expect(config.bpjs.kesehatan.employeeRate).toBe(0.01);
      expect(config.thrConfig.eligibleAfterMonths).toBe(1);
      expect(config.advancePolicy.maxPercentOfSalary).toBe(0.30);
      expect(config.periodLocking.autoLockAfterPaid).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/core/config/config.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement BpjsConfig**

```typescript
// modules/salary-v2/core/config/BpjsConfig.ts
export interface BpjsProgramRate {
  employeeRate: number;
  employerRate: number;
  maxBase: number | null;
  maxAge?: number;
}

export interface BpjsEmployerOnlyRate {
  employerRate: number;
  riskCategory?: number;
}

export interface BpjsRateConfig {
  kesehatan: BpjsProgramRate;
  jht: BpjsProgramRate;
  jp: BpjsProgramRate & { maxAge: number };
  jkk: BpjsEmployerOnlyRate;
  jkm: BpjsEmployerOnlyRate;
}

export const DEFAULT_BPJS_CONFIG: BpjsRateConfig = {
  kesehatan: { employeeRate: 0.01, employerRate: 0.04, maxBase: 12000000 },
  jht: { employeeRate: 0.02, employerRate: 0.037, maxBase: null },
  jp: { employeeRate: 0.01, employerRate: 0.02, maxBase: 10042000, maxAge: 57 },
  jkk: { employerRate: 0.0024, riskCategory: 1 },
  jkm: { employerRate: 0.003 },
};
```

- [ ] **Step 4: Implement TaxConfig**

```typescript
// modules/salary-v2/core/config/TaxConfig.ts
import type { TaxMethod } from '../domain/enums';

export interface ProgressiveRate {
  minAmount: number;
  maxAmount: number | null;
  rate: number;
}

export interface TerBracket {
  ptkpGroup: string;
  minIncome: number;
  maxIncome: number | null;
  rate: number;
}

export interface PtkpAmount {
  status: string;
  annualAmount: number;
}

export interface TenantTaxConfig {
  defaultMethod: TaxMethod;
  terYear: number;
  npwpSurcharge: number;
  annualCorrectionMonth: number;
  biayaJabatanRate: number;
  biayaJabatanMax: number;
  biayaJabatanMaxAnnual: number;
  progressiveRates: ProgressiveRate[];
  terBrackets: TerBracket[];
  ptkpTable: PtkpAmount[];
}

export const DEFAULT_TAX_CONFIG: TenantTaxConfig = {
  defaultMethod: 'NET',
  terYear: 2024,
  npwpSurcharge: 0.20,
  annualCorrectionMonth: 12,
  biayaJabatanRate: 0.05,
  biayaJabatanMax: 500000,
  biayaJabatanMaxAnnual: 6000000,
  progressiveRates: [
    { minAmount: 0, maxAmount: 60000000, rate: 0.05 },
    { minAmount: 60000000, maxAmount: 250000000, rate: 0.15 },
    { minAmount: 250000000, maxAmount: 500000000, rate: 0.25 },
    { minAmount: 500000000, maxAmount: 5000000000, rate: 0.30 },
    { minAmount: 5000000000, maxAmount: null, rate: 0.35 },
  ],
  terBrackets: [],
  ptkpTable: [
    { status: 'TK_0', annualAmount: 54000000 },
    { status: 'TK_1', annualAmount: 58500000 },
    { status: 'TK_2', annualAmount: 63000000 },
    { status: 'TK_3', annualAmount: 67500000 },
    { status: 'K_0', annualAmount: 58500000 },
    { status: 'K_1', annualAmount: 63000000 },
    { status: 'K_2', annualAmount: 67500000 },
    { status: 'K_3', annualAmount: 72000000 },
  ],
};
```

- [ ] **Step 5: Implement OvertimeConfig**

```typescript
// modules/salary-v2/core/config/OvertimeConfig.ts
import type { OvertimeDayType, OvertimeCapEnforcement } from '../domain/enums';

export interface OvertimeTier {
  dayType: OvertimeDayType;
  fromHour: number;
  toHour: number | null;
  multiplier: number;
}

export interface OvertimeConfig {
  maxHoursPerDay: number;
  maxHoursPerWeek: number;
  maxHoursPerMonth: number | null;
  rateBase: '1/173' | 'custom';
  customRateBase: number | null;
  capEnforcement: OvertimeCapEnforcement;
  exceptionRoles: string[];
  tiers: OvertimeTier[];
}

export const DEFAULT_OVERTIME_CONFIG: OvertimeConfig = {
  maxHoursPerDay: 4,
  maxHoursPerWeek: 18,
  maxHoursPerMonth: null,
  rateBase: '1/173',
  customRateBase: null,
  capEnforcement: 'SOFT_WARNING',
  exceptionRoles: [],
  tiers: [
    { dayType: 'WORKDAY', fromHour: 0, toHour: 1, multiplier: 1.5 },
    { dayType: 'WORKDAY', fromHour: 1, toHour: null, multiplier: 2 },
    { dayType: 'HOLIDAY', fromHour: 0, toHour: 7, multiplier: 2 },
    { dayType: 'HOLIDAY', fromHour: 7, toHour: 8, multiplier: 3 },
    { dayType: 'HOLIDAY', fromHour: 8, toHour: null, multiplier: 4 },
    { dayType: 'NATIONAL_HOLIDAY', fromHour: 0, toHour: 5, multiplier: 2 },
    { dayType: 'NATIONAL_HOLIDAY', fromHour: 5, toHour: 6, multiplier: 3 },
    { dayType: 'NATIONAL_HOLIDAY', fromHour: 6, toHour: null, multiplier: 4 },
  ],
};
```

- [ ] **Step 6: Implement TenantPayrollConfig**

```typescript
// modules/salary-v2/core/config/TenantPayrollConfig.ts
import type { BpjsRateConfig } from './BpjsConfig';
import type { TenantTaxConfig } from './TaxConfig';
import type { OvertimeConfig } from './OvertimeConfig';
import type { DeductionMethod } from '../domain/entities/SalaryAdvance';

export interface ThrConfig {
  eligibleAfterMonths: number;
  fullEntitlementMonths: number;
  prorata: boolean;
  components: string[];
  paymentDeadlineDays: number;
}

export interface SalaryAdvancePolicy {
  maxPercentOfSalary: number;
  maxActiveAdvances: number;
  minDaysBetweenRequests: number;
  approvalRequired: boolean;
  deductionMethod: DeductionMethod;
  maxInstallments: number;
}

export interface PeriodLockingPolicy {
  autoLockAfterPaid: boolean;
  autoLockDelayDays: number;
  requireApprovalToUnlock: boolean;
  maxUnlockCount: number;
}

export interface TenantPayrollConfig {
  tenantId: string;
  bpjs: BpjsRateConfig;
  tax: TenantTaxConfig;
  overtime: OvertimeConfig;
  thrConfig: ThrConfig;
  advancePolicy: SalaryAdvancePolicy;
  periodLocking: PeriodLockingPolicy;
}
```

- [ ] **Step 7: Create config barrel export**

```typescript
// modules/salary-v2/core/config/index.ts
export type { TenantPayrollConfig, ThrConfig, SalaryAdvancePolicy, PeriodLockingPolicy } from './TenantPayrollConfig';
export type { BpjsRateConfig, BpjsProgramRate, BpjsEmployerOnlyRate } from './BpjsConfig';
export { DEFAULT_BPJS_CONFIG } from './BpjsConfig';
export type { TenantTaxConfig, ProgressiveRate, TerBracket, PtkpAmount } from './TaxConfig';
export { DEFAULT_TAX_CONFIG } from './TaxConfig';
export type { OvertimeConfig, OvertimeTier } from './OvertimeConfig';
export { DEFAULT_OVERTIME_CONFIG } from './OvertimeConfig';
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/core/config/config.test.ts`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add modules/salary-v2/core/config/ tests/modules/salary-v2/core/config/
git commit -m "feat(salary-v2): add TenantPayrollConfig, BPJS, Tax, Overtime configs with defaults"
```

---

## Task 7: Repository Ports (Interfaces)

**Files:**
- Create: `modules/salary-v2/core/domain/ports/IPayrollRunRepository.ts`
- Create: `modules/salary-v2/core/domain/ports/IPayrollEntryRepository.ts`
- Create: `modules/salary-v2/core/domain/ports/IPayrollComponentRepository.ts`
- Create: `modules/salary-v2/core/domain/ports/IEmployeePayrollProfileRepository.ts`
- Create: `modules/salary-v2/core/domain/ports/IPayScheduleRepository.ts`
- Create: `modules/salary-v2/core/domain/ports/IPayrollPeriodRepository.ts`
- Create: `modules/salary-v2/core/domain/ports/ISalaryAdvanceRepository.ts`
- Create: `modules/salary-v2/core/domain/ports/IRegionalMinimumWageRepository.ts`
- Create: `modules/salary-v2/core/domain/ports/index.ts`

- [ ] **Step 1: Implement IPayrollRunRepository**

```typescript
// modules/salary-v2/core/domain/ports/IPayrollRunRepository.ts
import type { PayrollRun } from '../entities/PayrollRun';
import type { PayrollRunStatus, PayrollRunType } from '../enums';

export interface PayrollRunFilter {
  tenantId: string;
  scheduleId?: string;
  type?: PayrollRunType;
  status?: PayrollRunStatus;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface IPayrollRunRepository {
  findById(id: string, tenantId: string): Promise<PayrollRun | null>;
  findAll(filter: PayrollRunFilter): Promise<PayrollRun[]>;
  create(data: Omit<PayrollRun, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollRun>;
  update(id: string, tenantId: string, data: Partial<PayrollRun>): Promise<PayrollRun>;
  updateStatus(id: string, tenantId: string, status: PayrollRunStatus): Promise<PayrollRun>;
  delete(id: string, tenantId: string): Promise<void>;
}
```

- [ ] **Step 2: Implement IPayrollEntryRepository**

```typescript
// modules/salary-v2/core/domain/ports/IPayrollEntryRepository.ts
import type { PayrollEntry } from '../entities/PayrollEntry';
import type { PayrollLine } from '../entities/PayrollLine';
import type { PayrollEntryStatus } from '../enums';

export interface PayrollEntryWithLines extends PayrollEntry {
  lines: PayrollLine[];
}

export interface IPayrollEntryRepository {
  findById(id: string, tenantId: string): Promise<PayrollEntryWithLines | null>;
  findByRunId(runId: string, tenantId: string): Promise<PayrollEntry[]>;
  findByUserAndRun(userId: string, runId: string, tenantId: string): Promise<PayrollEntryWithLines | null>;
  create(data: Omit<PayrollEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollEntry>;
  createMany(data: Omit<PayrollEntry, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<PayrollEntry[]>;
  update(id: string, tenantId: string, data: Partial<PayrollEntry>): Promise<PayrollEntry>;
  updateStatus(id: string, tenantId: string, status: PayrollEntryStatus, errorMessage?: string): Promise<PayrollEntry>;
  delete(id: string, tenantId: string): Promise<void>;
  deleteByRunId(runId: string, tenantId: string): Promise<void>;
  setLines(entryId: string, tenantId: string, lines: Omit<PayrollLine, 'id'>[]): Promise<PayrollLine[]>;
  clearLines(entryId: string, tenantId: string): Promise<void>;
}
```

- [ ] **Step 3: Implement IPayrollComponentRepository**

```typescript
// modules/salary-v2/core/domain/ports/IPayrollComponentRepository.ts
import type { PayrollComponent } from '../entities/PayrollComponent';
import type { ComponentCategory } from '../enums';

export interface ComponentFilter {
  tenantId: string;
  category?: ComponentCategory;
  isActive?: boolean;
  isStatutory?: boolean;
}

export interface IPayrollComponentRepository {
  findById(id: string, tenantId: string): Promise<PayrollComponent | null>;
  findByCode(code: string, tenantId: string): Promise<PayrollComponent | null>;
  findAll(filter: ComponentFilter): Promise<PayrollComponent[]>;
  create(data: Omit<PayrollComponent, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollComponent>;
  update(id: string, tenantId: string, data: Partial<PayrollComponent>): Promise<PayrollComponent>;
  delete(id: string, tenantId: string): Promise<void>;
}
```

- [ ] **Step 4: Implement IEmployeePayrollProfileRepository**

```typescript
// modules/salary-v2/core/domain/ports/IEmployeePayrollProfileRepository.ts
import type { EmployeePayrollProfile, EmployeeComponent } from '../entities/EmployeePayrollProfile';
import type { EmployeeType } from '../enums';

export interface ProfileFilter {
  tenantId: string;
  employeeType?: EmployeeType;
  payScheduleId?: string;
  departmentId?: string;
  siteId?: string;
  isActive?: boolean;
}

export interface IEmployeePayrollProfileRepository {
  findByUserId(userId: string, tenantId: string): Promise<EmployeePayrollProfile | null>;
  findAll(filter: ProfileFilter): Promise<EmployeePayrollProfile[]>;
  create(data: EmployeePayrollProfile): Promise<EmployeePayrollProfile>;
  update(userId: string, tenantId: string, data: Partial<EmployeePayrollProfile>): Promise<EmployeePayrollProfile>;
  assignComponent(userId: string, tenantId: string, component: EmployeeComponent): Promise<void>;
  removeComponent(userId: string, tenantId: string, componentId: string): Promise<void>;
  updateComponent(userId: string, tenantId: string, componentId: string, data: Partial<EmployeeComponent>): Promise<void>;
}
```

- [ ] **Step 5: Implement IPayScheduleRepository**

```typescript
// modules/salary-v2/core/domain/ports/IPayScheduleRepository.ts
import type { PaySchedule } from '../entities/PaySchedule';

export interface IPayScheduleRepository {
  findById(id: string, tenantId: string): Promise<PaySchedule | null>;
  findDefault(tenantId: string): Promise<PaySchedule | null>;
  findAll(tenantId: string): Promise<PaySchedule[]>;
  create(data: Omit<PaySchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaySchedule>;
  update(id: string, tenantId: string, data: Partial<PaySchedule>): Promise<PaySchedule>;
  delete(id: string, tenantId: string): Promise<void>;
}
```

- [ ] **Step 6: Implement IPayrollPeriodRepository**

```typescript
// modules/salary-v2/core/domain/ports/IPayrollPeriodRepository.ts
import type { PayrollPeriod } from '../entities/PayrollPeriod';
import type { PayrollPeriodStatus } from '../enums';

export interface PeriodFilter {
  tenantId: string;
  scheduleId?: string;
  status?: PayrollPeriodStatus;
  fromDate?: Date;
  toDate?: Date;
}

export interface IPayrollPeriodRepository {
  findById(id: string, tenantId: string): Promise<PayrollPeriod | null>;
  findCurrent(scheduleId: string, tenantId: string): Promise<PayrollPeriod | null>;
  findAll(filter: PeriodFilter): Promise<PayrollPeriod[]>;
  create(data: Omit<PayrollPeriod, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollPeriod>;
  update(id: string, tenantId: string, data: Partial<PayrollPeriod>): Promise<PayrollPeriod>;
  updateStatus(id: string, tenantId: string, status: PayrollPeriodStatus): Promise<PayrollPeriod>;
  checkOverlap(scheduleId: string, tenantId: string, start: Date, end: Date, excludeId?: string): Promise<boolean>;
}
```

- [ ] **Step 7: Implement ISalaryAdvanceRepository**

```typescript
// modules/salary-v2/core/domain/ports/ISalaryAdvanceRepository.ts
import type { SalaryAdvance } from '../entities/SalaryAdvance';
import type { SalaryAdvanceStatus } from '../enums';

export interface AdvanceFilter {
  tenantId: string;
  userId?: string;
  status?: SalaryAdvanceStatus;
}

export interface ISalaryAdvanceRepository {
  findById(id: string, tenantId: string): Promise<SalaryAdvance | null>;
  findActiveByUser(userId: string, tenantId: string): Promise<SalaryAdvance[]>;
  findAll(filter: AdvanceFilter): Promise<SalaryAdvance[]>;
  create(data: Omit<SalaryAdvance, 'id' | 'createdAt' | 'updatedAt'>): Promise<SalaryAdvance>;
  update(id: string, tenantId: string, data: Partial<SalaryAdvance>): Promise<SalaryAdvance>;
  updateStatus(id: string, tenantId: string, status: SalaryAdvanceStatus): Promise<SalaryAdvance>;
  countActive(userId: string, tenantId: string): Promise<number>;
}
```

- [ ] **Step 8: Implement IRegionalMinimumWageRepository**

```typescript
// modules/salary-v2/core/domain/ports/IRegionalMinimumWageRepository.ts
import type { RegionalMinimumWage } from '../entities/RegionalMinimumWage';

export interface IRegionalMinimumWageRepository {
  findByRegionAndYear(regionCode: string, year: number, tenantId: string): Promise<RegionalMinimumWage | null>;
  findAll(tenantId: string): Promise<RegionalMinimumWage[]>;
  create(data: Omit<RegionalMinimumWage, 'id' | 'createdAt' | 'updatedAt'>): Promise<RegionalMinimumWage>;
  update(id: string, tenantId: string, data: Partial<RegionalMinimumWage>): Promise<RegionalMinimumWage>;
  delete(id: string, tenantId: string): Promise<void>;
}
```

- [ ] **Step 9: Create ports barrel export**

```typescript
// modules/salary-v2/core/domain/ports/index.ts
export type { IPayrollRunRepository, PayrollRunFilter } from './IPayrollRunRepository';
export type { IPayrollEntryRepository, PayrollEntryWithLines } from './IPayrollEntryRepository';
export type { IPayrollComponentRepository, ComponentFilter } from './IPayrollComponentRepository';
export type { IEmployeePayrollProfileRepository, ProfileFilter } from './IEmployeePayrollProfileRepository';
export type { IPayScheduleRepository } from './IPayScheduleRepository';
export type { IPayrollPeriodRepository, PeriodFilter } from './IPayrollPeriodRepository';
export type { ISalaryAdvanceRepository, AdvanceFilter } from './ISalaryAdvanceRepository';
export type { IRegionalMinimumWageRepository } from './IRegionalMinimumWageRepository';
```

- [ ] **Step 10: Commit**

```bash
git add modules/salary-v2/core/domain/ports/
git commit -m "feat(salary-v2): add repository port interfaces for all domain entities"
```

---

## Task 8: Error Classes & Calculation Engine Interface

**Files:**
- Create: `modules/salary-v2/core/errors/PayrollError.ts`
- Create: `modules/salary-v2/core/errors/index.ts`
- Create: `modules/salary-v2/core/domain/ports/IPayrollCalculator.ts`
- Modify: `modules/salary-v2/core/domain/ports/index.ts`

- [ ] **Step 1: Implement PayrollError**

```typescript
// modules/salary-v2/core/errors/PayrollError.ts
export type PayrollErrorCode =
  | 'PAYROLL_NOT_FOUND'
  | 'ENTRY_NOT_FOUND'
  | 'COMPONENT_NOT_FOUND'
  | 'PROFILE_NOT_FOUND'
  | 'SCHEDULE_NOT_FOUND'
  | 'PERIOD_NOT_FOUND'
  | 'INVALID_STATUS_TRANSITION'
  | 'PERIOD_LOCKED'
  | 'PERIOD_OVERLAP'
  | 'CALCULATION_ERROR'
  | 'COMPLIANCE_ERROR'
  | 'NEGATIVE_NET_SALARY'
  | 'BELOW_MINIMUM_WAGE'
  | 'OVERTIME_CAP_EXCEEDED'
  | 'ADVANCE_LIMIT_EXCEEDED'
  | 'ADVANCE_NOT_ELIGIBLE'
  | 'INVALID_FORMULA'
  | 'APPROVAL_REQUIRED'
  | 'ALREADY_PAID'
  | 'DUPLICATE_ENTRY';

export class PayrollError extends Error {
  constructor(
    public readonly code: PayrollErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PayrollError';
  }

  static notFound(entity: string, id: string): PayrollError {
    const codeMap: Record<string, PayrollErrorCode> = {
      payrollRun: 'PAYROLL_NOT_FOUND',
      entry: 'ENTRY_NOT_FOUND',
      component: 'COMPONENT_NOT_FOUND',
      profile: 'PROFILE_NOT_FOUND',
      schedule: 'SCHEDULE_NOT_FOUND',
      period: 'PERIOD_NOT_FOUND',
    };
    return new PayrollError(
      codeMap[entity] || 'PAYROLL_NOT_FOUND',
      `${entity} with id ${id} not found`
    );
  }

  static invalidTransition(from: string, to: string): PayrollError {
    return new PayrollError(
      'INVALID_STATUS_TRANSITION',
      `Cannot transition from ${from} to ${to}`
    );
  }

  static periodLocked(periodId: string): PayrollError {
    return new PayrollError(
      'PERIOD_LOCKED',
      `Period ${periodId} is locked and cannot be modified`,
      { periodId }
    );
  }

  static calculationError(userId: string, reason: string): PayrollError {
    return new PayrollError(
      'CALCULATION_ERROR',
      `Calculation failed for user ${userId}: ${reason}`,
      { userId, reason }
    );
  }

  static belowMinimumWage(userId: string, salary: number, umr: number, region: string): PayrollError {
    return new PayrollError(
      'BELOW_MINIMUM_WAGE',
      `Salary ${salary} for user ${userId} is below UMR ${umr} (${region})`,
      { userId, salary, umr, region }
    );
  }
}
```

- [ ] **Step 2: Create errors barrel export**

```typescript
// modules/salary-v2/core/errors/index.ts
export { PayrollError, type PayrollErrorCode } from './PayrollError';
```

- [ ] **Step 3: Implement IPayrollCalculator interface (calculation engine contract)**

```typescript
// modules/salary-v2/core/domain/ports/IPayrollCalculator.ts
import type { EmployeePayrollProfile } from '../entities/EmployeePayrollProfile';
import type { PayrollLine } from '../entities/PayrollLine';
import type { EmployeeType } from '../enums';
import type { TenantPayrollConfig } from '../../config';

export interface AttendanceSummary {
  totalWorkDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  sickDays: number;
  permitDays: number;
  effectiveDays: number;
}

export interface OvertimeSummary {
  normalMinutes: number;
  holidayMinutes: number;
  nationalHolidayMinutes: number;
  totalMinutes: number;
}

export interface CalculationContext {
  employee: EmployeePayrollProfile;
  period: { start: Date; end: Date };
  attendance: AttendanceSummary;
  overtime: OvertimeSummary;
  previousLines: PayrollLine[];
  config: TenantPayrollConfig;
  metadata: Record<string, unknown>;
}

export interface CalculationResult {
  lines: PayrollLine[];
  metadata?: Record<string, unknown>;
}

export interface IPayrollCalculator {
  name: string;
  order: number;
  applicableTo: EmployeeType[] | null;
  calculate(ctx: CalculationContext): CalculationResult;
}
```

- [ ] **Step 4: Update ports barrel export to include IPayrollCalculator**

Add to `modules/salary-v2/core/domain/ports/index.ts`:

```typescript
export type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  AttendanceSummary,
  OvertimeSummary,
} from './IPayrollCalculator';
```

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/core/errors/ modules/salary-v2/core/domain/ports/IPayrollCalculator.ts modules/salary-v2/core/domain/ports/index.ts
git commit -m "feat(salary-v2): add PayrollError class and IPayrollCalculator interface"
```

---

## Task 9: Module Public API & Core Barrel Exports

**Files:**
- Create: `modules/salary-v2/core/index.ts`
- Create: `modules/salary-v2/index.ts`

- [ ] **Step 1: Create core barrel export**

```typescript
// modules/salary-v2/core/index.ts
// Domain - Entities
export type {
  PayrollRun,
  PayrollEntry,
  PayrollLine,
  PayrollComponent,
  EmployeePayrollProfile,
  BpjsEnrollment,
  EmployeeComponent,
  PaySchedule,
  PayrollPeriod,
  PayrollAuditLog,
  AuditChange,
  AuditEntityType,
  SalaryAdvance,
  DeductionMethod,
  RegionalMinimumWage,
} from './domain/entities';

// Domain - Enums
export {
  PayrollRunStatus,
  PayrollEntryStatus,
  PayrollRunType,
  PayrollPeriodStatus,
  EmployeeType,
  TaxMethod,
  PayFrequency,
  ComponentCategory,
  ComponentCalculationType,
  PaymentBatchStatus,
  PaymentItemStatus,
  SalaryAdvanceStatus,
  AuditAction,
  ComplianceSeverity,
  OvertimeDayType,
  OvertimeCapEnforcement,
} from './domain/enums';

// Domain - Value Objects
export { Money } from './domain/value-objects';
export { Period } from './domain/value-objects';
export { PtkpStatus, PTKP_CATEGORIES, type PtkpCategory } from './domain/value-objects';

// Domain - Ports
export type {
  IPayrollRunRepository,
  PayrollRunFilter,
  IPayrollEntryRepository,
  PayrollEntryWithLines,
  IPayrollComponentRepository,
  ComponentFilter,
  IEmployeePayrollProfileRepository,
  ProfileFilter,
  IPayScheduleRepository,
  IPayrollPeriodRepository,
  PeriodFilter,
  ISalaryAdvanceRepository,
  AdvanceFilter,
  IRegionalMinimumWageRepository,
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  AttendanceSummary,
  OvertimeSummary,
} from './domain/ports';

// Config
export type {
  TenantPayrollConfig,
  ThrConfig,
  SalaryAdvancePolicy,
  PeriodLockingPolicy,
  BpjsRateConfig,
  BpjsProgramRate,
  BpjsEmployerOnlyRate,
  TenantTaxConfig,
  ProgressiveRate,
  TerBracket,
  PtkpAmount,
  OvertimeConfig,
  OvertimeTier,
} from './config';

export {
  DEFAULT_BPJS_CONFIG,
  DEFAULT_TAX_CONFIG,
  DEFAULT_OVERTIME_CONFIG,
} from './config';

// Errors
export { PayrollError, type PayrollErrorCode } from './errors';
```

- [ ] **Step 2: Create module-level barrel export**

```typescript
// modules/salary-v2/index.ts
export * from './core';
```

- [ ] **Step 3: Verify all imports resolve correctly**

Run: `npx vitest run tests/modules/salary-v2/ --reporter=verbose`
Expected: ALL PASS (all tests from Tasks 1-6)

- [ ] **Step 4: Run typecheck on the new module**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | grep salary-v2 || echo "No type errors in salary-v2"`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/core/index.ts modules/salary-v2/index.ts
git commit -m "feat(salary-v2): add core and module-level barrel exports"
```

---

## Task 10: Prisma Schema — New Payroll Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new Prisma enums**

Add to `prisma/schema.prisma` (in the enums section):

```prisma
enum PayrollRunStatusV2 {
  DRAFT
  CALCULATING
  CALCULATED
  AUDITED
  APPROVED
  PAID
  CLOSED
  REJECTED
  REVISION_REQUESTED
}

enum PayrollRunTypeV2 {
  REGULAR
  THR
  BONUS
  RAPEL
  ADVANCE
}

enum PayrollEntryStatusV2 {
  PENDING
  CALCULATED
  ERROR
  APPROVED
  PAID
}

enum EmployeeTypeV2 {
  PKWTT
  PKWT
  DAILY
  FREELANCE
}

enum TaxMethodV2 {
  NET
  GROSS_UP
  NETT
}

enum PayFrequencyV2 {
  MONTHLY
  BI_WEEKLY
  WEEKLY
  DAILY
  ON_DEMAND
}

enum ComponentCategoryV2 {
  EARNING
  DEDUCTION
  TAX
  EMPLOYER_COST
}

enum ComponentCalcTypeV2 {
  FIXED
  PERCENTAGE
  FORMULA
  PER_HOUR
  PER_DAY
  PER_UNIT
}

enum PayrollPeriodStatusV2 {
  OPEN
  PROCESSING
  CLOSED
  LOCKED
}

enum SalaryAdvanceStatusV2 {
  PENDING
  APPROVED
  DISBURSED
  DEDUCTED
  REJECTED
}

enum DeductionMethodV2 {
  FULL_NEXT
  INSTALLMENT
}

enum PaymentBatchStatusV2 {
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL_FAILED
}

enum PaymentItemStatusV2 {
  PENDING
  SUCCESS
  FAILED
  RETRY
}
```

- [ ] **Step 2: Add PayScheduleV2 model**

```prisma
model PayScheduleV2 {
  id              String         @id @default(cuid())
  tenantId        String
  name            String
  frequency       PayFrequencyV2
  cutOffDay       Int?
  cutOffDayOfWeek Int?
  payDay          Int
  payDayOffset    Int?
  gracePeriodDays Int            @default(3)
  isDefault       Boolean        @default(false)
  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  tenant          Tenant         @relation(fields: [tenantId], references: [id])
  periods         PayrollPeriodV2[]
  runs            PayrollRunV2[]
  profiles        EmployeePayrollProfileV2[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("pay_schedule_v2")
}
```

- [ ] **Step 3: Add PayrollPeriodV2 model**

```prisma
model PayrollPeriodV2 {
  id           String               @id @default(cuid())
  tenantId     String
  scheduleId   String
  periodStart  DateTime
  periodEnd    DateTime
  payDate      DateTime
  status       PayrollPeriodStatusV2 @default(OPEN)
  lockedAt     DateTime?
  lockedBy     String?
  unlockReason String?
  unlockCount  Int                  @default(0)
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  tenant       Tenant               @relation(fields: [tenantId], references: [id])
  schedule     PayScheduleV2        @relation(fields: [scheduleId], references: [id])
  lockedByUser User?                @relation("PeriodLockedBy", fields: [lockedBy], references: [id])

  @@index([tenantId])
  @@index([scheduleId])
  @@index([status])
  @@map("payroll_period_v2")
}
```

- [ ] **Step 4: Add PayrollRunV2 model**

```prisma
model PayrollRunV2 {
  id              String             @id @default(cuid())
  tenantId        String
  scheduleId      String
  type            PayrollRunTypeV2   @default(REGULAR)
  status          PayrollRunStatusV2 @default(DRAFT)
  periodStart     DateTime
  periodEnd       DateTime
  payDate         DateTime
  totalEntries    Int                @default(0)
  totalNetSalary  Float              @default(0)
  totalEmployerCost Float            @default(0)
  lockedAt        DateTime?
  lockedBy        String?
  notes           String?
  createdBy       String
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  tenant          Tenant             @relation(fields: [tenantId], references: [id])
  schedule        PayScheduleV2      @relation(fields: [scheduleId], references: [id])
  createdByUser   User               @relation("PayrollRunCreatedBy", fields: [createdBy], references: [id])
  entries         PayrollEntryV2[]

  @@index([tenantId])
  @@index([scheduleId])
  @@index([status])
  @@index([tenantId, periodStart, periodEnd])
  @@map("payroll_run_v2")
}
```

- [ ] **Step 5: Add PayrollEntryV2 and PayrollLineV2 models**

```prisma
model PayrollEntryV2 {
  id              String               @id @default(cuid())
  payrollRunId    String
  tenantId        String
  userId          String
  employeeType    EmployeeTypeV2
  taxMethod       TaxMethodV2
  basicSalary     Float
  effectiveSalary Float
  totalEarnings   Float                @default(0)
  totalDeductions Float                @default(0)
  totalTax        Float                @default(0)
  netSalary       Float                @default(0)
  employerCost    Float                @default(0)
  status          PayrollEntryStatusV2 @default(PENDING)
  errorMessage    String?
  calculatedAt    DateTime?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  tenant          Tenant               @relation(fields: [tenantId], references: [id])
  payrollRun      PayrollRunV2         @relation(fields: [payrollRunId], references: [id], onDelete: Cascade)
  user            User                 @relation("PayrollEntryUser", fields: [userId], references: [id])
  lines           PayrollLineV2[]

  @@unique([payrollRunId, userId])
  @@index([tenantId])
  @@index([payrollRunId])
  @@index([userId])
  @@map("payroll_entry_v2")
}

model PayrollLineV2 {
  id            String           @id @default(cuid())
  entryId       String
  tenantId      String
  componentId   String?
  componentCode String
  componentName String
  category      ComponentCategoryV2
  quantity      Float            @default(1)
  rate          Float            @default(0)
  amount        Float            @default(0)
  formula       String?
  metadata      Json?
  sortOrder     Int              @default(0)

  tenant        Tenant           @relation(fields: [tenantId], references: [id])
  entry         PayrollEntryV2   @relation(fields: [entryId], references: [id], onDelete: Cascade)
  component     PayrollComponentV2? @relation(fields: [componentId], references: [id])

  @@index([entryId])
  @@index([tenantId])
  @@map("payroll_line_v2")
}
```

- [ ] **Step 6: Add PayrollComponentV2 and EmployeePayrollProfileV2 models**

```prisma
model PayrollComponentV2 {
  id              String              @id @default(cuid())
  tenantId        String
  name            String
  code            String
  category        ComponentCategoryV2
  calculationType ComponentCalcTypeV2
  taxable         Boolean             @default(true)
  applicableTo    EmployeeTypeV2[]
  isStatutory     Boolean             @default(false)
  formula         String?
  defaultAmount   Float?
  sortOrder       Int                 @default(0)
  isActive        Boolean             @default(true)
  description     String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  tenant          Tenant              @relation(fields: [tenantId], references: [id])
  lines           PayrollLineV2[]
  employeeComponents EmployeeComponentV2[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([tenantId, category])
  @@map("payroll_component_v2")
}

model EmployeePayrollProfileV2 {
  id              String         @id @default(cuid())
  userId          String
  tenantId        String
  employeeType    EmployeeTypeV2
  taxMethod       TaxMethodV2    @default(NET)
  payScheduleId   String
  basicSalary     Float
  payPeriodDay    Int            @default(25)
  ptkpStatus      String         @default("TK_0")
  npwp            String?
  bpjsKesehatan   Boolean        @default(true)
  bpjsJht         Boolean        @default(true)
  bpjsJp          Boolean        @default(true)
  bpjsJkk         Boolean        @default(true)
  bpjsJkm         Boolean        @default(true)
  regionCode      String
  contractStart   DateTime
  contractEnd     DateTime?
  overtimeEligible Boolean       @default(true)
  thrEligible     Boolean        @default(true)
  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  tenant          Tenant         @relation(fields: [tenantId], references: [id])
  user            User           @relation("EmployeePayrollProfile", fields: [userId], references: [id])
  schedule        PayScheduleV2  @relation(fields: [payScheduleId], references: [id])
  components      EmployeeComponentV2[]

  @@unique([userId, tenantId])
  @@index([tenantId])
  @@index([tenantId, employeeType])
  @@index([payScheduleId])
  @@map("employee_payroll_profile_v2")
}

model EmployeeComponentV2 {
  id              String              @id @default(cuid())
  profileId       String
  tenantId        String
  componentId     String
  amount          Float?
  isActive        Boolean             @default(true)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  tenant          Tenant              @relation(fields: [tenantId], references: [id])
  profile         EmployeePayrollProfileV2 @relation(fields: [profileId], references: [id], onDelete: Cascade)
  component       PayrollComponentV2  @relation(fields: [componentId], references: [id])

  @@unique([profileId, componentId])
  @@index([tenantId])
  @@map("employee_component_v2")
}
```

- [ ] **Step 7: Add remaining models (SalaryAdvance, RegionalMinimumWage, AuditLog)**

```prisma
model SalaryAdvanceV2 {
  id              String                @id @default(cuid())
  tenantId        String
  userId          String
  amount          Float
  requestDate     DateTime              @default(now())
  approvedBy      String?
  approvedAt      DateTime?
  status          SalaryAdvanceStatusV2 @default(PENDING)
  deductionMethod DeductionMethodV2     @default(FULL_NEXT)
  installmentCount Int?
  remainingAmount Float
  reason          String?
  rejectionReason String?
  disbursedAt     DateTime?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  tenant          Tenant                @relation(fields: [tenantId], references: [id])
  user            User                  @relation("SalaryAdvanceUser", fields: [userId], references: [id])
  approvedByUser  User?                 @relation("SalaryAdvanceApprover", fields: [approvedBy], references: [id])

  @@index([tenantId])
  @@index([userId])
  @@index([status])
  @@map("salary_advance_v2")
}

model RegionalMinimumWageV2 {
  id            String   @id @default(cuid())
  tenantId      String
  regionCode    String
  regionName    String
  year          Int
  monthlyAmount Float
  dailyAmount   Float?
  effectiveDate DateTime
  source        String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant        Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, regionCode, year])
  @@index([tenantId])
  @@map("regional_minimum_wage_v2")
}

model PayrollAuditLogV2 {
  id          String   @id @default(cuid())
  tenantId    String
  entityType  String
  entityId    String
  action      String
  performedBy String
  timestamp   DateTime @default(now())
  changes     Json     @default("[]")
  reason      String?
  ipAddress   String?

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  performer   User     @relation("PayrollAuditPerformer", fields: [performedBy], references: [id])

  @@index([tenantId])
  @@index([entityType, entityId])
  @@index([performedBy])
  @@map("payroll_audit_log_v2")
}
```

- [ ] **Step 8: Generate Prisma client and verify**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" success message

- [ ] **Step 9: Create migration**

Run: `npx prisma migrate dev --name add_payroll_v2_models`
Expected: Migration created successfully

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(salary-v2): add Prisma schema for payroll v2 models"
```

---

## Task 11: Final Verification & Cleanup

- [ ] **Step 1: Run all salary-v2 tests**

Run: `npx vitest run tests/modules/salary-v2/ --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `npx eslint modules/salary-v2/ --ext .ts`
Expected: No errors (or only warnings)

- [ ] **Step 4: Verify Prisma client generation**

Run: `npx prisma generate && echo "OK"`
Expected: OK

- [ ] **Step 5: Final commit (if any cleanup needed)**

```bash
git add -A
git status
# Only commit if there are changes
git commit -m "chore(salary-v2): phase 1 cleanup and final verification"
```

---

## Summary

Phase 1 establishes the complete foundation for the salary module rewrite:

- **16 enum types** covering all payroll statuses, employee types, and configurations
- **10 domain entities** as TypeScript interfaces
- **3 value objects** (Money, Period, PtkpStatus) with behavior
- **8 repository port interfaces** defining data access contracts
- **4 configuration types** with sensible defaults (BPJS, Tax, Overtime, Tenant)
- **1 calculator interface** (IPayrollCalculator) for the pipeline pattern
- **1 error class** (PayrollError) with factory methods
- **12 Prisma models** with proper indexes and relations
- **Clean barrel exports** at core and module level

**Next Phase:** Phase 2 (Calculation Engine) will implement the pipeline orchestrator and individual calculators using the interfaces defined here.
