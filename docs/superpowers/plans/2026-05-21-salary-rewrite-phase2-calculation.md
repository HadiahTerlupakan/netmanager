# Salary Module Rewrite — Phase 2: Calculation Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the payroll calculation pipeline engine with individual calculators for basic salary, proration, attendance, overtime, custom components, BPJS, tax (PPh 21), loan deductions, and net salary.

**Architecture:** Plugin-based pipeline pattern. A `PayrollCalculationEngine` orchestrates an ordered list of `IPayrollCalculator` implementations. Each calculator receives a `CalculationContext` (accumulated from previous calculators) and returns `PayrollLine[]`. The engine is pure/stateless — no database access, no side effects.

**Tech Stack:** TypeScript, Vitest (tests), existing core types from Phase 1

**Spec Reference:** `docs/superpowers/specs/2026-05-21-salary-module-rewrite-design.md` Section 4

**Phase Dependencies:** Phase 1 (Core) — all types, interfaces, enums available at `@/modules/salary-v2/core`

---

## File Structure

```
modules/salary-v2/
├── calculation/
│   ├── engine/
│   │   └── PayrollCalculationEngine.ts
│   ├── calculators/
│   │   ├── BasicSalaryCalculator.ts
│   │   ├── ProrataCalculator.ts
│   │   ├── AttendanceCalculator.ts
│   │   ├── OvertimeCalculator.ts
│   │   ├── ComponentCalculator.ts
│   │   ├── BpjsCalculator.ts
│   │   ├── TaxCalculator.ts
│   │   ├── LoanDeductionCalculator.ts
│   │   └── NetSalaryCalculator.ts
│   ├── helpers/
│   │   ├── line-builder.ts
│   │   └── context-helpers.ts
│   └── index.ts
tests/modules/salary-v2/
└── calculation/
    ├── engine.test.ts
    ├── basic-salary.test.ts
    ├── prorata.test.ts
    ├── attendance.test.ts
    ├── overtime.test.ts
    ├── component.test.ts
    ├── bpjs.test.ts
    ├── tax.test.ts
    ├── loan-deduction.test.ts
    └── net-salary.test.ts
```

---

## Task 1: Helpers & Line Builder

**Files:**
- Create: `modules/salary-v2/calculation/helpers/line-builder.ts`
- Create: `modules/salary-v2/calculation/helpers/context-helpers.ts`
- Test: `tests/modules/salary-v2/calculation/engine.test.ts` (partial — helper tests)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p modules/salary-v2/calculation/{engine,calculators,helpers}
mkdir -p tests/modules/salary-v2/calculation
```

- [ ] **Step 2: Create line-builder helper**

```typescript
// modules/salary-v2/calculation/helpers/line-builder.ts
import type { PayrollLine } from '@/modules/salary-v2/core';
import { ComponentCategory } from '@/modules/salary-v2/core';

let lineCounter = 0;

export function buildLine(params: {
  entryId?: string;
  tenantId?: string;
  componentId?: string | null;
  componentCode: string;
  componentName: string;
  category: ComponentCategory;
  quantity?: number;
  rate?: number;
  amount: number;
  formula?: string | null;
  metadata?: Record<string, unknown> | null;
  sortOrder?: number;
}): PayrollLine {
  lineCounter++;
  return {
    id: `line-${Date.now()}-${lineCounter}`,
    entryId: params.entryId ?? '',
    tenantId: params.tenantId ?? '',
    componentId: params.componentId ?? null,
    componentCode: params.componentCode,
    componentName: params.componentName,
    category: params.category,
    quantity: params.quantity ?? 1,
    rate: params.rate ?? params.amount,
    amount: params.amount,
    formula: params.formula ?? null,
    metadata: params.metadata ?? null,
    sortOrder: params.sortOrder ?? 0,
  };
}

export function sumLinesByCategory(lines: PayrollLine[], category: ComponentCategory): number {
  return lines
    .filter(l => l.category === category)
    .reduce((sum, l) => sum + l.amount, 0);
}

export function sumEarnings(lines: PayrollLine[]): number {
  return sumLinesByCategory(lines, ComponentCategory.EARNING);
}

export function sumDeductions(lines: PayrollLine[]): number {
  return sumLinesByCategory(lines, ComponentCategory.DEDUCTION);
}

export function sumTax(lines: PayrollLine[]): number {
  return sumLinesByCategory(lines, ComponentCategory.TAX);
}

export function sumEmployerCost(lines: PayrollLine[]): number {
  return sumLinesByCategory(lines, ComponentCategory.EMPLOYER_COST);
}
```

- [ ] **Step 3: Create context-helpers**

```typescript
// modules/salary-v2/calculation/helpers/context-helpers.ts
import type { CalculationContext, EmployeePayrollProfile, AttendanceSummary, OvertimeSummary, TenantPayrollConfig } from '@/modules/salary-v2/core';
import { DEFAULT_BPJS_CONFIG, DEFAULT_TAX_CONFIG, DEFAULT_OVERTIME_CONFIG } from '@/modules/salary-v2/core';

export function createTestContext(overrides?: Partial<CalculationContext>): CalculationContext {
  const defaultEmployee: EmployeePayrollProfile = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    employeeType: 'PKWTT',
    taxMethod: 'NET',
    payScheduleId: 'schedule-1',
    basicSalary: 8000000,
    payPeriodDay: 25,
    ptkpStatus: 'TK_0',
    npwp: '12.345.678.9-012.000',
    bpjsConfig: { kesehatan: true, jht: true, jp: true, jkk: true, jkm: true },
    regionCode: 'ID-JK',
    contractStart: new Date('2024-01-15'),
    contractEnd: null,
    overtimeEligible: true,
    thrEligible: true,
    components: [],
  };

  const defaultAttendance: AttendanceSummary = {
    totalWorkDays: 22,
    presentDays: 22,
    absentDays: 0,
    lateDays: 0,
    sickDays: 0,
    permitDays: 0,
    effectiveDays: 22,
  };

  const defaultOvertime: OvertimeSummary = {
    normalMinutes: 0,
    holidayMinutes: 0,
    nationalHolidayMinutes: 0,
    totalMinutes: 0,
  };

  const defaultConfig: TenantPayrollConfig = {
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

  return {
    employee: overrides?.employee ?? defaultEmployee,
    period: overrides?.period ?? { start: new Date('2026-04-26'), end: new Date('2026-05-25') },
    attendance: overrides?.attendance ?? defaultAttendance,
    overtime: overrides?.overtime ?? defaultOvertime,
    previousLines: overrides?.previousLines ?? [],
    config: overrides?.config ?? defaultConfig,
    metadata: overrides?.metadata ?? {},
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add modules/salary-v2/calculation/helpers/
git commit -m "feat(salary-v2): add calculation helpers (line-builder, context-helpers)"
```

---

## Task 2: PayrollCalculationEngine (Pipeline Orchestrator)

**Files:**
- Create: `modules/salary-v2/calculation/engine/PayrollCalculationEngine.ts`
- Test: `tests/modules/salary-v2/calculation/engine.test.ts`

- [ ] **Step 1: Write engine test**

```typescript
// tests/modules/salary-v2/calculation/engine.test.ts
import { describe, it, expect } from 'vitest';
import { PayrollCalculationEngine } from '@/modules/salary-v2/calculation/engine/PayrollCalculationEngine';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { buildLine } from '@/modules/salary-v2/calculation/helpers/line-builder';
import type { IPayrollCalculator, CalculationContext, CalculationResult } from '@/modules/salary-v2/core';
import { ComponentCategory } from '@/modules/salary-v2/core';

class MockCalculatorA implements IPayrollCalculator {
  name = 'MockA';
  order = 1;
  applicableTo = null;
  calculate(ctx: CalculationContext): CalculationResult {
    return {
      lines: [buildLine({ componentCode: 'MOCK_A', componentName: 'Mock A', category: ComponentCategory.EARNING, amount: 1000000 })],
    };
  }
}

class MockCalculatorB implements IPayrollCalculator {
  name = 'MockB';
  order = 2;
  applicableTo = null;
  calculate(ctx: CalculationContext): CalculationResult {
    const prevTotal = ctx.previousLines.reduce((sum, l) => sum + l.amount, 0);
    return {
      lines: [buildLine({ componentCode: 'MOCK_B', componentName: 'Mock B', category: ComponentCategory.DEDUCTION, amount: Math.floor(prevTotal * 0.1) })],
    };
  }
}

describe('PayrollCalculationEngine', () => {
  it('should execute calculators in order', () => {
    const engine = new PayrollCalculationEngine([new MockCalculatorA(), new MockCalculatorB()]);
    const ctx = createTestContext();
    const result = engine.calculate(ctx);

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].componentCode).toBe('MOCK_A');
    expect(result.lines[0].amount).toBe(1000000);
    expect(result.lines[1].componentCode).toBe('MOCK_B');
    expect(result.lines[1].amount).toBe(100000);
  });

  it('should pass accumulated lines to subsequent calculators', () => {
    const engine = new PayrollCalculationEngine([new MockCalculatorA(), new MockCalculatorB()]);
    const ctx = createTestContext();
    const result = engine.calculate(ctx);

    expect(result.lines[1].amount).toBe(100000);
  });

  it('should sort calculators by order regardless of registration order', () => {
    const engine = new PayrollCalculationEngine([new MockCalculatorB(), new MockCalculatorA()]);
    const ctx = createTestContext();
    const result = engine.calculate(ctx);

    expect(result.lines[0].componentCode).toBe('MOCK_A');
    expect(result.lines[1].componentCode).toBe('MOCK_B');
  });

  it('should skip calculator if employee type not in applicableTo', () => {
    class PkwttOnly implements IPayrollCalculator {
      name = 'PkwttOnly';
      order = 1;
      applicableTo = ['PKWTT' as const];
      calculate(): CalculationResult {
        return { lines: [buildLine({ componentCode: 'PKWTT_ONLY', componentName: 'PKWTT Only', category: ComponentCategory.EARNING, amount: 500000 })] };
      }
    }

    const engine = new PayrollCalculationEngine([new PkwttOnly()]);

    const pkwttCtx = createTestContext({ employee: { ...createTestContext().employee, employeeType: 'PKWTT' } });
    expect(engine.calculate(pkwttCtx).lines).toHaveLength(1);

    const dailyCtx = createTestContext({ employee: { ...createTestContext().employee, employeeType: 'DAILY' } });
    expect(engine.calculate(dailyCtx).lines).toHaveLength(0);
  });

  it('should return empty lines for empty calculator list', () => {
    const engine = new PayrollCalculationEngine([]);
    const ctx = createTestContext();
    const result = engine.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it('should merge metadata from all calculators', () => {
    class MetaCalc implements IPayrollCalculator {
      name = 'MetaCalc';
      order = 1;
      applicableTo = null;
      calculate(): CalculationResult {
        return { lines: [], metadata: { workDays: 22 } };
      }
    }

    const engine = new PayrollCalculationEngine([new MetaCalc()]);
    const ctx = createTestContext();
    const result = engine.calculate(ctx);
    expect(result.metadata.workDays).toBe(22);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/calculation/engine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PayrollCalculationEngine**

```typescript
// modules/salary-v2/calculation/engine/PayrollCalculationEngine.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult, PayrollLine } from '@/modules/salary-v2/core';

export class PayrollCalculationEngine {
  private calculators: IPayrollCalculator[];

  constructor(calculators: IPayrollCalculator[]) {
    this.calculators = [...calculators].sort((a, b) => a.order - b.order);
  }

  calculate(ctx: CalculationContext): { lines: PayrollLine[]; metadata: Record<string, unknown> } {
    let accumulatedLines: PayrollLine[] = [...ctx.previousLines];
    let accumulatedMetadata: Record<string, unknown> = { ...ctx.metadata };

    for (const calculator of this.calculators) {
      if (calculator.applicableTo !== null && !calculator.applicableTo.includes(ctx.employee.employeeType)) {
        continue;
      }

      const calcCtx: CalculationContext = {
        ...ctx,
        previousLines: accumulatedLines,
        metadata: accumulatedMetadata,
      };

      const result: CalculationResult = calculator.calculate(calcCtx);
      accumulatedLines = [...accumulatedLines, ...result.lines];

      if (result.metadata) {
        accumulatedMetadata = { ...accumulatedMetadata, ...result.metadata };
      }
    }

    const newLines = accumulatedLines.slice(ctx.previousLines.length);
    return { lines: newLines, metadata: accumulatedMetadata };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/calculation/engine.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/engine/ tests/modules/salary-v2/calculation/engine.test.ts
git commit -m "feat(salary-v2): add PayrollCalculationEngine pipeline orchestrator"
```

---

## Task 3: BasicSalaryCalculator

**Files:**
- Create: `modules/salary-v2/calculation/calculators/BasicSalaryCalculator.ts`
- Test: `tests/modules/salary-v2/calculation/basic-salary.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/calculation/basic-salary.test.ts
import { describe, it, expect } from 'vitest';
import { BasicSalaryCalculator } from '@/modules/salary-v2/calculation/calculators/BasicSalaryCalculator';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { ComponentCategory } from '@/modules/salary-v2/core';

describe('BasicSalaryCalculator', () => {
  const calculator = new BasicSalaryCalculator();

  it('should have correct metadata', () => {
    expect(calculator.name).toBe('BasicSalary');
    expect(calculator.order).toBe(10);
    expect(calculator.applicableTo).toBeNull();
  });

  it('should generate basic salary line for full month', () => {
    const ctx = createTestContext({ employee: { ...createTestContext().employee, basicSalary: 8000000 } });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe('BASIC_SALARY');
    expect(result.lines[0].componentName).toBe('Gaji Pokok');
    expect(result.lines[0].category).toBe(ComponentCategory.EARNING);
    expect(result.lines[0].amount).toBe(8000000);
    expect(result.lines[0].quantity).toBe(1);
    expect(result.lines[0].rate).toBe(8000000);
  });

  it('should store effectiveSalary in metadata', () => {
    const ctx = createTestContext({ employee: { ...createTestContext().employee, basicSalary: 10000000 } });
    const result = calculator.calculate(ctx);

    expect(result.metadata?.effectiveSalary).toBe(10000000);
    expect(result.metadata?.dailyRate).toBe(Math.floor(10000000 / 22));
    expect(result.metadata?.hourlyRate).toBe(Math.floor(10000000 / 173));
  });

  it('should calculate daily rate based on attendance work days', () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, basicSalary: 6600000 },
      attendance: { ...createTestContext().attendance, totalWorkDays: 22 },
    });
    const result = calculator.calculate(ctx);

    expect(result.metadata?.dailyRate).toBe(300000);
  });

  it('should calculate hourly rate as 1/173 of monthly salary', () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, basicSalary: 8650000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.metadata?.hourlyRate).toBe(Math.floor(8650000 / 173));
  });

  it('should handle DAILY employee type (pay per effective day)', () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, employeeType: 'DAILY', basicSalary: 300000 },
      attendance: { ...createTestContext().attendance, effectiveDays: 18, totalWorkDays: 22 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines[0].amount).toBe(5400000);
    expect(result.lines[0].quantity).toBe(18);
    expect(result.lines[0].rate).toBe(300000);
    expect(result.metadata?.effectiveSalary).toBe(5400000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/calculation/basic-salary.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement BasicSalaryCalculator**

```typescript
// modules/salary-v2/calculation/calculators/BasicSalaryCalculator.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult } from '@/modules/salary-v2/core';
import { ComponentCategory } from '@/modules/salary-v2/core';
import { buildLine } from '../helpers/line-builder';

export class BasicSalaryCalculator implements IPayrollCalculator {
  name = 'BasicSalary';
  order = 10;
  applicableTo = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, attendance } = ctx;
    const isDaily = employee.employeeType === 'DAILY';

    let amount: number;
    let quantity: number;
    let rate: number;

    if (isDaily) {
      rate = employee.basicSalary;
      quantity = attendance.effectiveDays;
      amount = Math.floor(rate * quantity);
    } else {
      rate = employee.basicSalary;
      quantity = 1;
      amount = employee.basicSalary;
    }

    const effectiveSalary = amount;
    const dailyRate = Math.floor(effectiveSalary / attendance.totalWorkDays);
    const hourlyRate = Math.floor(employee.basicSalary / 173);

    return {
      lines: [
        buildLine({
          componentCode: 'BASIC_SALARY',
          componentName: 'Gaji Pokok',
          category: ComponentCategory.EARNING,
          quantity,
          rate,
          amount,
          formula: isDaily ? `${rate} × ${quantity} hari` : 'basicSalary',
          sortOrder: 1,
        }),
      ],
      metadata: { effectiveSalary, dailyRate, hourlyRate },
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/calculation/basic-salary.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/calculators/BasicSalaryCalculator.ts tests/modules/salary-v2/calculation/basic-salary.test.ts
git commit -m "feat(salary-v2): add BasicSalaryCalculator with daily employee support"
```

---

## Task 4: ProrataCalculator

**Files:**
- Create: `modules/salary-v2/calculation/calculators/ProrataCalculator.ts`
- Test: `tests/modules/salary-v2/calculation/prorata.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/calculation/prorata.test.ts
import { describe, it, expect } from 'vitest';
import { ProrataCalculator } from '@/modules/salary-v2/calculation/calculators/ProrataCalculator';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { buildLine } from '@/modules/salary-v2/calculation/helpers/line-builder';
import { ComponentCategory } from '@/modules/salary-v2/core';

describe('ProrataCalculator', () => {
  const calculator = new ProrataCalculator();

  it('should have correct metadata', () => {
    expect(calculator.name).toBe('Prorata');
    expect(calculator.order).toBe(15);
    expect(calculator.applicableTo).toEqual(['PKWTT', 'PKWT']);
  });

  it('should not adjust if employee started before period', () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, contractStart: new Date('2024-01-15') },
      period: { start: new Date('2026-04-26'), end: new Date('2026-05-25') },
      previousLines: [
        buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji Pokok', category: ComponentCategory.EARNING, amount: 8000000 }),
      ],
      metadata: { effectiveSalary: 8000000, dailyRate: 363636, hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(0);
  });

  it('should prorate if employee started mid-period', () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, contractStart: new Date('2026-05-10'), basicSalary: 8000000 },
      period: { start: new Date('2026-05-01'), end: new Date('2026-05-31') },
      attendance: { ...createTestContext().attendance, totalWorkDays: 22, effectiveDays: 15 },
      previousLines: [
        buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji Pokok', category: ComponentCategory.EARNING, amount: 8000000 }),
      ],
      metadata: { effectiveSalary: 8000000, dailyRate: 363636, hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe('PRORATA_ADJUSTMENT');
    expect(result.lines[0].category).toBe(ComponentCategory.DEDUCTION);
    const expectedDeduction = 8000000 - Math.floor((8000000 / 22) * 15);
    expect(result.lines[0].amount).toBe(expectedDeduction);
    expect(result.metadata?.prorataApplied).toBe(true);
    expect(result.metadata?.effectiveSalary).toBe(Math.floor((8000000 / 22) * 15));
  });

  it('should not apply to DAILY employees', () => {
    expect(calculator.applicableTo).not.toContain('DAILY');
    expect(calculator.applicableTo).not.toContain('FREELANCE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/calculation/prorata.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement ProrataCalculator**

```typescript
// modules/salary-v2/calculation/calculators/ProrataCalculator.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult, EmployeeType } from '@/modules/salary-v2/core';
import { ComponentCategory } from '@/modules/salary-v2/core';
import { buildLine } from '../helpers/line-builder';

export class ProrataCalculator implements IPayrollCalculator {
  name = 'Prorata';
  order = 15;
  applicableTo: EmployeeType[] = ['PKWTT', 'PKWT'];

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, period, attendance, metadata } = ctx;

    const periodStart = period.start;
    const contractStart = employee.contractStart;

    if (contractStart <= periodStart) {
      return { lines: [] };
    }

    const effectiveSalary = (metadata.effectiveSalary as number) ?? employee.basicSalary;
    const totalWorkDays = attendance.totalWorkDays;
    const effectiveDays = attendance.effectiveDays;

    const dailyRate = Math.floor(effectiveSalary / totalWorkDays);
    const proratedSalary = Math.floor(dailyRate * effectiveDays);
    const deduction = effectiveSalary - proratedSalary;

    if (deduction <= 0) {
      return { lines: [] };
    }

    return {
      lines: [
        buildLine({
          componentCode: 'PRORATA_ADJUSTMENT',
          componentName: 'Penyesuaian Prorata',
          category: ComponentCategory.DEDUCTION,
          quantity: totalWorkDays - effectiveDays,
          rate: dailyRate,
          amount: deduction,
          formula: `${effectiveSalary} - (${dailyRate} × ${effectiveDays})`,
          sortOrder: 2,
        }),
      ],
      metadata: {
        prorataApplied: true,
        effectiveSalary: proratedSalary,
        dailyRate,
      },
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/calculation/prorata.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/calculators/ProrataCalculator.ts tests/modules/salary-v2/calculation/prorata.test.ts
git commit -m "feat(salary-v2): add ProrataCalculator for mid-period joins"
```

---

## Task 5: AttendanceCalculator

**Files:**
- Create: `modules/salary-v2/calculation/calculators/AttendanceCalculator.ts`
- Test: `tests/modules/salary-v2/calculation/attendance.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/calculation/attendance.test.ts
import { describe, it, expect } from 'vitest';
import { AttendanceCalculator } from '@/modules/salary-v2/calculation/calculators/AttendanceCalculator';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { ComponentCategory } from '@/modules/salary-v2/core';

describe('AttendanceCalculator', () => {
  const calculator = new AttendanceCalculator();

  it('should have correct metadata', () => {
    expect(calculator.name).toBe('Attendance');
    expect(calculator.order).toBe(20);
    expect(calculator.applicableTo).toBeNull();
  });

  it('should not deduct if no absences', () => {
    const ctx = createTestContext({
      attendance: { totalWorkDays: 22, presentDays: 22, absentDays: 0, lateDays: 0, sickDays: 0, permitDays: 0, effectiveDays: 22 },
      metadata: { effectiveSalary: 8000000, dailyRate: 363636 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it('should deduct for absent days (alpha)', () => {
    const ctx = createTestContext({
      attendance: { totalWorkDays: 22, presentDays: 19, absentDays: 3, lateDays: 0, sickDays: 0, permitDays: 0, effectiveDays: 19 },
      metadata: { effectiveSalary: 8000000, dailyRate: 363636 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe('ABSENT_DEDUCTION');
    expect(result.lines[0].category).toBe(ComponentCategory.DEDUCTION);
    expect(result.lines[0].amount).toBe(363636 * 3);
    expect(result.lines[0].quantity).toBe(3);
    expect(result.lines[0].rate).toBe(363636);
  });

  it('should deduct for late days if threshold exceeded', () => {
    const ctx = createTestContext({
      attendance: { totalWorkDays: 22, presentDays: 22, absentDays: 0, lateDays: 4, sickDays: 0, permitDays: 0, effectiveDays: 22 },
      metadata: { effectiveSalary: 8000000, dailyRate: 363636 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe('LATE_DEDUCTION');
    expect(result.lines[0].category).toBe(ComponentCategory.DEDUCTION);
    expect(result.lines[0].amount).toBe(Math.floor(363636 * 0.5) * 4);
  });

  it('should not deduct for late if within threshold (3 or fewer)', () => {
    const ctx = createTestContext({
      attendance: { totalWorkDays: 22, presentDays: 22, absentDays: 0, lateDays: 3, sickDays: 0, permitDays: 0, effectiveDays: 22 },
      metadata: { effectiveSalary: 8000000, dailyRate: 363636 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it('should handle both absent and late deductions', () => {
    const ctx = createTestContext({
      attendance: { totalWorkDays: 22, presentDays: 17, absentDays: 2, lateDays: 5, sickDays: 2, permitDays: 1, effectiveDays: 17 },
      metadata: { effectiveSalary: 8000000, dailyRate: 363636 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].componentCode).toBe('ABSENT_DEDUCTION');
    expect(result.lines[1].componentCode).toBe('LATE_DEDUCTION');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/calculation/attendance.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement AttendanceCalculator**

```typescript
// modules/salary-v2/calculation/calculators/AttendanceCalculator.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult } from '@/modules/salary-v2/core';
import { ComponentCategory } from '@/modules/salary-v2/core';
import { buildLine } from '../helpers/line-builder';

const LATE_THRESHOLD = 3;
const LATE_PENALTY_RATE = 0.5;

export class AttendanceCalculator implements IPayrollCalculator {
  name = 'Attendance';
  order = 20;
  applicableTo = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { attendance, metadata } = ctx;
    const dailyRate = (metadata.dailyRate as number) ?? 0;
    const lines = [];

    if (attendance.absentDays > 0) {
      const amount = dailyRate * attendance.absentDays;
      lines.push(
        buildLine({
          componentCode: 'ABSENT_DEDUCTION',
          componentName: 'Potongan Alpha',
          category: ComponentCategory.DEDUCTION,
          quantity: attendance.absentDays,
          rate: dailyRate,
          amount,
          formula: `${dailyRate} × ${attendance.absentDays} hari alpha`,
          sortOrder: 10,
        })
      );
    }

    if (attendance.lateDays > LATE_THRESHOLD) {
      const lateRate = Math.floor(dailyRate * LATE_PENALTY_RATE);
      const amount = lateRate * attendance.lateDays;
      lines.push(
        buildLine({
          componentCode: 'LATE_DEDUCTION',
          componentName: 'Potongan Keterlambatan',
          category: ComponentCategory.DEDUCTION,
          quantity: attendance.lateDays,
          rate: lateRate,
          amount,
          formula: `${lateRate} × ${attendance.lateDays} hari telat (>${LATE_THRESHOLD} threshold)`,
          sortOrder: 11,
        })
      );
    }

    return { lines };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/calculation/attendance.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/calculators/AttendanceCalculator.ts tests/modules/salary-v2/calculation/attendance.test.ts
git commit -m "feat(salary-v2): add AttendanceCalculator with absent and late deductions"
```

---

## Task 6: OvertimeCalculator

**Files:**
- Create: `modules/salary-v2/calculation/calculators/OvertimeCalculator.ts`
- Test: `tests/modules/salary-v2/calculation/overtime.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/calculation/overtime.test.ts
import { describe, it, expect } from 'vitest';
import { OvertimeCalculator } from '@/modules/salary-v2/calculation/calculators/OvertimeCalculator';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { ComponentCategory } from '@/modules/salary-v2/core';

describe('OvertimeCalculator', () => {
  const calculator = new OvertimeCalculator();

  it('should have correct metadata', () => {
    expect(calculator.name).toBe('Overtime');
    expect(calculator.order).toBe(30);
    expect(calculator.applicableTo).toBeNull();
  });

  it('should not generate lines if no overtime', () => {
    const ctx = createTestContext({
      overtime: { normalMinutes: 0, holidayMinutes: 0, nationalHolidayMinutes: 0, totalMinutes: 0 },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it('should skip if employee not overtime eligible', () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, overtimeEligible: false },
      overtime: { normalMinutes: 120, holidayMinutes: 0, nationalHolidayMinutes: 0, totalMinutes: 120 },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it('should calculate workday overtime with tiered multipliers', () => {
    // 2.5 hours = 150 minutes on workday
    // First hour (60 min): 1.5x, Remaining 1.5 hours (90 min): 2x
    const ctx = createTestContext({
      overtime: { normalMinutes: 150, holidayMinutes: 0, nationalHolidayMinutes: 0, totalMinutes: 150 },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe('OVERTIME');
    expect(result.lines[0].category).toBe(ComponentCategory.EARNING);

    // 1 hour × 1.5 × 46242 = 69363 + 1.5 hours × 2 × 46242 = 138726 = 208089
    const firstHour = Math.floor(1 * 1.5 * 46242);
    const remaining = Math.floor(1.5 * 2 * 46242);
    expect(result.lines[0].amount).toBe(firstHour + remaining);
  });

  it('should calculate holiday overtime with tiered multipliers', () => {
    // 9 hours = 540 minutes on holiday
    // 0-7 hours: 2x, 7-8 hours: 3x, 8+ hours: 4x
    const ctx = createTestContext({
      overtime: { normalMinutes: 0, holidayMinutes: 540, nationalHolidayMinutes: 0, totalMinutes: 540 },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    const first7 = Math.floor(7 * 2 * 46242);
    const hour8 = Math.floor(1 * 3 * 46242);
    const hour9 = Math.floor(1 * 4 * 46242);
    expect(result.lines[0].amount).toBe(first7 + hour8 + hour9);
  });

  it('should calculate national holiday overtime', () => {
    // 7 hours = 420 minutes on national holiday
    // 0-5 hours: 2x, 5-6 hours: 3x, 6+ hours: 4x
    const ctx = createTestContext({
      overtime: { normalMinutes: 0, holidayMinutes: 0, nationalHolidayMinutes: 420, totalMinutes: 420 },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    const first5 = Math.floor(5 * 2 * 46242);
    const hour6 = Math.floor(1 * 3 * 46242);
    const hour7 = Math.floor(1 * 4 * 46242);
    expect(result.lines[0].amount).toBe(first5 + hour6 + hour7);
  });

  it('should combine all overtime types into one line', () => {
    const ctx = createTestContext({
      overtime: { normalMinutes: 60, holidayMinutes: 60, nationalHolidayMinutes: 60, totalMinutes: 180 },
      metadata: { hourlyRate: 46242 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe('OVERTIME');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/calculation/overtime.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement OvertimeCalculator**

```typescript
// modules/salary-v2/calculation/calculators/OvertimeCalculator.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult, OvertimeConfig, OvertimeTier } from '@/modules/salary-v2/core';
import { ComponentCategory, OvertimeDayType } from '@/modules/salary-v2/core';
import { buildLine } from '../helpers/line-builder';

export class OvertimeCalculator implements IPayrollCalculator {
  name = 'Overtime';
  order = 30;
  applicableTo = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, overtime, metadata, config } = ctx;

    if (!employee.overtimeEligible || overtime.totalMinutes === 0) {
      return { lines: [] };
    }

    const hourlyRate = (metadata.hourlyRate as number) ?? Math.floor(employee.basicSalary / 173);
    const overtimeConfig = config.overtime;

    let totalAmount = 0;

    if (overtime.normalMinutes > 0) {
      totalAmount += this.calculateTiered(overtime.normalMinutes / 60, hourlyRate, overtimeConfig.tiers, OvertimeDayType.WORKDAY);
    }

    if (overtime.holidayMinutes > 0) {
      totalAmount += this.calculateTiered(overtime.holidayMinutes / 60, hourlyRate, overtimeConfig.tiers, OvertimeDayType.HOLIDAY);
    }

    if (overtime.nationalHolidayMinutes > 0) {
      totalAmount += this.calculateTiered(overtime.nationalHolidayMinutes / 60, hourlyRate, overtimeConfig.tiers, OvertimeDayType.NATIONAL_HOLIDAY);
    }

    if (totalAmount === 0) {
      return { lines: [] };
    }

    return {
      lines: [
        buildLine({
          componentCode: 'OVERTIME',
          componentName: 'Lembur',
          category: ComponentCategory.EARNING,
          quantity: overtime.totalMinutes / 60,
          rate: hourlyRate,
          amount: totalAmount,
          formula: `tiered(normal=${overtime.normalMinutes}m, holiday=${overtime.holidayMinutes}m, national=${overtime.nationalHolidayMinutes}m)`,
          sortOrder: 5,
        }),
      ],
      metadata: { overtimeAmount: totalAmount },
    };
  }

  private calculateTiered(hours: number, hourlyRate: number, tiers: OvertimeTier[], dayType: string): number {
    const applicableTiers = tiers
      .filter(t => t.dayType === dayType)
      .sort((a, b) => a.fromHour - b.fromHour);

    let total = 0;
    let remainingHours = hours;

    for (const tier of applicableTiers) {
      if (remainingHours <= 0) break;

      const tierHours = tier.toHour !== null
        ? Math.min(remainingHours, tier.toHour - tier.fromHour)
        : remainingHours;

      total += Math.floor(tierHours * tier.multiplier * hourlyRate);
      remainingHours -= tierHours;
    }

    return total;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/calculation/overtime.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/calculators/OvertimeCalculator.ts tests/modules/salary-v2/calculation/overtime.test.ts
git commit -m "feat(salary-v2): add OvertimeCalculator with tiered multipliers (PP 35/2021)"
```

---

## Task 7: ComponentCalculator (Custom Earning/Deduction Components)

**Files:**
- Create: `modules/salary-v2/calculation/calculators/ComponentCalculator.ts`
- Test: `tests/modules/salary-v2/calculation/component.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/calculation/component.test.ts
import { describe, it, expect } from 'vitest';
import { ComponentCalculator } from '@/modules/salary-v2/calculation/calculators/ComponentCalculator';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { ComponentCategory, ComponentCalculationType } from '@/modules/salary-v2/core';
import type { EmployeeComponent } from '@/modules/salary-v2/core';

describe('ComponentCalculator', () => {
  const calculator = new ComponentCalculator();

  it('should have correct metadata', () => {
    expect(calculator.name).toBe('Component');
    expect(calculator.order).toBe(40);
    expect(calculator.applicableTo).toBeNull();
  });

  it('should not generate lines if no components assigned', () => {
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components: [] },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it('should calculate FIXED component', () => {
    const components: EmployeeComponent[] = [{
      componentId: 'comp-1', componentCode: 'ALW_TRANSPORT', componentName: 'Tunjangan Transport',
      category: ComponentCategory.EARNING, calculationType: ComponentCalculationType.FIXED,
      amount: 500000, isActive: true,
    }];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].amount).toBe(500000);
    expect(result.lines[0].componentCode).toBe('ALW_TRANSPORT');
    expect(result.lines[0].category).toBe(ComponentCategory.EARNING);
  });

  it('should calculate PERCENTAGE component (% of effective salary)', () => {
    const components: EmployeeComponent[] = [{
      componentId: 'comp-2', componentCode: 'ALW_POSITION', componentName: 'Tunjangan Jabatan',
      category: ComponentCategory.EARNING, calculationType: ComponentCalculationType.PERCENTAGE,
      amount: 10, isActive: true,
    }];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].amount).toBe(800000);
  });

  it('should calculate PER_DAY component', () => {
    const components: EmployeeComponent[] = [{
      componentId: 'comp-3', componentCode: 'ALW_MEAL', componentName: 'Uang Makan',
      category: ComponentCategory.EARNING, calculationType: ComponentCalculationType.PER_DAY,
      amount: 25000, isActive: true,
    }];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      attendance: { ...createTestContext().attendance, effectiveDays: 20 },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].amount).toBe(500000);
    expect(result.lines[0].quantity).toBe(20);
    expect(result.lines[0].rate).toBe(25000);
  });

  it('should skip inactive components', () => {
    const components: EmployeeComponent[] = [{
      componentId: 'comp-1', componentCode: 'ALW_TRANSPORT', componentName: 'Tunjangan Transport',
      category: ComponentCategory.EARNING, calculationType: ComponentCalculationType.FIXED,
      amount: 500000, isActive: false,
    }];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it('should handle deduction components', () => {
    const components: EmployeeComponent[] = [{
      componentId: 'comp-4', componentCode: 'DED_PARKING', componentName: 'Potongan Parkir',
      category: ComponentCategory.DEDUCTION, calculationType: ComponentCalculationType.FIXED,
      amount: 100000, isActive: true,
    }];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].category).toBe(ComponentCategory.DEDUCTION);
    expect(result.lines[0].amount).toBe(100000);
  });

  it('should handle multiple components in order', () => {
    const components: EmployeeComponent[] = [
      { componentId: 'comp-1', componentCode: 'ALW_TRANSPORT', componentName: 'Transport', category: ComponentCategory.EARNING, calculationType: ComponentCalculationType.FIXED, amount: 500000, isActive: true },
      { componentId: 'comp-2', componentCode: 'ALW_MEAL', componentName: 'Makan', category: ComponentCategory.EARNING, calculationType: ComponentCalculationType.PER_DAY, amount: 25000, isActive: true },
      { componentId: 'comp-3', componentCode: 'DED_PARKING', componentName: 'Parkir', category: ComponentCategory.DEDUCTION, calculationType: ComponentCalculationType.FIXED, amount: 50000, isActive: true },
    ];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, components },
      attendance: { ...createTestContext().attendance, effectiveDays: 22 },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/calculation/component.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement ComponentCalculator**

```typescript
// modules/salary-v2/calculation/calculators/ComponentCalculator.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult, EmployeeComponent } from '@/modules/salary-v2/core';
import { ComponentCalculationType } from '@/modules/salary-v2/core';
import { buildLine } from '../helpers/line-builder';

export class ComponentCalculator implements IPayrollCalculator {
  name = 'Component';
  order = 40;
  applicableTo = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, attendance, metadata } = ctx;
    const effectiveSalary = (metadata.effectiveSalary as number) ?? employee.basicSalary;
    const lines = [];

    const activeComponents = employee.components.filter(c => c.isActive);

    for (const comp of activeComponents) {
      const line = this.calculateComponent(comp, effectiveSalary, attendance.effectiveDays);
      if (line) {
        lines.push(line);
      }
    }

    return { lines };
  }

  private calculateComponent(comp: EmployeeComponent, effectiveSalary: number, effectiveDays: number) {
    const baseAmount = comp.amount ?? 0;

    let amount: number;
    let quantity = 1;
    let rate = baseAmount;
    let formula: string;

    switch (comp.calculationType) {
      case ComponentCalculationType.FIXED:
        amount = baseAmount;
        formula = `fixed: ${baseAmount}`;
        break;

      case ComponentCalculationType.PERCENTAGE:
        amount = Math.floor(effectiveSalary * (baseAmount / 100));
        rate = baseAmount;
        formula = `${effectiveSalary} × ${baseAmount}%`;
        break;

      case ComponentCalculationType.PER_DAY:
        quantity = effectiveDays;
        amount = Math.floor(baseAmount * effectiveDays);
        formula = `${baseAmount} × ${effectiveDays} hari`;
        break;

      case ComponentCalculationType.PER_HOUR:
        amount = baseAmount;
        formula = `per_hour: ${baseAmount}`;
        break;

      case ComponentCalculationType.PER_UNIT:
        amount = baseAmount;
        formula = `per_unit: ${baseAmount}`;
        break;

      default:
        amount = baseAmount;
        formula = `unknown: ${baseAmount}`;
    }

    if (amount === 0) return null;

    return buildLine({
      componentId: comp.componentId,
      componentCode: comp.componentCode,
      componentName: comp.componentName,
      category: comp.category,
      quantity,
      rate,
      amount,
      formula,
      sortOrder: 20,
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/calculation/component.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/calculators/ComponentCalculator.ts tests/modules/salary-v2/calculation/component.test.ts
git commit -m "feat(salary-v2): add ComponentCalculator for custom earning/deduction components"
```

---

## Task 8: BpjsCalculator

**Files:**
- Create: `modules/salary-v2/calculation/calculators/BpjsCalculator.ts`
- Test: `tests/modules/salary-v2/calculation/bpjs.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/calculation/bpjs.test.ts
import { describe, it, expect } from 'vitest';
import { BpjsCalculator } from '@/modules/salary-v2/calculation/calculators/BpjsCalculator';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { ComponentCategory } from '@/modules/salary-v2/core';

describe('BpjsCalculator', () => {
  const calculator = new BpjsCalculator();

  it('should have correct metadata', () => {
    expect(calculator.name).toBe('Bpjs');
    expect(calculator.order).toBe(50);
    expect(calculator.applicableTo).toBeNull();
  });

  it('should calculate all BPJS components for fully enrolled employee', () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 8000000,
        bpjsConfig: { kesehatan: true, jht: true, jp: true, jkk: true, jkm: true },
      },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    const deductions = result.lines.filter(l => l.category === ComponentCategory.DEDUCTION);
    const employerCosts = result.lines.filter(l => l.category === ComponentCategory.EMPLOYER_COST);

    // Employee deductions: Kes 1% + JHT 2% + JP 1% = 4%
    expect(deductions).toHaveLength(3);
    // Employer costs: Kes 4% + JHT 3.7% + JP 2% + JKK 0.24% + JKM 0.3% = 10.24%
    expect(employerCosts).toHaveLength(5);
  });

  it('should calculate BPJS Kesehatan with cap at 12M', () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 15000000,
        bpjsConfig: { kesehatan: true, jht: false, jp: false, jkk: false, jkm: false },
      },
      metadata: { effectiveSalary: 15000000 },
    });
    const result = calculator.calculate(ctx);

    const kesEmployee = result.lines.find(l => l.componentCode === 'BPJS_KES_EE');
    const kesEmployer = result.lines.find(l => l.componentCode === 'BPJS_KES_ER');

    // Capped at 12M base: employee 1% of 12M = 120000
    expect(kesEmployee?.amount).toBe(120000);
    // Employer 4% of 12M = 480000
    expect(kesEmployer?.amount).toBe(480000);
  });

  it('should calculate BPJS Kesehatan without cap if below', () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 8000000,
        bpjsConfig: { kesehatan: true, jht: false, jp: false, jkk: false, jkm: false },
      },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    const kesEmployee = result.lines.find(l => l.componentCode === 'BPJS_KES_EE');
    expect(kesEmployee?.amount).toBe(80000);
  });

  it('should calculate BPJS JHT without cap', () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 20000000,
        bpjsConfig: { kesehatan: false, jht: true, jp: false, jkk: false, jkm: false },
      },
      metadata: { effectiveSalary: 20000000 },
    });
    const result = calculator.calculate(ctx);

    const jhtEmployee = result.lines.find(l => l.componentCode === 'BPJS_JHT_EE');
    const jhtEmployer = result.lines.find(l => l.componentCode === 'BPJS_JHT_ER');

    expect(jhtEmployee?.amount).toBe(400000);
    expect(jhtEmployer?.amount).toBe(740000);
  });

  it('should calculate BPJS JP with cap at 10.042M', () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 15000000,
        bpjsConfig: { kesehatan: false, jht: false, jp: true, jkk: false, jkm: false },
      },
      metadata: { effectiveSalary: 15000000 },
    });
    const result = calculator.calculate(ctx);

    const jpEmployee = result.lines.find(l => l.componentCode === 'BPJS_JP_EE');
    const jpEmployer = result.lines.find(l => l.componentCode === 'BPJS_JP_ER');

    // Capped at 10.042M: employee 1% = 100420, employer 2% = 200840
    expect(jpEmployee?.amount).toBe(100420);
    expect(jpEmployer?.amount).toBe(200840);
  });

  it('should calculate JKK and JKM (employer only)', () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        basicSalary: 8000000,
        bpjsConfig: { kesehatan: false, jht: false, jp: false, jkk: true, jkm: true },
      },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);

    const jkk = result.lines.find(l => l.componentCode === 'BPJS_JKK_ER');
    const jkm = result.lines.find(l => l.componentCode === 'BPJS_JKM_ER');

    expect(jkk?.amount).toBe(Math.floor(8000000 * 0.0024));
    expect(jkk?.category).toBe(ComponentCategory.EMPLOYER_COST);
    expect(jkm?.amount).toBe(Math.floor(8000000 * 0.003));
    expect(jkm?.category).toBe(ComponentCategory.EMPLOYER_COST);
  });

  it('should skip BPJS programs not enrolled', () => {
    const ctx = createTestContext({
      employee: {
        ...createTestContext().employee,
        bpjsConfig: { kesehatan: false, jht: false, jp: false, jkk: false, jkm: false },
      },
      metadata: { effectiveSalary: 8000000 },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/calculation/bpjs.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement BpjsCalculator**

```typescript
// modules/salary-v2/calculation/calculators/BpjsCalculator.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult, PayrollLine } from '@/modules/salary-v2/core';
import { ComponentCategory } from '@/modules/salary-v2/core';
import { buildLine } from '../helpers/line-builder';

export class BpjsCalculator implements IPayrollCalculator {
  name = 'Bpjs';
  order = 50;
  applicableTo = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, config, metadata } = ctx;
    const bpjsEnrollment = employee.bpjsConfig;
    const bpjsRates = config.bpjs;
    const effectiveSalary = (metadata.effectiveSalary as number) ?? employee.basicSalary;
    const lines: PayrollLine[] = [];

    if (bpjsEnrollment.kesehatan) {
      const base = bpjsRates.kesehatan.maxBase
        ? Math.min(effectiveSalary, bpjsRates.kesehatan.maxBase)
        : effectiveSalary;

      lines.push(buildLine({
        componentCode: 'BPJS_KES_EE', componentName: 'BPJS Kesehatan (Karyawan)',
        category: ComponentCategory.DEDUCTION,
        amount: Math.floor(base * bpjsRates.kesehatan.employeeRate),
        formula: `min(${effectiveSalary}, ${bpjsRates.kesehatan.maxBase}) × ${bpjsRates.kesehatan.employeeRate}`,
        sortOrder: 30,
      }));
      lines.push(buildLine({
        componentCode: 'BPJS_KES_ER', componentName: 'BPJS Kesehatan (Perusahaan)',
        category: ComponentCategory.EMPLOYER_COST,
        amount: Math.floor(base * bpjsRates.kesehatan.employerRate),
        formula: `min(${effectiveSalary}, ${bpjsRates.kesehatan.maxBase}) × ${bpjsRates.kesehatan.employerRate}`,
        sortOrder: 31,
      }));
    }

    if (bpjsEnrollment.jht) {
      const base = bpjsRates.jht.maxBase
        ? Math.min(effectiveSalary, bpjsRates.jht.maxBase)
        : effectiveSalary;

      lines.push(buildLine({
        componentCode: 'BPJS_JHT_EE', componentName: 'BPJS JHT (Karyawan)',
        category: ComponentCategory.DEDUCTION,
        amount: Math.floor(base * bpjsRates.jht.employeeRate),
        formula: `${base} × ${bpjsRates.jht.employeeRate}`,
        sortOrder: 32,
      }));
      lines.push(buildLine({
        componentCode: 'BPJS_JHT_ER', componentName: 'BPJS JHT (Perusahaan)',
        category: ComponentCategory.EMPLOYER_COST,
        amount: Math.floor(base * bpjsRates.jht.employerRate),
        formula: `${base} × ${bpjsRates.jht.employerRate}`,
        sortOrder: 33,
      }));
    }

    if (bpjsEnrollment.jp) {
      const base = bpjsRates.jp.maxBase
        ? Math.min(effectiveSalary, bpjsRates.jp.maxBase)
        : effectiveSalary;

      lines.push(buildLine({
        componentCode: 'BPJS_JP_EE', componentName: 'BPJS JP (Karyawan)',
        category: ComponentCategory.DEDUCTION,
        amount: Math.floor(base * bpjsRates.jp.employeeRate),
        formula: `min(${effectiveSalary}, ${bpjsRates.jp.maxBase}) × ${bpjsRates.jp.employeeRate}`,
        sortOrder: 34,
      }));
      lines.push(buildLine({
        componentCode: 'BPJS_JP_ER', componentName: 'BPJS JP (Perusahaan)',
        category: ComponentCategory.EMPLOYER_COST,
        amount: Math.floor(base * bpjsRates.jp.employerRate),
        formula: `min(${effectiveSalary}, ${bpjsRates.jp.maxBase}) × ${bpjsRates.jp.employerRate}`,
        sortOrder: 35,
      }));
    }

    if (bpjsEnrollment.jkk) {
      lines.push(buildLine({
        componentCode: 'BPJS_JKK_ER', componentName: 'BPJS JKK (Perusahaan)',
        category: ComponentCategory.EMPLOYER_COST,
        amount: Math.floor(effectiveSalary * bpjsRates.jkk.employerRate),
        formula: `${effectiveSalary} × ${bpjsRates.jkk.employerRate}`,
        sortOrder: 36,
      }));
    }

    if (bpjsEnrollment.jkm) {
      lines.push(buildLine({
        componentCode: 'BPJS_JKM_ER', componentName: 'BPJS JKM (Perusahaan)',
        category: ComponentCategory.EMPLOYER_COST,
        amount: Math.floor(effectiveSalary * bpjsRates.jkm.employerRate),
        formula: `${effectiveSalary} × ${bpjsRates.jkm.employerRate}`,
        sortOrder: 37,
      }));
    }

    return { lines };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/calculation/bpjs.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/calculators/BpjsCalculator.ts tests/modules/salary-v2/calculation/bpjs.test.ts
git commit -m "feat(salary-v2): add BpjsCalculator with full employee+employer BPJS calculation"
```

---

## Task 9: TaxCalculator (PPh 21 TER)

**Files:**
- Create: `modules/salary-v2/calculation/calculators/TaxCalculator.ts`
- Test: `tests/modules/salary-v2/calculation/tax.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/calculation/tax.test.ts
import { describe, it, expect } from 'vitest';
import { TaxCalculator } from '@/modules/salary-v2/calculation/calculators/TaxCalculator';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { buildLine, sumEarnings, sumDeductions } from '@/modules/salary-v2/calculation/helpers/line-builder';
import { ComponentCategory } from '@/modules/salary-v2/core';

describe('TaxCalculator', () => {
  const calculator = new TaxCalculator();

  it('should have correct metadata', () => {
    expect(calculator.name).toBe('Tax');
    expect(calculator.order).toBe(60);
    expect(calculator.applicableTo).toBeNull();
  });

  it('should calculate PPh 21 for NET method (employee pays)', () => {
    const previousLines = [
      buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji Pokok', category: ComponentCategory.EARNING, amount: 10000000 }),
      buildLine({ componentCode: 'BPJS_JHT_EE', componentName: 'BPJS JHT', category: ComponentCategory.DEDUCTION, amount: 200000 }),
    ];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, taxMethod: 'NET', ptkpStatus: 'TK_0', basicSalary: 10000000 },
      previousLines,
      metadata: { effectiveSalary: 10000000 },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe('PPH21');
    expect(result.lines[0].category).toBe(ComponentCategory.TAX);
    expect(result.lines[0].amount).toBeGreaterThan(0);
  });

  it('should calculate PPh 21 for GROSS_UP method (employer pays, adds tunjangan)', () => {
    const previousLines = [
      buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji Pokok', category: ComponentCategory.EARNING, amount: 10000000 }),
    ];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, taxMethod: 'GROSS_UP', ptkpStatus: 'TK_0', basicSalary: 10000000 },
      previousLines,
      metadata: { effectiveSalary: 10000000 },
    });
    const result = calculator.calculate(ctx);

    const taxAllowance = result.lines.find(l => l.componentCode === 'TAX_ALLOWANCE');
    const pph21 = result.lines.find(l => l.componentCode === 'PPH21');

    expect(taxAllowance).toBeDefined();
    expect(taxAllowance?.category).toBe(ComponentCategory.EARNING);
    expect(pph21).toBeDefined();
    expect(pph21?.category).toBe(ComponentCategory.TAX);
    expect(taxAllowance?.amount).toBe(pph21?.amount);
  });

  it('should calculate PPh 21 for NETT method (employer pays, no tunjangan)', () => {
    const previousLines = [
      buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji Pokok', category: ComponentCategory.EARNING, amount: 10000000 }),
    ];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, taxMethod: 'NETT', ptkpStatus: 'TK_0', basicSalary: 10000000 },
      previousLines,
      metadata: { effectiveSalary: 10000000 },
    });
    const result = calculator.calculate(ctx);

    const pph21 = result.lines.find(l => l.componentCode === 'PPH21');
    expect(pph21).toBeDefined();
    expect(pph21?.category).toBe(ComponentCategory.EMPLOYER_COST);
  });

  it('should apply 20% surcharge if no NPWP', () => {
    const previousLines = [
      buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji Pokok', category: ComponentCategory.EARNING, amount: 10000000 }),
    ];
    const withNpwp = createTestContext({
      employee: { ...createTestContext().employee, taxMethod: 'NET', npwp: '12.345.678.9-012.000', basicSalary: 10000000 },
      previousLines,
      metadata: { effectiveSalary: 10000000 },
    });
    const withoutNpwp = createTestContext({
      employee: { ...createTestContext().employee, taxMethod: 'NET', npwp: null, basicSalary: 10000000 },
      previousLines,
      metadata: { effectiveSalary: 10000000 },
    });

    const resultWith = calculator.calculate(withNpwp);
    const resultWithout = calculator.calculate(withoutNpwp);

    const taxWith = resultWith.lines.find(l => l.componentCode === 'PPH21')?.amount ?? 0;
    const taxWithout = resultWithout.lines.find(l => l.componentCode === 'PPH21')?.amount ?? 0;

    expect(taxWithout).toBe(Math.floor(taxWith * 1.2));
  });

  it('should return zero tax if gross income is below threshold', () => {
    const previousLines = [
      buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji Pokok', category: ComponentCategory.EARNING, amount: 4500000 }),
    ];
    const ctx = createTestContext({
      employee: { ...createTestContext().employee, taxMethod: 'NET', ptkpStatus: 'TK_0', basicSalary: 4500000 },
      previousLines,
      metadata: { effectiveSalary: 4500000 },
    });
    const result = calculator.calculate(ctx);

    const pph21 = result.lines.find(l => l.componentCode === 'PPH21');
    expect(pph21?.amount ?? 0).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/calculation/tax.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement TaxCalculator**

```typescript
// modules/salary-v2/calculation/calculators/TaxCalculator.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult, PayrollLine, TenantTaxConfig } from '@/modules/salary-v2/core';
import { ComponentCategory } from '@/modules/salary-v2/core';
import { buildLine, sumEarnings, sumDeductions } from '../helpers/line-builder';

export class TaxCalculator implements IPayrollCalculator {
  name = 'Tax';
  order = 60;
  applicableTo = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { employee, previousLines, config } = ctx;
    const taxConfig = config.tax;

    const grossIncome = sumEarnings(previousLines);
    const bpjsEmployeeDeductions = previousLines
      .filter(l => l.category === ComponentCategory.DEDUCTION && l.componentCode.startsWith('BPJS_'))
      .reduce((sum, l) => sum + l.amount, 0);

    const biayaJabatan = Math.min(
      Math.floor(grossIncome * taxConfig.biayaJabatanRate),
      taxConfig.biayaJabatanMax
    );

    const taxableIncome = grossIncome - biayaJabatan - bpjsEmployeeDeductions;

    const ptkpMonthly = this.getMonthlyPtkp(employee.ptkpStatus, taxConfig);
    const netTaxable = taxableIncome - ptkpMonthly;

    if (netTaxable <= 0) {
      return {
        lines: [buildLine({
          componentCode: 'PPH21', componentName: 'PPh 21',
          category: employee.taxMethod === 'NETT' ? ComponentCategory.EMPLOYER_COST : ComponentCategory.TAX,
          amount: 0, formula: 'taxableIncome <= PTKP', sortOrder: 40,
        })],
        metadata: { pph21: 0, taxableIncome: netTaxable },
      };
    }

    const annualizedTaxable = netTaxable * 12;
    const annualTax = this.calculateProgressiveTax(annualizedTaxable, taxConfig);
    let monthlyTax = Math.floor(annualTax / 12);

    if (!employee.npwp) {
      monthlyTax = Math.floor(monthlyTax * (1 + taxConfig.npwpSurcharge));
    }

    const lines: PayrollLine[] = [];

    if (employee.taxMethod === 'GROSS_UP') {
      lines.push(buildLine({
        componentCode: 'TAX_ALLOWANCE', componentName: 'Tunjangan Pajak',
        category: ComponentCategory.EARNING,
        amount: monthlyTax,
        formula: `gross-up PPh 21`,
        sortOrder: 39,
      }));
      lines.push(buildLine({
        componentCode: 'PPH21', componentName: 'PPh 21',
        category: ComponentCategory.TAX,
        amount: monthlyTax,
        formula: `TER: annualized(${annualizedTaxable}) / 12`,
        sortOrder: 40,
      }));
    } else if (employee.taxMethod === 'NETT') {
      lines.push(buildLine({
        componentCode: 'PPH21', componentName: 'PPh 21 (Ditanggung Perusahaan)',
        category: ComponentCategory.EMPLOYER_COST,
        amount: monthlyTax,
        formula: `NETT: annualized(${annualizedTaxable}) / 12`,
        sortOrder: 40,
      }));
    } else {
      lines.push(buildLine({
        componentCode: 'PPH21', componentName: 'PPh 21',
        category: ComponentCategory.TAX,
        amount: monthlyTax,
        formula: `NET: annualized(${annualizedTaxable}) / 12`,
        sortOrder: 40,
      }));
    }

    return { lines, metadata: { pph21: monthlyTax, taxableIncome: netTaxable } };
  }

  private getMonthlyPtkp(ptkpStatus: string, taxConfig: TenantTaxConfig): number {
    const entry = taxConfig.ptkpTable.find(p => p.status === ptkpStatus);
    if (!entry) return 0;
    return Math.floor(entry.annualAmount / 12);
  }

  private calculateProgressiveTax(annualTaxable: number, taxConfig: TenantTaxConfig): number {
    let remaining = annualTaxable;
    let totalTax = 0;

    for (const bracket of taxConfig.progressiveRates) {
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/calculation/tax.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/calculators/TaxCalculator.ts tests/modules/salary-v2/calculation/tax.test.ts
git commit -m "feat(salary-v2): add TaxCalculator with PPh 21 TER (NET/GROSS_UP/NETT methods)"
```

---

## Task 10: LoanDeductionCalculator

**Files:**
- Create: `modules/salary-v2/calculation/calculators/LoanDeductionCalculator.ts`
- Test: `tests/modules/salary-v2/calculation/loan-deduction.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/calculation/loan-deduction.test.ts
import { describe, it, expect } from 'vitest';
import { LoanDeductionCalculator } from '@/modules/salary-v2/calculation/calculators/LoanDeductionCalculator';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { ComponentCategory } from '@/modules/salary-v2/core';

describe('LoanDeductionCalculator', () => {
  const calculator = new LoanDeductionCalculator();

  it('should have correct metadata', () => {
    expect(calculator.name).toBe('LoanDeduction');
    expect(calculator.order).toBe(70);
    expect(calculator.applicableTo).toBeNull();
  });

  it('should not generate lines if no active loans in metadata', () => {
    const ctx = createTestContext({ metadata: { effectiveSalary: 8000000 } });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it('should deduct loan installment', () => {
    const ctx = createTestContext({
      metadata: {
        effectiveSalary: 8000000,
        activeLoans: [
          { id: 'loan-1', name: 'Pinjaman Karyawan', installment: 500000, remainingAmount: 2000000 },
        ],
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe('LOAN_loan-1');
    expect(result.lines[0].category).toBe(ComponentCategory.DEDUCTION);
    expect(result.lines[0].amount).toBe(500000);
  });

  it('should deduct min(installment, remainingAmount)', () => {
    const ctx = createTestContext({
      metadata: {
        effectiveSalary: 8000000,
        activeLoans: [
          { id: 'loan-1', name: 'Pinjaman', installment: 500000, remainingAmount: 200000 },
        ],
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines[0].amount).toBe(200000);
  });

  it('should handle multiple loans', () => {
    const ctx = createTestContext({
      metadata: {
        effectiveSalary: 8000000,
        activeLoans: [
          { id: 'loan-1', name: 'Pinjaman A', installment: 500000, remainingAmount: 2000000 },
          { id: 'loan-2', name: 'Pinjaman B', installment: 300000, remainingAmount: 1500000 },
        ],
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].amount).toBe(500000);
    expect(result.lines[1].amount).toBe(300000);
  });

  it('should handle salary advance deductions', () => {
    const ctx = createTestContext({
      metadata: {
        effectiveSalary: 8000000,
        activeAdvances: [
          { id: 'adv-1', amount: 2000000, deductionMethod: 'FULL_NEXT', remainingAmount: 2000000 },
        ],
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe('ADVANCE_adv-1');
    expect(result.lines[0].componentName).toBe('Potongan Kasbon');
    expect(result.lines[0].amount).toBe(2000000);
  });

  it('should handle installment-based advance', () => {
    const ctx = createTestContext({
      metadata: {
        effectiveSalary: 8000000,
        activeAdvances: [
          { id: 'adv-1', amount: 3000000, deductionMethod: 'INSTALLMENT', installmentCount: 3, remainingAmount: 2000000 },
        ],
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].amount).toBe(1000000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/calculation/loan-deduction.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement LoanDeductionCalculator**

```typescript
// modules/salary-v2/calculation/calculators/LoanDeductionCalculator.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult } from '@/modules/salary-v2/core';
import { ComponentCategory } from '@/modules/salary-v2/core';
import { buildLine } from '../helpers/line-builder';

interface ActiveLoan {
  id: string;
  name: string;
  installment: number;
  remainingAmount: number;
}

interface ActiveAdvance {
  id: string;
  amount: number;
  deductionMethod: 'FULL_NEXT' | 'INSTALLMENT';
  installmentCount?: number;
  remainingAmount: number;
}

export class LoanDeductionCalculator implements IPayrollCalculator {
  name = 'LoanDeduction';
  order = 70;
  applicableTo = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { metadata } = ctx;
    const lines = [];

    const activeLoans = (metadata.activeLoans as ActiveLoan[]) ?? [];
    for (const loan of activeLoans) {
      const amount = Math.min(loan.installment, loan.remainingAmount);
      if (amount > 0) {
        lines.push(buildLine({
          componentCode: `LOAN_${loan.id}`,
          componentName: `Cicilan: ${loan.name}`,
          category: ComponentCategory.DEDUCTION,
          amount,
          formula: `min(${loan.installment}, ${loan.remainingAmount})`,
          sortOrder: 50,
        }));
      }
    }

    const activeAdvances = (metadata.activeAdvances as ActiveAdvance[]) ?? [];
    for (const advance of activeAdvances) {
      let amount: number;
      if (advance.deductionMethod === 'FULL_NEXT') {
        amount = advance.remainingAmount;
      } else {
        const installmentAmount = Math.ceil(advance.amount / (advance.installmentCount ?? 1));
        amount = Math.min(installmentAmount, advance.remainingAmount);
      }

      if (amount > 0) {
        lines.push(buildLine({
          componentCode: `ADVANCE_${advance.id}`,
          componentName: 'Potongan Kasbon',
          category: ComponentCategory.DEDUCTION,
          amount,
          formula: advance.deductionMethod === 'FULL_NEXT'
            ? `full: ${advance.remainingAmount}`
            : `installment: ${advance.amount} / ${advance.installmentCount}`,
          sortOrder: 51,
        }));
      }
    }

    return { lines };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/calculation/loan-deduction.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/calculators/LoanDeductionCalculator.ts tests/modules/salary-v2/calculation/loan-deduction.test.ts
git commit -m "feat(salary-v2): add LoanDeductionCalculator for loans and salary advances"
```

---

## Task 11: NetSalaryCalculator

**Files:**
- Create: `modules/salary-v2/calculation/calculators/NetSalaryCalculator.ts`
- Test: `tests/modules/salary-v2/calculation/net-salary.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/calculation/net-salary.test.ts
import { describe, it, expect } from 'vitest';
import { NetSalaryCalculator } from '@/modules/salary-v2/calculation/calculators/NetSalaryCalculator';
import { createTestContext } from '@/modules/salary-v2/calculation/helpers/context-helpers';
import { buildLine } from '@/modules/salary-v2/calculation/helpers/line-builder';
import { ComponentCategory } from '@/modules/salary-v2/core';

describe('NetSalaryCalculator', () => {
  const calculator = new NetSalaryCalculator();

  it('should have correct metadata', () => {
    expect(calculator.name).toBe('NetSalary');
    expect(calculator.order).toBe(99);
    expect(calculator.applicableTo).toBeNull();
  });

  it('should calculate net salary from previous lines', () => {
    const previousLines = [
      buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji Pokok', category: ComponentCategory.EARNING, amount: 8000000 }),
      buildLine({ componentCode: 'ALW_TRANSPORT', componentName: 'Transport', category: ComponentCategory.EARNING, amount: 500000 }),
      buildLine({ componentCode: 'BPJS_KES_EE', componentName: 'BPJS Kes', category: ComponentCategory.DEDUCTION, amount: 80000 }),
      buildLine({ componentCode: 'BPJS_JHT_EE', componentName: 'BPJS JHT', category: ComponentCategory.DEDUCTION, amount: 160000 }),
      buildLine({ componentCode: 'PPH21', componentName: 'PPh 21', category: ComponentCategory.TAX, amount: 200000 }),
      buildLine({ componentCode: 'BPJS_KES_ER', componentName: 'BPJS Kes ER', category: ComponentCategory.EMPLOYER_COST, amount: 320000 }),
    ];
    const ctx = createTestContext({ previousLines });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(0);
    expect(result.metadata?.totalEarnings).toBe(8500000);
    expect(result.metadata?.totalDeductions).toBe(240000);
    expect(result.metadata?.totalTax).toBe(200000);
    expect(result.metadata?.netSalary).toBe(8060000);
    expect(result.metadata?.totalEmployerCost).toBe(320000);
  });

  it('should handle zero earnings', () => {
    const ctx = createTestContext({ previousLines: [] });
    const result = calculator.calculate(ctx);

    expect(result.metadata?.totalEarnings).toBe(0);
    expect(result.metadata?.netSalary).toBe(0);
  });

  it('should handle case where deductions exceed earnings', () => {
    const previousLines = [
      buildLine({ componentCode: 'BASIC_SALARY', componentName: 'Gaji', category: ComponentCategory.EARNING, amount: 1000000 }),
      buildLine({ componentCode: 'LOAN', componentName: 'Pinjaman', category: ComponentCategory.DEDUCTION, amount: 1500000 }),
    ];
    const ctx = createTestContext({ previousLines });
    const result = calculator.calculate(ctx);

    expect(result.metadata?.netSalary).toBe(-500000);
    expect(result.metadata?.isNegative).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/salary-v2/calculation/net-salary.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement NetSalaryCalculator**

```typescript
// modules/salary-v2/calculation/calculators/NetSalaryCalculator.ts
import type { IPayrollCalculator, CalculationContext, CalculationResult } from '@/modules/salary-v2/core';
import { sumEarnings, sumDeductions, sumTax, sumEmployerCost } from '../helpers/line-builder';

export class NetSalaryCalculator implements IPayrollCalculator {
  name = 'NetSalary';
  order = 99;
  applicableTo = null;

  calculate(ctx: CalculationContext): CalculationResult {
    const { previousLines } = ctx;

    const totalEarnings = sumEarnings(previousLines);
    const totalDeductions = sumDeductions(previousLines);
    const totalTax = sumTax(previousLines);
    const totalEmployerCost = sumEmployerCost(previousLines);
    const netSalary = totalEarnings - totalDeductions - totalTax;

    return {
      lines: [],
      metadata: {
        totalEarnings,
        totalDeductions,
        totalTax,
        netSalary,
        totalEmployerCost,
        isNegative: netSalary < 0,
      },
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/salary-v2/calculation/net-salary.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/calculators/NetSalaryCalculator.ts tests/modules/salary-v2/calculation/net-salary.test.ts
git commit -m "feat(salary-v2): add NetSalaryCalculator for final salary computation"
```

---

## Task 12: Calculation Module Barrel Export & Integration Test

**Files:**
- Create: `modules/salary-v2/calculation/index.ts`
- Modify: `modules/salary-v2/index.ts`

- [ ] **Step 1: Create calculation barrel export**

```typescript
// modules/salary-v2/calculation/index.ts
export { PayrollCalculationEngine } from './engine/PayrollCalculationEngine';
export { BasicSalaryCalculator } from './calculators/BasicSalaryCalculator';
export { ProrataCalculator } from './calculators/ProrataCalculator';
export { AttendanceCalculator } from './calculators/AttendanceCalculator';
export { OvertimeCalculator } from './calculators/OvertimeCalculator';
export { ComponentCalculator } from './calculators/ComponentCalculator';
export { BpjsCalculator } from './calculators/BpjsCalculator';
export { TaxCalculator } from './calculators/TaxCalculator';
export { LoanDeductionCalculator } from './calculators/LoanDeductionCalculator';
export { NetSalaryCalculator } from './calculators/NetSalaryCalculator';
export { buildLine, sumEarnings, sumDeductions, sumTax, sumEmployerCost } from './helpers/line-builder';
export { createTestContext } from './helpers/context-helpers';
```

- [ ] **Step 2: Update module barrel export**

```typescript
// modules/salary-v2/index.ts
export * from './core';
export * from './calculation';
```

- [ ] **Step 3: Run ALL salary-v2 tests**

Run: `npx vitest run tests/modules/salary-v2/ --reporter=verbose`
Expected: ALL PASS (Phase 1 + Phase 2 tests)

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep salary-v2 || echo "0 type errors"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/calculation/index.ts modules/salary-v2/index.ts
git commit -m "feat(salary-v2): add calculation module barrel export and update module index"
```

---

## Summary

Phase 2 delivers a complete, testable calculation engine:

- **PayrollCalculationEngine** — pipeline orchestrator that runs calculators in order
- **9 calculators** implementing the full payroll calculation flow:
  1. BasicSalaryCalculator (order 10) — gaji pokok, daily rate, hourly rate
  2. ProrataCalculator (order 15) — proration for mid-period joins
  3. AttendanceCalculator (order 20) — absent and late deductions
  4. OvertimeCalculator (order 30) — tiered multipliers per PP 35/2021
  5. ComponentCalculator (order 40) — custom earning/deduction components
  6. BpjsCalculator (order 50) — full BPJS employee + employer
  7. TaxCalculator (order 60) — PPh 21 with NET/GROSS_UP/NETT methods
  8. LoanDeductionCalculator (order 70) — loans and salary advances
  9. NetSalaryCalculator (order 99) — final net salary computation
- **Helpers** — line-builder and test context factory
- **Pure/stateless** — no database access, fully unit-testable

**Next Phase:** Phase 3 (Tax Engine) — annual correction, TER brackets, detailed gross-up iteration.
