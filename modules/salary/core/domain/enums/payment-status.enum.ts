export const PaymentBatchStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  PARTIAL_FAILED: "PARTIAL_FAILED",
} as const;

export type PaymentBatchStatus =
  (typeof PaymentBatchStatus)[keyof typeof PaymentBatchStatus];

export const PaymentItemStatus = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  RETRY: "RETRY",
} as const;

export type PaymentItemStatus =
  (typeof PaymentItemStatus)[keyof typeof PaymentItemStatus];

export const SalaryAdvanceStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DISBURSED: "DISBURSED",
  DEDUCTED: "DEDUCTED",
  REJECTED: "REJECTED",
} as const;

export type SalaryAdvanceStatus =
  (typeof SalaryAdvanceStatus)[keyof typeof SalaryAdvanceStatus];

export const AuditAction = {
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  DELETED: "DELETED",
  STATUS_CHANGED: "STATUS_CHANGED",
  RECALCULATED: "RECALCULATED",
  LOCKED: "LOCKED",
  UNLOCKED: "UNLOCKED",
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const ComplianceSeverity = {
  ERROR: "ERROR",
  WARNING: "WARNING",
} as const;

export type ComplianceSeverity =
  (typeof ComplianceSeverity)[keyof typeof ComplianceSeverity];

export const OvertimeDayType = {
  WORKDAY: "WORKDAY",
  HOLIDAY: "HOLIDAY",
  NATIONAL_HOLIDAY: "NATIONAL_HOLIDAY",
} as const;

export type OvertimeDayType =
  (typeof OvertimeDayType)[keyof typeof OvertimeDayType];

export const OvertimeCapEnforcement = {
  HARD_BLOCK: "HARD_BLOCK",
  SOFT_WARNING: "SOFT_WARNING",
  LOG_ONLY: "LOG_ONLY",
} as const;

export type OvertimeCapEnforcement =
  (typeof OvertimeCapEnforcement)[keyof typeof OvertimeCapEnforcement];
