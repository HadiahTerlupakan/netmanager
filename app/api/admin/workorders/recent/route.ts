import { getAdminWorkOrderRouteService } from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/recent */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("list:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat work order",
    );
  }

  const result = await getAdminWorkOrderRouteService().getRecentWorkOrders({
    limit: Number.parseInt(req.nextUrl.searchParams.get("limit") || "5", 10),
    user: ctx.session!.user,
    permissions: ctx.permissions,
  });

  if (!result.success) {
    if (result.code === "UNAUTHORIZED") {
      return ApiErrors.unauthorized();
    }

    return apiError(
      result.error || "Gagal mengambil work order terbaru",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data);
});
