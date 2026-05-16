import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import {
  AttendanceQueryService,
  HolidayLookupService,
} from "@/modules/attendance";
import { AttendanceStatus } from "@/modules/attendance/types/attendance.enums";
import type { OvertimeEntity } from "../domain/entities/OvertimeEntity";
import {
  type HolidayResolution,
  isUserOffDay,
  resolveHolidayDescription,
} from "./OvertimeService.helpers";

const NON_WORKING_ATTENDANCE_STATUSES = new Set<string>([
  AttendanceStatus.DAY_OFF,
  AttendanceStatus.ABSENT,
  AttendanceStatus.ALPHA,
  AttendanceStatus.SICK,
  AttendanceStatus.PERMIT,
]);

/** Mengelola state attendance dan holiday untuk flow overtime. */
export class OvertimeAttendanceStateService {
  constructor(
    private readonly holidayLookupService = new HolidayLookupService(),
    private readonly attendanceQueryService = new AttendanceQueryService(),
  ) {}

  /** Ambil attendance hari ini beserta data user. */
  async findTodayAttendance(userId: string, tenantId?: string) {
    const dateRange = createDayRange(new Date());

    return this.attendanceQueryService.findFirstWithUser({
      where: {
        userId,
        tenantId,
        checkIn: {
          gte: dateRange.startOfDay,
          lte: dateRange.endOfDay,
        },
      },
      orderBy: { checkIn: "desc" },
      userSelect: {
        workingHourMode: true,
        flexibleTargetHour: true,
        workDays: true,
      },
    });
  }

  /** Resolve holiday dan off-day flag untuk hari ini. */
  async resolveHolidayState(
    input: HolidayStateInput,
  ): Promise<HolidayResolution> {
    const today = new Date();
    const holidayResult = await this.holidayLookupService.isHoliday(
      today,
      input.tenantId,
    );
    const isOffDay = isUserOffDay(input.workDays, input.workingHourMode, today);

    return buildHolidayResolution(holidayResult, isOffDay);
  }

  /** Ambil state checkout attendance hari ini untuk mobile overtime. */
  async getTodayAttendanceState(userId: string, tenantId: string) {
    const attendance = await this.findTodayAttendance(userId, tenantId);
    if (!attendance || isNonWorkingAttendance(attendance.status)) {
      return { hasCheckedOut: true };
    }
    return { hasCheckedOut: attendance.checkOut !== null };
  }

  /** Ambil informasi holiday hari ini untuk mobile overtime. */
  async getTodayHolidayInfo(tenantId: string) {
    const holiday = await this.holidayLookupService.isHoliday(
      new Date(),
      tenantId,
    );
    if (!holiday.holiday) {
      return null;
    }

    return {
      description: holiday.holiday.description,
      isNational: holiday.holiday.isNational,
    };
  }

  /** Tambahkan flag holiday pada overtime legacy yang belum punya flag. */
  async enrichOvertimeFlags(data: OvertimeEntity[], tenantId?: string) {
    return Promise.all(
      data.map(async (item) => this.enrichOvertimeFlag(item, tenantId)),
    );
  }

  private async enrichOvertimeFlag(item: OvertimeEntity, tenantId?: string) {
    if (item.isHolidayOvertime) {
      return item;
    }

    const holiday = await this.holidayLookupService.isHoliday(
      item.createdAt,
      tenantId,
    );
    const isOffDay = isUserOffDay(
      item.user?.workDays,
      item.user?.workingHourMode,
      item.createdAt,
    );

    return {
      ...item,
      ...buildHolidayResolution(holiday, isOffDay),
    };
  }
}

type HolidayStateInput = {
  tenantId?: string;
  workDays?: string | null;
  workingHourMode?: string | null;
};

function createDayRange(date: Date) {
  return {
    startOfDay: toStartOfDay(new Date(date)),
    endOfDay: toEndOfDay(new Date(date)),
  };
}

function isNonWorkingAttendance(status: string | null | undefined): boolean {
  if (!status) return false;
  return NON_WORKING_ATTENDANCE_STATUSES.has(status);
}

function buildHolidayResolution(
  holidayResult: {
    isHoliday: boolean;
    holiday?: { isNational?: boolean; description?: string | null } | null;
  },
  isOffDay: boolean,
): HolidayResolution {
  return {
    isHolidayOvertime: holidayResult.isHoliday || isOffDay,
    isNationalHoliday:
      holidayResult.isHoliday && holidayResult.holiday?.isNational === true,
    isOffDay: isOffDay && !holidayResult.isHoliday,
    holidayDescription: resolveHolidayDescription(
      holidayResult.holiday?.description,
      isOffDay,
    ),
  };
}
