import { logger } from "@/lib/logger";
import type { CreateLeaveData } from "./LeaveService";
import type { LeaveWithUser } from "./LeaveLifecycleTypes";
import type { LeaveAttendanceSyncService } from "./LeaveAttendanceSyncService";
import type { LeaveBalanceUsageService } from "./LeaveBalanceUsageService";
import type { LeaveNotificationService } from "./LeaveNotificationService";

type BalanceUsageInput = Parameters<
  LeaveBalanceUsageService["incrementUsed"]
>[0];

export function buildCreateBalanceInput(
  data: CreateLeaveData,
  tenantId: string,
  user: { workDays: string | null; workingHourMode?: string | null },
) {
  return {
    userId: data.userId,
    tenantId,
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    workDays: user.workDays,
    workingHourMode: user.workingHourMode,
  };
}

export function buildExistingBalanceInput(
  leave: LeaveWithUser,
  tenantId: string,
) {
  return {
    userId: leave.userId,
    tenantId,
    type: leave.type,
    startDate: leave.startDate,
    endDate: leave.endDate,
    workDays: leave.user.workDays,
    workingHourMode: leave.user.workingHourMode,
  };
}

export function emptyBalanceInput(
  data: CreateLeaveData,
  tenantId: string,
): BalanceUsageInput {
  return {
    userId: data.userId,
    tenantId,
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    workDays: null,
    workingHourMode: null,
  };
}

export function insufficientBalanceResult() {
  return {
    success: false as const,
    error: "Sisa cuti tidak mencukupi",
    code: "INSUFFICIENT_BALANCE",
  };
}

export function logLeaveActivity(
  notificationService: LeaveNotificationService,
  input: {
    action: string;
    subject: string;
    userId: string;
    details: Record<string, unknown>;
  },
) {
  notificationService.logActivity(input);
}

export async function sendLeaveNotification(
  notificationService: LeaveNotificationService,
  input: { userId: string; title: string; message: string; sourceId: string },
) {
  await notificationService.sendNotification(input);
}

export async function syncCreatedLeave(input: {
  repository: {
    findByIdWithUser: (
      id: string,
      tenantId: string,
    ) => Promise<LeaveWithUser | null>;
  };
  attendanceSyncService: LeaveAttendanceSyncService;
  leaveId: string;
  tenantId: string;
}) {
  try {
    const leave = await fetchLeaveForSync(input);
    if (leave) await input.attendanceSyncService.syncLeaveToAttendance(leave);
  } catch (error) {
    logSyncError("Failed to sync leave to attendance", error);
  }
}

async function fetchLeaveForSync(input: {
  repository: {
    findByIdWithUser: (
      id: string,
      tenantId: string,
    ) => Promise<LeaveWithUser | null>;
  };
  leaveId: string;
  tenantId: string;
}) {
  return input.repository.findByIdWithUser(input.leaveId, input.tenantId);
}

function logSyncError(message: string, error: unknown) {
  logger.error(message, error instanceof Error ? error : undefined);
}

export async function syncApprovedLeave(
  attendanceSyncService: LeaveAttendanceSyncService,
  leave: LeaveWithUser,
) {
  try {
    await attendanceSyncService.syncLeaveToAttendance(leave);
  } catch (error) {
    logger.error(
      "Failed to sync leave to attendance in approve",
      error instanceof Error ? error : undefined,
    );
  }
}

export async function revertApprovedLeave(input: {
  leave: LeaveWithUser;
  tenantId: string;
  action: "reject" | "deletion";
  balanceUsageService: LeaveBalanceUsageService;
  attendanceSyncService: LeaveAttendanceSyncService;
}) {
  if (input.leave.status !== "APPROVED") return;
  await refundLeaveBalance(input);
  await revertAttendanceSync(input);
}

async function refundLeaveBalance(input: {
  leave: LeaveWithUser;
  tenantId: string;
  balanceUsageService: LeaveBalanceUsageService;
}) {
  await input.balanceUsageService.refundUsed(
    buildExistingBalanceInput(input.leave, input.tenantId),
  );
}

async function revertAttendanceSync(input: {
  leave: LeaveWithUser;
  action: "reject" | "deletion";
  attendanceSyncService: LeaveAttendanceSyncService;
}) {
  try {
    await input.attendanceSyncService.revertLeaveFromAttendance(input.leave);
  } catch (error) {
    const context = input.action === "reject" ? "reject" : "deletion";
    logSyncError(`Failed to revert attendance in ${context}`, error);
  }
}

export function createDecisionDetails(input: {
  id: string;
  status: string;
  leave: LeaveWithUser;
  extra?: Record<string, unknown>;
}) {
  return {
    id: input.id,
    status: input.status,
    userId: input.leave.userId,
    employeeName: input.leave.user.name,
    ...input.extra,
  };
}

export function logLeaveMutation(
  notificationService: LeaveNotificationService,
  input: { action: string; userId: string; details: Record<string, unknown> },
) {
  logLeaveActivity(notificationService, {
    action: input.action,
    subject: "LeaveRequest",
    userId: input.userId,
    details: input.details,
  });
}

export async function notifyLeaveDecision(
  notificationService: LeaveNotificationService,
  input: { userId: string; title: string; message: string; sourceId: string },
) {
  await sendLeaveNotification(notificationService, input);
}

export async function syncAutoApprovedLeave(input: {
  repository: {
    findByIdWithUser: (
      id: string,
      tenantId: string,
    ) => Promise<LeaveWithUser | null>;
  };
  attendanceSyncService: LeaveAttendanceSyncService;
  balanceUsageService: LeaveBalanceUsageService;
  leaveId: string;
  tenantId: string;
  autoApprove: boolean;
  user: { workDays: string | null; workingHourMode?: string | null } | null;
  validation: { leaveDays: number; balanceInput: BalanceUsageInput };
}) {
  if (!input.autoApprove || !input.user) return;
  await incrementAutoApprovedBalance(input);
  await syncCreatedLeave(input);
}

function incrementAutoApprovedBalance(input: {
  balanceUsageService: LeaveBalanceUsageService;
  validation: { leaveDays: number; balanceInput: BalanceUsageInput };
}) {
  return input.balanceUsageService.incrementUsed(
    input.validation.balanceInput,
    input.validation.leaveDays,
  );
}
