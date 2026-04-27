import { randomUUID } from "crypto";

import { getTimezone } from "@/lib/utils/get-timezone";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { UserRepository } from "@/modules/users";

import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";

const DEFAULT_WORK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_MAP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ABSENT_STATUS = "ABSENT" as const;
const SYSTEM_LOCATION = "System (Backdate)";
const ABSENT_NOTE = "Tanpa Keterangan";

interface BackdateAttendanceInput {
  tenantId: string;
  startDate: string;
  endDate: string;
}

interface BackdateAttendanceResult {
  message: string;
  generatedCount: number;
}

/** Service untuk backfill absensi admin. */
export class AdminAttendanceBackdateRouteService {
  private readonly attendanceRepository: AttendanceRepository;
  private readonly holidayRepository: HolidayRepository;
  private readonly userRepository: UserRepository;

  constructor(
    attendanceRepository: AttendanceRepository = new AttendanceRepository(),
    holidayRepository: HolidayRepository = new HolidayRepository(),
    userRepository: UserRepository = new UserRepository(),
  ) {
    this.attendanceRepository = attendanceRepository;
    this.holidayRepository = holidayRepository;
    this.userRepository = userRepository;
  }

  /** Backfill data absensi absen untuk rentang tanggal. */
  async backfillAttendance(
    input: BackdateAttendanceInput,
  ): Promise<BackdateAttendanceResult> {
    const timezone = await getTimezone(input.tenantId);
    const range = this.createDateRange(
      input.startDate,
      input.endDate,
      timezone,
    );
    let generatedCount = 0;

    for (const currentDate of this.createDailyDates(range.start, range.end)) {
      generatedCount += await this.processOneDate(
        currentDate,
        input.tenantId,
        timezone,
      );
    }

    return {
      message: `Berhasil backfill! ${generatedCount} data absensi (ABSENT) telah ditambahkan.`,
      generatedCount,
    };
  }

  /** Buat rentang tanggal valid untuk proses backfill. */
  private createDateRange(
    startDate: string,
    endDate: string,
    timezone: string,
  ) {
    const start = new Date(toStartOfDay(startDate, timezone));
    const now = new Date();
    const requestedEnd = new Date(toEndOfDay(endDate, timezone));
    const end = requestedEnd > now ? now : requestedEnd;

    if (start > end) {
      throw new Error("Tanggal awal tidak bisa lebih dari tanggal akhir");
    }

    return { start, end };
  }

  /** Buat daftar tanggal harian pada rentang input. */
  private createDailyDates(start: Date, end: Date): Date[] {
    const dates: Date[] = [];

    for (
      const value = new Date(start);
      value <= end;
      value.setDate(value.getDate() + 1)
    ) {
      dates.push(new Date(value));
    }

    return dates;
  }

  /** Proses backfill untuk satu tanggal kerja. */
  private async processOneDate(
    currentDate: Date,
    tenantId: string,
    timezone: string,
  ): Promise<number> {
    const dayContext = this.createDayContext(currentDate, timezone);
    const holiday = await this.holidayRepository.findFirstByTenantAndDateRange(
      tenantId,
      dayContext.dayStart,
      dayContext.dayEnd,
    );

    if (holiday) {
      return 0;
    }

    const users = await this.userRepository.findActiveForAttendance(
      tenantId,
      undefined,
      dayContext.dayStart,
    );

    let createdCount = 0;
    for (const user of users) {
      createdCount += await this.createAbsentAttendanceIfNeeded({
        user,
        tenantId,
        dayStart: dayContext.dayStart,
        dayEnd: dayContext.dayEnd,
        dayName: dayContext.dayName,
        dayNumber: dayContext.dayNumber,
      });
    }

    return createdCount;
  }

  /** Bentuk metadata hari untuk validasi workday. */
  private createDayContext(currentDate: Date, timezone: string) {
    const currentDayDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(currentDate);

    return {
      dayStart: toStartOfDay(currentDayDate, timezone),
      dayEnd: toEndOfDay(currentDayDate, timezone),
      dayName: DAY_MAP[currentDate.getDay()] ?? DAY_MAP[0],
      dayNumber: currentDate.getDay().toString(),
    };
  }

  /** Buat absensi alpha jika user wajib hadir dan belum punya data. */
  private async createAbsentAttendanceIfNeeded(input: {
    user: {
      id: string;
      workDays: string | null;
    };
    tenantId: string;
    dayStart: Date;
    dayEnd: Date;
    dayName: string;
    dayNumber: string;
  }): Promise<number> {
    if (
      !this.isScheduledWorkDay(
        input.user.workDays,
        input.dayName,
        input.dayNumber,
      )
    ) {
      return 0;
    }

    const existingAttendance =
      await this.attendanceRepository.findFirstByUserAndDateRange(
        input.user.id,
        input.tenantId,
        input.dayStart,
        input.dayEnd,
      );

    if (existingAttendance) {
      return 0;
    }

    await this.attendanceRepository.createWithId({
      id: randomUUID(),
      userId: input.user.id,
      tenantId: input.tenantId,
      checkIn: new Date(input.dayStart),
      status: ABSENT_STATUS,
      notes: ABSENT_NOTE,
      location: SYSTEM_LOCATION,
      updatedAt: new Date(),
    });

    return 1;
  }

  /** Tentukan apakah user dijadwalkan bekerja pada hari tersebut. */
  private isScheduledWorkDay(
    workDays: string | null,
    dayName: string,
    dayNumber: string,
  ): boolean {
    const schedule =
      workDays?.split(",").map((value) => value.trim()) || DEFAULT_WORK_DAYS;
    return schedule.includes(dayName) || schedule.includes(dayNumber);
  }
}
