import { randomUUID } from "crypto";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { UserLookupService } from "@/modules/users";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";
import type { IHolidayRepository } from "../domain/ports/IHolidayRepository";
import type { ILeaveRepository } from "../domain/ports/ILeaveRepository";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { AttendanceWorkdayService } from "./AttendanceWorkdayService";

const DAY_OFF_HOLIDAY_NOTE = "Hari Libur (Day Off) - Auto Generated";
const DAY_OFF_REGULAR_NOTE = "Hari Off (Day Off) - Auto Generated";

type SyncableUser = {
  id: string;
  workDays: string | null;
};

export class AbsenceDayOffSyncService {
  constructor(
    private readonly holidayRepo: IHolidayRepository = new HolidayRepository(),
    private readonly leaveRepo: ILeaveRepository = new LeaveRepository(),
    private readonly attendanceRepo: IAttendanceRepository = new AttendanceRepository(),
    private readonly userRepo: UserLookupService,
    private readonly workdayService = new AttendanceWorkdayService(),
  ) {}

  /** Sinkronkan attendance DAY_OFF untuk rentang tanggal. */
  async syncDayOffAttendanceRange(
    startDate: Date,
    endDate: Date,
    tenantId: string,
    userId?: string,
  ) {
    const current = new Date(toStartOfDay(startDate));
    const last = new Date(toStartOfDay(endDate));

    while (current <= last) {
      await this.syncDay(current, tenantId, userId);
      current.setDate(current.getDate() + 1);
    }
  }

  private async syncDay(targetDate: Date, tenantId: string, userId?: string) {
    const { startOfDay, endOfDay } = this.createDayRange(targetDate);
    const isHoliday = await this.isHoliday(tenantId, startOfDay, endOfDay);
    const users = await this.userRepo.findActiveForAttendance(
      tenantId,
      userId,
      startOfDay,
    );

    for (const user of users) {
      if (!this.shouldCreateDayOff(user, targetDate, isHoliday)) continue;
      if (
        await this.hasAttendanceOrLeave(user.id, tenantId, startOfDay, endOfDay)
      ) {
        continue;
      }
      await this.createDayOff(user.id, tenantId, startOfDay, isHoliday);
    }
  }

  private createDayRange(targetDate: Date) {
    return {
      startOfDay: new Date(toStartOfDay(targetDate)),
      endOfDay: new Date(toEndOfDay(targetDate)),
    };
  }

  private shouldCreateDayOff(
    user: SyncableUser,
    targetDate: Date,
    isHoliday: boolean,
  ) {
    if (isHoliday) return true;
    return !this.workdayService.isWorkDay(user.workDays, targetDate);
  }

  private async isHoliday(tenantId: string, startOfDay: Date, endOfDay: Date) {
    const holiday = await this.holidayRepo.findFirstByTenantAndDateRange(
      tenantId,
      startOfDay,
      endOfDay,
    );
    return holiday !== null;
  }

  private async hasAttendanceOrLeave(
    userId: string,
    tenantId: string,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    const attendance = await this.attendanceRepo.findFirstByUserAndDateRange(
      userId,
      tenantId,
      startOfDay,
      endOfDay,
    );
    if (attendance) return true;

    const leave = await this.leaveRepo.findActiveLeaveForUserOnDate(
      userId,
      startOfDay,
      endOfDay,
      tenantId,
    );
    return Boolean(leave);
  }

  private createDayOff(
    userId: string,
    tenantId: string,
    checkIn: Date,
    isHoliday: boolean,
  ) {
    return this.attendanceRepo.create({
      id: randomUUID(),
      userId,
      tenantId,
      checkIn,
      status: "DAY_OFF",
      notes: this.getDayOffNote(isHoliday),
      location: "System",
      updatedAt: new Date(),
    });
  }

  private getDayOffNote(isHoliday: boolean) {
    return isHoliday ? DAY_OFF_HOLIDAY_NOTE : DAY_OFF_REGULAR_NOTE;
  }
}
