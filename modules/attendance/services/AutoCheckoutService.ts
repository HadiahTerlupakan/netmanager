import { logger } from "@/lib/logger";
import { toZonedTime } from "date-fns-tz";
import { toEndOfDay } from "@/lib/utils/server-datetime";
import { getTimezone } from "@/lib/utils/get-timezone";
import { prisma } from "@/modules/database";
import {
  addAttendanceAutoCheckoutJob,
  removeFailedAttendanceAutoCheckoutJob,
  type AttendanceAutoCheckoutJobData,
} from "@/lib/event-bus/queues";
import { AttendanceSessionPolicyService } from "./AttendanceSessionPolicyService";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { getInactiveSessionStatuses } from "../repositories/attendance-repository-helpers";

function buildAttendanceAutoCheckoutJobId(attendanceId: string): string {
  return `attendance:auto-checkout:${attendanceId}`;
}

function getSourceCheckInDate(checkIn: Date): string {
  return checkIn.toISOString().split("T")[0] ?? "";
}

function isExpectedAutoCheckoutMatched(
  payloadExpectedAutoCheckoutAt: string,
  resolvedAutoCheckoutAt: Date,
): boolean {
  const expectedAutoCheckoutAt = new Date(payloadExpectedAutoCheckoutAt);

  if (Number.isNaN(expectedAutoCheckoutAt.getTime())) {
    return false;
  }

  return expectedAutoCheckoutAt.getTime() === resolvedAutoCheckoutAt.getTime();
}

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
        if (getInactiveSessionStatuses().includes(attendance.status as never)) {
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
          timezone,
        });

        if (!decision.shouldAutoCheckout || !decision.autoCheckoutAt) {
          continue;
        }

        const jobId = buildAttendanceAutoCheckoutJobId(attendance.id);
        await removeFailedAttendanceAutoCheckoutJob(jobId);

        await addAttendanceAutoCheckoutJob(
          {
            attendanceId: attendance.id,
            tenantId,
            mode: user.workingHourMode as "FIXED" | "SHIFT" | "FLEXIBLE" | null,
            expectedAutoCheckoutAt: decision.autoCheckoutAt.toISOString(),
            sourceCheckInDate: getSourceCheckInDate(attendance.checkIn),
          },
          { jobId },
        );
        updatedCount++;
      } catch (error) {
        logger.error(
          `[AutoCheckout] Failed to enqueue attendance ${attendance.id}:`,
          error,
        );
      }
    }

    return updatedCount;
  }

  static async runAutoCheckoutJob(data: AttendanceAutoCheckoutJobData) {
    const attendanceRepo = new AttendanceRepository();
    const sessionPolicyService = new AttendanceSessionPolicyService();
    const timezone = await getTimezone(data.tenantId);
    const attendance = await attendanceRepo.findOpenSessionForAutoCheckout({
      attendanceId: data.attendanceId,
      tenantId: data.tenantId,
    });

    if (!attendance) {
      return { attendanceId: data.attendanceId, status: "noop" as const };
    }

    const scheduleEndTime =
      attendance.user.workingHourMode === "SHIFT" && attendance.user.shift
        ? attendance.user.shift.endTime
        : attendance.user.endWorkTime;

    const decision = sessionPolicyService.resolve({
      attendance: {
        id: attendance.id,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        status: attendance.status,
        user: {
          workingHourMode: attendance.user.workingHourMode as
            | "FIXED"
            | "SHIFT"
            | "FLEXIBLE"
            | null,
          flexibleTargetHour: null,
          shift: attendance.user.shift
            ? {
                startTime: attendance.user.shift.startTime,
                endTime: attendance.user.shift.endTime,
              }
            : null,
        },
      },
      now: new Date(),
      scheduleEndTime,
      timezone,
    });

    const sourceCheckInDate = getSourceCheckInDate(attendance.checkIn);
    if (sourceCheckInDate !== data.sourceCheckInDate) {
      return { attendanceId: attendance.id, status: "noop" as const };
    }

    const sourceMode = attendance.user.workingHourMode as
      | "FIXED"
      | "SHIFT"
      | "FLEXIBLE"
      | null;
    if (sourceMode !== data.mode) {
      return { attendanceId: attendance.id, status: "noop" as const };
    }

    const updateData = sessionPolicyService.buildAutoCheckoutUpdate({
      decision,
      existingNotes: attendance.notes ?? null,
    });

    if (!updateData) {
      return { attendanceId: attendance.id, status: "noop" as const };
    }

    if (
      !isExpectedAutoCheckoutMatched(
        data.expectedAutoCheckoutAt,
        updateData.checkOut,
      )
    ) {
      return { attendanceId: attendance.id, status: "noop" as const };
    }

    const updatedCount = await attendanceRepo.updateOpenSessionForAutoCheckout({
      attendanceId: attendance.id,
      tenantId: data.tenantId,
      data: updateData,
    });

    if (updatedCount === 0) {
      return { attendanceId: attendance.id, status: "noop" as const };
    }

    return { attendanceId: attendance.id, status: "processed" as const };
  }

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
