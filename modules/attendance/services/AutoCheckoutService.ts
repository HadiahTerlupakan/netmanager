import { toZonedTime } from "date-fns-tz";
import { toEndOfDay } from "@/lib/utils/server-datetime";
import { getTimezone } from "@/lib/utils/get-timezone";
import { AttendanceSessionPolicyService } from "./AttendanceSessionPolicyService";
import { AttendanceRepository } from "../repositories/AttendanceRepository";

export class AutoCheckoutService {
  /**
   * Run automatic checkout for users who forgot to check out.
   * This should run daily at 23:59.
   *
   * Logic:
   * - Find ALL active check-ins (checkOut is null), regardless of date.
   * - For each record:
   *   - If checkIn date is TODAY: Set checkOut to TODAY 23:59:59.
   *   - If checkIn date is PAST: Set checkOut to THAT DATE 23:59:59.
   * - Set status to 'MANGKIR'.
   * - Add system note.
   */
  static async runAutoCheckout() {
    const sessionPolicyService = new AttendanceSessionPolicyService();
    const attendanceRepo = new AttendanceRepository();
    const timezone = await getTimezone();

    // Use timezone-aware current time via date-fns-tz (reliable)
    const now = new Date();
    const nowInTz = toZonedTime(now, timezone);

    const endOfToday = new Date(nowInTz);
    endOfToday.setTime(toEndOfDay(endOfToday, timezone).getTime());

    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Find all open attendance sessions with user details via repository
    const openAttendances = await attendanceRepo.findAllOpenSessionsWithUser(
      endOfToday,
      twentyFourHoursAgo,
    );

    // console.log(`[AutoCheckout] Found ${openAttendances.length} open sessions. Processing...`)

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

        // Resolve scheduleEndTime from user settings instead of passing null
        let scheduleEndTime: string | null = null;
        if (user.workingHourMode === "SHIFT" && user.shift) {
          scheduleEndTime = user.shift.endTime;
        } else {
          scheduleEndTime = user.endWorkTime;
        }

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

    // console.log(`[AutoCheckout] Successfully auto-checked out ${updatedCount} users.`)
    return updatedCount;
  }
}
