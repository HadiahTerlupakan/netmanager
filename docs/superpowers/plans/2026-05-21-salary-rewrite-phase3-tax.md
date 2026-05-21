# Salary Module Rewrite — Phase 3: Tax Engine Enhancement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the TaxCalculator with TER bracket lookup, iterative gross-up convergence, annual correction (Desember), resign mid-year handling, and tax history tracking.

**Architecture:** Refactor existing TaxCalculator into a modular tax sub-system. Extract calculation strategies into separate files: TER-based monthly calculation, progressive annual correction, and iterative gross-up. Add a TaxHistoryProvider interface for YTD tax data needed by annual correction.

**Tech Stack:** TypeScript, Vitest, existing core types from Phase 1 & 2

**Spec Reference:** `docs/superpowers/specs/2026-05-21-salary-module-rewrite-design.md` Section 5

**Phase Dependencies:** Phase 1 (Core), Phase 2 (Calculation Engine — TaxCalculator base)

---

## File Structure

```
modules/salary-v2/
├── tax/
│   ├── strategies/
│   │   ├── TerMonthlyStrategy.ts       # TER bracket lookup for monthly tax
│   │   ├── ProgressiveAnnualStrategy.ts # Pasal 17 progressive for annual correction
│   │   └── GrossUpIterator.ts           # Iterative gross-up until convergence
│   ├── providers/
│   │   └── TaxHistoryProvider.ts        # Interface + in-memory impl for YTD data
│   ├── TaxCalculatorV2.ts              # Enhanced calculator replacing Phase 2 version
│   └── index.ts
tests/modules/salary-v2/
└── tax/
    ├── ter-monthly.test.ts
    ├── progressive-annual.test.ts
    ├── gross-up-iterator.test.ts
    ├── tax-history.test.ts
    └── tax-calculator-v2.test.ts
```

---

## Task 1: TER Monthly Strategy

**Files:**
- Create: `modules/salary-v2/tax/strategies/TerMonthlyStrategy.ts`
- Test: `tests/modules/salary-v2/tax/ter-monthly.test.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p modules/salary-v2/tax/{strategies,providers}
mkdir -p tests/modules/salary-v2/tax
```

- [ ] **Step 2: Write test**

```typescript
// tests/modules/salary-v2/tax/ter-monthly.test.ts
import { describe, it, expect } from 'vitest';
import { TerMonthlyStrategy } from '@/modules/salary-v2/tax/strategies/TerMonthlyStrategy';
import type { TerBracket } from '@/modules/salary-v2/core';

const TER_BRACKETS: TerBracket[] = [
  { ptkpGroup: 'A', minIncome: 0, maxIncome: 5400000, rate: 0 },
  { ptkpGroup: 'A', minIncome: 5400000, maxIncome: 5650000, rate: 0.0025 },
  { ptkpGroup: 'A', minIncome: 5650000, maxIncome: 5950000, rate: 0.005 },
  { ptkpGroup: 'A', minIncome: 5950000, maxIncome: 6300000, rate: 0.0075 },
  { ptkpGroup: 'A', minIncome: 6300000, maxIncome: 6750000, rate: 0.01 },
  { ptkpGroup: 'A', minIncome: 6750000, maxIncome: 7500000, rate: 0.0125 },
  { ptkpGroup: 'A', minIncome: 7500000, maxIncome: 8550000, rate: 0.015 },
  { ptkpGroup: 'A', minIncome: 8550000, maxIncome: 9650000, rate: 0.0175 },
  { ptkpGroup: 'A', minIncome: 9650000, maxIncome: 10050000, rate: 0.02 },
  { ptkpGroup: 'A', minIncome: 10050000, maxIncome: 10350000, rate: 0.0225 },
  { ptkpGroup: 'A', minIncome: 10350000, maxIncome: 10700000, rate: 0.025 },
  { ptkpGroup: 'A', minIncome: 10700000, maxIncome: 11050000, rate: 0.03 },
  { ptkpGroup: 'A', minIncome: 11050000, maxIncome: null, rate: 0.035 },
  { ptkpGroup: 'B', minIncome: 0, maxIncome: 6200000, rate: 0 },
  { ptkpGroup: 'B', minIncome: 6200000, maxIncome: 6500000, rate: 0.0025 },
  { ptkpGroup: 'B', minIncome: 6500000, maxIncome: null, rate: 0.03 },
  { ptkpGroup: 'C', minIncome: 0, maxIncome: 6600000, rate: 0 },
  { ptkpGroup: 'C', minIncome: 6600000, maxIncome: 6950000, rate: 0.0025 },
  { ptkpGroup: 'C', minIncome: 6950000, maxIncome: null, rate: 0.03 },
];

describe('TerMonthlyStrategy', () => {
  const strategy = new TerMonthlyStrategy();

  it('should return 0 tax if income is in 0% bracket', () => {
    const tax = strategy.calculate(5000000, 'A', TER_BRACKETS);
    expect(tax).toBe(0);
  });

  it('should apply correct TER rate for group A', () => {
    // 8000000 falls in 7500000-8550000 bracket → 1.5%
    const tax = strategy.calculate(8000000, 'A', TER_BRACKETS);
    expect(tax).toBe(Math.floor(8000000 * 0.015));
  });

  it('should apply highest bracket if income exceeds all', () => {
    // 15000000 falls in 11050000+ bracket → 3.5%
    const tax = strategy.calculate(15000000, 'A', TER_BRACKETS);
    expect(tax).toBe(Math.floor(15000000 * 0.035));
  });

  it('should use correct group for different PTKP', () => {
    // Group B, 6200000-6500000 → 0.25%
    const tax = strategy.calculate(6300000, 'B', TER_BRACKETS);
    expect(tax).toBe(Math.floor(6300000 * 0.0025));
  });

  it('should return 0 if no matching bracket found', () => {
    const tax = strategy.calculate(5000000, 'Z', TER_BRACKETS);
    expect(tax).toBe(0);
  });

  it('should map PTKP status to TER group correctly', () => {
    expect(TerMonthlyStrategy.getPtkpGroup('TK_0')).toBe('A');
    expect(TerMonthlyStrategy.getPtkpGroup('TK_1')).toBe('A');
    expect(TerMonthlyStrategy.getPtkpGroup('K_0')).toBe('A');
    expect(TerMonthlyStrategy.getPtkpGroup('TK_2')).toBe('B');
    expect(TerMonthlyStrategy.getPtkpGroup('TK_3')).toBe('B');
    expect(TerMonthlyStrategy.getPtkpGroup('K_1')).toBe('B');
    expect(TerMonthlyStrategy.getPtkpGroup('K_2')).toBe('B');
    expect(TerMonthlyStrategy.getPtkpGroup('K_3')).toBe('C');
  });
});
```

- [ ] **Step 3: Implement TerMonthlyStrategy**

```typescript
// modules/salary-v2/tax/strategies/TerMonthlyStrategy.ts
import type { TerBracket } from '@/modules/salary-v2/core';

export class TerMonthlyStrategy {
  static getPtkpGroup(ptkpStatus: string): string {
    const groupMap: Record<string, string> = {
      'TK_0': 'A', 'TK_1': 'A', 'K_0': 'A',
      'TK_2': 'B', 'TK_3': 'B', 'K_1': 'B', 'K_2': 'B',
      'K_3': 'C',
    };
    return groupMap[ptkpStatus] ?? 'A';
  }

  calculate(grossMonthlyIncome: number, ptkpGroup: string, brackets: TerBracket[]): number {
    const applicableBrackets = brackets
      .filter(b => b.ptkpGroup === ptkpGroup)
      .sort((a, b) => a.minIncome - b.minIncome);

    if (applicableBrackets.length === 0) return 0;

    for (let i = applicableBrackets.length - 1; i >= 0; i--) {
      const bracket = applicableBrackets[i];
      if (grossMonthlyIncome >= bracket.minIncome) {
        return Math.floor(grossMonthlyIncome * bracket.rate);
      }
    }

    return 0;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/modules/salary-v2/tax/ter-monthly.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/tax/strategies/TerMonthlyStrategy.ts tests/modules/salary-v2/tax/ter-monthly.test.ts
git commit -m "feat(salary-v2): add TER monthly strategy with PTKP group mapping"
```

---

## Task 2: Progressive Annual Strategy (Pasal 17 for December/Resign)

**Files:**
- Create: `modules/salary-v2/tax/strategies/ProgressiveAnnualStrategy.ts`
- Test: `tests/modules/salary-v2/tax/progressive-annual.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/tax/progressive-annual.test.ts
import { describe, it, expect } from 'vitest';
import { ProgressiveAnnualStrategy } from '@/modules/salary-v2/tax/strategies/ProgressiveAnnualStrategy';
import { DEFAULT_TAX_CONFIG } from '@/modules/salary-v2/core';

describe('ProgressiveAnnualStrategy', () => {
  const strategy = new ProgressiveAnnualStrategy();
  const progressiveRates = DEFAULT_TAX_CONFIG.progressiveRates;

  it('should calculate annual tax for income in first bracket only', () => {
    // PKP 50M → 5% = 2.5M
    const tax = strategy.calculateAnnualTax(50000000, progressiveRates);
    expect(tax).toBe(2500000);
  });

  it('should calculate annual tax spanning two brackets', () => {
    // PKP 100M → 60M×5% + 40M×15% = 3M + 6M = 9M
    const tax = strategy.calculateAnnualTax(100000000, progressiveRates);
    expect(tax).toBe(9000000);
  });

  it('should calculate annual tax spanning three brackets', () => {
    // PKP 300M → 60M×5% + 190M×15% + 50M×25% = 3M + 28.5M + 12.5M = 44M
    const tax = strategy.calculateAnnualTax(300000000, progressiveRates);
    expect(tax).toBe(44000000);
  });

  it('should return 0 for zero or negative PKP', () => {
    expect(strategy.calculateAnnualTax(0, progressiveRates)).toBe(0);
    expect(strategy.calculateAnnualTax(-5000000, progressiveRates)).toBe(0);
  });

  it('should calculate annual correction (December)', () => {
    // Total annual tax = 9M, already paid Jan-Nov = 7.5M → Dec tax = 1.5M
    const result = strategy.calculateAnnualCorrection({
      annualPkp: 100000000,
      progressiveRates,
      totalTaxPaidYtd: 7500000,
      hasNpwp: true,
      npwpSurcharge: 0.20,
    });
    expect(result.annualTaxDue).toBe(9000000);
    expect(result.correctionAmount).toBe(1500000);
  });

  it('should handle overpayment (negative correction)', () => {
    // Total annual tax = 9M, already paid = 10M → correction = -1M (refund)
    const result = strategy.calculateAnnualCorrection({
      annualPkp: 100000000,
      progressiveRates,
      totalTaxPaidYtd: 10000000,
      hasNpwp: true,
      npwpSurcharge: 0.20,
    });
    expect(result.correctionAmount).toBe(-1000000);
  });

  it('should apply NPWP surcharge to annual tax', () => {
    const withNpwp = strategy.calculateAnnualCorrection({
      annualPkp: 100000000,
      progressiveRates,
      totalTaxPaidYtd: 0,
      hasNpwp: true,
      npwpSurcharge: 0.20,
    });
    const withoutNpwp = strategy.calculateAnnualCorrection({
      annualPkp: 100000000,
      progressiveRates,
      totalTaxPaidYtd: 0,
      hasNpwp: false,
      npwpSurcharge: 0.20,
    });
    expect(withoutNpwp.annualTaxDue).toBe(Math.floor(withNpwp.annualTaxDue * 1.2));
  });

  it('should calculate for partial year (resign scenario)', () => {
    // Employee worked 8 months, total income for 8 months
    const result = strategy.calculatePartialYearTax({
      totalGrossIncome: 80000000,
      totalBiayaJabatan: 4000000,
      totalBpjsEmployee: 2400000,
      ptkpAnnual: 54000000,
      progressiveRates,
      totalTaxPaidYtd: 1500000,
      monthsWorked: 8,
      hasNpwp: true,
      npwpSurcharge: 0.20,
    });

    const pkp = 80000000 - 4000000 - 2400000 - 54000000;
    const expectedAnnualTax = strategy.calculateAnnualTax(pkp, progressiveRates);
    expect(result.annualTaxDue).toBe(expectedAnnualTax);
    expect(result.finalMonthTax).toBe(expectedAnnualTax - 1500000);
  });
});
```

- [ ] **Step 2: Implement ProgressiveAnnualStrategy**

```typescript
// modules/salary-v2/tax/strategies/ProgressiveAnnualStrategy.ts
import type { ProgressiveRate } from '@/modules/salary-v2/core';

export interface AnnualCorrectionInput {
  annualPkp: number;
  progressiveRates: ProgressiveRate[];
  totalTaxPaidYtd: number;
  hasNpwp: boolean;
  npwpSurcharge: number;
}

export interface AnnualCorrectionResult {
  annualTaxDue: number;
  correctionAmount: number;
}

export interface PartialYearInput {
  totalGrossIncome: number;
  totalBiayaJabatan: number;
  totalBpjsEmployee: number;
  ptkpAnnual: number;
  progressiveRates: ProgressiveRate[];
  totalTaxPaidYtd: number;
  monthsWorked: number;
  hasNpwp: boolean;
  npwpSurcharge: number;
}

export interface PartialYearResult {
  annualTaxDue: number;
  finalMonthTax: number;
}

export class ProgressiveAnnualStrategy {
  calculateAnnualTax(annualPkp: number, progressiveRates: ProgressiveRate[]): number {
    if (annualPkp <= 0) return 0;

    let remaining = annualPkp;
    let totalTax = 0;

    for (const bracket of progressiveRates) {
      if (remaining <= 0) break;

      const bracketSize = bracket.maxAmount !== null
        ? bracket.maxAmount - bracket.minAmount
        : remaining;

      const taxableInBracket = Math.min(remaining, bracketSize);
      totalTax += Math.floor(taxableInBracket * bracket.rate);
      remaining -= taxableInBracket;
    }

    return totalTax;
  }

  calculateAnnualCorrection(input: AnnualCorrectionInput): AnnualCorrectionResult {
    let annualTaxDue = this.calculateAnnualTax(input.annualPkp, input.progressiveRates);

    if (!input.hasNpwp) {
      annualTaxDue = Math.floor(annualTaxDue * (1 + input.npwpSurcharge));
    }

    const correctionAmount = annualTaxDue - input.totalTaxPaidYtd;

    return { annualTaxDue, correctionAmount };
  }

  calculatePartialYearTax(input: PartialYearInput): PartialYearResult {
    const pkp = input.totalGrossIncome - input.totalBiayaJabatan - input.totalBpjsEmployee - input.ptkpAnnual;

    let annualTaxDue = this.calculateAnnualTax(Math.max(0, pkp), input.progressiveRates);

    if (!input.hasNpwp) {
      annualTaxDue = Math.floor(annualTaxDue * (1 + input.npwpSurcharge));
    }

    const finalMonthTax = annualTaxDue - input.totalTaxPaidYtd;

    return { annualTaxDue, finalMonthTax };
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/modules/salary-v2/tax/progressive-annual.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add modules/salary-v2/tax/strategies/ProgressiveAnnualStrategy.ts tests/modules/salary-v2/tax/progressive-annual.test.ts
git commit -m "feat(salary-v2): add ProgressiveAnnualStrategy for December correction and resign"
```

---

## Task 3: Gross-Up Iterator

**Files:**
- Create: `modules/salary-v2/tax/strategies/GrossUpIterator.ts`
- Test: `tests/modules/salary-v2/tax/gross-up-iterator.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/tax/gross-up-iterator.test.ts
import { describe, it, expect } from 'vitest';
import { GrossUpIterator } from '@/modules/salary-v2/tax/strategies/GrossUpIterator';
import { DEFAULT_TAX_CONFIG } from '@/modules/salary-v2/core';

describe('GrossUpIterator', () => {
  const iterator = new GrossUpIterator();

  it('should converge to correct gross-up amount', () => {
    // Employee with 10M gross, TK_0, has NPWP
    const result = iterator.calculate({
      baseGrossIncome: 10000000,
      biayaJabatan: 500000,
      bpjsEmployeeDeduction: 320000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: true,
      npwpSurcharge: 0.20,
    });

    expect(result.taxAllowance).toBeGreaterThan(0);
    expect(result.totalTax).toBe(result.taxAllowance);
    expect(result.iterations).toBeLessThanOrEqual(5);
    expect(result.converged).toBe(true);
  });

  it('should produce tax allowance equal to final tax', () => {
    const result = iterator.calculate({
      baseGrossIncome: 15000000,
      biayaJabatan: 500000,
      bpjsEmployeeDeduction: 480000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: true,
      npwpSurcharge: 0.20,
    });

    expect(result.taxAllowance).toBe(result.totalTax);
  });

  it('should apply NPWP surcharge in gross-up', () => {
    const withNpwp = iterator.calculate({
      baseGrossIncome: 10000000,
      biayaJabatan: 500000,
      bpjsEmployeeDeduction: 320000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: true,
      npwpSurcharge: 0.20,
    });

    const withoutNpwp = iterator.calculate({
      baseGrossIncome: 10000000,
      biayaJabatan: 500000,
      bpjsEmployeeDeduction: 320000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: false,
      npwpSurcharge: 0.20,
    });

    expect(withoutNpwp.taxAllowance).toBeGreaterThan(withNpwp.taxAllowance);
  });

  it('should return zero if income below PTKP', () => {
    const result = iterator.calculate({
      baseGrossIncome: 4000000,
      biayaJabatan: 200000,
      bpjsEmployeeDeduction: 120000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: true,
      npwpSurcharge: 0.20,
    });

    expect(result.taxAllowance).toBe(0);
    expect(result.totalTax).toBe(0);
  });

  it('should converge within 5 iterations for high income', () => {
    const result = iterator.calculate({
      baseGrossIncome: 50000000,
      biayaJabatan: 500000,
      bpjsEmployeeDeduction: 480000,
      ptkpMonthly: 4500000,
      progressiveRates: DEFAULT_TAX_CONFIG.progressiveRates,
      hasNpwp: true,
      npwpSurcharge: 0.20,
    });

    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Implement GrossUpIterator**

```typescript
// modules/salary-v2/tax/strategies/GrossUpIterator.ts
import type { ProgressiveRate } from '@/modules/salary-v2/core';

export interface GrossUpInput {
  baseGrossIncome: number;
  biayaJabatan: number;
  bpjsEmployeeDeduction: number;
  ptkpMonthly: number;
  progressiveRates: ProgressiveRate[];
  hasNpwp: boolean;
  npwpSurcharge: number;
}

export interface GrossUpResult {
  taxAllowance: number;
  totalTax: number;
  iterations: number;
  converged: boolean;
}

const MAX_ITERATIONS = 10;
const CONVERGENCE_THRESHOLD = 1;

export class GrossUpIterator {
  calculate(input: GrossUpInput): GrossUpResult {
    const { baseGrossIncome, biayaJabatan, bpjsEmployeeDeduction, ptkpMonthly, progressiveRates, hasNpwp, npwpSurcharge } = input;

    let taxAllowance = 0;
    let previousTax = 0;
    let iterations = 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      iterations = i + 1;

      const grossWithAllowance = baseGrossIncome + taxAllowance;
      const taxableIncome = grossWithAllowance - biayaJabatan - bpjsEmployeeDeduction - ptkpMonthly;

      if (taxableIncome <= 0) {
        return { taxAllowance: 0, totalTax: 0, iterations, converged: true };
      }

      const annualizedTaxable = taxableIncome * 12;
      let annualTax = this.calculateProgressiveTax(annualizedTaxable, progressiveRates);

      if (!hasNpwp) {
        annualTax = Math.floor(annualTax * (1 + npwpSurcharge));
      }

      const monthlyTax = Math.floor(annualTax / 12);

      if (Math.abs(monthlyTax - previousTax) <= CONVERGENCE_THRESHOLD) {
        return { taxAllowance: monthlyTax, totalTax: monthlyTax, iterations, converged: true };
      }

      previousTax = monthlyTax;
      taxAllowance = monthlyTax;
    }

    return { taxAllowance: previousTax, totalTax: previousTax, iterations, converged: false };
  }

  private calculateProgressiveTax(annualTaxable: number, progressiveRates: ProgressiveRate[]): number {
    let remaining = annualTaxable;
    let totalTax = 0;

    for (const bracket of progressiveRates) {
      if (remaining <= 0) break;

      const bracketSize = bracket.maxAmount !== null
        ? bracket.maxAmount - bracket.minAmount
        : remaining;

      const taxableInBracket = Math.min(remaining, bracketSize);
      totalTax += Math.floor(taxableInBracket * bracket.rate);
      remaining -= taxableInBracket;
    }

    return totalTax;
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/modules/salary-v2/tax/gross-up-iterator.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add modules/salary-v2/tax/strategies/GrossUpIterator.ts tests/modules/salary-v2/tax/gross-up-iterator.test.ts
git commit -m "feat(salary-v2): add GrossUpIterator with convergence for GROSS_UP tax method"
```

---

## Task 4: Tax History Provider

**Files:**
- Create: `modules/salary-v2/tax/providers/TaxHistoryProvider.ts`
- Test: `tests/modules/salary-v2/tax/tax-history.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/tax/tax-history.test.ts
import { describe, it, expect } from 'vitest';
import { InMemoryTaxHistoryProvider } from '@/modules/salary-v2/tax/providers/TaxHistoryProvider';
import type { ITaxHistoryProvider, MonthlyTaxRecord } from '@/modules/salary-v2/tax/providers/TaxHistoryProvider';

describe('TaxHistoryProvider', () => {
  it('should return empty history for new employee', () => {
    const provider = new InMemoryTaxHistoryProvider([]);
    const history = provider.getYtdHistory('user-1', 2026);
    expect(history.records).toHaveLength(0);
    expect(history.totalGrossIncome).toBe(0);
    expect(history.totalTaxPaid).toBe(0);
    expect(history.totalBiayaJabatan).toBe(0);
    expect(history.totalBpjsEmployee).toBe(0);
    expect(history.monthsWorked).toBe(0);
  });

  it('should aggregate YTD totals from records', () => {
    const records: MonthlyTaxRecord[] = [
      { userId: 'user-1', year: 2026, month: 1, grossIncome: 10000000, taxPaid: 200000, biayaJabatan: 500000, bpjsEmployee: 320000 },
      { userId: 'user-1', year: 2026, month: 2, grossIncome: 10000000, taxPaid: 200000, biayaJabatan: 500000, bpjsEmployee: 320000 },
      { userId: 'user-1', year: 2026, month: 3, grossIncome: 10000000, taxPaid: 200000, biayaJabatan: 500000, bpjsEmployee: 320000 },
    ];
    const provider = new InMemoryTaxHistoryProvider(records);
    const history = provider.getYtdHistory('user-1', 2026);

    expect(history.records).toHaveLength(3);
    expect(history.totalGrossIncome).toBe(30000000);
    expect(history.totalTaxPaid).toBe(600000);
    expect(history.totalBiayaJabatan).toBe(1500000);
    expect(history.totalBpjsEmployee).toBe(960000);
    expect(history.monthsWorked).toBe(3);
  });

  it('should filter by user and year', () => {
    const records: MonthlyTaxRecord[] = [
      { userId: 'user-1', year: 2026, month: 1, grossIncome: 10000000, taxPaid: 200000, biayaJabatan: 500000, bpjsEmployee: 320000 },
      { userId: 'user-2', year: 2026, month: 1, grossIncome: 8000000, taxPaid: 150000, biayaJabatan: 400000, bpjsEmployee: 240000 },
      { userId: 'user-1', year: 2025, month: 12, grossIncome: 10000000, taxPaid: 200000, biayaJabatan: 500000, bpjsEmployee: 320000 },
    ];
    const provider = new InMemoryTaxHistoryProvider(records);
    const history = provider.getYtdHistory('user-1', 2026);

    expect(history.records).toHaveLength(1);
    expect(history.totalGrossIncome).toBe(10000000);
  });
});
```

- [ ] **Step 2: Implement TaxHistoryProvider**

```typescript
// modules/salary-v2/tax/providers/TaxHistoryProvider.ts
export interface MonthlyTaxRecord {
  userId: string;
  year: number;
  month: number;
  grossIncome: number;
  taxPaid: number;
  biayaJabatan: number;
  bpjsEmployee: number;
}

export interface YtdTaxHistory {
  records: MonthlyTaxRecord[];
  totalGrossIncome: number;
  totalTaxPaid: number;
  totalBiayaJabatan: number;
  totalBpjsEmployee: number;
  monthsWorked: number;
}

export interface ITaxHistoryProvider {
  getYtdHistory(userId: string, year: number): YtdTaxHistory;
}

export class InMemoryTaxHistoryProvider implements ITaxHistoryProvider {
  constructor(private records: MonthlyTaxRecord[]) {}

  getYtdHistory(userId: string, year: number): YtdTaxHistory {
    const filtered = this.records.filter(r => r.userId === userId && r.year === year);

    return {
      records: filtered,
      totalGrossIncome: filtered.reduce((sum, r) => sum + r.grossIncome, 0),
      totalTaxPaid: filtered.reduce((sum, r) => sum + r.taxPaid, 0),
      totalBiayaJabatan: filtered.reduce((sum, r) => sum + r.biayaJabatan, 0),
      totalBpjsEmployee: filtered.reduce((sum, r) => sum + r.bpjsEmployee, 0),
      monthsWorked: filtered.length,
    };
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/modules/salary-v2/tax/tax-history.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add modules/salary-v2/tax/providers/TaxHistoryProvider.ts tests/modules/salary-v2/tax/tax-history.test.ts
git commit -m "feat(salary-v2): add TaxHistoryProvider interface and in-memory implementation"
```

---

## Task 5: Enhanced TaxCalculatorV2

**Files:**
- Create: `modules/salary-v2/tax/TaxCalculatorV2.ts`
- Test: `tests/modules/salary-v2/tax/tax-calculator-v2.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/tax/tax-calculator-v2.test.ts
import { describe, it, expect } from 'vitest';
import { TaxCalculatorV2 } from '@/modules/salary-v2/tax/TaxCalculatorV2';
import { InMemoryTaxHistoryProvider } from '@/modules/salary-v2/tax/providers/TaxHistoryProvider';
import type { MonthlyTaxRecord } from '@/modules/salary-v2/tax/providers/TaxHistoryProvider';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { buildLine } from '@/modules/salary-v2/calculation/helpers/line-builder';
import { ComponentCategory, DEFAULT_TAX_CONFIG } from '@/modules/salary-v2/core';
import type { TerBracket } from '@/modules/salary-v2/core';

const TER_BRACKETS: TerBracket[] = [
  { ptkpGroup: 'A', minIncome: 0, maxIncome: 5400000, rate: 0 },
  { ptkpGroup: 'A', minIncome: 5400000, maxIncome: 5650000, rate: 0.0025 },
  { ptkpGroup: 'A', minIncome: 5650000, maxIncome: 5950000, rate: 0.005 },
  { ptkpGroup: 'A', minIncome: 5950000, maxIncome: 6300000, rate: 0.0075 },
  { ptkpGroup: 'A', minIncome: 6300000, maxIncome: 6750000, rate: 0.01 },
  { ptkpGroup: 'A', minIncome: 6750000, maxIncome: 7500000, rate: 0.0125 },
  { ptkpGroup: 'A', minIncome: 7500000, maxIncome: 8550000, rate: 0.015 },
  { ptkpGroup: 'A', minIncome: 8550000, maxIncome: 9650000, rate: 0.0175 },
  { ptkpGroup: 'A', minIncome: 9650000, maxIncome: 10050000, rate: 0.02 },
  { ptkpGroup: 'A', minIncome: 10050000, maxIncome: 10350000, rate: 0.0225 },
  { ptkpGroup: 'A', minIncome: 10350000, maxIncome: 10700000, rate: 0.025 },
  { ptkpGroup: 'A', minIncome: 10700000, maxIncome: 11050000, rate: 0.03 },
  { ptkpGroup: 'A', minIncome: 11050000, maxIncome: null, rate: 0.035 },
];

describe('TaxCalculatorV2', () => {
  describe('Monthly TER calculation (Jan-Nov)', () => {
    it('should use TER brackets when available', () => {
      const provider = new InMemoryTaxHistoryProvider([]);
      const calculator = new TaxCalculatorV2(provider);

      const previousLines = [
        buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji', category: ComponentCategory.EARNING, amount: 10000000 }),
      ];
      const ctx = createTestContext({
        employee: { ...createTestContext().employee, taxMethod: 'NET', ptkpStatus: 'TK_0', basicSalary: 10000000 },
        previousLines,
        metadata: { effectiveSalary: 10000000, currentMonth: 6, currentYear: 2026 },
      });
      ctx.config.tax.terBrackets = TER_BRACKETS;

      const result = calculator.calculate(ctx);
      const pph21 = result.lines.find(l => l.componentCode === 'PPH21');

      // 10M gross, group A, bracket 9650000-10050000 → 2%
      expect(pph21?.amount).toBe(Math.floor(10000000 * 0.02));
    });

    it('should fallback to progressive if no TER brackets', () => {
      const provider = new InMemoryTaxHistoryProvider([]);
      const calculator = new TaxCalculatorV2(provider);

      const previousLines = [
        buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji', category: ComponentCategory.EARNING, amount: 10000000 }),
      ];
      const ctx = createTestContext({
        employee: { ...createTestContext().employee, taxMethod: 'NET', ptkpStatus: 'TK_0', basicSalary: 10000000 },
        previousLines,
        metadata: { effectiveSalary: 10000000, currentMonth: 6, currentYear: 2026 },
      });
      ctx.config.tax.terBrackets = [];

      const result = calculator.calculate(ctx);
      const pph21 = result.lines.find(l => l.componentCode === 'PPH21');
      expect(pph21?.amount).toBeGreaterThan(0);
    });
  });

  describe('Annual correction (December)', () => {
    it('should apply annual correction in December', () => {
      const records: MonthlyTaxRecord[] = Array.from({ length: 11 }, (_, i) => ({
        userId: 'user-1', year: 2026, month: i + 1,
        grossIncome: 10000000, taxPaid: 200000, biayaJabatan: 500000, bpjsEmployee: 320000,
      }));
      const provider = new InMemoryTaxHistoryProvider(records);
      const calculator = new TaxCalculatorV2(provider);

      const previousLines = [
        buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji', category: ComponentCategory.EARNING, amount: 10000000 }),
        buildLine({ componentCode: 'BPJS_JHT_EE', componentName: 'BPJS', category: ComponentCategory.DEDUCTION, amount: 200000 }),
      ];
      const ctx = createTestContext({
        employee: { ...createTestContext().employee, taxMethod: 'NET', ptkpStatus: 'TK_0', npwp: '12.345', basicSalary: 10000000 },
        previousLines,
        metadata: { effectiveSalary: 10000000, currentMonth: 12, currentYear: 2026 },
      });

      const result = calculator.calculate(ctx);
      const pph21 = result.lines.find(l => l.componentCode === 'PPH21');

      expect(pph21).toBeDefined();
      expect(result.metadata?.isAnnualCorrection).toBe(true);
    });
  });

  describe('Gross-up iterative', () => {
    it('should use iterative gross-up for GROSS_UP method', () => {
      const provider = new InMemoryTaxHistoryProvider([]);
      const calculator = new TaxCalculatorV2(provider);

      const previousLines = [
        buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji', category: ComponentCategory.EARNING, amount: 15000000 }),
      ];
      const ctx = createTestContext({
        employee: { ...createTestContext().employee, taxMethod: 'GROSS_UP', ptkpStatus: 'TK_0', basicSalary: 15000000 },
        previousLines,
        metadata: { effectiveSalary: 15000000, currentMonth: 6, currentYear: 2026 },
      });

      const result = calculator.calculate(ctx);
      const taxAllowance = result.lines.find(l => l.componentCode === 'TAX_ALLOWANCE');
      const pph21 = result.lines.find(l => l.componentCode === 'PPH21');

      expect(taxAllowance).toBeDefined();
      expect(pph21).toBeDefined();
      expect(taxAllowance?.amount).toBe(pph21?.amount);
      expect(result.metadata?.grossUpConverged).toBe(true);
    });
  });

  describe('Resign mid-year', () => {
    it('should calculate final tax on resign', () => {
      const records: MonthlyTaxRecord[] = Array.from({ length: 7 }, (_, i) => ({
        userId: 'user-1', year: 2026, month: i + 1,
        grossIncome: 10000000, taxPaid: 200000, biayaJabatan: 500000, bpjsEmployee: 320000,
      }));
      const provider = new InMemoryTaxHistoryProvider(records);
      const calculator = new TaxCalculatorV2(provider);

      const previousLines = [
        buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji', category: ComponentCategory.EARNING, amount: 10000000 }),
        buildLine({ componentCode: 'BPJS_JHT_EE', componentName: 'BPJS', category: ComponentCategory.DEDUCTION, amount: 200000 }),
      ];
      const ctx = createTestContext({
        employee: { ...createTestContext().employee, taxMethod: 'NET', ptkpStatus: 'TK_0', npwp: '12.345', basicSalary: 10000000 },
        previousLines,
        metadata: { effectiveSalary: 10000000, currentMonth: 8, currentYear: 2026, isResign: true },
      });

      const result = calculator.calculate(ctx);
      const pph21 = result.lines.find(l => l.componentCode === 'PPH21');

      expect(pph21).toBeDefined();
      expect(result.metadata?.isAnnualCorrection).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Implement TaxCalculatorV2**

```typescript
// modules/salary-v2/tax/TaxCalculatorV2.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult, EmployeeType, PayrollLine, TenantTaxConfig } from '@/modules/salary-v2/core';
import { ComponentCategory } from '@/modules/salary-v2/core';
import { buildLine, sumEarnings } from '@/modules/salary-v2/calculation/helpers/line-builder';
import { TerMonthlyStrategy } from './strategies/TerMonthlyStrategy';
import { ProgressiveAnnualStrategy } from './strategies/ProgressiveAnnualStrategy';
import { GrossUpIterator } from './strategies/GrossUpIterator';
import type { ITaxHistoryProvider } from './providers/TaxHistoryProvider';

export class TaxCalculatorV2 implements IPayrollCalculator {
  name = 'TaxV2';
  order = 60;
  applicableTo: EmployeeType[] | null = null;

  private terStrategy = new TerMonthlyStrategy();
  private annualStrategy = new ProgressiveAnnualStrategy();
  private grossUpIterator = new GrossUpIterator();

  constructor(private taxHistoryProvider: ITaxHistoryProvider) {}

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, previousLines, config, metadata } = ctx;
    const taxConfig = config.tax;
    const currentMonth = (metadata.currentMonth as number) ?? new Date().getMonth() + 1;
    const currentYear = (metadata.currentYear as number) ?? new Date().getFullYear();
    const isResign = (metadata.isResign as boolean) ?? false;
    const isAnnualCorrection = currentMonth === taxConfig.annualCorrectionMonth || isResign;

    const grossIncome = sumEarnings(previousLines);
    const bpjsEmployeeDeductions = previousLines
      .filter(l => l.category === ComponentCategory.DEDUCTION && l.componentCode.startsWith('BPJS_'))
      .reduce((sum, l) => sum + l.amount, 0);

    const biayaJabatan = Math.min(
      Math.floor(grossIncome * taxConfig.biayaJabatanRate),
      taxConfig.biayaJabatanMax
    );

    if (isAnnualCorrection) {
      return this.calculateAnnualCorrection(ctx, grossIncome, biayaJabatan, bpjsEmployeeDeductions, currentYear);
    }

    if (employee.taxMethod === 'GROSS_UP') {
      return this.calculateGrossUp(ctx, grossIncome, biayaJabatan, bpjsEmployeeDeductions);
    }

    return this.calculateMonthly(ctx, grossIncome, biayaJabatan, bpjsEmployeeDeductions);
  }

  private calculateMonthly(ctx: CalculationContext, grossIncome: number, biayaJabatan: number, bpjsEmployee: number): CalculationResult {
    const { employee, config } = ctx;
    const taxConfig = config.tax;

    let monthlyTax: number;

    if (taxConfig.terBrackets.length > 0) {
      const ptkpGroup = TerMonthlyStrategy.getPtkpGroup(employee.ptkpStatus);
      monthlyTax = this.terStrategy.calculate(grossIncome, ptkpGroup, taxConfig.terBrackets);
    } else {
      const ptkpMonthly = this.getMonthlyPtkp(employee.ptkpStatus, taxConfig);
      const taxableIncome = grossIncome - biayaJabatan - bpjsEmployee - ptkpMonthly;

      if (taxableIncome <= 0) {
        return this.buildZeroTaxResult(employee.taxMethod);
      }

      const annualizedTaxable = taxableIncome * 12;
      const annualTax = this.annualStrategy.calculateAnnualTax(annualizedTaxable, taxConfig.progressiveRates);
      monthlyTax = Math.floor(annualTax / 12);
    }

    if (!employee.npwp) {
      monthlyTax = Math.floor(monthlyTax * (1 + taxConfig.npwpSurcharge));
    }

    return this.buildTaxResult(monthlyTax, employee.taxMethod, false);
  }

  private calculateGrossUp(ctx: CalculationContext, grossIncome: number, biayaJabatan: number, bpjsEmployee: number): CalculationResult {
    const { employee, config } = ctx;
    const taxConfig = config.tax;
    const ptkpMonthly = this.getMonthlyPtkp(employee.ptkpStatus, taxConfig);

    const result = this.grossUpIterator.calculate({
      baseGrossIncome: grossIncome,
      biayaJabatan,
      bpjsEmployeeDeduction: bpjsEmployee,
      ptkpMonthly,
      progressiveRates: taxConfig.progressiveRates,
      hasNpwp: !!employee.npwp,
      npwpSurcharge: taxConfig.npwpSurcharge,
    });

    const lines: PayrollLine[] = [];

    if (result.taxAllowance > 0) {
      lines.push(buildLine({
        componentCode: 'TAX_ALLOWANCE', componentName: 'Tunjangan Pajak',
        category: ComponentCategory.EARNING,
        amount: result.taxAllowance,
        formula: `gross-up iterative (${result.iterations} iterations)`,
        sortOrder: 39,
      }));
    }

    lines.push(buildLine({
      componentCode: 'PPH21', componentName: 'PPh 21',
      category: ComponentCategory.TAX,
      amount: result.totalTax,
      formula: `GROSS_UP converged=${result.converged}`,
      sortOrder: 40,
    }));

    return {
      lines,
      metadata: { pph21: result.totalTax, grossUpConverged: result.converged, grossUpIterations: result.iterations },
    };
  }

  private calculateAnnualCorrection(ctx: CalculationContext, currentGross: number, currentBiayaJabatan: number, currentBpjs: number, year: number): CalculationResult {
    const { employee, config } = ctx;
    const taxConfig = config.tax;

    const history = this.taxHistoryProvider.getYtdHistory(employee.userId, year);

    const totalGross = history.totalGrossIncome + currentGross;
    const totalBiayaJabatan = Math.min(
      history.totalBiayaJabatan + currentBiayaJabatan,
      taxConfig.biayaJabatanMaxAnnual
    );
    const totalBpjs = history.totalBpjsEmployee + currentBpjs;

    const ptkpEntry = taxConfig.ptkpTable.find(p => p.status === employee.ptkpStatus);
    const ptkpAnnual = ptkpEntry?.annualAmount ?? 0;

    const result = this.annualStrategy.calculatePartialYearTax({
      totalGrossIncome: totalGross,
      totalBiayaJabatan: totalBiayaJabatan,
      totalBpjsEmployee: totalBpjs,
      ptkpAnnual,
      progressiveRates: taxConfig.progressiveRates,
      totalTaxPaidYtd: history.totalTaxPaid,
      monthsWorked: history.monthsWorked + 1,
      hasNpwp: !!employee.npwp,
      npwpSurcharge: taxConfig.npwpSurcharge,
    });

    const finalTax = Math.max(0, result.finalMonthTax);
    const category = employee.taxMethod === 'NETT' ? ComponentCategory.EMPLOYER_COST : ComponentCategory.TAX;

    const lines: PayrollLine[] = [];

    if (employee.taxMethod === 'GROSS_UP' && finalTax > 0) {
      lines.push(buildLine({
        componentCode: 'TAX_ALLOWANCE', componentName: 'Tunjangan Pajak',
        category: ComponentCategory.EARNING,
        amount: finalTax,
        formula: `gross-up annual correction`,
        sortOrder: 39,
      }));
    }

    lines.push(buildLine({
      componentCode: 'PPH21', componentName: 'PPh 21 (Koreksi Tahunan)',
      category: employee.taxMethod === 'GROSS_UP' ? ComponentCategory.TAX : category,
      amount: finalTax,
      formula: `annual: due=${result.annualTaxDue} - paid=${history.totalTaxPaid}`,
      sortOrder: 40,
    }));

    return {
      lines,
      metadata: {
        pph21: finalTax,
        isAnnualCorrection: true,
        annualTaxDue: result.annualTaxDue,
        ytdTaxPaid: history.totalTaxPaid,
      },
    };
  }

  private buildZeroTaxResult(taxMethod: string): CalculationResult {
    const category = taxMethod === 'NETT' ? ComponentCategory.EMPLOYER_COST : ComponentCategory.TAX;
    return {
      lines: [buildLine({
        componentCode: 'PPH21', componentName: 'PPh 21',
        category, amount: 0, formula: 'taxableIncome <= PTKP', sortOrder: 40,
      })],
      metadata: { pph21: 0 },
    };
  }

  private buildTaxResult(monthlyTax: number, taxMethod: string, isAnnualCorrection: boolean): CalculationResult {
    const lines: PayrollLine[] = [];

    if (taxMethod === 'NETT') {
      lines.push(buildLine({
        componentCode: 'PPH21', componentName: 'PPh 21 (Ditanggung Perusahaan)',
        category: ComponentCategory.EMPLOYER_COST,
        amount: monthlyTax, formula: `NETT monthly`, sortOrder: 40,
      }));
    } else {
      lines.push(buildLine({
        componentCode: 'PPH21', componentName: 'PPh 21',
        category: ComponentCategory.TAX,
        amount: monthlyTax, formula: `NET monthly`, sortOrder: 40,
      }));
    }

    return { lines, metadata: { pph21: monthlyTax, isAnnualCorrection } };
  }

  private getMonthlyPtkp(ptkpStatus: string, taxConfig: TenantTaxConfig): number {
    const entry = taxConfig.ptkpTable.find(p => p.status === ptkpStatus);
    if (!entry) return 0;
    return Math.floor(entry.annualAmount / 12);
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/modules/salary-v2/tax/tax-calculator-v2.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add modules/salary-v2/tax/TaxCalculatorV2.ts tests/modules/salary-v2/tax/tax-calculator-v2.test.ts
git commit -m "feat(salary-v2): add TaxCalculatorV2 with TER, annual correction, gross-up, resign handling"
```

---

## Task 6: Tax Module Barrel Export & Final Verification

**Files:**
- Create: `modules/salary-v2/tax/index.ts`
- Modify: `modules/salary-v2/index.ts`

- [ ] **Step 1: Create tax barrel export**

```typescript
// modules/salary-v2/tax/index.ts
export { TaxCalculatorV2 } from './TaxCalculatorV2';
export { TerMonthlyStrategy } from './strategies/TerMonthlyStrategy';
export { ProgressiveAnnualStrategy } from './strategies/ProgressiveAnnualStrategy';
export type { AnnualCorrectionInput, AnnualCorrectionResult, PartialYearInput, PartialYearResult } from './strategies/ProgressiveAnnualStrategy';
export { GrossUpIterator } from './strategies/GrossUpIterator';
export type { GrossUpInput, GrossUpResult } from './strategies/GrossUpIterator';
export { InMemoryTaxHistoryProvider } from './providers/TaxHistoryProvider';
export type { ITaxHistoryProvider, MonthlyTaxRecord, YtdTaxHistory } from './providers/TaxHistoryProvider';
```

- [ ] **Step 2: Update module barrel export**

```typescript
// modules/salary-v2/index.ts
export * from './core';
export * from './calculation';
export * from './tax';
```

- [ ] **Step 3: Run ALL salary-v2 tests**

Run: `npx vitest run tests/modules/salary-v2/ --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep salary-v2 || echo "0 type errors"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/tax/index.ts modules/salary-v2/index.ts
git commit -m "feat(salary-v2): add tax module barrel export and update module index"
```

---

## Summary

Phase 3 delivers a complete, production-grade tax engine:

- **TerMonthlyStrategy** — TER bracket lookup with PTKP group mapping (PP 58/2023)
- **ProgressiveAnnualStrategy** — Pasal 17 progressive rates for annual correction and resign
- **GrossUpIterator** — Iterative convergence for GROSS_UP tax method (max 10 iterations)
- **TaxHistoryProvider** — Interface + in-memory impl for YTD tax data
- **TaxCalculatorV2** — Enhanced calculator that:
  - Uses TER brackets for monthly (Jan-Nov) when available
  - Falls back to progressive annualization if no TER brackets
  - Applies annual correction in December (or configurable month)
  - Handles resign mid-year with partial-year calculation
  - Uses iterative gross-up for GROSS_UP method
  - Applies NPWP surcharge consistently

**Next Phase:** Phase 4 (Benefits Engine — BPJS detail, THR, rapel, salary advance)
