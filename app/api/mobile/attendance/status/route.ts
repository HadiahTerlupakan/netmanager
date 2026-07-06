import { createHandler } from "@/lib/api";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { AttendanceService } from "@/modules/attendance";
import { AttendanceTimezoneService } from "@/modules/attendance";
import { AttendanceValidationService } from "@/modules/attendance";
import { format } from "date-fns";

export const GET = createHandler(
  { auth: true, permissions: ["m_absensi:read"] },
  async (_req, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId;

    if (!tenantId) {
      return ApiErrors.unauthorized("Tenant tidak ditemukan");
    }

    const attendanceService = new AttendanceService();
    const timezoneService = new AttendanceTimezoneService();
    const validationService = new AttendanceValidationService();
    const timezone = await timezoneService.getTimezone(tenantId);

    const [status, today] = await Promise.all([
      attendanceService.getCurrentAttendanceStatus(userId, { tenantId }),
      validationService.getAttendanceDayMetadata(
        userId,
        timezone,
        new Date(),
        tenantId,
      ),
    ]);

    // Populate check-in window untuk mobile app (button disable + keterangan)
    const windowCheck = await validationService.validateCheckInTimeWindow(
      userId,
      new Date(),
      timezone,
    );
    today.checkInWindow = windowCheck.isValid
      ? {
          canCheckIn: true,
          windowStart: windowCheck.windowStart
            ? format(windowCheck.windowStart, "HH:mm")
            : null,
          windowEnd: windowCheck.windowEnd
            ? format(windowCheck.windowEnd, "HH:mm")
            : null,
          message: null,
        }
      : {
          canCheckIn: false,
          windowStart: windowCheck.windowStart
            ? format(windowCheck.windowStart, "HH:mm")
            : null,
          windowEnd: windowCheck.windowEnd
            ? format(windowCheck.windowEnd, "HH:mm")
            : null,
          message: windowCheck.reason ?? null,
        };

    return apiSuccess({ ...status, today });
  },
);
