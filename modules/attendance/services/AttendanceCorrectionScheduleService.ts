import { ValidationError } from "@/lib/errors";
import type { AttendanceStatus } from "../types/attendance.enums";
import {
  addDays,
  differenceInMinutes,
  isAfter,
  isBefore,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  startOfDay as fnsStartOfDay,
  subHours,
} from "date-fns";
import { toDate, toZonedTime } from "date-fns-tz";
import type { AttendanceCorrectionSource } from "../repositories/AttendanceRepository";
import type { CorrectionSchedule } from "./AttendanceCorrectionTypes";

const CHECK_IN_WINDOW_HOURS = 3;

export class AttendanceCorrectionScheduleService {
  /** Resolve jadwal kerja source attendance untuk koreksi manual. */
  resolveSchedule(
    sourceAttendance: AttendanceCorrectionSource,
  ): CorrectionSchedule {
    const user = sourceAttendance.user;
    const startTime =
      user.workingHourMode === "SHIFT"
        ? this.parseTime(user.shift?.startTime ?? user.startWorkTime)
        : this.parseTime(user.startWorkTime);
    const endTime =
      user.workingHourMode === "SHIFT"
        ? this.parseTime(user.shift?.endTime ?? user.endWorkTime)
        : this.parseTime(user.endWorkTime);

    if (!startTime || !endTime) {
      throw new ValidationError(
        "Jadwal kerja karyawan belum lengkap, koreksi manual tidak bisa diproses",
      );
    }
    return { startTime, endTime };
  }

  /** Bangun window jadwal koreksi berdasarkan tanggal kerja dan timezone. */
  buildScheduleWindow(
    workDate: Date,
    schedule: CorrectionSchedule,
    timezone: string,
  ) {
    const startAt = this.buildClockTime(workDate, schedule.startTime, timezone);
    let endAt = this.buildClockTime(workDate, schedule.endTime, timezone);
    if (!isAfter(endAt, startAt)) endAt = addDays(endAt, 1);
    return {
      startAt,
      endAt,
      windowStart: subHours(startAt, CHECK_IN_WINDOW_HOURS),
    };
  }

  /** Validasi check-in berada dalam window koreksi. */
  assertCheckInWithinWindow(checkIn: Date, windowStart: Date, windowEnd: Date) {
    if (isBefore(checkIn, windowStart) || isAfter(checkIn, windowEnd)) {
      throw new ValidationError(
        "Jam check-in berada di luar jendela koreksi yang diizinkan",
      );
    }
  }

  /** Hitung late minutes sesuai status final. */
  buildLateMinutes(
    checkIn: Date,
    scheduledStartAt: Date,
    status: AttendanceStatus,
  ) {
    if (status !== "LATE") return 0;
    return Math.max(0, differenceInMinutes(checkIn, scheduledStartAt));
  }

  private parseTime(value: string | null | undefined): string | null {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
    return value;
  }

  private buildClockTime(workDate: Date, time: string, timezone: string): Date {
    const [hour = 0, minute = 0] = time.split(":").map(Number);
    const zonedDate = toZonedTime(workDate, timezone);
    let candidate = fnsStartOfDay(zonedDate);
    candidate = setHours(candidate, hour);
    candidate = setMinutes(candidate, minute);
    candidate = setSeconds(candidate, 0);
    candidate = setMilliseconds(candidate, 0);
    return toDate(candidate, { timeZone: timezone });
  }
}
