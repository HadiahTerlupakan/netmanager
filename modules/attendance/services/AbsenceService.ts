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

const DAY_OFF_HOLIDAY_NOTE = "Hari Libur (Day Off) - Auto Generated";
const DAY_OFF_REGULAR_NOTE = "Hari Off (Day Off) - Auto Generated";
const ABSENT_NOTE = "Tidak Masuk Kerja (Absent) - Auto Generated";
const SYSTEM_LOCATION = "System";

type AttendanceCandidateUser = {
  id: string;
  name: string | null;
  workDays: string | null;
};

type UserAbsenceInput = {
  user: AttendanceCandidateUser;
  targetDate: Date;
  startOfDay: Date;
  endOfDay: Date;
  isHoliday: boolean;
  tenantId: string;
};

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
    const { startOfDay, endOfDay } = this.createDayRange(targetDate);
    const context = await this.getDailyAbsenceContext(
      targetDate,
      tenantId,
      startOfDay,
      endOfDay,
    );
    const summary = await this.processUsersAbsence(context);

    return {
      processed: context.users.length,
      absent: summary.absent,
      dayOff: summary.dayOff,
      ...(context.isHoliday ? { message: "Holiday" } : {}),
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

  private createDayRange(targetDate: Date) {
    return {
      startOfDay: new Date(toStartOfDay(targetDate)),
      endOfDay: new Date(toEndOfDay(targetDate)),
    };
  }

  private async getDailyAbsenceContext(
    targetDate: Date,
    tenantId: string,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    const [isHoliday, users] = await Promise.all([
      this.isHoliday(tenantId, startOfDay, endOfDay),
      this.userRepo.findActiveForAttendance(tenantId, undefined, startOfDay),
    ]);

    return { targetDate, tenantId, startOfDay, endOfDay, isHoliday, users };
  }

  private async processUsersAbsence(context: {
    targetDate: Date;
    tenantId: string;
    startOfDay: Date;
    endOfDay: Date;
    isHoliday: boolean;
    users: AttendanceCandidateUser[];
  }) {
    const summary = { absent: 0, dayOff: 0 };

    for (const user of context.users) {
      const result = await this.processUserAbsence({
        user,
        targetDate: context.targetDate,
        startOfDay: context.startOfDay,
        endOfDay: context.endOfDay,
        isHoliday: context.isHoliday,
        tenantId: context.tenantId,
      });
      this.incrementSummary(summary, result);
    }

    return summary;
  }

  private incrementSummary(
    summary: { absent: number; dayOff: number },
    result: "absent" | "dayOff" | "present",
  ) {
    if (result === "absent") summary.absent += 1;
    if (result === "dayOff") summary.dayOff += 1;
  }

  private async processUserAbsence(input: UserAbsenceInput) {
    if (await this.hasAttendanceOrLeave(input)) return "present";
    if (this.shouldCreateDayOff(input))
      return this.createDayOffAttendance(input);
    return this.createAbsentAttendance(input);
  }

  private shouldCreateDayOff(input: UserAbsenceInput) {
    if (input.isHoliday) return true;
    return !this.workdayService.isWorkDay(
      input.user.workDays,
      input.targetDate,
    );
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
      const dayOffTime = new Date(toStartOfDay(input.startOfDay));
      await this.attendanceRepo.create({
        id: randomUUID(),
        userId: input.user.id,
        tenantId: input.tenantId,
        checkIn: dayOffTime,
        checkInDate: dayOffTime,
        status: "DAY_OFF",
        notes: input.isHoliday ? DAY_OFF_HOLIDAY_NOTE : DAY_OFF_REGULAR_NOTE,
        location: SYSTEM_LOCATION,
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
        checkInDate: alphaTime,
        status: "ABSENT",
        notes: ABSENT_NOTE,
        location: SYSTEM_LOCATION,
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
