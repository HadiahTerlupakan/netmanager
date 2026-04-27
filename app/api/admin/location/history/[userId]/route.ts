import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  AdminLocationRouteError,
  AdminLocationRouteService,
  LOCATION_READ_FORBIDDEN_MESSAGE,
} from "@/modules/attendance";

const adminLocationRouteService = new AdminLocationRouteService();

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

  try {
    const result = await adminLocationRouteService.getLocationHistory({
      userId: ctx.params.userId,
      startDate: req.nextUrl.searchParams.get("startDate"),
      endDate: req.nextUrl.searchParams.get("endDate"),
      permissions: ctx.permissions || [],
      session: { user: ctx.session!.user },
    });

    return apiSuccess(result);
  } catch (error) {
    return handleLocationRouteError(error);
  }
});

function handleLocationRouteError(error: unknown) {
  if (!(error instanceof AdminLocationRouteError)) {
    throw error;
  }

  if (error.status === 400) {
    return ApiErrors.badRequest(error.message);
  }

  if (error.status === 401) {
    return ApiErrors.unauthorized();
  }

  if (error.status === 403) {
    return ApiErrors.forbidden(LOCATION_READ_FORBIDDEN_MESSAGE);
  }

  throw error;
}
