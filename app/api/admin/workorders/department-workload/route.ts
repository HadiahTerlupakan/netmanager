import { getAdminWorkOrderRouteService } from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

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
    return ApiErrors.unauthorized();
  }

  return apiSuccess(result.data);
});
