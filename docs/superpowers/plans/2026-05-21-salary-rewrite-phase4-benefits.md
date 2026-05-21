# Salary Module Rewrite — Phase 4: Benefits Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement THR (Tunjangan Hari Raya) calculator, rapel/back-pay calculator, and salary advance deduction logic as standalone services that integrate with the calculation pipeline.

**Architecture:** Each benefit is a standalone service that can generate PayrollLines. THR and Rapel produce separate PayrollRun types (not part of regular monthly). SalaryAdvance integrates with the existing LoanDeductionCalculator via metadata injection. All services are pure/stateless with injected dependencies.

**Tech Stack:** TypeScript, Vitest, existing core types from Phase 1-3

**Spec Reference:** `docs/superpowers/specs/2026-05-21-salary-module-rewrite-design.md` Section 6

**Phase Dependencies:** Phase 1 (Core), Phase 2 (Calculation Engine), Phase 3 (Tax Engine)

---

## File Structure

```
modules/salary-v2/
├── benefits/
│   ├── thr/
│   │   └── ThrCalculationService.ts
│   ├── rapel/
│   │   └── RapelCalculationService.ts
│   ├── advance/
│   │   └── SalaryAdvanceService.ts
│   └── index.ts
tests/modules/salary-v2/
└── benefits/
    ├── thr.test.ts
    ├── rapel.test.ts
    └── advance.test.ts
```

---

## Task 1: THR Calculation Service

**Files:**
- Create: `modules/salary-v2/benefits/thr/ThrCalculationService.ts`
- Test: `tests/modules/salary-v2/benefits/thr.test.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p modules/salary-v2/benefits/{thr,rapel,advance}
mkdir -p tests/modules/salary-v2/benefits
```

- [ ] **Step 2: Write test**

```typescript
// tests/modules/salary-v2/benefits/thr.test.ts
import { describe, it, expect } from 'vitest';
import { ThrCalculationService } from '@/modules/salary-v2/benefits/thr/ThrCalculationService';
import type { ThrConfig } from '@/modules/salary-v2/core';

const defaultThrConfig: ThrConfig = {
  eligibleAfterMonths: 1,
  fullEntitlementMonths: 12,
  prorata: true,
  components: ['BASIC_SALARY'],
  paymentDeadlineDays: 7,
};

describe('ThrCalculationService', () => {
  const service = new ThrCalculationService();

  it('should calculate full THR for employee with >= 12 months tenure', () => {
    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 1000000,
      contractStart: new Date('2024-01-15'),
      calculationDate: new Date('2026-03-20'),
      config: defaultThrConfig,
    });

    expect(result.amount).toBe(8000000);
    expect(result.isProrated).toBe(false);
    expect(result.monthsWorked).toBeGreaterThanOrEqual(12);
  });

  it('should calculate prorated THR for employee with < 12 months tenure', () => {
    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 1000000,
      contractStart: new Date('2025-09-15'),
      calculationDate: new Date('2026-03-20'),
      config: defaultThrConfig,
    });

    expect(result.isProrated).toBe(true);
    expect(result.monthsWorked).toBe(6);
    expect(result.amount).toBe(Math.floor(8000000 * (6 / 12)));
  });

  it('should return 0 if employee tenure < eligibleAfterMonths', () => {
    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 0,
      contractStart: new Date('2026-03-10'),
      calculationDate: new Date('2026-03-20'),
      config: defaultThrConfig,
    });

    expect(result.amount).toBe(0);
    expect(result.eligible).toBe(false);
  });

  it('should include fixed allowances when configured', () => {
    const configWithAllowances: ThrConfig = {
      ...defaultThrConfig,
      components: ['BASIC_SALARY', 'FIXED_ALLOWANCES'],
    };

    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 1500000,
      contractStart: new Date('2024-01-15'),
      calculationDate: new Date('2026-03-20'),
      config: configWithAllowances,
    });

    expect(result.amount).toBe(9500000);
  });

  it('should not prorate if prorata is disabled', () => {
    const configNoProrata: ThrConfig = {
      ...defaultThrConfig,
      prorata: false,
    };

    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 0,
      contractStart: new Date('2025-09-15'),
      calculationDate: new Date('2026-03-20'),
      config: configNoProrata,
    });

    expect(result.amount).toBe(8000000);
    expect(result.isProrated).toBe(false);
  });

  it('should calculate months worked correctly', () => {
    const result = service.calculate({
      basicSalary: 8000000,
      fixedAllowances: 0,
      contractStart: new Date('2025-06-01'),
      calculationDate: new Date('2026-03-20'),
      config: defaultThrConfig,
    });

    expect(result.monthsWorked).toBe(9);
  });
});
```

- [ ] **Step 3: Implement ThrCalculationService**

```typescript
// modules/salary-v2/benefits/thr/ThrCalculationService.ts
import type { ThrConfig } from '@/modules/salary-v2/core';

export interface ThrInput {
  basicSalary: number;
  fixedAllowances: number;
  contractStart: Date;
  calculationDate: Date;
  config: ThrConfig;
}

export interface ThrResult {
  amount: number;
  eligible: boolean;
  isProrated: boolean;
  monthsWorked: number;
  baseAmount: number;
}

export class ThrCalculationService {
  calculate(input: ThrInput): ThrResult {
    const { basicSalary, fixedAllowances, contractStart, calculationDate, config } = input;

    const monthsWorked = this.calculateMonthsWorked(contractStart, calculationDate);

    if (monthsWorked < config.eligibleAfterMonths) {
      return { amount: 0, eligible: false, isProrated: false, monthsWorked, baseAmount: 0 };
    }

    let baseAmount = basicSalary;
    if (config.components.includes('FIXED_ALLOWANCES')) {
      baseAmount += fixedAllowances;
    }

    let amount: number;
    let isProrated: boolean;

    if (monthsWorked >= config.fullEntitlementMonths) {
      amount = baseAmount;
      isProrated = false;
    } else if (config.prorata) {
      amount = Math.floor(baseAmount * (monthsWorked / config.fullEntitlementMonths));
      isProrated = true;
    } else {
      amount = baseAmount;
      isProrated = false;
    }

    return { amount, eligible: true, isProrated, monthsWorked, baseAmount };
  }

  private calculateMonthsWorked(contractStart: Date, calculationDate: Date): number {
    const years = calculationDate.getFullYear() - contractStart.getFullYear();
    const months = calculationDate.getMonth() - contractStart.getMonth();
    const totalMonths = years * 12 + months;
    return Math.max(0, totalMonths);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/modules/salary-v2/benefits/thr.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/benefits/thr/ tests/modules/salary-v2/benefits/thr.test.ts
git commit -m "feat(salary-v2): add ThrCalculationService with prorata and eligibility"
```

---

## Task 2: Rapel/Back-Pay Calculation Service

**Files:**
- Create: `modules/salary-v2/benefits/rapel/RapelCalculationService.ts`
- Test: `tests/modules/salary-v2/benefits/rapel.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/benefits/rapel.test.ts
import { describe, it, expect } from 'vitest';
import { RapelCalculationService } from '@/modules/salary-v2/benefits/rapel/RapelCalculationService';
import type { RapelInput, PeriodPayment } from '@/modules/salary-v2/benefits/rapel/RapelCalculationService';

describe('RapelCalculationService', () => {
  const service = new RapelCalculationService();

  it('should calculate rapel for salary increase', () => {
    const input: RapelInput = {
      reason: 'SALARY_INCREASE',
      newBasicSalary: 10000000,
      affectedPeriods: [
        { month: 1, year: 2026, paidAmount: 8000000 },
        { month: 2, year: 2026, paidAmount: 8000000 },
        { month: 3, year: 2026, paidAmount: 8000000 },
      ],
    };

    const result = service.calculate(input);

    expect(result.totalDifference).toBe(6000000);
    expect(result.periodDetails).toHaveLength(3);
    expect(result.periodDetails[0].difference).toBe(2000000);
    expect(result.periodDetails[1].difference).toBe(2000000);
    expect(result.periodDetails[2].difference).toBe(2000000);
  });

  it('should calculate rapel for correction', () => {
    const input: RapelInput = {
      reason: 'CORRECTION',
      newBasicSalary: 8000000,
      affectedPeriods: [
        { month: 3, year: 2026, paidAmount: 7500000 },
      ],
    };

    const result = service.calculate(input);

    expect(result.totalDifference).toBe(500000);
    expect(result.periodDetails).toHaveLength(1);
  });

  it('should handle zero difference (no rapel needed)', () => {
    const input: RapelInput = {
      reason: 'SALARY_INCREASE',
      newBasicSalary: 8000000,
      affectedPeriods: [
        { month: 1, year: 2026, paidAmount: 8000000 },
      ],
    };

    const result = service.calculate(input);

    expect(result.totalDifference).toBe(0);
    expect(result.periodDetails[0].difference).toBe(0);
  });

  it('should handle negative difference (overpayment)', () => {
    const input: RapelInput = {
      reason: 'CORRECTION',
      newBasicSalary: 7000000,
      affectedPeriods: [
        { month: 1, year: 2026, paidAmount: 8000000 },
      ],
    };

    const result = service.calculate(input);

    expect(result.totalDifference).toBe(-1000000);
    expect(result.hasOverpayment).toBe(true);
  });

  it('should calculate with custom corrected amounts per period', () => {
    const input: RapelInput = {
      reason: 'CORRECTION',
      affectedPeriods: [
        { month: 1, year: 2026, paidAmount: 8000000, correctedAmount: 8500000 },
        { month: 2, year: 2026, paidAmount: 8000000, correctedAmount: 9000000 },
      ],
    };

    const result = service.calculate(input);

    expect(result.totalDifference).toBe(1500000);
    expect(result.periodDetails[0].difference).toBe(500000);
    expect(result.periodDetails[1].difference).toBe(1000000);
  });
});
```

- [ ] **Step 2: Implement RapelCalculationService**

```typescript
// modules/salary-v2/benefits/rapel/RapelCalculationService.ts
export type RapelReason = 'SALARY_INCREASE' | 'CORRECTION' | 'RETROACTIVE_COMPONENT';

export interface PeriodPayment {
  month: number;
  year: number;
  paidAmount: number;
  correctedAmount?: number;
}

export interface RapelInput {
  reason: RapelReason;
  newBasicSalary?: number;
  affectedPeriods: PeriodPayment[];
}

export interface PeriodDetail {
  month: number;
  year: number;
  originalAmount: number;
  correctedAmount: number;
  difference: number;
}

export interface RapelResult {
  totalDifference: number;
  periodDetails: PeriodDetail[];
  hasOverpayment: boolean;
  reason: RapelReason;
}

export class RapelCalculationService {
  calculate(input: RapelInput): RapelResult {
    const { reason, newBasicSalary, affectedPeriods } = input;

    const periodDetails: PeriodDetail[] = affectedPeriods.map(period => {
      const correctedAmount = period.correctedAmount ?? (newBasicSalary ?? period.paidAmount);
      const difference = correctedAmount - period.paidAmount;

      return {
        month: period.month,
        year: period.year,
        originalAmount: period.paidAmount,
        correctedAmount,
        difference,
      };
    });

    const totalDifference = periodDetails.reduce((sum, p) => sum + p.difference, 0);
    const hasOverpayment = totalDifference < 0;

    return { totalDifference, periodDetails, hasOverpayment, reason };
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/modules/salary-v2/benefits/rapel.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add modules/salary-v2/benefits/rapel/ tests/modules/salary-v2/benefits/rapel.test.ts
git commit -m "feat(salary-v2): add RapelCalculationService for back-pay calculations"
```

---

## Task 3: Salary Advance Service

**Files:**
- Create: `modules/salary-v2/benefits/advance/SalaryAdvanceService.ts`
- Test: `tests/modules/salary-v2/benefits/advance.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/benefits/advance.test.ts
import { describe, it, expect } from 'vitest';
import { SalaryAdvanceService } from '@/modules/salary-v2/benefits/advance/SalaryAdvanceService';
import type { SalaryAdvancePolicy } from '@/modules/salary-v2/core';

const defaultPolicy: SalaryAdvancePolicy = {
  maxPercentOfSalary: 0.30,
  maxActiveAdvances: 2,
  minDaysBetweenRequests: 30,
  approvalRequired: true,
  deductionMethod: 'FULL_NEXT',
  maxInstallments: 6,
};

describe('SalaryAdvanceService', () => {
  const service = new SalaryAdvanceService();

  describe('validateRequest', () => {
    it('should approve valid request within limits', () => {
      const result = service.validateRequest({
        requestedAmount: 2000000,
        basicSalary: 8000000,
        activeAdvanceCount: 0,
        lastRequestDate: null,
        requestDate: new Date('2026-05-15'),
        policy: defaultPolicy,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject if amount exceeds max percent of salary', () => {
      const result = service.validateRequest({
        requestedAmount: 3000000,
        basicSalary: 8000000,
        activeAdvanceCount: 0,
        lastRequestDate: null,
        requestDate: new Date('2026-05-15'),
        policy: defaultPolicy,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('EXCEEDS_MAX_PERCENT');
      expect(result.maxAllowed).toBe(2400000);
    });

    it('should reject if max active advances exceeded', () => {
      const result = service.validateRequest({
        requestedAmount: 1000000,
        basicSalary: 8000000,
        activeAdvanceCount: 2,
        lastRequestDate: null,
        requestDate: new Date('2026-05-15'),
        policy: defaultPolicy,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('MAX_ACTIVE_EXCEEDED');
    });

    it('should reject if too soon after last request', () => {
      const result = service.validateRequest({
        requestedAmount: 1000000,
        basicSalary: 8000000,
        activeAdvanceCount: 0,
        lastRequestDate: new Date('2026-05-01'),
        requestDate: new Date('2026-05-15'),
        policy: defaultPolicy,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TOO_SOON');
    });

    it('should allow if enough days between requests', () => {
      const result = service.validateRequest({
        requestedAmount: 1000000,
        basicSalary: 8000000,
        activeAdvanceCount: 0,
        lastRequestDate: new Date('2026-04-01'),
        requestDate: new Date('2026-05-15'),
        policy: defaultPolicy,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('calculateDeduction', () => {
    it('should calculate FULL_NEXT deduction', () => {
      const result = service.calculateDeduction({
        amount: 2000000,
        remainingAmount: 2000000,
        deductionMethod: 'FULL_NEXT',
        installmentCount: null,
      });

      expect(result.deductionAmount).toBe(2000000);
    });

    it('should calculate INSTALLMENT deduction', () => {
      const result = service.calculateDeduction({
        amount: 3000000,
        remainingAmount: 3000000,
        deductionMethod: 'INSTALLMENT',
        installmentCount: 3,
      });

      expect(result.deductionAmount).toBe(1000000);
    });

    it('should not exceed remaining amount for installment', () => {
      const result = service.calculateDeduction({
        amount: 3000000,
        remainingAmount: 500000,
        deductionMethod: 'INSTALLMENT',
        installmentCount: 3,
      });

      expect(result.deductionAmount).toBe(500000);
    });
  });
});
```

- [ ] **Step 2: Implement SalaryAdvanceService**

```typescript
// modules/salary-v2/benefits/advance/SalaryAdvanceService.ts
import type { SalaryAdvancePolicy } from '@/modules/salary-v2/core';

export type ValidationError = 'EXCEEDS_MAX_PERCENT' | 'MAX_ACTIVE_EXCEEDED' | 'TOO_SOON';

export interface ValidateRequestInput {
  requestedAmount: number;
  basicSalary: number;
  activeAdvanceCount: number;
  lastRequestDate: Date | null;
  requestDate: Date;
  policy: SalaryAdvancePolicy;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  maxAllowed?: number;
}

export interface DeductionInput {
  amount: number;
  remainingAmount: number;
  deductionMethod: 'FULL_NEXT' | 'INSTALLMENT';
  installmentCount: number | null;
}

export interface DeductionResult {
  deductionAmount: number;
}

export class SalaryAdvanceService {
  validateRequest(input: ValidateRequestInput): ValidationResult {
    const { requestedAmount, basicSalary, activeAdvanceCount, lastRequestDate, requestDate, policy } = input;
    const errors: ValidationError[] = [];

    const maxAllowed = Math.floor(basicSalary * policy.maxPercentOfSalary);
    if (requestedAmount > maxAllowed) {
      errors.push('EXCEEDS_MAX_PERCENT');
    }

    if (activeAdvanceCount >= policy.maxActiveAdvances) {
      errors.push('MAX_ACTIVE_EXCEEDED');
    }

    if (lastRequestDate) {
      const daysSinceLastRequest = Math.floor(
        (requestDate.getTime() - lastRequestDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastRequest < policy.minDaysBetweenRequests) {
        errors.push('TOO_SOON');
      }
    }

    return { valid: errors.length === 0, errors, maxAllowed };
  }

  calculateDeduction(input: DeductionInput): DeductionResult {
    const { amount, remainingAmount, deductionMethod, installmentCount } = input;

    let deductionAmount: number;

    if (deductionMethod === 'FULL_NEXT') {
      deductionAmount = remainingAmount;
    } else {
      const perInstallment = Math.ceil(amount / (installmentCount ?? 1));
      deductionAmount = Math.min(perInstallment, remainingAmount);
    }

    return { deductionAmount };
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/modules/salary-v2/benefits/advance.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add modules/salary-v2/benefits/advance/ tests/modules/salary-v2/benefits/advance.test.ts
git commit -m "feat(salary-v2): add SalaryAdvanceService with validation and deduction calculation"
```

---

## Task 4: Benefits Module Barrel Export

**Files:**
- Create: `modules/salary-v2/benefits/index.ts`
- Modify: `modules/salary-v2/index.ts`

- [ ] **Step 1: Create benefits barrel export**

```typescript
// modules/salary-v2/benefits/index.ts
export { ThrCalculationService } from './thr/ThrCalculationService';
export type { ThrInput, ThrResult } from './thr/ThrCalculationService';
export { RapelCalculationService } from './rapel/RapelCalculationService';
export type { RapelInput, RapelResult, PeriodPayment, PeriodDetail, RapelReason } from './rapel/RapelCalculationService';
export { SalaryAdvanceService } from './advance/SalaryAdvanceService';
export type { ValidateRequestInput, ValidationResult, ValidationError, DeductionInput, DeductionResult } from './advance/SalaryAdvanceService';
```

- [ ] **Step 2: Update module barrel export**

```typescript
// modules/salary-v2/index.ts
export * from './core';
export * from './calculation';
export * from './tax';
export * from './benefits';
```

- [ ] **Step 3: Run ALL salary-v2 tests**

Run: `npx vitest run tests/modules/salary-v2/ --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep salary-v2 || echo "0 type errors"`

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/benefits/index.ts modules/salary-v2/index.ts
git commit -m "feat(salary-v2): add benefits module barrel export"
```

---

## Summary

Phase 4 delivers the benefits engine:

- **ThrCalculationService** — THR calculation with eligibility check, prorata, configurable components
- **RapelCalculationService** — Back-pay calculation for salary increases, corrections, retroactive components
- **SalaryAdvanceService** — Advance request validation (max %, active count, cooldown) and deduction calculation (FULL_NEXT / INSTALLMENT)
- **Barrel exports** — Clean public API

**Next Phase:** Phase 5 (Payment & Period Management — pay schedules, period lifecycle, locking)
