import { toZonedTime } from "date-fns-tz";
import { toEndOfDay } from "@/lib/utils/server-datetime";
import { getTimezone } from "@/lib/utils/get-timezone";
import { prisma } from "@/modules/database";
import { AttendanceSessionPolicyService } from "./AttendanceSessionPolicyService";
import { AttendanceRepository } from "../repositories/AttendanceRepository";

export class AutoCheckoutService {
  private static async runTenantAutoCheckout(tenantId: string) {
    const sessionPolicyService = new AttendanceSessionPolicyService();
    const attendanceRepo = new AttendanceRepository();
    const timezone = await getTimezone(tenantId);

    const now = new Date();
    const nowInTz = toZonedTime(now, timezone);
    const endOfToday = new Date(nowInTz);
    endOfToday.setTime(toEndOfDay(endOfToday, timezone).getTime());
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const openAttendances = await attendanceRepo.findAllOpenSessionsWithUser(
      endOfToday,
      twentyFourHoursAgo,
      tenantId,
    );

    let updatedCount = 0;

    for (const attendance of openAttendances) {
      try {
        if (
          ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"].includes(
            attendance.status,
          )
        ) {
          continue;
        }

        const { user } = attendance;
        const scheduleEndTime =
          user.workingHourMode === "SHIFT" && user.shift
            ? user.shift.endTime
            : user.endWorkTime;

        const decision = sessionPolicyService.resolve({
          attendance: {
            id: attendance.id,
            checkIn: attendance.checkIn,
            checkOut: attendance.checkOut,
            status: attendance.status,
            user: {
              workingHourMode: user.workingHourMode as
                | "FIXED"
                | "SHIFT"
                | "FLEXIBLE"
                | null,
              flexibleTargetHour: null,
              shift: user.shift
                ? {
                    startTime: user.shift.startTime,
                    endTime: user.shift.endTime,
                  }
                : null,
            },
          },
          now,
          scheduleEndTime,
        });

        const updateData = sessionPolicyService.buildAutoCheckoutUpdate({
          decision,
          existingNotes: attendance.notes ?? null,
        });

        if (!updateData) {
          continue;
        }

        await attendanceRepo.update(attendance.id, updateData);
        updatedCount++;
      } catch (error) {
        console.error(
          `[AutoCheckout] Failed to update attendance ${attendance.id}:`,
          error,
        );
      }
    }

    return updatedCount;
  }

  /**
   * Run automatic checkout for users who forgot to check out.
   * This should run daily at 23:59.
   */
  static async runAutoCheckout(tenantId?: string) {
    if (tenantId) {
      return this.runTenantAutoCheckout(tenantId);
    }

    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let updatedCount = 0;

    for (const tenant of tenants) {
      updatedCount += await this.runTenantAutoCheckout(tenant.id);
    }

    return updatedCount;
  }
}
