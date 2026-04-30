import { logger } from "@/lib/logger";
import { OvertimeStatus } from "../types/overtime.enums";

import type { AttendanceQueryService } from "@/modules/attendance";
import type { OvertimeEntity } from "../domain/entities/OvertimeEntity";

const DEFAULT_TARGET_HOURS = 8;
const MAX_OVERTIME_DURATION_MS = 8 * 60 * 60 * 1000;
const MIN_DURATION_MINUTES = 0;
const DAY_MAP: Record<number, string> = {
  0: "SUN",
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
};

export type HolidayResolution = {
  isHolidayOvertime: boolean;
  isNationalHoliday: boolean;
  isOffDay: boolean;
  holidayDescription: string | null;
};

/** Ensure overtime request is approved before start. */
export function assertApprovedRequest(overtime: OvertimeEntity): void {
  if (overtime.status === OvertimeStatus.APPROVED) {
    return;
  }

  throw new Error("Pengajuan lembur belum disetujui atau status tidak valid.");
}

/** Ensure overtime request is in progress before stop. */
export function assertInProgressRequest(overtime: OvertimeEntity): void {
  if (overtime.status !== OvertimeStatus.IN_PROGRESS) {
    throw new Error("Lembur belum dimulai.");
  }

  if (overtime.startTime) {
    return;
  }

  throw new Error("Data Start Time corrupt.");
}

/** Ensure overtime request is pending before approval mutation. */
export function assertPendingRequest(
  overtime: OvertimeEntity,
  nextAction: "approved" | "rejected",
): void {
  if (overtime.status === OvertimeStatus.PENDING) {
    return;
  }

  throw new Error(`Only pending overtime requests can be ${nextAction}`);
}

/** Determine whether a date is an employee off-day. */
export function isUserOffDay(
  workDays: string | null | undefined,
  mode: string | null | undefined,
  date: Date,
): boolean {
  if (!workDays || mode === "FLEXIBLE") {
    return false;
  }

  const dayName = DAY_MAP[date.getDay()];
  const workDayList = workDays
    .toUpperCase()
    .split(",")
    .map((item) => item.trim());
  return !workDayList.includes(dayName);
}

/** Resolve holiday description with off-day fallback text. */
export function resolveHolidayDescription(
  holidayDescription?: string | null,
  isOffDay?: boolean,
): string | null {
  if (holidayDescription) {
    return holidayDescription;
  }

  if (isOffDay) {
    return "Hari Libur Karyawan";
  }

  return null;
}

/** Log missing regular attendance before overtime start. */
export function logMissingRegularAttendance(
  userId: string,
  attendance: Awaited<ReturnType<AttendanceQueryService["findFirstWithUser"]>>,
  isHolidayOvertime: boolean,
): void {
  if (isHolidayOvertime || attendance) {
    return;
  }

  logger.warn(
    `[Overtime] User ${userId} starting overtime without regular attendance`,
  );
}

/** Log flexible shift shortfall before overtime start. */
export function logFlexibleShiftShortfall(
  userId: string,
  attendance: Awaited<ReturnType<AttendanceQueryService["findFirstWithUser"]>>,
  isHolidayOvertime: boolean,
): void {
  if (!attendance || attendance.user.workingHourMode !== "FLEXIBLE") {
    return;
  }

  if (isHolidayOvertime || !attendance.checkOut) {
    return;
  }

  const durationHours = calculateWorkedHours(
    attendance.checkIn,
    attendance.checkOut,
  );
  const targetHours =
    attendance.user.flexibleTargetHour || DEFAULT_TARGET_HOURS;
  if (durationHours >= targetHours) {
    return;
  }

  const shortfall = (targetHours - durationHours).toFixed(1);
  logger.warn(
    `[Overtime] User ${userId} starting overtime with incomplete regular shift: ${durationHours.toFixed(1)}h worked vs ${targetHours}h target (shortfall: ${shortfall}h)`,
  );
}

/** Convert attendance span to worked hours. */
export function calculateWorkedHours(checkIn: Date, checkOut: Date): number {
  const workedMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return workedMs / (1000 * 60 * 60);
}

/** Ensure overtime record contains start time. */
export function ensureStartTimeExists(overtime: OvertimeEntity): void {
  if (overtime.startTime) {
    return;
  }

  throw new Error("Data Start Time corrupt.");
}

/** Build completion payload with max duration cap. */
export function calculateCompletion(startTime: Date, requestedEndTime?: Date) {
  const effectiveEndTime = requestedEndTime || new Date();
  const autoCheckoutTime = new Date(
    startTime.getTime() + MAX_OVERTIME_DURATION_MS,
  );
  const endTime =
    effectiveEndTime.getTime() > autoCheckoutTime.getTime()
      ? autoCheckoutTime
      : effectiveEndTime;
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.round(durationMs / (1000 * 60));

  return {
    endTime,
    duration:
      durationMinutes > MIN_DURATION_MINUTES
        ? durationMinutes
        : MIN_DURATION_MINUTES,
  };
}

/** Build summary object for overtime report response. */
export function buildReportSummary(
  totalRequests: number,
  totalDuration: number,
) {
  return {
    totalRequests,
    totalDuration,
    avgDuration:
      totalRequests > 0 ? Math.round(totalDuration / totalRequests) : 0,
  };
}
