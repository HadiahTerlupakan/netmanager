import { getAdminWorkOrderRouteService } from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/department-workload */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("work_order_dashboard:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat beban kerja departemen",
    );
  }

  const result = await getAdminWorkOrderRouteService().getDepartmentWorkload({
    user: ctx.session!.user,
    permissions: ctx.permissions,
  });

  if (!result.success) {
    if (result.code === "UNAUTHORIZED") {
      return ApiErrors.unauthorized();
    }

    return apiError(
      "Gagal mengambil data beban kerja departemen",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data);
});
