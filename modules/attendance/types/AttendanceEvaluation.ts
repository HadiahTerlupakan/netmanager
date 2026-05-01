import type { AttendanceStatus } from "./attendance.enums";

export type AttendanceReviewState = "FINAL" | "PENDING_REVIEW";

export type AttendancePayrollHoldState =
  | "NONE"
  | "OVERTIME_HELD"
  | "ALLOWANCE_HELD";

export interface AttendanceEvaluationResult {
  tenantId: string;
  userId: string;
  workDate: Date;
  finalStatus: AttendanceStatus;
  reviewState: AttendanceReviewState;
  rawPresenceState: string | null;
  workMinutes: number;
  lateMinutes: number;
  overtimeMinutesApproved: number;
  overtimeMinutesHeld: number;
  payrollHoldState: AttendancePayrollHoldState;
  holidayState: string | null;
  leaveState: string | null;
  scheduleState: string | null;
  evidenceQuality: string | null;
  reasonCodes: string[];
  anomalyCodes: string[];
  sourceRefs: Record<string, unknown>;
  evaluationVersion: number;
  evaluatedAt?: Date;
}

export interface AttendanceEvaluationAuditEntry {
  evaluationId: string | null;
  tenantId: string;
  userId: string;
  workDate: Date;
  action: string;
  previousSnapshot: AttendanceEvaluationResult | null;
  nextSnapshot: AttendanceEvaluationResult | null;
  reason: string;
  actorType: string;
  actorId: string | null;
  evaluationVersion: number;
  createdAt?: Date;
}
