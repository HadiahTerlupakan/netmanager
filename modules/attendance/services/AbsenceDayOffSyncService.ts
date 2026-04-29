import { randomUUID } from "crypto";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { UserLookupService } from "@/modules/users";
import { AttendanceWorkdayService } from "./AttendanceWorkdayService";

export class AbsenceDayOffSyncService {
  constructor(
    private readonly holidayRepo: HolidayRepository,
    private readonly leaveRepo: LeaveRepository,
    private readonly attendanceRepo: AttendanceRepository,
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
    const startOfDay = new Date(toStartOfDay(targetDate));
    const endOfDay = new Date(toEndOfDay(targetDate));
    const isHoliday = await this.isHoliday(tenantId, startOfDay, endOfDay);
    const users = await this.userRepo.findActiveForAttendance(
      tenantId,
      userId,
      startOfDay,
    );

    for (const user of users) {
      const isWorkDay = this.workdayService.isWorkDay(
        user.workDays,
        targetDate,
      );
      if (!isHoliday && isWorkDay) continue;
      if (
        await this.hasAttendanceOrLeave(user.id, tenantId, startOfDay, endOfDay)
      )
        continue;
      await this.createDayOff(user.id, tenantId, startOfDay, isHoliday);
    }
  }

  private async isHoliday(tenantId: string, startOfDay: Date, endOfDay: Date) {
    const holidays = await this.holidayRepo.findMany(tenantId, {
      where: { date: { gte: startOfDay, lte: endOfDay } },
    });
    return holidays.length > 0;
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
      notes: isHoliday
        ? "Hari Libur (Day Off) - Auto Generated"
        : "Hari Off (Day Off) - Auto Generated",
      location: "System",
      updatedAt: new Date(),
    });
  }
}
