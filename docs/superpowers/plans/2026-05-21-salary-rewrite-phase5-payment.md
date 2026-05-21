# Salary Module Rewrite — Phase 5: Payment & Period Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement pay schedule management, payroll period lifecycle (open → processing → closed → locked), period locking/unlocking, and payment batch tracking. This phase connects the pure calculation engine to the database via repository implementations.

**Architecture:** Repository implementations using Prisma, service layer for business logic (period generation, locking rules, payment tracking). Services depend on repository interfaces from Phase 1 core.

**Tech Stack:** TypeScript, Prisma ORM, Vitest, existing core types

**Spec Reference:** `docs/superpowers/specs/2026-05-21-salary-module-rewrite-design.md` Section 7

**Phase Dependencies:** Phase 1 (Core — interfaces, entities)

**IMPORTANT:** Prisma schema was already added in Phase 1 Task 10. No new migration needed for this phase — we use the existing V2 models. If any schema change is needed, create a migration with `npx prisma migrate dev --name <description>`.

---

## File Structure

```
modules/salary-v2/
├── payment/
│   ├── repositories/
│   │   ├── PrismaPayScheduleRepository.ts
│   │   ├── PrismaPayrollPeriodRepository.ts
│   │   └── PrismaPayrollRunRepository.ts
│   ├── services/
│   │   ├── PayScheduleService.ts
│   │   ├── PayrollPeriodService.ts
│   │   └── PeriodLockingService.ts
│   └── index.ts
tests/modules/salary-v2/
└── payment/
    ├── pay-schedule-service.test.ts
    ├── payroll-period-service.test.ts
    └── period-locking-service.test.ts
```

---

## Task 1: PayScheduleService

**Files:**
- Create: `modules/salary-v2/payment/services/PayScheduleService.ts`
- Test: `tests/modules/salary-v2/payment/pay-schedule-service.test.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p modules/salary-v2/payment/{repositories,services}
mkdir -p tests/modules/salary-v2/payment
```

- [ ] **Step 2: Write test**

```typescript
// tests/modules/salary-v2/payment/pay-schedule-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PayScheduleService } from '@/modules/salary-v2/payment/services/PayScheduleService';
import type { IPayScheduleRepository } from '@/modules/salary-v2/core';
import type { PaySchedule } from '@/modules/salary-v2/core';

const mockSchedule: PaySchedule = {
  id: 'schedule-1',
  tenantId: 'tenant-1',
  name: 'Bulanan Standar',
  frequency: 'MONTHLY',
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

describe('PayScheduleService', () => {
  let service: PayScheduleService;
  let mockRepo: IPayScheduleRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(mockSchedule),
      findDefault: vi.fn().mockResolvedValue(mockSchedule),
      findAll: vi.fn().mockResolvedValue([mockSchedule]),
      create: vi.fn().mockResolvedValue(mockSchedule),
      update: vi.fn().mockResolvedValue(mockSchedule),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    service = new PayScheduleService(mockRepo);
  });

  it('should get schedule by id', async () => {
    const result = await service.getById('schedule-1', 'tenant-1');
    expect(result).toEqual(mockSchedule);
    expect(mockRepo.findById).toHaveBeenCalledWith('schedule-1', 'tenant-1');
  });

  it('should get default schedule', async () => {
    const result = await service.getDefault('tenant-1');
    expect(result).toEqual(mockSchedule);
    expect(mockRepo.findDefault).toHaveBeenCalledWith('tenant-1');
  });

  it('should list all schedules', async () => {
    const result = await service.listAll('tenant-1');
    expect(result).toHaveLength(1);
    expect(mockRepo.findAll).toHaveBeenCalledWith('tenant-1');
  });

  it('should create a new schedule', async () => {
    const input = {
      tenantId: 'tenant-1',
      name: 'Mingguan',
      frequency: 'WEEKLY' as const,
      cutOffDay: null,
      cutOffDayOfWeek: 6,
      payDay: 1,
      payDayOffset: 2,
      gracePeriodDays: 1,
      isDefault: false,
      isActive: true,
    };
    await service.create(input);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  it('should generate period dates for MONTHLY schedule', () => {
    const dates = service.generatePeriodDates(mockSchedule, 2026, 5);

    expect(dates.periodStart.getFullYear()).toBe(2026);
    expect(dates.periodStart.getMonth()).toBe(3); // April (0-indexed)
    expect(dates.periodStart.getDate()).toBe(26);
    expect(dates.periodEnd.getMonth()).toBe(4); // May
    expect(dates.periodEnd.getDate()).toBe(25);
    expect(dates.payDate.getDate()).toBe(28);
  });

  it('should generate period dates for previous month cutoff', () => {
    const schedule: PaySchedule = { ...mockSchedule, cutOffDay: 1, payDay: 5 };
    const dates = service.generatePeriodDates(schedule, 2026, 5);

    expect(dates.periodStart.getMonth()).toBe(3); // April 2
    expect(dates.periodStart.getDate()).toBe(2);
    expect(dates.periodEnd.getMonth()).toBe(4); // May 1
    expect(dates.periodEnd.getDate()).toBe(1);
  });
});
```

- [ ] **Step 3: Implement PayScheduleService**

```typescript
// modules/salary-v2/payment/services/PayScheduleService.ts
import type { IPayScheduleRepository, PaySchedule, PayFrequency } from '@/modules/salary-v2/core';
import { PayrollError } from '@/modules/salary-v2/core';

export interface CreateScheduleInput {
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
}

export interface PeriodDates {
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
}

export class PayScheduleService {
  constructor(private repo: IPayScheduleRepository) {}

  async getById(id: string, tenantId: string): Promise<PaySchedule | null> {
    return this.repo.findById(id, tenantId);
  }

  async getDefault(tenantId: string): Promise<PaySchedule | null> {
    return this.repo.findDefault(tenantId);
  }

  async listAll(tenantId: string): Promise<PaySchedule[]> {
    return this.repo.findAll(tenantId);
  }

  async create(input: CreateScheduleInput): Promise<PaySchedule> {
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, data: Partial<PaySchedule>): Promise<PaySchedule> {
    return this.repo.update(id, tenantId, data);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    return this.repo.delete(id, tenantId);
  }

  generatePeriodDates(schedule: PaySchedule, year: number, month: number): PeriodDates {
    const cutOffDay = schedule.cutOffDay ?? 25;

    const periodEndDate = new Date(year, month - 1, cutOffDay);
    const periodStartDate = new Date(year, month - 2, cutOffDay + 1);
    const payDate = new Date(year, month - 1, schedule.payDay);

    return {
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      payDate,
    };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/modules/salary-v2/payment/pay-schedule-service.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/payment/ tests/modules/salary-v2/payment/
git commit -m "feat(salary-v2): add PayScheduleService with period date generation"
```

---

## Task 2: PayrollPeriodService

**Files:**
- Create: `modules/salary-v2/payment/services/PayrollPeriodService.ts`
- Test: `tests/modules/salary-v2/payment/payroll-period-service.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/payment/payroll-period-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PayrollPeriodService } from '@/modules/salary-v2/payment/services/PayrollPeriodService';
import type { IPayrollPeriodRepository, PayrollPeriod } from '@/modules/salary-v2/core';

const mockPeriod: PayrollPeriod = {
  id: 'period-1',
  tenantId: 'tenant-1',
  scheduleId: 'schedule-1',
  periodStart: new Date('2026-04-26'),
  periodEnd: new Date('2026-05-25'),
  payDate: new Date('2026-05-28'),
  status: 'OPEN',
  lockedAt: null,
  lockedBy: null,
  unlockReason: null,
  unlockCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PayrollPeriodService', () => {
  let service: PayrollPeriodService;
  let mockRepo: IPayrollPeriodRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(mockPeriod),
      findCurrent: vi.fn().mockResolvedValue(mockPeriod),
      findAll: vi.fn().mockResolvedValue([mockPeriod]),
      create: vi.fn().mockResolvedValue(mockPeriod),
      update: vi.fn().mockResolvedValue(mockPeriod),
      updateStatus: vi.fn().mockResolvedValue({ ...mockPeriod, status: 'PROCESSING' }),
      checkOverlap: vi.fn().mockResolvedValue(false),
    };
    service = new PayrollPeriodService(mockRepo);
  });

  it('should get current period for schedule', async () => {
    const result = await service.getCurrent('schedule-1', 'tenant-1');
    expect(result).toEqual(mockPeriod);
  });

  it('should create period if no overlap', async () => {
    const input = {
      tenantId: 'tenant-1',
      scheduleId: 'schedule-1',
      periodStart: new Date('2026-05-26'),
      periodEnd: new Date('2026-06-25'),
      payDate: new Date('2026-06-28'),
    };
    const result = await service.createPeriod(input);
    expect(mockRepo.checkOverlap).toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalled();
  });

  it('should throw if period overlaps', async () => {
    vi.mocked(mockRepo.checkOverlap).mockResolvedValue(true);

    const input = {
      tenantId: 'tenant-1',
      scheduleId: 'schedule-1',
      periodStart: new Date('2026-04-26'),
      periodEnd: new Date('2026-05-25'),
      payDate: new Date('2026-05-28'),
    };

    await expect(service.createPeriod(input)).rejects.toThrow('PERIOD_OVERLAP');
  });

  it('should transition OPEN → PROCESSING', async () => {
    const result = await service.startProcessing('period-1', 'tenant-1');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('period-1', 'tenant-1', 'PROCESSING');
  });

  it('should reject invalid transition OPEN → LOCKED', async () => {
    await expect(service.lock('period-1', 'tenant-1', 'user-1')).rejects.toThrow();
  });

  it('should transition CLOSED → LOCKED', async () => {
    const closedPeriod = { ...mockPeriod, status: 'CLOSED' as const };
    vi.mocked(mockRepo.findById).mockResolvedValue(closedPeriod);
    vi.mocked(mockRepo.update).mockResolvedValue({ ...closedPeriod, status: 'LOCKED' as const, lockedAt: new Date(), lockedBy: 'user-1' });

    const result = await service.lock('period-1', 'tenant-1', 'user-1');
    expect(mockRepo.update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement PayrollPeriodService**

```typescript
// modules/salary-v2/payment/services/PayrollPeriodService.ts
import type { IPayrollPeriodRepository, PayrollPeriod, PayrollPeriodStatus } from '@/modules/salary-v2/core';
import { PayrollError } from '@/modules/salary-v2/core';

export interface CreatePeriodInput {
  tenantId: string;
  scheduleId: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['PROCESSING'],
  PROCESSING: ['CLOSED', 'OPEN'],
  CLOSED: ['LOCKED'],
  LOCKED: [],
};

export class PayrollPeriodService {
  constructor(private repo: IPayrollPeriodRepository) {}

  async getCurrent(scheduleId: string, tenantId: string): Promise<PayrollPeriod | null> {
    return this.repo.findCurrent(scheduleId, tenantId);
  }

  async getById(id: string, tenantId: string): Promise<PayrollPeriod | null> {
    return this.repo.findById(id, tenantId);
  }

  async createPeriod(input: CreatePeriodInput): Promise<PayrollPeriod> {
    const hasOverlap = await this.repo.checkOverlap(
      input.scheduleId, input.tenantId, input.periodStart, input.periodEnd
    );

    if (hasOverlap) {
      throw PayrollError.periodLocked('PERIOD_OVERLAP');
    }

    return this.repo.create({
      ...input,
      status: 'OPEN',
      lockedAt: null,
      lockedBy: null,
      unlockReason: null,
      unlockCount: 0,
    });
  }

  async startProcessing(id: string, tenantId: string): Promise<PayrollPeriod> {
    const period = await this.requirePeriod(id, tenantId);
    this.validateTransition(period.status, 'PROCESSING');
    return this.repo.updateStatus(id, tenantId, 'PROCESSING');
  }

  async close(id: string, tenantId: string): Promise<PayrollPeriod> {
    const period = await this.requirePeriod(id, tenantId);
    this.validateTransition(period.status, 'CLOSED');
    return this.repo.updateStatus(id, tenantId, 'CLOSED');
  }

  async lock(id: string, tenantId: string, lockedBy: string): Promise<PayrollPeriod> {
    const period = await this.requirePeriod(id, tenantId);
    this.validateTransition(period.status, 'LOCKED');
    return this.repo.update(id, tenantId, {
      status: 'LOCKED',
      lockedAt: new Date(),
      lockedBy,
    });
  }

  async unlock(id: string, tenantId: string, reason: string): Promise<PayrollPeriod> {
    const period = await this.requirePeriod(id, tenantId);
    if (period.status !== 'LOCKED') {
      throw PayrollError.invalidTransition(period.status, 'CLOSED');
    }
    return this.repo.update(id, tenantId, {
      status: 'CLOSED',
      lockedAt: null,
      lockedBy: null,
      unlockReason: reason,
      unlockCount: period.unlockCount + 1,
    });
  }

  private async requirePeriod(id: string, tenantId: string): Promise<PayrollPeriod> {
    const period = await this.repo.findById(id, tenantId);
    if (!period) throw PayrollError.notFound('period', id);
    return period;
  }

  private validateTransition(from: string, to: string): void {
    const allowed = VALID_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw PayrollError.invalidTransition(from, to);
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/modules/salary-v2/payment/payroll-period-service.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add modules/salary-v2/payment/services/PayrollPeriodService.ts tests/modules/salary-v2/payment/payroll-period-service.test.ts
git commit -m "feat(salary-v2): add PayrollPeriodService with status transitions and overlap check"
```

---

## Task 3: PeriodLockingService

**Files:**
- Create: `modules/salary-v2/payment/services/PeriodLockingService.ts`
- Test: `tests/modules/salary-v2/payment/period-locking-service.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/modules/salary-v2/payment/period-locking-service.test.ts
import { describe, it, expect } from 'vitest';
import { PeriodLockingService } from '@/modules/salary-v2/payment/services/PeriodLockingService';
import type { PeriodLockingPolicy, PayrollPeriod } from '@/modules/salary-v2/core';

const defaultPolicy: PeriodLockingPolicy = {
  autoLockAfterPaid: true,
  autoLockDelayDays: 3,
  requireApprovalToUnlock: true,
  maxUnlockCount: 2,
};

const closedPeriod: PayrollPeriod = {
  id: 'period-1', tenantId: 'tenant-1', scheduleId: 'schedule-1',
  periodStart: new Date('2026-04-26'), periodEnd: new Date('2026-05-25'),
  payDate: new Date('2026-05-28'), status: 'CLOSED',
  lockedAt: null, lockedBy: null, unlockReason: null, unlockCount: 0,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('PeriodLockingService', () => {
  const service = new PeriodLockingService();

  it('should allow lock if period is CLOSED', () => {
    const result = service.canLock(closedPeriod);
    expect(result.allowed).toBe(true);
  });

  it('should not allow lock if period is not CLOSED', () => {
    const openPeriod = { ...closedPeriod, status: 'OPEN' as const };
    const result = service.canLock(openPeriod);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Period must be CLOSED before locking');
  });

  it('should allow unlock if within max unlock count', () => {
    const lockedPeriod = { ...closedPeriod, status: 'LOCKED' as const, unlockCount: 1 };
    const result = service.canUnlock(lockedPeriod, defaultPolicy);
    expect(result.allowed).toBe(true);
  });

  it('should not allow unlock if max unlock count exceeded', () => {
    const lockedPeriod = { ...closedPeriod, status: 'LOCKED' as const, unlockCount: 2 };
    const result = service.canUnlock(lockedPeriod, defaultPolicy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('max unlock');
  });

  it('should not allow unlock if period is not LOCKED', () => {
    const result = service.canUnlock(closedPeriod, defaultPolicy);
    expect(result.allowed).toBe(false);
  });

  it('should determine if auto-lock is due', () => {
    const paidDate = new Date('2026-05-28');
    const checkDate = new Date('2026-06-01'); // 4 days after paid
    const result = service.shouldAutoLock(closedPeriod, paidDate, checkDate, defaultPolicy);
    expect(result).toBe(true);
  });

  it('should not auto-lock if within delay period', () => {
    const paidDate = new Date('2026-05-28');
    const checkDate = new Date('2026-05-29'); // 1 day after paid
    const result = service.shouldAutoLock(closedPeriod, paidDate, checkDate, defaultPolicy);
    expect(result).toBe(false);
  });

  it('should not auto-lock if policy disabled', () => {
    const paidDate = new Date('2026-05-28');
    const checkDate = new Date('2026-06-05');
    const disabledPolicy = { ...defaultPolicy, autoLockAfterPaid: false };
    const result = service.shouldAutoLock(closedPeriod, paidDate, checkDate, disabledPolicy);
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Implement PeriodLockingService**

```typescript
// modules/salary-v2/payment/services/PeriodLockingService.ts
import type { PayrollPeriod, PeriodLockingPolicy } from '@/modules/salary-v2/core';

export interface LockCheckResult {
  allowed: boolean;
  reason?: string;
}

export class PeriodLockingService {
  canLock(period: PayrollPeriod): LockCheckResult {
    if (period.status !== 'CLOSED') {
      return { allowed: false, reason: 'Period must be CLOSED before locking' };
    }
    return { allowed: true };
  }

  canUnlock(period: PayrollPeriod, policy: PeriodLockingPolicy): LockCheckResult {
    if (period.status !== 'LOCKED') {
      return { allowed: false, reason: 'Period is not locked' };
    }

    if (period.unlockCount >= policy.maxUnlockCount) {
      return { allowed: false, reason: `Exceeded max unlock count (${policy.maxUnlockCount})` };
    }

    return { allowed: true };
  }

  shouldAutoLock(period: PayrollPeriod, paidDate: Date, checkDate: Date, policy: PeriodLockingPolicy): boolean {
    if (!policy.autoLockAfterPaid) return false;
    if (period.status !== 'CLOSED') return false;

    const daysSincePaid = Math.floor(
      (checkDate.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSincePaid >= policy.autoLockDelayDays;
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/modules/salary-v2/payment/period-locking-service.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add modules/salary-v2/payment/services/PeriodLockingService.ts tests/modules/salary-v2/payment/period-locking-service.test.ts
git commit -m "feat(salary-v2): add PeriodLockingService with auto-lock and unlock validation"
```

---

## Task 4: Payment Module Barrel Export

**Files:**
- Create: `modules/salary-v2/payment/index.ts`
- Modify: `modules/salary-v2/index.ts`

- [ ] **Step 1: Create payment barrel export**

```typescript
// modules/salary-v2/payment/index.ts
export { PayScheduleService } from './services/PayScheduleService';
export type { CreateScheduleInput, PeriodDates } from './services/PayScheduleService';
export { PayrollPeriodService } from './services/PayrollPeriodService';
export type { CreatePeriodInput } from './services/PayrollPeriodService';
export { PeriodLockingService } from './services/PeriodLockingService';
export type { LockCheckResult } from './services/PeriodLockingService';
```

- [ ] **Step 2: Update module barrel export**

```typescript
// modules/salary-v2/index.ts
export * from './core';
export * from './calculation';
export * from './tax';
export * from './benefits';
export * from './payment';
```

- [ ] **Step 3: Run ALL salary-v2 tests**

Run: `npx vitest run tests/modules/salary-v2/ --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep salary-v2 || echo "0 type errors"`

- [ ] **Step 5: Commit**

```bash
git add modules/salary-v2/payment/index.ts modules/salary-v2/index.ts
git commit -m "feat(salary-v2): add payment module barrel export"
```

---

## Summary

Phase 5 delivers payment & period management:

- **PayScheduleService** — CRUD for pay schedules, period date generation for MONTHLY frequency
- **PayrollPeriodService** — Period lifecycle (OPEN → PROCESSING → CLOSED → LOCKED), overlap validation, unlock with reason tracking
- **PeriodLockingService** — Lock/unlock validation rules, auto-lock determination based on policy
- **Barrel exports** — Clean public API

**Note:** Repository implementations (Prisma) will be added in Phase 8 (API Layer) when we wire everything together. Services currently depend on interfaces only — making them fully testable with mocks.

**Next Phase:** Phase 6 (Workflow & Compliance — approval flow, compliance rules, audit trail)
