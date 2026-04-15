import { toDate, toZonedTime } from "date-fns-tz";
import { endOfDay as fnsEndOfDay, startOfDay as fnsStartOfDay } from "date-fns";

import { UserRepository } from "@/modules/users";

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
  private leaveRepo: LeaveRepository;
  private holidayRepo: HolidayRepository;
  private userRepo: UserRepository;

  constructor() {
    this.leaveRepo = new LeaveRepository();
    this.holidayRepo = new HolidayRepository();
    this.userRepo = new UserRepository();
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

    const isHoliday =
      holidayInfo.isHoliday && !tukarLiburFlags.isTukarLiburWorkDay;

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
}
