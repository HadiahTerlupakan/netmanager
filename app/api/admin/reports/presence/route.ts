import {
  AttendanceService,
  resolvePresenceReportScopeForUser,
} from "@/modules/attendance";
import { OvertimeService } from "@/modules/overtime";
import {
  apiSuccess,
  ErrorCodes,
  apiError,
  createHandler,
  ApiErrors,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";

// Disable Next.js caching for this route
export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  // Check permission
  const hasRead = await hasPermission("attendance:read");
  const hasViewReport = await hasPermission("report:read");

  if (!hasRead && !hasViewReport) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const { searchParams } = req.nextUrl;
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");

  // Seluruh site lingkup admin; siteId/departmentId query hanya mempersempit.
  const scope = await resolvePresenceReportScopeForUser(ctx.session!.user, {
    siteId: searchParams.get("siteId"),
    departmentId: searchParams.get("departmentId"),
  });
  if (scope.isEmpty) return apiSuccess({ attendance: [], overtime: [] });

  if (!startDateStr || !endDateStr) {
    return apiError(
      "Tanggal mulai dan tanggal akhir wajib diisi",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const startDate = new Date(startDateStr);
  startDate.setTime(toStartOfDay(startDate).getTime());
  const endDate = new Date(endDateStr);
  endDate.setTime(toEndOfDay(endDate).getTime());

  const attendanceService = new AttendanceService();
  const overtimeService = new OvertimeService();

  const [attendanceReport, overtimeReport] = await Promise.all([
    attendanceService.getReportData(
      startDate,
      endDate,
      scope.siteId,
      scope.departmentId,
    ),
    overtimeService.getReportData(
      startDate,
      endDate,
      scope.siteId,
      scope.departmentId,
    ),
  ]);

  return apiSuccess({
    attendance: attendanceReport,
    overtime: overtimeReport,
  });
});
