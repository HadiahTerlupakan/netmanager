import type { LeaveType } from "@prisma/client";

export interface ILeaveBalanceRepository {
  /** Check whether employee still has enough leave quota. */
  hasEnoughDays(
    userId: string,
    year: number,
    leaveType: LeaveType,
    requiredDays: number,
    tenantId?: string,
  ): Promise<boolean>;

  /** Get remaining leave days for a leave type. */
  getRemainingDays(
    userId: string,
    year: number,
    leaveType: LeaveType,
    tenantId?: string,
  ): Promise<number>;
}
