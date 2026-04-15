import { NextResponse } from "next/server";

import { createHandler } from "@/lib/api";
import {
  AttendanceService,
  AttendanceTimezoneService,
  AttendanceValidationService,
} from "@/modules/attendance";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const userId = ctx.session!.user.id;
  const tenantId = ctx.session!.user.tenantId!;
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

  return NextResponse.json({ success: true, data: status, today });
});
