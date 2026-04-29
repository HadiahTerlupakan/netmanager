import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { AttendanceEventDispatcher } from "@/modules/events";
import { UserLookupService } from "@/modules/users";
import {
  createAttendanceRepository,
  createHolidayRepository,
  createLeaveRepository,
} from "../factories/AttendanceRepositoryFactory";
import { AbsenceDayOffSyncService } from "./AbsenceDayOffSyncService";
import { AttendanceWorkdayService } from "./AttendanceWorkdayService";

export class AbsenceService {
  private readonly attendanceRepo = createAttendanceRepository();
  private readonly holidayRepo = createHolidayRepository();
  private readonly leaveRepo = createLeaveRepository();
  private readonly userRepo = new UserLookupService();
  private readonly workdayService = new AttendanceWorkdayService();
  private readonly dayOffSyncService = new AbsenceDayOffSyncService(
    this.holidayRepo,
    this.leaveRepo,
    this.attendanceRepo,
    this.userRepo,
    this.workdayService,
  );

  /** Process absence untuk tanggal tertentu dalam tenant. */
  async processDailyAbsence(targetDate: Date, tenantId: string) {
    const startOfDay = new Date(toStartOfDay(targetDate));
    const endOfDay = new Date(toEndOfDay(targetDate));
    const [isHoliday, users] = await Promise.all([
      this.isHoliday(tenantId, startOfDay, endOfDay),
      this.userRepo.findActiveForAttendance(tenantId, undefined, startOfDay),
    ]);
    let absent = 0;
    let dayOff = 0;

    for (const user of users) {
      const result = await this.processUserAbsence({
        user,
        targetDate,
        startOfDay,
        endOfDay,
        isHoliday,
        tenantId,
      });
      if (result === "absent") absent++;
      if (result === "dayOff") dayOff++;
    }

    return {
      processed: users.length,
      absent,
      dayOff,
      ...(isHoliday ? { message: "Holiday" } : {}),
    };
  }

  /** Sinkronkan attendance DAY_OFF untuk rentang tanggal. */
  async syncDayOffAttendanceRange(
    startDate: Date,
    endDate: Date,
    tenantId: string,
    userId?: string,
  ) {
    return this.dayOffSyncService.syncDayOffAttendanceRange(
      startDate,
      endDate,
      tenantId,
      userId,
    );
  }

  private async processUserAbsence(input: {
    user: { id: string; name: string | null; workDays: string | null };
    targetDate: Date;
    startOfDay: Date;
    endOfDay: Date;
    isHoliday: boolean;
    tenantId: string;
  }) {
    if (await this.hasAttendanceOrLeave(input)) return "present";
    const isWorkDay = this.workdayService.isWorkDay(
      input.user.workDays,
      input.targetDate,
    );
    if (input.isHoliday || !isWorkDay) {
      return this.createDayOffAttendance(input);
    }
    return this.createAbsentAttendance(input);
  }

  private async hasAttendanceOrLeave(input: {
    user: { id: string };
    startOfDay: Date;
    endOfDay: Date;
    tenantId: string;
  }) {
    const attendance = await this.attendanceRepo.findFirstByUserAndDateRange(
      input.user.id,
      input.tenantId,
      input.startOfDay,
      input.endOfDay,
    );
    if (attendance) return true;

    const leave = await this.leaveRepo.findActiveLeaveForUserOnDate(
      input.user.id,
      input.startOfDay,
      input.endOfDay,
      input.tenantId,
    );
    return Boolean(leave);
  }

  private async createDayOffAttendance(input: {
    user: { id: string; name: string | null };
    startOfDay: Date;
    isHoliday: boolean;
    tenantId: string;
  }) {
    try {
      await this.attendanceRepo.create({
        id: randomUUID(),
        userId: input.user.id,
        tenantId: input.tenantId,
        checkIn: new Date(toStartOfDay(input.startOfDay)),
        status: "DAY_OFF",
        notes: input.isHoliday
          ? "Hari Libur (Day Off) - Auto Generated"
          : "Hari Off (Day Off) - Auto Generated",
        location: "System",
        updatedAt: new Date(),
      });
      return "dayOff";
    } catch (error) {
      logger.error(
        `[AbsenceService] Error creating Day Off for ${input.user.name}:`,
        error,
      );
      return "present";
    }
  }

  private async createAbsentAttendance(input: {
    user: { id: string; name: string | null };
    startOfDay: Date;
    tenantId: string;
  }) {
    try {
      const attendanceId = randomUUID();
      const alphaTime = new Date(toStartOfDay(input.startOfDay));
      await this.attendanceRepo.create({
        id: attendanceId,
        userId: input.user.id,
        tenantId: input.tenantId,
        checkIn: alphaTime,
        status: "ABSENT",
        notes: "Tidak Masuk Kerja (Absent) - Auto Generated",
        location: "System",
        updatedAt: new Date(),
      });
      this.publishAbsentEvent(
        input.user,
        attendanceId,
        alphaTime,
        input.tenantId,
      );
      return "absent";
    } catch (error) {
      logger.error(
        `[AbsenceService] Error creating Absent for ${input.user.name}:`,
        error,
      );
      return "present";
    }
  }

  private publishAbsentEvent(
    user: { id: string; name: string | null },
    attendanceId: string,
    timestamp: Date,
    tenantId: string,
  ) {
    AttendanceEventDispatcher.onAbsent({
      userId: user.id,
      userName: user.name || undefined,
      attendanceId,
      timestamp: timestamp.toISOString(),
      tenantId,
    }).catch((error) =>
      logger.error(
        "Failed to publish ATTENDANCE_ABSENT event",
        error instanceof Error ? error : undefined,
      ),
    );
  }

  private async isHoliday(tenantId: string, startOfDay: Date, endOfDay: Date) {
    const holidays = await this.holidayRepo.findMany(tenantId, {
      where: { date: { gte: startOfDay, lte: endOfDay } },
    });
    return holidays.length > 0;
  }
}
