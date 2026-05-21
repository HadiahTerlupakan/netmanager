import type {
  PayrollPeriod,
  PeriodLockingPolicy,
} from "@/modules/salary-v2/core";

export interface LockCheckResult {
  allowed: boolean;
  reason?: string;
}

export class PeriodLockingService {
  canLock(period: PayrollPeriod): LockCheckResult {
    if (period.status !== "CLOSED") {
      return { allowed: false, reason: "Period must be CLOSED before locking" };
    }
    return { allowed: true };
  }

  canUnlock(
    period: PayrollPeriod,
    policy: PeriodLockingPolicy,
  ): LockCheckResult {
    if (period.status !== "LOCKED") {
      return { allowed: false, reason: "Period is not locked" };
    }

    if (period.unlockCount >= policy.maxUnlockCount) {
      return {
        allowed: false,
        reason: `Exceeded max unlock count (${policy.maxUnlockCount})`,
      };
    }

    return { allowed: true };
  }

  shouldAutoLock(
    period: PayrollPeriod,
    paidDate: Date,
    checkDate: Date,
    policy: PeriodLockingPolicy,
  ): boolean {
    if (!policy.autoLockAfterPaid) return false;
    if (period.status !== "CLOSED") return false;

    const daysSincePaid = Math.floor(
      (checkDate.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return daysSincePaid >= policy.autoLockDelayDays;
  }
}
