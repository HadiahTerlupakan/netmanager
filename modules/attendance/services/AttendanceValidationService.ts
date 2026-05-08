import { toDate, toZonedTime } from "date-fns-tz";
import {
  endOfDay as fnsEndOfDay,
  startOfDay as fnsStartOfDay,
  isBefore,
  isAfter,
  format,
} from "date-fns";

import { UserLookupService } from "@/modules/users";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import {
  buildScheduleWindow,
  parseTime,
  type AttendanceSchedule,
} from "../utils/attendance-window-utils";

import type { IHolidayRepository } from "../domain/ports/IHolidayRepository";
import type { ILeaveRepository } from "../domain/ports/ILeaveRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { isOffDayForUser } from "../utils/workingDayUtils";

export interface AttendanceDayMetadata {
  isHoliday: boolean;
  holidayName: string | null;
  isOffDay: boolean;
  isTukarLiburWorkDay: boolean;
  isTukarLiburLeaveDay: boolean;
}

function isDateWithinDay(
  date: Date | null | undefined,
  startOfDay: Date,
  endOfDay: Date,
): boolean {
  return Boolean(date && date >= startOfDay && date <= endOfDay);
}

export class AttendanceValidationService {
  private leaveRepo: ILeaveRepository;
  private holidayRepo: IHolidayRepository;
  private userRepo: UserLookupService;

  constructor(
    leaveRepo: ILeaveRepository = new LeaveRepository(),
    holidayRepo: IHolidayRepository = new HolidayRepository(),
    userRepo: UserLookupService = new UserLookupService(),
  ) {
    this.leaveRepo = leaveRepo;
    this.holidayRepo = holidayRepo;
    this.userRepo = userRepo;
  }

  private getDayBoundaries(date: Date, timezone: string) {
    const zonedDate = toZonedTime(date, timezone);
    const startOfDay = toDate(fnsStartOfDay(zonedDate), { timeZone: timezone });
    const endOfDay = toDate(fnsEndOfDay(zonedDate), { timeZone: timezone });

    return { zonedDate, startOfDay, endOfDay };
  }

  private getUserSchedule(userId: string, tenantId?: string) {
    if (tenantId) {
      return this.userRepo.findWorkScheduleByIdWithTenant(userId, tenantId);
    }

    return this.userRepo.findWorkScheduleById(userId);
  }

  private async getHolidayInfo(startOfDay: Date, tenantId?: string) {
    if (!tenantId) {
      return { isHoliday: false, holiday: null };
    }

    return this.holidayRepo.isHoliday(startOfDay, tenantId);
  }

  private async getTukarLiburFlags(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
    tenantId?: string,
  ) {
    const tukarLibur = await this.leaveRepo.findApprovedTukarLiburForUserOnDate(
      userId,
      startOfDay,
      endOfDay,
      tenantId,
    );

    return {
      isTukarLiburWorkDay: isDateWithinDay(
        tukarLibur?.replacementDate,
        startOfDay,
        endOfDay,
      ),
      isTukarLiburLeaveDay: isDateWithinDay(
        tukarLibur?.startDate,
        startOfDay,
        endOfDay,
      ),
    };
  }

  async getAttendanceDayMetadata(
    userId: string,
    timezone: string,
    date: Date = new Date(),
    tenantId?: string,
  ): Promise<AttendanceDayMetadata> {
    const { zonedDate, startOfDay, endOfDay } = this.getDayBoundaries(
      date,
      timezone,
    );
    const [holidayInfo, user, tukarLiburFlags] = await Promise.all([
      this.getHolidayInfo(startOfDay, tenantId),
      this.getUserSchedule(userId, tenantId),
      this.getTukarLiburFlags(userId, startOfDay, endOfDay, tenantId),
    ]);

    const dayOfWeek = zonedDate.getDay();
    let isOffDay = isOffDayForUser(
      dayOfWeek,
      user?.workDays ?? null,
      user?.workingHourMode ?? null,
    );

    if (tukarLiburFlags.isTukarLiburWorkDay) isOffDay = false;
    if (tukarLiburFlags.isTukarLiburLeaveDay) isOffDay = true;

    const isHoliday = holidayInfo.isHoliday;

    return {
      isHoliday,
      holidayName: isHoliday
        ? (holidayInfo.holiday?.description ?? null)
        : null,
      isOffDay,
      isTukarLiburWorkDay: tukarLiburFlags.isTukarLiburWorkDay,
      isTukarLiburLeaveDay: tukarLiburFlags.isTukarLiburLeaveDay,
    };
  }

  /**
   * Memvalidasi apakah user bisa check-in pada tanggal tertentu
   * Checks:
   * 1. Apakah ada Cuti yang disetujui (APPROVED) pada tanggal tersebut?
   * 2. Apakah tanggal tersebut adalah Hari Libur (Holiday)?
   * 3. Apakah tanggal tersebut adalah Off Day (bukan jadwal kerja)?
   */
  async validateCheckInEligibility(
    userId: string,
    timezone: string,
    date: Date = new Date(),
    tenantId?: string,
  ): Promise<{
    isValid: boolean;
    reason?: string;
    type?: "LEAVE" | "HOLIDAY" | "OFF_DAY";
  }> {
    const { startOfDay, endOfDay } = this.getDayBoundaries(date, timezone);
    const activeLeave = await this.leaveRepo.findActiveLeaveForUserOnDate(
      userId,
      startOfDay,
      endOfDay,
      tenantId,
    );

    if (activeLeave) {
      return {
        isValid: false,
        reason: `Anda sedang cuti/izin: ${activeLeave.type}`,
        type: "LEAVE",
      };
    }

    const dayMetadata = await this.getAttendanceDayMetadata(
      userId,
      timezone,
      date,
      tenantId,
    );

    if (dayMetadata.isHoliday) {
      return {
        isValid: false,
        reason: `Hari ini adalah hari libur: ${dayMetadata.holidayName}`,
        type: "HOLIDAY",
      };
    }

    if (dayMetadata.isOffDay) {
      return {
        isValid: false,
        reason: "Hari ini bukan jadwal kerja Anda",
        type: "OFF_DAY",
      };
    }

    return { isValid: true };
  }

  /** Validasi check-in berada dalam window waktu yang diizinkan (3 jam sebelum jam kerja sampai jam akhir kerja). */
  async validateCheckInTimeWindow(
    userId: string,
    checkInTime: Date,
    timezone: string,
  ): Promise<{
    isValid: boolean;
    reason?: string;
    windowStart?: Date;
    windowEnd?: Date;
  }> {
    const user = await this.userRepo.findAttendanceSettingsById(userId);

    // FLEXIBLE users tidak ada batasan waktu
    if (!user || user.workingHourMode === "FLEXIBLE") {
      return { isValid: true };
    }

    // Resolve schedule (FIXED: startWorkTime/endWorkTime, SHIFT: shift times)
    const schedule = this.resolveUserSchedule(user);
    if (!schedule) {
      return {
        isValid: false,
        reason: "Jadwal kerja Anda belum lengkap, silakan hubungi admin",
      };
    }

    // Build window menggunakan shared utility
    const workDate = toStartOfDay(checkInTime, timezone);
    const window = buildScheduleWindow(workDate, schedule, timezone);

    // Validate check-in within window
    if (isBefore(checkInTime, window.windowStart)) {
      const windowStartFormatted = format(window.windowStart, "HH:mm");
      return {
        isValid: false,
        reason: `Check-in terlalu awal. Waktu check-in paling awal: ${windowStartFormatted}`,
        windowStart: window.windowStart,
        windowEnd: window.endAt,
      };
    }

    if (isAfter(checkInTime, window.endAt)) {
      const windowEndFormatted = format(window.endAt, "HH:mm");
      return {
        isValid: false,
        reason: `Check-in terlalu malam. Waktu check-in paling akhir: ${windowEndFormatted}`,
        windowStart: window.windowStart,
        windowEnd: window.endAt,
      };
    }

    return { isValid: true };
  }

  private resolveUserSchedule(user: {
    workingHourMode: string;
    startWorkTime: string | null;
    endWorkTime: string | null;
    shift: { startTime: string; endTime: string } | null;
  }): AttendanceSchedule | null {
    const startTime =
      user.workingHourMode === "SHIFT"
        ? parseTime(user.shift?.startTime ?? user.startWorkTime)
        : parseTime(user.startWorkTime);

    const endTime =
      user.workingHourMode === "SHIFT"
        ? parseTime(user.shift?.endTime ?? user.endWorkTime)
        : parseTime(user.endWorkTime);

    if (!startTime || !endTime) return null;

    return { startTime, endTime };
  }
}
