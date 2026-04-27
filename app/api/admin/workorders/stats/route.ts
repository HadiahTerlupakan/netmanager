import { adminWorkOrderRouteService } from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/stats */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("work_order_dashboard:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat statistik work order",
    );
  }

  const result = await adminWorkOrderRouteService.getStats({
    filters: {
      departmentId: req.nextUrl.searchParams.get("departmentId") || undefined,
      assignedToId: req.nextUrl.searchParams.get("assignedToId") || undefined,
    },
    user: ctx.session!.user,
    permissions: ctx.permissions,
  });

  if (!result.success) {
    return ApiErrors.unauthorized();
  }

  if (!result.data) {
    return apiError("Gagal mengambil statistik", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }

  return apiSuccess(result.data);
});
