import { prisma } from "@/lib/prisma";
import type { AttendanceSummary } from "@/modules/salary/core";
import { calculateWorkingDays } from "@/modules/attendance";

/** Port for fetching attendance data for payroll calculation. */
export interface IAttendancePayrollBridge {
  getAttendanceSummary(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    tenantId: string,
  ): Promise<AttendanceSummary>;
}

/**
 * Queries AttendanceEvaluation records to build an AttendanceSummary
 * for the salary calculation engine.
 */
export class AttendancePayrollBridge implements IAttendancePayrollBridge {
  async getAttendanceSummary(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    tenantId: string,
  ): Promise<AttendanceSummary> {
    const totalWorkDays = await calculateWorkingDays(
      periodStart,
      periodEnd,
      null,
      undefined,
      tenantId,
    );

    const evaluations = await prisma.attendanceEvaluation.findMany({
      where: {
        userId,
        tenantId,
        workDate: { gte: periodStart, lte: periodEnd },
      },
      select: {
        finalStatus: true,
        holidayState: true,
      },
    });

    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let sickDays = 0;
    let permitDays = 0;

    for (const evaluation of evaluations) {
      switch (evaluation.finalStatus) {
        case "ON_TIME":
          presentDays++;
          break;
        case "LATE":
        case "NO_CHECKOUT":
          presentDays++;
          lateDays++;
          break;
        case "ABSENT":
        case "ALPHA":
          absentDays++;
          break;
        case "SICK":
          sickDays++;
          break;
        case "PERMIT":
          permitDays++;
          break;
        case "DAY_OFF":
          // Not counted as work day
          break;
      }
    }

    // Effective days = present + sick + permit (paid leave counts as effective)
    const effectiveDays = presentDays + sickDays + permitDays;

    return {
      totalWorkDays,
      presentDays,
      absentDays,
      lateDays,
      sickDays,
      permitDays,
      effectiveDays,
    };
  }
}
