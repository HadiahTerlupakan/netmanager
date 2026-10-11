import { AttendanceStatus } from "../types/attendance.enums";
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
/**
 * Kode alasan evaluasi ditulis untuk mesin (dipakai ekspor dan audit admin).
 * Sebelumnya kode mentahnya dikirim apa adanya sebagai `warningMessage` dan
 * aplikasi menampilkannya verbatim, sehingga teknisi melihat banner
 * "WEAK_GEOFENCE_EVIDENCE" di layar absensi.
 */
const PESAN_ALASAN_ABSENSI: Record<string, string> = {
  WEAK_GEOFENCE_EVIDENCE:
    "Lokasi absensi belum terverifikasi: titik GPS di luar area site, atau site Anda belum punya koordinat.",
  ATTENDANCE_ACCEPTED_WITHOUT_USABLE_SITE_CONFIG:
    "Absensi diterima, tetapi site Anda belum punya konfigurasi lokasi.",
  HOLIDAY_OVERRIDES_ATTENDANCE:
    "Hari ini hari libur, sehingga absensi tidak dihitung sebagai hari kerja.",
  APPROVED_LEAVE_OVERRIDES_ATTENDANCE:
    "Anda sedang izin/cuti yang disetujui, sehingga absensi tidak dihitung.",
  ATTENDANCE_RECORDED_ON_HOLIDAY_WITHOUT_APPROVED_OVERTIME:
    "Absensi tercatat di hari libur tanpa lembur yang disetujui.",
  ATTENDANCE_RECORDED_DURING_APPROVED_LEAVE:
    "Absensi tercatat saat Anda sedang izin/cuti yang disetujui.",
};

export function getCurrentAttendanceWarningMessage(
  evaluation: CurrentAttendanceEvaluationRow,
  fallbackWarningMessage: string | null,
): string | null {
  if (!evaluation) return fallbackWarningMessage;
  const [firstReason] = normalizeReasonCodes(evaluation.reasonCodes);
  if (!firstReason) return fallbackWarningMessage;
  // Kode yang belum punya kalimat tidak ditampilkan: lebih baik senyap
  // daripada memunculkan konstanta di layar orang.
  return PESAN_ALASAN_ABSENSI[firstReason] ?? fallbackWarningMessage;
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
