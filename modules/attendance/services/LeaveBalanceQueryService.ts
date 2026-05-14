import type { LeaveType } from "../types/attendance.enums";
import { LeaveBalanceRepository } from "../repositories/LeaveBalanceRepository";

export class LeaveBalanceQueryService {
  constructor(private readonly repository = new LeaveBalanceRepository()) {}

  /** Get remaining leave days for a user. */
  getRemainingDays(
    userId: string,
    year: number,
    leaveType: LeaveType,
    tenantId?: string,
  ) {
    return this.repository.getRemainingDays(userId, year, leaveType, tenantId);
  }
}
