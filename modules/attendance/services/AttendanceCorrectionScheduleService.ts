import { ValidationError } from "@/lib/errors";
import type { AttendanceStatus } from "../types/attendance.enums";
import { differenceInMinutes, isBefore, isAfter } from "date-fns";
import type { AttendanceCorrectionSource } from "../repositories/AttendanceRepository";
import type { CorrectionSchedule } from "./AttendanceCorrectionTypes";
import {
  buildScheduleWindow,
  parseTime,
} from "../utils/attendance-window-utils";

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
    return buildScheduleWindow(workDate, schedule, timezone);
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
    return parseTime(value);
  }
}
