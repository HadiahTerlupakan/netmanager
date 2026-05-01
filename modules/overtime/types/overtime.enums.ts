export const OvertimeStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
} as const;

export type OvertimeStatus =
  (typeof OvertimeStatus)[keyof typeof OvertimeStatus];
