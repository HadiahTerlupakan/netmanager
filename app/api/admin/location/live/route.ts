import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  AdminLocationRouteError,
  AdminLocationRouteService,
  LOCATION_LIVE_FORBIDDEN_MESSAGE,
} from "@/modules/attendance";

const adminLocationRouteService = new AdminLocationRouteService();

/**
 * GET /api/admin/location/live
 * Mengambil lokasi live semua karyawan yang sedang checked-in
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("live_tracking:read"))) {
    return ApiErrors.forbidden(LOCATION_LIVE_FORBIDDEN_MESSAGE);
  }

  try {
    const result = await adminLocationRouteService.getLiveLocations(
      { user: ctx.session!.user },
      ctx.permissions || [],
    );

    return apiSuccess(result);
  } catch (error) {
    return handleLocationRouteError(error);
  }
});

function handleLocationRouteError(error: unknown) {
  if (error instanceof AdminLocationRouteError && error.status === 401) {
    return ApiErrors.unauthorized();
  }

  throw error;
}
