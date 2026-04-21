import { LocationTrackingService } from "@/modules/attendance";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";
import { prisma } from "@/modules/database";

/**
 * GET /api/admin/location/history/[userId]
 * Mengambil history lokasi untuk user tertentu
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("live_tracking:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat history lokasi",
    );
  }

  const { userId } = ctx.params;
  const searchParams = req.nextUrl.searchParams;
  const permissions = ctx.permissions || [];

  // Parse dates - default to today
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  let startDate = new Date();
  startDate.setTime(toStartOfDay(startDate).getTime());

  let endDate = new Date();
  endDate.setTime(toEndOfDay(endDate).getTime());

  if (startDateParam) {
    startDate = new Date(startDateParam);
    if (Number.isNaN(startDate.getTime())) {
      return ApiErrors.badRequest("Parameter tanggal tidak valid");
    }
  }
  if (endDateParam) {
    endDate = new Date(endDateParam);
    if (Number.isNaN(endDate.getTime())) {
      return ApiErrors.badRequest("Parameter tanggal tidak valid");
    }
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: ctx.session!.user.id },
    select: { id: true, siteId: true, departmentId: true },
  });

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, siteId: true, departmentId: true },
  });

  if (!adminUser || !targetUser) {
    return ApiErrors.unauthorized();
  }

  if (
    permissions.includes("live_tracking:site_only") &&
    adminUser.siteId &&
    adminUser.siteId !== targetUser.siteId
  ) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat history lokasi user ini",
    );
  }

  if (
    permissions.includes("live_tracking:department_only") &&
    adminUser.departmentId &&
    adminUser.departmentId !== targetUser.departmentId
  ) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat history lokasi user ini",
    );
  }

  const locationService = new LocationTrackingService();

  const [history, stats] = await Promise.all([
    locationService.getLocationHistory(userId, startDate, endDate),
    locationService.getLocationStats(userId, startDate, endDate),
  ]);

  return apiSuccess({
    locations: history,
    stats,
    userId,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  });
});
