import type { LeaveWithUserEntity } from "../domain/ports/ILeaveRepository";
import type { ServiceResult } from "./LeaveService";
import type { LeaveBalanceUsageService } from "./LeaveBalanceUsageService";

export type BalanceUsageInput = Parameters<
  LeaveBalanceUsageService["incrementUsed"]
>[0];
export type CreateLeaveContext = {
  actorId: string;
  tenantId: string;
  autoApprove: boolean;
};
export type CreateValidationSuccess = {
  success: true;
  leaveDays: number;
  balanceInput: BalanceUsageInput;
};
export type CreateValidationResult =
  | CreateValidationSuccess
  | { success: false; error: string; code: string };
export type ExistingLeaveResult =
  | { success: true; data: LeaveWithUser }
  | { success: false; error: string; code: string };

export type LeaveWithUser = LeaveWithUserEntity;

export type LeaveResult = ServiceResult<LeaveWithUser>;
