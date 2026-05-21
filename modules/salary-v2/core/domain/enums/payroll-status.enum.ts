export const PayrollRunStatus = {
  DRAFT: "DRAFT",
  CALCULATING: "CALCULATING",
  CALCULATED: "CALCULATED",
  AUDITED: "AUDITED",
  APPROVED: "APPROVED",
  PAID: "PAID",
  CLOSED: "CLOSED",
  REJECTED: "REJECTED",
  REVISION_REQUESTED: "REVISION_REQUESTED",
} as const;

export type PayrollRunStatus =
  (typeof PayrollRunStatus)[keyof typeof PayrollRunStatus];

export const PayrollEntryStatus = {
  PENDING: "PENDING",
  CALCULATED: "CALCULATED",
  ERROR: "ERROR",
  APPROVED: "APPROVED",
  PAID: "PAID",
} as const;

export type PayrollEntryStatus =
  (typeof PayrollEntryStatus)[keyof typeof PayrollEntryStatus];

export const PayrollRunType = {
  REGULAR: "REGULAR",
  THR: "THR",
  BONUS: "BONUS",
  RAPEL: "RAPEL",
  ADVANCE: "ADVANCE",
} as const;

export type PayrollRunType =
  (typeof PayrollRunType)[keyof typeof PayrollRunType];

export const PayrollPeriodStatus = {
  OPEN: "OPEN",
  PROCESSING: "PROCESSING",
  CLOSED: "CLOSED",
  LOCKED: "LOCKED",
} as const;

export type PayrollPeriodStatus =
  (typeof PayrollPeriodStatus)[keyof typeof PayrollPeriodStatus];
