import { prisma } from "@/lib/prisma";
import type { OvertimeSummary } from "@/modules/salary/core";

/** Port for fetching overtime data for payroll calculation. */
export interface IOvertimePayrollBridge {
  getOvertimeSummary(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    tenantId: string,
  ): Promise<OvertimeSummary>;
}

/**
 * Queries completed Overtime records to build an OvertimeSummary
 * for the salary calculation engine.
 *
 * Categorizes overtime minutes by day type:
 * - normalMinutes: regular workday overtime
 * - holidayMinutes: weekly off-day overtime (isOffDay or isHolidayOvertime without national)
 * - nationalHolidayMinutes: national holiday overtime
 */
export class OvertimePayrollBridge implements IOvertimePayrollBridge {
  async getOvertimeSummary(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    tenantId: string,
  ): Promise<OvertimeSummary> {
    const overtimeRecords = await prisma.overtime.findMany({
      where: {
        userId,
        tenantId,
        status: "COMPLETED",
        startTime: { gte: periodStart, lte: periodEnd },
      },
      select: {
        duration: true,
        isHolidayOvertime: true,
        isNationalHoliday: true,
        isOffDay: true,
      },
    });

    let normalMinutes = 0;
    let holidayMinutes = 0;
    let nationalHolidayMinutes = 0;

    for (const record of overtimeRecords) {
      const minutes = record.duration ?? 0;
      if (minutes === 0) continue;

      if (record.isNationalHoliday) {
        nationalHolidayMinutes += minutes;
      } else if (record.isHolidayOvertime || record.isOffDay) {
        holidayMinutes += minutes;
      } else {
        normalMinutes += minutes;
      }
    }

    return {
      normalMinutes,
      holidayMinutes,
      nationalHolidayMinutes,
      totalMinutes: normalMinutes + holidayMinutes + nationalHolidayMinutes,
    };
  }
}
