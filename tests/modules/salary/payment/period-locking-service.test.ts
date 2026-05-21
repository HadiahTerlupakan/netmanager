import { describe, it, expect } from "vitest";
import { PeriodLockingService } from "@/modules/salary/payment/services/PeriodLockingService";
import type { PeriodLockingPolicy, PayrollPeriod } from "@/modules/salary/core";

const defaultPolicy: PeriodLockingPolicy = {
  autoLockAfterPaid: true,
  autoLockDelayDays: 3,
  requireApprovalToUnlock: true,
  maxUnlockCount: 2,
};

const closedPeriod: PayrollPeriod = {
  id: "period-1",
  tenantId: "tenant-1",
  scheduleId: "schedule-1",
  periodStart: new Date("2026-04-26"),
  periodEnd: new Date("2026-05-25"),
  payDate: new Date("2026-05-28"),
  status: "CLOSED",
  lockedAt: null,
  lockedBy: null,
  unlockReason: null,
  unlockCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PeriodLockingService", () => {
  const service = new PeriodLockingService();

  it("should allow lock if period is CLOSED", () => {
    const result = service.canLock(closedPeriod);
    expect(result.allowed).toBe(true);
  });

  it("should not allow lock if period is not CLOSED", () => {
    const openPeriod = { ...closedPeriod, status: "OPEN" as const };
    const result = service.canLock(openPeriod);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Period must be CLOSED before locking");
  });

  it("should allow unlock if within max unlock count", () => {
    const lockedPeriod = {
      ...closedPeriod,
      status: "LOCKED" as const,
      unlockCount: 1,
    };
    const result = service.canUnlock(lockedPeriod, defaultPolicy);
    expect(result.allowed).toBe(true);
  });

  it("should not allow unlock if max unlock count exceeded", () => {
    const lockedPeriod = {
      ...closedPeriod,
      status: "LOCKED" as const,
      unlockCount: 2,
    };
    const result = service.canUnlock(lockedPeriod, defaultPolicy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("max unlock");
  });

  it("should not allow unlock if period is not LOCKED", () => {
    const result = service.canUnlock(closedPeriod, defaultPolicy);
    expect(result.allowed).toBe(false);
  });

  it("should determine if auto-lock is due", () => {
    const paidDate = new Date("2026-05-28");
    const checkDate = new Date("2026-06-01");
    const result = service.shouldAutoLock(
      closedPeriod,
      paidDate,
      checkDate,
      defaultPolicy,
    );
    expect(result).toBe(true);
  });

  it("should not auto-lock if within delay period", () => {
    const paidDate = new Date("2026-05-28");
    const checkDate = new Date("2026-05-29");
    const result = service.shouldAutoLock(
      closedPeriod,
      paidDate,
      checkDate,
      defaultPolicy,
    );
    expect(result).toBe(false);
  });

  it("should not auto-lock if policy disabled", () => {
    const paidDate = new Date("2026-05-28");
    const checkDate = new Date("2026-06-05");
    const disabledPolicy = { ...defaultPolicy, autoLockAfterPaid: false };
    const result = service.shouldAutoLock(
      closedPeriod,
      paidDate,
      checkDate,
      disabledPolicy,
    );
    expect(result).toBe(false);
  });
});
