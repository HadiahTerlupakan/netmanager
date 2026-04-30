import type { AttendanceStatus } from "../types/attendance.enums";

import type {
  AttendanceEvaluationResult,
  AttendancePayrollHoldState,
  AttendanceReviewState,
} from "../types/AttendanceEvaluation";

type WorkingHourMode = "FIXED" | "SHIFT" | "FLEXIBLE";

type AttendanceFact = {
  status: AttendanceStatus;
  checkIn: Date;
  checkOut: Date | null;
  geofenceStatus?: string | null;
  geofenceSiteName?: string | null;
};

type LeaveFact = {
  type: string;
  approved: boolean;
};

type HolidayFact = {
  description: string;
};

type ScheduleFact = {
  workingHourMode: WorkingHourMode;
};

export interface AttendanceEvaluationInput {
  tenantId: string;
  userId: string;
  workDate: Date;
  attendance: AttendanceFact | null;
  leave: LeaveFact | null;
  holiday: HolidayFact | null;
  approvedOvertime: Record<string, unknown> | null;
  schedule: ScheduleFact | null;
}

const DEFAULT_EVALUATION_VERSION = 1;
const MILLISECONDS_PER_MINUTE = 60_000;
const FINAL_REVIEW_STATE: AttendanceReviewState = "FINAL";
const PENDING_REVIEW_STATE: AttendanceReviewState = "PENDING_REVIEW";
const NO_HOLD_STATE: AttendancePayrollHoldState = "NONE";
const OVERTIME_HELD_STATE: AttendancePayrollHoldState = "OVERTIME_HELD";
const DEFAULT_ABSENT_STATUS: AttendanceStatus = "ABSENT";
const DAY_OFF_STATUS: AttendanceStatus = "DAY_OFF";
const PERMIT_STATUS: AttendanceStatus = "PERMIT";
const WEAK_MISSING_SITE_CONFIG = "weak-missing-site-config";
const WEAK_GEOFENCE_REASON = "WEAK_GEOFENCE_EVIDENCE";
const MISSING_SITE_CONFIG_ANOMALY =
  "ATTENDANCE_ACCEPTED_WITHOUT_USABLE_SITE_CONFIG";
const ALLOWANCE_HELD_STATE: AttendancePayrollHoldState = "ALLOWANCE_HELD";

function getWorkMinutes(attendance: AttendanceFact | null): number {
  if (!attendance?.checkOut) {
    return 0;
  }

  const durationMs =
    attendance.checkOut.getTime() - attendance.checkIn.getTime();
  return Math.max(0, Math.round(durationMs / MILLISECONDS_PER_MINUTE));
}

function hasWeakMissingSiteConfig(attendance: AttendanceFact | null): boolean {
  if (!attendance) {
    return false;
  }

  return attendance.geofenceStatus === "INSIDE" && !attendance.geofenceSiteName;
}

function getWeakEvidenceFields(attendance: AttendanceFact | null) {
  if (!hasWeakMissingSiteConfig(attendance)) {
    return {
      reviewState: FINAL_REVIEW_STATE,
      payrollHoldState: NO_HOLD_STATE,
      evidenceQuality: null,
      reasonCodes: [] as string[],
      anomalyCodes: [] as string[],
    };
  }

  return {
    reviewState: PENDING_REVIEW_STATE,
    payrollHoldState: ALLOWANCE_HELD_STATE,
    evidenceQuality: WEAK_MISSING_SITE_CONFIG,
    reasonCodes: [WEAK_GEOFENCE_REASON],
    anomalyCodes: [MISSING_SITE_CONFIG_ANOMALY],
  };
}

function createBaseResult(
  input: AttendanceEvaluationInput,
): AttendanceEvaluationResult {
  const weakEvidence = getWeakEvidenceFields(input.attendance);

  return {
    tenantId: input.tenantId,
    userId: input.userId,
    workDate: input.workDate,
    finalStatus: input.attendance?.status ?? DEFAULT_ABSENT_STATUS,
    reviewState: weakEvidence.reviewState,
    rawPresenceState: input.attendance ? "ATTENDANCE_RECORDED" : null,
    workMinutes: getWorkMinutes(input.attendance),
    lateMinutes: 0,
    overtimeMinutesApproved: 0,
    overtimeMinutesHeld: 0,
    payrollHoldState: weakEvidence.payrollHoldState,
    holidayState: null,
    leaveState: null,
    scheduleState: input.schedule?.workingHourMode ?? null,
    evidenceQuality: weakEvidence.evidenceQuality,
    reasonCodes: weakEvidence.reasonCodes,
    anomalyCodes: weakEvidence.anomalyCodes,
    sourceRefs: {
      hasAttendance: Boolean(input.attendance),
      hasLeave: Boolean(input.leave?.approved),
      hasHoliday: Boolean(input.holiday),
      hasApprovedOvertime: Boolean(input.approvedOvertime),
    },
    evaluationVersion: DEFAULT_EVALUATION_VERSION,
    evaluatedAt: new Date(),
  };
}

function buildHolidayResult(
  input: AttendanceEvaluationInput,
): AttendanceEvaluationResult {
  const baseResult = createBaseResult(input);
  const hasAttendance = Boolean(input.attendance);

  return {
    ...baseResult,
    finalStatus: DAY_OFF_STATUS,
    reviewState: hasAttendance ? PENDING_REVIEW_STATE : FINAL_REVIEW_STATE,
    payrollHoldState: hasAttendance ? OVERTIME_HELD_STATE : NO_HOLD_STATE,
    holidayState: input.holiday?.description ?? "HOLIDAY",
    reasonCodes: ["HOLIDAY_OVERRIDES_ATTENDANCE"],
    anomalyCodes: hasAttendance
      ? ["ATTENDANCE_RECORDED_ON_HOLIDAY_WITHOUT_APPROVED_OVERTIME"]
      : [],
  };
}

function buildApprovedLeaveResult(
  input: AttendanceEvaluationInput,
): AttendanceEvaluationResult {
  const baseResult = createBaseResult(input);
  const hasAttendance = Boolean(input.attendance);

  return {
    ...baseResult,
    finalStatus: PERMIT_STATUS,
    reviewState: hasAttendance ? PENDING_REVIEW_STATE : FINAL_REVIEW_STATE,
    leaveState: input.leave?.type ?? "PERMIT",
    reasonCodes: ["APPROVED_LEAVE_OVERRIDES_ATTENDANCE"],
    anomalyCodes: hasAttendance
      ? ["ATTENDANCE_RECORDED_DURING_APPROVED_LEAVE"]
      : [],
  };
}

export class AttendanceDailyEvaluator {
  /** Mengevaluasi fakta absensi harian menjadi satu hasil canonical. */
  async evaluate(
    input: AttendanceEvaluationInput,
  ): Promise<AttendanceEvaluationResult> {
    if (input.holiday && !input.approvedOvertime) {
      return buildHolidayResult(input);
    }

    if (input.leave?.approved) {
      return buildApprovedLeaveResult(input);
    }

    return createBaseResult(input);
  }
}
