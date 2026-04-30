import { AttendanceStatus } from "@prisma/client";
import type { AttendanceEvaluationResult } from "../types/AttendanceEvaluation";
import {
  formatCurrentAttendanceTime,
  normalizeReasonCodes,
  normalizeSourceRefs,
} from "./attendance-service-helpers";
import type { AttendanceRepository } from "../repositories/AttendanceRepository";

type CurrentAttendanceUiStatus = "idle" | "checked-in" | "checked-out";
export type CurrentAttendanceRow = {
  id: string;
  checkIn: Date;
  checkOut: Date | null;
  status: AttendanceStatus;
  user: {
    workingHourMode: "FIXED" | "SHIFT" | "FLEXIBLE" | null;
    flexibleTargetHour: number | null;
    shift: { startTime: string | null; endTime: string | null } | null;
  } | null;
};
export type ActiveAttendanceSessionRow = CurrentAttendanceRow;
type PersistedAttendanceEvaluationRow = Awaited<
  ReturnType<AttendanceRepository["findLatestEvaluationForUser"]>
>;
export type CurrentAttendanceEvaluationRow = Pick<
  AttendanceEvaluationResult,
  "finalStatus" | "reviewState" | "reasonCodes" | "anomalyCodes"
> | null;
export type CurrentAttendanceStatusResult = {
  status: CurrentAttendanceUiStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  warningMessage: string | null;
  sourceAttendanceId: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  attendanceStatus: AttendanceStatus | null;
  workingHourMode: "FIXED" | "SHIFT" | "FLEXIBLE" | null;
  flexibleTargetHour: number | null;
  shift: { startTime: string | null; endTime: string | null } | null;
};

/** Ubah evaluation tersimpan menjadi hasil domain absensi. */
export function mapPersistedAttendanceEvaluation(
  evaluation: PersistedAttendanceEvaluationRow,
): AttendanceEvaluationResult | null {
  if (!evaluation) return null;
  return {
    tenantId: evaluation.tenantId,
    userId: evaluation.userId,
    workDate: evaluation.workDate,
    finalStatus: evaluation.finalStatus,
    reviewState:
      evaluation.reviewState as AttendanceEvaluationResult["reviewState"],
    rawPresenceState: evaluation.rawPresenceState,
    workMinutes: evaluation.workMinutes,
    lateMinutes: evaluation.lateMinutes,
    overtimeMinutesApproved: evaluation.overtimeMinutesApproved,
    overtimeMinutesHeld: evaluation.overtimeMinutesHeld,
    payrollHoldState:
      evaluation.payrollHoldState as AttendanceEvaluationResult["payrollHoldState"],
    holidayState: evaluation.holidayState,
    leaveState: evaluation.leaveState,
    scheduleState: evaluation.scheduleState,
    evidenceQuality: evaluation.evidenceQuality,
    reasonCodes: normalizeReasonCodes(evaluation.reasonCodes),
    anomalyCodes: normalizeReasonCodes(evaluation.anomalyCodes),
    sourceRefs: normalizeSourceRefs(evaluation.sourceRefs),
    evaluationVersion: evaluation.evaluationVersion,
    evaluatedAt: evaluation.evaluatedAt,
  };
}

/** Ambil warning aktif dari evaluation absensi. */
export function getCurrentAttendanceWarningMessage(
  evaluation: CurrentAttendanceEvaluationRow,
  fallbackWarningMessage: string | null,
): string | null {
  if (!evaluation) return fallbackWarningMessage;
  const [firstReason] = normalizeReasonCodes(evaluation.reasonCodes);
  return firstReason ?? fallbackWarningMessage;
}

/** Bangun response status absensi aktif. */
export function mapCurrentAttendanceStatusResult(params: {
  attendance: CurrentAttendanceRow;
  evaluation: CurrentAttendanceEvaluationRow;
  timezone: string;
  status: CurrentAttendanceUiStatus;
  warningMessage: string | null;
}): CurrentAttendanceStatusResult {
  const { attendance, evaluation, timezone, status, warningMessage } = params;
  return {
    ...buildCurrentAttendanceTimes(attendance, timezone),
    status,
    warningMessage,
    attendanceStatus: evaluation?.finalStatus ?? attendance.status,
    ...buildCurrentAttendanceUserInfo(attendance),
  };
}

function buildCurrentAttendanceTimes(
  attendance: CurrentAttendanceRow,
  timezone: string,
) {
  return {
    checkInTime: formatCurrentAttendanceTime(attendance.checkIn, timezone),
    checkOutTime: formatCurrentAttendanceTime(attendance.checkOut, timezone),
    sourceAttendanceId: attendance.id,
    checkInAt: attendance.checkIn.toISOString(),
    checkOutAt: attendance.checkOut?.toISOString() ?? null,
  };
}

function buildCurrentAttendanceUserInfo(attendance: CurrentAttendanceRow) {
  return {
    workingHourMode: attendance.user?.workingHourMode ?? null,
    flexibleTargetHour: attendance.user?.flexibleTargetHour ?? null,
    shift: attendance.user?.shift ?? null,
  };
}

/** Bangun response status absensi idle. */
export function buildIdleCurrentAttendanceStatus(
  attendance?: CurrentAttendanceRow | null,
  warningMessage: string | null = null,
  evaluation?: CurrentAttendanceEvaluationRow,
): CurrentAttendanceStatusResult {
  return {
    status: "idle",
    checkInTime: null,
    checkOutTime: null,
    warningMessage,
    sourceAttendanceId: attendance?.id ?? null,
    checkInAt: attendance?.checkIn?.toISOString() ?? null,
    checkOutAt: attendance?.checkOut?.toISOString() ?? null,
    attendanceStatus: evaluation?.finalStatus ?? attendance?.status ?? null,
    workingHourMode: attendance?.user?.workingHourMode ?? null,
    flexibleTargetHour: attendance?.user?.flexibleTargetHour ?? null,
    shift: attendance?.user?.shift ?? null,
  };
}
