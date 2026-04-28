export type LeaveBalanceType =
  | "CUTI"
  | "SAKIT"
  | "IZIN"
  | "LAINNYA"
  | "TUKAR_LIBUR"
  | string;

export interface ILeaveBalanceRepository {
  /** Check whether employee still has enough leave quota. */
  hasEnoughDays(
    userId: string,
    year: number,
    leaveType: LeaveBalanceType,
    requiredDays: number,
    tenantId?: string,
  ): Promise<boolean>;

  /** Get remaining leave days for a leave type. */
  getRemainingDays(
    userId: string,
    year: number,
    leaveType: LeaveBalanceType,
    tenantId?: string,
  ): Promise<number>;
}
