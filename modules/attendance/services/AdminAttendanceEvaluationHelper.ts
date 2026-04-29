import {
  getDayOffDisplayLabel,
  getPermitDisplayLabel,
  isHistoricalAutoCheckoutAbsence,
} from "@/lib/attendance-display";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";
import type {
  AdminAttendanceRow,
  AttendanceEvaluationLookupRow,
} from "./AdminAttendanceTypes";

const CANONICAL_STATUS_DETAILS = new Set([
  "CUTI",
  "IZIN",
  "TUKAR_LIBUR",
  "HARI_LIBUR",
  "HARI_OFF",
]);

/** Cek apakah status detail memakai canonical evaluation. */
export function isCanonicalStatusDetail(statusDetail?: string) {
  return Boolean(statusDetail && CANONICAL_STATUS_DETAILS.has(statusDetail));
}

/** Bangun key lookup evaluation untuk attendance row. */
export function buildAttendanceEvaluationKey(
  attendance: Pick<
    AdminAttendanceRow,
    "tenantId" | "userId" | "checkIn" | "checkOut"
  >,
  timezone: string,
) {
  const workDate = toStartOfDay(
    attendance.checkOut ?? attendance.checkIn,
    timezone,
  );
  return `${attendance.tenantId ?? ""}:${attendance.userId}:${workDate.toISOString()}`;
}

/** Ambil evaluation map untuk daftar attendance admin. */
export async function getAttendanceEvaluationMap(
  repository: IAttendanceRepository,
  attendances: AdminAttendanceRow[],
  tenantId: string,
  timezone: string,
): Promise<Map<string, AttendanceEvaluationLookupRow>> {
  if (attendances.length === 0)
    return new Map<string, AttendanceEvaluationLookupRow>();
  const userIds = [...new Set(attendances.map((item) => item.userId))];
  const workDates = [
    ...new Set(
      attendances.map((item) =>
        toStartOfDay(item.checkOut ?? item.checkIn, timezone).toISOString(),
      ),
    ),
  ].map((value) => new Date(value));

  const evaluations = await repository.findManyEvaluationLookups({
    tenantId,
    userIds,
    workDates,
  });
  return new Map(
    evaluations.map((evaluation) => [
      buildEvaluationLookupKey(evaluation, timezone),
      evaluation,
    ]),
  );
}

/** Filter attendance berdasarkan canonical status detail. */
export function filterAttendancesByCanonicalStatusDetail<
  T extends AdminAttendanceRow,
>(
  attendances: T[],
  evaluationMap: Map<string, AttendanceEvaluationLookupRow>,
  statusDetail: string | undefined,
  timezone: string,
) {
  if (!isCanonicalStatusDetail(statusDetail)) return attendances;
  return attendances.filter((attendance) => {
    const evaluation = evaluationMap.get(
      buildAttendanceEvaluationKey(attendance, timezone),
    );
    return matchesCanonicalStatusDetail(statusDetail, evaluation);
  });
}

/** Ambil status efektif dari evaluation jika tersedia. */
export function getEffectiveAttendanceStatus(
  attendance: Pick<AdminAttendanceRow, "status">,
  evaluation?: AttendanceEvaluationLookupRow | null,
) {
  return evaluation?.finalStatus ?? attendance.status;
}

/** Ambil label display status untuk response admin attendance. */
export function getAttendanceDisplayStatus(
  attendance: AdminAttendanceRow,
  evaluation?: AttendanceEvaluationLookupRow | null,
) {
  const effectiveStatus = getEffectiveAttendanceStatus(attendance, evaluation);
  const isHistoricalNoCheckout = isHistoricalAutoCheckoutAbsence(attendance);

  if (effectiveStatus === "SICK") return "SAKIT";
  if (effectiveStatus === "PERMIT") {
    if (evaluation) return evaluation.leaveState === "CUTI" ? "CUTI" : "IZIN";
    return getPermitDisplayLabel(attendance).toUpperCase();
  }
  if (effectiveStatus === "DAY_OFF") {
    if (evaluation?.holidayState) return "LIBUR NASIONAL";
    if (evaluation?.leaveState) return "TUKAR LIBUR";
    if (evaluation) return "HARI LIBUR";
    return getDayOffDisplayLabel(attendance).toUpperCase();
  }
  if (effectiveStatus === "ALPHA" || effectiveStatus === "ABSENT") {
    if (isHistoricalNoCheckout) return "TIDAK CHECKOUT";
    if (
      attendance.checkIn &&
      !attendance.checkOut &&
      !attendance.notes?.includes("Tanpa Keterangan") &&
      !attendance.notes?.includes("Leave")
    ) {
      return "BELUM CHECKOUT";
    }
    return "TIDAK HADIR";
  }
  if (effectiveStatus === "NO_CHECKOUT") return "TIDAK CHECKOUT";
  if (effectiveStatus === "ON_TIME") return "TEPAT WAKTU";
  if (effectiveStatus === "LATE") return "TERLAMBAT";
  return effectiveStatus;
}

/** Bangun summary status dari attendance dan evaluation. */
export function buildSummaryFromAttendances(
  attendances: AdminAttendanceRow[],
  evaluationMap: Map<string, AttendanceEvaluationLookupRow>,
  timezone: string,
) {
  return attendances.reduce(
    (summary, attendance) => {
      const evaluation = evaluationMap.get(
        buildAttendanceEvaluationKey(attendance, timezone),
      );
      const effectiveStatus = getEffectiveAttendanceStatus(
        attendance,
        evaluation,
      );
      summary[effectiveStatus] = (summary[effectiveStatus] ?? 0) + 1;
      return summary;
    },
    {} as Record<string, number>,
  );
}

/** Tambahkan canonical dan displayStatus ke row attendance. */
export function enrichAttendanceRow<T extends AdminAttendanceRow>(
  attendance: T,
  evaluation?: AttendanceEvaluationLookupRow | null,
) {
  return {
    ...attendance,
    canonical: evaluation ?? null,
    displayStatus: getAttendanceDisplayStatus(attendance, evaluation),
  };
}

function buildEvaluationLookupKey(
  evaluation: AttendanceEvaluationLookupRow,
  timezone: string,
) {
  const normalizedWorkDate = toStartOfDay(evaluation.workDate, timezone);
  return `${evaluation.tenantId}:${evaluation.userId}:${normalizedWorkDate.toISOString()}`;
}

function matchesCanonicalStatusDetail(
  statusDetail: string | undefined,
  evaluation?: AttendanceEvaluationLookupRow | null,
) {
  if (!statusDetail) return true;
  if (statusDetail === "CUTI")
    return (
      evaluation?.finalStatus === "PERMIT" && evaluation.leaveState === "CUTI"
    );
  if (statusDetail === "IZIN") {
    return (
      evaluation?.finalStatus === "PERMIT" &&
      Boolean(evaluation.leaveState) &&
      evaluation.leaveState !== "CUTI"
    );
  }
  if (statusDetail === "TUKAR_LIBUR")
    return (
      evaluation?.finalStatus === "DAY_OFF" && Boolean(evaluation.leaveState)
    );
  if (statusDetail === "HARI_LIBUR")
    return (
      evaluation?.finalStatus === "DAY_OFF" && Boolean(evaluation.holidayState)
    );
  if (statusDetail === "HARI_OFF") {
    return (
      evaluation?.finalStatus === "DAY_OFF" &&
      !evaluation.holidayState &&
      !evaluation.leaveState
    );
  }
  return true;
}
