import { createHandler } from "@/lib/api";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { AttendanceService } from "@/modules/attendance";
import { AttendanceTimezoneService } from "@/modules/attendance";
import { AttendanceValidationService } from "@/modules/attendance";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
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

  return apiSuccess({ ...status, today });
});
